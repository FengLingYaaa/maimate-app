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

/**
 * v1.19.0：备份导入用——逐点校验并规范化外部传入的历史点列。
 * 坏点丢弃、按 `at` 去重（保留后出现的）、升序；超过上限时截断，只保留最新的 limit 个点。
 */
export function normalizeRatingHistoryPoints(
  input: unknown,
  limit: number = RATING_HISTORY_MAX_POINTS,
): { points: RatingHistoryPoint[]; dropped: number; truncated: number } {
  if (!Array.isArray(input)) return { points: [], dropped: 0, truncated: 0 };
  const byAt = new Map<string, RatingHistoryPoint>();
  let dropped = 0;
  for (const raw of input) {
    if (!isValidPoint(raw)) {
      dropped += 1;
      continue;
    }
    const point: RatingHistoryPoint = {
      at: new Date(Date.parse(raw.at)).toISOString(),
      totalRating: Math.round(raw.totalRating),
      b50Rating: Math.round(raw.b50Rating),
      songCount: Math.max(0, Math.round(raw.songCount)),
    };
    if (byAt.has(point.at)) dropped += 1;
    byAt.set(point.at, point);
  }
  const sorted = [...byAt.values()].sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
  const truncated = Math.max(0, sorted.length - limit);
  return { points: truncated > 0 ? sorted.slice(-limit) : sorted, dropped, truncated };
}

/** v1.19.0：分享卡用——区间裁剪。 */
export type RatingHistoryRange = '30d' | '90d' | 'all';
export function sliceRatingHistory(points: RatingHistoryPoint[], range: RatingHistoryRange, now: number = Date.now()): RatingHistoryPoint[] {
  if (range === 'all') return points;
  const days = range === '30d' ? 30 : 90;
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  return points.filter(point => Date.parse(point.at) >= cutoff);
}

/** v1.19.0：分享卡用——降采样：同一天只取最后一个点，再均匀抽样到 maxPoints（保留首尾）。 */
export function downsampleRatingHistory(points: RatingHistoryPoint[], maxPoints = 120): RatingHistoryPoint[] {
  const byDay = new Map<string, RatingHistoryPoint>();
  for (const point of points) byDay.set(localDayKey(point.at), point);
  const daily = [...byDay.values()];
  if (daily.length <= maxPoints) return daily;
  const result: RatingHistoryPoint[] = [];
  const step = (daily.length - 1) / (maxPoints - 1);
  for (let index = 0; index < maxPoints; index += 1) result.push(daily[Math.round(index * step)]);
  return result.filter((point, index) => index === 0 || point !== result[index - 1]);
}

/** v1.19.0：分享卡数据——阶段涨幅与是否画曲线。 */
export interface RatingHistoryShareData {
  latest: number;
  first: number;
  delta: number;
  max: number;
  min: number;
  count: number;
  fromAt: string;
  toAt: string;
  /** 少于 2 个点时不画曲线，只显示当前 Rating。 */
  drawCurve: boolean;
  points: RatingHistoryPoint[];
}

export function buildRatingHistoryShareData(points: RatingHistoryPoint[]): RatingHistoryShareData | null {
  if (points.length === 0) return null;
  const ratings = points.map(point => point.totalRating);
  return {
    latest: ratings[ratings.length - 1],
    first: ratings[0],
    delta: ratings[ratings.length - 1] - ratings[0],
    max: Math.max(...ratings),
    min: Math.min(...ratings),
    count: points.length,
    fromAt: points[0].at,
    toAt: points[points.length - 1].at,
    drawCurve: points.length >= 2,
    points: downsampleRatingHistory(points),
  };
}

/** 图片生成失败时的文字版兜底。 */
export function formatRatingHistoryShareText(data: RatingHistoryShareData, rangeLabel: string): string {
  const day = (iso: string) => {
    const date = new Date(iso);
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
  };
  const sign = data.delta > 0 ? `+${data.delta}` : String(data.delta);
  const lines = [`【MaiMate】我的 Rating：${data.latest}`];
  if (data.drawCurve) {
    lines.push(`${rangeLabel}（${day(data.fromAt)}–${day(data.toAt)}）：${data.first} → ${data.latest}（${sign}）`);
    lines.push(`最高 ${data.max} · 最低 ${data.min} · 共 ${data.count} 次同步记录`);
  }
  return lines.join('\n');
}
