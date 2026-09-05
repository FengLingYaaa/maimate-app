import type { MusicData, PlanEntry, PlanGraveyardEntry, PlayerScore } from './types';
import { applyDragWithPinGroups, compareByPinThenOrder } from './plan-order';

let idSequence = 0;

/** 为新计划记录生成持久身份；业务谱面键不再承担 React/拖拽身份。 */
export function createPlanEntryId(now = Date.now()): string {
  idSequence = (idSequence + 1) % 0x100000;
  const random = Math.floor(Math.random() * 0x100000000).toString(36);
  return `plan-${now.toString(36)}-${idSequence.toString(36)}-${random}`;
}

function hasUsableEntryId(entry: Partial<PlanEntry>): entry is Partial<PlanEntry> & { entryId: string } {
  return typeof entry.entryId === 'string' && entry.entryId.trim().length >= 6;
}

function uniqueEntryId(entry: Partial<PlanEntry>, used: Set<string>, now: number): string {
  let candidate = hasUsableEntryId(entry) ? entry.entryId.trim() : createPlanEntryId(now);
  while (used.has(candidate)) candidate = createPlanEntryId(now);
  used.add(candidate);
  return candidate;
}

/**
 * 兼容 v1.9 及更早计划数据：为缺失/重复的身份补发永久 entryId。
 * 返回 migrated 供调用方在首次加载后立即回写，保证下次启动身份不变。
 */
export function migratePlanEntryIds(entries: PlanEntry[], now = Date.now()): { entries: PlanEntry[]; migrated: boolean } {
  const used = new Set<string>();
  let migrated = false;
  const migratedEntries = entries.map((entry, index) => {
    const entryId = uniqueEntryId(entry, used, now + index);
    if (entryId !== entry.entryId) migrated = true;
    return { ...entry, entryId };
  });
  return { entries: migratedEntries, migrated };
}

/** 英灵殿中的历史条目也需要稳定身份，避免恢复后重新碰撞。 */
export function migratePlanGraveyardIds(graveyard: PlanGraveyardEntry[], now = Date.now()): { graveyard: PlanGraveyardEntry[]; migrated: boolean } {
  const used = new Set<string>();
  let migrated = false;
  const migratedGraveyard = graveyard.map((item, index) => {
    const entryId = uniqueEntryId(item.entry, used, now + index);
    if (entryId !== item.entry.entryId) migrated = true;
    return { ...item, entry: { ...item.entry, entryId } };
  });
  return { graveyard: migratedGraveyard, migrated };
}

/** 展示/持久化统一顺序：置顶 → 普通 → 置底；order 永远等于数组下标。 */
export function normalizePlanEntries(entries: PlanEntry[]): PlanEntry[] {
  return [...entries]
    .sort(compareByPinThenOrder)
    .map((entry, order) => ({ ...entry, order }));
}

/** 曲库记录类型（SD=旧世代 / DX=でらっくす 世代）；同一 songId 可能最多有 SD、DX 两条记录。 */
type MusicType = MusicData['type'];

/** 同 songId 的曲库记录列表；保持曲库原始顺序（列表头部即「第一记录」）。 */
type MusicIdIndex = Map<string, MusicData[]>;

/** (songId, difficultyIndex) → 已导入成绩里实际出现过的类型集合。 */
type ScoreTypesIndex = Map<string, Set<MusicType>>;

/** 成绩查找键：一张真实谱面对应唯一 key；type 就是谱面自己的类型。 */
function chartKeyOf(songId: string, type: MusicType, difficultyIndex: number): string {
  return `${songId}:${type}:${difficultyIndex}`;
}

/** 该 (songId, 难度) 谱面上实际有成绩的类型集合的查找键。 */
function scoreTypesKeyOf(songId: string, difficultyIndex: number): string {
  return `${songId}:${difficultyIndex}`;
}

/** 曲库与成绩数组在 store 中均按不可变方式更新（整数组替换），WeakMap 按数组身份缓存，索引只需各建一次。 */
const musicIdIndexCache = new WeakMap<MusicData[], MusicIdIndex>();
const scoreTypesIndexCache = new WeakMap<PlayerScore[], ScoreTypesIndex>();
/** 常量空索引：resolvePlanMusic 省略 scores 时每次调用都会产生新 []，走它避免无谓的缓存 churn。 */
const EMPTY_SCORE_TYPES: ScoreTypesIndex = new Map();
/** 常量空类型集合：该 (songId, 难度) 完全没有成绩时的短路结果。 */
const NO_SCORED_TYPES: ReadonlySet<MusicType> = new Set();

function getMusicIdIndex(rawData: MusicData[]): MusicIdIndex {
  let index = musicIdIndexCache.get(rawData);
  if (!index) {
    index = new Map<string, MusicData[]>();
    for (const music of rawData) {
      const list = index.get(music.id);
      if (list) list.push(music);
      else index.set(music.id, [music]);
    }
    musicIdIndexCache.set(rawData, index);
  }
  return index;
}

function getScoreTypesIndex(scores: PlayerScore[]): ScoreTypesIndex {
  let index = scoreTypesIndexCache.get(scores);
  if (!index) {
    index = new Map<string, Set<MusicType>>();
    for (const score of scores) {
      const key = scoreTypesKeyOf(score.songId, score.difficultyIndex);
      const types = index.get(key);
      if (types) types.add(score.type);
      else index.set(key, new Set<MusicType>([score.type]));
    }
    scoreTypesIndexCache.set(scores, index);
  }
  return index;
}

/** 历史数据里可能出现非 SD/DX 的 musicType 字符串；按「无显式类型」处理，避免类型比较永远失配。 */
function explicitMusicTypeOf(entry: PlanEntry): 'SD' | 'DX' | undefined {
  return entry.musicType === 'SD' || entry.musicType === 'DX' ? entry.musicType : undefined;
}

/**
 * v1.17.1：计划条目 → 真实曲库记录的统一解析口径（random 抽歌页 / plan 计划页 / 达标判定共用同一实现）：
 * 1. 显式 musicType 且该类型在对应难度有成绩 → 选择显式类型记录；
 * 2. 显式类型没有对应难度成绩 → 选择同 ID 另一类型有对应难度成绩的记录（显式 musicType 写错/记录缺失的兜底）；
 * 3. musicType 缺失同理 —— 同样优先选择在对应难度有成绩的记录；
 * 4. 同 ID 没有任何对应难度成绩 → 保留显式类型记录（曲库中没有则取第一记录），仅用于显示。
 */
function resolveMusicWithIndex(
  entry: PlanEntry,
  musicById: MusicIdIndex,
  scoreTypesIndex: ScoreTypesIndex,
): MusicData | undefined {
  const candidates = musicById.get(entry.songId);
  if (!candidates || candidates.length === 0) return undefined;
  const explicitType = explicitMusicTypeOf(entry);
  const scoredTypes = scoreTypesIndex.get(scoreTypesKeyOf(entry.songId, entry.difficultyIndex)) ?? NO_SCORED_TYPES;
  if (explicitType) {
    if (scoredTypes.has(explicitType)) {
      return candidates.find(music => music.type === explicitType) ?? candidates[0];
    }
    const otherScored = candidates.find(music => music.type !== explicitType && scoredTypes.has(music.type));
    if (otherScored) return otherScored;
    return candidates.find(music => music.type === explicitType) ?? candidates[0];
  }
  return candidates.find(music => scoredTypes.has(music.type)) ?? candidates[0];
}

/**
 * v1.17.1：解析计划条目对应的真实曲库记录。
 * v1.17.1：同 ID 同时存在 SD/DX 时，解析结果跟随「对应难度的成绩在哪个类型上」：
 * 显式类型有该难度成绩则保持显式类型，否则回退另一类型有成绩的记录；
 * 完全无成绩时保留显式类型/第一记录用于显示。曲库/成绩索引按数组身份缓存，避免逐条全库扫描。
 */
export function resolvePlanMusic(
  entry: PlanEntry,
  rawData: MusicData[],
  scores: PlayerScore[] = [],
): MusicData | undefined {
  return resolveMusicWithIndex(
    entry,
    getMusicIdIndex(rawData),
    scores.length === 0 ? EMPTY_SCORE_TYPES : getScoreTypesIndex(scores),
  );
}

/**
 * v1.17.1：判定计划条目是否已达标（当前成绩达成率 ≥ 目标），返回已达到目标条目的 entryId 集合。
 * v1.17.1：多页面（计划页、随机抽歌页）共用 resolveMusicWithIndex 的同一解析结果；
 * 目标成绩只与解析出的真实谱面对应的成绩比较，不把同 ID 另一类型的成绩误算进来。
 */
export function computeAchievedIds(
  planEntries: PlanEntry[],
  scores: PlayerScore[],
  rawData: MusicData[],
): Set<string> {
  const musicById = getMusicIdIndex(rawData);
  // 先解析真实谱面（含按成绩纠偏），再只比较解析后谱面的成绩。
  const scoreTypesIndex = getScoreTypesIndex(scores);

  // 成绩按 (songId,type,difficultyIndex) 建立索引，避免逐条线性查找。
  const scoreByKey = new Map<string, PlayerScore>();
  for (const score of scores) {
    scoreByKey.set(chartKeyOf(score.songId, score.type, score.difficultyIndex), score);
  }

  const achieved = new Set<string>();
  for (const entry of planEntries) {
    if (entry.targetScore === undefined) continue;
    const music = resolveMusicWithIndex(entry, musicById, scoreTypesIndex);
    if (!music) continue;
    const score = scoreByKey.get(chartKeyOf(music.id, music.type, entry.difficultyIndex));
    if (score && Number.isFinite(score.achievement) && score.achievement >= entry.targetScore!) {
      achieved.add(entry.entryId);
    }
  }
  return achieved;
}

/**
 * 使用一次拖拽返回的 entryId 全量顺序原子重排。
 * ID 必须与当前计划一一对应；任何缺失、重复或陈旧结果都直接拒绝。
 */
export function reorderPlanEntriesById(current: PlanEntry[], orderedIds: string[]): PlanEntry[] | null {
  if (orderedIds.length !== current.length || new Set(orderedIds).size !== orderedIds.length) return null;
  const byId = new Map(current.map(entry => [entry.entryId, entry]));
  if (byId.size !== current.length || orderedIds.some(id => !byId.has(id))) return null;
  const dragged = orderedIds.map(id => byId.get(id)!);
  return applyDragWithPinGroups(dragged).map((entry, order) => ({ ...entry, order }));
}
