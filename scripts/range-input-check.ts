// @ts-nocheck
import assert from 'node:assert/strict';
import { parseRangeInput, applyRangeEdge, stepRangeEdge, roundToStep } from '../src/data/range-input.ts';

const p = (t) => parseRangeInput(t, 0, 15, 0.1);
assert.equal(p('13.7'), 13.7);
assert.equal(p(' 13.7 '), 13.7);
assert.equal(p('13,7'), 13.7);
assert.equal(p('１３．７'), 13.7);
assert.equal(p('13.65'), 13.7);
assert.equal(p('13.64'), 13.6);
assert.equal(p('14'), 14);
assert.equal(p('.5'), 0.5);
assert.equal(p('20'), 15);
assert.equal(p(''), null);
assert.equal(p('abc'), null);
assert.equal(p('-3'), null);
assert.equal(p('1.2.3'), null);

assert.deepEqual(applyRangeEdge([12, 13], 'lower', 13.5), [13, 13]);
assert.deepEqual(applyRangeEdge([12, 13], 'upper', 11), [12, 12]);
assert.deepEqual(applyRangeEdge([12, 13], 'lower', 12.4), [12.4, 13]);

assert.deepEqual(stepRangeEdge([12.6, 13], 'lower', 1, 0, 15, 0.1), [12.7, 13]);
assert.deepEqual(stepRangeEdge([0, 13], 'lower', -1, 0, 15, 0.1), [0, 13]);
assert.deepEqual(stepRangeEdge([12, 15], 'upper', 1, 0, 15, 0.1), [12, 15]);
assert.deepEqual(stepRangeEdge([13, 13], 'upper', -1, 0, 15, 0.1), [13, 13]);
assert.equal(roundToStep(0.1 + 0.2, 0.1), 0.3);

let r = [0, 15];
for (let i = 0; i < 137; i++) r = stepRangeEdge(r, 'lower', 1, 0, 15, 0.1);
assert.deepEqual(r, [13.7, 15]);

console.log('range-input-check: all passed');
