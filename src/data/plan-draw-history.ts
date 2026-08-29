/**
 * 抽歌历史（v1.16.2）：记录每日抽中的谱面，支持「每日不重复优先」与历史查看。
 * 存储结构：按本地日期（YYYY-MM-DD）分日保存曲目键数组，只保留最近 7 天。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const DRAW_HISTORY_KEY = 'maimate_plan_draw_history';
const MAX_DAYS = 7;

export function localDateKey(timestamp = Date.now()): string {
  const date = new Date(timestamp);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

type DrawHistory = Record<string, string[]>;

async function readHistory(): Promise<DrawHistory> {
  try {
    const raw = await AsyncStorage.getItem(DRAW_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed as DrawHistory : {};
  } catch {
    return {};
  }
}

async function writeHistory(history: DrawHistory): Promise<void> {
  const today = localDateKey();
  const trimmed = Object.entries(history)
    .filter(([date]) => date >= addDays(today, -(MAX_DAYS - 1)))
    .sort(([left], [right]) => left.localeCompare(right))
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

/** 取今天已抽的谱面键（type:songId:difficultyIndex）。 */
export async function getTodayDrawnKeys(): Promise<string[]> {
  const history = await readHistory();
  return history[localDateKey()] ?? [];
}

/** 记录一次抽中结果。 */
export async function recordDraw(entryKey: string): Promise<void> {
  const today = localDateKey();
  const history = await readHistory();
  const todayList = history[today] ?? [];
  if (!todayList.includes(entryKey)) todayList.push(entryKey);
  history[today] = todayList;
  await writeHistory(history);
}

/** 清空抽歌历史。 */
export async function clearDrawHistory(): Promise<void> {
  await AsyncStorage.removeItem(DRAW_HISTORY_KEY).catch(() => undefined);
}

/** 今天已抽次数（抽歌历史 UI 用）。 */
export async function getTodayDrawCount(): Promise<number> {
  return (await getTodayDrawnKeys()).length;
}
