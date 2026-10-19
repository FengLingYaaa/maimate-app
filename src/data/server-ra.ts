import type { PlayerScore } from './types';

/**
 * Server-provided per-chart RA increase between score snapshots. If the score
 * was present in both snapshots but its previous `ra` was omitted, the increase
 * is unknown rather than inferred from zero.
 */
export function serverRaIncrease(before: PlayerScore | null, after: PlayerScore | null): number | null {
  if (after === null || !Number.isFinite(after.serverRating)) return null;
  if (before === null) return after.serverRating!;
  if (!Number.isFinite(before.serverRating)) return null;
  return after.serverRating! - before.serverRating!;
}

export function onlyServerRaImprovements<T extends { serverRaDelta: number | null }>(rows: T[]): T[] {
  return rows.filter(row => row.serverRaDelta !== null && row.serverRaDelta > 0);
}

/** Sum reported per-chart increases, not the user's capped total Rating delta. */
export function sumServerRaIncreases(rows: Array<{ serverRaDelta: number | null }>): number {
  return rows.reduce((sum, row) => sum + (row.serverRaDelta !== null && row.serverRaDelta > 0 ? row.serverRaDelta : 0), 0);
}
