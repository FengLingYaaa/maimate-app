import { normalizeSearchText } from './music-list';
import { getSearchTitles } from './song-aliases';
import type { MusicData } from './types';

export interface TitleMatch {
  music: MusicData;
  recognizedText: string;
  score: number;
}

function compact(value: string): string {
  return normalizeSearchText(value).replace(/\s/g, '');
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 0; i < a.length; i += 1) {
    let diagonal = row[0];
    row[0] = i + 1;
    for (let j = 0; j < b.length; j += 1) {
      const above = row[j + 1];
      const cost = a[i] === b[j] ? 0 : 1;
      row[j + 1] = Math.min(row[j + 1] + 1, row[j] + 1, diagonal + cost);
      diagonal = above;
    }
  }
  return row[b.length];
}

function scoreTitle(title: string, recognizedLine: string): number | null {
  const normalizedTitle = compact(title);
  const normalizedLine = compact(recognizedLine);
  if (normalizedTitle.length < 2 || normalizedLine.length < 2) return null;

  if (normalizedLine === normalizedTitle) return 1;
  if (normalizedLine.includes(normalizedTitle)) return 0.96;
  if (normalizedTitle.includes(normalizedLine) && normalizedLine.length >= 3) {
    return 0.78 + Math.min(normalizedLine.length / normalizedTitle.length, 1) * 0.12;
  }

  const distance = levenshtein(normalizedTitle, normalizedLine);
  const similarity = 1 - distance / Math.max(normalizedTitle.length, normalizedLine.length);
  // v1.16.6：OCR 少识别一个字符（缺字母）是高频场景——允许 1 字符差异的行
  // 以较高相似度入围（0.72 档），避免「缺一个字母就不显示」。
  if (distance === 1 && normalizedTitle.length >= 3) return 0.72 + similarity * 0.1;
  return similarity >= 0.55 ? similarity : null;
}

/**
 * v1.16.8：成绩图 UI 噪音行——规范化后「整行等于」这些词（或纯数字/百分比）的行
 * 不参与匹配。整行判定保证《Break!Break!Break!》等真曲名（breakbreakbreak）不受影响；
 * 曲名豁免在 matchSongTitles 内再做一层（行被任一真实曲名包含时不丢）。
 */
const NOISE_LINE_PATTERNS: RegExp[] = [
  /^(perfect|great|good|miss|bad|break|combo|full\s*combo|fc|fs|fs\+|fdx|fdx\+|ap|app|sync|clear|failed|fail|track\s*over|gameover|game\s*over|new\s*record|rating|dx\s*rating|plate|maimai|maimaidx|dx|est|theoretical|theorie|creation|achieve ment|achievement|score|max|combo\s*count|critical)\+?$/,
  /^\d+(\.\d+)?%?$/,
];

function isNoiseLine(line: string): boolean {
  const compact = line.normalize('NFKC').toLocaleLowerCase().replace(/[\s\u3000]+/g, '');
  if (compact.length === 0) return true;
  return NOISE_LINE_PATTERNS.some(pattern => pattern.test(compact));
}

/**
 * Match OCR text against official titles and the independent alias layer.
 * Artist, charter, cover artwork, and other metadata are deliberately ignored.
 * v1.16.6：默认上限 8 → 12（一张图可能含多首，10 张图批量导入场景）。
 */
export function matchSongTitles(rawData: MusicData[], recognizedText: string, limit = 12): TitleMatch[] {
  const rawLines = recognizedText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length >= 2);
  if (rawLines.length === 0) return [];

  // v1.16.8：先取全部真实标题集合用于「曲名豁免」。
  const allTitles = rawData.flatMap(music => getSearchTitles(music));
  const titleContains = (line: string) => {
    const compactLine = line.normalize('NFKC').toLocaleLowerCase().replace(/[\s\u3000]+/g, '');
    if (compactLine.length < 3) return false;
    return allTitles.some(title => title.replace(/[\s\u3000]+/g, '').toLowerCase().includes(compactLine));
  };

  const lines = rawLines.filter(line => !isNoiseLine(line) || titleContains(line));
  if (lines.length === 0) return [];

  return rawData
    .map(music => {
      let best: TitleMatch | null = null;
      for (const line of lines) {
        for (const title of getSearchTitles(music)) {
          const score = scoreTitle(title, line);
          if (score !== null && (!best || score > best.score)) {
            best = { music, recognizedText: line, score };
          }
        }
      }
      return best;
    })
    .filter((match): match is TitleMatch => match !== null)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

/**
 * v1.16.7：单图匹配——只对一张图的行做匹配，返回该图的全部候选（不截断）。
 * 增量匹配的基础：删除图片 = 删除该图的候选并重新合并，不再全量重扫。
 */
export function matchSongTitlesForImage(rawData: MusicData[], imageText: string): TitleMatch[] {
  return matchSongTitles(rawData, imageText, Number.MAX_SAFE_INTEGER);
}

/**
 * v1.16.7：合并多图候选——按曲去重取最高分，排序后截断。
 * 与全量一次性匹配在数学上等价（原实现同样取每曲全文本最优），输出一致。
 */
export function mergeImageMatches(imageMatches: TitleMatch[][], limit = 12): TitleMatch[] {
  const byMusic = new Map<string, TitleMatch>();
  for (const matches of imageMatches) {
    for (const match of matches) {
      const existing = byMusic.get(match.music.id);
      if (!existing || match.score > existing.score) byMusic.set(match.music.id, match);
    }
  }
  return [...byMusic.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}
