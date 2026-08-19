import * as FileSystem from 'expo-file-system/legacy';
import { getBilibiliCoverCacheFilename, isBilibiliCoverCacheFileForLink } from './bilibili-cover-cache';

export interface BilibiliMetadata {
  canonicalUrl?: string;
  title?: string;
  coverUrl?: string;
}

function extractBvid(value: string): string | undefined {
  const match = value.match(/(?:video\/|bvid=)(BV[a-zA-Z0-9]+)/i);
  return match?.[1];
}

function decodeHtml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function normalizeCoverUrl(value: string | undefined): string | undefined {
  const candidate = value?.trim();
  if (!candidate) return undefined;
  if (candidate.startsWith('//')) return `https:${candidate}`;
  if (candidate.startsWith('http://')) return `https://${candidate.slice('http://'.length)}`;
  return /^https:\/\//i.test(candidate) ? candidate : undefined;
}

function readMeta(html: string, property: string): string | undefined {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i'))
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, 'i'));
  return match?.[1] ? decodeHtml(match[1]) : undefined;
}

async function readBilibiliApi(bvid: string): Promise<BilibiliMetadata> {
  const response = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`metadata http ${response.status}`);
  const payload = await response.json() as {
    code?: number;
    data?: { title?: string; pic?: string; bvid?: string };
  };
  if (payload.code !== 0 || !payload.data) throw new Error('metadata unavailable');
  return {
    canonicalUrl: payload.data.bvid ? `https://www.bilibili.com/video/${payload.data.bvid}` : undefined,
    title: payload.data.title?.trim() || undefined,
    coverUrl: normalizeCoverUrl(payload.data.pic),
  };
}

/** Fetch metadata only for the single user-provided video; never downloads video content. */
export async function fetchBilibiliMetadata(url: string): Promise<BilibiliMetadata> {
  let finalUrl = url;
  let html = '';
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: { Accept: 'text/html,application/xhtml+xml' },
    });
    finalUrl = response.url || url;
    if (!extractBvid(finalUrl)) html = await response.text();
  } catch {
    // The public API attempt below can still work for a BV URL without a redirect.
  }

  const bvid = extractBvid(finalUrl) || extractBvid(url);
  if (bvid) {
    try {
      return await readBilibiliApi(bvid);
    } catch {
      // Fall through to page metadata or the locally parsed share title.
    }
  }

  const title = readMeta(html, 'og:title') || readMeta(html, 'twitter:title');
  const coverUrl = normalizeCoverUrl(readMeta(html, 'og:image') || readMeta(html, 'twitter:image'));
  if (!title && !coverUrl) throw new Error('metadata unavailable');
  return { canonicalUrl: finalUrl, title, coverUrl };
}

export async function downloadBilibiliCover(linkId: string, coverUrl: string): Promise<string | undefined> {
  const cacheDirectory = FileSystem.cacheDirectory;
  if (!cacheDirectory || !/^https:\/\//i.test(coverUrl)) return undefined;
  const directory = `${cacheDirectory}bilibili-covers/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const destination = `${directory}${getBilibiliCoverCacheFilename(linkId, coverUrl)}`;
  const existing = await FileSystem.getInfoAsync(destination);
  if (existing.exists) return destination;
  const result = await FileSystem.downloadAsync(coverUrl, destination);
  return result.status >= 200 && result.status < 300 ? result.uri : undefined;
}

export async function removeBilibiliCoversForLink(linkId: string): Promise<void> {
  const cacheDirectory = FileSystem.cacheDirectory;
  if (!cacheDirectory) return;
  const directory = `${cacheDirectory}bilibili-covers/`;
  try {
    const files = await FileSystem.readDirectoryAsync(directory);
    await Promise.all(files
      .filter(fileName => isBilibiliCoverCacheFileForLink(fileName, linkId))
      .map(fileName => FileSystem.deleteAsync(`${directory}${fileName}`, { idempotent: true })));
  } catch {
    // Cache cleanup is best effort and must not block editing or deleting the link.
  }
}

export async function removeBilibiliCover(uri: string | undefined): Promise<void> {
  if (!uri || !FileSystem.cacheDirectory || !uri.startsWith(`${FileSystem.cacheDirectory}bilibili-covers/`)) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Cache cleanup is best effort and must not block deleting the link.
  }
}
