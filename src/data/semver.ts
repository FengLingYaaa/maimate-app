function parseSemverParts(version: string): number[] {
  const cleaned = version.trim().replace(/^v/i, '').split('-')[0].split('+')[0];
  const parts = cleaned.split('.').map(part => {
    const value = parseInt(part, 10);
    return Number.isFinite(value) ? value : 0;
  });
  while (parts.length < 3) parts.push(0);
  return parts.slice(0, 3);
}

/** 语义化版本比较：去掉 v 前缀与 prerelease，按 major.minor.patch 数值比较。 */
export function compareSemver(left: string, right: string): number {
  const a = parseSemverParts(left);
  const b = parseSemverParts(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}
