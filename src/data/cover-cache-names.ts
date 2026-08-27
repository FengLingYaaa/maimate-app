/**
 * 曲绘缓存文件名约定（纯函数，node 可测）。
 *
 * 文件名由歌曲 ID + 候选 URL 哈希派生（v1.11.0，`cover-<songId>-<hash>.png`），
 * 同一候选只落盘一次，同一歌曲的缓存文件可用前缀识别（清理用）。
 */

function hashUrl(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** 候选 URL 对应的本地缓存文件名。 */
export function getCoverCacheFilename(songId: string, coverUrl: string): string {
  return `cover-${encodeURIComponent(songId)}-${hashUrl(coverUrl)}.png`;
}

/** 判断文件名是否属于指定歌曲的曲绘缓存（清理时使用）。 */
export function isCoverCacheFileForSong(fileName: string, songId: string): boolean {
  return fileName.startsWith(`cover-${encodeURIComponent(songId)}-`);
}
