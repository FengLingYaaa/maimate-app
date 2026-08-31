/**
 * 清谱状态显示标签（v1.16.9）。
 * Diving-Fish 接口返回的 fc/fs 字段是内部简写（fc/fcp/ap/app、fs/fsp/fsd/fsdp…），
 * 直接展示给玩家很别扭。这里统一映射为玩家习惯的写法：
 *   fc→FC、fcp→FC+、ap→AP、app→AP+；fs→FS、fsp→FS+、fsd→FDX、fsdp→FDX+。
 * 未知值回退原样转大写。成绩详情、计划卡片、分享卡共用。
 */

const CLEAR_STATUS_LABELS: Record<string, string> = {
  // FC 系
  fc: 'FC',
  fcp: 'FC+',
  fullcombo: 'FC',
  'fullcombo+': 'FC+',
  // AP 系
  ap: 'AP',
  app: 'AP+',
  allperfect: 'AP',
  'allperfect+': 'AP+',
  // FS 系
  fs: 'FS',
  fsp: 'FS+',
  fsd: 'FDX',
  fsdp: 'FDX+',
  fsdx: 'FDX',
  fsdxp: 'FDX+',
};

export function formatClearStatus(value: string | undefined): string {
  if (!value) return '';
  const key = value.trim().toLocaleLowerCase();
  return CLEAR_STATUS_LABELS[key] ?? value.trim().toUpperCase();
}
