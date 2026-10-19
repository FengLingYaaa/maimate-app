import * as SecureStore from 'expo-secure-store';
import type { PlayerProfile, PlayerScore } from '../data/types';
import { optionalFiniteNumber } from '../data/score-import-fields';
import { PROBER_API_BASE } from '../constants/game';

const TOKEN_KEY = 'maimate_diving_fish_import_token';
// The official login_or_token_required decorator accepts Import-Token on /player/validate.
const VALIDATE_URL = `${PROBER_API_BASE}/player/validate`;
const RECORDS_URL = `${PROBER_API_BASE}/player/records`;

export class ScoreImportError extends Error {
  readonly kind: 'invalid-token' | 'forbidden' | 'network' | 'invalid-response';

  constructor(kind: ScoreImportError['kind'], message: string) {
    super(message);
    this.name = 'ScoreImportError';
    this.kind = kind;
  }
}

function normalizeToken(value: string): string {
  const input = value.trim();
  if (!input) return '';
  try {
    const url = new URL(input);
    const token = url.searchParams.get('token')
      || url.searchParams.get('Import-Token')
      || url.searchParams.get('import_token');
    return token?.trim() || '';
  } catch {
    return input;
  }
}

export function extractImportToken(value: string): string {
  return normalizeToken(value);
}

export function maskImportToken(value: string): string {
  if (value.length <= 8) return value ? '••••••••' : '';
  return `${value.slice(0, 4)}••••••••${value.slice(-4)}`;
}

export async function readStoredImportToken(): Promise<string> {
  return (await SecureStore.getItemAsync(TOKEN_KEY)) || '';
}

export async function saveImportToken(value: string): Promise<void> {
  const token = normalizeToken(value);
  if (!token) throw new ScoreImportError('invalid-token', '请输入有效的 Diving-Fish Token 或 Shadowrocket 链接');
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function deleteImportToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function requestJson(url: string, token: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { 'Import-Token': token },
    });
  } catch {
    throw new ScoreImportError('network', '无法连接 Diving-Fish，请检查网络后重试');
  }

  if (response.status === 400 || response.status === 401) {
    const body = await response.clone().json().catch(() => null) as { message?: unknown } | null;
    const message = typeof body?.message === 'string' ? body.message : '';
    if (/导入token有误|import.?token.*invalid|invalid.*import.?token/i.test(message)) {
      throw new ScoreImportError('invalid-token', 'Diving-Fish 拒绝了 Import-Token（HTTP 400）。请确认粘贴的是当前账号生成的“成绩导入 Token”；如果刚刚重新生成，请改用最新的 Token。');
    }
    if (response.status === 401) {
      throw new ScoreImportError('invalid-token', `Diving-Fish 返回 HTTP 401${message ? `：${message}` : ''}。请确认使用的是成绩导入 Import-Token。`);
    }
    throw new ScoreImportError('invalid-response', `Diving-Fish 返回 HTTP ${response.status}${message ? `：${message}` : ''}`);
  }
  if (response.status === 403) {
    throw new ScoreImportError('forbidden', 'Diving-Fish 返回 403，当前服务策略拒绝了此请求；这不一定表示 Token 错误。请使用应用内“诊断成绩连接”检查端点，并稍后重试或联系 Diving-Fish。');
  }
  if (!response.ok) {
    throw new ScoreImportError('network', `Diving-Fish 暂时无法响应（HTTP ${response.status}），请稍后重试`);
  }

  try {
    return await response.json();
  } catch {
    throw new ScoreImportError('invalid-response', 'Diving-Fish 返回了无法识别的数据');
  }
}

export async function validateImportToken(value: string): Promise<void> {
  const token = normalizeToken(value);
  if (!token) throw new ScoreImportError('invalid-token', '请输入有效的 Token');
  // `/player/validate` uses Diving-Fish's login-or-token auth decorator and
  // confirms Import-Token validity without downloading the player's full records.
  // Only persist the proposed token in SecureStore after this succeeds.
  const payload = await requestJson(VALIDATE_URL, token);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ScoreImportError('invalid-response', '成绩 Token 验证响应无法识别');
  }
  const body = payload as { username?: unknown; login_type?: unknown; message?: unknown };
  if (body.message !== 'ok' || typeof body.username !== 'string' || !body.username.trim()) {
    throw new ScoreImportError('invalid-response', 'Diving-Fish 验证响应缺少有效账户信息，接口格式可能已变更。');
  }
}

interface DivingFishRecord {
  song_id?: unknown;
  title?: unknown;
  type?: unknown;
  ds?: unknown;
  level?: unknown;
  level_index?: unknown;
  level_label?: unknown;
  achievements?: unknown;
  dxScore?: unknown;
  rate?: unknown;
  fc?: unknown;
  fs?: unknown;
  ra?: unknown;
}

interface DivingFishResponse {
  username?: unknown;
  nickname?: unknown;
  rating?: unknown;
  additional_rating?: unknown;
  plate?: unknown;
  records?: unknown;
  ratingSummary?: unknown;
}

function normalizeRecord(value: unknown, importedAt: number): PlayerScore | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as DivingFishRecord;
  const songId = String(record.song_id ?? '');
  const type = record.type === 'SD' || record.type === 'DX' ? record.type : null;
  const difficultyIndex = Number(record.level_index);
  const achievement = optionalFiniteNumber(record.achievements);
  const dxScore = optionalFiniteNumber(record.dxScore);
  if (!songId || !type || !Number.isInteger(difficultyIndex) || difficultyIndex < 0) return null;
  if (achievement === undefined || dxScore === undefined) return null;

  return {
    songId,
    type,
    difficultyIndex,
    achievement,
    dxScore,
    title: typeof record.title === 'string' ? record.title : undefined,
    ds: optionalFiniteNumber(record.ds),
    level: typeof record.level === 'string' ? record.level : undefined,
    levelLabel: typeof record.level_label === 'string' ? record.level_label : undefined,
    rate: typeof record.rate === 'string' ? record.rate : undefined,
    fc: typeof record.fc === 'string' && record.fc ? record.fc : undefined,
    fs: typeof record.fs === 'string' && record.fs ? record.fs : undefined,
    serverRating: optionalFiniteNumber(record.ra),
    importedAt,
  };
}

export interface ImportedScoresResult {
  scores: PlayerScore[];
  serverRating: number | null;
  profile: PlayerProfile;
}

export async function fetchImportedScores(value: string): Promise<ImportedScoresResult> {
  const token = normalizeToken(value);
  if (!token) throw new ScoreImportError('invalid-token', '请输入有效的 Token');
  const payload = await requestJson(RECORDS_URL, token);
  if (!payload || typeof payload !== 'object') {
    throw new ScoreImportError('invalid-response', '成绩响应格式无法识别');
  }
  const body: DivingFishResponse = Array.isArray(payload)
    ? { records: payload, rating: null }
    : payload as DivingFishResponse;
  if (!Array.isArray(body.records)) {
    throw new ScoreImportError('invalid-response', '成绩响应中没有 records 列表');
  }
  const importedAt = Date.now();
  const scores = body.records
    .map(record => normalizeRecord(record, importedAt))
    .filter((record): record is PlayerScore => record !== null);
  if (body.records.length > 0 && scores.length === 0) {
    throw new ScoreImportError('invalid-response', '没有可识别的成绩记录');
  }

  const profile: PlayerProfile = {
    username: typeof body.username === 'string' ? body.username : undefined,
    nickname: typeof body.nickname === 'string' ? body.nickname : undefined,
    rating: optionalFiniteNumber(body.rating),
    additionalRating: optionalFiniteNumber(body.additional_rating),
    plate: typeof body.plate === 'string' ? body.plate : undefined,
  };

  return {
    scores,
    serverRating: profile.rating ?? null,
    profile,
  };
}
