import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as IntentLauncher from 'expo-intent-launcher';
import type { MusicPlatform } from './types';
import {
  getBilibiliAppSearchUrl,
  getBilibiliSearchUrl,
  isBilibiliShortLink,
} from './bilibili-search';
import { getDirectVideoAppUrls, resolveAndCacheVideoUrl } from './bilibili-resolve';
import { getMusicPlatformSearchUrl, getMusicPlatformAppUrls } from './music-platforms';

type AppCandidate = { url: string; packageName?: string };

export type ExternalOpenResult = 'app' | 'web';

const ANDROID_PACKAGES: Record<string, string> = {
  bilibili: 'tv.danmaku.bili',
  orpheus: 'com.netease.cloudmusic',
  qqmusic: 'com.tencent.qqmusic',
  kugou: 'com.kugou.android',
};

/**
 * 直接 openURL 拉起应用。Android 上刻意不做 canOpenURL 预判：
 * Android 11+ 的 package visibility 会让 canOpenURL 对已安装应用
 * 返回假阴性（未声明 <queries> 时），从而误跳过深链；openURL 本身
 * 走隐式 intent 不受查询限制，拉不起才抛异常由调用方回退。
 * iOS 上保留 canOpenURL 以避免未注册 scheme 时崩溃。
 */
async function tryLinkingApp(candidate: AppCandidate): Promise<boolean> {
  try {
    if (Platform.OS === 'ios' && !(await Linking.canOpenURL(candidate.url))) return false;
    await Linking.openURL(candidate.url);
    return true;
  } catch {
    return false;
  }
}

/** 隐式 intent 兜底：不带 packageName，绕开 package visibility 限制。 */
async function tryAndroidIntent(candidate: AppCandidate): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: candidate.url,
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
 * 音乐平台搜索跳转（v1.7.x 起应用优先、可关）。
 * 先逐个尝试客户端搜索深链候选（社区已知路由，无官方文档），
 * 全部失败自动回退带关键词的 HTTPS 搜索结果页；回退永不阻塞。
 */
export async function openMusicPlatformSearch(
  platform: MusicPlatform,
  title: string,
  artist?: string,
  options?: { appSearchFirst?: boolean },
): Promise<ExternalOpenResult> {
  if (options?.appSearchFirst !== false) {
    for (const candidate of getMusicPlatformAppUrls(platform, title, artist)) {
      if (await tryLinkingApp({ url: candidate, packageName: ANDROID_PACKAGES[platform] })) return 'app';
      if (await tryAndroidIntent({ url: candidate, packageName: ANDROID_PACKAGES[platform] })) return 'app';
    }
  }
  await Linking.openURL(getMusicPlatformSearchUrl(platform, title, artist));
  return 'web';
}

/** 用户主动保存的单条 B 站视频：优先客户端内打开，失败回退网页。
 * b23.tv 短链会先解析成最终地址（结果缓存），再按 av 优先逐个尝试深链。 */
export async function openBilibiliVideo(url: string): Promise<void> {
  let target = url;
  if (isBilibiliShortLink(url)) {
    const resolved = await resolveAndCacheVideoUrl(url);
    if (resolved) target = resolved;
  }
  const appUrls = getDirectVideoAppUrls(target);
  for (const appUrl of appUrls) {
    if (await tryLinkingApp({ url: appUrl })) return;
    if (await tryAndroidIntent({ url: appUrl })) return;
  }
  if (await tryAndroidIntent({ url: target })) return;
  await Linking.openURL(url);
}

