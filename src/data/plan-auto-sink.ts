import { getChartKey } from './bilibili-links';
import { resolvePlanMusic } from './plan-entries';
import type { MusicData, PlanEntry, PlayerScore, ScoreChange } from './types';

/** Select entries that crossed their target in this sync (not already achieved entries). */
export function findNewlyAchievedPlanEntryIds(
  entries: PlanEntry[],
  changes: Pick<ScoreChange, 'chartKey' | 'previous' | 'current'>[],
  rawData: MusicData[],
  currentScores: PlayerScore[],
): string[] {
  if (entries.length === 0 || changes.length === 0) return [];
  const changedByKey = new Map(changes.map(change => [change.chartKey, change]));
  const ids: string[] = [];
  for (const entry of entries) {
    if (entry.targetScore === undefined) continue;
    const music = resolvePlanMusic(entry, rawData, currentScores);
    const type = music?.type ?? (entry.musicType === 'DX' ? 'DX' : 'SD');
    const change = changedByKey.get(getChartKey(entry.songId, type, entry.difficultyIndex));
    // A first-ever imported score has no known previous achievement; do not
    // infer a crossing from zero and unexpectedly reorder existing plans.
    if (!change?.previous || !change.current) continue;
    const before = change.previous.achievement;
    const after = change.current.achievement;
    if (Number.isFinite(before) && Number.isFinite(after) && before < entry.targetScore && after >= entry.targetScore) {
      ids.push(entry.entryId);
    }
  }
  return ids;
}

/** Move only the requested achievement-transition entries to the absolute end. */
export function moveNewlyAchievedEntriesToEnd(entries: PlanEntry[], entryIds: string[]): PlanEntry[] {
  if (entryIds.length === 0 || entries.length === 0) return entries;
  const wanted = new Set(entryIds);
  const moved = entries.filter(entry => wanted.has(entry.entryId));
  if (moved.length === 0) return entries;
  const movedIds = new Set(moved.map(entry => entry.entryId));
  const kept = entries.filter(entry => !movedIds.has(entry.entryId));
  if (entries.slice(-moved.length).every((entry, index) => entry.entryId === moved[index].entryId)) return entries;

  // The old pin UI was removed; clear obsolete pin flags so normalizing/loading
  // cannot put a just-sunk row back above the end of the single manual list.
  return [...kept, ...moved].map((entry, order) => {
    const { pin: _obsoletePin, ...manualEntry } = entry;
    return { ...manualEntry, order };
  });
}
