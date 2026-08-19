import assert from 'node:assert/strict';
import { calculateRating, getRatingFactor } from '../src/data/rating.ts';

const coefficientCases = [
  [0, 0],
  [9.9999, 0],
  [10, 1.6],
  [19.9999, 1.6],
  [20, 3.2],
  [40, 6.4],
  [50, 8.0],
  [60, 9.6],
  [70, 11.2],
  [75, 12.0],
  [79.9998, 12.0],
  [79.9999, 12.8],
  [80, 13.6],
  [90, 15.2],
  [94, 16.8],
  [96.9998, 16.8],
  [96.9999, 17.6],
  [97, 20.0],
  [98, 20.3],
  [98.9998, 20.3],
  [98.9999, 20.6],
  [99, 20.8],
  [99.5, 21.1],
  [99.9998, 21.1],
  [99.9999, 21.4],
  [100, 21.6],
  [100.4999, 22.2],
  [100.5, 22.4],
];

for (const [achievement, expected] of coefficientCases) {
  assert.equal(getRatingFactor(achievement), expected, `coefficient at ${achievement}`);
}

assert.equal(calculateRating(14.8, 33.3556), Math.floor(14.8 * 0.333556 * 4.8));
assert.equal(calculateRating(14.8, 101), calculateRating(14.8, 100.5));
assert.equal(calculateRating(undefined, 100), null);
assert.equal(calculateRating(14.8, Number.NaN), null);

console.log(`rating checks passed (${coefficientCases.length} coefficient boundaries)`);
