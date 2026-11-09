/**
 * 搜索 + 别名回归（v1.18.0，真实曲库 fixture + 内置 Yuzu 别名快照）。
 *  1) 内置别名快照已接通（条目数、SongID 与水鱼 id 直接对应）；
 *  2) 别名搜索命中，并能区分「经别名命中」；
 *  3) 平/片假名互通；
 *  4) 数字搜索：「13」只走曲 ID 规则；「13.7」精确匹配官方定数 13.7；
 *  5) 别名库刷新（setRuntimeAliases）后搜索缓存失效、立即生效；
 *  6) Yuzu 响应解析。
 */

import { getMusicSearchHit, matchesMusic, getOfficialChartConstant, getMatchingDifficultyIndices } from '../src/data/music-list';
import { CURATED_SONG_ALIASES, getSongAliases, setRuntimeAliases, BUNDLED_ALIAS_LIBRARY } from '../src/data/song-aliases';
import { parseYuzuAliasResponse } from '../src/api/aliases';
import type { MusicData } from '../src/data/types';
import fixture from './fixtures/music-data.json';

const songs = fixture as unknown as MusicData[];
let failures = 0;
function expect(condition: boolean, label: string, detail = ''): void {
  if (condition) console.log(`PASS ${label}${detail ? ` — ${detail}` : ''}`);
  else {
    failures += 1;
    console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}
const search = (query: string) => songs.filter(music => matchesMusic(music, { titleSearch: query }));
const byId = (id: string) => songs.find(music => music.id === id)!;

// —— 1) 内置快照 ——
{
  const aliasCount = CURATED_SONG_ALIASES.reduce((sum, entry) => sum + entry.aliases.length, 0);
  const ids = new Set(songs.map(music => music.id));
  const matched = CURATED_SONG_ALIASES.filter(entry => ids.has(entry.songId)).length;
  expect(CURATED_SONG_ALIASES.length >= 1400 && aliasCount >= 8000, '内置别名快照已填满', `${CURATED_SONG_ALIASES.length} 首 / ${aliasCount} 条`);
  expect(matched >= 1400, 'Yuzu SongID 直接对应水鱼 id（不做 +10000）', `${matched}/${CURATED_SONG_ALIASES.length} 对上`);
  expect(getSongAliases(byId('11663')).includes('tsunagite'), 'DX 曲 11663 直接按 id 取到别名');
}

// —— 2) 别名搜索 ——
{
  const hits = search('糖糖');
  expect(hits.some(music => music.id === '8') && hits.some(music => music.id === '624'), '别名「糖糖」命中 8 与 624', hits.map(m => m.id).join(','));
  const hit = getMusicSearchHit(byId('8'), '糖糖');
  expect(hit?.kind === 'alias' && hit.text === '糖糖', '命中来源标为别名', JSON.stringify(hit));
  const titleHit = getMusicSearchHit(byId('834'), 'pandora');
  expect(titleHit?.kind === 'title', '标题命中不误标为别名', JSON.stringify(titleHit));
}

// —— 3) 假名互通 ——
{
  expect(search('ねこ日和').some(music => music.title === 'ネコ日和。'), '平假名搜到片假名标题（ねこ→ネコ）');
  const hiraTitle = songs.find(music => /^[\u3041-\u3096]{3,}/.test(music.title));
  if (hiraTitle) {
    const kata = hiraTitle.title.replace(/[\u3041-\u3096]/g, char => String.fromCharCode(char.charCodeAt(0) + 0x60));
    expect(search(kata).some(music => music.id === hiraTitle.id), '片假名搜到平假名标题', `${kata} → ${hiraTitle.title}`);
  }
}

// —— 4) 数字搜索 ——
{
  const hits13 = search('13');
  const allIdHits = hits13.every(music => getMusicSearchHit(music, '13')?.kind === 'id' || getMusicSearchHit(music, '13')?.kind === 'title');
  expect(hits13.length > 0 && allIdHits, '「13」只按曲 ID 规则（不是定数/等级）', `${hits13.length} 首，示例 ${hits13.slice(0, 3).map(m => m.id).join(',')}`);
  const expected = songs.filter(music => music.ds.some((_, index) => getOfficialChartConstant(music, index) === 13.7));
  const hits137 = search('13.7');
  const sameSet = hits137.length === expected.length && hits137.every(music => expected.includes(music));
  expect(sameSet && hits137.length > 0, '「13.7」精确匹配官方定数 13.7', `命中 ${hits137.length} 首，曲库中定数 13.7 的曲 ${expected.length} 首`);
  const sample = hits137[0];
  const indices = getMatchingDifficultyIndices(sample, { titleSearch: '13.7' });
  expect(indices.length > 0 && indices.every(index => getOfficialChartConstant(sample, index) === 13.7), '「13.7」只高亮定数 13.7 的那张谱面', `${sample.title} → 难度 ${indices.join(',')}`);
  expect(search('13.70').length === expected.length, '「13.70」与 13.7 等价');
}

// —— 5) 别名刷新后缓存失效 ——
{
  expect(search('zzhark测试别名').length === 0, '刷新前测试别名不存在');
  setRuntimeAliases({ bySongId: { ...BUNDLED_ALIAS_LIBRARY.bySongId, '8': ['zzhark测试别名'] }, updatedAt: new Date().toISOString() });
  expect(search('zzhark测试别名').map(m => m.id).join(',') === '8', '刷新后新别名立即可搜（搜索字段缓存已失效）');
  setRuntimeAliases(null);
  expect(search('zzhark测试别名').length === 0, '回退内置快照');
}

// —— 6) Yuzu 响应解析 ——
{
  const parsed = parseYuzuAliasResponse({ code: 0, content: [{ SongID: 11663, Name: '系ぎて', Alias: ['系ぎて', ' 携手 ', '携手', 3] }] }, new Date('2026-11-09T00:00:00Z'));
  expect(JSON.stringify(parsed) === JSON.stringify({ bySongId: { '11663': ['系ぎて', '携手'] }, updatedAt: '2026-11-09T00:00:00.000Z' }), 'Yuzu 响应解析为 { bySongId, updatedAt }');
  let threw = false;
  try { parseYuzuAliasResponse({ code: 1001, content: '参数不能为空' }); } catch { threw = true; }
  expect(threw, '错误响应抛错（调用方保留旧缓存）');
}

if (failures > 0) {
  console.error(`search-alias-check: ${failures} failed`);
  process.exit(1);
}
console.log('search-alias-check: all passed');
