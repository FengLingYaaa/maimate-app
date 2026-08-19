import { getChinaVersionName, Versions } from '../constants/game.ts';
import type { MusicData, VersionOption } from './types.ts';

const VERSION_ORDER = new Map<string, number>(Versions.map((version, index) => [version, index]));

export function getVersionOptions(rawData: MusicData[]): VersionOption[] {
  const counts: Record<string, number> = {};
  for (const music of rawData) counts[music.basic_info.from] = (counts[music.basic_info.from] || 0) + 1;

  const rawValues = [...new Set([...Versions, ...Object.keys(counts)])]
    .sort((left, right) => {
      const leftOrder = VERSION_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = VERSION_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder || left.localeCompare(right);
    });

  return rawValues.map(rawValue => ({
    rawValue,
    chinaName: getChinaVersionName(rawValue),
    label: rawValue,
    count: counts[rawValue] || 0,
    region: 'japan',
    rawValues: [rawValue],
  }));
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
