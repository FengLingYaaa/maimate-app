import type { FilterOptions, PlanEntry } from './types';

/** 置顶/置底分组。拖拽只允许发生在同一分组的条目之间。 */
export type PinGroup = 'top' | 'middle' | 'bottom';

export function pinGroupOf(entry: Pick<PlanEntry, 'pin'>): PinGroup {
  if (entry.pin === 'top') return 'top';
  if (entry.pin === 'bottom') return 'bottom';
  return 'middle';
}

const GROUP_ORDER: Record<PinGroup, number> = { top: 0, middle: 1, bottom: 2 };

/** 计划展示顺序：置顶组 → 未固定组 → 置底组，组内按 order。 */
export function compareByPinThenOrder(left: PlanEntry, right: PlanEntry): number {
  const groupDiff = GROUP_ORDER[pinGroupOf(left)] - GROUP_ORDER[pinGroupOf(right)];
  return groupDiff || left.order - right.order;
}

/**
 * Manual drag order is meaningful only when the plan is displayed in its
 * persisted order. Search relevance and explicit sorting are derived views;
 * disabling drag there prevents a drag from being silently overwritten by the
 * next sort pass.
 */
export function canDragPlanRows(filters: FilterOptions): boolean {
  return Object.entries(filters).every(([key, value]) => {
    if (key === 'sort') return !value || (value as FilterOptions['sort'])?.mode === 'relevance';
    if (value === undefined || value === null) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    return false;
  });
}

/**
 * 把一次跨组拖拽结果收敛为合法顺序：
 * 分组块顺序固定（置顶 → 普通 → 置底），组内采用拖拽后观察到的相对顺序。
 * 这样置顶/置底曲目只会与同组曲目交换位置，跨组拖拽会被“弹回”本组。
 */
export function applyDragWithPinGroups<T extends PlanEntry>(dragged: T[]): T[] {
  const groups: Record<PinGroup, T[]> = { top: [], middle: [], bottom: [] };
  for (const entry of dragged) groups[pinGroupOf(entry)].push(entry);
  return [...groups.top, ...groups.middle, ...groups.bottom];
}
