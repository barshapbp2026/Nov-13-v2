import type {
  DafaSummaryItem,
  PdfSummaryResult,
  StoredDafaSummaryRecord,
  StoredPdfSummaryRecord,
} from '../types';

const DEV_CHAR_CLASS = '\\u0900-\\u097F';

/**
 * Strips leaked Gemini thought traces, English meta-notes, raw JSON fragments,
 * PUA glyph artifacts, and truncated garbage from a single Nepali summary string.
 */
export function sanitizeNepaliSummaryText(raw: string | undefined | null): string {
  if (!raw) return '';
  let s = String(raw)
    // Remove Private Use Area glyph artifacts & stray HTML tags
    .replace(/[\uE000-\uF8FF]/g, '')
    .replace(/<\/?br\s*\/?>/gi, ' ')
    // Remove stray markdown backticks or leading stray punctuation/backticks
    .replace(/^`+\s*/g, '')
    .replace(/`+/g, '');

  // If Gemini wrote "Let me keep it clean: <Nepali>" or "Here is ...:" prefix, strip the English intro
  s = s.replace(/^\s*(?:Let\s+me\s+keep\s+it\s+clean|Here\s+is\s+the\s+clean\s+summary|Clean\s+summary)\s*:\s*/i, '');

  // If Gemini wrote "(Note: removing ...) -> <clean Nepali>", extract the clean Nepali after "->"
  const arrowMatch = s.match(/\(Note:[^)]*\)\s*->\s*([\s\S]+)$/i);
  if (arrowMatch && arrowMatch[1]) {
    const prefix = s
      .slice(0, s.indexOf('(Note:'))
      .replace(/\s*(?:Furthermore|Therefore|However|Actually|Moreover|Additionally)\s*,?\s*[^।]*$/i, '')
      .trim();
    const cleanedTail = arrowMatch[1].trim();
    s = prefix ? `${prefix} ${cleanedTail}` : cleanedTail;
  }

  // Cut off leaked JSON / keyObligations tail (both ASCII and curly quotes, or unquoted keyObligations:)
  const jsonTailIdx = s.search(/[”"']?\s*,?\s*[“"']?keyObligations[”"']?\s*:/i);
  if (jsonTailIdx > 0) {
    s = s.slice(0, jsonTailIdx);
  }
  s = s.replace(/[”"']?\s*,?\s*[“"']?(?:keyObligations|rowIndex|summaryNepali)[”"']?\s*:[\s\S]*$/i, '');

  // Cut off common Gemini English self-correction / meta-commentary prefixes or suffixes
  const metaCutPatterns = [
    /\s*Wait[—,\-:\s][\s\S]*$/i,
    /\s*Let['’]s[\s\S]*$/i,
    /\s*Actually[,\s][\s\S]*$/i,
    /\s*Note\s*:[\s\S]*$/i,
    /\s*However\s*,[\s\S]*$/i,
    /\s*Therefore\s*,[\s\S]*$/i,
    /\s*This\s+summary\s+is\s+for\s+educational[\s\S]*$/i,
    /\s*Done\.\s*End\.[\s\S]*$/i,
    /\s*Finish\.[\s\S]*$/i,
    /\s*Section\s+\d+\s+text\s+is\s+not\s+present[\s\S]*$/i,
    /\s*Please\s+provide\s+the\s+pages[\s\S]*$/i,
    /\s*I\s+will\s+summarize[\s\S]*$/i,
    /\s*\[\s*page\b[\s\S]*$/i,
    /\s*\[\s*cite\s*:[\s\S]*$/i,
    /\s*\(?नोट\s*:[\s\S]*$/i,
    /\s*\(यो वाक्य[\s\S]*$/i,
    /\s*Other\s*विवरणमा सुधार\s*:[\s\S]*$/i,
    /\s*धन्यवाद[।.!]?\s*(?:अब\s+यहाँ|यहाँ\s+केही|केही\s+मुख्य)[\s\S]*$/i,
    /\s*(?:अब\s+यहाँ|यहाँ)\s+केही\s+मुख्य\s+(?:दायित्व|बुँदा)[\s\S]*$/i,
    /\s*केही\s+मुख्य\s+बुँदाहरू\s*:[\s\S]*$/i,
  ];
  for (const rx of metaCutPatterns) {
    s = s.replace(rx, '');
  }

  // Remove leaked thought prose in Nepali like "` भयो नि! ओहो, म thought भित्रै छु..."
  if (/thought\s*भित्रै|thought\s*बन्द/i.test(s)) {
    const devStart = s.search(/यस\s+(?:धारा|दफा|नियम)|संविधानको|प्रस्तुत\s+(?:धारा|दफा)|दफा\s+[०-९0-9]+|धारा\s+[०-९0-9]+/);
    if (devStart > 0) {
      s = s.slice(devStart);
    } else {
      return '';
    }
  }

  // Normalize accidental code-switched words & strip inline English sentences
  s = s
    .replace(/\bOther\s+कार्यहरू/g, 'अन्य कार्यहरू')
    .replace(/\blist\s+गरिएका/g, 'सूचीकृत गरिएका')
    .replace(/\bAlso\s*,?\s*/gi, 'साथै ')
    .replace(/\b(?:Furthermore|Moreover|Additionally|Therefore|However|Actually|Note)\b\s*,?\s*/gi, '')
    .replace(/\s+\b(?:Wait|Note|Thought|Thinking|Actually|However|Okay|Done|End|Finish|Final|Output|Summary|JSON)\b[:.,—\-\s]*$/gi, '')
    .replace(/\s*\[\s*[०-९0-9]+\s*words?[^\]]*\]/gi, '')
    .replace(/\s*\[\s*\d+\s*[-–]\s*\d+\s*\]\s*$/g, '')
    // Remove full English sentences inside/after Nepali text
    .replace(/(?:^|(?<=[।.?!]\s*))[A-Z][A-Za-z0-9\s,;:'"()\-–/]{12,}[।.]/g, '')
    .replace(/।\s*[A-Za-z][A-Za-z0-9\s,;:'"()\-–./!?]{8,}$/g, '।')
    // Remove isolated English parenthetical notes
    .replace(/\(\s*(?:Note|Wait|See|e\.g\.|i\.e\.|Schedule|Section|Article|Page|pages?)[^)]*\)/gi, '')
    .replace(/\(\s*Schedule\s*\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Fix trailing broken opening/closing punctuation or quotes
  s = s.replace(/^[,;:\-–\s"“”']+/, '').replace(/[,\s"“”']+$/, '').trim();

  // Collapse repetitive boilerplate tails if Gemini looped excessively (> 6 sentences)
  const sentences = s
    .split(/(?<=।)\s+/)
    .map(p => p.trim())
    .filter(Boolean);
  if (sentences.length > 6) {
    const unique: string[] = [];
    for (const sent of sentences) {
      if (
        /^(?:यो नै दफा .* को|यसमा अन्य कुनै उपदफा|यही नै .* को अन्तिम|संक्षेपमा, यस दफा)/.test(sent) &&
        unique.length >= 2
      ) {
        continue;
      }
      if (!unique.includes(sent)) unique.push(sent);
      if (unique.length >= 5) break;
    }
    s = unique.join(' ');
  }

  // Collapse repeated ending punctuation like ।।”, । -> ।
  s = s.replace(/[।,\s"“”']+$/g, match => (/[।]/.test(match) ? '।' : '')).trim();

  // Ensure proper ending punctuation if non-empty
  if (s && !/[।.?!]$/.test(s)) {
    const lastStop = Math.max(s.lastIndexOf('।'), s.lastIndexOf('.'));
    if (lastStop > s.length * 0.45) {
      s = s.slice(0, lastStop + 1).trim();
    }
  }

  return s;
}

export function sanitizeObligationsList(items: string[] | undefined | null): string[] {
  if (!Array.isArray(items)) return [];
  const cleaned: string[] = [];
  for (const item of items) {
    const rawStr = String(item || '');
    if (/(?:rowIndex|summaryNepali|keyObligations)/i.test(rawStr)) continue;
    const clean = sanitizeNepaliSummaryText(rawStr);
    if (clean && clean.length >= 4 && !hasDisallowedEnglishLeak(clean)) {
      cleaned.push(clean);
    }
  }
  return cleaned;
}

const ALLOWED_LEGAL_LATIN = new Set([
  'pdf',
  'uav',
  'gps',
  'gis',
  'orthophoto',
  'dem',
  'dtm',
  'gcp',
  'rtk',
  'dgps',
  'dna',
  'fir',
  'sms',
  'otp',
  'vat',
  'pan',
  'it',
  'ai',
  'url',
  'id',
]);

/**
 * Checks whether Nepali text still contains stray English words / meta leaks
 * (excluding recognized technical acronyms when summarizing technical survey rules).
 */
export function hasDisallowedEnglishLeak(text: string): boolean {
  if (!text) return false;
  const words = text.match(/[A-Za-z]{2,}/g) || [];
  if (words.length === 0) return false;
  const disallowed = words.filter(w => !ALLOWED_LEGAL_LATIN.has(w.toLowerCase()));
  return disallowed.length > 0;
}

export function isPlaceholderDafaSummary(summaryNepali: string | undefined | null): boolean {
  const s = (summaryNepali || '').trim();
  if (!s || s.length < 30) return true;
  if (/सम्बन्धी कानूनी व्यवस्था[।.]?$/.test(s)) return true;
  if (/^सारांश उपलब्ध छ[।.]?$/.test(s)) return true;
  return false;
}

export function isWatermarkOrRefusalText(text: string | undefined | null): boolean {
  const s = (text || '').trim();
  if (!s) return true;
  return /वाटरमार्क|उपलब्ध नभएकाले|सारांश तयार गर्न सकिएन|सारांश प्रस्तुत गर्न सम्भव भएन|स्पष्ट पाठ भएको पीडीएफ|मूल पाठ सहितको पृष्ठ|not present in the provided|cannot be summarized|blank with only a watermark/i.test(
    s
  );
}

export function hasCorruptedCmapArtifacts(text: string | undefined | null): boolean {
  const s = text || '';
  if (!s) return false;
  if (/[\uE000-\uF8FF]/.test(s)) return true;
  const matches = s.match(
    /र््|मम[मत]|िो\b|िुने|ाः|ठदनु|संविता|प्रारत्तम्|प्रारजम्भ|व्यिस्था|साियज|र्ुद्ध|अन्तर्यत|सन्िुलन|पीमडत|बमोत्तजम|सम्बत्तन्धत|आियक|लामग|िािािरण|िमतपूमत|िराई/g
  );
  return (matches?.length || 0) >= 2;
}

/**
 * Returns true if a PDF extraction sample likely came from a corrupted ToUnicode CMap font
 * (looks like Devanagari Unicode range, but characters are scrambled).
 */
export function hasCorruptedPdfCmap(sampleText: string): boolean {
  if (!sampleText) return false;
  if ((sampleText.match(/[\uE000-\uF8FF]/g) || []).length >= 6) return true;
  const matches = sampleText.match(
    /र््|मम[मत]|िो\b|िुने|ाः|ठदनु|संविता|प्रारत्तम्|प्रारजम्भ|व्यिस्था|साियज|र्ुद्ध|अन्तर्यत|सन्िुलन|पीमडत|बमोत्तजम|सम्बत्तन्धत|आियक|लामग|िािािरण|िमतपूमत|िराई|सिस्या|दमित|मनर्देशशका|समिमत|गने\b|िएको\b/g
  );
  return (matches?.length || 0) >= 4;
}

/**
 * Evaluates a stored Dafa record for quality. Any record failing this check
 * should be regenerated or repaired before display/cache acceptance.
 */
export function isDirtyOrIncompleteDafaRecord(
  record: Pick<StoredDafaSummaryRecord, 'summaryNepali' | 'keyObligations'> | undefined | null
): boolean {
  if (!record) return true;
  const summary = (record.summaryNepali || '').trim();
  const full = `${summary} ${(record.keyObligations || []).join(' ')}`.trim();

  if (isPlaceholderDafaSummary(summary)) return true;
  if (isWatermarkOrRefusalText(full)) return true;
  if (hasCorruptedCmapArtifacts(full)) return true;
  if (hasDisallowedEnglishLeak(full)) return true;
  if (/(thought|Note:|Wait[—,\s]|Let's|Actually,|keyObligations|Done\.|Finish\.|भित्रै)/i.test(full)) {
    return true;
  }
  const devCount = (summary.match(new RegExp(`[${DEV_CHAR_CLASS}]`, 'g')) || []).length;
  if (devCount < 20) return true;
  return false;
}

export function isDirtyOrIncompletePdfRecord(
  record: Pick<
    StoredPdfSummaryRecord,
    'language' | 'overview' | 'keyPoints' | 'importantSections' | 'complianceAndDeadlines'
  > | undefined | null
): boolean {
  if (!record) return true;
  if (!record.overview || record.overview.trim().length < 80) return true;
  if ((record.keyPoints || []).length === 0 || (record.importantSections || []).length === 0) {
    return true;
  }
  if (record.language === 'ne') {
    const joined = [
      record.overview,
      ...(record.keyPoints || []),
      ...(record.complianceAndDeadlines || []),
      ...(record.importantSections || []).map(s => `${s.reference} ${s.title} ${s.summary}`),
    ].join(' ');
    if (hasCorruptedCmapArtifacts(joined)) return true;
    if (hasDisallowedEnglishLeak(joined)) return true;
  }
  return false;
}

export function sanitizeDafaSummaryItem<T extends DafaSummaryItem>(item: T): T {
  return {
    ...item,
    summaryNepali: sanitizeNepaliSummaryText(item.summaryNepali),
    keyObligations: sanitizeObligationsList(item.keyObligations),
  };
}

export function sanitizePdfSummaryResult(
  result: PdfSummaryResult,
  language: string
): PdfSummaryResult {
  if (language === 'en') return result;
  return {
    ...result,
    documentTitle: sanitizeNepaliSummaryText(result.documentTitle) || result.documentTitle,
    overview: sanitizeNepaliSummaryText(result.overview) || result.overview,
    keyPoints: (result.keyPoints || [])
      .map(p => sanitizeNepaliSummaryText(p))
      .filter(Boolean),
    importantSections: (result.importantSections || []).map(sec => ({
      ...sec,
      reference: sanitizeNepaliSummaryText(sec.reference) || sec.reference,
      title: sanitizeNepaliSummaryText(sec.title) || sec.title,
      summary: sanitizeNepaliSummaryText(sec.summary) || sec.summary,
    })),
    complianceAndDeadlines: (result.complianceAndDeadlines || [])
      .map(c => sanitizeNepaliSummaryText(c))
      .filter(Boolean),
    schedulesOverview: (result.schedulesOverview || [])
      .map(s => sanitizeNepaliSummaryText(s))
      .filter(Boolean),
    customAnswer: result.customAnswer
      ? sanitizeNepaliSummaryText(result.customAnswer) || result.customAnswer
      : '',
  };
}

export function mergePdfSummariesWithRepairs(
  firestorePdfs: StoredPdfSummaryRecord[],
  repairedPdfs: StoredPdfSummaryRecord[]
): StoredPdfSummaryRecord[] {
  const map = new Map<string, StoredPdfSummaryRecord>();
  for (const rec of firestorePdfs) {
    const cleaned = {
      ...rec,
      ...sanitizePdfSummaryResult(rec, rec.language || 'ne'),
    };
    map.set(rec.docId, cleaned);
  }
  for (const rep of repairedPdfs) {
    const existing = map.get(rep.docId);
    if (!existing || isDirtyOrIncompletePdfRecord(existing)) {
      map.set(rep.docId, {
        ...rep,
        ...sanitizePdfSummaryResult(rep, rep.language || 'ne'),
      });
    }
  }
  return Array.from(map.values());
}

export function mergeDafaSummariesWithRepairs(
  firestoreDafas: StoredDafaSummaryRecord[],
  repairedDafas: StoredDafaSummaryRecord[]
): StoredDafaSummaryRecord[] {
  const map = new Map<string, StoredDafaSummaryRecord>();
  for (const rec of firestoreDafas) {
    const cleaned = sanitizeDafaSummaryItem(rec);
    map.set(rec.docId, {
      ...rec,
      ...cleaned,
    });
  }
  for (const rep of repairedDafas) {
    const existing = map.get(rep.docId);
    if (!existing || isDirtyOrIncompleteDafaRecord(existing)) {
      const cleanedRep = sanitizeDafaSummaryItem(rep);
      map.set(rep.docId, {
        ...rep,
        ...cleanedRep,
      });
    }
  }
  return Array.from(map.values());
}

export function computePendingFirestoreSyncRecords(
  rawFirestorePdfs: StoredPdfSummaryRecord[],
  rawFirestoreDafas: StoredDafaSummaryRecord[],
  repairedPdfs: StoredPdfSummaryRecord[],
  repairedDafas: StoredDafaSummaryRecord[]
): {
  pdfsToSync: StoredPdfSummaryRecord[];
  dafasToSync: StoredDafaSummaryRecord[];
} {
  const fsPdfMap = new Map(rawFirestorePdfs.map(p => [p.docId, p]));
  const pdfsToSync: StoredPdfSummaryRecord[] = [];
  for (const rep of repairedPdfs) {
    if (isDirtyOrIncompletePdfRecord(rep)) continue;
    const fsRec = fsPdfMap.get(rep.docId);
    if (!fsRec || isDirtyOrIncompletePdfRecord(fsRec)) {
      pdfsToSync.push(rep);
    }
  }

  const fsDafaMap = new Map(rawFirestoreDafas.map(d => [d.docId, d]));
  const seenDafaIds = new Set<string>();
  const dafasToSync: StoredDafaSummaryRecord[] = [];

  for (const rep of repairedDafas) {
    if (isDirtyOrIncompleteDafaRecord(rep)) continue;
    const fsRec = fsDafaMap.get(rep.docId);
    if (!fsRec || isDirtyOrIncompleteDafaRecord(fsRec)) {
      dafasToSync.push(rep);
      seenDafaIds.add(rep.docId);
    }
  }

  for (const fsRec of rawFirestoreDafas) {
    if (seenDafaIds.has(fsRec.docId)) continue;
    if (isDirtyOrIncompleteDafaRecord(fsRec)) {
      const san = sanitizeDafaSummaryItem(fsRec);
      if (!isDirtyOrIncompleteDafaRecord(san) && san.summaryNepali !== fsRec.summaryNepali) {
        dafasToSync.push({ ...fsRec, ...san });
        seenDafaIds.add(fsRec.docId);
      }
    }
  }

  return { pdfsToSync, dafasToSync };
}

