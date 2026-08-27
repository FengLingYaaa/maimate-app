import { Platform } from 'react-native';
import { compareSemver } from '../data/semver';

const GITHUB_API_URL = 'https://api.github.com/repos/FengLingYaaa/maimate-app/releases/latest';
const DOWNLOAD_SITE_APK_URL = 'https://maimate.flya.ccwu.cc/MaiMate-latest.apk';
const REQUEST_TIMEOUT_MS = 15000;

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

export { compareSemver } from '../data/semver';

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
      return { ...base, error: response.status === 403 || response.status === 429 ? '更新检查过于频繁，请稍后再试' : `更新服务暂时不可用（${response.status}）` };
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
