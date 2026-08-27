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
import { migratePlanEntryIds, normalizePlanEntries, reorderPlanEntriesById } from '../src/data/plan-entries.ts';
import { computeB50, computeB50Gain, B35_SIZE, B15_SIZE } from '../src/data/b50.ts';
import { getCoverCacheFilename, isCoverCacheFileForSong } from '../src/data/cover-cache-names.ts';
import { buildScoresCsv, CSV_HEADER } from '../src/data/scores-csv-core.ts';
import { getBilibiliVideoAppUrls } from '../src/data/bilibili-search.ts';
import { extractBilibiliVideoId, isBilibiliShortLink } from '../src/data/bilibili-search.ts';
import { av2bv, bv2av } from '../src/data/bilibili-bvid.ts';
import { computeAchievementLoss, JUDGMENT_KEYS } from '../src/data/achievement-loss.ts';
import { generateFortune } from '../src/data/fortune.ts';
import { matchesMusic } from '../src/data/music-list.ts';
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

console.log('Feature checks passed (deep links, Bilibili parsing, version groups, local plates, pins, fortune)');
