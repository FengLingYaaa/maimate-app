const DEFAULT_EXTENSION = '.jpg';
const LEGACY_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

function hashCoverSource(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function getBilibiliCoverExtension(coverUrl: string): string {
  const path = coverUrl.split(/[?#]/, 1)[0];
  const extension = path.match(/\.(png|webp|jpeg|jpg)$/i)?.[1];
  return extension ? `.${extension.toLowerCase()}` : DEFAULT_EXTENSION;
}

export function getBilibiliCoverCacheFilename(linkId: string, coverUrl: string): string {
  return `${encodeURIComponent(linkId)}-${hashCoverSource(coverUrl)}${getBilibiliCoverExtension(coverUrl)}`;
}

export function isBilibiliCoverCacheFileForLink(fileName: string, linkId: string): boolean {
  const encodedId = encodeURIComponent(linkId);
  return LEGACY_EXTENSIONS.some(extension => fileName === `${encodedId}${extension}`)
    || fileName.startsWith(`${encodedId}-`);
}
