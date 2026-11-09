/**
 * Rating 历史回归（v1.18.0）：记录条件、去重、统计。
 */

import { appendRatingPoint, computeRatingHistoryStats, parseRatingHistory, shouldRecordPoint, type RatingHistoryFile, type RatingHistoryPoint } from '../src/data/rating-history';

let failures = 0;
function expect(condition: boolean, label: string, detail = ''): void {
  if (condition) console.log(`PASS ${label}${detail ? ` — ${detail}` : ''}`);
  else {
    failures += 1;
    console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const point = (at: string, totalRating: number): RatingHistoryPoint => ({ at, totalRating, b50Rating: totalRating - 3, songCount: 800 });
let history: RatingHistoryFile = { points: [] };

const first = appendRatingPoint(history, point('2026-11-01T12:00:00+08:00', 15000));
expect(first !== null && first.points.length === 1 && first.updatedAt === '2026-11-01T12:00:00+08:00', '第一个点写入');
history = first!;
expect(appendRatingPoint(history, point('2026-11-01T20:00:00+08:00', 15000)) === null, '同一天总 Rating 没变 → 不记');
const sameDayChanged = appendRatingPoint(history, point('2026-11-01T21:00:00+08:00', 15012));
expect(sameDayChanged !== null && sameDayChanged.points.length === 2, '同一天总 Rating 变了 → 记');
history = sameDayChanged!;
const nextDay = appendRatingPoint(history, point('2026-11-02T09:00:00+08:00', 15012));
expect(nextDay !== null, '第二天即使总 Rating 没变也记一个点');
history = nextDay!;
expect(!shouldRecordPoint(history.points, { at: 'bad', totalRating: 1, b50Rating: 1, songCount: 1 }), '非法点不记');

for (const [at, rating] of [['2026-11-05T10:00:00+08:00', 15040], ['2026-11-09T10:00:00+08:00', 15080]] as const) {
  history = appendRatingPoint(history, point(at, rating)) ?? history;
}
const stats = computeRatingHistoryStats(history.points, Date.parse('2026-11-09T12:00:00+08:00'));
expect(stats.max === 15080 && stats.min === 15000, '最高 / 最低', `${stats.max} / ${stats.min}`);
expect(stats.change7d === 15080 - 15012, '7 日变化 = 最新 − 7 天前最后一个点', String(stats.change7d));
expect(stats.change30d === 80, '30 日变化（历史不足 30 天时与最早点比）', String(stats.change30d));
const single = computeRatingHistoryStats([point('2026-11-09T10:00:00+08:00', 15000)]);
expect(single.count === 1 && single.change7d === null && single.max === 15000, '只有 1 个点：变化为 —');

const roundTrip = parseRatingHistory(JSON.stringify(history));
expect(roundTrip.points.length === history.points.length, '存储格式 { points, updatedAt } 往返一致');
expect(parseRatingHistory('{oops').points.length === 0, '损坏数据回退为空历史');

if (failures > 0) {
  console.error(`rating-history-check: ${failures} failed`);
  process.exit(1);
}
console.log('rating-history-check: all passed');
