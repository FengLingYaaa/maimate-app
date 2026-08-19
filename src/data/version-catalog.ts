import { getChinaVersionName, Versions } from '../constants/game';
import type { MusicData, VersionOption } from './types';

const VERSION_ORDER = new Map<string, number>(Versions.map((version, index) => [version, index]));

export function getVersionOptions(rawData: MusicData[]): VersionOption[] {
  const counts: Record<string, number> = {};
  for (const music of rawData) {
    counts[music.basic_info.from] = (counts[music.basic_info.from] || 0) + 1;
  }

  const rawValues = [...new Set([...Versions, ...Object.keys(counts)])]
    .sort((left, right) => {
      const leftOrder = VERSION_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = VERSION_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder || left.localeCompare(right);
    });

  return rawValues.map(rawValue => {
    const chinaName = getChinaVersionName(rawValue);
    return {
      rawValue,
      chinaName,
      label: chinaName === rawValue ? rawValue : `${chinaName} · ${rawValue}`,
      count: counts[rawValue] || 0,
    };
  });
}
