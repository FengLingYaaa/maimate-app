/**
 * 曲绘候选链（纯函数，node 可测）。
 *
 * v1.18.0：从 startIndex 起依次解析候选 URL，某个候选解析失败（下载 404 / 网络错误 → null 或抛错）
 * 就继续下一个，直到拿到本地 URI 或候选用尽。修复此前 CoverImage 下载失败后停在第一个候选、
 * 备用源永远走不到的问题。
 */
export interface CoverChainResult {
  uri: string | null;
  /** 命中候选的下标；全部失败时为 candidates.length。 */
  index: number;
}

/**
 * v1.19.0：曲绘 404 负缓存（仅内存，本次启动内有效）。
 *
 * - 某个候选 URL 下载返回 404/410 时由 cover-cache.ts 记录；之后的候选链直接跳过它，
 *   缺图的歌（主源 Diving-Fish 404）不再每次挂载都先撞一次 404，直接走 LXNS 备用源。
 * - 断网、超时、5xx 不记录（可能是临时故障，允许重试）。
 * - 重启应用即清空；clearMissingCoverUrls()（设置页「清理曲绘缓存」也会调用）后会重新请求主源。
 */
const missingCoverUrls = new Set<string>();

export type CoverDownloadStatusKind = 'ok' | 'missing' | 'retryable';

/** 下载 HTTP 状态分类：200 成功；404/410 视为「源上确实没有这张图」；其它都可重试。 */
export function classifyCoverDownloadStatus(status: number): CoverDownloadStatusKind {
  if (status === 200) return 'ok';
  if (status === 404 || status === 410) return 'missing';
  return 'retryable';
}

export function markCoverUrlMissing(url: string): void {
  if (url) missingCoverUrls.add(url);
}

export function isCoverUrlMissing(url: string): boolean {
  return missingCoverUrls.has(url);
}

/** 测试与诊断用 getter：本次启动内记录的 404 URL（按记录顺序）。 */
export function getMissingCoverUrls(): readonly string[] {
  return [...missingCoverUrls];
}

export function clearMissingCoverUrls(): void {
  missingCoverUrls.clear();
}

export async function resolveCoverChain(
  candidates: readonly string[],
  startIndex: number,
  resolveOne: (url: string) => Promise<string | null>,
  isCancelled: () => boolean = () => false,
): Promise<CoverChainResult> {
  for (let index = Math.max(0, startIndex); index < candidates.length; index += 1) {
    if (isCancelled()) return { uri: null, index };
    // v1.19.0：本次启动内已确认 404 的候选直接跳过，不再发请求。
    if (isCoverUrlMissing(candidates[index])) continue;
    let uri: string | null = null;
    try {
      uri = await resolveOne(candidates[index]);
    } catch {
      uri = null;
    }
    if (uri) return { uri, index };
  }
  return { uri: null, index: candidates.length };
}
