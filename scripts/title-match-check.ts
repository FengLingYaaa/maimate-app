/**
 * 识别匹配 + 数字搜索回归（v1.16.9）。
 * 覆盖 v1.16.9 批次的四个关键场景：
 *  1) 单字符差异识别（VeRForTe αRtE:VEiN→aRtE、Destr0yer→DestrOyer）必须命中；
 *  2) 纯数字短曲名《39》识别完全正确不再被噪音过滤屏蔽；
 *  3) 粘连行（标题+成绩/难度同一行）不再让短曲名以 0.96 冒名顶替，长标题可经滑动窗口命中；
 *  4) 纯数字搜索四级规则：ID 精确 > 标题精确 > ID 前缀 > 短数字 ID 子串；谱师容错不再吃数字。
 * 失败时以非零退出码结束，供 npm run test:match 门禁使用。
 */

import { matchSongTitles } from '../src/data/title-search';
import { getMusicSearchScore, matchesMusic } from '../src/data/music-list';
import type { MusicData } from '../src/data/types';

function fake(title: string, id = '10001'): MusicData {
  return {
    id, title, type: 'DX', ds: [10], level: ['13'], cids: [1],
    charts: [{ notes: [], charter: '譜面-100号' }],
    basic_info: { title, artist: 'ARTIST', genre: 'マスター', is_new: false, bpm: 120, from: 'maimai', release_date: '' },
  } as unknown as MusicData;
}

const songs = [
  fake('VeRForTe αRtE:VEiN', '11530'),
  fake('Destr0yer', '1051'),
  fake('39', '7960'),
  fake('Maxi', '10002'),
];

let failures = 0;
function expect(condition: boolean, label: string, detail = ''): void {
  if (condition) {
    console.log(`PASS ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function top(rawData: MusicData[], line: string): { title: string; score: number } | null {
  const hits = matchSongTitles(rawData, line);
  return hits.length > 0 ? { title: hits[0].music.title, score: hits[0].score } : null;
}

// —— 1) 单字符差异识别 ——
{
  const hit = top(songs, 'VeRForTe aRtE:VEiN');
  expect(hit !== null && hit.title === 'VeRForTe αRtE:VEiN' && hit.score >= 0.7,
    'α→a 单字符差异命中', hit ? `got ${hit.title}@${hit.score.toFixed(2)}` : 'no match');
  const hit2 = top(songs, 'DestrOyer');
  expect(hit2 !== null && hit2.title === 'Destr0yer' && hit2.score >= 0.7,
    '0→O 单字符差异命中', hit2 ? `got ${hit2.title}@${hit2.score.toFixed(2)}` : 'no match');
}

// —— 2) 纯数字短曲名识别完全正确不再被屏蔽 ——
{
  const hit = top(songs, '39');
  expect(hit !== null && hit.title === '39' && hit.score >= 1, '《39》精确行命中（噪音豁免）',
    hit ? `got ${hit.title}@${hit.score.toFixed(2)}` : 'no match');
}

// —— 3) 粘连行 ——
{
  const hit = top(songs, 'VeRForTe aRtE:VEiN 14.1');
  expect(hit !== null && hit.title === 'VeRForTe αRtE:VEiN' && hit.score >= 0.7,
    '粘连行（标题+定数）滑动窗口命中', hit ? `got ${hit.title}@${hit.score.toFixed(2)}` : 'no match');
  const hits = matchSongTitles(songs, 'verforteartevinmaster139');
  const hit39 = hits.find(h => h.music.title === '39');
  expect(hit39 === undefined || hit39.score < 0.7, '粘连行不再让《39》以 0.96 霸榜',
    hit39 ? `got ${hit39.score.toFixed(2)}` : 'no 39 hit');
}

// —— 4) 噪音行照旧过滤 ——
{
  expect(top(songs, 'perfect') === null, '噪音行（perfect）不匹配');
}

// —— 5) 数字搜索四级规则 ——
{
  expect(getMusicSearchScore(songs[0], '11530') === 1, 'ID 精确 = 1');
  expect(getMusicSearchScore(songs[2], '39') === 0.95, '标题精确（纯数字曲名《39》）= 0.95');
  expect(getMusicSearchScore(songs[1], '105') === 0.85, 'ID 前缀 = 0.85');
  expect(getMusicSearchScore(fake('X', '31180'), '118') === 0.5, '2~3 位 ID 子串 = 0.5');
  // 单数字「1」不再走谱师容错（谱师「譜面-100号」含「1」不应命中）。
  expect(getMusicSearchScore(songs[0], '1') === null, '单数字 1 无 ID/标题命中 → null');
  expect(matchesMusic(fake('Title Only', '2'), { titleSearch: '1' }) === false, 'matchesMusic：单数字 1 不命中谱师');
  // 多位 ID 搜索只出 ID/标题命中。
  const matched = songs.filter(m => matchesMusic(m, { titleSearch: '11530' }));
  expect(matched.length === 1 && matched[0].title === 'VeRForTe αRtE:VEiN', '多位 ID 搜索只出 ID 命中曲');
  // 全角数字归一。
  expect(getMusicSearchScore(songs[0], '１１５３０') === 1, '全角数字 NFKC 归一后命中 ID');
}

if (failures > 0) {
  console.error(`\n${failures} 个用例失败`);
  process.exit(1);
}
console.log('\n全部用例通过');
