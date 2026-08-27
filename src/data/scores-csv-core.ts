/**
 * 成绩 CSV 生成（纯函数，node 可测）。
 *
 * - 列见 CSV_HEADER；遵循 RFC 4180：值内引号/逗号/换行转义，CRLF 行尾；
 * - 单谱面信息由调用方从曲库解析后传入。
 */

export const CSV_HEADER = [
  'songId', 'title', 'type', 'difficultyIndex', 'difficulty', 'ds', 'level',
  'achievement', 'dxScore', 'rate', 'fc', 'fs', 'serverRating', 'importedAt',
] as const;

export interface CsvScoreRow {
  songId: string;
  title: string;
  type: 'SD' | 'DX';
  difficultyIndex: number;
  ds: number | undefined;
  level: string | undefined;
  achievement: number;
  dxScore: number;
  rate?: string;
  fc?: string;
  fs?: string;
  serverRating?: number;
  importedAt: number;
}

function escapeCsvValue(value: string | number): string {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** 生成 CSV 文本（RFC 4180 转义，CRLF 行尾，含表头）。 */
export function buildScoresCsv(rows: CsvScoreRow[]): string {
  const lines = [CSV_HEADER.join(',')];
  for (const row of rows) {
    lines.push([
      row.songId,
      row.title,
      row.type,
      row.difficultyIndex,
      DIFFICULTY_NAMES[row.difficultyIndex] ?? `难度${row.difficultyIndex}`,
      row.ds ?? '',
      row.level ?? '',
      row.achievement,
      row.dxScore,
      row.rate ?? '',
      row.fc ?? '',
      row.fs ?? '',
      row.serverRating ?? '',
      new Date(row.importedAt).toISOString(),
    ].map(escapeCsvValue).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

const DIFFICULTY_NAMES: Record<number, string> = {
  0: 'Basic', 1: 'Advanced', 2: 'Expert', 3: 'Master', 4: 'Re:MASTER',
};
