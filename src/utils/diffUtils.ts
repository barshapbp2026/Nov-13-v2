export interface DiffSegment {
  type: 'same' | 'removed' | 'added';
  text: string;
}

export interface TextDiffSummary {
  segments: DiffSegment[];
  similarityPercent: number;
  addedTokens: number;
  removedTokens: number;
  sameTokens: number;
}

/**
 * Tokenizes Nepali/Devanagari & mixed Latin text cleanly by words/whitespace
 * without splitting Devanagari combining vowel signs or halant clusters.
 */
function tokenizeForDiff(text: string): string[] {
  const clean = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!clean) return [];
  return clean.split(/\s+/).filter(Boolean);
}

/**
 * Computes a word-level Longest Common Subsequence diff between `leftText`
 * (मूल / संशोधनपूर्व) and `rightText` (तुलना / संशोधनपछि), coalescing adjacent
 * runs of the same operation for clean UI rendering.
 */
export function computeWordDiff(leftText: string, rightText: string): TextDiffSummary {
  const a = tokenizeForDiff(leftText);
  const b = tokenizeForDiff(rightText);

  if (a.length === 0 && b.length === 0) {
    return {
      segments: [],
      similarityPercent: 100,
      addedTokens: 0,
      removedTokens: 0,
      sameTokens: 0,
    };
  }
  if (a.length === 0) {
    return {
      segments: [{ type: 'added', text: b.join(' ') }],
      similarityPercent: 0,
      addedTokens: b.length,
      removedTokens: 0,
      sameTokens: 0,
    };
  }
  if (b.length === 0) {
    return {
      segments: [{ type: 'removed', text: a.join(' ') }],
      similarityPercent: 0,
      addedTokens: 0,
      removedTokens: a.length,
      sameTokens: 0,
    };
  }

  // Guard DP size for very large texts by trimming common prefix/suffix first
  let prefixLen = 0;
  const minLen = Math.min(a.length, b.length);
  while (prefixLen < minLen && a[prefixLen] === b[prefixLen]) {
    prefixLen++;
  }

  let suffixLen = 0;
  while (
    suffixLen < minLen - prefixLen &&
    a[a.length - 1 - suffixLen] === b[b.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const midA = a.slice(prefixLen, a.length - suffixLen);
  const midB = b.slice(prefixLen, b.length - suffixLen);

  // If still huge (> 450 tokens each), fall back to sentence-level LCS
  if (midA.length * midB.length > 200_000) {
    return computeSentenceDiff(leftText, rightText);
  }

  const m = midA.length;
  const n = midB.length;
  const dp: Uint16Array[] = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (midA[i] === midB[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = dp[i + 1][j] >= dp[i][j + 1] ? dp[i + 1][j] : dp[i][j + 1];
      }
    }
  }

  const rawOps: { type: 'same' | 'removed' | 'added'; token: string }[] = [];
  for (let k = 0; k < prefixLen; k++) {
    rawOps.push({ type: 'same', token: a[k] });
  }

  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (midA[i] === midB[j]) {
      rawOps.push({ type: 'same', token: midA[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rawOps.push({ type: 'removed', token: midA[i] });
      i++;
    } else {
      rawOps.push({ type: 'added', token: midB[j] });
      j++;
    }
  }
  while (i < m) {
    rawOps.push({ type: 'removed', token: midA[i++] });
  }
  while (j < n) {
    rawOps.push({ type: 'added', token: midB[j++] });
  }

  for (let k = a.length - suffixLen; k < a.length; k++) {
    rawOps.push({ type: 'same', token: a[k] });
  }

  return coalesceOps(rawOps);
}

function computeSentenceDiff(leftText: string, rightText: string): TextDiffSummary {
  const splitSents = (txt: string) =>
    String(txt || '')
      .split(/(?<=[।.?!])\s+|\n+/)
      .map(s => s.trim())
      .filter(Boolean);

  const a = splitSents(leftText);
  const b = splitSents(rightText);
  const m = a.length;
  const n = b.length;
  const dp: Uint16Array[] = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = dp[i + 1][j] >= dp[i][j + 1] ? dp[i + 1][j] : dp[i][j + 1];
      }
    }
  }

  const rawOps: { type: 'same' | 'removed' | 'added'; token: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      rawOps.push({ type: 'same', token: a[i++] });
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rawOps.push({ type: 'removed', token: a[i++] });
    } else {
      rawOps.push({ type: 'added', token: b[j++] });
    }
  }
  while (i < m) rawOps.push({ type: 'removed', token: a[i++] });
  while (j < n) rawOps.push({ type: 'added', token: b[j++] });

  return coalesceOps(rawOps);
}

function coalesceOps(
  ops: { type: 'same' | 'removed' | 'added'; token: string }[]
): TextDiffSummary {
  const segments: DiffSegment[] = [];
  let sameTokens = 0;
  let removedTokens = 0;
  let addedTokens = 0;

  for (const op of ops) {
    if (op.type === 'same') sameTokens++;
    else if (op.type === 'removed') removedTokens++;
    else addedTokens++;

    const last = segments[segments.length - 1];
    if (last && last.type === op.type) {
      last.text += ` ${op.token}`;
    } else {
      segments.push({ type: op.type, text: op.token });
    }
  }

  const denom = Math.max(1, sameTokens + Math.max(removedTokens, addedTokens));
  const similarityPercent = Math.round((sameTokens / denom) * 100);

  return {
    segments,
    similarityPercent,
    addedTokens,
    removedTokens,
    sameTokens,
  };
}
