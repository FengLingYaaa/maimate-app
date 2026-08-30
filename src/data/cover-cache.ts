/**
 * 曲绘本地缓存：把远端封面图下载到应用缓存目录，之后离线直读本地文件。
 *
 * - 文件名由歌曲 ID + 候选 URL 哈希派生（v1.11.0，`cover-<songId>-<hash>.png`），
 *   同一候选只落盘一次；
 * - 下载经模块级守卫去重，列表快速滚动时同曲并发请求只触发一次网络；
 * - 任何失败静默返回 undefined，调用方回退远端直连，行为不劣于 v1.10。
 */

import * as FileSystem from 'expo-file-system/legacy';
import { getCoverCacheFilename } from './cover-cache-names';

const CACHE_DIR_NAME = 'covers';

function getCacheDirectoryUri(): string | null {
  const cacheDirectory = FileSystem.cacheDirectory;
  if (!cacheDirectory) return null;
  return `${cacheDirectory}${CACHE_DIR_NAME}/`;
}

const inflight = new Map<string, Promise<string | null>>();

async function downloadCover(cacheUri: string, coverUrl: string): Promise<string | null> {
  const temporary = `${cacheUri}tmp-${Math.random().toString(36).slice(2)}`;
  try {
    const result = await FileSystem.downloadAsync(coverUrl, temporary);
    if (result.status !== 200) {
      await FileSystem.deleteAsync(temporary, { idempotent: true });
      return null;
    }
    try {
      await FileSystem.moveAsync({ from: temporary, to: cacheUri });
    } catch {
      // 目标已存在等场景：直接认为已可用。
      await FileSystem.deleteAsync(temporary, { idempotent: true }).catch(() => undefined);
    }
    return cacheUri;
  } catch {
    await FileSystem.deleteAsync(temporary, { idempotent: true }).catch(() => undefined);
    return null;
  }
}

/** 读取本地缓存；未命中时下载一次。失败返回 null，调用方回退远端 URL。 */
export async function resolveCoverCacheUri(songId: string, coverUrl: string): Promise<string | null> {
  const cacheDirectoryUri = getCacheDirectoryUri();
  if (!cacheDirectoryUri) return null;
  const cacheUri = `${cacheDirectoryUri}${getCoverCacheFilename(songId, coverUrl)}`;
  try {
    const info = await FileSystem.getInfoAsync(cacheUri);
    if (info.exists) return cacheUri;
  } catch {
    return null;
  }
  const existing = inflight.get(cacheUri);
  if (existing) return existing;
  const task = downloadCover(cacheUri, coverUrl).finally(() => inflight.delete(cacheUri));
  inflight.set(cacheUri, task);
  return task;
}

/** 清空曲绘缓存目录（设置页清理入口使用）。v1.16.7：连目录一起删，避免目录残留被误计。 */
export async function clearCoverCache(): Promise<void> {
  const cacheDirectoryUri = getCacheDirectoryUri();
  if (!cacheDirectoryUri) return;
  try {
    await FileSystem.deleteAsync(cacheDirectoryUri, { idempotent: true });
  } catch {
    // 目录不存在等情况忽略。
  }
}
