/**
 * MaiMate 配色方案 —「霓虹舞伴」
 * 深色底 + 粉紫/青蓝霓虹渐变
 */
export const Colors = {
  // 背景层级
  bg: {
    primary: '#0f0f1a',
    secondary: '#1a1a2e',
    tertiary: '#252540',
    overlay: 'rgba(15, 15, 26, 0.85)',
  },

  // 主色调
  accent: {
    primary: '#ff6b9d',      // 粉
    primaryDark: '#c44dff',   // 紫
    secondary: '#00d4ff',     // 青
    secondaryDark: '#7b68ee',  // 靛
  },

  // 渐变 (expo-linear-gradient 用数组)
  gradient: {
    primary: ['#ff6b9d', '#c44dff'] as const,
    secondary: ['#00d4ff', '#7b68ee'] as const,
    header: ['rgba(15,15,26,0.95)', 'rgba(15,15,26,0.7)', 'rgba(15,15,26,0)'] as const,
  },

  // 文字
  text: {
    primary: '#f0e6ff',
    secondary: '#9888b0',
    muted: '#5a4a6e',
    inverse: '#0f0f1a',
  },

  // 功能色
  functional: {
    success: '#3dd68c',
    warning: '#f0b429',
    danger: '#ff6b6b',
    info: '#00d4ff',
  },

  // 难度色 (复刻游戏内)
  difficulty: {
    basic: '#43a047',     // 绿
    advanced: '#fdd835',  // 黄
    expert: '#f44336',    // 红
    master: '#ab47bc',    // 紫
    remaster: '#d4c5f0',  // 白/浅紫白
  },

  // 边框/分割线
  border: {
    light: 'rgba(240, 230, 255, 0.12)',
    medium: 'rgba(240, 230, 255, 0.2)',
    accent: 'rgba(255, 107, 157, 0.4)',
  },
} as const;

export const DifficultyColorMap: Record<number, string> = {
  0: Colors.difficulty.basic,
  1: Colors.difficulty.advanced,
  2: Colors.difficulty.expert,
  3: Colors.difficulty.master,
  4: Colors.difficulty.remaster,
};