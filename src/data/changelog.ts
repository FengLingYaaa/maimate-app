/**
 * 版本更新日志（v1.16.1）：新版本首次启动时以浮层展示当版更新内容。
 * 每次发版在顶部追加条目；只保留最近 5 个版本，离线内置无网络依赖。
 */

export interface ChangelogEntry {
  version: string;
  date: string;
  highlights: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.16.1',
    date: '2026-08-28',
    highlights: [
      '修复：设置页次级页面（快照管理、检查更新等）无法进入的问题',
      '修复：推分计划环形进度条不显示进度',
      '搜索历史按页面分开记忆（曲库与计划互不干扰）',
      '新增：nb50 挤榜提示——榜满时显示距挤掉第 50 名还差多少',
      '新增：版本更新日志浮层（本条即首次展示）',
    ],
  },
  {
    version: '1.16.0',
    date: '2026-08-28',
    highlights: [
      '全新应用图标：八色分段街机环',
      '曲库新增拟合定数排序（高→低 / 低→高，难度旁标注拟合值）',
      '推分计划进度环重做为环形进度条',
      '推分战报汇总加入 DX Rating 变化值',
      'B50 / nb50 总览默认网格展示',
    ],
  },
];

/** 当前安装版本的日志条目；未收录的版本返回 undefined（不弹浮层）。 */
export function getChangelogForVersion(version: string): ChangelogEntry | undefined {
  return CHANGELOG.find(entry => entry.version === version);
}
