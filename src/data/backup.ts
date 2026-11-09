import type {
  AppSettings,
  BilibiliVideoLink,
  PlanEntry,
  PlanGraveyardEntry,
  PlayerProfile,
  PlayerScore,
  ScoreChange,
  ScoreSnapshot,
  ScoreSyncState,
} from './types';
import { normalizeBilibiliVideoUrl } from './bilibili-links';
import { migratePlanEntryIds, migratePlanGraveyardIds, normalizePlanEntries } from './plan-entries';
import { DEFAULT_SETTINGS, mergeDetailBoards, normalizeSnapshotLimit } from './settings-defaults';
import { RATING_HISTORY_MAX_POINTS, normalizeRatingHistoryPoints, type RatingHistoryPoint } from './rating-history';
import { countCustomAliases, normalizeCustomAliasMap } from './custom-aliases';

/** 备份文件格式标识与当前 schema 版本。 */
export const BACKUP_FORMAT = 'cc.flya.maimate.backup';
export const BACKUP_SCHEMA_VERSION = 1;
export const MAX_BACKUP_FILE_BYTES = 20 * 1024 * 1024;

/** 防内存 DoS 的数组上限；超出即拒绝导入。 */
export const BACKUP_LIMITS = {
  planEntries: 5000,
  graveyard: 10000,
  scores: 20000,
  snapshots: 20,
  changes: 1000,
  bilibiliLinks: 5000,
  /** v1.19.0：Rating 历史点数上限（与本机存储上限一致，约 90KB）；超出时截断保留最新。 */
  ratingHistory: RATING_HISTORY_MAX_POINTS,
} as const;

export interface BackupPlanData {
  entries: PlanEntry[];
  graveyard: PlanGraveyardEntry[];
}

export interface BackupScoresData {
  scores: PlayerScore[];
  profile: PlayerProfile | null;
  sync: ScoreSyncState;
  snapshots: ScoreSnapshot[];
  changes: ScoreChange[];
}

export interface BackupData {
  settings: AppSettings;
  plan: BackupPlanData;
  scores: BackupScoresData;
  bilibiliLinks: BilibiliVideoLink[];
  fortuneSeed: string | null;
  /**
   * v1.19.0 可选：Rating 历史。schemaVersion 不变（仍为 1）——旧版 App 按已知字段重建数据，会忽略它；
   * 旧备份没有该字段时为 undefined，恢复时保留本机历史。字段存在时恢复为整体替换（不按时间戳混拼）。
   */
  ratingHistory?: RatingHistoryPoint[];
  /** v1.19.0 可选：本地自定义别名（songId → 别名）。规则同 ratingHistory。 */
  customAliases?: Record<string, string[]>;
}

export interface MaiMateBackup {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  app: { version: string; platform: string };
  data: BackupData;
  excluded: string[];
}

export interface BackupSummary {
  planEntries: number;
  scores: number;
  snapshots: number;
  bilibiliLinks: number;
  hasFortuneSeed: boolean;
  /** v1.19.0：Rating 历史点数；null = 备份不含该字段（恢复时保留本机记录）。 */
  ratingHistoryPoints?: number | null;
  /** v1.19.0：自定义别名条数；null = 备份不含该字段。 */
  customAliases?: number | null;
  /** v1.19.0：单字段校验失败/截断等非致命问题（不影响其它字段导入）。 */
  warnings?: string[];
}

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** 导出前去掉设备私有路径的封面缓存，恢复后按需重新下载。 */
function sanitizeBilibiliLinkForExport(link: BilibiliVideoLink): BilibiliVideoLink {
  const { coverUri: _coverUri, ...rest } = link;
  return { ...rest, metadataStatus: 'idle' };
}

export function buildBackup(
  data: BackupData,
  appVersion: string,
  platform: string,
  now = new Date(),
): MaiMateBackup {
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    app: { version: appVersion, platform },
    data: {
      settings: normalizeSettings(data.settings),
      plan: {
        entries: normalizePlanEntries(data.plan.entries),
        graveyard: data.plan.graveyard,
      },
      scores: data.scores,
      bilibiliLinks: data.bilibiliLinks.map(sanitizeBilibiliLinkForExport),
      fortuneSeed: typeof data.fortuneSeed === 'string' && data.fortuneSeed ? data.fortuneSeed : null,
      ...(data.ratingHistory !== undefined
        ? { ratingHistory: normalizeRatingHistoryPoints(data.ratingHistory, BACKUP_LIMITS.ratingHistory).points }
        : {}),
      ...(data.customAliases !== undefined ? { customAliases: normalizeCustomAliasMap(data.customAliases) } : {}),
    },
    excluded: ['divingFishToken', 'musicCache', 'chartStatsCache', 'downloadedCovers'],
  };
}

export function serializeBackup(backup: MaiMateBackup): string {
  return JSON.stringify(backup);
}

function normalizeSettings(input: unknown): AppSettings {
  const parsed = isRecord(input) ? input as Partial<AppSettings> : {};
  const sortMode = parsed.defaultSort?.mode;
  const defaultSort = {
    mode: (sortMode === 'titleAsc' || sortMode === 'titleDesc' || sortMode === 'constantAsc' || sortMode === 'constantDesc' || sortMode === 'fitAsc' || sortMode === 'fitDesc' || sortMode === 'scoreDesc' || sortMode === 'relevance')
      ? sortMode
      : DEFAULT_SETTINGS.defaultSort.mode,
    difficultyIndex: finiteNumber(parsed.defaultSort?.difficultyIndex)
      ? Math.max(0, Math.min(4, Math.round(parsed.defaultSort.difficultyIndex as number)))
      : DEFAULT_SETTINGS.defaultSort.difficultyIndex,
  };
  const platform = parsed.defaultMusicPlatform;
  return {
    showChinaVersion: typeof parsed.showChinaVersion === 'boolean' ? parsed.showChinaVersion : DEFAULT_SETTINGS.showChinaVersion,
    defaultSort,
    showProjectedRating: typeof parsed.showProjectedRating === 'boolean' ? parsed.showProjectedRating : DEFAULT_SETTINGS.showProjectedRating,
    defaultMusicPlatform: platform === 'netease' || platform === 'qq' || platform === 'kugou' ? platform : DEFAULT_SETTINGS.defaultMusicPlatform,
    musicAppSearchFirst: typeof parsed.musicAppSearchFirst === 'boolean' ? parsed.musicAppSearchFirst : DEFAULT_SETTINGS.musicAppSearchFirst,
    detailBoards: mergeDetailBoards(parsed),
    snapshotLimit: normalizeSnapshotLimit(parsed.snapshotLimit),
    autoSinkAchieved: typeof parsed.autoSinkAchieved === 'boolean' ? parsed.autoSinkAchieved : DEFAULT_SETTINGS.autoSinkAchieved,
  };
}

function normalizePlanEntry(input: unknown, now: number): PlanEntry | null {
  if (!isRecord(input)) return null;
  if (typeof input.songId !== 'string' || !input.songId) return null;
  const difficultyIndex = input.difficultyIndex;
  if (!finiteNumber(difficultyIndex) || difficultyIndex < 0 || difficultyIndex > 4) return null;
  const musicType = input.musicType;
  if (musicType !== undefined && musicType !== 'SD' && musicType !== 'DX') return null;
  const pin = input.pin;
  if (pin !== undefined && pin !== 'top' && pin !== 'bottom') return null;
  const targetScore = input.targetScore;
  if (targetScore !== undefined && (!finiteNumber(targetScore) || targetScore < 0 || targetScore > 100.5)) return null;
  const entry: PlanEntry = {
    entryId: typeof input.entryId === 'string' && input.entryId ? input.entryId : '',
    songId: input.songId,
    difficultyIndex,
    musicType,
    addedAt: finiteNumber(input.addedAt) ? input.addedAt : now,
    order: finiteNumber(input.order) ? Math.round(input.order) : 0,
  };
  if (typeof input.note === 'string') entry.note = input.note;
  if (targetScore !== undefined) entry.targetScore = targetScore;
  if (pin !== undefined) entry.pin = pin;
  return entry;
}

function normalizePlayerScore(input: unknown): PlayerScore | null {
  if (!isRecord(input)) return null;
  if (typeof input.songId !== 'string' || !input.songId) return null;
  if (input.type !== 'SD' && input.type !== 'DX') return null;
  if (!finiteNumber(input.difficultyIndex) || input.difficultyIndex < 0 || input.difficultyIndex > 4) return null;
  if (!finiteNumber(input.achievement)) return null;
  const score: PlayerScore = {
    songId: input.songId,
    type: input.type,
    difficultyIndex: input.difficultyIndex,
    achievement: input.achievement,
    dxScore: finiteNumber(input.dxScore) ? input.dxScore : 0,
    importedAt: finiteNumber(input.importedAt) ? input.importedAt : 0,
  };
  const title = optionalString(input.title);
  if (title) score.title = title;
  if (finiteNumber(input.ds)) score.ds = input.ds;
  const level = optionalString(input.level);
  if (level) score.level = level;
  const levelLabel = optionalString(input.levelLabel);
  if (levelLabel) score.levelLabel = levelLabel;
  const rate = optionalString(input.rate);
  if (rate) score.rate = rate;
  const fc = optionalString(input.fc);
  if (fc) score.fc = fc;
  const fs = optionalString(input.fs);
  if (fs) score.fs = fs;
  if (finiteNumber(input.serverRating)) score.serverRating = input.serverRating;
  return score;
}

function normalizeBilibiliLink(input: unknown): BilibiliVideoLink | null {
  if (!isRecord(input)) return null;
  if (typeof input.id !== 'string' || !input.id || typeof input.songId !== 'string' || !input.songId) return null;
  if (input.musicType !== 'SD' && input.musicType !== 'DX') return null;
  if (!finiteNumber(input.difficultyIndex) || input.difficultyIndex < 0 || input.difficultyIndex > 4) return null;
  if (typeof input.url !== 'string') return null;
  const url = normalizeBilibiliVideoUrl(input.url);
  if (!url) return null;
  const tags = Array.isArray(input.tags)
    ? input.tags.map(tag => String(tag).trim()).filter(Boolean).slice(0, 50)
    : [];
  const metadataStatus = input.metadataStatus === 'success' || input.metadataStatus === 'partial' || input.metadataStatus === 'error'
    ? input.metadataStatus
    : 'idle';
  return {
    id: input.id,
    songId: input.songId,
    musicType: input.musicType,
    difficultyIndex: input.difficultyIndex,
    url,
    title: optionalString(input.title),
    shareTitle: optionalString(input.shareTitle),
    coverSourceUrl: optionalString(input.coverSourceUrl),
    metadataStatus,
    remark: typeof input.remark === 'string' ? input.remark : '',
    tags,
    createdAt: finiteNumber(input.createdAt) ? input.createdAt : 0,
    updatedAt: finiteNumber(input.updatedAt) ? input.updatedAt : 0,
  };
}

/**
 * v1.19.0：解析可选字段 ratingHistory / customAliases。
 * - 缺失 → 不返回该字段（恢复时保留本机数据）；
 * - 类型错误或全部坏点 → 跳过该字段并记 warning（同样保留本机数据），不抛错；
 * - 超过上限 → 截断（保留最新），记 warning。
 */
export function parseOptionalBackupFields(
  data: Record<string, unknown>,
  warnings: string[],
): Pick<BackupData, 'ratingHistory' | 'customAliases'> {
  const result: Pick<BackupData, 'ratingHistory' | 'customAliases'> = {};
  if (data.ratingHistory !== undefined) {
    try {
      if (!Array.isArray(data.ratingHistory)) throw new Error('not array');
      const parsed = normalizeRatingHistoryPoints(data.ratingHistory, BACKUP_LIMITS.ratingHistory);
      if (data.ratingHistory.length > 0 && parsed.points.length === 0) throw new Error('all invalid');
      result.ratingHistory = parsed.points;
      if (parsed.truncated > 0) warnings.push(`Rating 历史超过 ${BACKUP_LIMITS.ratingHistory} 条上限，已截断保留最新的 ${parsed.points.length} 条`);
      if (parsed.dropped > 0) warnings.push(`Rating 历史有 ${parsed.dropped} 条无效或重复记录已跳过`);
    } catch {
      warnings.push('Rating 历史数据损坏，已跳过（保留本机记录）');
    }
  }
  if (data.customAliases !== undefined) {
    const raw = data.customAliases;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      warnings.push('自定义别名数据损坏，已跳过（保留本机记录）');
    } else {
      result.customAliases = normalizeCustomAliasMap(raw);
    }
  }
  return result;
}

/** v1.19.0：恢复事务用的最小存储接口（AsyncStorage 子集），便于 node 回归脚本注入假存储。 */
export interface BackupStorage {
  multiGet(keys: readonly string[]): Promise<ReadonlyArray<readonly [string, string | null]>>;
  multiSet(pairs: Array<[string, string]>): Promise<void>;
  multiRemove(keys: string[]): Promise<void>;
}

/**
 * v1.19.0：事务式写入——先取回滚快照，写入 pairs 并删除 removeKeys；任一步失败按快照还原
 * （快照里为 null 的键删除），然后重新抛出原错误。
 */
export async function applyRestoreTransaction(
  storage: BackupStorage,
  userKeys: readonly string[],
  pairs: Array<[string, string]>,
  removeKeys: string[],
): Promise<void> {
  const rollback = await storage.multiGet(userKeys);
  try {
    await storage.multiSet(pairs);
    if (removeKeys.length > 0) await storage.multiRemove(removeKeys);
  } catch (error) {
    const restorePairs = rollback.filter(([, value]) => value !== null) as Array<[string, string]>;
    const missing = rollback.filter(([, value]) => value === null).map(([key]) => key);
    try {
      if (restorePairs.length > 0) await storage.multiSet(restorePairs);
      if (missing.length > 0) await storage.multiRemove(missing);
    } catch {
      // 回滚也失败时至少不清空存储。
    }
    throw error instanceof Error ? error : new BackupError('恢复失败');
  }
}

/** v1.19.0：恢复时写入的键名（由 backup-io 传入 CACHE_KEYS 与新增键）。 */
export interface RestoreKeys {
  planData: string;
  planGraveyard: string;
  settings: string;
  scoreData: string;
  scoreSnapshots: string;
  scoreChanges: string;
  bilibiliLinks: string;
  fortuneSeed: string;
  ratingHistory: string;
  customAliases: string;
}

/**
 * 由已校验备份生成要写入的键值对。
 * v1.19.0：ratingHistory / customAliases 字段存在 → 整体替换（不按时间戳混拼）；缺失（旧备份）→ 不写，保留本机数据。
 */
export function buildRestorePairs(backup: MaiMateBackup, keys: RestoreKeys, now = Date.now()): Array<[string, string]> {
  const { plan, scores, settings, bilibiliLinks, fortuneSeed, ratingHistory, customAliases } = backup.data;
  const pairs: Array<[string, string]> = [
    [keys.planData, JSON.stringify({ entries: plan.entries, updatedAt: now })],
    [keys.planGraveyard, JSON.stringify(plan.graveyard)],
    [keys.settings, JSON.stringify(settings)],
    [keys.scoreData, JSON.stringify({ scores: scores.scores, sync: scores.sync, profile: scores.profile })],
    [keys.scoreSnapshots, JSON.stringify(scores.snapshots)],
    [keys.scoreChanges, JSON.stringify(scores.changes)],
    [keys.bilibiliLinks, JSON.stringify(bilibiliLinks)],
  ];
  if (fortuneSeed) pairs.push([keys.fortuneSeed, fortuneSeed]);
  if (ratingHistory) {
    pairs.push([keys.ratingHistory, JSON.stringify({
      points: ratingHistory,
      updatedAt: ratingHistory.length > 0 ? ratingHistory[ratingHistory.length - 1].at : undefined,
    })]);
  }
  if (customAliases) {
    pairs.push([keys.customAliases, JSON.stringify({ bySongId: customAliases, updatedAt: new Date(now).toISOString() })]);
  }
  return pairs;
}

/** 解析并校验备份；任何损坏/未来版本/超限都抛出 BackupError。 */
export function parseAndValidateBackup(text: string, now = Date.now()): { backup: MaiMateBackup; summary: BackupSummary } {
  if (typeof text !== 'string' || !text.trim()) throw new BackupError('备份文件为空');
  if (text.length > MAX_BACKUP_FILE_BYTES) throw new BackupError('备份文件超过 20MB 上限');

  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    throw new BackupError('不是有效的 JSON 文件');
  }
  if (!isRecord(input)) throw new BackupError('备份格式不正确');
  if (input.format !== BACKUP_FORMAT) throw new BackupError('这不是 MaiMate 备份文件');
  const schemaVersion = finiteNumber(input.schemaVersion) ? input.schemaVersion : null;
  if (schemaVersion === null || schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new BackupError(schemaVersion !== null && schemaVersion > BACKUP_SCHEMA_VERSION
      ? '该备份来自更新版本的 MaiMate，请先升级应用'
      : '该备份版本过旧，无法导入');
  }
  if (!isRecord(input.data)) throw new BackupError('备份缺少数据内容');
  const data = input.data as Record<string, unknown>;

  // 设置
  const settings = normalizeSettings(data.settings);

  // 计划（含英灵殿）
  const planRaw = isRecord(data.plan) ? data.plan : {};
  const rawEntries = Array.isArray(planRaw.entries) ? planRaw.entries.slice(0, BACKUP_LIMITS.planEntries) : [];
  const legacyEntries = rawEntries.map(entry => normalizePlanEntry(entry, now)).filter((entry): entry is PlanEntry => entry !== null);
  const migratedEntries = migratePlanEntryIds(legacyEntries, now);
  const entries = normalizePlanEntries(migratedEntries.entries);
  const rawGraveyard = Array.isArray(planRaw.graveyard) ? planRaw.graveyard.slice(0, BACKUP_LIMITS.graveyard) : [];
  const graveyard: PlanGraveyardEntry[] = rawGraveyard
    .filter(isRecord)
    .map(item => ({ entry: normalizePlanEntry(item.entry, now), removedAt: finiteNumber(item.removedAt) ? item.removedAt : now }))
    .filter((item): item is PlanGraveyardEntry => item.entry !== null);
  const migratedGraveyard = migratePlanGraveyardIds(graveyard, now);

  // 成绩
  const scoresRaw = isRecord(data.scores) ? data.scores : {};
  const rawScores = Array.isArray(scoresRaw.scores) ? scoresRaw.scores.slice(0, BACKUP_LIMITS.scores) : [];
  const scores = rawScores.map(normalizePlayerScore).filter((score): score is PlayerScore => score !== null);
  const profileRaw = scoresRaw.profile;
  const profile: PlayerProfile | null = isRecord(profileRaw) ? {
    username: optionalString(profileRaw.username),
    nickname: optionalString(profileRaw.nickname),
    rating: finiteNumber(profileRaw.rating) ? profileRaw.rating : undefined,
    additionalRating: finiteNumber(profileRaw.additionalRating) ? profileRaw.additionalRating : undefined,
    plate: optionalString(profileRaw.plate),
  } : null;
  const syncRaw = isRecord(scoresRaw.sync) ? scoresRaw.sync : {};
  const syncStatus = syncRaw.status;
  const sync: ScoreSyncState = {
    status: syncStatus === 'idle' || syncStatus === 'syncing' || syncStatus === 'success' || syncStatus === 'invalid' || syncStatus === 'error'
      ? syncStatus
      : 'idle',
    lastSyncedAt: finiteNumber(syncRaw.lastSyncedAt) ? syncRaw.lastSyncedAt : null,
    recordCount: finiteNumber(syncRaw.recordCount) ? Math.max(0, Math.round(syncRaw.recordCount)) : scores.length,
    serverRating: finiteNumber(syncRaw.serverRating) ? syncRaw.serverRating : null,
    changedCount: finiteNumber(syncRaw.changedCount) ? Math.max(0, Math.round(syncRaw.changedCount)) : 0,
    message: optionalString(syncRaw.message) || null,
  };
  const rawSnapshots = Array.isArray(scoresRaw.snapshots) ? scoresRaw.snapshots.slice(0, BACKUP_LIMITS.snapshots) : [];
  const snapshots: ScoreSnapshot[] = rawSnapshots.filter(isRecord).map(snap => ({
    id: typeof snap.id === 'string' ? snap.id : `snapshot-${finiteNumber(snap.syncedAt) ? snap.syncedAt : now}`,
    syncedAt: finiteNumber(snap.syncedAt) ? snap.syncedAt : now,
    recordCount: finiteNumber(snap.recordCount) ? Math.round(snap.recordCount) : 0,
    serverRating: finiteNumber(snap.serverRating) ? snap.serverRating : null,
    scores: Array.isArray(snap.scores) ? snap.scores.slice(0, BACKUP_LIMITS.scores).map(normalizePlayerScore).filter((s): s is PlayerScore => s !== null) : [],
  }));
  const rawChanges = Array.isArray(scoresRaw.changes) ? scoresRaw.changes.slice(0, BACKUP_LIMITS.changes) : [];
  const changes: ScoreChange[] = rawChanges.filter(isRecord).map(change => ({
    chartKey: typeof change.chartKey === 'string' ? change.chartKey : '',
    previous: change.previous == null ? null : normalizePlayerScore(change.previous),
    current: change.current == null ? null : normalizePlayerScore(change.current),
    changedAt: finiteNumber(change.changedAt) ? change.changedAt : now,
  })).filter(change => change.chartKey);

  // B 站链接（保留封面源 URL，丢弃本机 coverUri）
  const rawLinks = Array.isArray(data.bilibiliLinks) ? data.bilibiliLinks.slice(0, BACKUP_LIMITS.bilibiliLinks) : [];
  const bilibiliLinks = rawLinks.map(normalizeBilibiliLink).filter((link): link is BilibiliVideoLink => link !== null);

  // 运势种子
  const fortuneSeed = typeof data.fortuneSeed === 'string' && data.fortuneSeed ? data.fortuneSeed : null;

  // v1.19.0：可选字段。单字段校验失败只跳过该字段（恢复时保留本机数据），不影响其它字段导入。
  const warnings: string[] = [];
  const optional = parseOptionalBackupFields(data, warnings);

  const backup: MaiMateBackup = {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: typeof input.exportedAt === 'string' ? input.exportedAt : new Date(now).toISOString(),
    app: isRecord(input.app) ? {
      version: typeof input.app.version === 'string' ? input.app.version : 'unknown',
      platform: typeof input.app.platform === 'string' ? input.app.platform : 'unknown',
    } : { version: 'unknown', platform: 'unknown' },
    data: {
      settings,
      plan: { entries, graveyard: migratedGraveyard.graveyard },
      scores: { scores, profile, sync, snapshots, changes },
      bilibiliLinks,
      fortuneSeed,
      ...optional,
    },
    excluded: Array.isArray(input.excluded) ? input.excluded.filter((item): item is string => typeof item === 'string') : [],
  };

  const summary: BackupSummary = {
    planEntries: entries.length,
    scores: scores.length,
    snapshots: snapshots.length,
    bilibiliLinks: bilibiliLinks.length,
    hasFortuneSeed: Boolean(fortuneSeed),
    ratingHistoryPoints: optional.ratingHistory ? optional.ratingHistory.length : null,
    customAliases: optional.customAliases ? countCustomAliases(optional.customAliases) : null,
    warnings,
  };

  return { backup, summary };
}

export { normalizeSettings as normalizeSettingsForBackup };
