import { MERGED_VERSION_GROUPS, expandVersionFilterValue, getChinaVersionName, Versions } from '../constants/game.ts';
import type { MusicData, VersionOption } from './types.ts';

const VERSION_ORDER = new Map<string, number>(Versions.map((version, index) => [version, index]));

function orderOf(rawValue: string): number {
  const direct = VERSION_ORDER.get(rawValue);
  if (direct !== undefined) return direct;
  // 未知/未来版本排在已知版本之后，按名称稳定排序。
  return Number.MAX_SAFE_INTEGER;
}

function firstRaw(option: VersionOption): string {
  return option.rawValues?.[0] || option.rawValue;
}

export function sortVersionOptions(options: VersionOption[]): VersionOption[] {
  return [...options].sort((left, right) => {
    const diff = orderOf(firstRaw(left)) - orderOf(firstRaw(right));
    return diff || left.label.localeCompare(right.label);
  });
}

/**
 * 日服 / 原始版本筛选。
 * DX 时代确认无独立数据的 PLUS 版本按 MERGED_VERSION_GROUPS 合并成一个
 * 标签（如 "maimai でらっくす Splash+PLUS"）；PRiSM PLUS 与旧世代 PLUS 有
 * 独立数据，保持单独筛选项。rawValue 存分组标签，rawValues 存覆盖范围，
 * 匹配时通过 expandVersionFilterValue 展开。
 */
export function getVersionOptions(rawData: MusicData[]): VersionOption[] {
  const counts: Record<string, number> = {};
  for (const music of rawData) counts[music.basic_info.from] = (counts[music.basic_info.from] || 0) + 1;

  const covered = new Set<string>();
  const options: VersionOption[] = [];

  for (const group of MERGED_VERSION_GROUPS) {
    for (const rawValue of group.rawValues) covered.add(rawValue);
    const count = group.rawValues.reduce((sum, rawValue) => sum + (counts[rawValue] || 0), 0);
    options.push({
      rawValue: group.label,
      chinaName: getChinaVersionName(group.rawValues[0]),
      label: group.label,
      count,
      region: 'japan',
      rawValues: [...group.rawValues],
    });
  }

  const singletons = [...new Set([...Object.keys(counts), ...Versions])]
    .filter(rawValue => !covered.has(rawValue))
    .sort((left, right) => orderOf(left) - orderOf(right) || left.localeCompare(right));

  for (const rawValue of singletons) {
    options.push({
      rawValue,
      chinaName: getChinaVersionName(rawValue),
      label: rawValue,
      count: counts[rawValue] || 0,
      region: 'japan',
      rawValues: [rawValue],
    });
  }

  return sortVersionOptions(options);
}

/** 版本筛选值 → 覆盖的原始版本名集合（供匹配逻辑使用）。 */
export function expandVersionSelection(values: string | string[] | undefined): string[] | undefined {
  if (values === undefined) return undefined;
  const list = Array.isArray(values) ? values : [values];
  return [...new Set(list.flatMap(value => expandVersionFilterValue(value)))];
}

export function getChinaVersionOptions(rawData: MusicData[]): VersionOption[] {
  const groups = new Map<string, { count: number; rawValues: string[] }>();
  for (const music of rawData) {
    const rawValue = music.basic_info.from;
    const chinaName = getChinaVersionName(rawValue);
    if (!/^舞萌DX(?:\s+20\d{2})?$/.test(chinaName)) continue;
    const group = groups.get(chinaName) || { count: 0, rawValues: [] };
    group.count += 1;
    if (!group.rawValues.includes(rawValue)) group.rawValues.push(rawValue);
    groups.set(chinaName, group);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'zh-CN', { numeric: true }))
    .map(([chinaName, group]) => ({
      rawValue: chinaName,
      chinaName,
      label: chinaName,
      count: group.count,
      region: 'china',
      rawValues: group.rawValues,
    }));
}
