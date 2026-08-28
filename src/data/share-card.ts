/**
 * 查分分享卡片（v1.13.0 引入；v1.14.0 重构为按需 Modal 预览 + 存相册）：
 * 调用方按需渲染卡片（可见、在遮罩上），把卡片根节点 ref 交给 captureCardToTempFile，
 * 布局稳定后捕获为 PNG，预览大图 → 分享 / 保存到相册。
 */

import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import type { RefObject } from 'react';
import type { View } from 'react-native';

/** 捕获指定 ref 指向的卡片视图为 PNG，写入缓存目录，返回本地文件 URI。 */
export async function captureCardToTempFile(
  nodeRef: RefObject<View | null>,
  fileName: string,
): Promise<string> {
  const node = nodeRef.current;
  if (!node) throw new Error('卡片尚未渲染完成');
  const cacheDirectory = FileSystem.cacheDirectory;
  if (!cacheDirectory) throw new Error('无法访问应用缓存目录');
  const uri = await captureRef(node, { format: 'png', quality: 1, result: 'tmpfile' });
  const targetUri = `${cacheDirectory}${fileName}`;
  await FileSystem.moveAsync({ from: uri, to: targetUri });
  return targetUri;
}

/**
 * 请求保存到相册所需权限；拒绝时抛错。
 * v1.15.2：iOS 用 writeOnly（弹「仅添加照片」）；Android writeOnly 会导致 granted=false（保存失败），
 * 必须请求完整权限（恢复 MaiMate 相簿写入）。
 */
async function ensureMediaLibraryPermission(): Promise<void> {
  const permission = await MediaLibrary.requestPermissionsAsync(Platform.OS === 'ios');
  if (permission.granted !== true) {
    throw new Error('未授予相册权限，无法保存到相册');
  }
}

/** 保存 PNG 到系统相册（自动建立 MaiMate 相簿）。 */
export async function savePngToMediaLibrary(fileUri: string): Promise<void> {
  await ensureMediaLibraryPermission();
  const asset = await MediaLibrary.createAssetAsync(fileUri);
  if (asset) {
    const album = await MediaLibrary.getAlbumAsync('MaiMate');
    if (album == null) {
      await MediaLibrary.createAlbumAsync('MaiMate', asset, false);
    } else {
      await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
    }
  }
}

/** 拉起系统分享面板分享 PNG。 */
export async function sharePngFile(fileUri: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('当前设备不支持系统分享');
  await Sharing.shareAsync(fileUri, {
    mimeType: 'image/png',
    dialogTitle: '分享 MaiMate 查分卡片',
    UTI: 'public.png',
  });
}

export function shareCardFileName(prefix: string, now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${prefix}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.png`;
}
