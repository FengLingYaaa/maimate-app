/**
 * v1.19.0 回归（真实曲库 fixture）：
 *  2) 推分计划页别名命中：hasMatchedAlias / getAliasHitText，空串与多空格不触发；
 *  7) 同步战报：首次基线、Top 3、入榜/出榜、B50 外变化不进战报、Toast/横幅文案；
 *  8) 距下一档 Rating：增益与 computeB50Gain 一致、已 100.5 不出现、每谱一次、贪心组合精确；
 *  9) 定数变更：diff、只保留影响 B50 的、异常保护、新曲/下架单独统计；
 * 10) OCR：逐图前 5 再合并去重（一张图的第 1 名不会被另一张图挤掉）、置信度、理由；
 * 11) 自定义别名：校验（空/超长/与标题重复/重复）、并列提示、自定义优先、删除后恢复 Yuzu 结果；
 * 13) 分享数据：点太少不画曲线、降采样、区间裁剪、文字版兜底。
 */
import { computeB50, computeB50Gain } from '../src/data/b50';
import { getAliasHitText, getMatchedAliasText, getMusicSearchHit, hasMatchedAlias, hasMatchedTitle, matchesMusic } from '../src/data/music-list';
import { getCustomAliases, getSongAliases, isCustomAlias, setCustomAliasMap } from '../src/data/song-aliases';
import { checkCustomAlias, normalizeCustomAliasMap, withAliasAdded, withAliasRemoved } from '../src/data/custom-aliases';
import { buildSyncReport, syncReportBanner, syncReportToast } from '../src/data/sync-report';
import { computeRatingTarget } from '../src/data/next-rating-target';
import { getNextRatingTarget, getRatingTier } from '../src/data/rating';
import { buildLevelBaseline, computeLevelImpact, diffLevels } from '../src/data/level-change';
import { classifyMatchConfidence, describeMatchReason, matchSongTitlesForImage, mergeImageMatches, mergePerImageTopMatches, type TitleMatch } from '../src/data/title-search';
import { buildRatingHistoryShareData, downsampleRatingHistory, formatRatingHistoryShareText, sliceRatingHistory } from '../src/data/rating-history';
import type { MusicData, PlayerScore } from '../src/data/types';
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
const byId = (id: string) => songs.find(music => music.id === id)!;

/** 构造一份「玩家成绩」：取定数 12.5~14.6 的 Master/Expert 谱面，达成率在 97~100.6 之间确定性分布。 */
function buildScores(): PlayerScore[] {
  const result: PlayerScore[] = [];
  let seed = 7;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (const music of songs) {
    for (let index = 2; index < Math.min(music.ds.length, music.charts.length); index += 1) {
      const ds = music.ds[index];
      if (!(ds >= 12.5 && ds <= 14.6)) continue;
      if (rand() < 0.55) continue;
      result.push({ songId: music.id, type: music.type, difficultyIndex: index, achievement: Math.round((97 + rand() * 3.6) * 10000) / 10000, dxScore: 0, importedAt: 0 });
    }
  }
  return result;
}
const scores = buildScores();

// —— 2) 计划页别名命中 ——
{
  setCustomAliasMap({});
  const song = byId('11663');
  expect(hasMatchedAlias(song, 'tsunagite'), '别名搜索命中 hasMatchedAlias');
  expect(getAliasHitText(song, 'tsunagite') === 'tsunagite', '卡片 badge 显示命中的别名');
  expect(!hasMatchedAlias(song, ''), '空串不触发');
  expect(!hasMatchedAlias(song, '    '), '多空格不触发');
  expect(getAliasHitText(song, '   ') === null, '多空格不出 badge');
  expect(!hasMatchedAlias(song, '13.7'), '小数定数查询不算别名命中');
  expect(hasMatchedTitle(song, song.title.slice(0, 6)) && getAliasHitText(song, song.title) === null, '标题命中不标别名');
}

// —— 11) 自定义别名 ——
{
  setCustomAliasMap({});
  const song = byId('8');
  const other = byId('9');
  expect(!checkCustomAlias('   ', song, songs).ok && checkCustomAlias('   ', song, songs).reason === 'empty', '空别名过滤');
  expect(checkCustomAlias('x'.repeat(41), song, songs).reason === 'too-long', '超长别名过滤');
  expect(checkCustomAlias(song.title, song, songs).reason === 'same-as-title', '与本曲正式标题重复过滤');
  expect(checkCustomAlias(other.title, song, songs).reason === 'other-title', '与其它曲正式标题重复过滤');
  const yuzu = getSongAliases(song);
  if (yuzu.length > 0) expect(checkCustomAlias(yuzu[0], song, songs).reason === 'duplicate', '与已有 Yuzu 别名重复过滤');
  const ok = checkCustomAlias('  我的  真爱歌 ', song, songs);
  expect(ok.ok && ok.alias === '我的 真爱歌', '规范化空白后可添加', ok.alias);

  const query = '超级专属叫法';
  expect(songs.filter(music => matchesMusic(music, { titleSearch: query })).length === 0, '添加前搜不到');
  setCustomAliasMap(withAliasAdded({}, song.id, query));
  const hits = songs.filter(music => matchesMusic(music, { titleSearch: query }));
  expect(hits.length === 1 && hits[0].id === song.id, '添加后搜索命中（搜索缓存已失效）');
  expect(getMusicSearchHit(song, query)?.kind === 'alias' && isCustomAlias(song, getAliasHitText(song, query) ?? ''), '命中标注为自定义别名');
  expect(getSongAliases(song)[0] === query, '自定义别名排在 Yuzu 之前（自定义优先）');

  // 同一别名指多首：第二首提示 sharedWith，允许并列。
  const shared = checkCustomAlias(query, other, songs);
  expect(shared.ok && shared.sharedWith.some(music => music.id === song.id), '同一别名指多首歌：允许并列并提示');
  setCustomAliasMap(withAliasAdded(withAliasAdded({}, song.id, query), other.id, query));
  expect(songs.filter(music => matchesMusic(music, { titleSearch: query })).length === 2, '并列显示两首');

  // 删除后恢复 Yuzu 原始结果。
  setCustomAliasMap(withAliasRemoved(withAliasRemoved(withAliasAdded(withAliasAdded({}, song.id, query), other.id, query), song.id, query), other.id, query));
  expect(songs.filter(music => matchesMusic(music, { titleSearch: query })).length === 0, '删除后搜不到（恢复 Yuzu 原始结果）');
  expect(JSON.stringify(getSongAliases(song)) === JSON.stringify(yuzu), '删除后别名列表与 Yuzu 原样一致');
  expect(getCustomAliases(song).length === 0, '自定义清空');
  expect(JSON.stringify(normalizeCustomAliasMap({ '8': ['a', 'A', ' ', 'b'], x: ['c'] })) === JSON.stringify({ '8': ['a', 'b'] }), '存储解析：去重/去空/非法 id');
  setCustomAliasMap({});
}

// —— 10) OCR 逐图前 5 再合并 ——
{
  const ids = songs.slice(0, 8).map(music => music.id);
  const fake = (index: number, score: number): TitleMatch => ({ music: byId(ids[index]), recognizedText: 'x', score, matchedKind: 'title', matchedText: byId(ids[index]).title });
  // 图 1：5 个都很高的候选；图 2：第 1 名分数较低。旧逻辑（全局前 5）会挤掉图 2 的第 1 名。
  const image1 = [fake(0, 0.99), fake(1, 0.98), fake(2, 0.97), fake(3, 0.96), fake(4, 0.95), fake(5, 0.94)];
  const image2 = [fake(6, 0.7), fake(7, 0.6)];
  const legacy = mergeImageMatches([image1, image2]);
  const merged = mergePerImageTopMatches([image1, image2]);
  expect(!legacy.some(match => match.music.id === ids[6]), '复现旧问题：全局前 5 挤掉图 2 第 1 名');
  expect(merged.some(match => match.music.id === ids[6]), '新逻辑：每张图的第 1 名都保留');
  expect(!merged.some(match => match.music.id === ids[5]), '每张图只取前 5（图 1 第 6 名不进）');
  const dup = mergePerImageTopMatches([[fake(0, 0.8)], [fake(0, 0.9)]]);
  expect(dup.length === 1 && dup[0].score === 0.9 && dup[0].imageIndexes.join(',') === '0,1', '同歌多图去重取最高分并记录图号');
  expect(classifyMatchConfidence([fake(0, 0.95), fake(1, 0.7)]) === 'high', '高置信度');
  expect(classifyMatchConfidence([fake(0, 0.95), fake(1, 0.92)]) === 'low', '第 1、2 名太接近 → 低置信度');
  expect(classifyMatchConfidence([fake(0, 0.7)]) === 'low', '分数低 → 低置信度');
  expect(classifyMatchConfidence([]) === 'none', '无候选');
  const real = matchSongTitlesForImage(songs, 'True Love Song\nACHIEVEMENT 100.5000%');
  expect(real[0]?.music.title === 'True Love Song' && describeMatchReason(real[0]).includes('曲名'), '真实匹配给出「为什么是这首」', real[0] ? describeMatchReason(real[0]) : '');
}

// —— 7) 同步战报 ——
{
  const base = { rawData: songs, previousServerRating: 15000, currentServerRating: 15008, syncedAt: 1 };
  const baseline = buildSyncReport({ ...base, previousScores: [], currentScores: scores });
  expect(baseline.kind === 'baseline' && baseline.topContributions.length === 0, '首次同步只建立基线');
  expect(syncReportToast(baseline) === null && syncReportBanner(baseline) === null, '基线不弹 Toast、不出横幅');

  const b50 = computeB50(songs, scores);
  const inB50 = b50.entries.find(entry => entry.achievement < 100)!;
  const outside = scores.find(score => !b50.entries.some(entry => entry.songId === score.songId && entry.musicType === score.type && entry.difficultyIndex === score.difficultyIndex) && score.achievement < 97.5)!;
  const improved = scores.map(score => {
    if (score.songId === inB50.songId && score.type === inB50.musicType && score.difficultyIndex === inB50.difficultyIndex) return { ...score, achievement: 100.5 };
    if (score === outside) return { ...score, achievement: outside.achievement + 0.1 };
    return score;
  });
  const report = buildSyncReport({ ...base, previousScores: scores, currentScores: improved });
  const after = computeB50(songs, improved);
  expect(report.kind === 'report' && report.topContributions[0]?.songId === inB50.songId, 'Top 贡献是 B50 内提升的那首');
  expect(report.topContributions[0].ratingDelta === after.total - b50.total, '贡献值 = B50 总分实际变化（增量计算）', `${report.topContributions[0].ratingDelta}`);
  expect(!report.topContributions.some(row => row.songId === outside.songId && row.difficultyIndex === outside.difficultyIndex), 'B50 外的变化不进战报');
  expect(report.ratingSource === 'server' && report.ratingDelta === 8, '标题 Rating 用服务器值');
  expect(syncReportToast(report)?.startsWith('Rating +8，本次推分来自') ?? false, 'Toast 文案', syncReportToast(report) ?? '');
  expect(syncReportToast({ ...report, ratingDelta: 0 }) === null, '没涨不弹 Toast');
  expect(syncReportBanner(report)?.includes('来自 1 首新成绩') ?? false, '横幅文案', syncReportBanner(report) ?? '');
  expect(syncReportBanner({ ...report, seen: true }) === null, '已读后横幅消失');

  // 新入榜 / 出榜：把一首榜外谱面拉到 100.5。
  const candidate = scores
    .filter(score => !b50.entries.some(entry => entry.songId === score.songId && entry.musicType === score.type && entry.difficultyIndex === score.difficultyIndex))
    .sort((left, right) => byId(right.songId).ds[right.difficultyIndex] - byId(left.songId).ds[left.difficultyIndex])[0];
  const pushed = scores.map(score => (score === candidate ? { ...score, achievement: 100.5 } : score));
  const report2 = buildSyncReport({ ...base, previousServerRating: null, previousScores: scores, currentScores: pushed });
  expect(report2.entered.some(entry => entry.songId === candidate.songId) && report2.left.length === 1, 'B50 新入榜 / 出榜各一首', `${report2.entered.length}/${report2.left.length}`);
  expect(report2.ratingSource === 'local', '服务器 Rating 缺失时用本地 B50');
}

// —— 8) 距下一档 Rating ——
{
  expect(getNextRatingTarget(14320).target === 14500 && getRatingTier(14320).name === '金', '段位：14320 → 白金 14500');
  expect(getNextRatingTarget(15023).target === 15100, '彩框后按整百');
  const planned = new Set<string>();
  const result = computeRatingTarget(songs, scores, { isInPlan: (id, index, type) => planned.has(`${type}:${id}:${index}`), limit: 30 });
  expect(result.gap > 0 && result.candidates.length > 0, '有推荐候选', `B50 ${result.current} → ${result.target}，候选 ${result.candidates.length}`);
  const keys = result.candidates.map(candidate => candidate.key);
  expect(new Set(keys).size === keys.length, '每张谱面只推荐一次');
  expect(result.candidates.every(candidate => candidate.currentAchievement === null || candidate.currentAchievement < 100.5), '已 100.5 的谱面不出现');
  const mismatches = result.candidates.filter(candidate =>
    computeB50Gain(songs, scores, { songId: candidate.songId, musicType: candidate.musicType, difficultyIndex: candidate.difficultyIndex }, candidate.targetAchievement) !== candidate.gain);
  expect(mismatches.length === 0, '增益与 computeB50Gain（计划卡片口径）逐条一致');
  expect(result.candidates.every((candidate, index, list) => index === 0 || list[index - 1].gain >= candidate.gain), '先按 B50 增益降序');
  if (result.minCharts !== null) {
    const chosen = result.candidates.filter(candidate => result.plannedKeys.includes(candidate.key));
    const working = [
      ...scores.filter(score => !chosen.some(candidate => candidate.songId === score.songId && candidate.musicType === score.type && candidate.difficultyIndex === score.difficultyIndex)),
      ...chosen.map(candidate => ({ songId: candidate.songId, type: candidate.musicType, difficultyIndex: candidate.difficultyIndex, achievement: candidate.targetAchievement, dxScore: 0, importedAt: 0 })),
    ];
    expect(computeB50(songs, working).total >= result.target, '贪心组合精确重算可达目标', `${result.minCharts} 张`);
  }
  const first = result.candidates[0];
  planned.add(first.key);
  const marked = computeRatingTarget(songs, scores, { isInPlan: (id, index, type) => planned.has(`${type}:${id}:${index}`), limit: 30 });
  expect(marked.candidates.find(candidate => candidate.key === first.key)?.inPlan === true, '已在计划里的标注 inPlan');
  const maxed = scores.map(score => ({ ...score, achievement: 100.5 }));
  const none = computeRatingTarget(songs, maxed, { limit: 30 });
  expect(none.candidates.every(candidate => candidate.currentAchievement === null), '已达成的谱面不再出现（只剩未玩谱面）');
}

// —— 9) 定数变更 ——
{
  const baseline = buildLevelBaseline(songs, 0);
  const b50 = computeB50(songs, scores);
  const top = b50.entries[0];
  const notPlayed = songs.find(music => music.ds[3] > 13 && !scores.some(score => score.songId === music.id))!;
  const changed = songs.map(music => {
    if (music.id === top.songId && music.type === top.musicType) {
      const ds = [...music.ds];
      ds[top.difficultyIndex] = Math.round((ds[top.difficultyIndex] - 0.2) * 10) / 10;
      return { ...music, ds };
    }
    if (music.id === notPlayed.id) {
      const ds = [...music.ds];
      ds[3] = Math.round((ds[3] + 0.1) * 10) / 10;
      return { ...music, ds };
    }
    return music;
  }).filter(music => music.id !== '9');
  const added = { ...songs[0], id: '999999', title: '测试新曲' } as MusicData;
  const diff = diffLevels(baseline, [...changed, added]);
  expect(diff.levelChanges.length === 2 && !diff.anomaly, 'diff 找到 2 处定数变更');
  expect(diff.addedSongs.length === 1 && diff.removedSongs.some(song => song.key === 'SD:9'), '新曲加入、旧曲下架单独统计');
  const impact = computeLevelImpact([...changed, added], scores, diff);
  expect(impact.rows.length === 1 && impact.rows[0].songId === top.songId, '只保留影响 B50 的变更（未游玩谱面不提醒）');
  expect(impact.rows[0].newRating < impact.rows[0].oldRating && impact.b50After < impact.b50Before, '降定数：单曲 Rating 与 B50 都下降', `${impact.b50Before} → ${impact.b50After}`);
  const noChange = diffLevels(baseline, songs);
  expect(noChange.levelChanges.length === 0 && noChange.addedSongs.length === 0, '平时（无变化）不提醒');
  const broken = songs.map(music => ({ ...music, ds: music.ds.map(value => value + 1) }));
  expect(diffLevels(baseline, broken).anomaly, '大面积变化视为数据异常');
}

// —— 13) 分享数据 ——
{
  const point = (day: number, rating: number) => ({ at: new Date(Date.UTC(2026, 0, 1, 12) + day * 86400000).toISOString(), totalRating: rating, b50Rating: rating, songCount: 1 });
  const single = buildRatingHistoryShareData([point(0, 15000)]);
  expect(single !== null && !single.drawCurve && single.latest === 15000, '点太少只显示当前 Rating 不画曲线');
  expect(buildRatingHistoryShareData([]) === null, '数据为空不生成（不显示分享入口）');
  const many = Array.from({ length: 400 }, (_, index) => point(index, 14000 + index));
  const data = buildRatingHistoryShareData(many)!;
  expect(data.drawCurve && data.delta === 399 && data.points.length <= 120, '阶段涨幅与降采样', `${data.points.length} 点`);
  expect(downsampleRatingHistory([point(0, 1), { ...point(0, 2), at: new Date(Date.UTC(2026, 0, 1, 13)).toISOString() }]).length === 1, '同一天只取一个点');
  const now = Date.UTC(2026, 0, 1, 12) + 399 * 86400000;
  expect(sliceRatingHistory(many, '30d', now).length === 31, '近 30 天裁剪');
  expect(formatRatingHistoryShareText(data, '全部').includes('14000 → 14399（+399）'), '文字版兜底', formatRatingHistoryShareText(data, '全部').split('\n')[1]);
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nv1.19.0 feature checks passed');
