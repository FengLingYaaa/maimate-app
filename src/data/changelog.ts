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
    version: '1.16.2',
    date: '2026-08-29',
    highlights: [
      '修复：曲库拟合定数标注改为两位小数、去掉 fit 前缀，难度更易保持一行',
      '推分计划新增右下角「到底部」悬浮按钮，已在底部时自动隐藏',
      '成绩同步后，新达标的曲目自动移到推分计划最下侧（设置中可关闭）',
      '从计划抽歌默认排除已达标曲目，并优先抽取今天没抽过的谱面',
      '新增抽歌历史：可回看最近 7 天每天抽了哪些谱面',
      '牌子页一键导入后可一键为全部新谱面设置 100% 目标',
    ],
  },
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
];

/** 当前安装版本的日志条目；未收录的版本返回 undefined（不弹浮层）。 */
export function getChangelogForVersion(version: string): ChangelogEntry | undefined {
  return CHANGELOG.find(entry => entry.version === version);
}
