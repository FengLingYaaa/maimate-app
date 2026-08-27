/**
 * MaimaiDX 数据类型定义
 * 对应 Diving-Fish Prober API 的 /api/maimaidxprober/music_data 响应
 */

/** Diving-Fish 的单谱面统计数据 */
export interface ChartStats {
  cnt: number;
  diff: string;
  fit_diff: number;
  avg: number;
  avg_dx: number;
  std_dev: number;
  dist: number[];
  fc_dist: number[];
}

/** 谱面数据 */
export interface ChartData {
  notes: number[];       // [TAP, HOLD, SLIDE, TOUCH?, BREAK] — SD 无 TOUCH
  charter: string;       // 谱师名
  stats?: ChartStats;    // /chart_stats 可选统计数据
}

/** 歌曲基本信息 */
export interface BasicInfo {
  title: string;
  artist: string;
  genre: string;
  bpm: number;
  release_date: string;
  from: string;          // 出处版本
  is_new: boolean;
}

/** 歌曲完整数据 (Prober API 返回格式) */
export interface MusicData {
  id: string;            // 歌曲ID
  title: string;         // 歌曲标题
  type: 'SD' | 'DX';     // 数据记录类型；SD/DX 可能是两条同名记录
  ds: number[];          // 各难度官方定数
  level: string[];       // 各难度等级标签
  cids: number[];        // Chart 内部 ID
  charts: ChartData[];   // 各难度谱面详情
  basic_info: BasicInfo;
}

/** Diving-Fish /chart_stats 的按歌曲 ID 索引结果 */
export type ChartStatsMap = Record<string, Array<ChartStats | null>>;

/** 曲库排序模式。定数排序时使用 difficultyIndex 指定目标难度。 */
export type SortMode = 'relevance' | 'titleAsc' | 'titleDesc' | 'constantAsc' | 'constantDesc';

export interface SortOptions {
  mode: SortMode;
  difficultyIndex?: number;
}

/** 版本筛选项：rawValue 用于真实筛选，label 用于 UI 展示。 */
export type VersionRegion = 'japan' | 'china';

export interface VersionOption {
  rawValue: string;
  chinaName: string;
  label: string;
  count: number;
  region?: VersionRegion;
  rawValues?: string[];
}

/** 独立别名层的条目；不修改 Diving-Fish 原始标题。 */
export interface SongAliasEntry {
  songId: string;
  musicType?: 'SD' | 'DX';
  aliases: string[];
  source: 'curated' | 'user';
}

/** 筛选条件 */
export interface FilterOptions {
  genre?: string | string[];
  difficulty?: number | number[];    // 难度索引 0-4
  level?: string | string[];         // 等级标签如 "12+"
  dsRange?: [number, number];        // 官方定数范围
  version?: string | string[];       // 日服/原始版本名
  chinaVersion?: string | string[];  // 中国区聚合版本名
  type?: 'SD' | 'DX' | ('SD' | 'DX')[];
  artist?: string;                   // 曲师关键词
  charter?: string;                  // 谱师关键词
  bpmRange?: [number, number];       // BPM 范围
  titleSearch?: string;              // 标题/曲师/谱师模糊搜索
  sort?: SortOptions;
}

/** 推分计划条目 */
export interface PlanEntry {
  /** 持久且唯一的记录身份；React key、拖拽和恢复都只使用它。 */
  entryId: string;
  songId: string;
  difficultyIndex: number;  // 目标练习的难度
  /** 兼容旧计划；新条目保存 SD/DX，避免同 ID 曲目混淆。 */
  musicType?: 'SD' | 'DX';
  addedAt: number;          // 添加时间戳
  order: number;            // 排序权重
  note?: string;            // 用户备注
  targetScore?: number;     // 目标达成率
  /** 置顶/置底标记；同组之间才可拖拽调动位置。 */
  pin?: 'top' | 'bottom';
}

/** 推歌英灵殿条目：从计划移除的谱面与其删除时间。 */
export interface PlanGraveyardEntry {
  entry: PlanEntry;
  removedAt: number;
}

/** 已从 Diving-Fish 导入的单曲成绩。 */
export interface PlayerScore {
  songId: string;
  type: 'SD' | 'DX';
  difficultyIndex: number;
  achievement: number;
  dxScore: number;
  title?: string;
  ds?: number;
  level?: string;
  levelLabel?: string;
  rate?: string;
  fc?: string;
  fs?: string;
  serverRating?: number;
  importedAt: number;
}

/** Diving-Fish 成绩接口返回的用户摘要；不包含 Token。 */
export interface PlayerProfile {
  username?: string;
  nickname?: string;
  rating?: number;
  additionalRating?: number;
  plate?: string;
}

/** 一次成功同步时保存的本地成绩快照。不是官方逐局游玩历史。 */
export interface ScoreSnapshot {
  id: string;
  syncedAt: number;
  recordCount: number;
  serverRating: number | null;
  scores: PlayerScore[];
}

export interface ScoreChange {
  chartKey: string;
  previous: PlayerScore | null;
  current: PlayerScore | null;
  changedAt: number;
}

export interface ScoreSyncState {
  status: 'idle' | 'syncing' | 'success' | 'invalid' | 'error';
  lastSyncedAt: number | null;
  recordCount: number;
  serverRating: number | null;
  changedCount: number;
  message: string | null;
}

export type MusicPlatform = 'netease' | 'qq' | 'kugou';

export type BilibiliMetadataStatus = 'idle' | 'loading' | 'success' | 'partial' | 'error';

export interface BilibiliVideoLink {
  id: string;
  songId: string;
  musicType: 'SD' | 'DX';
  difficultyIndex: number;
  url: string;
  /** 标题优先来自公开元数据；没有网络时使用分享文本标题。 */
  title?: string;
  shareTitle?: string;
  coverUri?: string;
  coverSourceUrl?: string;
  metadataStatus?: BilibiliMetadataStatus;
  metadataFetchedAt?: number;
  remark: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

/** 歌曲详情页可排序/可折叠的板块标识。 */
export type DetailBoardId = 'rating' | 'achievement' | 'bilibili' | 'platform';

export interface DetailBoardConfig {
  /** 展示顺序（数值小者靠上）。 */
  order: number;
  /** 默认折叠（打开详情页时是否收起）。 */
  collapsed: boolean;
}

export interface AppSettings {
  showChinaVersion: boolean;
  defaultSort: SortOptions;
  showProjectedRating: boolean;
  defaultMusicPlatform: MusicPlatform;
  /** 音乐平台搜索优先尝试客户端深链（失败自动回退 HTTPS）；v1.7.x 默认开启。 */
  musicAppSearchFirst: boolean;
  /** 歌曲详情页板块排序与默认折叠状态。 */
  detailBoards: Record<DetailBoardId, DetailBoardConfig>;
}

/** 推分计划 */
export interface PushPlan {
  entries: PlanEntry[];
  updatedAt: number;
}

/** 抽选动画中的歌曲/谱面候选 */
export interface DrawCandidate {
  music: MusicData;
  difficultyIndex?: number;
  planEntry?: PlanEntry;
}

/** 筛选后的歌曲及其符合条件的谱面 */
export interface MusicMatch {
  music: MusicData;
  matchedDifficultyIndices: number[];
}