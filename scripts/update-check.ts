// @ts-nocheck
import assert from 'node:assert/strict';
import { compareSemver } from '../src/data/semver.ts';

assert.equal(compareSemver('1.10.0', '1.9.9') > 0, true);
assert.equal(compareSemver('1.10.0', '1.10.0'), 0);
assert.equal(compareSemver('1.9.0', '1.10.0') < 0, true);
assert.equal(compareSemver('2.0.0', '1.99.99') > 0, true);
assert.equal(compareSemver('1.10.0', '1.9') > 0, true);
assert.equal(compareSemver('v1.10.0', '1.9.9') > 0, true);
assert.equal(compareSemver('1.10.0-beta', '1.9.9') > 0, true);
assert.equal(compareSemver('1.10.0-beta', '1.10.0') , 0);
assert.equal(compareSemver('1.0.0', '1.0.0-alpha'), 0);

console.log('Update checks passed (semver comparison)');
