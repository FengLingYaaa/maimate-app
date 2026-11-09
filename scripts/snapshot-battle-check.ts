/**
 * 快照对比回归（v1.18.0）：真实曲库 fixture。
 *  1) 增量 B50 影响与「整体重算 computeB50」逐行一致（抽样对拍）；
 *  2) 大差异（2000 / 4000 行）同步计算在 Node 下 < 2000ms（旧实现约 3.9s / 12.4s）；
 *  3) 分片异步版本与同步版本结果一致，并且确实分多片让出。
 * 失败时以非零退出码结束，供 npm run test:snapshot 门禁使用。
 */

import { buildSnapshotBattleReport, buildSnapshotBattleReportAsync } from '../src/data/snapshot-battle';
import { computeB50 } from '../src/data/b50';
import type { MusicData, PlayerScore, ScoreSnapshot } from '../src/data/types';
import fixture from './fixtures/music-data.json';

const rawData = fixture as unknown as MusicData[];

let failures = 0;
function expect(condition: boolean, label: string, detail = ''): void {
  if (condition) console.log(`PASS ${label}${detail ? ` — ${detail}` : ''}`);
  else {
    failures += 1;
    console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const charts: Array<{ songId: string; type: 'SD' | 'DX'; difficultyIndex: number }> = [];
for (const music of rawData) {
  for (let index = 0; index < music.charts.length; index += 1) charts.push({ songId: music.id, type: music.type, difficultyIndex: index });
}

function makeScores(count: number, seed: number): PlayerScore[] {
  let state = seed;
  const random = () => (state = (state * 16807) % 2147483647) / 2147483647;
  return charts.slice(0, count).map(chart => ({
    ...chart,
    achievement: Number((90 + random() * 10.9).toFixed(4)),
    dxScore: 0,
    importedAt: 0,
    serverRating: Math.floor(random() * 300),
  }));
}

function snapshot(id: string, scores: PlayerScore[]): ScoreSnapshot {
  return { id, syncedAt: id === 'base' ? 0 : 1, recordCount: scores.length, serverRating: null, scores };
}

/** 参考实现：与 v1.17 相同的「整体重算」口径。 */
function referenceImpact(target: PlayerScore[], key: string, base: PlayerScore | null): number {
  const keyOf = (score: PlayerScore) => `${score.songId}:${score.type}:${score.difficultyIndex}`;
  const replaced = target.filter(score => keyOf(score) !== key);
  if (base) replaced.push(base);
  return computeB50(rawData, target).total - computeB50(rawData, replaced).total;
}

// —— 1) 对拍：混合新增 / 提升 / 降低 / 移除 ——
{
  const target = makeScores(1500, 7);
  const base = makeScores(1300, 11).filter((_, index) => index % 9 !== 0);
  const report = buildSnapshotBattleReport(snapshot('base', base), snapshot('target', target), rawData);
  const baseByKey = new Map(base.map(score => [`${score.songId}:${score.type}:${score.difficultyIndex}`, score]));
  const sample = report.rows.filter(row => row.kind !== 'removed');
  const checked = sample.filter((_, index) => index % 7 === 0 || (_.b50Delta ?? 0) !== 0);
  let mismatches = 0;
  for (const row of checked) {
    const expected = referenceImpact(target, row.chartKey, baseByKey.get(row.chartKey) ?? null);
    if (expected !== row.b50Delta) mismatches += 1;
  }
  expect(mismatches === 0, '增量 B50 影响与整体重算一致', `对拍 ${checked.length} 行，其中 b50Delta≠0 的 ${checked.filter(row => (row.b50Delta ?? 0) !== 0).length} 行，不一致 ${mismatches}`);
}

// —— 2) 大差异性能 ——
for (const [total, diff] of [[2000, 2000], [4000, 4000], [5500, 2500]] as const) {
  const target = makeScores(total, 7);
  const base = target.slice(0, total - diff).map(score => ({ ...score }));
  const started = performance.now();
  const report = buildSnapshotBattleReport(snapshot('base', base), snapshot('target', target), rawData);
  const elapsed = performance.now() - started;
  expect(elapsed < 2000 && report.rows.length === diff, `成绩 ${total} 条 / 差异 ${diff} 行 < 2000ms`, `${elapsed.toFixed(0)}ms，${report.rows.length} 行`);
}

// —— 3) 分片异步版本 ——
void (async () => {
  const target = makeScores(4000, 3);
  const base = makeScores(1000, 5);
  let yields = 0;
  const started = performance.now();
  const asyncReport = await buildSnapshotBattleReportAsync(snapshot('base', base), snapshot('target', target), rawData, {
    chunkSize: 400,
    yieldFn: async () => { yields += 1; },
  });
  const elapsed = performance.now() - started;
  const syncReport = buildSnapshotBattleReport(snapshot('base', base), snapshot('target', target), rawData);
  const same = asyncReport !== null
    && asyncReport.rows.length === syncReport.rows.length
    && asyncReport.rows.every((row, index) => row.chartKey === syncReport.rows[index].chartKey && row.b50Delta === syncReport.rows[index].b50Delta);
  expect(same && yields >= 10, '分片异步与同步结果一致且分片让出', `${asyncReport?.rows.length ?? 0} 行，让出 ${yields} 次，${elapsed.toFixed(0)}ms`);
  let cancelled = false;
  const cancelledReport = await buildSnapshotBattleReportAsync(snapshot('base', base), snapshot('target', target), rawData, {
    yieldFn: async () => { cancelled = true; },
    isCancelled: () => cancelled,
  });
  expect(cancelledReport === null, '取消后返回 null（页面切走不再写状态）');

  if (failures > 0) {
    console.error(`snapshot-battle-check: ${failures} failed`);
    process.exit(1);
  }
  console.log('snapshot-battle-check: all passed');
})();
