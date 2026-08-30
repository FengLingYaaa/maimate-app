/**
 * 存储占用分析（v1.16.6）：估算应用三类本机占用量并在设置页展示。
 * - 应用本体：APK 安装体积（约 59.4 MB）；系统「应用详情」显示的 ~120 MB 为安装后
 *   解压 so/资源的口径，页面附说明文字。
 * - 成绩与计划数据：遍历 AsyncStorage 全部键值求字节数（UTF-8）。
 * - 曲绘缓存：expo-file-system 新 API（File.size / Directory.size）统计，v1.16.5 的
 *   legacy getInfoAsync 不带 size 导致恒 0。
 * - 其它缓存：cache 根目录下 covers 之外的内容（旧版残留/网络缓存），支持清理。
 */

import * as FileSystem from 'expo-file-system/legacy';
import { File, Directory } from 'expo-file-system';
import { clearCoverCache } from './cover-cache';
import { clearCoverFullLru } from './cover-lru';

export interface StorageBreakdown {
  /** 成绩与计划数据（AsyncStorage 全量）字节。 */
  dataBytes: number;
  /** 曲绘缓存目录字节。 */
  coverBytes: number;
  /** 曲绘缓存文件数。 */
  coverCount: number;
  /** cache 根目录下除 covers 外的其它缓存字节。 */
  otherBytes: number;
  /** v1.16.8：其它缓存的一级子项明细（名字+字节，降序），设置页展示用。 */
  otherItems: Array<{ name: string; bytes: number }>;
}

function utf8Bytes(text: string): number {
  let bytes = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    bytes += code >= 0x800 ? 3 : code >= 0x80 ? 2 : 1;
  }
  return bytes;
}

/** 遍历 AsyncStorage 全部键值求字节和。 */
async function measureAsyncStorage(): Promise<number> {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  const keys = await AsyncStorage.getAllKeys();
  const pairs = await AsyncStorage.multiGet(keys as readonly string[]);
  let total = 0;
  for (const [key, value] of pairs) {
    total += utf8Bytes(key) + utf8Bytes(value ?? '');
  }
  return total;
}

/** 用新 File API 统计目录（文件字节 + 文件数）；目录不存在返回 0。 */
function measureDirectoryWithFileApi(dirUri: string): { bytes: number; count: number } {
  try {
    const dir = new Directory(dirUri);
    if (!dir.exists) return { bytes: 0, count: 0 };
    let bytes = 0;
    let count = 0;
    for (const item of dir.list()) {
      if (item instanceof File) {
        bytes += item.size;
        count += 1;
      }
    }
    return { bytes, count };
  } catch {
    return { bytes: 0, count: 0 };
  }
}

/** cache 根目录一级子项里 covers 之外的字节与明细。 */
function measureOtherCache(cacheUri: string, coversDirName: string): { bytes: number; items: Array<{ name: string; bytes: number }> } {
  try {
    const cacheDir = new Directory(cacheUri);
    if (!cacheDir.exists) return { bytes: 0, items: [] };
    let bytes = 0;
    const items: Array<{ name: string; bytes: number }> = [];
    for (const item of cacheDir.list()) {
      // v1.16.7：用 URI 后缀判定（部分平台上 name 可能带路径成分，等值比较曾漏判 covers）。
      if (item.uri.endsWith(`/${coversDirName}`)) continue;
      const size = item instanceof File ? item.size : item instanceof Directory ? item.size ?? 0 : 0;
      if (size > 0) items.push({ name: item.name || item.uri.split('/').filter(Boolean).pop() || item.uri, bytes: size });
      bytes += size;
    }
    items.sort((left, right) => right.bytes - left.bytes);
    return { bytes, items };
  } catch {
    return { bytes: 0, items: [] };
  }
}

/** 汇总存储占用（异步，设置页进入时调用一次）。 */
export async function measureStorageBreakdown(): Promise<StorageBreakdown> {
  const dataBytes = await measureAsyncStorage();
  const cacheUri = FileSystem.cacheDirectory;
  const cover = cacheUri ? measureDirectoryWithFileApi(`${cacheUri}covers/`) : { bytes: 0, count: 0 };
  const other = cacheUri ? measureOtherCache(cacheUri, 'covers') : { bytes: 0, items: [] as Array<{ name: string; bytes: number }> };
  return { dataBytes, coverBytes: cover.bytes, coverCount: cover.count, otherBytes: other.bytes, otherItems: other.items };
}

/** 清理曲绘缓存。返回是否执行了删除。 */
export async function clearCovers(): Promise<boolean> {
  const cacheUri = FileSystem.cacheDirectory;
  if (!cacheUri) return false;
  const before = measureDirectoryWithFileApi(`${cacheUri}covers/`);
  await clearCoverCache();
  await clearCoverFullLru();
  return before.count > 0;
}

/** 清理 cache 根目录下 covers 之外的缓存（不动曲绘，不动 document 数据）。 */
export async function clearOtherCache(): Promise<boolean> {
  const cacheUri = FileSystem.cacheDirectory;
  if (!cacheUri) return false;
  let removed = false;
  try {
    const cacheDir = new Directory(cacheUri);
    if (!cacheDir.exists) return false;
    for (const item of cacheDir.list()) {
      // v1.16.7：URI 后缀判定，避免误删 covers。
      if (item.uri.endsWith('/covers')) continue;
      try {
        item.delete();
        removed = true;
      } catch {
        // 个别文件被占用时跳过。
      }
    }
  } catch {
    // 根目录不存在等情况。
  }
  // v1.16.8：系统图片库（Fresco）磁盘缓存单独清理。
  try {
    const Image = require('react-native').Image;
    if (typeof Image?.clearDiskCache === 'function') await Image.clearDiskCache();
    if (typeof Image?.clearMemoryCache === 'function') await Image.clearMemoryCache();
  } catch {
    // 不可用时静默忽略。
  }
  return removed;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
