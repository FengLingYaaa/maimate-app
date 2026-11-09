/**
 * Rating 历史（v1.18.0）：从本版本开始记录，不补历史。纯函数，node 回归脚本可直接运行。
 *
 * - 记录时机：每次 Diving-Fish 成绩同步成功（同一时刻也会保存快照）；同步失败不记。
 * - 去重：当天（本机时区）已记过且总 Rating 没变 → 不记。
 * - 存储：AsyncStorage `maimate.rating-history.v1`，格式 { points, updatedAt }。
 */

export const RATING_HISTORY_STORAGE_KEY = 'maimate.rating-history.v1';
/** 上限：超过后丢弃最旧的点（每天同步多次也够存好几年）。 */
export const RATING_HISTORY_MAX_POINTS = 3000;

export interface RatingHistoryPoint {
  /** ISO 8601 时间字符串。 */
  at: string;
  /** 总 Rating：Diving-Fish 返回的账号 Rating；服务器未返回时用本地 B50 总分。 */
  totalRating: number;
  /** 本地按 Diving-Fish 口径计算的 B50 总分。 */
  b50Rating: number;
  /** 本次同步的成绩记录条数。 */
  songCount: number;
}

export interface RatingHistoryFile {
  points: RatingHistoryPoint[];
  updatedAt?: string;
}

function localDayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function isValidPoint(value: unknown): value is RatingHistoryPoint {
  if (!value || typeof value !== 'object') return false;
  const point = value as RatingHistoryPoint;
  return typeof point.at === 'string'
    && Number.isFinite(Date.parse(point.at))
    && Number.isFinite(point.totalRating)
    && Number.isFinite(point.b50Rating)
    && Number.isFinite(point.songCount);
}

/** 解析存储内容；损坏或缺失时返回空历史，按时间升序。 */
export function parseRatingHistory(raw: string | null): RatingHistoryFile {
  if (!raw) return { points: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<RatingHistoryFile>;
    const points = Array.isArray(parsed.points) ? parsed.points.filter(isValidPoint) : [];
    points.sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
    return { points, updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined };
  } catch {
    return { points: [] };
  }
}

/** 是否应记录新点：当天已有点且总 Rating 与当天最后一个点相同 → 不记。 */
export function shouldRecordPoint(points: RatingHistoryPoint[], next: RatingHistoryPoint): boolean {
  if (!isValidPoint(next)) return false;
  const day = localDayKey(next.at);
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    if (localDayKey(point.at) !== day) continue;
    return point.totalRating !== next.totalRating;
  }
  return true;
}

/** 追加一个点（不满足记录条件时原样返回 null）。 */
export function appendRatingPoint(history: RatingHistoryFile, next: RatingHistoryPoint): RatingHistoryFile | null {
  if (!shouldRecordPoint(history.points, next)) return null;
  const points = [...history.points, next]
    .sort((left, right) => Date.parse(left.at) - Date.parse(right.at))
    .slice(-RATING_HISTORY_MAX_POINTS);
  return { points, updatedAt: next.at };
}

export interface RatingHistoryStats {
  latest: number | null;
  max: number | null;
  min: number | null;
  /** 近 7 天变化；历史不足 7 天时与最早记录相比。只有 1 个点时为 null。 */
  change7d: number | null;
  change30d: number | null;
  count: number;
}

function changeSince(points: RatingHistoryPoint[], now: number, days: number): number | null {
  if (points.length < 2) return null;
  const latest = points[points.length - 1];
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  // 基准 = 截止时刻之前（含）最后一个点；没有更早的点时用最早的点。
  let baseline = points[0];
  for (const point of points) {
    if (Date.parse(point.at) <= cutoff) baseline = point;
    else break;
  }
  return latest.totalRating - baseline.totalRating;
}

export function computeRatingHistoryStats(points: RatingHistoryPoint[], now: number = Date.now()): RatingHistoryStats {
  if (points.length === 0) return { latest: null, max: null, min: null, change7d: null, change30d: null, count: 0 };
  const ratings = points.map(point => point.totalRating);
  return {
    latest: ratings[ratings.length - 1],
    max: Math.max(...ratings),
    min: Math.min(...ratings),
    change7d: changeSince(points, now, 7),
    change30d: changeSince(points, now, 30),
    count: points.length,
  };
}
