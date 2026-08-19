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

/** 筛选条件 */
export interface FilterOptions {
  genre?: string | string[];
  difficulty?: number | number[];    // 难度索引 0-4
  level?: string | string[];         // 等级标签如 "12+"
  dsRange?: [number, number];        // 官方定数范围
  version?: string | string[];       // 原始版本名
  type?: 'SD' | 'DX' | ('SD' | 'DX')[];
  artist?: string;                   // 曲师关键词
  charter?: string;                  // 谱师关键词
  bpmRange?: [number, number];       // BPM 范围
  titleSearch?: string;              // 标题/曲师/谱师模糊搜索
  sort?: SortOptions;
}

/** 推分计划条目 */
export interface PlanEntry {
  songId: string;
  difficultyIndex: number;  // 目标练习的难度
  /** 兼容旧计划；新条目保存 SD/DX，避免同 ID 曲目混淆。 */
  musicType?: 'SD' | 'DX';
  addedAt: number;          // 添加时间戳
  order: number;            // 排序权重
  note?: string;            // 用户备注
  targetScore?: number;     // 目标达成率
}

/** 已从 Diving-Fish 导入的单曲成绩。 */
export interface PlayerScore {
  songId: string;
  type: 'SD' | 'DX';
  difficultyIndex: number;
  achievement: number;
  dxScore: number;
  fc?: string;
  fs?: string;
  serverRating?: number;
  importedAt: number;
}

export interface ScoreSyncState {
  status: 'idle' | 'syncing' | 'success' | 'invalid' | 'error';
  lastSyncedAt: number | null;
  recordCount: number;
  serverRating: number | null;
  message: string | null;
}

export interface AppSettings {
  showChinaVersion: boolean;
  defaultSort: SortOptions;
  showProjectedRating: boolean;
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