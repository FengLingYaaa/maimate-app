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
    mode: (sortMode === 'titleAsc' || sortMode === 'titleDesc' || sortMode === 'constantAsc' || sortMode === 'constantDesc' || sortMode === 'relevance')
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
    },
    excluded: Array.isArray(input.excluded) ? input.excluded.filter((item): item is string => typeof item === 'string') : [],
  };

  const summary: BackupSummary = {
    planEntries: entries.length,
    scores: scores.length,
    snapshots: snapshots.length,
    bilibiliLinks: bilibiliLinks.length,
    hasFortuneSeed: Boolean(fortuneSeed),
  };

  return { backup, summary };
}

export { normalizeSettings as normalizeSettingsForBackup };
