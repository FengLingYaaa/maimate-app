// @ts-nocheck
import assert from 'node:assert/strict';
import {
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  buildBackup,
  parseAndValidateBackup,
  serializeBackup,
  BackupError,
} from '../src/data/backup.ts';

const baseData = {
  settings: {
    showChinaVersion: true,
    defaultSort: { mode: 'relevance', difficultyIndex: 3 },
    showProjectedRating: true,
    defaultMusicPlatform: 'netease',
    musicAppSearchFirst: true,
    detailBoards: { rating: { order: 0, collapsed: true } },
  },
  plan: { entries: [], graveyard: [] },
  scores: { scores: [], profile: null, sync: { status: 'idle', lastSyncedAt: null, recordCount: 0, serverRating: null, changedCount: 0, message: null }, snapshots: [], changes: [] },
  bilibiliLinks: [],
  fortuneSeed: null,
};

// 导出→序列化→解析 round-trip。
const backup = buildBackup(baseData as any, '1.10.0', 'android');
assert.equal(backup.format, BACKUP_FORMAT);
assert.equal(backup.schemaVersion, BACKUP_SCHEMA_VERSION);
const roundTripped = parseAndValidateBackup(serializeBackup(backup));
assert.equal(roundTripped.summary.planEntries, 0);
assert.equal(roundTripped.summary.scores, 0);

// 未知字段被忽略，不会失败。
const withUnknown = { ...backup, data: { ...backup.data, unknownField: { deep: true } } };
assert.equal(parseAndValidateBackup(serializeBackup(withUnknown)).summary.scores, 0);

// 损坏 JSON 拒绝。
assert.throws(() => parseAndValidateBackup('{not json'), BackupError);
// 未来 schema 拒绝（提示升级）。
assert.throws(() => parseAndValidateBackup(JSON.stringify({ ...backup, schemaVersion: 99 })), /升级/);
// 旧 schema 拒绝。
assert.throws(() => parseAndValidateBackup(JSON.stringify({ ...backup, schemaVersion: 0 })), BackupError);
// 错误格式拒绝。
assert.throws(() => parseAndValidateBackup(JSON.stringify({ format: 'other', schemaVersion: 1, data: {} })), BackupError);

// 旧计划无 entryId：导入时自动补发并去重。
const legacyPlan = {
  ...backup,
  data: {
    ...backup.data,
    plan: {
      entries: [
        { songId: '1', difficultyIndex: 3, musicType: 'DX', addedAt: 1, order: 0 },
        { songId: '2', difficultyIndex: 4, musicType: 'DX', addedAt: 2, order: 1 },
      ],
      graveyard: [{ entry: { songId: '3', difficultyIndex: 0, musicType: 'SD', addedAt: 3, order: 0 }, removedAt: 5 }],
    },
  },
};
const migratedPlan = parseAndValidateBackup(serializeBackup(legacyPlan as any));
assert.equal(migratedPlan.summary.planEntries, 2);
assert.equal(new Set(migratedPlan.backup.data.plan.entries.map(e => e.entryId)).size, 2);
assert.equal(migratedPlan.backup.data.plan.graveyard.length, 1);
assert.ok(migratedPlan.backup.data.plan.graveyard[0].entry.entryId);

// 非法难度/类型/数值被剔除或拒绝。
const badPlan = {
  ...backup,
  data: {
    ...backup.data,
    plan: {
      entries: [
        { songId: '1', difficultyIndex: 99, musicType: 'DX', addedAt: 1, order: 0 },
        { songId: '2', difficultyIndex: 3, musicType: 'BAD', addedAt: 1, order: 0 },
        { songId: '3', difficultyIndex: 3, musicType: 'DX', targetScore: 999, addedAt: 1, order: 0 },
        { songId: '4', difficultyIndex: 3, musicType: 'DX', addedAt: 1, order: 0 },
      ],
      graveyard: [],
    },
  },
};
const filteredPlan = parseAndValidateBackup(serializeBackup(badPlan as any));
assert.equal(filteredPlan.summary.planEntries, 1);
assert.equal(filteredPlan.backup.data.plan.entries[0].songId, '4');

// 成绩非法记录被剔除。
const badScores = {
  ...backup,
  data: {
    ...backup.data,
    scores: {
      ...backup.data.scores,
      scores: [
        { songId: '1', type: 'DX', difficultyIndex: 3, achievement: 100.5, dxScore: 1000, importedAt: 1 },
        { songId: '2', type: 'BAD', difficultyIndex: 3, achievement: 90, importedAt: 1 },
        { songId: '3', type: 'DX', difficultyIndex: 3, achievement: 'NaN', importedAt: 1 },
      ],
    },
  },
};
const filteredScores = parseAndValidateBackup(serializeBackup(badScores as any));
assert.equal(filteredScores.summary.scores, 1);

// B 站链接：本机 coverUri 在导出时被剥离。
const withCover = {
  ...backup,
  data: {
    ...backup.data,
    bilibiliLinks: [{
      id: 'link-1',
      songId: '1',
      musicType: 'DX',
      difficultyIndex: 3,
      url: 'https://www.bilibili.com/video/BV1xx411c7mD',
      coverUri: 'file:///cache/private-cover.jpg',
      coverSourceUrl: 'https://example.com/cover.jpg',
      metadataStatus: 'success',
      remark: '',
      tags: ['手元'],
      createdAt: 1,
      updatedAt: 1,
    }],
  },
};
const coverExport = buildBackup(withCover.data as any, '1.10.0', 'android');
assert.equal(coverExport.data.bilibiliLinks[0].coverUri, undefined);
assert.equal(coverExport.data.bilibiliLinks[0].metadataStatus, 'idle');
assert.equal(coverExport.data.bilibiliLinks[0].coverSourceUrl, 'https://example.com/cover.jpg');

// 数组超限被截断到上限。
const oversized = {
  ...backup,
  data: {
    ...backup.data,
    scores: {
      ...backup.data.scores,
      scores: Array.from({ length: 21000 }, (_, i) => ({ songId: `${i}`, type: 'DX', difficultyIndex: 3, achievement: 90, importedAt: 1 })),
    },
  },
};
const capped = parseAndValidateBackup(serializeBackup(oversized as any));
assert.equal(capped.summary.scores, 20000);

console.log('Backup checks passed (round-trip, migration, validation, sanitization, caps)');
