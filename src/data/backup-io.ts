import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import { CACHE_KEYS } from '../constants/game';
import { useBilibiliStore, usePlanStore, useScoreStore, useSettingsStore } from '../store';
import { useRatingHistoryStore } from '../store/rating-history-store';
import { RATING_HISTORY_STORAGE_KEY } from './rating-history';
import { CUSTOM_ALIAS_STORAGE_KEY, countCustomAliases, loadCustomAliases } from './custom-aliases';
import { getCustomAliasMap } from './song-aliases';
import {
  applyRestoreTransaction,
  BackupError,
  buildRestorePairs,
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
  // v1.19.0：Rating 历史与自定义别名也纳入回滚快照。
  RATING_HISTORY_STORAGE_KEY,
  CUSTOM_ALIAS_STORAGE_KEY,
] as const;

function currentAppVersion(): string {
  const version = Constants.expoConfig?.version;
  return typeof version === 'string' && version ? version : 'unknown';
}

function exportFileName(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `MaiMate-backup-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;
}

async function gatherBackupData(): Promise<BackupData> {
  // v1.19.0：Rating 历史 store 尚未 load 时先读一次，避免导出空历史。
  if (!useRatingHistoryStore.getState().loaded) await useRatingHistoryStore.getState().load();
  const ratingHistory = useRatingHistoryStore.getState().points;
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
    ratingHistory,
    customAliases: getCustomAliasMap(),
  };
}

function summarizeBuilt(backup: ReturnType<typeof buildBackup>): BackupSummary {
  return {
    planEntries: backup.data.plan.entries.length,
    scores: backup.data.scores.scores.length,
    snapshots: backup.data.scores.snapshots.length,
    bilibiliLinks: backup.data.bilibiliLinks.length,
    hasFortuneSeed: Boolean(backup.data.fortuneSeed),
    ratingHistoryPoints: backup.data.ratingHistory?.length ?? 0,
    customAliases: countCustomAliases(backup.data.customAliases ?? {}),
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
export async function exportBackup(mode: 'share' | 'save'): Promise<{ fileName: string; summary: BackupSummary; savedTo?: string }> {
  const cacheDirectory = FileSystem.cacheDirectory;
  if (!cacheDirectory) throw new BackupError('无法访问应用缓存目录');

  const data = await gatherBackupData();
  data.fortuneSeed = await readFortuneSeed();
  const backup = buildBackup(data, currentAppVersion(), Platform.OS);
  const fileName = exportFileName();
  const content = serializeBackup(backup);

  if (mode === 'save') {
    try {
      const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permissions.granted) throw new BackupError('SAF_SAVE_CANCELLED');
      const fileUri = await StorageAccessFramework.createFileAsync(permissions.directoryUri, fileName, 'application/json');
      await StorageAccessFramework.writeAsStringAsync(fileUri, content, { encoding: FileSystem.EncodingType.UTF8 });
      return {
        fileName,
        summary: summarizeBuilt(backup),
        savedTo: fileUri,
      };
    } catch (error) {
      if (error instanceof BackupError) throw error;
      throw new BackupError('SAF_SAVE_CANCELLED');
    }
  }

  const fileUri = `${cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, content, { encoding: FileSystem.EncodingType.UTF8 });
  try {
    if (!(await Sharing.isAvailableAsync())) throw new BackupError('当前设备不支持系统分享');
    await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: '导出 MaiMate 备份', UTI: 'public.json' });
  } finally {
    FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => undefined);
  }

  return {
    fileName,
    summary: summarizeBuilt(backup),
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
  return buildRestorePairs(backup, {
    ...CACHE_KEYS,
    ratingHistory: RATING_HISTORY_STORAGE_KEY,
    customAliases: CUSTOM_ALIAS_STORAGE_KEY,
  });
}

async function reloadPersistedStores(): Promise<void> {
  await Promise.all([
    usePlanStore.getState().loadPlan(),
    useScoreStore.getState().loadScores(),
    useSettingsStore.getState().loadSettings(),
    useBilibiliStore.getState().loadLinks(),
    useRatingHistoryStore.getState().load(),
    loadCustomAliases(),
  ]);
}

/**
 * 事务式恢复：先完整校验（由 pickAndValidateBackup 完成），写入前保存回滚快照，
 * 一次 multiSet 写入全部用户键；写失败用回滚快照还原，不留下半恢复状态。
 */
export async function restoreBackup(backup: ReturnType<typeof parseAndValidateBackup>['backup']): Promise<void> {
  await applyRestoreTransaction(
    AsyncStorage as unknown as Parameters<typeof applyRestoreTransaction>[0],
    USER_DATA_KEYS,
    payloadFor(backup),
    backup.data.fortuneSeed ? [] : [CACHE_KEYS.fortuneSeed],
  );
  await reloadPersistedStores();
}
