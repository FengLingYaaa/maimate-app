import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as IntentLauncher from 'expo-intent-launcher';
import type { MusicPlatform } from './types';
import {
  getBilibiliAppSearchUrl,
  getBilibiliSearchUrl,
  getBilibiliVideoAppUrl,
} from './bilibili-search';
import { getMusicPlatformSearchUrl } from './music-platforms';

type AppCandidate = { url: string; packageName?: string };

export type ExternalOpenResult = 'app' | 'web';

const ANDROID_PACKAGES: Record<string, string> = {
  bilibili: 'tv.danmaku.bili',
  orpheus: 'com.netease.cloudmusic',
  qqmusic: 'com.tencent.qqmusic',
  kugou: 'com.kugou.android',
};

async function tryLinkingApp(candidate: AppCandidate): Promise<boolean> {
  try {
    if (!(await Linking.canOpenURL(candidate.url))) return false;
    await Linking.openURL(candidate.url);
    return true;
  } catch {
    return false;
  }
}

async function tryAndroidIntent(candidate: AppCandidate): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: candidate.url,
      packageName: candidate.packageName,
    });
    return true;
  } catch {
    return false;
  }
}

/** Open an app deep link when possible, never blocking the HTTPS fallback. */
export async function openAppFirst(
  candidates: AppCandidate[],
  webUrl: string,
): Promise<ExternalOpenResult> {
  for (const candidate of candidates) {
    if (await tryLinkingApp(candidate)) return 'app';
    if (await tryAndroidIntent(candidate)) return 'app';
  }
  await Linking.openURL(webUrl);
  return 'web';
}

export async function openBilibiliSearch(
  title: string,
  difficultyLabel: string,
): Promise<ExternalOpenResult> {
  return openAppFirst(
    [{ url: getBilibiliAppSearchUrl(title, difficultyLabel), packageName: ANDROID_PACKAGES.bilibili }],
    getBilibiliSearchUrl(title, difficultyLabel),
  );
}

/**
 * 音乐平台打开 HTTPS 搜索结果页（v1.7.0 起）。
 * 各客户端的搜索深链路由未公开：canOpenURL 只能验证 scheme 注册，
 * 打开后常落在应用首页而不带关键词。改为直接打开带关键词的
 * HTTPS 搜索页，保证用户看到的就是候选结果列表。
 */
export async function openMusicPlatformSearch(
  platform: MusicPlatform,
  title: string,
  artist?: string,
): Promise<ExternalOpenResult> {
  await Linking.openURL(getMusicPlatformSearchUrl(platform, title, artist));
  return 'web';
}

/** 用户主动保存的单条 B 站视频：优先客户端内打开，失败回退网页。 */
export async function openBilibiliVideo(url: string): Promise<void> {
  const appUrl = getBilibiliVideoAppUrl(url);
  if (appUrl && await tryLinkingApp({ url: appUrl, packageName: ANDROID_PACKAGES.bilibili })) return;
  if (await tryAndroidIntent({ url, packageName: ANDROID_PACKAGES.bilibili })) return;
  await Linking.openURL(url);
}

