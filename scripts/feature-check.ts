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
import { applyDragWithPinGroups, canDragPlanRows, compareByPinThenOrder, pinGroupOf, reorderVisibleEntries } from '../src/data/plan-order.ts';
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
assert.deepEqual(reorderVisibleEntries(['A', 'B', 'C'], [0, 2], ['C', 'A']), ['C', 'B', 'A']);

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

// v1.9.0：拖拽串位修复——store.reorder 必须信任传入数组顺序（order=下标），
// 连续两次拖拽后顺序正确、互不串位。
const renumber = (list) => list.map((entry, index) => ({ ...entry, order: index }));
const mkEntry = (id: string, order: number) => ({ songId: id, difficultyIndex: 3, musicType: 'DX', order, addedAt: 1 });
function simulateDrag(entries: any[], draggedIds: string[]): any[] {
  const ordered = [...entries].sort((a, b) => a.order - b.order);
  const data = draggedIds.map(id => ordered.find(entry => entry.songId === id)!).filter(Boolean);
  const legalOrder = applyDragWithPinGroups(data);
  const visibleIndices = ordered.map((entry, index) => index);
  return renumber(reorderVisibleEntries(ordered, visibleIndices, legalOrder));
}
const seq = [mkEntry('A', 0), mkEntry('B', 1), mkEntry('C', 2), mkEntry('D', 3)];
const afterFirst = simulateDrag(seq, ['D', 'A', 'B', 'C']);
assert.deepEqual(afterFirst.map(e => e.songId), ['D', 'A', 'B', 'C']);
const afterSecond = simulateDrag(afterFirst, ['B', 'D', 'A', 'C']);
assert.deepEqual(afterSecond.map(e => e.songId), ['B', 'D', 'A', 'C']);

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

console.log('Feature checks passed (deep links, Bilibili parsing, version groups, local plates, pins, fortune)');
