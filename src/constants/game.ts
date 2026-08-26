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
  'maimai でらっくす PRiSM PLUS',
] as const;

/**
 * Diving-Fish 数据确认（2026-08-26，1379 首）：
 * - 「ALL FiNALE」在 music_data 中没有任何曲目，已从版本列表移除；
 * - DX 时代的 でらっくす PLUS / Splash PLUS / UNiVERSE PLUS / FESTiVAL PLUS /
 *   BUDDiES PLUS 均无独立数据（曲目已并入基础版本名），筛选时把基础与 PLUS
 *   合并为一个标签；PRiSM PLUS 有 57 首独立数据，因此 PRiSM 与 PRiSM PLUS
 *   保持两个独立筛选项。
 */
export const MERGED_VERSION_GROUPS: ReadonlyArray<{ label: string; rawValues: string[] }> = [
  { label: 'maimai でらっくす+PLUS', rawValues: ['maimai でらっくす', 'maimai でらっくす PLUS'] },
  { label: 'maimai でらっくす Splash+PLUS', rawValues: ['maimai でらっくす Splash', 'maimai でらっくす Splash PLUS'] },
  { label: 'maimai でらっくす UNiVERSE+PLUS', rawValues: ['maimai でらっくす UNiVERSE', 'maimai でらっくす UNiVERSE PLUS'] },
  { label: 'maimai でらっくす FESTiVAL+PLUS', rawValues: ['maimai でらっくす FESTiVAL', 'maimai でらっくす FESTiVAL PLUS'] },
  { label: 'maimai でらっくす BUDDiES+PLUS', rawValues: ['maimai でらっくす BUDDiES', 'maimai でらっくす BUDDiES PLUS'] },
];

/** 把一个版本筛选项展开为它覆盖的全部原始版本名。 */
export function expandVersionFilterValue(value: string): string[] {
  const group = MERGED_VERSION_GROUPS.find(candidate => candidate.label === value);
  return group ? group.rawValues : [value];
}

/** 原始版本名 → 舞萌中国区展示名。原始值始终保留用于筛选与数据匹配。 */
export const ChinaVersionMap: Record<string, string> = {
  'maimai でらっくす': '舞萌DX',
  'maimai でらっくす PLUS': '舞萌DX',
  'maimai でらっくす Splash': '舞萌DX 2021',
  'maimai でらっくす Splash PLUS': '舞萌DX 2021',
  'maimai でらっくす UNiVERSE': '舞萌DX 2022',
  'maimai でらっくす UNiVERSE PLUS': '舞萌DX 2022',
  'maimai でらっくす FESTiVAL': '舞萌DX 2023',
  'maimai でらっくす FESTiVAL PLUS': '舞萌DX 2023',
  'maimai でらっくす BUDDiES': '舞萌DX 2024',
  'maimai でらっくす BUDDiES PLUS': '舞萌DX 2024',
  'maimai でらっくす PRiSM': '舞萌DX 2025',
  'maimai でらっくす PRiSM PLUS': '舞萌DX 2026',
};

export function getChinaVersionName(rawVersion: string): string {
  return ChinaVersionMap[rawVersion] || rawVersion;
}

/** 宴会場谱面上的数字不作为正式官方详细定数使用。 */
export function isBanquetGenre(genre: string | undefined): boolean {
  return genre === '宴会場' || genre === '宴会场';
}

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
  scoreData: 'maimate_score_data',
  scoreSync: 'maimate_score_sync',
  scoreSnapshots: 'maimate_score_snapshots',
  scoreChanges: 'maimate_score_changes',
  planGraveyard: 'maimate_plan_graveyard',
  bilibiliLinks: 'maimate_bilibili_links',
  fortuneSeed: 'maimate_fortune_seed',
} as const;