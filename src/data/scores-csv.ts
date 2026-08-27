/**
 * 成绩 CSV 导出 IO 壳（v1.12.0）：从 store 收集成绩，生成 CSV 并拉起系统分享。
 * 纯函数在 scores-csv-core.ts（node 回归直测）。
 */

import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useMusicStore, useScoreStore } from '../store';
import { buildScoresCsv, type CsvScoreRow } from './scores-csv-core';

function csvFileName(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `MaiMate-scores-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.csv`;
}

/** 从 store 收集成绩并分享 CSV 文件。 */
export async function exportScoresCsvToShare(): Promise<{ fileName: string; rowCount: number }> {
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
  const fileUri = `${cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, buildScoresCsv(rows), { encoding: FileSystem.EncodingType.UTF8 });

  try {
    if (!(await Sharing.isAvailableAsync())) throw new Error('当前设备不支持系统分享');
    await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: '导出成绩 CSV', UTI: 'public.comma-separated-values-text' });
  } finally {
    FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => undefined);
  }

  return { fileName, rowCount: rows.length };
}
