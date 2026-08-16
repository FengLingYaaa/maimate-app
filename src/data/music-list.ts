/**
 * MusicList — 曲目过滤引擎
 *
 * 参考 Diving-Fish/mai-bot 的 maimaidx_music.py 设计，
 * 支持 10 维度组合筛选。
 */

import { MusicData, FilterOptions, ChartData } from './types';

/** 检查值是否在目标范围内（支持单值/数组/区间） */
function inOrEqual<T extends string | number>(
  value: T,
  target: T | T[] | readonly T[] | [T, T] | undefined
): boolean {
  if (target === undefined || target === null) return true;
  if (Array.isArray(target)) {
    // 区间 [min, max]
    if (target.length === 2 && typeof target[0] === 'number' && typeof target[1] === 'number') {
      return (value as number) >= (target[0] as number) && (value as number) <= (target[1] as number);
    }
    // 列表匹配
    return (target as T[]).includes(value);
  }
  return value === target;
}

/** 在谱面数组中交叉匹配（返回匹配的难度索引） */
function crossMatch<T extends string | number>(
  values: T[],
  target: T | T[] | readonly T[] | [T, T] | undefined,
  diffFilter: number | number[] | undefined
): { matched: boolean; diffIndices: number[] } {
  if (target === undefined) {
    return { matched: true, diffIndices: [] };
  }

  const diffArr = diffFilter === undefined ? values.map((_, i) => i) : Array.isArray(diffFilter) ? diffFilter : [diffFilter];
  const matchedIndices: number[] = [];

  for (const i of diffArr) {
    if (i >= values.length) continue;
    if (inOrEqual(values[i], target)) {
      matchedIndices.push(i);
    }
  }

  return { matched: matchedIndices.length > 0, diffIndices: matchedIndices };
}

/** 获取谱面的 note 总数 */
export function getTotalNotes(chart: ChartData): number {
  return chart.notes.reduce((sum, n) => sum + n, 0);
}

/** 获取谱面的 note 分布描述 */
export function getNoteBreakdown(chart: ChartData, isDX: boolean): { tap: number; hold: number; slide: number; touch: number; brk: number } {
  const notes = chart.notes;
  if (isDX && notes.length >= 5) {
    return { tap: notes[0], hold: notes[1], slide: notes[2], touch: notes[3], brk: notes[4] };
  }
  return { tap: notes[0] || 0, hold: notes[1] || 0, slide: notes[2] || 0, touch: 0, brk: notes[3] || 0 };
}

/**
 * MusicList 类
 * 封装曲目数组，提供链式/函数式过滤+排序
 */
export class MusicList {
  private items: MusicData[];

  constructor(items: MusicData[]) {
    this.items = items;
  }

  /** 返回全部曲目 */
  all(): MusicData[] {
    return this.items;
  }

  /** 返回曲目数量 */
  get length(): number {
    return this.items.length;
  }

  /** 按 ID 查找 */
  byId(id: string): MusicData | undefined {
    return this.items.find(m => m.id === id);
  }

  /** 随机抽取一首 */
  random(): MusicData | undefined {
    if (this.items.length === 0) return undefined;
    return this.items[Math.floor(Math.random() * this.items.length)];
  }

  /** 随机抽取 N 首（不重复） */
  randomN(n: number): MusicData[] {
    const shuffled = [...this.items].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(n, shuffled.length));
  }

  /**
   * 多维过滤
   * 所有条件为 AND 逻辑，条件内部支持 OR（数组）
   */
  filter(opts: FilterOptions): MusicList {
    let result = [...this.items];

    for (const music of result) {
      let keep = true;
      const diffIndices: number[] = [];

      // 分类筛选
      if (opts.genre !== undefined) {
        if (!inOrEqual(music.basic_info.genre, opts.genre)) keep = false;
      }

      // 版本筛选
      if (opts.version !== undefined) {
        if (!inOrEqual(music.basic_info.from, opts.version)) keep = false;
      }

      // 类型筛选
      if (opts.type !== undefined) {
        if (!inOrEqual(music.type, opts.type)) keep = false;
      }

      // BPM 范围
      if (opts.bpmRange !== undefined) {
        if (!inOrEqual(music.basic_info.bpm, opts.bpmRange)) keep = false;
      }

      // 标题搜索（模糊）
      if (opts.titleSearch !== undefined && opts.titleSearch.trim() !== '') {
        if (!music.title.toLowerCase().includes(opts.titleSearch.toLowerCase().trim())) {
          keep = false;
        }
      }

      // 曲师搜索
      if (opts.artist !== undefined && opts.artist.trim() !== '') {
        if (!music.basic_info.artist.toLowerCase().includes(opts.artist.toLowerCase().trim())) {
          keep = false;
        }
      }

      // 谱师搜索
      if (opts.charter !== undefined && opts.charter.trim() !== '') {
        const charterMatch = music.charts.some(
          c => c.charter.toLowerCase().includes(opts.charter!.toLowerCase().trim())
        );
        if (!charterMatch) keep = false;
      }

      // 等级筛选（交叉匹配难度）
      if (opts.level !== undefined) {
        const { matched } = crossMatch(music.level, opts.level, opts.difficulty !== undefined ? opts.difficulty as number | number[] : undefined);
        if (!matched) keep = false;
      }

      // 定数范围筛选
      if (opts.dsRange !== undefined) {
        const { matched } = crossMatch(music.ds, opts.dsRange, opts.difficulty !== undefined ? opts.difficulty as number | number[] : undefined);
        if (!matched) keep = false;
      }

      // 难度筛选（纯索引）
      if (opts.difficulty !== undefined && opts.level === undefined && opts.dsRange === undefined) {
        const diffArr = Array.isArray(opts.difficulty) ? opts.difficulty : [opts.difficulty];
        const hasValidChart = diffArr.some(d => d < music.charts.length);
        if (!hasValidChart) keep = false;
      }

      if (!keep) {
        // 标记为移除
        (music as any).__filtered_out = true;
      }
    }

    result = result.filter(m => !(m as any).__filtered_out);

    return new MusicList(result);
  }

  /** 按 ID 排序 */
  sortById(asc = true): MusicList {
    const sorted = [...this.items].sort((a, b) => {
      const ia = parseInt(a.id, 10);
      const ib = parseInt(b.id, 10);
      return asc ? ia - ib : ib - ia;
    });
    return new MusicList(sorted);
  }

  /** 按标题排序 */
  sortByTitle(asc = true): MusicList {
    const sorted = [...this.items].sort((a, b) =>
      asc ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title)
    );
    return new MusicList(sorted);
  }

  /** 按 BPM 排序 */
  sortByBpm(asc = true): MusicList {
    const sorted = [...this.items].sort((a, b) =>
      asc ? a.basic_info.bpm - b.basic_info.bpm : b.basic_info.bpm - a.basic_info.bpm
    );
    return new MusicList(sorted);
  }

  /** 获取所有不重复的分类 */
  getGenres(): string[] {
    return [...new Set(this.items.map(m => m.basic_info.genre))].sort();
  }

  /** 获取所有不重复的版本 */
  getVersions(): string[] {
    return [...new Set(this.items.map(m => m.basic_info.from))].sort();
  }

  /** 获取所有不重复的曲师 */
  getArtists(): string[] {
    return [...new Set(this.items.map(m => m.basic_info.artist))].sort();
  }

  /** 获取所有不重复的谱师 */
  getCharters(): string[] {
    const charters = new Set<string>();
    for (const m of this.items) {
      for (const c of m.charts) {
        if (c.charter !== '-') charters.add(c.charter);
      }
    }
    return [...charters].sort();
  }

  /** 统计各分类曲目数 */
  genreCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const m of this.items) {
      counts[m.basic_info.genre] = (counts[m.basic_info.genre] || 0) + 1;
    }
    return counts;
  }

  /** 统计各版本曲目数 */
  versionCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const m of this.items) {
      counts[m.basic_info.from] = (counts[m.basic_info.from] || 0) + 1;
    }
    return counts;
  }
}