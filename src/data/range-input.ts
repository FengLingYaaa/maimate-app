/**
 * 定数范围条的精确输入 / 微调逻辑（纯函数，便于脚本测试）。
 *
 * - parseRangeInput：把用户输入的文字解析为合法值（夹在 min..max，按 step 取整）。
 * - applyRangeEdge：修改下限或上限时保持 lower <= upper（越界时夹到另一端）。
 * - stepRangeEdge：±step 微调。
 */

export type RangeEdge = 'lower' | 'upper';

/** 按步长四舍五入，并消除浮点尾差（例如 13.700000000000001 → 13.7）。 */
export function roundToStep(value: number, step: number): number {
  const scale = Math.round(1 / step);
  return Math.round(value * scale) / scale;
}

export function clampToRange(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * 解析输入文字。接受 "13.7"、"13,7"（中文/欧式小数点）、"13.65"（按步长取整）、
 * 前后空格和全角数字。无法解析时返回 null，调用方应保留原值。
 */
export function parseRangeInput(
  text: string,
  min: number,
  max: number,
  step: number,
): number | null {
  const normalized = text
    .trim()
    .replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[，,。．]/g, '.');
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return roundToStep(clampToRange(parsed, min, max), step);
}

/** 写入一端，保证 lower <= upper。 */
export function applyRangeEdge(
  range: [number, number],
  edge: RangeEdge,
  next: number,
): [number, number] {
  const [lower, upper] = range;
  if (edge === 'lower') return [Math.min(next, upper), upper];
  return [lower, Math.max(next, lower)];
}

/** 对一端做 ±step 微调（direction = 1 或 -1）。 */
export function stepRangeEdge(
  range: [number, number],
  edge: RangeEdge,
  direction: 1 | -1,
  min: number,
  max: number,
  step: number,
): [number, number] {
  const current = edge === 'lower' ? range[0] : range[1];
  const next = roundToStep(clampToRange(current + direction * step, min, max), step);
  return applyRangeEdge(range, edge, next);
}
