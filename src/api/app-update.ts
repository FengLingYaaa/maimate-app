import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { compareSemver } from '../data/semver';

const GITHUB_API_URL = 'https://api.github.com/repos/FengLingYaaa/maimate-app/releases/latest';
const DOWNLOAD_SITE_APK_URL = 'https://maimate.flya.ccwu.cc/MaiMate-latest.apk';
const REQUEST_TIMEOUT_MS = 15000;
/** 更新红点状态与节流时间戳的存储键。 */
const UPDATE_STATE_KEY = 'maimate_update_state';
/** 静默检查节流间隔。 */
const AUTO_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface UpdateCheckResult {
  status: 'update' | 'latest' | 'error';
  currentVersion: string;
  latestVersion: string | null;
  releaseUrl: string | null;
  publishedAt: string | null;
  notes: string | null;
  apkUrl: string | null;
  error?: string;
}

interface UpdateState {
  lastCheckedAt: number | null;
  /** 已知最新版本（驱动设置页红点）。 */
  knownLatestVersion: string | null;
  /** 用户选择忽略的版本（不再亮红点）。 */
  dismissedVersion: string | null;
}

export { compareSemver } from '../data/semver';

async function readUpdateState(): Promise<UpdateState> {
  try {
    const raw = await AsyncStorage.getItem(UPDATE_STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UpdateState>;
      return {
        lastCheckedAt: typeof parsed.lastCheckedAt === 'number' ? parsed.lastCheckedAt : null,
        knownLatestVersion: typeof parsed.knownLatestVersion === 'string' ? parsed.knownLatestVersion : null,
        dismissedVersion: typeof parsed.dismissedVersion === 'string' ? parsed.dismissedVersion : null,
      };
    }
  } catch {
    // 读取失败按无状态处理。
  }
  return { lastCheckedAt: null, knownLatestVersion: null, dismissedVersion: null };
}

async function writeUpdateState(state: UpdateState): Promise<void> {
  try {
    await AsyncStorage.setItem(UPDATE_STATE_KEY, JSON.stringify(state));
  } catch {
    // 写失败不影响本次结果。
  }
}

/** 设置页红点：有比当前版本新的已知版本且未被忽略时为 true。 */
export async function hasUpdateBadge(currentVersion: string): Promise<boolean> {
  const state = await readUpdateState();
  if (!state.knownLatestVersion) return false;
  if (compareSemver(state.knownLatestVersion, currentVersion) <= 0) return false;
  if (state.dismissedVersion && compareSemver(state.dismissedVersion, state.knownLatestVersion) >= 0) return false;
  return true;
}

/**
 * 红点清除：仅在用户确实看到该版本的更新信息时调用（更新页展示发现更新时）。
 * v1.14.0 修复：不再在进入更新页时无条件 dismiss——此前用户升级后路过更新页
 * 会把尚未展示过的新版本静默标记为已读，导致设置页红点不亮。
 */
export async function markUpdateSeen(currentVersion: string): Promise<void> {
  const state = await readUpdateState();
  if (!state.knownLatestVersion || compareSemver(state.knownLatestVersion, currentVersion) <= 0) {
    return;
  }
  await writeUpdateState({ ...state, dismissedVersion: state.knownLatestVersion });
}

/** 启动后台静默检查：≥24h 才真正请求；结果写入已知版本供红点判断。 */
export async function autoCheckForUpdate(currentVersion: string): Promise<UpdateCheckResult | null> {
  const state = await readUpdateState();
  const now = Date.now();
  if (state.lastCheckedAt && now - state.lastCheckedAt < AUTO_CHECK_INTERVAL_MS) return null;
  const result = await checkForUpdate(currentVersion);
  if (result.status === 'update' && result.latestVersion) {
    await writeUpdateState({ ...state, lastCheckedAt: now, knownLatestVersion: result.latestVersion });
    return result;
  }
  if (result.status === 'latest') {
    await writeUpdateState({ ...state, lastCheckedAt: now, knownLatestVersion: currentVersion });
  }
  return null;
}

/** 手动检查（设置页按钮）：更新节流时间与已知版本，但不改变用户忽略状态。 */
export async function manualCheckForUpdate(currentVersion: string): Promise<UpdateCheckResult> {
  const result = await checkForUpdate(currentVersion);
  const state = await readUpdateState();
  if (result.status === 'update' && result.latestVersion) {
    await writeUpdateState({ ...state, lastCheckedAt: Date.now(), knownLatestVersion: result.latestVersion });
  } else if (result.status === 'latest') {
    await writeUpdateState({ ...state, lastCheckedAt: Date.now(), knownLatestVersion: currentVersion, dismissedVersion: null });
  }
  return result;
}

interface GitHubRelease {
  tag_name?: string;
  html_url?: string;
  published_at?: string;
  body?: string;
  draft?: boolean;
  prerelease?: boolean;
  assets?: Array<{ name?: string; browser_download_url?: string }>;
}

function parseGitHubRelease(payload: GitHubRelease): { latestVersion: string; releaseUrl: string; publishedAt: string | null; notes: string | null; hasApkAsset: boolean } | null {
  if (!payload || typeof payload.tag_name !== 'string' || !payload.tag_name) return null;
  if (payload.draft || payload.prerelease) return null;
  const releaseUrl = typeof payload.html_url === 'string' ? payload.html_url : '';
  const notes = typeof payload.body === 'string' && payload.body.trim() ? payload.body.trim() : null;
  const publishedAt = typeof payload.published_at === 'string' ? payload.published_at : null;
  const hasApkAsset = Array.isArray(payload.assets) && payload.assets.some(asset => asset.name === 'MaiMate-latest.apk');
  return { latestVersion: payload.tag_name, releaseUrl, publishedAt, notes, hasApkAsset };
}

/** 校验 GitHub Releases 最新版本并对比当前版本；仅 Android 参与更新下载。 */
export async function checkForUpdate(currentVersion: string): Promise<UpdateCheckResult> {
  const base: UpdateCheckResult = {
    status: 'error',
    currentVersion,
    latestVersion: null,
    releaseUrl: null,
    publishedAt: null,
    notes: null,
    apkUrl: null,
  };
  if (Platform.OS !== 'android') {
    return { ...base, status: 'latest' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let payload: GitHubRelease;
  try {
    const response = await fetch(GITHUB_API_URL, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'maimate-app-update-check' },
      signal: controller.signal,
    });
    if (!response.ok) {
      return { ...base, error: response.status === 403 || response.status === 429 ? '更新服务限流（请求过于频繁），请稍后再试' : `更新服务暂时不可用（${response.status}）` };
    }
    payload = await response.json() as GitHubRelease;
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return { ...base, error: aborted ? '更新检查超时' : '网络异常，无法连接更新服务' };
  } finally {
    clearTimeout(timeout);
  }

  const parsed = parseGitHubRelease(payload);
  if (!parsed) return { ...base, error: '更新信息解析失败' };

  const latestVersion = parsed.latestVersion.replace(/^v/i, '');
  const newer = compareSemver(latestVersion, currentVersion) > 0;
  return {
    status: newer ? 'update' : 'latest',
    currentVersion,
    latestVersion,
    releaseUrl: parsed.releaseUrl || null,
    publishedAt: parsed.publishedAt,
    notes: parsed.notes,
    apkUrl: parsed.hasApkAsset ? DOWNLOAD_SITE_APK_URL : null,
  };
}
