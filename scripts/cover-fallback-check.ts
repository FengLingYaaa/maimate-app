/**
 * v1.18.0 曲绘备用源回归：
 * - getFallbackCoverUrl 的 ID 映射；
 * - getCoverCandidates：Diving-Fish 候选顺序不变，备用源只追加在后面；
 * - resolveCoverChain：前一个候选失败（null / 抛错）时会继续下一个。
 * 设 COVER_NET=1 时额外拉取线上 Diving-Fish 曲库，对每首歌的候选链实际发请求（需要网络）。
 */
import { COVER_BASE, COVER_FALLBACK_BASE, getFallbackCoverUrl } from '../src/constants/game.ts';
import { getCoverCandidates } from '../src/data/cover-resolver.ts';
import { resolveCoverChain } from '../src/data/cover-chain.ts';
import type { MusicData } from '../src/data/types.ts';
import fixture from './fixtures/music-data.json';

function fail(message: string): never {
  throw new Error(message);
}
const assert = {
  ok(condition: unknown, message = 'assertion failed'): void {
    if (!condition) fail(message);
  },
  equal(actual: unknown, expected: unknown, message?: string): void {
    if (actual !== expected) fail(message ?? `expected ${String(expected)}, got ${String(actual)}`);
  },
  deepEqual(actual: unknown, expected: unknown, message?: string): void {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) fail(message ?? `expected ${b}, got ${a}`);
  },
};

const songs = fixture as unknown as MusicData[];
const byId = new Map(songs.map(song => [song.id, song]));

// 1) ID 映射
assert.equal(getFallbackCoverUrl('44'), `${COVER_FALLBACK_BASE}/44.png`);
assert.equal(getFallbackCoverUrl('1736'), `${COVER_FALLBACK_BASE}/1736.png`);
assert.equal(getFallbackCoverUrl('10044'), `${COVER_FALLBACK_BASE}/44.png`);
assert.equal(getFallbackCoverUrl('11944'), `${COVER_FALLBACK_BASE}/1944.png`);
assert.equal(getFallbackCoverUrl('12025'), `${COVER_FALLBACK_BASE}/2025.png`);
assert.equal(getFallbackCoverUrl('100851'), null);
assert.equal(getFallbackCoverUrl('abc'), null);

// 2) 候选顺序：所有 Diving-Fish 候选在前且顺序不变，备用源在后
let checked = 0;
for (const song of songs) {
  const candidates = getCoverCandidates(song, songs);
  const firstFallback = candidates.findIndex(url => url.startsWith(COVER_FALLBACK_BASE));
  const dfPart = firstFallback < 0 ? candidates : candidates.slice(0, firstFallback);
  assert.ok(dfPart.length > 0 && dfPart.every(url => url.startsWith(COVER_BASE)), `${song.id} 首个候选应为 Diving-Fish`);
  assert.ok(candidates.slice(dfPart.length).every(url => url.startsWith(COVER_FALLBACK_BASE)), `${song.id} 备用源之后不应再出现 Diving-Fish`);
  checked += 1;
}
assert.equal(checked, songs.length);
const dx = getCoverCandidates(byId.get('11944')!, songs);
assert.deepEqual(dx, [`${COVER_BASE}/11944.png`, `${COVER_FALLBACK_BASE}/1944.png`]);
// 宴会场：同名普通曲 → 本曲 Diving-Fish → 推导 ID → 备用源用同名普通曲（281），不用推导 ID 或 6 位 ID
const banquet = getCoverCandidates(byId.get('110281')!, songs);
assert.deepEqual(banquet, [`${COVER_BASE}/00281.png`, `${COVER_BASE}/110281.png`, `${COVER_FALLBACK_BASE}/281.png`]);
const banquet2 = getCoverCandidates(byId.get('100851')!, songs);
assert.ok(!banquet2.some(url => url.startsWith(COVER_FALLBACK_BASE)), '100851 无同名普通曲，不应拼备用源');

// 3) 候选链推进
async function chainChecks() {
  const calls: string[] = [];
  const result = await resolveCoverChain(['a', 'b', 'c'], 0, async url => {
    calls.push(url);
    if (url === 'a') return null; // 模拟 404
    if (url === 'b') throw new Error('network'); // 模拟网络错误
    return `file:///${url}`;
  });
  assert.deepEqual(calls, ['a', 'b', 'c']);
  assert.deepEqual(result, { uri: 'file:///c', index: 2 });
  assert.deepEqual(await resolveCoverChain(['a', 'b'], 0, async () => null), { uri: null, index: 2 });
  assert.deepEqual(await resolveCoverChain(['a', 'b', 'c'], 1, async url => `file:///${url}`), { uri: 'file:///b', index: 1 });
  let cancelled = false;
  const partial = await resolveCoverChain(['a', 'b'], 0, async () => { cancelled = true; return null; }, () => cancelled);
  assert.equal(partial.uri, null);
  assert.equal(partial.index, 1);
}

async function networkCheck() {
  if (process.env.COVER_NET !== '1') return;
  const live = await fetch('https://www.diving-fish.com/api/maimaidxprober/music_data')
    .then(response => response.json() as Promise<MusicData[]>);
  const status = new Map<string, number>();
  const head = async (url: string) => {
    if (status.has(url)) return status.get(url)!;
    let code = 0;
    for (let attempt = 0; attempt < 3 && code === 0; attempt += 1) {
      try {
        const response = await fetch(url, { method: 'HEAD' });
        code = response.ok && (response.headers.get('content-type') ?? '').startsWith('image/') ? 200 : response.status;
      } catch { code = 0; }
    }
    status.set(url, code);
    return code;
  };
  const urls = [...new Set(live.flatMap(song => getCoverCandidates(song, live)))];
  for (let index = 0; index < urls.length; index += 24) await Promise.all(urls.slice(index, index + 24).map(head));
  const dfMissing: MusicData[] = [];
  const stillMissing: MusicData[] = [];
  for (const song of live) {
    const candidates = getCoverCandidates(song, live);
    const dfOk = candidates.filter(url => url.startsWith(COVER_BASE)).some(url => status.get(url) === 200);
    if (!dfOk) dfMissing.push(song);
    const chain = await resolveCoverChain(candidates, 0, async url => (status.get(url) === 200 ? url : null));
    if (!chain.uri) stillMissing.push(song);
  }
  console.log(`[net] 曲目 ${live.length}，Diving-Fish 全部 404 ${dfMissing.length} 首，加备用源后仍无曲绘 ${stillMissing.length} 首`);
  for (const song of dfMissing) {
    const chain = await resolveCoverChain(getCoverCandidates(song, live), 0, async url => (status.get(url) === 200 ? url : null));
    console.log(`  ${song.id}\t${song.basic_info.from}\t${song.title}\t→ ${chain.uri ?? '无'}`);
  }
}

chainChecks()
  .then(networkCheck)
  .then(() => console.log(`Cover fallback checks passed (${checked} songs)`))
  .catch(error => { console.error(error); process.exit(1); });
