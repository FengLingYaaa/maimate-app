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

/**
 * v1.16.9：粘连行滑动窗口匹配——OCR 常把标题和成绩/难度识别到同一行（无换行），
 * 整行 levenshtein 距离会被拖大导致「一字不匹配」。这里在行内找与标题最接近的
 * 窗口（长度 title±2），距离 ≤2 时给出 0.7~0.9 的强匹配档。
 * 修复《VeRForTe αRtE:VEiN→aRtE》《Destr0yer→DestrOyer》等场景。
 */
function slidingWindowScore(title: string, line: string): number | null {
  const minSize = Math.max(2, title.length - 2);
  const maxSize = Math.min(line.length, title.length + 2);
  if (minSize > maxSize) return null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let size = minSize; size <= maxSize; size += 1) {
    for (let start = 0; start + size <= line.length; start += 1) {
      const distance = levenshtein(title, line.slice(start, start + size));
      if (distance < bestDistance) bestDistance = distance;
    }
  }
  if (!Number.isFinite(bestDistance) || bestDistance > 2) return null;
  // 短标题的容错窗收紧：距离 2 只允许较长标题（≥6 字符），距离 1 只允许 ≥4 字符，
  // 避免《39》这类超短名被任意 2 字符窗口在距离 ≤2 内「全部命中」（0.70 噪音霸榜）。
  if (bestDistance === 2 && title.length < 6) return null;
  if (bestDistance === 1 && title.length < 4) return null;
  // 距离 0（窗口恰等于标题）理论已在 includes 命中，兜底给最高档；
  // 距离 1 = 0.78+，距离 2 = 0.70+（低于整行精确/包含，高于 0.55 兜底）。
  if (bestDistance === 0) return 0.9;
  if (bestDistance === 1) return 0.78 + Math.max(0, 1 - 1 / title.length) * 0.08;
  return 0.7 + Math.max(0, 1 - 2 / title.length) * 0.06;
}

function scoreTitle(title: string, recognizedLine: string): number | null {
  const normalizedTitle = compact(title);
  const normalizedLine = compact(recognizedLine);
  if (normalizedTitle.length < 2 || normalizedLine.length < 2) return null;

  if (normalizedLine === normalizedTitle) return 1;
  // v1.16.9：行包含完整曲名 → 0.96；短曲名（<4 字符）子串命中降档，
  // 避免《39》这类纯数字短名被任意含数字的行以 0.96 冒名顶替（旧粘连行 0.96 bug）。
  if (normalizedLine.includes(normalizedTitle)) {
    return normalizedTitle.length >= 4 ? 0.96 : 0.6;
  }
  if (normalizedTitle.includes(normalizedLine) && normalizedLine.length >= 3) {
    return 0.78 + Math.min(normalizedLine.length / normalizedTitle.length, 1) * 0.12;
  }

  // v1.16.9：粘连行滑动窗口（在整行 levenshtein 之前，因为整行距离会被行尾噪音拖大）。
  const windowScore = slidingWindowScore(normalizedTitle, normalizedLine);
  if (windowScore !== null) return windowScore;

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
  // v1.16.9：行与任一真实曲名【完全相等】直接豁免（不再要求行长 ≥3）——
  // 修复《39》等纯数字/超短曲名被噪音过滤误杀（识别完全正确却不显示）。
  const titleEquals = (line: string) => {
    const compactLine = line.normalize('NFKC').toLocaleLowerCase().replace(/[\s\u3000]+/g, '');
    if (compactLine.length === 0) return false;
    return allTitles.some(title => title.replace(/[\s\u3000]+/g, '').toLowerCase() === compactLine);
  };
  const titleContains = (line: string) => {
    const compactLine = line.normalize('NFKC').toLocaleLowerCase().replace(/[\s\u3000]+/g, '');
    if (compactLine.length < 3) return false;
    return allTitles.some(title => title.replace(/[\s\u3000]+/g, '').toLowerCase().includes(compactLine));
  };

  const lines = rawLines.filter(line => !isNoiseLine(line) || titleEquals(line) || titleContains(line));
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
