/** 纯函数：统一缓存目录 URI 的分类口径，供运行时代码和 Node 回归脚本复用。 */
function normalizeDirectoryUri(uri: string): string {
  return uri.replace(/\\/g, '/').replace(/\/+$/, '').toLocaleLowerCase();
}

export function isCacheDirectoryNamed(uri: string, name: string): boolean {
  return normalizeDirectoryUri(uri).endsWith(`/${name.toLocaleLowerCase()}`);
}

/** covers 根目录及其子目录只能归入曲绘缓存，不能重复算入其它缓存。 */
export function isCoversCacheDirectory(uri: string): boolean {
  return isCacheDirectoryNamed(uri, 'covers');
}
