// @ts-nocheck
import assert from 'node:assert/strict';
import { parseBilibiliShare, normalizeBilibiliVideoUrl } from '../src/data/bilibili-links.ts';
import { getMusicPlatformAppUrls, getMusicPlatformSearchUrl } from '../src/data/music-platforms.ts';
import { getChinaVersionOptions, getVersionOptions } from '../src/data/version-catalog.ts';
import { expandVersionFilterValue, Versions } from '../src/constants/game.ts';
import {
  buildPlateEntries,
  getPlateMask,
  getPlateChinaVersionOptions,
  getPlateLegacyVersionOptions,
  summarizePlates,
  summarizePlatesByDifficulty,
  mergePlateRows,
  filterEntriesByMinLevel,
  PLATE_BITS,
} from '../src/data/plates.ts';
import { applyDragWithPinGroups, canDragPlanRows, compareByPinThenOrder, pinGroupOf } from '../src/data/plan-order.ts';
import { migratePlanEntryIds, computeAchievedIds, normalizePlanEntries, reorderPlanEntriesById, resolvePlanMusic } from '../src/data/plan-entries.ts';
import { computeB50, computeB50Gain, B35_SIZE, B15_SIZE } from '../src/data/b50.ts';
import { computeFit50, sortFit50Entries } from '../src/data/fit50.ts';
import { computeAp50, AP50_SIZE } from '../src/data/ap50.ts';
import { buildSnapshotBattleReport } from '../src/data/snapshot-battle.ts';
import { normalizeSnapshotLimit } from '../src/data/settings-defaults.ts';
import { getCoverCacheFilename, isCoverCacheFileForSong } from '../src/data/cover-cache-names.ts';
import { buildScoresCsv, CSV_HEADER } from '../src/data/scores-csv-core.ts';
import { getBilibiliVideoAppUrls } from '../src/data/bilibili-search.ts';
import { extractBilibiliVideoId, isBilibiliShortLink } from '../src/data/bilibili-search.ts';
import { av2bv, bv2av } from '../src/data/bilibili-bvid.ts';
import { computeAchievementLoss, JUDGMENT_KEYS } from '../src/data/achievement-loss.ts';
import { generateFortune } from '../src/data/fortune.ts';
import { buildScoreIndex, getMusicScore, matchesMusic, sortMusicItems } from '../src/data/music-list.ts';
import {
  getBilibiliCoverCacheFilename,
  getBilibiliCoverExtension,
  isBilibiliCoverCacheFileForLink,
  isLegacyBilibiliCoverUri,
} from '../src/data/bilibili-cover-cache.ts';

const share = parseBilibiliShare('【第一人称maimai/舞萌 Trick tear 紫14.4 sss+ 手元-哔哩哔哩】 https://b23.tv/TdQjEN6');
assert.equal(share?.url, 'https://b23.tv/TdQjEN6');
assert.equal(share?.title, '第一人称maimai/舞萌 Trick tear 紫14.4 sss+ 手元');
assert.equal(normalizeBilibiliVideoUrl(share?.url || ''), 'https://b23.tv/TdQjEN6');

assert.match(getMusicPlatformAppUrls('netease', '晴天', '周杰伦')[0], /^orpheus:\/\//);
assert.match(getMusicPlatformAppUrls('qq', '晴天')[0], /^qqmusic:\/\//);
assert.match(getMusicPlatformAppUrls('kugou', '晴天')[0], /^kugou:\/\//);
assert.match(getMusicPlatformSearchUrl('netease', '晴天'), /^https:\/\//);

const coverLinkId = 'bilibili-link-1';
const coverA = 'https://i0.hdslb.com/bfs/archive/cover-a.jpg?x=1';
const coverB = 'https://i0.hdslb.com/bfs/archive/cover-b.jpg?x=2';
assert.notEqual(getBilibiliCoverCacheFilename(coverLinkId, coverA), getBilibiliCoverCacheFilename(coverLinkId, coverB));
assert.equal(getBilibiliCoverCacheFilename(coverLinkId, coverA), getBilibiliCoverCacheFilename(coverLinkId, coverA));
assert.notEqual(getBilibiliCoverCacheFilename(coverLinkId, coverA, 1), getBilibiliCoverCacheFilename(coverLinkId, coverA, 2));
assert.equal(getBilibiliCoverExtension('https://example.com/cover.webp?width=400'), '.webp');
assert.equal(isBilibiliCoverCacheFileForLink(`${encodeURIComponent(coverLinkId)}.jpg`, coverLinkId), true);
assert.equal(isBilibiliCoverCacheFileForLink(`${encodeURIComponent(coverLinkId)}.webp`, coverLinkId), true);
assert.equal(isLegacyBilibiliCoverUri(`file:///cache/bilibili-covers/${encodeURIComponent(coverLinkId)}.webp`, coverLinkId), true);
assert.equal(isLegacyBilibiliCoverUri(getBilibiliCoverCacheFilename(coverLinkId, coverA, 1), coverLinkId), false);
assert.equal(isBilibiliCoverCacheFileForLink(getBilibiliCoverCacheFilename(coverLinkId, coverA), coverLinkId), true);
assert.equal(isBilibiliCoverCacheFileForLink('other-link-deadbeef.jpg', coverLinkId), false);

const chart = { notes: [1, 1, 1, 1], charter: 'tester' };
const makeMusic = (id, from, type = 'DX', genre = '流行&动漫') => ({
  id, type, title: `Song ${id}`, ds: [1, 2, 3, 14.5, 14.5], level: ['1', '2', '3', '14', '14+'], cids: [1, 2, 3, 4, 5],
  charts: [chart, chart, chart, chart, chart],
  basic_info: { title: `Song ${id}`, artist: 'Artist', genre, bpm: 120, release_date: '', from, is_new: false },
});
const rawData = [makeMusic('1', 'maimai でらっくす Splash'), makeMusic('2', 'maimai PiNK'), makeMusic('3', 'maimai でらっくす')];
const japan = getVersionOptions(rawData);
const china = getChinaVersionOptions(rawData);
// v1.7.0：无独立数据的 Splash 与 Splash PLUS 合并为一个标签。
assert.equal(japan.find(option => option.label === 'maimai でらっくす Splash+PLUS')?.rawValues?.length, 2);
assert.equal(japan.some(option => option.label === 'maimai でらっくす Splash'), false);
assert.equal(china.find(option => option.rawValue === '舞萌DX 2021')?.rawValues?.[0], 'maimai でらっくす Splash');
assert.equal(china.some(option => option.label === '舞萌DX'), true);

// v1.7.0：版本筛选值展开匹配——合并标签命中组内任意原始版本名。
assert.deepEqual(expandVersionFilterValue('maimai でらっくす Splash+PLUS'), ['maimai でらっくす Splash', 'maimai でらっくす Splash PLUS']);
assert.deepEqual(expandVersionFilterValue('maimai PiNK'), ['maimai PiNK']);
assert.equal(matchesMusic(rawData[0], { version: 'maimai でらっくす Splash+PLUS' }), true);
assert.equal(matchesMusic(rawData[1], { version: 'maimai でらっくす Splash+PLUS' }), false);

// v1.7.0：ALL FiNALE 无曲目数据，从版本常量中移除。
assert.equal(Versions.some(version => /FiNALE/i.test(version) && version !== 'maimai FiNALE'), false);

assert.equal(canDragPlanRows({}), true);
assert.equal(canDragPlanRows({ titleSearch: 'Song 1' }), false);
assert.equal(canDragPlanRows({ sort: { mode: 'titleAsc' } }), false);
assert.equal(canDragPlanRows({ genre: '流行&动漫' }), false);
assert.equal(canDragPlanRows({ difficulty: 3 }), false);
assert.equal(canDragPlanRows({ version: ['SD'] }), false);

const score = { songId: '1', type: 'DX', difficultyIndex: 3, achievement: 100.5, dxScore: 1000, fc: 'ap', fs: 'fsd', importedAt: 1 };
assert.equal(getPlateMask(score), PLATE_BITS.FC | PLATE_BITS.SSS | PLATE_BITS.FSD | PLATE_BITS.AP);
const entries = buildPlateEntries(rawData, [score]);
const summary = summarizePlates(entries.filter(entry => entry.music.id === '1' && entry.difficultyIndex === 3));
assert.deepEqual(summary, { total: 1, counts: { FC: 1, SSS: 1, FSD: 1, AP: 1 } });
assert.equal(getPlateChinaVersionOptions(entries).includes('舞萌DX'), true);

// v1.7.0：牌子页版本维度拆分——原始版本只保留旧世代，DX 代交给国区维度。
const legacyOptions = getPlateLegacyVersionOptions(entries);
assert.equal(legacyOptions.includes('全部'), true);
assert.equal(legacyOptions.includes('maimai PiNK'), true);
assert.equal(legacyOptions.some(value => value.startsWith('maimai でらっくす')), false);

// v1.7.0：分难度汇总、多难度合并行、14+ 批量筛选。
const byDifficulty = summarizePlatesByDifficulty(entries.filter(entry => entry.music.id === '1'));
assert.deepEqual(byDifficulty.map(row => row.difficultyIndex), [0, 1, 2, 3, 4]);
const merged = mergePlateRows(entries.filter(entry => entry.music.id === '1'));
assert.equal(merged.length, 1);
assert.equal(merged[0].charts.length, 5);
assert.deepEqual(merged[0].charts.map(c => c.difficultyIndex), [0, 1, 2, 3, 4]);
const fourteenPlus = filterEntriesByMinLevel(entries.filter(entry => entry.music.id === '1'), 14);
assert.deepEqual(fourteenPlus.map(e => e.difficultyIndex), [3, 4]);

// v1.7.0：置顶置底分组约束。
const baseEntry = { songId: 'x', difficultyIndex: 3, addedAt: 1, order: 0 };
const pinA = { ...baseEntry, order: 0, pin: 'top' };
const pinB = { ...baseEntry, order: 1, pin: 'top' };
const midC = { ...baseEntry, order: 2 };
const botD = { ...baseEntry, order: 3, pin: 'bottom' };
assert.equal(pinGroupOf(pinA), 'top');
assert.equal(compareByPinThenOrder(pinA, midC) < 0, true);
assert.equal(compareByPinThenOrder(midC, botD) < 0, true);
const dragged = [pinB, botD, midC, pinA];
const legal = applyDragWithPinGroups(dragged);
assert.deepEqual(legal.map(entry => entry.order), [1, 0, 2, 3]);

// v1.9.0：拖拽串位修复——store.reorder 必须信任传入数组顺序（order=下标）。
// v1.10.0：改用持久 entryId 作为唯一身份，旧数据加载时补发并写回，连续拖拽不串位。
const mkEntry = (id: string, order: number) => ({ songId: id, difficultyIndex: 3, musicType: 'DX' as const, order, addedAt: 1 });
const legacySeq = [mkEntry('A', 0), mkEntry('B', 1), mkEntry('C', 2), mkEntry('D', 3)];
const migrated = migratePlanEntryIds(legacySeq as any);
assert.equal(migrated.migrated, true);
assert.equal(new Set(migrated.entries.map(entry => entry.entryId)).size, 4);
// 第二次迁移（已含 id）不再变更身份。
const secondPass = migratePlanEntryIds(migrated.entries as any);
assert.equal(secondPass.migrated, false);
assert.deepEqual(secondPass.entries.map(entry => entry.entryId), migrated.entries.map(entry => entry.entryId));

function simulateDrag(entries: any[], draggedIds: string[]): any[] {
  const ordered = normalizePlanEntries(entries);
  const result = reorderPlanEntriesById(ordered, draggedIds);
  assert.ok(result, 'valid drag must produce a result');
  return result!;
}
const seq = migrated.entries;
const seqIds = seq.map(entry => entry.entryId);
const afterFirst = simulateDrag(seq, [seqIds[3], seqIds[0], seqIds[1], seqIds[2]]);
assert.deepEqual(afterFirst.map(e => e.songId), ['D', 'A', 'B', 'C']);
const afterSecond = simulateDrag(afterFirst, [afterFirst[2].entryId, afterFirst[0].entryId, afterFirst[1].entryId, afterFirst[3].entryId]);
assert.deepEqual(afterSecond.map(e => e.songId), ['B', 'D', 'A', 'C']);
// 非法顺序（缺失 / 重复 / 长度不符）必须被拒绝。
assert.equal(reorderPlanEntriesById(seq, [seqIds[0], seqIds[1], seqIds[2]]), null);
assert.equal(reorderPlanEntriesById(seq, [seqIds[0], seqIds[0], seqIds[2], seqIds[3]]), null);
assert.equal(reorderPlanEntriesById(seq, ['bogus', seqIds[1], seqIds[2], seqIds[3]]), null);

// v1.7.0：B 站视频深链提取；b23.tv 短链无法本地展开。
// v1.9.0 起深链 av 优先：BV 号本地转 av 后优先 bilibili://video/<av>。
assert.deepEqual(getBilibiliVideoAppUrls('https://www.bilibili.com/video/BV1xx411c7mD?p=1'), ['bilibili://video/2', 'bilibili://video/BV1xx411c7mD']);
assert.deepEqual(getBilibiliVideoAppUrls('https://www.bilibili.com/video/av170001'), ['bilibili://video/av170001']);
assert.deepEqual(getBilibiliVideoAppUrls('https://b23.tv/TdQjEN6'), []);

// v1.9.0：BV↔AV 本地互转（权威对）。
assert.equal(bv2av('BV1xx411c7mD'), 2);
assert.equal(av2bv(2), 'BV1xx411c7mD');
assert.equal(av2bv(170001), 'BV17x411w7KC');
assert.equal(bv2av('BV17x411w7KC'), 170001);

// v1.7.x：扩展的视频 ID 形态提取。
assert.equal(extractBilibiliVideoId('https://mobile.bilibili.com/video/BV1xx411c7mD'), 'BV1xx411c7mD');
assert.equal(extractBilibiliVideoId('https://www.bilibili.com/video/av170001?p=2'), 'av170001');
assert.equal(extractBilibiliVideoId('https://www.bilibili.com/video?bvid=BV1xx411c7mD'), 'BV1xx411c7mD');
assert.equal(extractBilibiliVideoId('https://www.bilibili.com/video?avid=170001'), 'av170001');
assert.equal(isBilibiliShortLink('https://b23.tv/abc'), true);
assert.equal(isBilibiliShortLink('https://www.bilibili.com/video/BV1xx411c7mD'), false);

// v1.7.x：达成率损失试算（口径经人工逐项核对）。
const loss = computeAchievementLoss({ tap: 717, hold: 115, slide: 166, breaks: 87 });
assert.equal(loss.totalUnits, 1880);
assert.deepEqual(JUDGMENT_KEYS.length, 8);
const near = (value: number, expected: number) => assert.ok(Math.abs(value - expected) < 5e-4, `${value} ~ ${expected}`);
// 单音符口径（v1.9.0 修正）：常规音符行与 Break 行统一为单个音符的损失。
near(loss.regularRows[0].losses.miss.percent, loss.unitValue);        // Tap·Miss = 1 单位
near(loss.regularRows[0].losses.g2000.eqTapGreat, 1);                // Tap·Great = 1 个 Tap-Great
near(loss.regularRows[1].losses.good.percent, loss.unitValue);       // Hold·Good = 2×0.5 单位
near(loss.regularRows[2].losses.miss.percent, 3 * loss.unitValue);   // Slide·Miss = 3 单位
// Break 单音符合计（与 UI 两张表一致）：
near(loss.breakRows!.base.g1500.percent, 10 * loss.tapGreatUnit);
near(loss.breakRows!.base.good.percent, 15 * loss.tapGreatUnit);
near(loss.breakRows!.bonus.p2550.percent, 0.25 / 87);
near(loss.breakRows!.total.g2000.percent, 5 * loss.tapGreatUnit + 0.6 / 87);
near(loss.breakRows!.total.good.percent, 15 * loss.tapGreatUnit + 0.7 / 87);
near(loss.breakRows!.total.miss.eqTapGreat, 25 + 94 / 87);
// v1.17.1：等效容错口径补测——P·2550 掉 25% 的绝赞奖励份额：总损失 (0.25/87) 个百分点，
// 折合等效 Tap(Great) = (0.25/87) / tapGreatUnit（实现公式为 base 0 + bonus 换算，无基础分损失）。
near(loss.breakRows!.total.p2550.eqTapGreat, (0.25 / 87) / loss.tapGreatUnit);
near(loss.totalsIfAllSame.miss.percent, 101.0);
near(loss.totalsIfAllSame.g2000.percent, 20.6);
const noBreak = computeAchievementLoss({ tap: 10, hold: 2, slide: 1, breaks: 0 });
assert.equal(noBreak.breakRows, null);
near(noBreak.unitValue, 100 / 17);

// v1.7.0：今日运势不再推荐宴会場谱面。
const banquetRaw = [...rawData, makeMusic('9', 'maimai でらっくす BUDDiES', 'DX', '宴会場')];
for (let day = 0; day < 30; day += 1) {
  const dateKey = `2026-08-${String((day % 28) + 1).padStart(2, '0')}`;
  const result = generateFortune(`seed-${day}`, banquetRaw, dateKey);
  const picked = banquetRaw.find(song => song.id === result.recommendedSongId && song.type === result.recommendedMusicType)
    || banquetRaw.find(song => song.id === result.recommendedSongId);
  assert.notEqual(picked?.basic_info.genre, '宴会場');
}
const onlyBanquet = generateFortune('seed-x', [makeMusic('9', 'maimai でらっくす BUDDiES', 'DX', '宴会場')], '2026-08-26');
assert.equal(onlyBanquet.recommendedSongId, null);

// v1.11.0：跨组拖拽禁令自 v1.12.0 起随置顶/置底功能一并删除（不再有分组拖拽）。

// v1.12.0：B50（旧曲 TOP35 + 新曲 TOP15）与同分附加展示、目标增量。
const b50Music = Array.from({ length: 60 }, (_, index) => ({
  id: String(index + 1),
  type: 'DX' as const,
  title: `Song ${index + 1}`,
  ds: [1, 2, 3, 10 + index / 10, 12 + index / 10],
  level: ['1', '2', '3', '12', '13'],
  cids: [1, 2, 3, 4, 5],
  charts: [chart, chart, chart, chart, chart],
  basic_info: { title: `Song ${index + 1}`, artist: 'A', genre: '流行&动漫', bpm: 120, release_date: '', from: '', is_new: index >= 45 },
}));
const b50Scores = b50Music
  .filter((_, index) => index < 35 || index >= 45)
  .map(music => ({ songId: music.id, type: 'DX' as const, difficultyIndex: 4, achievement: 90 + (music.id.charCodeAt(0) % 10), dxScore: 1000, importedAt: 1 }));
const b50 = computeB50(b50Music, b50Scores);
assert.equal(b50.entries.filter(entry => entry.pool === 'new').length, B15_SIZE);
assert.equal(b50.entries.filter(entry => entry.pool === 'old').length, B35_SIZE);
assert.equal(b50.total, b50.oldSum + b50.newSum);
// 成绩覆盖 35 首旧曲 + 15 首新曲，两池恰好满。
assert.equal(b50.oldFull, true);
assert.equal(b50.newFull, true);
// 排名规则：新曲池在前、旧曲池在后，池内按 rating 降序（允许同分相邻）。
for (const pool of ['new', 'old'] as const) {
  const poolEntries = b50.entries.filter(entry => entry.pool === pool);
  for (let i = 1; i < poolEntries.length; i += 1) {
    assert.ok(poolEntries[i - 1].rating >= poolEntries[i].rating, `${pool} pool must be non-increasing by rating`);
    assert.equal(poolEntries[i].poolRank, poolEntries[i - 1].poolRank + 1, `${pool} poolRank must be contiguous`);
  }
}
// 新曲池必须全部来自 is_new 曲目。
assert.equal(b50.entries.filter(entry => entry.pool === 'new').every(entry => entry.rank <= 15), true);

// v1.12.0：同分附加（ties）——构造与池末位同分的未入榜曲目。
// b50Music 的谱面 ds 递增（12 + index/10），把 Song 20（旧曲）成绩改成与旧曲池末位同分很难对齐；
// 直接构造一个小库：3 首旧曲，两首 rating 相同（ds 相同 + 成绩相同）。
const tieMusic = [
  { ...b50Music[0], id: '900', basic_info: { ...b50Music[0].basic_info, is_new: false } },
  { ...b50Music[0], id: '901', basic_info: { ...b50Music[0].basic_info, is_new: false } },
  { ...b50Music[0], id: '902', basic_info: { ...b50Music[0].basic_info, is_new: false } },
];
const tieScores = [
  { songId: '900', type: 'DX' as const, difficultyIndex: 4, achievement: 95, dxScore: 1000, importedAt: 1 },
  { songId: '901', type: 'DX' as const, difficultyIndex: 4, achievement: 95, dxScore: 1000, importedAt: 1 },
  { songId: '902', type: 'DX' as const, difficultyIndex: 4, achievement: 95, dxScore: 1000, importedAt: 1 },
];
const tieResult = computeB50(tieMusic, tieScores);
// 池大小 35 → 只入榜 3 首，全部入榜，无 ties。
assert.equal(tieResult.oldTies.length, 0);
// 加第 4 首同分曲，仍只有 3 首能入榜？不——池 35 远未满，4 首全部入榜。
// 要构造 ties 必须让同分曲目数超过池剩余空间；用 15 首同分旧曲。
const manyTieMusic = Array.from({ length: 40 }, (_, index) => ({
  ...b50Music[0],
  id: String(950 + index),
  basic_info: { ...b50Music[0].basic_info, is_new: false },
}));
const manyTieScores = manyTieMusic.map(music => ({ songId: music.id, type: 'DX' as const, difficultyIndex: 4, achievement: 95, dxScore: 1000, importedAt: 1 }));
const manyTie = computeB50(manyTieMusic, manyTieScores);
// 40 首全部同 rating，池 35 → 入榜 35 首，5 首未入榜同分。
assert.equal(manyTie.oldTies.length, 5);
assert.equal(manyTie.oldTies.every(entry => entry.rating === manyTie.entries[manyTie.entries.length - 1].rating), true);
// ties 排序：定数同则按 songId 稳定（未入榜的是 id 985–989）。
assert.deepEqual(manyTie.oldTies.map(entry => entry.songId), ['985', '986', '987', '988', '989']);

// v1.12.0：目标增量 computeB50Gain（重算口径）。
// 无目标（非法值）→ null；谱面不在库 → null。
assert.equal(computeB50Gain(b50Music, b50Scores, { songId: '1', musicType: 'DX', difficultyIndex: 4 }, 0), null);
assert.equal(computeB50Gain(b50Music, b50Scores, { songId: 'notexist', musicType: 'DX', difficultyIndex: 4 }, 100), null);
// 把 Song 1（旧曲池内 rating 最低的入榜曲）成绩从 90 提到 100.5：排名提升但不改变池成员 → gain = 新旧单谱 Rating 差。
const song1Old = b50.entries.find(entry => entry.songId === '1');
assert.ok(song1Old);
const song1NewRating = Math.floor((12 + 0 / 10) * 1.005 * 22.4);
const gain1 = computeB50Gain(b50Music, b50Scores, { songId: '1', musicType: 'DX', difficultyIndex: 4 }, 100.5);
assert.equal(gain1, song1NewRating - song1Old.rating);
// 进不了 TOP50 的情形：把一首 ds 很低的谱面提升到 100.5 也进不了池 → gain = 0。
const lowMusic = [...b50Music, { ...b50Music[0], id: '9999', ds: [0.5, 0.5, 0.5, 1, 1] }];
const lowScores = [...b50Scores, { songId: '9999', type: 'DX' as const, difficultyIndex: 4, achievement: 50, dxScore: 1000, importedAt: 1 }];
const gainLow = computeB50Gain(lowMusic, lowScores, { songId: '9999', musicType: 'DX', difficultyIndex: 4 }, 100.5);
assert.equal(gainLow, 0);

// v1.11.0：曲绘缓存文件名（同 URL 稳定、不同 URL 不同、可按歌曲识别）。
const coverNameA = getCoverCacheFilename('123', 'https://a.example/x.png');
const coverNameB = getCoverCacheFilename('123', 'https://a.example/y.png');
assert.equal(coverNameA, getCoverCacheFilename('123', 'https://a.example/x.png'));
assert.notEqual(coverNameA, coverNameB);
assert.equal(isCoverCacheFileForSong(coverNameA, '123'), true);
assert.equal(isCoverCacheFileForSong(coverNameA, '456'), false);

// v1.12.0：CSV 导出（RFC 4180 转义 + 表头）。
const csv = buildScoresCsv([{
  songId: '1', title: 'Song, "1"', type: 'DX', difficultyIndex: 4, ds: 14.5, level: '14+',
  achievement: 100.5, dxScore: 1000, rate: 'SSS+', fc: 'ap', fs: 'fsd', serverRating: 500, importedAt: 1735689600000,
}]);
assert.equal(csv.split('\r\n')[0], CSV_HEADER.join(','));
assert.ok(csv.includes('"Song, ""1"""'), 'CSV must escape comma/quote values');
assert.ok(csv.endsWith('\r\n'));

// v1.15.0：拟合 50（fit_diff 驱动的 Rating 排名）。
const fitStats = (fitDiff: number) => ({ cnt: 100, diff: 'master', fit_diff: fitDiff, avg: 90, avg_dx: 90, std_dev: 5, dist: [], fc_dist: [] });
const fitMusic: import('../src/data/types.ts').MusicData[] = [
  { id: '901', title: 'FitA', type: 'DX', ds: [0, 0, 0, 0, 14.0], level: ['', '', '', '', '14'], cids: [0, 0, 0, 0, 1], charts: [], basic_info: { title: 'FitA', artist: '', genre: '', bpm: 0, from: '', is_new: true, release_date: '' } },
  { id: '902', title: 'FitB', type: 'SD', ds: [0, 0, 0, 0, 13.0], level: ['', '', '', '', '13'], cids: [0, 0, 0, 0, 2], charts: [], basic_info: { title: 'FitB', artist: '', genre: '', bpm: 0, from: '', is_new: false, release_date: '' } },
];
const fitScores: import('../src/data/types.ts').PlayerScore[] = [
  { songId: '901', type: 'DX', difficultyIndex: 4, achievement: 100.5, dxScore: 0, importedAt: 1 },
  { songId: '902', type: 'SD', difficultyIndex: 4, achievement: 60, dxScore: 0, importedAt: 2 },
];
const fitStatsMap = { '901': [null, null, null, null, fitStats(14.0)], '902': [null, null, null, null, fitStats(14.9)] };
const fit50 = computeFit50(fitMusic, fitScores, fitStatsMap);
assert.equal(fit50.entries.length, 2);
// 拟合 Rating = floor(fit_diff × ach/100 × coef)：14.0×1.005×22.4=315.168→315；14.9×0.6×9.6=85.824→85。
assert.equal(fit50.entries[0].rating, 315);
assert.equal(fit50.entries[1].rating, 85);
assert.equal(fit50.total, 400);
assert.equal(fit50.chartsWithFitDiff, 2);
// 缺 fit_diff 的谱面被排除。
const fit50Missing = computeFit50(fitMusic, fitScores, { '901': [null, null, null, null, fitStats(14.0)] });
assert.equal(fit50Missing.entries.length, 1);
assert.equal(fit50Missing.chartsWithFitDiff, 1);
// 排序切换：按拟合定数降序（14.9 的 FitB 反超到第一，尽管 Rating 更低）。
const fitSorted = sortFit50Entries(fit50.entries, 'fitDiff');
assert.equal(fitSorted[0].songId, '902');
assert.equal(fitSorted[0].fitDiff, 14.9);

// v1.15.0：快照推分战报（逐曲 + 总 Rating 变化）。
const battleMusic: import('../src/data/types.ts').MusicData[] = [
  { id: '801', title: 'BattleA', type: 'DX', ds: [0, 0, 0, 0, 14.0], level: ['', '', '', '', '14'], cids: [1], charts: [{ notes: [], charter: '' }, { notes: [], charter: '' }, { notes: [], charter: '' }, { notes: [], charter: '' }, { notes: [], charter: '' }], basic_info: { title: 'BattleA', artist: '', genre: '', bpm: 0, from: '', is_new: true, release_date: '' } },
  { id: '802', title: 'BattleB', type: 'SD', ds: [0, 0, 0, 0, 13.0], level: ['', '', '', '', '13'], cids: [2], charts: [{ notes: [], charter: '' }, { notes: [], charter: '' }, { notes: [], charter: '' }, { notes: [], charter: '' }, { notes: [], charter: '' }], basic_info: { title: 'BattleB', artist: '', genre: '', bpm: 0, from: '', is_new: false, release_date: '' } },
];
const mkScore = (songId: string, type: 'SD' | 'DX', achievement: number): import('../src/data/types.ts').PlayerScore => ({
  songId, type, difficultyIndex: 4, achievement, dxScore: 0, importedAt: 1,
});
const baseSnapshot = {
  id: 'snap-base', syncedAt: 1000, recordCount: 2, serverRating: 1000,
  scores: [mkScore('801', 'DX', 100.5), mkScore('802', 'SD', 100)],
};
const targetSnapshot = {
  id: 'snap-target', syncedAt: 2000, recordCount: 3, serverRating: 1010,
  scores: [mkScore('801', 'DX', 100.5), mkScore('802', 'SD', 100.5), mkScore('803' in battleMusic ? '801' : '803', 'DX' as const, 99)],
};
const report = buildSnapshotBattleReport(baseSnapshot, targetSnapshot, battleMusic);
// 上分：802 100→100.5（13.0×21.6=280.8→280 → 13.0×1.005×22.4=292.824→292，+12）；新增 803 不在库 → Rating 记 null，不计总分。
assert.equal(report.changedCount, 1);
assert.equal(report.addedCount, 1);
assert.equal(report.removedCount, 0);
const changedRow = report.rows.find(row => row.songId === '802');
assert.ok(changedRow);
assert.equal(changedRow.ratingDelta, 12);
assert.equal(report.totalRatingDelta, 12);

// v1.15.0：快照保留数量归一化（默认 20，边界 1/1000）。
assert.equal(normalizeSnapshotLimit(undefined), 20);
assert.equal(normalizeSnapshotLimit('abc'), 20);
assert.equal(normalizeSnapshotLimit(0), 1);
assert.equal(normalizeSnapshotLimit(5000), 1000);
assert.equal(normalizeSnapshotLimit(37.9), 38);
assert.equal(normalizeSnapshotLimit('55'), 55);

// v1.17.0：抽歌/计划「已达目标」判定按真实 SD/DX type（DX 曲条目 musicType 缺失时仍判对）。
{
  const planEntry = (songId: string, targetScore?: number, musicType?: 'SD' | 'DX') => ({
    entryId: `e-${songId}`, songId, difficultyIndex: 4, targetScore, musicType,
    addedAt: 1, order: 0, title: `T${songId}` as unknown as string,
  });
  const rawMusic: import('../src/data/types.ts').MusicData[] = [
    { id: '701', title: 'DxSong', type: 'DX', ds: [0, 0, 0, 0, 14], level: [], cids: [], charts: [], basic_info: { title: 'DxSong', artist: '', genre: '', bpm: 0, from: '', is_new: false, release_date: '' } },
  ];
  const score: import('../src/data/types.ts').PlayerScore = { songId: '701', type: 'DX', difficultyIndex: 4, achievement: 101, dxScore: 0, importedAt: 1 };
  // entry 未设 musicType → 仍应依真实 DX type 判为已达标（v1.16.x 曾漏判导致抽歌计数偏大）。
  const achieved = computeAchievedIds([planEntry('701', 100.5)], [score], rawMusic);
  assert.equal(achieved.size, 1, 'DX 曲缺 musicType 仍判定达标');
  const achievedNoTarget = computeAchievedIds([planEntry('701', undefined)], [score], rawMusic);
  assert.equal(achievedNoTarget.size, 0, '未设目标不判达标');
}

// v1.17.1：计划条目 → 真实谱面解析统一口径（resolvePlanMusic 与 computeAchievedIds 共用同一规则）。
// 场景：同 songId 同时存在 SD/DX 两条记录，历史条目 musicType 缺失或显式写错。
{
  const dualMusic = (id: string, type: 'SD' | 'DX'): import('../src/data/types.ts').MusicData => ({
    id, title: `Dual ${id}`, type,
    ds: [0, 0, 0, 0, 14], level: ['', '', '', '', '14'], cids: [1],
    charts: [{ notes: [], charter: '' }, { notes: [], charter: '' }, { notes: [], charter: '' }, { notes: [], charter: '' }, { notes: [], charter: '' }],
    basic_info: { title: `Dual ${id}`, artist: '', genre: '', bpm: 0, from: '', is_new: false, release_date: '' },
  });
  // 610/613 的 SD 记录刻意排在 DX 前：缺失 musicType 时「第一条有成绩记录」的归属可断言。
  const dualRaw: import('../src/data/types.ts').MusicData[] = [
    dualMusic('610', 'SD'), dualMusic('610', 'DX'),   // 双类型，两类型都有成绩
    dualMusic('611', 'DX'),                           // DX-only
    dualMusic('612', 'SD'),                           // SD-only
    dualMusic('613', 'SD'), dualMusic('613', 'DX'),   // 双类型，只有 DX 有成绩
    dualMusic('614', 'SD'), dualMusic('614', 'DX'),   // 双类型，完全无成绩
    dualMusic('615', 'DX'),                           // DX-only，无成绩
    dualMusic('616', 'SD'),                           // SD-only，无成绩
  ];
  const dualScore = (songId: string, type: 'SD' | 'DX', achievement: number): import('../src/data/types.ts').PlayerScore =>
    ({ songId, type, difficultyIndex: 4, achievement, dxScore: 0, importedAt: 1 });
  const dualScores: import('../src/data/types.ts').PlayerScore[] = [
    dualScore('610', 'DX', 100.5), dualScore('610', 'SD', 95),
    dualScore('611', 'DX', 100.5), dualScore('612', 'SD', 90),
    dualScore('613', 'DX', 100.5),
  ];
  const dualEntry = (entryId: string, songId: string, musicType?: 'SD' | 'DX', targetScore = 100): import('../src/data/types.ts').PlanEntry => ({
    entryId, songId, difficultyIndex: 4, musicType, targetScore,
    addedAt: 1, order: 0, title: `T${entryId}` as unknown as string,
  });

  // resolvePlanMusic：显式 musicType 且该类型在对应难度有成绩 → 保持显式类型。
  assert.equal(resolvePlanMusic(dualEntry('e-a1', '610', 'DX'), dualRaw, dualScores)?.type, 'DX', '显式 DX 有成绩 → 保持 DX');
  assert.equal(resolvePlanMusic(dualEntry('e-u1', '610', 'SD'), dualRaw, dualScores)?.type, 'SD', '显式 SD 有成绩 → 保持 SD');
  // 核心修复：显式 musicType='SD'（错误）且 SD 无对应难度成绩，实际 DX 成绩存在 → 解析为 DX。
  assert.equal(resolvePlanMusic(dualEntry('e-a4', '613', 'SD'), dualRaw, dualScores)?.type, 'DX', '显式错误 SD + 实际 DX 成绩 → 解析为 DX');
  // 显式类型在曲库中不存在（612 只有 SD 记录）→ 同样回退到另一类型有成绩的记录。
  assert.equal(resolvePlanMusic(dualEntry('e-u5', '612', 'DX'), dualRaw, dualScores)?.type, 'SD', '显式 DX 记录缺失 → 回退另一类型有成绩的 SD');
  // musicType 缺失：优先同 ID 中在对应难度有成绩的第一条记录（610 库内 SD 在前）。
  assert.equal(resolvePlanMusic(dualEntry('e-u2', '610'), dualRaw, dualScores)?.type, 'SD', '缺失 type + 两类型都有成绩 → 取第一条有成绩记录');
  assert.equal(resolvePlanMusic(dualEntry('e-a2', '611'), dualRaw, dualScores)?.type, 'DX', '缺失 type + 仅 DX 有成绩 → DX');
  // 完全没有对应难度成绩 → 保留显式类型/第一记录用于显示。
  assert.equal(resolvePlanMusic(dualEntry('e-u9', '614', 'SD'), dualRaw, dualScores)?.type, 'SD', '无成绩时保留显式 SD');
  assert.equal(resolvePlanMusic(dualEntry('e-u10', '614', 'DX'), dualRaw, dualScores)?.type, 'DX', '无成绩时保留显式 DX');
  assert.equal(resolvePlanMusic(dualEntry('e-u11', '614'), dualRaw, dualScores)?.type, 'SD', '无成绩时缺失 type 保留第一记录');
  assert.equal(resolvePlanMusic(dualEntry('e-u15', '616'), dualRaw, dualScores)?.type, 'SD', '无成绩 DX-only 库同理保留第一记录');
  assert.equal(resolvePlanMusic(dualEntry('e-a4', '613', 'SD'), dualRaw, dualScores)?.type, 'DX', '解析不依赖 targetScore 的高低');

  // 22 条计划条目：4 条达标、18 条未达标——计数与具体达标集合都要断言。
  const entries22 = [
    // —— 达标 4 条 ——
    dualEntry('e-a1', '610', 'DX'),                    // 显式 DX 且 DX 100.5 ≥ 100
    dualEntry('e-a2', '611'),                          // 缺失 type，库里只有 DX 且达标
    dualEntry('e-a3', '611', 'DX'),                    // 显式 DX 且达标
    dualEntry('e-a4', '613', 'SD'),                    // 显式错误 SD，实际 DX 100.5 ≥ 100
    // —— 未达标 18 条 ——
    dualEntry('e-u1', '610', 'SD'),                    // 显式 SD 有成绩 95 < 100：保持显式类型判定，不得拿 DX 100.5 充数
    dualEntry('e-u2', '610'),                          // 缺失 type 取第一条有成绩记录 SD 95，不把 DX 100.5 误算
    dualEntry('e-u3', '610', 'DX', 100.6),             // 达成率 100.5 < 目标 100.6
    dualEntry('e-u4', '612'),                          // 仅 SD 成绩 90 < 100
    dualEntry('e-u5', '612', 'DX'),                    // 显式 DX 记录缺失回退 SD，90 < 100
    dualEntry('e-u6', '613', 'DX', 101),               // 100.5 < 101
    dualEntry('e-u7', '613', undefined, 101),          // 缺失 type 解析 DX，100.5 < 101
    dualEntry('e-u8', '613', 'SD', 101),               // 显式错误 SD 回退 DX 真实成绩 100.5，仍 < 101
    dualEntry('e-u9', '614', 'SD'),                    // 完全无成绩
    dualEntry('e-u10', '614', 'DX'),                   // 完全无成绩
    dualEntry('e-u11', '614'),                         // 完全无成绩
    dualEntry('e-u12', '615', 'DX'),                   // DX-only 无成绩
    dualEntry('e-u13', '615'),                         // DX-only 无成绩
    dualEntry('e-u14', '616', 'SD'),                   // SD-only 无成绩
    dualEntry('e-u15', '616'),                         // SD-only 无成绩
    dualEntry('e-u16', '610', 'SD', 96),               // 95 < 96
    dualEntry('e-u17', '611', 'DX', 100.9),            // 100.5 < 100.9
    dualEntry('e-u18', '610', undefined, 96),          // 解析 SD 95 < 96
  ];
  assert.equal(entries22.length, 22, 'fixture 必须是 22 条');
  const achieved22 = computeAchievedIds(entries22, dualScores, dualRaw);
  assert.equal(entries22.length - achieved22.size, 18, '22 条中 18 条未达标');
  assert.equal(achieved22.size, 4, '22 条计划中 4 条达标');
  assert.deepEqual([...achieved22].sort(), ['e-a1', 'e-a2', 'e-a3', 'e-a4'], '达标集合只包含解析后真实谱面达标的条目');
  assert.equal(achieved22.has('e-a4'), true, '显式错误 SD + 实际 DX 成绩达标 → 计入达标');
  assert.equal(achieved22.has('e-u1'), false, '显式类型有成绩时不误算另一类型的超标成绩');
  assert.equal(achieved22.has('e-u2'), false, '缺失 type 且两类型都有成绩时只比较解析出的真实谱面');
  assert.equal(achieved22.has('e-u8'), false, '显式错误 SD 回退 DX 后仍按真实成绩与目标比较');
}

// v1.17.0：AP50 计数——AP 含 AP+ 总数 与 AP+ 数分开。
{
  const rawMusic: import('../src/data/types.ts').MusicData[] = [
    { id: '710', title: 'A', type: 'DX', ds: [0, 0, 0, 0, 14], level: ['', '', '', '', '14'], cids: [], charts: [{ notes: [], charter: '' }, { notes: [], charter: '' }, { notes: [], charter: '' }, { notes: [], charter: '' }, { notes: [], charter: '' }], basic_info: { title: 'A', artist: '', genre: '', bpm: 0, from: '', is_new: false, release_date: '' } },
    { id: '711', title: 'B', type: 'DX', ds: [0, 0, 0, 0, 13], level: ['', '', '', '', '13'], cids: [], charts: [{ notes: [], charter: '' }, { notes: [], charter: '' }, { notes: [], charter: '' }, { notes: [], charter: '' }, { notes: [], charter: '' }], basic_info: { title: 'B', artist: '', genre: '', bpm: 0, from: '', is_new: false, release_date: '' } },
  ];
  const s = (songId: string, achievement: number, fc: string): import('../src/data/types.ts').PlayerScore =>
    ({ songId, type: 'DX', difficultyIndex: 4, achievement, dxScore: 0, importedAt: 1, fc });
  const ap50 = computeAp50(rawMusic, [s('710', 100.5, 'ap'), s('711', 101, 'app')]);
  assert.equal(ap50.totalCount, 2, 'AP 含 AP+ 计数');
  assert.equal(ap50.apPlusCount, 1, 'AP+ 计数');
  assert.equal(AP50_SIZE, 50, 'AP50 上限');
  // 非 AP/AP+ 成绩不计入。
  const ap50b = computeAp50(rawMusic, [s('710', 100, 'fc')]);
  assert.equal(ap50b.totalCount, 0, 'FC 不计入 AP50');
}

// v1.17.0：战报排序——对 B50 有加分的曲目置顶（按 b50Delta，而非单曲 ratingDelta）。
{
  // 复用上方 battle 数据：802（SD 13.0，is_new=false 旧曲）成绩 100→100.5 若入 B35 则 b50Delta>0，
  // 而 801（is_new=true）无变化。排序应保证：有正 b50Delta 的行在前，removed/零贡献在后。
  const positive = report.rows.filter(row => row.b50Delta !== null && row.b50Delta > 0);
  const nonPositive = report.rows.filter(row => row.b50Delta === null || row.b50Delta <= 0);
  for (const later of nonPositive) {
    const posIndex = report.rows.indexOf(later);
    for (const early of positive) {
      assert.ok(report.rows.indexOf(early) < posIndex, '正 b50Delta 曲目应排在无贡献曲目前');
    }
  }
  // 802 上分且为正贡献 → 必须存在于 positive 且排在报告前部。
  const up = report.rows.find(row => row.songId === '802');
  assert.ok(positive.includes(up as NonNullable<typeof up>), '上分曲 802 计入正贡献组');
}

// v1.17.1：曲库「成绩高 → 低」排序——buildScoreIndex 索引查询 + sortMusicItems 排序。
{
  const sortSong = (id: string, title: string): import('../src/data/types.ts').MusicData => ({
    id, title, type: 'DX',
    ds: [0, 0, 0, 0, 0], level: ['12', '13', '14', '14+', '15'], cids: [],
    charts: [],
    basic_info: { title, artist: '', genre: '', bpm: 0, from: '', is_new: false, release_date: '' },
  });
  // v1.17.1：无成绩的两首刻意按标题倒序入列（a4 SortD 排在 a3 SortC 之前）——
  // scoreDesc 的无成绩 tie-break 必须保留输入顺序（默认曲库顺序），不能被 compareTitles 按标题重排。
  const sortRaw: import('../src/data/types.ts').MusicData[] = [
    sortSong('a1', 'SortA'), sortSong('a2', 'SortB'), sortSong('a4', 'SortD'), sortSong('a3', 'SortC'),
  ];
  // Master(3)：99.5 / 100.5 / 无成绩（a3、a4 在该难度没有成绩）。
  const sortScores: import('../src/data/types.ts').PlayerScore[] = [
    { songId: 'a1', type: 'DX', difficultyIndex: 3, achievement: 99.5, dxScore: 0, importedAt: 1 },
    { songId: 'a2', type: 'DX', difficultyIndex: 3, achievement: 100.5, dxScore: 0, importedAt: 1 },
    // a3 只在 Expert(4) 有成绩：用来区分默认难度（Master）与显式难度的排序结果。
    { songId: 'a3', type: 'DX', difficultyIndex: 4, achievement: 100.5, dxScore: 0, importedAt: 1 },
  ];
  const sortScoreIndex = buildScoreIndex(sortScores);
  // 索引查询：songId+type+难度 命中；缺成绩、缺索引都返回 null；非有限值不入索引且不覆盖旧值。
  assert.equal(getMusicScore(sortRaw[0], 3, sortScoreIndex), 99.5);
  assert.equal(getMusicScore(sortRaw[2], 3, sortScoreIndex), null);
  assert.equal(getMusicScore(sortRaw[0], 3), null);
  const nanIndex = buildScoreIndex([
    ...sortScores,
    { songId: 'a1', type: 'DX', difficultyIndex: 3, achievement: NaN as unknown as number, dxScore: 0, importedAt: 2 },
  ]);
  assert.equal(getMusicScore(sortRaw[0], 3, nanIndex), 99.5, '非有限成绩不得覆盖索引');

  const sortWith = (sort: import('../src/data/types.ts').SortOptions, scoreIndex?: import('../src/data/music-list.ts').ScoreIndex) =>
    sortMusicItems([...sortRaw], sort, undefined, undefined, scoreIndex);
  // 默认 difficultyIndex = Master(3)：100.5 → 99.5 从高到低；
  // 无成绩的 a4/a3 仍按输入顺序排在有成绩之后（标题顺序应为 a3 在前，若被 compareTitles 重排会变成 a3 先出）。
  assert.deepEqual(sortWith({ mode: 'scoreDesc' }, sortScoreIndex).map(music => music.id), ['a2', 'a1', 'a4', 'a3']);
  // 同分 tie-break 同样保留输入顺序：a3/a4 同为 100.5，输入顺序 a4 在前。
  const tieScoreIndex = buildScoreIndex([
    { songId: 'a1', type: 'DX', difficultyIndex: 3, achievement: 99.5, dxScore: 0, importedAt: 1 },
    { songId: 'a3', type: 'DX', difficultyIndex: 3, achievement: 100.5, dxScore: 0, importedAt: 1 },
    { songId: 'a4', type: 'DX', difficultyIndex: 3, achievement: 100.5, dxScore: 0, importedAt: 1 },
  ]);
  assert.deepEqual(sortWith({ mode: 'scoreDesc' }, tieScoreIndex).map(music => music.id), ['a4', 'a3', 'a1', 'a2']);
  // 显式 difficultyIndex = Expert(4)：只有 a3 有成绩 → 反超到第一，无成绩者仍按输入顺序排它在后。
  assert.deepEqual(sortWith({ mode: 'scoreDesc', difficultyIndex: 4 }, sortScoreIndex).map(music => music.id), ['a3', 'a1', 'a2', 'a4']);

  // v1.17.1：拟合定数排序（fitDesc）按指定难度取 fit_diff；无 fit 数据排末尾——别的难度有数据不算数。
  const fitSortStats: import('../src/data/types.ts').ChartStatsMap = {
    a1: [null, null, null, fitStats(14.0), null],
    a2: [null, null, null, fitStats(13.2), null],
    a3: [null, null, null, null, fitStats(15.9)],
    a4: [null, null, null, null, null],
  };
  // 默认 Master(3)：a1 > a2；a3 虽在 Expert 有更高拟合定数，但按指定难度无数据 → 排末尾。
  assert.deepEqual(sortMusicItems([...sortRaw], { mode: 'fitDesc' }, undefined, fitSortStats).map(music => music.id), ['a1', 'a2', 'a3', 'a4']);
  // 指定 Expert(4)：a3 反超到第一，其余无 fit 数据按标题稳定排后。
  assert.deepEqual(sortMusicItems([...sortRaw], { mode: 'fitDesc', difficultyIndex: 4 }, undefined, fitSortStats).map(music => music.id), ['a3', 'a1', 'a2', 'a4']);
}

console.log('Feature checks passed (deep links, Bilibili parsing, version groups, local plates, pins, fortune, fit50, snapshot battle)');
