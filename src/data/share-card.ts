/**
 * 查分分享卡片（v1.13.0）：把 B50 总览或单曲详情渲染成图片并拉起系统分享。
 * 基于 react-native-view-shot 捕获，expo-sharing 分享。
 */

import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

export type { CaptureOptions } from 'react-native-view-shot';

/** ViewShot 组件实例引用的最小接口（capture 方法）。 */
export interface ViewShotInstance {
  capture: (options?: { result?: string; format?: string; quality?: number }) => Promise<string>;
}

/** 捕获 ViewShot 实例为临时 PNG 并拉起分享面板。 */
export async function captureAndShare(node: ViewShotInstance | null, fileName: string): Promise<void> {
  if (!node || typeof node.capture !== 'function') return;
  const cacheDirectory = FileSystem.cacheDirectory;
  if (!cacheDirectory) throw new Error('无法访问应用缓存目录');
  const uri: string = await node.capture();
  const targetUri = `${cacheDirectory}${fileName}`;
  await FileSystem.moveAsync({ from: uri, to: targetUri });
  try {
    if (!(await Sharing.isAvailableAsync())) throw new Error('当前设备不支持系统分享');
    await Sharing.shareAsync(targetUri, {
      mimeType: 'image/png',
      dialogTitle: '分享 MaiMate 查分卡片',
      UTI: 'public.png',
    });
  } finally {
    FileSystem.deleteAsync(targetUri, { idempotent: true }).catch(() => undefined);
  }
}

export function shareCardFileName(prefix: string, now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${prefix}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.png`;
}
