import assert from 'node:assert/strict';
import { parseBilibiliShare, normalizeBilibiliVideoUrl } from '../src/data/bilibili-links.ts';
import { getMusicPlatformAppUrls, getMusicPlatformSearchUrl } from '../src/data/music-platforms.ts';
import { getChinaVersionOptions, getVersionOptions } from '../src/data/version-catalog.ts';
import { buildPlateEntries, getPlateMask, summarizePlates, PLATE_BITS } from '../src/data/plates.ts';

const share = parseBilibiliShare('【第一人称maimai/舞萌 Trick tear 紫14.4 sss+ 手元-哔哩哔哩】 https://b23.tv/TdQjEN6');
assert.equal(share?.url, 'https://b23.tv/TdQjEN6');
assert.equal(share?.title, '第一人称maimai/舞萌 Trick tear 紫14.4 sss+ 手元');
assert.equal(normalizeBilibiliVideoUrl(share?.url || ''), 'https://b23.tv/TdQjEN6');

assert.match(getMusicPlatformAppUrls('netease', '晴天', '周杰伦')[0], /^orpheus:\/\//);
assert.match(getMusicPlatformAppUrls('qq', '晴天')[0], /^qqmusic:\/\//);
assert.match(getMusicPlatformAppUrls('kugou', '晴天')[0], /^kugou:\/\//);
assert.match(getMusicPlatformSearchUrl('netease', '晴天'), /^https:\/\//);

const chart = { notes: [1, 1, 1, 1], charter: 'tester' };
const makeMusic = (id, from, type = 'DX') => ({
  id, type, title: `Song ${id}`, ds: [1, 2, 3, 14.5, 14.5], level: ['1', '2', '3', '14', '14+'], cids: [1, 2, 3, 4, 5],
  charts: [chart, chart, chart, chart, chart],
  basic_info: { title: `Song ${id}`, artist: 'Artist', genre: '流行&动漫', bpm: 120, release_date: '', from, is_new: false },
});
const rawData = [makeMusic('1', 'maimai でらっくす Splash'), makeMusic('2', 'maimai PiNK')];
const japan = getVersionOptions(rawData);
const china = getChinaVersionOptions(rawData);
assert.equal(japan.find(option => option.rawValue.includes('Splash'))?.label, 'maimai でらっくす Splash');
assert.equal(china.find(option => option.rawValue === '舞萌DX 2021')?.rawValues?.[0], 'maimai でらっくす Splash');

const score = { songId: '1', type: 'DX', difficultyIndex: 3, achievement: 100.5, dxScore: 1000, fc: 'ap', fs: 'fsd', importedAt: 1 };
assert.equal(getPlateMask(score), PLATE_BITS.FC | PLATE_BITS.SSS | PLATE_BITS.FSD | PLATE_BITS.AP);
const entries = buildPlateEntries(rawData, [score]);
const summary = summarizePlates(entries.filter(entry => entry.music.id === '1' && entry.difficultyIndex === 3));
assert.deepEqual(summary, { total: 1, counts: { FC: 1, SSS: 1, FSD: 1, AP: 1 } });

console.log('Feature checks passed (deep links, Bilibili parsing, version groups, local plates)');
