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

export async function resolveCoverChain(
  candidates: readonly string[],
  startIndex: number,
  resolveOne: (url: string) => Promise<string | null>,
  isCancelled: () => boolean = () => false,
): Promise<CoverChainResult> {
  for (let index = Math.max(0, startIndex); index < candidates.length; index += 1) {
    if (isCancelled()) return { uri: null, index };
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
