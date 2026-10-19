import { PROBER_API_BASE } from '../constants/game';

export interface ScoreImportDiagnostic {
  endpoint: string;
  status: number | null;
  message: string | null;
  kind: 'reachable' | 'invalid-token' | 'blocked' | 'rate-limited' | 'server-error' | 'network-error' | 'unexpected-success';
}

/** Check both endpoints involved in token validation and score import. */
export const SCORE_IMPORT_DIAGNOSTIC_ENDPOINTS = ['/player/validate', '/player/records'] as const;

function responseMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const message = (payload as { message?: unknown }).message;
  return typeof message === 'string' && message.trim() ? message.trim() : null;
}

export function classifyScoreImportDiagnostic(status: number | null, message: string | null): ScoreImportDiagnostic['kind'] {
  if (status === null) return 'network-error';
  if (status >= 200 && status < 300) return 'unexpected-success';
  const normalized = (message ?? '').toLocaleLowerCase();
  if (status === 400 || status === 401) {
    return /导入token|import.?token|token.*(错|无效|失效)|invalid.*token/.test(normalized) ? 'invalid-token' : 'reachable';
  }
  if (status === 403) return 'blocked';
  if (status === 429) return 'rate-limited';
  if (status >= 500) return 'server-error';
  return 'reachable';
}

/**
 * Diagnose the supported records endpoint with an intentionally invalid token.
 * This only measures reachability and never sends the user's saved Token.
 */
export async function diagnoseScoreImportEndpoints(
  request: typeof fetch = fetch,
  timeoutMs = 12_000,
): Promise<ScoreImportDiagnostic[]> {
  const base = PROBER_API_BASE;
  return Promise.all(SCORE_IMPORT_DIAGNOSTIC_ENDPOINTS.map(async endpoint => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await request(`${base}${endpoint}`, {
        method: 'GET',
        headers: { 'Import-Token': '__maimate_network_diagnostic_invalid_token__' },
        signal: controller.signal,
      });
      let message: string | null = null;
      try {
        message = responseMessage(await response.json());
      } catch {
        // A non-JSON response still proves that the endpoint answered.
      }
      return { endpoint, status: response.status, message, kind: classifyScoreImportDiagnostic(response.status, message) };
    } catch {
      return { endpoint, status: null, message: null, kind: 'network-error' };
    } finally {
      clearTimeout(timeout);
    }
  }));
}
