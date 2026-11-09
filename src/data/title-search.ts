import { normalizeSearchText } from './music-list';
import { getAliasVersion, getSongAliases } from './song-aliases';
import type { MusicData } from './types';

/** v1.18.0：OCR 命中的字段来源。 */
export type OcrFieldKind = 'title' | 'alias' | 'artist' | 'charter';

export interface TitleMatch {
  music: MusicData;
  recognizedText: string;
  score: number;
  /** v1.18.0：命中来源与命中的原文（别名命中时用于在候选里标注）。 */
  matchedKind?: OcrFieldKind;
  matchedText?: string;
}

/** v1.18.0：识别结果默认返回前 5 名候选。 */
export const OCR_CANDIDATE_LIMIT = 5;

/** v1.18.0：OCR 比较时去掉的装饰符号（成绩图上常被漏识别或识别成别的字）。 */
const DECORATIVE_SYMBOLS = /[★☆♪♫♬♡♥◆◇■□●○▲△▼▽†‡∞♂♀※＊*･・。、「」『』〈〉]/g;

function compact(value: string): string {
  const base = normalizeSearchText(value).replace(/\s/g, '');
  const stripped = base.replace(DECORATIVE_SYMBOLS, '');
  // 《I ♥》《+♂》这类符号本身就是曲名主体的短标题：去符号后不足 2 字符时保留符号。
  return stripped.length >= 2 ? stripped : base;
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
  const slack = Math.max(2, Math.floor(title.length * 0.2));
  const minSize = Math.max(2, title.length - slack);
  const maxSize = Math.min(line.length, title.length + slack);
  if (minSize > maxSize) return null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let size = minSize; size <= maxSize; size += 1) {
    for (let start = 0; start + size <= line.length; start += 1) {
      const distance = levenshtein(title, line.slice(start, start + size));
      if (distance < bestDistance) bestDistance = distance;
    }
  }
  // v1.18.0：长曲名容错按比例放宽（≥10 字符允许约 20% 错字），短曲名仍最多 2。
  const maxDistance = Math.max(2, Math.floor(title.length * 0.2));
  if (!Number.isFinite(bestDistance) || bestDistance > maxDistance) return null;
  // 短标题的容错窗收紧：距离 2 只允许较长标题（≥6 字符），距离 1 只允许 ≥4 字符，
  // 避免《39》这类超短名被任意 2 字符窗口在距离 ≤2 内「全部命中」（0.70 噪音霸榜）。
  if (bestDistance === 2 && title.length < 6) return null;
  if (bestDistance === 1 && title.length < 4) return null;
  // v1.18.0：按「相似度 × 覆盖率」打分（与包含命中同理）：同一行里，模糊命中整行的长标题
  // 高于只模糊命中其中一段的短标题（修复长标题有 3 个错字时被《Future》这类短标题抢第一）。
  const similarity = 1 - bestDistance / title.length;
  const lineCoverage = coverage(title.length, stripScoreNoise(line).length);
  return 0.55 + 0.35 * similarity * (0.5 + 0.5 * lineCoverage);
}

/**
 * 曲名（或别名/曲师/谱师）与一行识别文字的匹配分。
 * v1.18.0：入参为已 compact 的文本（调用方预先归一，避免全库扫描时重复归一）；
 * fuzzy=false 时只做相等/包含，不做滑窗与整行编辑距离。
 */
function scoreTitle(normalizedTitle: string, normalizedLine: string, fuzzy = true): number | null {
  if (normalizedTitle.length < 2 || normalizedLine.length < 2) return null;

  if (normalizedLine === normalizedTitle) return 1;
  // v1.18.0：行包含完整曲名 → 按覆盖率打分（曲名长度 ÷ 去掉成绩/难度噪音后的行长度）：
  // 曲名占满整行 ≈0.96，短曲名只占行的一小部分 ≈0.5。修复《Catch The Future》被
  // 《Future》以固定 0.96 抢走、《天国と地獄 -言ノ葉リンネ-》被《天国と地獄》抢走等「显示错歌」。
  if (normalizedLine.includes(normalizedTitle)) {
    return 0.5 + 0.46 * coverage(normalizedTitle.length, stripScoreNoise(normalizedLine).length);
  }
  // 行是曲名的一部分（标题被截断/折行）：同样按覆盖率打折，片段越短分越低。
  if (normalizedTitle.includes(normalizedLine) && normalizedLine.length >= 3) {
    return 0.5 + 0.4 * coverage(normalizedLine.length, normalizedTitle.length);
  }

  // v1.18.0：别名/曲师/谱师只做相等与包含，不做模糊（社区别名噪音大，且模糊匹配成本高）。
  if (!fuzzy) return null;

  // v1.16.9：粘连行滑动窗口（在整行 levenshtein 之前，因为整行距离会被行尾噪音拖大）。
  const windowScore = slidingWindowScore(normalizedTitle, normalizedLine);
  if (windowScore !== null) return windowScore;

  const distance = levenshtein(normalizedTitle, normalizedLine);
  const similarity = 1 - distance / Math.max(normalizedTitle.length, normalizedLine.length);
  // v1.16.6：OCR 少识别一个字符（缺字母）是高频场景——允许 1 字符差异的行
  // 以较高相似度入围（0.72 档），避免「缺一个字母就不显示」。
  if (distance === 1 && normalizedTitle.length >= 3) return 0.72 + similarity * 0.1;
  // v1.18.0：整行 Levenshtein 相似度门槛 0.55 → 0.7（减少不相干的长行凑数）。
  return similarity >= 0.7 ? similarity : null;
}

/** 覆盖率：part / whole，夹在 0–1。 */
function coverage(part: number, whole: number): number {
  if (whole <= 0) return 1;
  return Math.max(0, Math.min(1, part / whole));
}

/** 计算覆盖率时去掉成绩图里常和曲名粘在同一行的数字、百分号和难度词。 */
function stripScoreNoise(compactLine: string): string {
  const stripped = compactLine
    .replace(/re:?master|remaster|master|expert|advanced|basic|utage|lv\.?/g, '')
    .replace(/[0-9.%+]/g, '');
  return stripped.length > 0 ? stripped : compactLine;
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

interface OcrField {
  kind: OcrFieldKind;
  raw: string;
  /** compact 后的比较键（预先计算，全库扫描时不再重复归一）。 */
  key: string;
}

/**
 * v1.18.0：OCR 匹配字段 = 标题 + 别名 + 曲师 + 谱师（均经 normalizeSearchText 统一全角半角、
 * 大小写与平/片假名）。别名至少 3 个字符才参与（过短的社区别名在成绩图里误撞太多）。
 */
const ocrFieldCache = new WeakMap<MusicData, { version: number; fields: OcrField[] }>();

export function getOcrMatchFields(music: MusicData): OcrField[] {
  const version = getAliasVersion();
  const cached = ocrFieldCache.get(music);
  if (cached && cached.version === version) return cached.fields;
  const fields: OcrField[] = [];
  const seen = new Set<string>();
  const push = (kind: OcrFieldKind, raw: string | undefined, minLength: number) => {
    if (!raw) return;
    const key = compact(raw);
    if (key.length < minLength || seen.has(key)) return;
    seen.add(key);
    fields.push({ kind, raw, key });
  };
  push('title', music.title, 1);
  push('title', music.basic_info.title, 1);
  for (const alias of getSongAliases(music)) push('alias', alias, 3);
  push('artist', music.basic_info.artist, 3);
  for (const chart of music.charts) {
    if (chart.charter && chart.charter !== '-') push('charter', chart.charter, 3);
  }
  ocrFieldCache.set(music, { version, fields });
  return fields;
}

/** 字段权重：标题原分；别名略低；曲师/谱师单独命中只作参考（避免同曲师的整批歌霸榜）。 */
const FIELD_WEIGHT: Record<OcrFieldKind, number> = { title: 1, alias: 0.95, artist: 0.5, charter: 0.4 };
/** 标题/别名命中且同图里也出现了曲师时的小幅加分（用于区分同名或相近标题）。 */
const ARTIST_CONFIRM_BONUS = 0.03;

/**
 * Match OCR text against titles, aliases, artists and charters.
 * v1.16.6：默认上限 8 → 12（一张图可能含多首，10 张图批量导入场景）。
 * v1.18.0：默认返回前 5 名候选；相邻两行拼接后也参与匹配（长曲名折行）。
 */
export function matchSongTitles(rawData: MusicData[], recognizedText: string, limit = OCR_CANDIDATE_LIMIT): TitleMatch[] {
  const rawLines = recognizedText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length >= 1);
  if (rawLines.length === 0) return [];

  // v1.16.8：先取全部真实标题集合用于「曲名豁免」。v1.18.0：两侧统一用 compact 归一。
  const allTitleKeys = new Set<string>();
  for (const music of rawData) {
    for (const field of getOcrMatchFields(music)) {
      // 噪音豁免只认官方标题：别名里有「perfect」之类的词，不能让成绩图 UI 文字借别名混进来。
      if (field.kind === 'title') allTitleKeys.add(field.key);
    }
  }
  const titleKeyList = [...allTitleKeys];
  // v1.16.9：行与任一真实曲名【完全相等】直接豁免（不再要求行长 ≥3）。
  const titleEquals = (line: string) => {
    const key = compact(line);
    return key.length > 0 && allTitleKeys.has(key);
  };
  const titleContains = (line: string) => {
    const key = compact(line);
    if (key.length < 3) return false;
    return titleKeyList.some(title => title.includes(key));
  };

  const kept = rawLines.filter(line => !isNoiseLine(line) || titleEquals(line) || titleContains(line));
  if (kept.length === 0) return [];
  // v1.18.0：相邻两行拼接（长曲名在成绩图上常被折成两行）。
  const rawCandidates = [...kept];
  for (let index = 0; index + 1 < kept.length; index += 1) rawCandidates.push(`${kept[index]}${kept[index + 1]}`);
  const lines = rawCandidates
    .map(raw => ({ raw, key: compact(raw) }))
    .filter((line, index, all) => line.key.length >= 2 && all.findIndex(other => other.key === line.key) === index);
  const compactImage = compact(kept.join(''));

  return rawData
    .map(music => {
      let best: TitleMatch | null = null;
      const fields = getOcrMatchFields(music);
      for (const field of fields) {
        const fuzzy = field.kind === 'title';
        const weight = FIELD_WEIGHT[field.kind];
        for (const line of lines) {
          const rawScore = scoreTitle(field.key, line.key, fuzzy);
          if (rawScore === null) continue;
          const score = rawScore * weight;
          if (!best || score > best.score) {
            best = { music, recognizedText: line.raw, score, matchedKind: field.kind, matchedText: field.raw };
          }
        }
      }
      if (best && (best.matchedKind === 'title' || best.matchedKind === 'alias') && best.score >= 0.6) {
        const artist = fields.find(field => field.kind === 'artist');
        if (artist && compactImage.includes(artist.key)) {
          best = { ...best, score: Math.min(1, best.score + ARTIST_CONFIRM_BONUS) };
        }
      }
      return best;
    })
    .filter((match): match is TitleMatch => match !== null)
    .sort((left, right) => right.score - left.score || right.music.title.length - left.music.title.length)
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
export function mergeImageMatches(imageMatches: TitleMatch[][], limit = OCR_CANDIDATE_LIMIT): TitleMatch[] {
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

/* ------------------------------------------------------------------ */
/* v1.19.0：多图逐图取前 5 → 合并去重；置信度；「为什么是这首」说明。      */
/* ------------------------------------------------------------------ */

/** 每张图保留的候选数。 */
export const OCR_PER_IMAGE_LIMIT = 5;
/** 高置信度：第 1 名 ≥ 0.85 且领先第 2 名 ≥ 0.08（只有 1 个候选时只看分数）。 */
export const OCR_HIGH_CONFIDENCE_SCORE = 0.85;
export const OCR_HIGH_CONFIDENCE_GAP = 0.08;

export type MatchConfidence = 'high' | 'low' | 'none';

/** 单张图的前 N 名（matches 已按分数降序，来自 matchSongTitlesForImage）。 */
export function topMatchesForImage(matches: TitleMatch[], limit = OCR_PER_IMAGE_LIMIT): TitleMatch[] {
  return [...matches].sort((left, right) => right.score - left.score).slice(0, limit);
}

export function classifyMatchConfidence(matches: TitleMatch[]): MatchConfidence {
  if (matches.length === 0) return 'none';
  const [first, second] = topMatchesForImage(matches, 2);
  if (first.score < OCR_HIGH_CONFIDENCE_SCORE) return 'low';
  if (second && first.score - second.score < OCR_HIGH_CONFIDENCE_GAP) return 'low';
  return 'high';
}

export interface MergedImageMatch extends TitleMatch {
  /** 该曲出现在哪些图里（imageKeys 中的下标，升序）。 */
  imageIndexes: number[];
}

/**
 * 多图合并：**先每张图各自取前 5，再合并去重**（同一首歌取最高分，并记录出现在哪些图）。
 * 修复 v1.18 先把所有图的候选放一起取全局前 5，一张图的第 1 名挤掉另一张图第 1 名的问题。
 * 不再做全局截断：10 张图最多 50 个候选，每张图的第 1 名一定在结果里。
 */
export function mergePerImageTopMatches(perImage: TitleMatch[][], limit = OCR_PER_IMAGE_LIMIT): MergedImageMatch[] {
  const byMusic = new Map<string, MergedImageMatch>();
  perImage.forEach((matches, imageIndex) => {
    for (const match of topMatchesForImage(matches, limit)) {
      const key = `${match.music.type}:${match.music.id}`;
      const existing = byMusic.get(key);
      if (!existing) {
        byMusic.set(key, { ...match, imageIndexes: [imageIndex] });
        continue;
      }
      if (!existing.imageIndexes.includes(imageIndex)) existing.imageIndexes.push(imageIndex);
      if (match.score > existing.score) byMusic.set(key, { ...match, imageIndexes: existing.imageIndexes });
    }
  });
  return [...byMusic.values()].sort((left, right) => right.score - left.score);
}

/** 是否经别名命中（UI 标注用）。 */
export function hasMatchedAlias(match: Pick<TitleMatch, 'matchedKind'>): boolean {
  return match.matchedKind === 'alias';
}

/** 「为什么是这首」：命中字段 + 识别到的那行文字 + 匹配度。 */
export function describeMatchReason(match: TitleMatch): string {
  const percent = Math.round(match.score * 100);
  const source = match.recognizedText.length > 24 ? `${match.recognizedText.slice(0, 24)}…` : match.recognizedText;
  const field = match.matchedKind === 'alias'
    ? `别名「${match.matchedText ?? ''}」`
    : match.matchedKind === 'artist'
      ? `曲师「${match.matchedText ?? match.music.basic_info.artist}」`
      : match.matchedKind === 'charter'
        ? `谱师「${match.matchedText ?? ''}」`
        : '曲名';
  return `识别文字「${source}」与${field}相似 ${percent}%`;
}
