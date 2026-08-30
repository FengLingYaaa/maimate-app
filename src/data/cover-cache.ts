/**
 * 曲绘本地缓存（v1.16.8 分级版）：
 *
 * - covers/thumbs/<id>-<hash>.jpg：列表用低清缩略图（长边 512px，JPEG 80），首次下载原图后
 *   用 expo-image-manipulator 本地压缩生成，**原图不落盘**——曲绘总量有硬上限；
 * - covers/full/<id>-<hash>.png：详情页/看图模式按需下载的原图，LRU 上限
 *   （默认 80 张，超限删最久未用）；
 * - 文件名沿用 songId + 候选 URL 哈希派生；下载经模块级守卫去重；
 * - 任何失败静默回退，调用方行为不劣于占位图。
 */

import * as FileSystem from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { getCoverCacheFilename, getCoverCacheStem } from './cover-cache-names';
import { touchCoverFull, evictCoverFullIfNeeded } from './cover-lru';

const CACHE_DIR_NAME = 'covers';
const THUMB_DIR_NAME = 'thumbs';
const FULL_DIR_NAME = 'full';

/** 列表缩略图统一编码参数：长边 512、JPEG 80（单张 ~20-40KB）。 */
const THUMB_WIDTH = 512;
const THUMB_QUALITY = 0.8;

function getCacheDirectoryUri(): string | null {
  const cacheDirectory = FileSystem.cacheDirectory;
  if (!cacheDirectory) return null;
  return `${cacheDirectory}${CACHE_DIR_NAME}/`;
}

async function ensureSubdirectory(name: string): Promise<string | null> {
  const root = getCacheDirectoryUri();
  if (!root) return null;
  const dirUri = `${root}${name}/`;
  try {
    const info = await FileSystem.getInfoAsync(dirUri.replace(/\/$/, ''));
    if (!info.exists) await FileSystem.makeDirectoryAsync(dirUri.replace(/\/$/, ''), { intermediates: true });
  } catch {
    // 目录已存在等情况忽略。
  }
  return dirUri;
}

const inflightThumb = new Map<string, Promise<string | null>>();
const inflightFull = new Map<string, Promise<string | null>>();

/** 下载原图到临时文件并压缩为缩略图；成功返回缩略图 URI，原图不保留。 */
async function downloadThumb(thumbUri: string, coverUrl: string): Promise<string | null> {
  const temporary = `${getCacheDirectoryUri()}tmp-${Math.random().toString(36).slice(2)}`;
  try {
    const result = await FileSystem.downloadAsync(coverUrl, temporary);
    if (result.status !== 200) {
      await FileSystem.deleteAsync(temporary, { idempotent: true });
      return null;
    }
    try {
      const context = ImageManipulator.manipulate(temporary);
      context.resize({ width: THUMB_WIDTH });
      const rendered = await context.renderAsync();
      const saved = await rendered.saveAsync({ compress: THUMB_QUALITY, format: SaveFormat.JPEG });
      // v14 saveAsync 写入应用缓存并返回 uri，移动到 covers/thumbs 的目标名。
      if (!saved?.uri) throw new Error('manipulator returned no uri');
      await FileSystem.moveAsync({ from: saved.uri, to: thumbUri });
    } catch {
      // 压缩失败时把原图改名为缩略图兜底（体积略大但可用）。
      try {
        await FileSystem.moveAsync({ from: temporary, to: thumbUri });
        return thumbUri;
      } catch {
        return null;
      }
    }
    await FileSystem.deleteAsync(temporary, { idempotent: true }).catch(() => undefined);
    return thumbUri;
  } catch {
    await FileSystem.deleteAsync(temporary, { idempotent: true }).catch(() => undefined);
    return null;
  }
}

/** 下载原图到 full/ 并做 LRU 登记与淘汰。 */
async function downloadFull(fullUri: string, coverUrl: string): Promise<string | null> {
  const temporary = `${getCacheDirectoryUri()}tmp-${Math.random().toString(36).slice(2)}`;
  try {
    const result = await FileSystem.downloadAsync(coverUrl, temporary);
    if (result.status !== 200) {
      await FileSystem.deleteAsync(temporary, { idempotent: true });
      return null;
    }
    try {
      await FileSystem.moveAsync({ from: temporary, to: fullUri });
    } catch {
      await FileSystem.deleteAsync(temporary, { idempotent: true }).catch(() => undefined);
      const info = await FileSystem.getInfoAsync(fullUri.replace(/\/$/, ''));
      if (!info.exists) return null;
    }
    await touchCoverFull(fullUri);
    await evictCoverFullIfNeeded();
    return fullUri;
  } catch {
    await FileSystem.deleteAsync(temporary, { idempotent: true }).catch(() => undefined);
    return null;
  }
}

/** 列表解析：只等缩略图（阻塞式——本地未就绪就下载），永远不回退远端 URL。 */
export async function resolveCoverCacheUriBlocking(songId: string, coverUrl: string): Promise<string | null> {
  const root = getCacheDirectoryUri();
  if (!root) return null;
  const thumbDir = await ensureSubdirectory(THUMB_DIR_NAME);
  if (!thumbDir) return null;
  const thumbUri = `${thumbDir}${getCoverCacheFilename(songId, coverUrl).replace(/\.png$/, '.jpg')}`;
  try {
    const info = await FileSystem.getInfoAsync(thumbUri);
    if (info.exists) return thumbUri;
  } catch {
    return null;
  }
  const existing = inflightThumb.get(thumbUri);
  if (existing) return existing;
  const task = downloadThumb(thumbUri, coverUrl).finally(() => inflightThumb.delete(thumbUri));
  inflightThumb.set(thumbUri, task);
  return task;
}

/**
 * 兼容别名（v1.16.7 前的调用点）：与 Blocking 相同——本地优先，绝不返回远端 URL。
 * v1.16.8 的 CoverImage 列表路径使用本函数；详情页 preferFull 使用 resolveCoverCacheUriFull。
 */
export const resolveCoverCacheUri = resolveCoverCacheUriBlocking;

/** 详情页/看图模式：优先原图（LRU 管理），原图不可用回退缩略图。 */
export async function resolveCoverCacheUriFull(songId: string, coverUrl: string): Promise<string | null> {
  const root = getCacheDirectoryUri();
  if (!root) return null;
  const fullDir = await ensureSubdirectory(FULL_DIR_NAME);
  if (!fullDir) return null;
  const fullUri = `${fullDir}${getCoverCacheStem(songId, coverUrl)}.png`;
  try {
    const info = await FileSystem.getInfoAsync(fullUri);
    if (info.exists) {
      await touchCoverFull(fullUri);
      return fullUri;
    }
  } catch {
    // 继续走下载。
  }
  const existing = inflightFull.get(fullUri);
  if (existing) return existing;
  const task = downloadFull(fullUri, coverUrl).finally(() => inflightFull.delete(fullUri));
  inflightFull.set(fullUri, task);
  return task;
}

/** 清空曲绘缓存目录（设置页清理入口使用）。连目录一起删。 */
export async function clearCoverCache(): Promise<void> {
  const cacheDirectoryUri = getCacheDirectoryUri();
  if (!cacheDirectoryUri) return;
  try {
    await FileSystem.deleteAsync(cacheDirectoryUri, { idempotent: true });
  } catch {
    // 目录不存在等情况忽略。
  }
}
