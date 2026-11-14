import { GoogleGenAI } from '@google/genai';

export class GeminiServiceError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const RATE_LIMIT_COOLDOWN_MS = 65_000;
const INVALID_KEY_COOLDOWN_MS = 10 * 60_000;
const DEFAULT_ATTEMPT_TIMEOUT_MS = 28_000;
const DEFAULT_FAILOVER_BUDGET_MS = 48_000;

export interface FailoverOptions {
  timeoutMs?: number;
  budgetMs?: number;
}

interface PoolAttemptLog {
  at: string;
  keySlot: string;
  elapsedMs: number;
  outcome: 'ok' | 'rate_limit' | 'invalid_key' | 'transient' | 'error';
  detail?: string;
}

const keyCooldownUntil = new Map<string, number>();
const recentAttemptLogs: PoolAttemptLog[] = [];
let roundRobinCursor = 0;

function recordAttempt(entry: PoolAttemptLog): void {
  recentAttemptLogs.push(entry);
  if (recentAttemptLogs.length > 15) {
    recentAttemptLogs.shift();
  }
}

function isValidKeyCandidate(val: string | undefined): val is string {
  if (!val) return false;
  const trimmed = val.trim();
  if (trimmed.length < 15) return false;
  if (trimmed.startsWith('MY_GEMINI_API_KEY')) return false;
  return true;
}

export function collectGeminiApiKeys(): string[] {
  const candidates: string[] = [];

  for (let i = 1; i <= 10; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`];
    if (isValidKeyCandidate(k)) candidates.push(k.trim());
  }

  if (isValidKeyCandidate(process.env.GEMINI_API_KEY)) {
    candidates.push(process.env.GEMINI_API_KEY!.trim());
  }

  const listRaw = process.env.GEMINI_API_KEYS || '';
  if (listRaw) {
    for (const part of listRaw.split(/[\s,;]+/)) {
      if (isValidKeyCandidate(part)) candidates.push(part.trim());
    }
  }

  return Array.from(new Set(candidates));
}

export function getGeminiKeysCount(): number {
  return collectGeminiApiKeys().length;
}

export function getGeminiPoolStatus(): {
  configuredKeysCount: number;
  activeKeysCount: number;
  cooledDownKeysCount: number;
  recentAttempts: PoolAttemptLog[];
} {
  const keys = collectGeminiApiKeys();
  const now = Date.now();
  let cooledDownKeysCount = 0;
  for (const key of keys) {
    const until = keyCooldownUntil.get(key) || 0;
    if (until > now) cooledDownKeysCount++;
  }
  return {
    configuredKeysCount: keys.length,
    activeKeysCount: Math.max(0, keys.length - cooledDownKeysCount),
    cooledDownKeysCount,
    recentAttempts: [...recentAttemptLogs],
  };
}

function createGeminiClient(apiKey: string, timeoutMs = DEFAULT_ATTEMPT_TIMEOUT_MS): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: timeoutMs,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isQuotaOrRateLimitError(err: any): boolean {
  const status = typeof err?.status === 'number' ? err.status : 0;
  const msg = String(err?.message || err || '');
  return (
    status === 429 ||
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.toLowerCase().includes('too many requests') ||
    msg.toLowerCase().includes('quota')
  );
}

function isInvalidKeyError(err: any): boolean {
  const status = typeof err?.status === 'number' ? err.status : 0;
  const msg = String(err?.message || err || '');
  return (
    status === 403 ||
    status === 400 ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('API_KEY_INVALID') ||
    msg.includes('API key not valid')
  );
}

function isTransientError(err: any): boolean {
  const status = typeof err?.status === 'number' ? err.status : 0;
  const name = String(err?.name || '');
  const msg = String(err?.message || err || '');
  const lower = msg.toLowerCase();
  return (
    status === 500 ||
    status === 503 ||
    status === 504 ||
    name === 'AbortError' ||
    name === 'TimeoutError' ||
    msg.includes('503') ||
    msg.includes('500') ||
    msg.includes('504') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ETIMEDOUT') ||
    lower.includes('aborterror') ||
    lower.includes('aborted') ||
    lower.includes('timeout') ||
    lower.includes('fetch failed') ||
    msg.includes('UNAVAILABLE') ||
    lower.includes('overloaded')
  );
}

export function mapGeminiErrorToHttp(
  err: any,
  modelName = 'gemini-4-hydrogen'
): { status: number; message: string } {
  const rawMessage = String(err?.message || err || 'Unknown Gemini API error');
  const name = String(err?.name || '');
  const lower = rawMessage.toLowerCase();
  const status = typeof err?.status === 'number' ? err.status : 0;

  if (isInvalidKeyError(err)) {
    return {
      status: 403,
      message:
        'कन्फिगर गरिएको Gemini API Key अमान्य वा अनुमति नभएको देखियो। कृपया Settings > Secrets प्यानलमा GEMINI_API_KEY_1..6 जाँच गर्नुहोस्।',
    };
  }

  if (isQuotaOrRateLimitError(err)) {
    return {
      status: 429,
      message:
        'सबै उपलब्ध Gemini API Key हरूको कोटा सीमा (429 RESOURCE_EXHAUSTED) अस्थायी रूपमा पूरा भएको छ। कृपया केही सेकेन्डपछि स्वतः वा पुनः प्रयास गर्नुहोस्।',
    };
  }

  if (
    status === 504 ||
    name === 'AbortError' ||
    name === 'TimeoutError' ||
    lower.includes('aborted') ||
    lower.includes('timeout')
  ) {
    return {
      status: 504,
      message: `PDF फाइल प्रशोधन वा Gemini अनुरोध समय सीमा (Timeout) नाघ्यो: ${rawMessage}`,
    };
  }

  if (status === 404 || rawMessage.includes('NOT_FOUND')) {
    return {
      status: 404,
      message: `चयन गरिएको Gemini मोडल (${modelName}) फेला परेन: ${rawMessage}`,
    };
  }

  return {
    status: status >= 400 && status < 600 ? status : 500,
    message: `सारांश तयार गर्न असफल भयो: ${rawMessage}`,
  };
}

/**
 * Executes a Gemini operation using round-robin load distribution across all
 * configured keys with automatic failover on 429/403/5xx/timeout errors within
 * a bounded overall budget so HTTP requests never hit gateway timeouts.
 */
export async function runWithGeminiKeyFailover<T>(
  operation: (ai: GoogleGenAI) => Promise<T>,
  modelName = 'gemini-4-hydrogen',
  options?: FailoverOptions
): Promise<T> {
  const keys = collectGeminiApiKeys();
  if (keys.length === 0) {
    throw new GeminiServiceError(
      503,
      'सर्भरमा GEMINI_API_KEY_1..6 वा GEMINI_API_KEY कन्फिगर गरिएको छैन। कृपया Settings > Secrets प्यानलमा Key हरू राख्नुहोस्।'
    );
  }

  const attemptTimeoutMs = options?.timeoutMs ?? DEFAULT_ATTEMPT_TIMEOUT_MS;
  const failoverBudgetMs = options?.budgetMs ?? DEFAULT_FAILOVER_BUDGET_MS;

  const now = Date.now();
  const orderedSlots: { key: string; slotLabel: string }[] = [];
  for (let offset = 0; offset < keys.length; offset++) {
    const idx = (roundRobinCursor + offset) % keys.length;
    orderedSlots.push({ key: keys[idx], slotLabel: `Key #${idx + 1}` });
  }
  roundRobinCursor = (roundRobinCursor + 1) % keys.length;

  const readySlots = orderedSlots.filter(s => (keyCooldownUntil.get(s.key) || 0) <= now);
  const candidateSlots = readySlots.length > 0 ? readySlots : orderedSlots;

  let lastError: any = null;
  const startedAllAt = Date.now();

  for (const { key: apiKey, slotLabel } of candidateSlots) {
    if (Date.now() - startedAllAt > failoverBudgetMs && lastError) {
      break;
    }

    const ai = createGeminiClient(apiKey, attemptTimeoutMs);
    const attemptStart = Date.now();

    try {
      const result = await operation(ai);
      keyCooldownUntil.delete(apiKey);
      recordAttempt({
        at: new Date().toISOString(),
        keySlot: slotLabel,
        elapsedMs: Date.now() - attemptStart,
        outcome: 'ok',
      });
      return result;
    } catch (err: any) {
      const elapsedMs = Date.now() - attemptStart;
      const errDetail = String(err?.message || err || '').slice(0, 180);
      lastError = err;

      if (isQuotaOrRateLimitError(err)) {
        keyCooldownUntil.set(apiKey, Date.now() + RATE_LIMIT_COOLDOWN_MS);
        recordAttempt({ at: new Date().toISOString(), keySlot: slotLabel, elapsedMs, outcome: 'rate_limit', detail: errDetail });
        continue;
      }
      if (isInvalidKeyError(err)) {
        keyCooldownUntil.set(apiKey, Date.now() + INVALID_KEY_COOLDOWN_MS);
        recordAttempt({ at: new Date().toISOString(), keySlot: slotLabel, elapsedMs, outcome: 'invalid_key', detail: errDetail });
        continue;
      }
      if (isTransientError(err)) {
        recordAttempt({ at: new Date().toISOString(), keySlot: slotLabel, elapsedMs, outcome: 'transient', detail: errDetail });
        continue;
      }

      recordAttempt({ at: new Date().toISOString(), keySlot: slotLabel, elapsedMs, outcome: 'error', detail: errDetail });
      if (err instanceof GeminiServiceError) throw err;
      const mapped = mapGeminiErrorToHttp(err, modelName);
      throw new GeminiServiceError(mapped.status, mapped.message);
    }
  }

  if (lastError instanceof GeminiServiceError) throw lastError;
  const mapped = mapGeminiErrorToHttp(lastError, modelName);
  throw new GeminiServiceError(mapped.status, mapped.message);
}
