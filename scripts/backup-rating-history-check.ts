// @ts-nocheck
/**
 * v1.19.0 回归：Rating 历史（与自定义别名）纳入备份。
 * 覆盖：往返、旧格式（无字段）导入、超限截断、单字段校验失败不影响其它字段、恢复失败滚回。
 */
import assert from 'node:assert/strict';
import {
  BACKUP_LIMITS,
  BACKUP_SCHEMA_VERSION,
  applyRestoreTransaction,
  buildBackup,
  buildRestorePairs,
  parseAndValidateBackup,
  serializeBackup,
} from '../src/data/backup.ts';

const KEYS = {
  planData: 'plan', planGraveyard: 'grave', settings: 'settings', scoreData: 'score', scoreSnapshots: 'snaps',
  scoreChanges: 'changes', bilibiliLinks: 'links', fortuneSeed: 'seed', ratingHistory: 'rh', customAliases: 'ca',
};

const baseData = {
  settings: { showChinaVersion: true, defaultSort: { mode: 'relevance', difficultyIndex: 3 }, showProjectedRating: true, defaultMusicPlatform: 'netease', musicAppSearchFirst: true, detailBoards: {} },
  plan: { entries: [{ songId: '100', difficultyIndex: 3, musicType: 'SD', addedAt: 1, order: 0 }], graveyard: [] },
  scores: { scores: [{ songId: '100', type: 'SD', difficultyIndex: 3, achievement: 99.5, dxScore: 1, importedAt: 1 }], profile: null, sync: { status: 'idle', lastSyncedAt: null, recordCount: 0, serverRating: null, changedCount: 0, message: null }, snapshots: [], changes: [] },
  bilibiliLinks: [],
  fortuneSeed: null,
};

const point = (day: number, rating: number) => ({ at: new Date(Date.UTC(2026, 0, 1) + day * 86400000).toISOString(), totalRating: rating, b50Rating: rating, songCount: 100 });

// 1) 往返：schema 版本不变，历史与别名完整保留。
const history = [point(0, 15000), point(1, 15010), point(2, 15023)];
const built = buildBackup({ ...baseData, ratingHistory: history, customAliases: { '100': ['测试别名'] } }, '1.19.0', 'android');
assert.equal(built.schemaVersion, BACKUP_SCHEMA_VERSION);
assert.equal(BACKUP_SCHEMA_VERSION, 1, '不升 schema 版本');
const round = parseAndValidateBackup(serializeBackup(built));
assert.equal(round.summary.ratingHistoryPoints, 3);
assert.deepEqual(round.backup.data.ratingHistory.map(p => p.totalRating), [15000, 15010, 15023]);
assert.equal(round.summary.customAliases, 1);
const pairs = Object.fromEntries(buildRestorePairs(round.backup, KEYS, 0));
assert.ok(pairs.rh, '字段存在 → 写入 Rating 历史键（整体替换）');
assert.equal(JSON.parse(pairs.rh).points.length, 3);
assert.deepEqual(JSON.parse(pairs.ca).bySongId, { '100': ['测试别名'] });

// 2) 旧格式（无 ratingHistory 字段）仍可导入；恢复时不写该键 → 保留本机历史。
const legacy = buildBackup(baseData, '1.18.0', 'android');
assert.equal('ratingHistory' in legacy.data, false);
const legacyParsed = parseAndValidateBackup(serializeBackup(legacy));
assert.equal(legacyParsed.summary.ratingHistoryPoints, null);
assert.equal(legacyParsed.summary.customAliases, null);
assert.equal(legacyParsed.summary.scores, 1);
const legacyPairs = Object.fromEntries(buildRestorePairs(legacyParsed.backup, KEYS, 0));
assert.equal(legacyPairs.rh, undefined, '旧备份不覆盖本机 Rating 历史');
assert.equal(legacyPairs.ca, undefined);

// 3) 超限截断：保留最新的 3000 条，带 warning，不抛错。
const many = Array.from({ length: BACKUP_LIMITS.ratingHistory + 250 }, (_, index) => point(index, 10000 + index));
const big = parseAndValidateBackup(serializeBackup({ ...legacy, data: { ...legacy.data, ratingHistory: many } }));
assert.equal(big.summary.ratingHistoryPoints, BACKUP_LIMITS.ratingHistory);
assert.equal(big.backup.data.ratingHistory[0].totalRating, 10250, '截断丢弃最旧的点');
assert.equal(big.backup.data.ratingHistory.at(-1).totalRating, 10000 + BACKUP_LIMITS.ratingHistory + 249);
assert.ok(big.summary.warnings.some(text => text.includes('截断')));

// 4) 单字段校验失败：不影响其它字段。
const badType = parseAndValidateBackup(serializeBackup({ ...legacy, data: { ...legacy.data, ratingHistory: 'oops', customAliases: [1, 2] } }));
assert.equal(badType.summary.ratingHistoryPoints, null, '坏字段被跳过');
assert.equal(badType.summary.customAliases, null);
assert.equal(badType.summary.scores, 1, '成绩照常导入');
assert.equal(badType.summary.planEntries, 1, '计划照常导入');
assert.equal(badType.summary.warnings.length, 2);
const allBad = parseAndValidateBackup(serializeBackup({ ...legacy, data: { ...legacy.data, ratingHistory: [{ at: 'x' }, null] } }));
assert.equal(allBad.summary.ratingHistoryPoints, null);
const someBad = parseAndValidateBackup(serializeBackup({ ...legacy, data: { ...legacy.data, ratingHistory: [point(0, 1), { at: 'bad' }, point(0, 2)] } }));
assert.equal(someBad.summary.ratingHistoryPoints, 1, '坏点丢弃、同一时刻去重');
assert.equal(someBad.backup.data.ratingHistory[0].totalRating, 2);
const emptyArr = parseAndValidateBackup(serializeBackup({ ...legacy, data: { ...legacy.data, ratingHistory: [] } }));
assert.equal(emptyArr.summary.ratingHistoryPoints, 0, '空数组是合法字段：整体替换为空');
// 自定义别名：空/超长被过滤。
const aliasClean = parseAndValidateBackup(serializeBackup({ ...legacy, data: { ...legacy.data, customAliases: { '100': ['  ', 'x'.repeat(41), 'ok', 'OK'], abc: ['bad id'] } } }));
assert.deepEqual(aliasClean.backup.data.customAliases, { '100': ['ok'] });

void (async () => {
// 5) 恢复失败滚回：multiSet 第一次抛错 → 回到原值，原本不存在的键被删除。
function fakeStorage(initial: Record<string, string>, failOn: number) {
  const store = { ...initial };
  let setCalls = 0;
  return {
    store,
    async multiGet(keys) { return keys.map(key => [key, key in store ? store[key] : null]); },
    async multiSet(pairs) {
      setCalls += 1;
      for (const [key, value] of pairs) store[key] = value;
      if (setCalls === failOn) throw new Error('disk full');
    },
    async multiRemove(keys) { for (const key of keys) delete store[key]; },
  };
}
const storage = fakeStorage({ plan: 'OLD_PLAN', rh: 'OLD_RH' }, 1);
await assert.rejects(() => applyRestoreTransaction(storage, Object.values(KEYS), buildRestorePairs(round.backup, KEYS, 0), ['seed']), /disk full/);
assert.equal(storage.store.plan, 'OLD_PLAN');
assert.equal(storage.store.rh, 'OLD_RH');
assert.equal(storage.store.score, undefined, '恢复前不存在的键在滚回后被删除');
// 成功路径：写入并删除 removeKeys。
const ok = fakeStorage({ seed: 'S', rh: 'OLD_RH' }, -1);
await applyRestoreTransaction(ok, Object.values(KEYS), buildRestorePairs(legacyParsed.backup, KEYS, 0), ['seed']);
assert.equal(ok.store.seed, undefined);
assert.equal(ok.store.rh, 'OLD_RH', '旧备份恢复后本机历史仍在');

console.log('backup rating-history checks passed');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
