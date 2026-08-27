import type { PlanEntry, PlanGraveyardEntry } from './types';
import { applyDragWithPinGroups, compareByPinThenOrder } from './plan-order';

let idSequence = 0;

/** 为新计划记录生成持久身份；业务谱面键不再承担 React/拖拽身份。 */
export function createPlanEntryId(now = Date.now()): string {
  idSequence = (idSequence + 1) % 0x100000;
  const random = Math.floor(Math.random() * 0x100000000).toString(36);
  return `plan-${now.toString(36)}-${idSequence.toString(36)}-${random}`;
}

function hasUsableEntryId(entry: Partial<PlanEntry>): entry is Partial<PlanEntry> & { entryId: string } {
  return typeof entry.entryId === 'string' && entry.entryId.trim().length >= 6;
}

function uniqueEntryId(entry: Partial<PlanEntry>, used: Set<string>, now: number): string {
  let candidate = hasUsableEntryId(entry) ? entry.entryId.trim() : createPlanEntryId(now);
  while (used.has(candidate)) candidate = createPlanEntryId(now);
  used.add(candidate);
  return candidate;
}

/**
 * 兼容 v1.9 及更早计划数据：为缺失/重复的身份补发永久 entryId。
 * 返回 migrated 供调用方在首次加载后立即回写，保证下次启动身份不变。
 */
export function migratePlanEntryIds(entries: PlanEntry[], now = Date.now()): { entries: PlanEntry[]; migrated: boolean } {
  const used = new Set<string>();
  let migrated = false;
  const migratedEntries = entries.map((entry, index) => {
    const entryId = uniqueEntryId(entry, used, now + index);
    if (entryId !== entry.entryId) migrated = true;
    return { ...entry, entryId };
  });
  return { entries: migratedEntries, migrated };
}

/** 英灵殿中的历史条目也需要稳定身份，避免恢复后重新碰撞。 */
export function migratePlanGraveyardIds(graveyard: PlanGraveyardEntry[], now = Date.now()): { graveyard: PlanGraveyardEntry[]; migrated: boolean } {
  const used = new Set<string>();
  let migrated = false;
  const migratedGraveyard = graveyard.map((item, index) => {
    const entryId = uniqueEntryId(item.entry, used, now + index);
    if (entryId !== item.entry.entryId) migrated = true;
    return { ...item, entry: { ...item.entry, entryId } };
  });
  return { graveyard: migratedGraveyard, migrated };
}

/** 展示/持久化统一顺序：置顶 → 普通 → 置底；order 永远等于数组下标。 */
export function normalizePlanEntries(entries: PlanEntry[]): PlanEntry[] {
  return [...entries]
    .sort(compareByPinThenOrder)
    .map((entry, order) => ({ ...entry, order }));
}

/**
 * 使用一次拖拽返回的 entryId 全量顺序原子重排。
 * ID 必须与当前计划一一对应；任何缺失、重复或陈旧结果都直接拒绝。
 */
export function reorderPlanEntriesById(current: PlanEntry[], orderedIds: string[]): PlanEntry[] | null {
  if (orderedIds.length !== current.length || new Set(orderedIds).size !== orderedIds.length) return null;
  const byId = new Map(current.map(entry => [entry.entryId, entry]));
  if (byId.size !== current.length || orderedIds.some(id => !byId.has(id))) return null;
  const dragged = orderedIds.map(id => byId.get(id)!);
  return applyDragWithPinGroups(dragged).map((entry, order) => ({ ...entry, order }));
}
