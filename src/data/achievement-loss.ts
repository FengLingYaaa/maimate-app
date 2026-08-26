/**
 * maimai DX 达成率损失试算。
 *
 * 计分口径（与用户逐项核对过的游戏规则一致，2026-08-26）：
 * - 基础分池满分 100：单位权重 Tap=1、Hold/Touch-Hold=2、Slide=3、Break=5；
 *   DF 数据中 Touch-Hold 并入 Hold 统计且分值一致，无需拆分。
 * - 判定基础比例：Perfect 系 100%、Great 80%、Good 50%、Miss 0%。
 * - Break 内部档位只影响 Break 自身：G-2000/1500/1250 的基础分损失
 *   分别等效 5/10/12.5 个 Tap·Great；Good=15、Miss=25。
 * - 奖励分池满分 1（理论达成率上限 101%）：每 Break 平分 1/x，
 *   CP 拿满、P-2550 75%、P-2500 50%、三档 Great 统一 40%、Good 30%、Miss 0%。
 */

export const JUDGMENT_KEYS = ['cp', 'p2550', 'p2500', 'g2000', 'g1500', 'g1250', 'good', 'miss'] as const;
export type JudgmentKey = (typeof JUDGMENT_KEYS)[number];

export const JUDGMENT_LABELS: Record<JudgmentKey, string> = {
  cp: 'Critical Perfect',
  p2550: 'Perfect·2550',
  p2500: 'Perfect·2500',
  g2000: 'Great·2000',
  g1500: 'Great·1500',
  g1250: 'Great·1250',
  good: 'Good',
  miss: 'Miss',
};

/** 各判定的基础得分比例。 */
const BASE_RATIO: Record<JudgmentKey, number> = {
  cp: 1, p2550: 1, p2500: 1,
  g2000: 0.8, g1500: 0.8, g1250: 0.8,
  good: 0.5, miss: 0,
};

/** Break 基础分损失相对「单个 Tap 打 Great」的倍数。 */
export const BREAK_BASE_TAP_EQUIV: Record<JudgmentKey, number> = {
  cp: 0, p2550: 0, p2500: 0,
  g2000: 5, g1500: 10, g1250: 12.5,
  good: 15, miss: 25,
};

/** Break 奖励分份额比例（乘以 1/x）。 */
export const BREAK_BONUS_SHARE: Record<JudgmentKey, number> = {
  cp: 1, p2550: 0.75, p2500: 0.5,
  g2000: 0.4, g1500: 0.4, g1250: 0.4,
  good: 0.3, miss: 0,
};

export interface AchievementNoteCounts {
  /** DF notes[0]，Touch-Hold 已并入统计且同为 2 单位。 */
  tap: number;
  /** DF notes[1]。 */
  hold: number;
  /** DF notes[2]。 */
  slide: number;
  /** DF notes[3]；SD 谱面无此位。 */
  touch?: number;
  /** DF notes 末位的绝赞数量。 */
  breaks: number;
}

export interface LossCell {
  /** 损失的达成率百分点。 */
  percent: number;
  /** 等效于多少个「Tap 打 Great」的损失。 */
  eqTapGreat: number;
}

export interface RegularLossRow {
  type: 'tap' | 'hold' | 'slide' | 'touch';
  label: string;
  count: number;
  unitsPerNote: number;
  losses: Record<JudgmentKey, LossCell>;
}

export interface BreakLossRows {
  base: Record<JudgmentKey, LossCell>;
  bonus: Record<JudgmentKey, LossCell>;
  total: Record<JudgmentKey, LossCell>;
}

export interface AchievementLossResult {
  /** 基础分总单位数。 */
  totalUnits: number;
  /** 每个单位的基础分值（百分点）。 */
  unitValue: number;
  /** 单个 Tap 打 Great 的损失（百分点），即等效换算基准。 */
  tapGreatUnit: number;
  /** 每 Break 的满额奖励份额（百分点）。 */
  bonusSharePerBreak: number | null;
  regularRows: RegularLossRow[];
  breakRows: BreakLossRows | null;
  /** 假设全谱所有音符都打同一判定时的总损失。 */
  totalsIfAllSame: Record<JudgmentKey, LossCell>;
}

type CellMap = Record<JudgmentKey, LossCell>;

function makeCells(compute: (key: JudgmentKey) => { percent: number; eqTapGreat: number }): CellMap {
  return Object.fromEntries(
    JUDGMENT_KEYS.map(key => [key, { percent: compute(key).percent, eqTapGreat: compute(key).eqTapGreat }]),
  ) as CellMap;
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/**
 * 根据谱面音符分布计算各判定下的达成率损失矩阵。
 * 所有输出均为四舍五入到 1e-6 的百分点；等效数按未取整值换算。
 */
export function computeAchievementLoss(counts: AchievementNoteCounts): AchievementLossResult {
  const tap = Math.max(0, counts.tap);
  const hold = Math.max(0, counts.hold);
  const slide = Math.max(0, counts.slide);
  const touch = Math.max(0, counts.touch ?? 0);
  const breaks = Math.max(0, counts.breaks);

  const totalUnits = tap + hold * 2 + slide * 3 + touch + breaks * 5;
  const unitValue = totalUnits > 0 ? 100 / totalUnits : 0;
  const tapGreatUnit = unitValue * (1 - BASE_RATIO.g2000);

  const regularSpecs: Array<{ type: RegularLossRow['type']; label: string; count: number; unitsPerNote: number }> = [
    { type: 'tap', label: 'Tap', count: tap, unitsPerNote: 1 },
    { type: 'hold', label: 'Hold', count: hold, unitsPerNote: 2 },
    { type: 'slide', label: 'Slide', count: slide, unitsPerNote: 3 },
    ...(touch > 0 ? [{ type: 'touch' as const, label: 'Touch', count: touch, unitsPerNote: 1 }] : []),
  ];

  const regularRows: RegularLossRow[] = regularSpecs.map(({ type, label, count, unitsPerNote }) => ({
    type,
    label,
    count,
    unitsPerNote,
    // 单音符口径：每个音符在该判定下的损失（不乘 count），与 Break 单音符合计对齐。
    losses: makeCells(key => ({
      percent: round6(unitsPerNote * unitValue * (1 - BASE_RATIO[key])),
      eqTapGreat: round6((unitsPerNote * (1 - BASE_RATIO[key])) / (1 - BASE_RATIO.g2000)),
    })),
  }));

  let breakRows: BreakLossRows | null = null;
  if (breaks > 0) {
    const bonusSharePerBreak = 1 / breaks;
    const base = makeCells(key => ({
      percent: round6(BREAK_BASE_TAP_EQUIV[key] * tapGreatUnit),
      eqTapGreat: round6(BREAK_BASE_TAP_EQUIV[key]),
    }));
    const bonus = makeCells(key => {
      const lostShare = 1 - BREAK_BONUS_SHARE[key];
      return {
        percent: round6(lostShare * bonusSharePerBreak),
        eqTapGreat: round6((lostShare * bonusSharePerBreak) / (tapGreatUnit || Number.NaN)),
      };
    });
    const total = makeCells(key => ({
      percent: round6(base[key].percent + bonus[key].percent),
      eqTapGreat: round6(base[key].eqTapGreat + (Number.isFinite(bonus[key].eqTapGreat) ? bonus[key].eqTapGreat : 0)),
    }));
    breakRows = { base, bonus, total };
  }

  const totalsIfAllSame = makeCells(key => {
    const regularUnits = tap + hold * 2 + slide * 3 + touch;
    const regular = regularUnits * unitValue * (1 - BASE_RATIO[key]);
    if (!breakRows) {
      return { percent: round6(regular), eqTapGreat: round6(regular / (tapGreatUnit || Number.NaN)) };
    }
    const allBreaks = breaks * breakRows.total[key].percent;
    return { percent: round6(regular + allBreaks), eqTapGreat: round6((regular + allBreaks) / (tapGreatUnit || Number.NaN)) };
  });

  return {
    totalUnits,
    unitValue: round6(unitValue),
    tapGreatUnit: round6(tapGreatUnit),
    bonusSharePerBreak: breaks > 0 ? round6(bonusSharePerBreakSafe(breaks)) : null,
    regularRows,
    breakRows,
    totalsIfAllSame,
  };
}

function bonusSharePerBreakSafe(breaks: number): number {
  return Math.round((1 / breaks) * 1e6) / 1e6;
}
