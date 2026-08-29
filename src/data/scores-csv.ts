/**
 * 成绩 CSV 导出 IO 壳（v1.12.0）：从 store 收集成绩，生成 CSV。
 * v1.16.6：mode 'share' 走系统分享；'save' 用 SAF 让用户选目录后写入（不再直接唤起分享）。
 * 纯函数在 scores-csv-core.ts（node 回归直测）。
 */

import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import { useMusicStore, useScoreStore } from '../store';
import { buildScoresCsv, type CsvScoreRow } from './scores-csv-core';

function csvFileName(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `MaiMate-scores-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.csv`;
}

export type ExportMode = 'share' | 'save';

/** SAF 选目录并写入文件；用户取消返回 null。 */
async function saveViaSaf(fileName: string, content: string, mimeType: string): Promise<string | null> {
  try {
    const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permissions.granted) return null;
    const fileUri = await StorageAccessFramework.createFileAsync(permissions.directoryUri, fileName, mimeType);
    await StorageAccessFramework.writeAsStringAsync(fileUri, content, { encoding: FileSystem.EncodingType.UTF8 });
    return fileUri;
  } catch {
    return null;
  }
}

/** 从 store 收集成绩并按 mode 导出 CSV 文件。 */
export async function exportScoresCsv(mode: ExportMode): Promise<{ fileName: string; rowCount: number; savedTo?: string }> {
  const cacheDirectory = FileSystem.cacheDirectory;
  if (!cacheDirectory) throw new Error('无法访问应用缓存目录');

  const scores = useScoreStore.getState().scores;
  const allSongs = useMusicStore.getState().rawData;
  const byChart = new Map(allSongs.map(music => [`${music.type}:${music.id}`, music]));

  const rows: CsvScoreRow[] = scores.map(score => {
    const music = byChart.get(`${score.type}:${score.songId}`);
    return {
      songId: score.songId,
      title: score.title || music?.title || score.songId,
      type: score.type,
      difficultyIndex: score.difficultyIndex,
      ds: score.ds ?? music?.ds[score.difficultyIndex],
      level: score.level ?? music?.level[score.difficultyIndex],
      achievement: score.achievement,
      dxScore: score.dxScore,
      rate: score.rate,
      fc: score.fc,
      fs: score.fs,
      serverRating: score.serverRating,
      importedAt: score.importedAt,
    };
  });

  const fileName = csvFileName();
  const content = buildScoresCsv(rows);

  if (mode === 'save') {
    const savedUri = await saveViaSaf(fileName, content, 'text/csv');
    if (savedUri === null) throw new Error('SAF_SAVE_CANCELLED');
    return { fileName, rowCount: rows.length, savedTo: savedUri };
  }

  const fileUri = `${cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, content, { encoding: FileSystem.EncodingType.UTF8 });
  try {
    if (!(await Sharing.isAvailableAsync())) throw new Error('当前设备不支持系统分享');
    await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: '导出成绩 CSV', UTI: 'public.comma-separated-values-text' });
  } finally {
    FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => undefined);
  }
  return { fileName, rowCount: rows.length };
}

/** 兼容旧调用名（v1.16.5 前的行为：直接分享）。 */
export const exportScoresCsvToShare = () => exportScoresCsv('share');