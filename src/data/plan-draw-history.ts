/**
 * 抽歌历史（v1.16.2 起按本地日期记录，v1.16.6 三模式通用）。
 * 存储结构：`{日期: {模式: {keys: 键列表(去重), draws: 次数}}}`，只保留最近 7 天。
 * 三种模式（plan/any/filtered）各自独立记录与防重复。
 * 兼容：旧版 `maimate_plan_draw_history`（仅计划、无次数）自动迁移为 plan 模式。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const DRAW_HISTORY_KEY = 'maimate_draw_history_v2';
const LEGACY_KEY = 'maimate_plan_draw_history';
const MAX_DAYS = 7;

export type DrawMode = 'plan' | 'any' | 'filtered';

export function localDateKey(timestamp = Date.now()): string {
  const date = new Date(timestamp);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export interface DayRecord {
  /** 去重后的谱面键（type:songId:difficultyIndex）。 */
  keys: string[];
  /** 抽取总次数（抽到重复也 +1）。 */
  draws: number;
  /** 是否已发生「抽遍回落全量池」——新曲目加入计划时应清除。 */
  fallback: boolean;
}

type DrawHistory = Record<string, Record<string, DayRecord>>;

async function readHistory(): Promise<DrawHistory> {
  try {
    const raw = await AsyncStorage.getItem(DRAW_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') return parsed as DrawHistory;
    // 旧版迁移：`{日期: [键...]}` → plan 模式。
    const legacyRaw = await AsyncStorage.getItem(LEGACY_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as Record<string, string[]>;
      const migrated: DrawHistory = {};
      for (const [date, keys] of Object.entries(legacy)) {
        migrated[date] = { plan: { keys, draws: keys.length, fallback: false } };
      }
      await AsyncStorage.setItem(DRAW_HISTORY_KEY, JSON.stringify(migrated)).catch(() => undefined);
      await AsyncStorage.removeItem(LEGACY_KEY).catch(() => undefined);
      return migrated;
    }
  } catch {
    // 损坏即重置。
  }
  return {};
}

async function writeHistory(history: DrawHistory): Promise<void> {
  const today = localDateKey();
  const cutoff = addDays(today, -(MAX_DAYS - 1));
  const trimmed = Object.entries(history)
    .filter(([date]) => date >= cutoff)
    .slice(-MAX_DAYS);
  await AsyncStorage.setItem(DRAW_HISTORY_KEY, JSON.stringify(Object.fromEntries(trimmed))).catch(() => undefined);
}

function addDays(dateKey: string, delta: number): string {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + delta);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** 取今天某模式的记录（无则空记录）。 */
export async function getTodayRecord(mode: DrawMode): Promise<DayRecord> {
  const history = await readHistory();
  return history[localDateKey()]?.[mode] ?? { keys: [], draws: 0, fallback: false };
}

/** 取今天某模式已抽谱面键（防重复用）。 */
export async function getTodayDrawnKeys(mode: DrawMode): Promise<string[]> {
  return (await getTodayRecord(mode)).keys;
}

/** 记录一次抽取：次数 +1；键去重入集；可标记回落。 */
export async function recordDraw(mode: DrawMode, entryKey: string, fallback = false): Promise<void> {
  const today = localDateKey();
  const history = await readHistory();
  const day = history[today] ?? {};
  const record = day[mode] ?? { keys: [], draws: 0, fallback: false };
  if (!record.keys.includes(entryKey)) record.keys.push(entryKey);
  record.draws += 1;
  if (fallback) record.fallback = true;
  day[mode] = record;
  history[today] = day;
  await writeHistory(history);
}

/** 清除某模式今天的回落标记（计划加入新曲目时调用）。 */
export async function clearFallbackFlag(mode: DrawMode): Promise<void> {
  const today = localDateKey();
  const history = await readHistory();
  const record = history[today]?.[mode];
  if (!record || !record.fallback) return;
  record.fallback = false;
  history[today][mode] = record;
  await writeHistory(history);
}

/** 清空全部抽歌历史（各模式各日）。 */
export async function clearDrawHistory(): Promise<void> {
  await AsyncStorage.removeItem(DRAW_HISTORY_KEY).catch(() => undefined);
  await AsyncStorage.removeItem(LEGACY_KEY).catch(() => undefined);
}

/** 清空今天全部模式记录（「重置今日」按钮）。 */
export async function resetToday(mode?: DrawMode): Promise<void> {
  const today = localDateKey();
  const history = await readHistory();
  if (!history[today]) return;
  if (mode) delete history[today][mode];
  else delete history[today];
  await writeHistory(history);
}

/** 读最近 N 天全模式历史（历史弹层用，新日期在前）。 */
export async function getRecentHistory(days = 7): Promise<Array<{ date: string; modes: Record<string, DayRecord> }>> {
  const history = await readHistory();
  return Object.entries(history)
    .filter(([date]) => date >= addDays(localDateKey(), -(days - 1)))
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([date, modes]) => ({ date, modes }));
}
