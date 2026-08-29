/**
 * 存储占用分析（v1.16.5）：估算应用三类本机占用量并在设置页展示。
 * - 应用本体：只读展示（APK 安装体积，取应用安装目录大小需原生 API，展示固定口径即可）。
 * - 成绩与计划数据：遍历 AsyncStorage 全部键值求字节数（UTF-8）。
 * - 曲绘缓存：扫 covers 缓存目录文件数与字节数。
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { clearCoverCache } from './cover-cache';

export interface StorageBreakdown {
  /** 成绩与计划数据（AsyncStorage 全量）字节。 */
  dataBytes: number;
  /** 曲绘缓存目录字节。 */
  coverBytes: number;
  /** 曲绘缓存文件数。 */
  coverCount: number;
}

function utf8Bytes(text: string): number {
  // 轻量估算：CJK 计 3 字节，其余 1 字节（足够做占用展示）。
  let bytes = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    bytes += code >= 0x800 ? 3 : code >= 0x80 ? 2 : 1;
  }
  return bytes;
}

/** 遍历 AsyncStorage 全部键值求字节和。 */
async function measureAsyncStorage(): Promise<number> {
  const keys = await (async () => {
    const mod = await import('@react-native-async-storage/async-storage');
    return mod.default.getAllKeys();
  })();
  const pairs = await (async () => {
    const mod = await import('@react-native-async-storage/async-storage');
    return mod.default.multiGet(keys as readonly string[]);
  })();
  let total = 0;
  for (const [key, value] of pairs) {
    total += utf8Bytes(key) + utf8Bytes(value ?? '');
  }
  return total;
}

/** 统计目录字节与文件数（递归一层足够：covers 目录是平铺的）。 */
async function measureDirectory(dirUri: string): Promise<{ bytes: number; count: number }> {
  let bytes = 0;
  let count = 0;
  let items = null;
  try {
    items = await FileSystem.readDirectoryAsync(dirUri);
  } catch {
    return { bytes: 0, count: 0 };
  }
  for (const name of items) {
    try {
      const info = await FileSystem.getInfoAsync(dirUri + name);
      if (info.exists) {
        bytes += (info as unknown as { size?: number }).size ?? 0;
        count += 1;
      }
    } catch {
      // 单个文件失败跳过。
    }
  }
  return { bytes, count };
}

/** 汇总存储占用（异步，设置页进入时调用一次）。 */
export async function measureStorageBreakdown(): Promise<StorageBreakdown> {
  const dataBytes = await measureAsyncStorage();
  const cacheDirectory = FileSystem.cacheDirectory;
  const coverDir = cacheDirectory ? `${cacheDirectory}covers/` : null;
  const cover = coverDir ? await measureDirectory(coverDir) : { bytes: 0, count: 0 };
  return { dataBytes, coverBytes: cover.bytes, coverCount: cover.count };
}

/** 清理曲绘缓存并返回是否执行了删除。 */
export async function clearCovers(): Promise<boolean> {
  const before = await (async () => {
    const cacheDirectory = FileSystem.cacheDirectory;
    const coverDir = cacheDirectory ? `${cacheDirectory}covers/` : null;
    return coverDir ? measureDirectory(coverDir) : { bytes: 0, count: 0 };
  })();
  if (before.count === 0) return false;
  await clearCoverCache();
  return true;
}

/** 清理成绩与计划数据（复用「清除本地成绩」现有链路；此处仅返回数据量字节）。 */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export const STORAGE_PLATFORM = Platform.OS;
