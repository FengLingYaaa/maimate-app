import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as IntentLauncher from 'expo-intent-launcher';
import type { MusicPlatform } from './types';
import {
  getBilibiliAppSearchUrl,
  getBilibiliSearchUrl,
} from './bilibili-search';
import {
  getMusicPlatformAppUrls,
  getMusicPlatformSearchUrl,
} from './music-platforms';

type AppCandidate = { url: string; packageName?: string };

export type ExternalOpenResult = 'app' | 'web';

const ANDROID_PACKAGES: Record<string, string> = {
  bilibili: 'tv.danmaku.bili',
  orpheus: 'com.netease.cloudmusic',
  qqmusic: 'com.tencent.qqmusic',
  kugou: 'com.kugou.android',
};

function packageForUrl(url: string): string | undefined {
  try {
    return ANDROID_PACKAGES[new URL(url).protocol.replace(':', '')];
  } catch {
    return undefined;
  }
}

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
    if (await tryAndroidIntent({
      ...candidate,
      packageName: candidate.packageName || packageForUrl(candidate.url),
    })) return 'app';
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

export async function openMusicPlatformSearch(
  platform: MusicPlatform,
  title: string,
  artist?: string,
): Promise<ExternalOpenResult> {
  return openAppFirst(
    getMusicPlatformAppUrls(platform, title, artist).map(url => ({
      url,
      packageName: packageForUrl(url),
    })),
    getMusicPlatformSearchUrl(platform, title, artist),
  );
}

export async function openBilibiliVideo(url: string): Promise<void> {
  if (await tryAndroidIntent({ url, packageName: ANDROID_PACKAGES.bilibili })) return;
  await Linking.openURL(url);
}

