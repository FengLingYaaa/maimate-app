/**
 * MusicList — 曲目过滤引擎
 *
 * 支持歌曲级条件和谱面级条件的组合筛选。筛选过程不修改原始数据，
 * 因此连续切换分类、SD/DX、版本和搜索条件不会互相污染。
 */

import type { FilterOptions, MusicData, ChartData, SortOptions } from './types';
import { getChinaVersionName, isBanquetGenre } from '../constants/game';
import { expandVersionSelection } from './version-catalog';
import { getSearchTitles } from './song-aliases';

/** 返回可用于官方定数筛选/排序/Rating 的定数；宴会場保留为缺失。 */
export function getOfficialChartConstant(music: MusicData, index: number): number | null {
  if (isBanquetGenre(music.basic_info.genre)) return null;
  const value = music.ds[index];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function hasOfficialChartConstant(music: MusicData, index: number): boolean {
  return getOfficialChartConstant(music, index) !== null;
}

/** 将用户输入和曲库文本统一成适合搜索的形式。 */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[，。！？、；：“”‘’（）【】《》·…—–_\-/:;!?.,()[\]{}]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i + 1;
    for (let j = 0; j < b.length; j += 1) {
      const above = previous[j + 1];
      const cost = a[i] === b[j] ? 0 : 1;
      previous[j + 1] = Math.min(
        previous[j + 1] + 1,
        previous[j] + 1,
        diagonal + cost,
      );
      diagonal = above;
    }
  }
  return previous[b.length];
}

function isSubsequence(query: string, text: string): boolean {
  if (query.length === 0) return true;
  let queryIndex = 0;
  for (const char of text) {
    if (char === query[queryIndex]) queryIndex += 1;
    if (queryIndex === query.length) return true;
  }
  return false;
}

function scoreText(text: string, query: string): number | null {
  const normalizedText = normalizeSearchText(text);
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedText || !normalizedQuery) return null;

  if (normalizedText === normalizedQuery) return 1200;
  const index = normalizedText.indexOf(normalizedQuery);
  if (index >= 0) return 950 - Math.min(index, 150);

  const queryTokens = normalizedQuery.split(' ').filter(Boolean);
  if (queryTokens.length > 1 && queryTokens.every(token => normalizedText.includes(token))) {
    return 820;
  }

  const compactText = normalizedText.replace(/\s/g, '');
  const compactQuery = normalizedQuery.replace(/\s/g, '');
  if (isSubsequence(compactQuery, compactText)) {
    return 700 - Math.min(Math.max(compactText.length - compactQuery.length, 0), 150);
  }

  // 对 OCR 或手动输入中的少量错字进行容错匹配。
  const maxDistance = Math.max(1, Math.floor(compactQuery.length * 0.35));
  const windowMin = Math.max(1, compactQuery.length - maxDistance);
  const windowMax = Math.min(compactText.length, compactQuery.length + maxDistance);
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let size = windowMin; size <= windowMax; size += 1) {
    for (let start = 0; start + size <= compactText.length; start += 1) {
      const distance = levenshtein(compactQuery, compactText.slice(start, start + size));
      bestDistance = Math.min(bestDistance, distance);
    }
  }
  if (bestDistance <= maxDistance) {
    return 560 - bestDistance * 40;
  }
  return null;
}

/** 返回歌曲与标题搜索词的相关度，供筛选结果排序。 */
export function getMusicSearchScore(music: MusicData, query: string): number | null {
  const values = [
    ...getSearchTitles(music).map(title => scoreText(title, query)),
    scoreText(music.basic_info.artist, query),
    ...music.charts.map(chart => scoreText(chart.charter, query)),
  ].filter((score): score is number => score !== null);
  return values.length > 0 ? Math.max(...values) : null;
}

/** 检查值是否命中单值、列表或数值区间。 */
function inOrEqual<T extends string | number>(
  value: T,
  target: T | T[] | readonly T[] | [T, T] | undefined,
): boolean {
  if (target === undefined || target === null) return true;
  if (Array.isArray(target)) {
    if (target.length === 2 && typeof target[0] === 'number' && typeof target[1] === 'number') {
      return (value as number) >= (target[0] as number) && (value as number) <= (target[1] as number);
    }
    return (target as T[]).includes(value);
  }
  return value === target;
}

function getRequestedDifficultyIndices(music: MusicData, difficulty: FilterOptions['difficulty']): number[] {
  const chartCount = Math.min(music.charts.length, music.level.length);
  if (difficulty === undefined) {
    return Array.from({ length: chartCount }, (_, index) => index);
  }
  const requested = Array.isArray(difficulty) ? difficulty : [difficulty];
  return requested.filter(index => Number.isInteger(index) && index >= 0 && index < chartCount);
}

function matchesArtist(music: MusicData, artist: string | undefined): boolean {
  if (artist === undefined || artist.trim() === '') return true;
  return normalizeSearchText(music.basic_info.artist).includes(normalizeSearchText(artist));
}

function matchesChart(
  music: MusicData,
  index: number,
  opts: FilterOptions,
): boolean {
  const chart: ChartData | undefined = music.charts[index];
  if (!chart) return false;
  if (opts.level !== undefined && !inOrEqual(music.level[index], opts.level)) return false;
  if (opts.dsRange !== undefined) {
    const constant = getOfficialChartConstant(music, index);
    if (constant === null || !inOrEqual(constant, opts.dsRange)) return false;
  }
  if (opts.charter !== undefined && opts.charter.trim() !== '') {
    const query = normalizeSearchText(opts.charter);
    if (!normalizeSearchText(chart.charter).includes(query)) return false;
  }
  return true;
}

/** 获取一首歌曲中符合所有谱面条件的难度索引。 */
export function getMatchingDifficultyIndices(music: MusicData, opts: FilterOptions): number[] {
  const indices = getRequestedDifficultyIndices(music, opts.difficulty);
  return indices.filter(index => matchesChart(music, index, opts));
}

/** 判断歌曲是否命中所有筛选条件。 */
export function matchesMusic(music: MusicData, opts: FilterOptions): boolean {
  if (!inOrEqual(music.basic_info.genre, opts.genre)) return false;
  // 版本筛选值可能是合并标签（如 "Splash+PLUS"），先展开为原始版本名集合。
  const versionScope = expandVersionSelection(opts.version);
  if (versionScope !== undefined && !versionScope.includes(music.basic_info.from)) return false;
  if (!inOrEqual(getChinaVersionName(music.basic_info.from), opts.chinaVersion)) return false;
  if (!inOrEqual(music.type, opts.type)) return false;
  if (opts.bpmRange !== undefined && !inOrEqual(music.basic_info.bpm, opts.bpmRange)) return false;
  if (!matchesArtist(music, opts.artist)) return false;

  if (opts.titleSearch !== undefined && opts.titleSearch.trim() !== '') {
    if (getMusicSearchScore(music, opts.titleSearch) === null) return false;
  }

  return getMatchingDifficultyIndices(music, opts).length > 0;
}

/** 获取谱面的 note 总数。 */
export function getTotalNotes(chart: ChartData): number {
  return chart.notes.reduce((sum, note) => sum + note, 0);
}

/** 获取谱面的 note 分布描述。 */
export function getNoteBreakdown(
  chart: ChartData,
  isDX: boolean,
): { tap: number; hold: number; slide: number; touch: number; brk: number } {
  const notes = chart.notes;
  if (isDX && notes.length >= 5) {
    return { tap: notes[0], hold: notes[1], slide: notes[2], touch: notes[3], brk: notes[4] };
  }
  return { tap: notes[0] || 0, hold: notes[1] || 0, slide: notes[2] || 0, touch: 0, brk: notes[3] || 0 };
}

/** 比较排序结果时让缺少官方定数的歌曲始终排在末尾。 */
function compareNullableConstants(left: number | null, right: number | null, descending: boolean): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return descending ? right - left : left - right;
}

function compareTitles(left: MusicData, right: MusicData, descending: boolean): number {
  const titleResult = left.title.localeCompare(right.title);
  if (titleResult !== 0) return descending ? -titleResult : titleResult;
  return parseInt(left.id, 10) - parseInt(right.id, 10);
}

function sortMusicItems(items: MusicData[], sort: SortOptions | undefined, query?: string): MusicData[] {
  const mode = sort?.mode || (query?.trim() ? 'relevance' : null);
  if (!mode || mode === 'relevance') {
    if (!query?.trim()) return items;
    return items.sort((left, right) => {
      const leftScore = getMusicSearchScore(left, query) ?? -1;
      const rightScore = getMusicSearchScore(right, query) ?? -1;
      if (rightScore !== leftScore) return rightScore - leftScore;
      return compareTitles(left, right, false);
    });
  }

  if (mode === 'titleAsc') return items.sort((left, right) => compareTitles(left, right, false));
  if (mode === 'titleDesc') return items.sort((left, right) => compareTitles(left, right, true));

  const difficultyIndex = Number.isInteger(sort?.difficultyIndex) ? sort!.difficultyIndex! : 3;
  const descending = mode === 'constantDesc';
  return items.sort((left, right) => {
    const constantResult = compareNullableConstants(
      getOfficialChartConstant(left, difficultyIndex),
      getOfficialChartConstant(right, difficultyIndex),
      descending,
    );
    return constantResult !== 0 ? constantResult : compareTitles(left, right, false);
  });
}

/** 曲库包装类。所有方法均返回新数组，不修改输入对象。 */
export class MusicList {
  private items: MusicData[];

  constructor(items: MusicData[]) {
    this.items = items;
  }

  all(): MusicData[] {
    return this.items;
  }

  get length(): number {
    return this.items.length;
  }

  byId(id: string): MusicData | undefined {
    return this.items.find(music => music.id === id);
  }

  random(): MusicData | undefined {
    if (this.items.length === 0) return undefined;
    return this.items[Math.floor(Math.random() * this.items.length)];
  }

  randomN(n: number): MusicData[] {
    const shuffled = [...this.items].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(n, shuffled.length));
  }

  filter(opts: FilterOptions): MusicList {
    const result = this.items.filter(music => matchesMusic(music, opts));
    return new MusicList(sortMusicItems(result, opts.sort, opts.titleSearch));
  }

  sortById(asc = true): MusicList {
    const sorted = [...this.items].sort((a, b) => {
      const ia = parseInt(a.id, 10);
      const ib = parseInt(b.id, 10);
      return asc ? ia - ib : ib - ia;
    });
    return new MusicList(sorted);
  }

  sortByTitle(asc = true): MusicList {
    const sorted = [...this.items].sort((a, b) =>
      asc ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title),
    );
    return new MusicList(sorted);
  }

  sortByBpm(asc = true): MusicList {
    const sorted = [...this.items].sort((a, b) =>
      asc ? a.basic_info.bpm - b.basic_info.bpm : b.basic_info.bpm - a.basic_info.bpm,
    );
    return new MusicList(sorted);
  }

  getGenres(): string[] {
    return [...new Set(this.items.map(music => music.basic_info.genre))].sort();
  }

  getVersions(): string[] {
    return [...new Set(this.items.map(music => music.basic_info.from))].sort();
  }

  getArtists(): string[] {
    return [...new Set(this.items.map(music => music.basic_info.artist))].sort();
  }

  getCharters(): string[] {
    const charters = new Set<string>();
    for (const music of this.items) {
      for (const chart of music.charts) {
        if (chart.charter !== '-') charters.add(chart.charter);
      }
    }
    return [...charters].sort();
  }

  genreCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const music of this.items) {
      counts[music.basic_info.genre] = (counts[music.basic_info.genre] || 0) + 1;
    }
    return counts;
  }

  versionCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const music of this.items) {
      counts[music.basic_info.from] = (counts[music.basic_info.from] || 0) + 1;
    }
    return counts;
  }
}