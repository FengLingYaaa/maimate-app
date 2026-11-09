/**
 * v1.18.0 曲绘备用源回归：
 * - getFallbackCoverUrl 的 ID 映射；
 * - getCoverCandidates：Diving-Fish 候选顺序不变，备用源只追加在后面；
 * - resolveCoverChain：前一个候选失败（null / 抛错）时会继续下一个。
 * 设 COVER_NET=1 时额外拉取线上 Diving-Fish 曲库，对每首歌的候选链实际发请求（需要网络）。
 */
import { COVER_BASE, COVER_FALLBACK_BASE, getFallbackCoverUrl } from '../src/constants/game.ts';
import { getCoverCandidates } from '../src/data/cover-resolver.ts';
import { classifyCoverDownloadStatus, clearMissingCoverUrls, getMissingCoverUrls, isCoverUrlMissing, markCoverUrlMissing, resolveCoverChain } from '../src/data/cover-chain.ts';
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

/** v1.19.0：404 负缓存——主源 404 后同一次启动内直接走备用源；清空后重新请求主源。 */
async function negativeCacheChecks(): Promise<void> {
  clearMissingCoverUrls();
  assert.equal(classifyCoverDownloadStatus(200), 'ok');
  assert.equal(classifyCoverDownloadStatus(404), 'missing');
  assert.equal(classifyCoverDownloadStatus(410), 'missing');
  assert.equal(classifyCoverDownloadStatus(500), 'retryable');
  assert.equal(classifyCoverDownloadStatus(0), 'retryable');
  const primary = 'https://primary.example/1.png';
  const fallback = 'https://fallback.example/1.png';
  const requested: string[] = [];
  // 模拟 cover-cache：主源 404 时记入负缓存。
  const resolveOne = async (url: string) => {
    requested.push(url);
    if (url === primary) {
      if (classifyCoverDownloadStatus(404) === 'missing') markCoverUrlMissing(url);
      return null;
    }
    return `file://${url}`;
  };
  const first = await resolveCoverChain([primary, fallback], 0, resolveOne);
  assert.equal(first.index, 1);
  assert.deepEqual(requested, [primary, fallback], '第一次：先撞主源 404，再走备用源');
  assert.ok(isCoverUrlMissing(primary));
  assert.deepEqual(getMissingCoverUrls(), [primary]);
  requested.length = 0;
  const second = await resolveCoverChain([primary, fallback], 0, resolveOne);
  assert.equal(second.uri, `file://${fallback}`);
  assert.deepEqual(requested, [fallback], '第二次：跳过已知 404 的主源，不再请求');
  // 断网（抛错）/5xx 不记入。
  const flaky = 'https://primary.example/2.png';
  await resolveCoverChain([flaky], 0, async () => { throw new Error('network'); });
  assert.equal(isCoverUrlMissing(flaky), false, '网络错误不进负缓存');
  // 清空后重新请求主源。
  clearMissingCoverUrls();
  assert.deepEqual(getMissingCoverUrls(), []);
  requested.length = 0;
  await resolveCoverChain([primary, fallback], 0, resolveOne);
  assert.deepEqual(requested, [primary, fallback], '清空负缓存后会重新请求主源');
  clearMissingCoverUrls();
}

chainChecks()
  .then(negativeCacheChecks)
  .then(networkCheck)
  .then(() => console.log(`Cover fallback checks passed (${checked} songs)`))
  .catch(error => { console.error(error); process.exit(1); });
