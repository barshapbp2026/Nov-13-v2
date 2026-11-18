import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export class GeminiServiceError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const RATE_LIMIT_COOLDOWN_MS = 65_000;
const TRANSIENT_COOLDOWN_MS = 90_000;
const INVALID_KEY_COOLDOWN_MS = 10 * 60_000;
const DEFAULT_ATTEMPT_TIMEOUT_MS = 11_000;
const DEFAULT_FAILOVER_BUDGET_MS = 22_000;

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
const invalidKeySlotMap = new Map<string, string>();
const recentAttemptLogs: PoolAttemptLog[] = [];
let roundRobinCursor = 0;

function cooldownKey(modelName: string, apiKey: string): string {
  return `${modelName}::${apiKey}`;
}

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

export interface NamedGeminiKey {
  slotLabel: string;
  key: string;
}

export function parseBulkGeminiKeys(rawText: string | undefined): string[] {
  if (!rawText) return [];
  const noComments = rawText
    .split(/\r?\n/)
    .map(line => line.replace(/^\s*#.*$/, ''))
    .join('\n');

  const results: string[] = [];
  for (const token of noComments.split(/[\s,;="'`:]+/)) {
    const clean = token.trim();
    if (!clean) continue;
    if (/^GEMINI_API_KEY/i.test(clean)) continue;
    if (isValidKeyCandidate(clean)) {
      results.push(clean);
    }
  }
  return results;
}

export function collectNamedGeminiApiKeys(): NamedGeminiKey[] {
  const entries: NamedGeminiKey[] = [];
  const seenKeys = new Set<string>();

  const tryAdd = (slotLabel: string, rawVal: string | undefined) => {
    if (!isValidKeyCandidate(rawVal)) return;
    const trimmed = rawVal.trim();
    if (seenKeys.has(trimmed)) return;
    seenKeys.add(trimmed);
    entries.push({ slotLabel, key: trimmed });
  };

  for (let i = 1; i <= 10; i++) {
    const name = `GEMINI_API_KEY_${i}`;
    tryAdd(name, process.env[name]);
  }

  tryAdd('GEMINI_API_KEY', process.env.GEMINI_API_KEY);

  const listRaw = process.env.GEMINI_API_KEYS || '';
  if (listRaw) {
    let idx = 1;
    for (const part of parseBulkGeminiKeys(listRaw)) {
      tryAdd(`GEMINI_API_KEYS[${idx++}]`, part);
    }
  }

  return entries;
}

export function collectGeminiApiKeys(): string[] {
  return collectNamedGeminiApiKeys().map(e => e.key);
}

export function getGeminiKeysCount(): number {
  return collectNamedGeminiApiKeys().length;
}

export function getGeminiPoolStatus(): {
  configuredKeysCount: number;
  activeKeysCount: number;
  cooledDownKeysCount: number;
  configuredSlots: string[];
  invalidKeySlots: string[];
  recentAttempts: PoolAttemptLog[];
} {
  const entries = collectNamedGeminiApiKeys();
  const now = Date.now();
  let cooledDownKeysCount = 0;
  const invalidKeySlots: string[] = [];
  for (const { key, slotLabel } of entries) {
    const primaryUntil = keyCooldownUntil.get(cooldownKey('gemini-4-hydrogen', key)) || 0;
    const fallbackUntil = keyCooldownUntil.get(cooldownKey('gemini-3.1-flash-lite', key)) || 0;
    if (primaryUntil > now && fallbackUntil > now) cooledDownKeysCount++;
    if (invalidKeySlotMap.has(key)) {
      invalidKeySlots.push(slotLabel);
    }
  }
  return {
    configuredKeysCount: entries.length,
    activeKeysCount: Math.max(0, entries.length - cooledDownKeysCount),
    cooledDownKeysCount,
    configuredSlots: entries.map(e => e.slotLabel),
    invalidKeySlots,
    recentAttempts: [...recentAttemptLogs],
  };
}

export interface KeyVerificationResult {
  slot: string;
  status: 'ok' | 'invalid_key' | 'rate_limit' | 'timeout' | 'not_set' | 'duplicate' | 'error';
  httpCode?: number;
  elapsedMs: number;
  detail?: string;
}

export async function verifyAllGeminiKeys(
  model = 'gemini-4-hydrogen'
): Promise<KeyVerificationResult[]> {
  const rawSlots: { slot: string; raw: string | undefined }[] = [];
  for (let i = 1; i <= 6; i++) {
    const name = `GEMINI_API_KEY_${i}`;
    rawSlots.push({ slot: name, raw: process.env[name] });
  }
  for (let i = 7; i <= 10; i++) {
    const name = `GEMINI_API_KEY_${i}`;
    if (process.env[name]) rawSlots.push({ slot: name, raw: process.env[name] });
  }
  rawSlots.push({ slot: 'GEMINI_API_KEY', raw: process.env.GEMINI_API_KEY });

  const listRaw = process.env.GEMINI_API_KEYS || '';
  if (listRaw.trim()) {
    let idx = 1;
    for (const part of parseBulkGeminiKeys(listRaw)) {
      rawSlots.push({ slot: `GEMINI_API_KEYS[${idx++}]`, raw: part });
    }
  }

  const seenKeyToSlot = new Map<string, string>();
  const thinkingLevel = model === 'gemini-3.1-flash-lite' ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW;
  const checks = rawSlots.map(async ({ slot, raw }): Promise<KeyVerificationResult> => {
    const trimmed = (raw || '').trim();
    if (!isValidKeyCandidate(trimmed)) {
      return {
        slot,
        status: 'not_set',
        elapsedMs: 0,
        detail: trimmed ? 'Placeholder or malformed value' : 'Not configured in Secrets',
      };
    }

    const firstSlot = seenKeyToSlot.get(trimmed);
    if (firstSlot) {
      return {
        slot,
        status: 'duplicate',
        elapsedMs: 0,
        detail: `Same key value as ${firstSlot}`,
      };
    }
    seenKeyToSlot.set(trimmed, slot);

    const t0 = Date.now();
    const ai = createGeminiClient(trimmed, 12_000);
    try {
      await ai.models.generateContent({
        model,
        contents: 'OK',
        config: { thinkingConfig: { thinkingLevel } },
      });
      keyCooldownUntil.delete(cooldownKey(model, trimmed));
      invalidKeySlotMap.delete(trimmed);
      return { slot, status: 'ok', httpCode: 200, elapsedMs: Date.now() - t0 };
    } catch (err: any) {
      const elapsedMs = Date.now() - t0;
      const code = typeof err?.status === 'number' ? err.status : undefined;
      const detail = String(err?.message || err || '').slice(0, 140);
      if (isInvalidKeyError(err)) {
        keyCooldownUntil.set(trimmed, Date.now() + INVALID_KEY_COOLDOWN_MS);
        invalidKeySlotMap.set(trimmed, slot);
        return { slot, status: 'invalid_key', httpCode: code || 401, elapsedMs, detail };
      }
      if (isQuotaOrRateLimitError(err)) {
        return { slot, status: 'rate_limit', httpCode: code || 429, elapsedMs, detail };
      }
      if (isTransientError(err)) {
        return { slot, status: 'timeout', httpCode: code || 504, elapsedMs, detail };
      }
      return { slot, status: 'error', httpCode: code, elapsedMs, detail };
    }
  });

  return Promise.all(checks);
}

function createGeminiClient(apiKey: string, timeoutMs = DEFAULT_ATTEMPT_TIMEOUT_MS): GoogleGenAI {
  // Gemini API enforces a minimum 10s request deadline (returns 400 INVALID_ARGUMENT below 10s)
  const safeTimeoutMs = Math.max(10_500, timeoutMs);
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: safeTimeoutMs,
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
    status === 401 ||
    status === 403 ||
    msg.includes('UNAUTHENTICATED') ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('API_KEY_INVALID') ||
    msg.includes('API key not valid') ||
    msg.includes('API key expired')
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
  const entries = collectNamedGeminiApiKeys();
  if (entries.length === 0) {
    throw new GeminiServiceError(
      503,
      'सर्भरमा GEMINI_API_KEY_1..6 वा GEMINI_API_KEY कन्फिगर गरिएको छैन। कृपया Settings > Secrets प्यानलमा Key हरू राख्नुहोस्।'
    );
  }

  const attemptTimeoutMs = options?.timeoutMs ?? DEFAULT_ATTEMPT_TIMEOUT_MS;
  const failoverBudgetMs = options?.budgetMs ?? DEFAULT_FAILOVER_BUDGET_MS;

  const now = Date.now();
  const orderedSlots: NamedGeminiKey[] = [];
  for (let offset = 0; offset < entries.length; offset++) {
    const idx = (roundRobinCursor + offset) % entries.length;
    orderedSlots.push(entries[idx]);
  }
  roundRobinCursor = (roundRobinCursor + 1) % entries.length;

  const nonInvalidSlots = orderedSlots.filter(s => !invalidKeySlotMap.has(s.key));
  const poolSlots = nonInvalidSlots.length > 0 ? nonInvalidSlots : orderedSlots;
  const readySlots = poolSlots.filter(
    s => (keyCooldownUntil.get(cooldownKey(modelName, s.key)) || 0) <= now
  );
  const candidateSlots =
    readySlots.length > 0
      ? readySlots
      : [...poolSlots].sort(
          (a, b) =>
            (keyCooldownUntil.get(cooldownKey(modelName, a.key)) || 0) -
            (keyCooldownUntil.get(cooldownKey(modelName, b.key)) || 0)
        );

  let lastError: any = null;
  const startedAllAt = Date.now();

  for (const { key: apiKey, slotLabel } of candidateSlots) {
    const elapsedTotal = Date.now() - startedAllAt;
    if (lastError && (elapsedTotal >= failoverBudgetMs || failoverBudgetMs - elapsedTotal < 10_500)) {
      break;
    }

    const remainingBudget = Math.max(10_500, failoverBudgetMs - elapsedTotal);
    const effectiveAttemptTimeout = Math.max(10_500, Math.min(attemptTimeoutMs, remainingBudget));
    const ai = createGeminiClient(apiKey, effectiveAttemptTimeout);
    const attemptStart = Date.now();

    try {
      const result = await operation(ai);
      keyCooldownUntil.delete(cooldownKey(modelName, apiKey));
      invalidKeySlotMap.delete(apiKey);
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
        keyCooldownUntil.set(cooldownKey(modelName, apiKey), Date.now() + RATE_LIMIT_COOLDOWN_MS);
        recordAttempt({ at: new Date().toISOString(), keySlot: slotLabel, elapsedMs, outcome: 'rate_limit', detail: errDetail });
        continue;
      }
      if (isInvalidKeyError(err)) {
        keyCooldownUntil.set(cooldownKey(modelName, apiKey), Date.now() + INVALID_KEY_COOLDOWN_MS);
        invalidKeySlotMap.set(apiKey, slotLabel);
        recordAttempt({ at: new Date().toISOString(), keySlot: slotLabel, elapsedMs, outcome: 'invalid_key', detail: errDetail });
        continue;
      }
      if (isTransientError(err)) {
        keyCooldownUntil.set(cooldownKey(modelName, apiKey), Date.now() + TRANSIENT_COOLDOWN_MS);
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
