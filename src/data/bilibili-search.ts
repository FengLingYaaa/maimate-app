/**
 * Bilibili 外部搜索链接。
 *
 * MaiMate 不抓取视频、不内置视频目录；这里只根据本地歌曲标题和当前谱面
 * 难度生成客户端深链与网页搜索回退地址。单条用户主动保存的视频元数据
 * 由 bilibili-metadata.ts 另行按需缓存。
 */

export type BilibiliDifficultyIndex = 2 | 3 | 4;

export function isBilibiliSearchDifficulty(index: number): index is BilibiliDifficultyIndex {
  return index === 2 || index === 3 || index === 4;
}

export function getBilibiliSearchQuery(title: string, difficultyLabel: string): string {
  return `${title} ${difficultyLabel} maimai`;
}

export function getBilibiliSearchUrl(title: string, difficultyLabel: string): string {
  return `https://search.bilibili.com/all?keyword=${encodeURIComponent(getBilibiliSearchQuery(title, difficultyLabel))}`;
}

/**
 * Bilibili Android 客户端的搜索深链。
 * openURL 失败时必须回退到 getBilibiliSearchUrl，不能阻塞详情页。
 */
export function getBilibiliAppSearchUrl(title: string, difficultyLabel: string): string {
  return `bilibili://search?keyword=${encodeURIComponent(getBilibiliSearchQuery(title, difficultyLabel))}`;
}
