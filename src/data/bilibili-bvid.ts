/**
 * Bilibili BV 号 ↔ AV 号本地互转。
 *
 * 算法来自社区公开整理（bilibili-API-collect）：AV 号与 BV 号通过
 * 固定异或掩码 + 58 进制字母表 + 固定位置置换互相推导，纯数学运算，
 * 无需任何网络请求。客户端深链 bilibili://video/<av> 比 BV 形式兼容面更广，
 * 因此打开视频前先把 BV 转成 AV。
 *
 * 置换表用已知权威对（BV1xx411c7mD ↔ av2）验证过：av2bv 把 58 进制位串
 * 按 ENCODE_PERM 重排，bv2av 按逆置换 DECODE_PERM 还原（二者互逆）。
 */

const XOR_CODE = 23442827791579n;
const MASK_CODE = 2251799813685247n;
const MAX_AID = 1n << 51n;
const BASE = 58n;
const ALPHABET = 'FcwAPNKTMug3GV5Lj7EJnHpWsx4tb8haYeviqBz6rkCy12mUSDQX9RdoZf';
/** 位置置换（对合置换，编解码同表）：final[i] = base58Digits[PERM[i]]。
 *  用 B站公开接口的 20+ 权威 (aid, bvid) 对逐一验证过。 */
const PERM = [6, 4, 2, 3, 1, 5, 0, 7, 8];

/** av 号转 BV 号（输入非法返回 null）。 */
export function av2bv(aid: number): string | null {
  if (!Number.isFinite(aid) || aid <= 0 || aid >= Number(MAX_AID)) return null;
  const filled = new Array<string>(9).fill('*');
  let tmp = (MAX_AID | BigInt(Math.floor(aid))) ^ XOR_CODE;
  // 58 进制从低位到高位填到数组尾部（filled 尾部 = 最低位）
  let index = filled.length - 1;
  while (tmp > 0n) {
    filled[index] = ALPHABET[Number(tmp % BASE)];
    tmp /= BASE;
    index -= 1;
  }
  const result = new Array<string>(9);
  for (let i = 0; i < PERM.length; i++) result[i] = filled[PERM[i]];
  return `BV1${result.join('')}`;
}

/** BV 号转 av 号（格式非法返回 null）。BV 号大小写敏感，不能转大写。 */
export function bv2av(bvid: string): number | null {
  const normalized = bvid.trim();
  if (!/^BV1[0-9A-Za-z]{9}$/.test(normalized)) return null;
  const chars = normalized.slice(3).split('');
  const filled = new Array<string>(9);
  for (let i = 0; i < PERM.length; i++) filled[i] = chars[PERM[i]];
  let tmp = 0n;
  for (const char of filled) {
    const digit = ALPHABET.indexOf(char);
    if (digit < 0) return null;
    tmp = tmp * BASE + BigInt(digit);
  }
  return Number((tmp & MASK_CODE) ^ XOR_CODE);
}
