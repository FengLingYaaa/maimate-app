import * as SecureStore from 'expo-secure-store';
import type { PlayerScore } from '../data/types';
import { PROBER_API_BASE } from '../constants/game';

const TOKEN_KEY = 'maimate_diving_fish_import_token';
const VALIDATE_URL = `${PROBER_API_BASE}/player/validate`;
const RECORDS_URL = `${PROBER_API_BASE}/player/records`;

export class ScoreImportError extends Error {
  readonly kind: 'invalid-token' | 'network' | 'invalid-response';

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

  if (response.status === 400 || response.status === 401 || response.status === 403) {
    throw new ScoreImportError('invalid-token', 'Token 无效或已失效');
  }
  if (!response.ok) {
    throw new ScoreImportError('network', 'Diving-Fish 暂时无法响应，请稍后重试');
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
  const payload = await requestJson(VALIDATE_URL, token);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ScoreImportError('invalid-response', 'Token 验证结果无法识别');
  }
  const body = payload as { message?: unknown; valid?: unknown };
  if (body.valid === false || (typeof body.message === 'string' && /invalid|error|fail/i.test(body.message))) {
    throw new ScoreImportError('invalid-token', 'Token 无效或已失效');
  }
}

interface DivingFishRecord {
  song_id?: unknown;
  type?: unknown;
  level_index?: unknown;
  achievements?: unknown;
  dxScore?: unknown;
  fc?: unknown;
  fs?: unknown;
  ra?: unknown;
}

function normalizeRecord(value: unknown, importedAt: number): PlayerScore | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as DivingFishRecord;
  const songId = String(record.song_id ?? '');
  const type = record.type === 'SD' || record.type === 'DX' ? record.type : null;
  const difficultyIndex = Number(record.level_index);
  const achievement = Number(record.achievements);
  const dxScore = Number(record.dxScore);
  if (!songId || !type || !Number.isInteger(difficultyIndex) || difficultyIndex < 0) return null;
  if (!Number.isFinite(achievement) || !Number.isFinite(dxScore)) return null;

  return {
    songId,
    type,
    difficultyIndex,
    achievement,
    dxScore,
    fc: typeof record.fc === 'string' && record.fc ? record.fc : undefined,
    fs: typeof record.fs === 'string' && record.fs ? record.fs : undefined,
    serverRating: Number.isFinite(Number(record.ra)) ? Number(record.ra) : undefined,
    importedAt,
  };
}

export interface ImportedScoresResult {
  scores: PlayerScore[];
  serverRating: number | null;
}

export async function fetchImportedScores(value: string): Promise<ImportedScoresResult> {
  const token = normalizeToken(value);
  if (!token) throw new ScoreImportError('invalid-token', '请输入有效的 Token');
  const payload = await requestJson(RECORDS_URL, token);
  if (!payload || typeof payload !== 'object') {
    throw new ScoreImportError('invalid-response', '成绩响应格式无法识别');
  }
  const body = Array.isArray(payload)
    ? { records: payload, rating: null }
    : payload as { records?: unknown; rating?: unknown };
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

  return {
    scores,
    serverRating: Number.isFinite(Number(body.rating)) ? Number(body.rating) : null,
  };
}
