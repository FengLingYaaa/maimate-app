import { normalizeSearchText } from './music-list';
import { getSearchTitles } from './song-aliases';
import type { MusicData } from './types';

export interface TitleMatch {
  music: MusicData;
  recognizedText: string;
  score: number;
}

function compact(value: string): string {
  return normalizeSearchText(value).replace(/\s/g, '');
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 0; i < a.length; i += 1) {
    let diagonal = row[0];
    row[0] = i + 1;
    for (let j = 0; j < b.length; j += 1) {
      const above = row[j + 1];
      const cost = a[i] === b[j] ? 0 : 1;
      row[j + 1] = Math.min(row[j + 1] + 1, row[j] + 1, diagonal + cost);
      diagonal = above;
    }
  }
  return row[b.length];
}

function scoreTitle(title: string, recognizedLine: string): number | null {
  const normalizedTitle = compact(title);
  const normalizedLine = compact(recognizedLine);
  if (normalizedTitle.length < 2 || normalizedLine.length < 2) return null;

  if (normalizedLine === normalizedTitle) return 1;
  if (normalizedLine.includes(normalizedTitle)) return 0.96;
  if (normalizedTitle.includes(normalizedLine) && normalizedLine.length >= 3) {
    return 0.78 + Math.min(normalizedLine.length / normalizedTitle.length, 1) * 0.12;
  }

  const distance = levenshtein(normalizedTitle, normalizedLine);
  const similarity = 1 - distance / Math.max(normalizedTitle.length, normalizedLine.length);
  return similarity >= 0.55 ? similarity : null;
}

/**
 * Match OCR text against official titles and the independent alias layer.
 * Artist, charter, cover artwork, and other metadata are deliberately ignored.
 */
export function matchSongTitles(rawData: MusicData[], recognizedText: string, limit = 8): TitleMatch[] {
  const lines = recognizedText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length >= 2);
  if (lines.length === 0) return [];

  return rawData
    .map(music => {
      let best: TitleMatch | null = null;
      for (const line of lines) {
        for (const title of getSearchTitles(music)) {
          const score = scoreTitle(title, line);
          if (score !== null && (!best || score > best.score)) {
            best = { music, recognizedText: line, score };
          }
        }
      }
      return best;
    })
    .filter((match): match is TitleMatch => match !== null)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}
