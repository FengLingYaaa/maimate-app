import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MusicData } from './types';
import { CACHE_KEYS } from '../constants/game';

export const FORTUNE_ACTIVITIES = [
  '拼机',
  '推分',
  '越级',
  '下埋',
  '夜勤',
  '练底力',
  '练手法',
  '打旧框',
  '干饭',
  '抓绝赞',
  '收歌',
  '打大歌',
  '推 AP',
] as const;

export interface FortuneResult {
  dateKey: string;
  luck: number;
  should: string[];
  avoid: string[];
  recommendedSongId: string | null;
  recommendedMusicType: 'SD' | 'DX' | null;
}

export function getChinaDateKey(date = new Date()): string {
  // Shanghai 全年 UTC+8，无夏令时；手动偏移比依赖 Hermes 的完整时区数据库更稳定。
  const shanghaiTime = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const year = shanghaiTime.getUTCFullYear();
  const month = String(shanghaiTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shanghaiTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function nextRandom(state: { value: number }): number {
  state.value = (Math.imul(state.value ^ (state.value >>> 16), 2246822519) + 3266489917) >>> 0;
  state.value ^= state.value >>> 13;
  return (state.value >>> 0) / 4294967296;
}

export function generateFortune(seed: string, songs: MusicData[], dateKey = getChinaDateKey()): FortuneResult {
  const state = { value: hashString(`${seed}:${dateKey}`) || 1 };
  const luck = state.value % 100;
  const should: string[] = [];
  const avoid: string[] = [];

  for (const activity of FORTUNE_ACTIVITIES) {
    const value = Math.floor(nextRandom(state) * 4);
    if (value === 3) should.push(activity);
    if (value === 0) avoid.push(activity);
  }

  // Sorting by stable chart identity prevents a refresh/reordered API payload from changing today's result.
  const stableSongs = [...songs].sort((left, right) => {
    const leftKey = `${left.type}:${left.id}:${left.title}`;
    const rightKey = `${right.type}:${right.id}:${right.title}`;
    return leftKey.localeCompare(rightKey);
  });
  const recommendedSong = stableSongs.length > 0
    ? stableSongs[Math.floor(nextRandom(state) * stableSongs.length)]
    : null;
  const recommendedSongId = recommendedSong?.id || null;
  const recommendedMusicType = recommendedSong?.type || null;

  return { dateKey, luck, should, avoid, recommendedSongId, recommendedMusicType };
}

export async function getFortuneSeed(): Promise<string> {
  const existing = await AsyncStorage.getItem(CACHE_KEYS.fortuneSeed);
  if (existing) return existing;
  const seed = `${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffffff).toString(36)}`;
  await AsyncStorage.setItem(CACHE_KEYS.fortuneSeed, seed);
  return seed;
}

export async function resetFortuneSeed(): Promise<string> {
  await AsyncStorage.removeItem(CACHE_KEYS.fortuneSeed);
  return getFortuneSeed();
}
