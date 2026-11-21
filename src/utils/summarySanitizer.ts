import type {
  DafaSummaryItem,
  DocumentSummary,
  LegalRow,
  PdfSummaryResult,
  StoredDafaSummaryRecord,
  StoredPdfSummaryRecord,
} from '../types';
import {
  buildDafaSummaryDocId,
  buildPdfSummaryDocId,
} from '../services/firestoreSummaryStore';
import { canonicalPdfKey } from './urlUtils';

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

  // Cut off common Gemini English/Nepali self-correction / meta-commentary prefixes or suffixes
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
    /\s*गल्ती\s+सच्याएर[\s\S]*$/i,
    /\s*तर\s+माथिको\s+अतिरिक्त\s+वाक्य[\s\S]*$/i,
    /\s*माफ\s+गर्नुहोला[^।)]*(?:[।.)]|$)/gi,
    /\s*ल,\s*ठीक\s+छ[^।)]*(?:[।.)]|$)/gi,
    /\s*[\(\[]?\s*(?:संक्षिप्त(?:\s+र\s+सटीक\s+रूप)?|सङ्क्षेप)\s*:[\s\S]*$/i,
    /\s*[\(\[]?\s*[०-९0-9]+\s*[-–]\s*[०-९0-9]+\s*वाक्यमा\s+सीमित\s+गरौं\s*:[\s\S]*$/i,
    /\s*[—\-–]\s*(?:यसलाई\s*[०-९0-9\-–]+[^:]*:|दफा\s+[०-९0-9]+[।.\s]*(?:\(|$))[\s\S]*$/i,
    /\s*[०-९0-9]+\s+शब्दको\s+सट्टामा\s+यो\s+[०-९0-9\-–]+\s*वाक्यको\s+स्पष्ट\s+सारांश\s+हो[।.]?/gi,
    /\s*(?:यो\s+दफा\s+यतिमा\s+नै\s+सीमित\s+छ|यसरी\s+दुई\s+वाक्यमा\s+नै\s+यसको\s+पूर्ण\s+अर्थ\s+खुल्दछ|कुनै\s+थप\s+व्याख्याको\s+आवश्यकता\s+छैन|यो\s+कानूनी\s+पाठसँग\s+पूर्णतः\s+मेल\s+खान्छ|सबै\s+शब्दहरू\s+मानक\s+नेपाली\s+युनिकोडमा\s+छन्|कुनै\s+अशुद्ध\s+वा\s+अपभ्रंश\s+शब्दहरू\s+छैनन्|यो\s+जानकारी\s+पूर्ण\s+र\s+विश्वसनीय\s+छ|यो\s+नै\s+उत्तम\s+प्रस्तुति\s+हो|[१1][०0][०0]%\s*शुद्ध\s*नेपाली\s*भाषामा\s*जानकारी\s*दिइएको\s*छ)[।.]?/gi,
  ];
  for (const rx of metaCutPatterns) {
    s = s.replace(rx, '');
  }

  // Strip leaked Nepali JSON/meta commentary parentheticals and repeated educational disclaimers
  s = s
    .replace(/\s*\(?गल्तीले\s+आयो[^)]*\)?[।.]?/gi, '')
    .replace(/\s*\(?माफ\s+गर्नुहोला[^)]*\)?[।.]?/gi, '')
    .replace(/\s*\(?ठीक\s+छ[।,]?\s*(?:अब|म)[^)]*\)?[।.]?/gi, '')
    .replace(
      /\s*\(?(?:यो\s+(?:व्यवस्था|जानकारी|विवरण)\s+)?(?:केवल\s+)?(?:शैक्षिक|जानकारीमूलक|सूचनामूलक)[^।)]*(?:सल्लाह\s+होइन|परामर्श\s+होइन|मात्र\s+हो|लागि\s+मात्र)[।.]?\)?[।.]?/gi,
      ''
    )
    .replace(/\s*\(?(?:तर,?\s*यसलाई\s+|यो\s+(?:जानकारी\s+)?)?औपचारिक\s+कानू?नी\s+(?:सल्लाह|परामर्श)\s+होइन[।.]?\)?[।.]?/gi, '')
    .replace(/\s*\(?तर,?\s*यसलाई\s+औपचारिक\s+कानू?नी\s+सल्लाहको\s+रूपमा\s+लिनु\s+हुँदैन[।.]?\)?[।.]?/gi, '')
    .replace(/\s*\(?कानू?नी\s+सल्लाहका\s+लागि\s+अधिवक्तासँग\s+परामर्श\s+लिनुहोला[।.]?\)?[।.]?/gi, '')
    .replace(/\s*\(?मुलुकी\s+देवानी\s+संहिता,\s*२०७४,\s*दफा\s*[^\n)]*\)?[।.]?/gi, '')
    .replace(/\s*तपाईंको\s+सन्दर्भ\s+र\s+उद्देश्यका\s+लागि\s+मात्र[^।]*होइन[।.]?/gi, '')
    .replace(/\s*\(?(?:यो\s+जानकारी\s+)?कानू?नी\s+सल्लाहको\s+रूपमा\s+नलिनुहोला[।.]?\)?[।.]?/gi, '')
    .replace(/\s*\(प्रत्येक\s+उपखण्डमा\s+विस्तृत[^)]*$/gi, '');

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
    // Collapse double dandas & normalize spaces
    .replace(/।{2,}/g, '।')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Fix trailing broken opening/closing punctuation or quotes (only strip unbalanced outer parens)
  s = s.replace(/^[,;:\-–\s"“”'()]+/, '').replace(/[,\s"“”'(]+$/, '').trim();
  const openCount = (s.match(/\(/g) || []).length;
  const closeCount = (s.match(/\)/g) || []).length;
  if (closeCount > openCount) {
    s = s.replace(/([।.?!])\s*\)+$/g, '$1').trim();
  } else if (openCount > closeCount) {
    // Walk to find the first still-unclosed '(' index via stack
    const openStack: number[] = [];
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '(') openStack.push(i);
      else if (s[i] === ')' && openStack.length > 0) openStack.pop();
    }
    const unclosedIdx = openStack[openStack.length - 1] ?? -1;
    if (unclosedIdx >= 0 && unclosedIdx > s.length * 0.45) {
      const tail = s.slice(unclosedIdx + 1).trim();
      if (/^(?:दफा|धारा|नोट|संक्षिप्त|सङ्क्षेप|[०-९0-9]+[-–][०-९0-9]+\s*वाक्य)/.test(tail) || tail.includes('?')) {
        s = s.slice(0, unclosedIdx).trim();
      } else {
        s = `${s.slice(0, unclosedIdx)}${tail}`.trim();
      }
    }
  }

  // Always deduplicate repeated sentences (any count) and collapse repetitive boilerplate tails
  const sentences = s
    .split(/(?<=।)\s+/)
    .map(p => p.trim())
    .filter(Boolean);
  if (sentences.length > 1) {
    const unique: string[] = [];
    const seenNorm = new Set<string>();
    for (const sent of sentences) {
      if (
        /^(?:यो नै दफा .* को|यसमा अन्य कुनै उपदफा|यही नै .* को अन्तिम|संक्षेपमा, यस दफा)/.test(sent) &&
        unique.length >= 2
      ) {
        continue;
      }
      const norm = sent.replace(/[।.\s()"'“”]+/g, '');
      if (!norm || seenNorm.has(norm)) continue;
      seenNorm.add(norm);
      unique.push(sent);
      if (unique.length >= 6) break;
    }
    s = unique.join(' ');
  }

  // Collapse repeated ending punctuation like ।।”, । -> ।
  s = s.replace(/[।,\s"“”']+$/g, match => (/[।]/.test(match) ? '।' : '')).trim();

  // Ensure proper ending punctuation if non-empty (allow ।) at end of parenthetical note)
  if (s && !/[।.?!)]$/.test(s)) {
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
  const seen = new Set<string>();
  for (const item of items) {
    const rawStr = String(item || '');
    if (/(?:rowIndex|summaryNepali|keyObligations)/i.test(rawStr)) continue;
    const clean = sanitizeNepaliSummaryText(rawStr);
    const norm = clean.replace(/[।.\s()"'“”]+/g, '');
    if (clean && clean.length >= 4 && !hasDisallowedEnglishLeak(clean) && !seen.has(norm)) {
      seen.add(norm);
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
  return /वाटरमार्क|उपलब्ध नभएकाले|उपलब्ध सामग्रीमा समावेश छैन|शीर्षकअनुसारको (?:विषय|विवरण) मात्र अभिलेख गरिएको छ|सारांश तयार गर्न सकिएन|सारांश प्रस्तुत गर्न सम्भव भएन|स्पष्ट पाठ भएको पीडीएफ|मूल पाठ सहितको पृष्ठ|not present in the provided|cannot be summarized|blank with only a watermark/i.test(
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
  if (
    /(thought|Note:|Wait[—,\s]|Let's|Actually,|keyObligations|Done\.|Finish\.|भित्रै|नोट\s*:|गल्ती\s+सच्याएर|गल्तीले\s+आयो|माफ\s+गर्नुहोला|संक्षिप्त\s*:|सङ्क्षेप\s*:|संक्षिप्त\s+र\s+सटीक\s+रूप|वाक्यमा\s+सीमित\s+गरौं|शब्दको\s+सट्टामा|मानक\s+नेपाली\s+युनिकोडमा\s+छन्|[१1][०0][०0]%\s*शुद्ध\s*नेपाली\s*भाषामा\s*जानकारी\s*दिइएको\s*छ|औपचारिक\s+कानू?नी\s+(?:सल्लाह|परामर्श)\s+होइन|सल्लाहको\s+रूपमा\s+(?:नलिनुहोला|लिनु\s+हुँदैन)|शैक्षिक\s+तथा\s+(?:सूचनामूलक|सचेतनामूलक)|शैक्षिक\s+र\s+(?:सूचनात्मक|जानकारीमूलक)|जानकारीमूलक\s+उद्देश्यका\s+लागि\s+मात्र\s+हो)/i.test(
      full
    )
  ) {
    return true;
  }
  if (/।{2,}/.test(summary)) return true;
  const sents = summary
    .split(/(?<=।)\s+/)
    .map(p => p.replace(/[।.\s()"'“”]+/g, '').trim())
    .filter(p => p.length > 10);
  if (sents.length > 1 && new Set(sents).size < sents.length) return true;

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

function canonicalDafaItemMatchKey(
  pdfNameOrPath: string,
  sectionId?: string,
  anusuchiId?: string,
  titlePage?: string,
  anusuchiPrintPage?: string
): string {
  return [
    canonicalPdfKey(pdfNameOrPath),
    (sectionId || '').trim(),
    (anusuchiId || '').trim(),
    (titlePage || '').trim(),
    (anusuchiPrintPage || '').trim(),
  ].join('||');
}

/**
 * Mirrors clean PDF and Dafa summaries across repeated/duplicate PDFs stored
 * in multiple folders (e.g. Folder ९ -> Folder १०/११, Folder १२.x -> Folder २/४/५/११)
 * so every folder displays clean summaries and green completion ticks consistently.
 */
export function mirrorRepeatedDocumentSummaries(
  documents: DocumentSummary[],
  allRows: LegalRow[],
  pdfs: StoredPdfSummaryRecord[],
  dafas: StoredDafaSummaryRecord[]
): {
  pdfs: StoredPdfSummaryRecord[];
  dafas: StoredDafaSummaryRecord[];
  mirroredPdfCount: number;
  mirroredDafaCount: number;
} {
  const pdfMap = new Map<string, StoredPdfSummaryRecord>(pdfs.map(p => [p.docId, p]));
  const cleanPdfByCanonical = new Map<string, StoredPdfSummaryRecord>();

  for (const p of pdfs) {
    const mode = p.mode || 'executive';
    const lang = p.language || 'ne';
    if (mode !== 'executive' || lang !== 'ne') continue;
    if (isDirtyOrIncompletePdfRecord(p)) continue;
    const cKey = canonicalPdfKey(p.pdfName || p.pdfPath);
    if (cKey && !cleanPdfByCanonical.has(cKey)) {
      cleanPdfByCanonical.set(cKey, p);
    }
  }

  let mirroredPdfCount = 0;
  const uniqueDocsByPath = new Map<string, DocumentSummary>();
  for (const d of documents) {
    if (!uniqueDocsByPath.has(d.path)) uniqueDocsByPath.set(d.path, d);
  }

  for (const docItem of uniqueDocsByPath.values()) {
    const targetDocId = buildPdfSummaryDocId(docItem.path, 'executive', 'ne');
    const existing = pdfMap.get(targetDocId);
    if (existing && !isDirtyOrIncompletePdfRecord(existing)) continue;

    const cKey = canonicalPdfKey(docItem.filename || docItem.path);
    const source = cleanPdfByCanonical.get(cKey);
    if (!source) continue;

    const mirrored: StoredPdfSummaryRecord = {
      ...source,
      docId: targetDocId,
      pdfPath: docItem.path,
      pdfName: docItem.filename,
      folderId: docItem.folderId,
      folderName: docItem.folderName,
      fileSizeBytes: docItem.size || source.fileSizeBytes || 0,
      isPublic: true,
      updatedByUid: source.updatedByUid || '',
    };
    pdfMap.set(targetDocId, mirrored);
    mirroredPdfCount++;
  }

  const dafaMap = new Map<string, StoredDafaSummaryRecord>(dafas.map(d => [d.docId, d]));
  const cleanDafaByCanonical = new Map<string, StoredDafaSummaryRecord>();
  const cleanDafaByFallbackSec = new Map<string, StoredDafaSummaryRecord>();

  for (const d of dafas) {
    if (isDirtyOrIncompleteDafaRecord(d)) continue;
    const cKey = canonicalDafaItemMatchKey(
      d.pdfName || d.pdfPath,
      d.sectionId,
      d.anusuchiId,
      d.titlePage,
      ''
    );
    if (!cleanDafaByCanonical.has(cKey)) {
      cleanDafaByCanonical.set(cKey, d);
    }
    const fallbackKey = `${canonicalPdfKey(d.pdfName || d.pdfPath)}||${(d.sectionId || '').trim()}||${(d.anusuchiId || '').trim()}||${(d.titleName || '').trim()}`;
    if (!cleanDafaByFallbackSec.has(fallbackKey)) {
      cleanDafaByFallbackSec.set(fallbackKey, d);
    }
  }

  let mirroredDafaCount = 0;
  for (const r of allRows) {
    const targetDocId = buildDafaSummaryDocId(r);
    const existing = dafaMap.get(targetDocId);
    if (existing && !isDirtyOrIncompleteDafaRecord(existing)) continue;

    const match1 = cleanDafaByCanonical.get(
      canonicalDafaItemMatchKey(r.pdf_name, r.section_id, r.anusuchi_id, r.title_page, '')
    );
    const match2 =
      match1 ||
      cleanDafaByFallbackSec.get(
        `${canonicalPdfKey(r.pdf_name)}||${(r.section_id || '').trim()}||${(r.anusuchi_id || '').trim()}||${(r.title_name || '').trim()}`
      );
    if (!match2) continue;

    dafaMap.set(targetDocId, {
      ...match2,
      docId: targetDocId,
      pdfPath: r.pdf_path,
      pdfName: r.pdf_name,
      folderId: r.folder_id,
      sectionId: r.section_id || match2.sectionId,
      titleName: r.title_name || match2.titleName,
      titlePage: r.title_page || match2.titlePage,
      anusuchiId: r.anusuchi_id || match2.anusuchiId,
      anusuchiTitle: r.anusuchi_title || match2.anusuchiTitle,
      isPublic: true,
      updatedByUid: match2.updatedByUid || '',
    });
    mirroredDafaCount++;
  }

  return {
    pdfs: Array.from(pdfMap.values()),
    dafas: Array.from(dafaMap.values()),
    mirroredPdfCount,
    mirroredDafaCount,
  };
}

