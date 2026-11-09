import type { MusicData } from './types';
import { getCoverUrl, getFallbackCoverUrl, isBanquetGenre } from '../constants/game';

function normalizeTitle(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/^\[[^\]]+\]\s*/u, '')
    .replace(/[\s\u3000]+/g, '')
    .replace(/[，。！？、；：“”‘’（）【】《》·…—–_\-/:;!?.,()[\]{}]+/g, '');
}

function getLegacyIdCandidates(id: string): string[] {
  const numeric = Number.parseInt(id, 10);
  if (!Number.isFinite(numeric)) return [];

  const candidates: string[] = [];
  // Some banquet IDs prepend a variant digit to the regular chart ID.
  if (id.length >= 6 && id.startsWith('1')) {
    const shortened = id.slice(1);
    if (/^\d+$/.test(shortened)) candidates.push(shortened);
  }
  // Preserve the existing five-digit compatibility convention as a separate candidate.
  if (numeric > 10000 && numeric <= 11000) candidates.push(String(numeric - 10000));
  return candidates;
}

/**
 * 备用源候选：只用真实曲目 ID（宴会场的同名普通曲 + 本曲），不用 getLegacyIdCandidates 推出的 ID——
 * 推导 ID 在备用图床上可能对应别的图（例如 851/998 在 LXNS 返回 200 但不是曲库里的曲目）。
 */
function getFallbackCandidates(songIds: string[]): string[] {
  return songIds
    .map(id => getFallbackCoverUrl(id))
    .filter((url): url is string => !!url);
}

/**
 * Return ordered public cover candidates. The caller must still handle 404/network errors.
 * Banquet charts intentionally fall back to an ordinary same-title song cover, matching the
 * in-game presentation requested for MaiMate.
 *
 * v1.18.0：Diving-Fish 候选（原顺序不变）之后追加备用源（LXNS）候选。
 */
export function getCoverCandidates(music: MusicData, allSongs: MusicData[] = []): string[] {
  const ids = [music.id, ...getLegacyIdCandidates(music.id)];
  const directUrls = ids.map(id => getCoverUrl(id));

  if (isBanquetGenre(music.basic_info.genre)) {
    const title = normalizeTitle(music.title || music.basic_info.title);
    const artist = normalizeTitle(music.basic_info.artist);
    const fallbackSongs = allSongs
      .filter(candidate => candidate.id !== music.id && !isBanquetGenre(candidate.basic_info.genre))
      .filter(candidate => normalizeTitle(candidate.title || candidate.basic_info.title) === title)
      .sort((left, right) => {
        const leftArtist = normalizeTitle(left.basic_info.artist) === artist ? 0 : 1;
        const rightArtist = normalizeTitle(right.basic_info.artist) === artist ? 0 : 1;
        return leftArtist - rightArtist;
      });
    // The arcade uses the ordinary same-title artwork for every banquet variant.
    return [...new Set([
      ...fallbackSongs.map(candidate => getCoverUrl(candidate.id)),
      ...directUrls,
      ...getFallbackCandidates([...fallbackSongs.map(candidate => candidate.id), music.id]),
    ])];
  }

  return [...new Set([...directUrls, ...getFallbackCandidates([music.id])])];
}

export function getCoverCandidateKey(music: MusicData): string {
  return `${music.type}:${music.id}`;
}
