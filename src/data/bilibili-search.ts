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

/**
 * 从用户保存的视频链接提取 B 站客户端深链。
 * bilibili.com/video/BV… 或 /av… 可直接映射为 bilibili://video/<id>；
 * b23.tv 短链无法在本地展开，返回 null 由调用方走 intent/网页回退。
 */
export function getBilibiliVideoAppUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/(?:video\/)?(BV[0-9A-Za-z]{10}|av\d+)/i);
    if (match) return `bilibili://video/${match[1]}`;
  } catch {
    // 非 http(s) 结构时按无深链处理
  }
  return null;
}
