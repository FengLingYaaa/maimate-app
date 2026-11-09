/**
 * 拍照识别匹配回归（v1.18.0 起改用真实曲库 fixture，不再用假歌）。
 * fixture：scripts/fixtures/music-data.json（Diving-Fish music_data 精简版，1405 首）。
 *  1) 单字符差异识别（α→a、0→O）；
 *  2) 纯数字短曲名《39》识别完全正确不被噪音过滤屏蔽；
 *  3) 粘连行（标题+定数/成绩同一行）：长标题命中，短标题不再以 0.96 抢走；
 *  4) 噪音行过滤；
 *  5) 折行标题（相邻两行拼接）、〜/～ 写法差异、装饰符号丢失、平/片假名差异；
 *  6) 别名匹配并标注来源；
 *  7) 返回前 5 名候选；
 *  8) 抽样全库统计（每 8 首取 1 首）：精确行 / 粘连行 / 折行的 Top1 命中率门槛。
 * 失败时以非零退出码结束，供 npm run test:match 门禁使用。
 */

import { matchSongTitles, OCR_CANDIDATE_LIMIT } from '../src/data/title-search';
import type { MusicData } from '../src/data/types';
import fixture from './fixtures/music-data.json';

const songs = fixture as unknown as MusicData[];

let failures = 0;
function expect(condition: boolean, label: string, detail = ''): void {
  if (condition) {
    console.log(`PASS ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failures += 1;
    console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function top(line: string): { title: string; score: number; kind?: string } | null {
  const hits = matchSongTitles(songs, line);
  return hits.length > 0 ? { title: hits[0].music.title, score: hits[0].score, kind: hits[0].matchedKind } : null;
}

function expectTop(line: string, title: string, label: string, minScore = 0.6): void {
  const hit = top(line);
  expect(hit !== null && hit.title === title && hit.score >= minScore, label,
    hit ? `got ${hit.title}@${hit.score.toFixed(2)}` : 'no match');
}

// —— 1) 单字符差异 ——
expectTop('VeRForTe aRtE:VEiN', 'VeRForTe αRtE:VEiN', 'α→a 单字符差异命中', 0.7);
expectTop('DestrOyer', 'Destr0yer', '0→O 单字符差异命中', 0.7);

// —— 2) 《39》 ——
expectTop('39', '39', '《39》精确行命中（噪音豁免）', 1);

// —— 3) 粘连行 ——
expectTop('VeRForTe aRtE:VEiN 14.1', 'VeRForTe αRtE:VEiN', '粘连行（标题+定数）命中', 0.7);
{
  const hits = matchSongTitles(songs, 'verforteartevinmaster139');
  const hit39 = hits.find(h => h.music.title === '39');
  expect(hit39 === undefined || hit39.score < 0.7, '粘连行不让《39》霸榜', hit39 ? `got ${hit39.score.toFixed(2)}` : 'no 39 hit');
}
expectTop('Catch The Future MASTER 13+ 100.5000%', 'Catch The Future', '长标题不被短标题《Future》抢走');
expectTop('Link(CoF) EXPERT 12 99.1234%', 'Link(CoF)', '长标题不被短标题《Link》抢走');
expectTop('天国と地獄 -言ノ葉リンネ- 13+', '天国と地獄 -言ノ葉リンネ-', '长标题不被短标题《天国と地獄》抢走');
{
  const hits = matchSongTitles(songs, 'Catch The Future MASTER 13+ 100.5000%');
  const future = hits.find(h => h.music.title === 'Future');
  const catchFuture = hits.find(h => h.music.title === 'Catch The Future');
  expect(!!future && !!catchFuture && future.score <= catchFuture.score - 0.2,
    '包含命中按长度比例打折（短标题明显低于长标题）',
    `Future@${future?.score.toFixed(2)} / Catch The Future@${catchFuture?.score.toFixed(2)}`);
}

// —— 4) 噪音行 ——
expect(top('perfect') === null, '噪音行（perfect）不匹配');

// —— 5) 折行 / 写法差异 ——
expectTop('Burning Hearts\n～炎のANGEL～', 'Burning Hearts ～炎のANGEL～', '折行标题（相邻两行拼接）命中');
expectTop('Burning Hearts 〜炎のANGEL〜', 'Burning Hearts ～炎のANGEL～', '〜 与 ～ 写法差异命中');
expectTop('炭坑節', '炭★坑★節', '装饰符号 ★ 丢失仍命中');
expectTop('ねこ日和。', 'ネコ日和。', '平假名/片假名差异命中');

// —— 6) 别名 ——
{
  const hits = matchSongTitles(songs, '潘多拉悖论');
  const first = hits[0];
  expect(!!first && first.music.title === 'PANDORA PARADOXXX' && first.matchedKind === 'alias',
    '别名（潘多拉悖论）命中并标注来源', first ? `${first.music.title} via ${first.matchedKind}:${first.matchedText}` : 'no match');
}

// —— 7) 候选数量 ——
{
  const hits = matchSongTitles(songs, 'Love');
  expect(OCR_CANDIDATE_LIMIT === 5 && hits.length === 5, '默认返回前 5 名候选', `${hits.length} 个：${hits.map(h => h.music.title).join(' / ')}`);
  const sorted = hits.every((hit, index) => index === 0 || hits[index - 1].score >= hit.score);
  expect(sorted, '候选按分数降序');
}

// —— 8) 抽样全库统计 ——
{
  const unique = new Map<string, MusicData>();
  for (const music of songs) if (Number(music.id) < 100000 && !unique.has(music.title)) unique.set(music.title, music);
  const titles = [...unique.keys()].filter((_, index) => index % 8 === 0);
  const rate = (make: (title: string) => string | null) => {
    let total = 0;
    let top1 = 0;
    for (const title of titles) {
      const line = make(title);
      if (line === null) continue;
      total += 1;
      const hits = matchSongTitles(songs, line);
      // SD/DX 同名两条记录任一排第一都算对。
      if (hits[0]?.music.title === title) top1 += 1;
    }
    return { total, top1, ratio: total > 0 ? top1 / total : 1 };
  };
  const exact = rate(title => title);
  const noisy = rate(title => `${title} MASTER 13+ 100.5000%`);
  const split = rate(title => (title.length >= 10 ? `${title.slice(0, Math.ceil(title.length / 2))}\n${title.slice(Math.ceil(title.length / 2))}` : null));
  expect(exact.ratio >= 0.98, '抽样：精确行 Top1 ≥ 98%', `${exact.top1}/${exact.total}`);
  expect(noisy.ratio >= 0.97, '抽样：粘连行 Top1 ≥ 97%', `${noisy.top1}/${noisy.total}`);
  expect(split.ratio >= 0.95, '抽样：折行 Top1 ≥ 95%', `${split.top1}/${split.total}`);
}

if (failures > 0) {
  console.error(`\n${failures} 个用例失败`);
  process.exit(1);
}
console.log('\n全部用例通过');
