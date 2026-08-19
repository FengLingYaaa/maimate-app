import type { FilterOptions } from './types';

/**
 * Manual drag order is meaningful only when the plan is displayed in its
 * persisted order. Search relevance and explicit sorting are derived views;
 * disabling drag there prevents a drag from being silently overwritten by the
 * next sort pass.
 */
export function canDragPlanRows(filters: Pick<FilterOptions, 'titleSearch' | 'sort'>): boolean {
  return !filters.titleSearch?.trim() && (!filters.sort || filters.sort.mode === 'relevance');
}

/** Reorder only the visible slots, preserving hidden plan entries in place. */
export function reorderVisibleEntries<T>(entries: T[], visibleIndices: number[], reorderedVisible: T[]): T[] {
  if (visibleIndices.length !== reorderedVisible.length) return entries;
  const next = [...entries];
  visibleIndices.forEach((entryIndex, visibleIndex) => {
    if (entryIndex >= 0 && entryIndex < next.length) next[entryIndex] = reorderedVisible[visibleIndex];
  });
  return next;
}
