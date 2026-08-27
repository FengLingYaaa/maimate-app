import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { CACHE_KEYS } from '../constants/game';
import { useBilibiliStore, usePlanStore, useScoreStore, useSettingsStore } from '../store';
import {
  BackupError,
  buildBackup,
  parseAndValidateBackup,
  serializeBackup,
  type BackupData,
  type BackupSummary,
} from './backup';

const USER_DATA_KEYS = [
  CACHE_KEYS.planData,
  CACHE_KEYS.planGraveyard,
  CACHE_KEYS.settings,
  CACHE_KEYS.scoreData,
  CACHE_KEYS.scoreSnapshots,
  CACHE_KEYS.scoreChanges,
  CACHE_KEYS.bilibiliLinks,
  CACHE_KEYS.fortuneSeed,
] as const;

function currentAppVersion(): string {
  const version = Constants.expoConfig?.version;
  return typeof version === 'string' && version ? version : 'unknown';
}

function exportFileName(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `MaiMate-backup-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;
}

function gatherBackupData(): BackupData {
  const settings = useSettingsStore.getState().settings;
  const plan = usePlanStore.getState();
  const score = useScoreStore.getState();
  const bilibili = useBilibiliStore.getState();
  return {
    settings,
    plan: { entries: plan.entries, graveyard: plan.graveyard },
    scores: {
      scores: score.scores,
      profile: score.profile,
      sync: score.sync,
      snapshots: score.snapshots,
      changes: score.changes,
    },
    bilibiliLinks: bilibili.links,
    fortuneSeed: null,
  };
}

async function readFortuneSeed(): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(CACHE_KEYS.fortuneSeed);
    return value || null;
  } catch {
    return null;
  }
}

/** 导出完整备份到临时文件并拉起系统分享面板。返回分享的文件名与摘要。 */
export async function exportBackupToShare(): Promise<{ fileName: string; summary: BackupSummary }> {
  const cacheDirectory = FileSystem.cacheDirectory;
  if (!cacheDirectory) throw new BackupError('无法访问应用缓存目录');

  const data = gatherBackupData();
  data.fortuneSeed = await readFortuneSeed();
  const backup = buildBackup(data, currentAppVersion(), Platform.OS);
  const fileName = exportFileName();
  const fileUri = `${cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, serializeBackup(backup), { encoding: FileSystem.EncodingType.UTF8 });

  try {
    if (!(await Sharing.isAvailableAsync())) throw new BackupError('当前设备不支持系统分享');
    await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: '导出 MaiMate 备份', UTI: 'public.json' });
  } finally {
    // 分享面板关闭后清理临时文件；失败不影响导出结果。
    FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => undefined);
  }

  return {
    fileName,
    summary: {
      planEntries: backup.data.plan.entries.length,
      scores: backup.data.scores.scores.length,
      snapshots: backup.data.scores.snapshots.length,
      bilibiliLinks: backup.data.bilibiliLinks.length,
      hasFortuneSeed: Boolean(backup.data.fortuneSeed),
    },
  };
}

/** 从系统文件选择器读取并校验备份，返回规范化后的备份与摘要（不落盘）。 */
export async function pickAndValidateBackup(): Promise<{ backup: ReturnType<typeof parseAndValidateBackup>['backup']; summary: BackupSummary; fileName: string }> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/json', 'application/octet-stream', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets || result.assets.length === 0) {
    throw new BackupError('已取消选择');
  }
  const asset = result.assets[0];
  let text: string;
  try {
    text = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
  } catch {
    throw new BackupError('无法读取所选文件');
  }
  const { backup, summary } = parseAndValidateBackup(text);
  return { backup, summary, fileName: asset.name || exportFileName() };
}

function payloadFor(backup: ReturnType<typeof parseAndValidateBackup>['backup']): Array<[string, string]> {
  const { plan, scores, settings, bilibiliLinks, fortuneSeed } = backup.data;
  const pairs: Array<[string, string]> = [
    [CACHE_KEYS.planData, JSON.stringify({ entries: plan.entries, updatedAt: Date.now() })],
    [CACHE_KEYS.planGraveyard, JSON.stringify(plan.graveyard)],
    [CACHE_KEYS.settings, JSON.stringify(settings)],
    [CACHE_KEYS.scoreData, JSON.stringify({ scores: scores.scores, sync: scores.sync, profile: scores.profile })],
    [CACHE_KEYS.scoreSnapshots, JSON.stringify(scores.snapshots)],
    [CACHE_KEYS.scoreChanges, JSON.stringify(scores.changes)],
    [CACHE_KEYS.bilibiliLinks, JSON.stringify(bilibiliLinks)],
  ];
  if (fortuneSeed) pairs.push([CACHE_KEYS.fortuneSeed, fortuneSeed]);
  return pairs;
}

async function reloadPersistedStores(): Promise<void> {
  await Promise.all([
    usePlanStore.getState().loadPlan(),
    useScoreStore.getState().loadScores(),
    useSettingsStore.getState().loadSettings(),
    useBilibiliStore.getState().loadLinks(),
  ]);
}

/**
 * 事务式恢复：先完整校验（由 pickAndValidateBackup 完成），写入前保存回滚快照，
 * 一次 multiSet 写入全部用户键；写失败用回滚快照还原，不留下半恢复状态。
 */
export async function restoreBackup(backup: ReturnType<typeof parseAndValidateBackup>['backup']): Promise<void> {
  const rollback = await AsyncStorage.multiGet([...USER_DATA_KEYS]);
  try {
    const pairs = payloadFor(backup);
    await AsyncStorage.multiSet(pairs);
    if (!backup.data.fortuneSeed) {
      await AsyncStorage.removeItem(CACHE_KEYS.fortuneSeed);
    }
  } catch (error) {
    // 还原失败：用之前的快照回滚，尽力而为。
    const rollbackPairs = rollback.filter(([, value]) => value !== null) as Array<[string, string]>;
    try {
      await AsyncStorage.multiSet(rollbackPairs);
    } catch {
      // 回滚也失败时至少不清空存储。
    }
    throw error instanceof Error ? error : new BackupError('恢复失败');
  }
  await reloadPersistedStores();
}
