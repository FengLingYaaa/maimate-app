/**
 * MaimaiDX 游戏常量
 */

/** 难度索引 → 标签映射 */
export const DifficultyLabels = ['Basic', 'Advanced', 'Expert', 'Master', 'Re:MASTER'] as const;
export type DifficultyIndex = 0 | 1 | 2 | 3 | 4;

/** 难度颜色标签（中文） */
export const DifficultyColors = ['绿', '黄', '红', '紫', '白'] as const;

/** 难度标签（日/中混合短标） */
export const DifficultyShortLabels = ['Bas', 'Adv', 'Exp', 'Mst', 'ReM'] as const;

/** 歌曲分类 */
/**
 * 兼容未加载曲库时的分类回退值；正常界面优先从 API 动态生成。
 */
export const Genres = [
  'niconico & VOCALOID',
  '东方Project',
  '其他游戏',
  '宴会場',
  '流行&动漫',
  '舞萌',
  '音击&中二节奏',
] as const;

/** 歌曲类型 */
export const MusicTypes = ['SD', 'DX'] as const;

/** 版本列表 */
export const Versions = [
  'maimai',
  'maimai PLUS',
  'maimai GreeN',
  'maimai GreeN PLUS',
  'maimai ORANGE',
  'maimai ORANGE PLUS',
  'maimai PiNK',
  'maimai PiNK PLUS',
  'maimai MURASAKi',
  'maimai MURASAKi PLUS',
  'maimai MiLK',
  'MiLK PLUS',
  'maimai FiNALE',
  'ALL FiNALE',
  'maimai でらっくす',
  'maimai でらっくす PLUS',
  'maimai でらっくす Splash',
  'maimai でらっくす Splash PLUS',
  'maimai でらっくす UNiVERSE',
  'maimai でらっくす UNiVERSE PLUS',
  'maimai でらっくす FESTiVAL',
  'maimai でらっくす FESTiVAL PLUS',
  'maimai でらっくす BUDDiES',
  'maimai でらっくす BUDDiES PLUS',
  'maimai でらっくす PRiSM',
] as const;

/** Prober API 基础 URL */
export const PROBER_API_BASE = 'https://www.diving-fish.com/api/maimaidxprober';

/** 缓存超过 12 小时后进入后台刷新流程。 */
export const CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/** 封面图 URL 模板 */
export const COVER_BASE = 'https://www.diving-fish.com/covers';

/** 获取封面图 URL (5位补零) */
export function getCoverUrl(id: string): string {
  const num = parseInt(id, 10);
  const len5 = num > 10000 && num <= 11000 ? (num - 10000).toString().padStart(5, '0') : num.toString().padStart(5, '0');
  return `${COVER_BASE}/${len5}.png`;
}

/** 本地缓存键 */
export const CACHE_KEYS = {
  musicData: 'maimate_music_data',
  // 兼容已有版本，同时作为音乐数据缓存的写入时间。
  musicDataVersion: 'maimate_music_version',
  chartStats: 'maimate_chart_stats',
  chartStatsVersion: 'maimate_chart_stats_version',
  planData: 'maimate_plan_data',
  settings: 'maimate_settings',
} as const;