import { ThinkingLevel, Type, createPartFromUri } from '@google/genai';
import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { resolvePdfBuffer } from './pdfResolver.ts';
import { buildRepresentativePageList, slicePdfPages } from './pdfSlicer.ts';
import { convertPreetiPageToUnicode, isLikelyPreetiText } from './preetiToUnicode.ts';
import { hasCorruptedPdfCmap, sanitizePdfSummaryResult } from '../utils/summarySanitizer.ts';
import {
  GeminiServiceError,
  getGeminiKeysCount,
  runWithGeminiKeyFailover,
} from './geminiKeyPool.ts';
import type {
  LegalRow,
  PdfSummaryLanguage,
  PdfSummaryMode,
  PdfSummaryRequest,
  PdfSummaryResult,
} from '../types';

export { GeminiServiceError };

const SUMMARY_MODEL = 'gemini-4-hydrogen';
const FAST_FALLBACK_MODEL = 'gemini-3.1-flash-lite';
const MAX_INLINE_PDF_BYTES = 15 * 1024 * 1024; // Keep safely below 20MB inline request cap
const MAX_EXTRACTED_CHARS = 28_000;

interface PdfExtractionSummary {
  totalPages: number;
  startPage: number;
  endPage: number;
  extractedText: string;
  devanagariRatio: number;
  hasUsableUnicodeText: boolean;
  isCorruptedCmap: boolean;
}

function toDevanagariDigits(val: number | string): string {
  const devDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  return String(val).replace(/[0-9]/g, d => devDigits[parseInt(d, 10)]);
}

function toEnglishInt(val: string | number | undefined): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  const map: Record<string, string> = {
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
    '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
  };
  const ascii = String(val).replace(/[०-९]/g, d => map[d] || d).replace(/[^0-9]/g, '');
  if (!ascii) return undefined;
  const n = parseInt(ascii, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

async function extractPdfTextAndMetadata(
  buffer: Buffer,
  requestedStart?: number,
  requestedEnd?: number
): Promise<PdfExtractionSummary> {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    verbosity: 0,
    useSystemFonts: true,
    disableFontFace: true,
  });

  const pdfDoc = await loadingTask.promise;
  try {
    const totalPages = pdfDoc.numPages || 1;
    const startPage = Math.max(1, Math.min(totalPages, requestedStart || 1));
    const endPage = Math.max(startPage, Math.min(totalPages, requestedEnd || totalPages));

    const chunks: string[] = [];
    let totalChars = 0;

    // Select representative pages when span > 24 pages so start, middle, and end/schedules are all covered fast
    const span = endPage - startPage + 1;
    const pageList: number[] = [];
    if (span <= 24) {
      for (let p = startPage; p <= endPage; p++) pageList.push(p);
    } else {
      for (let p = startPage; p < startPage + 8; p++) pageList.push(p);
      const midStart = startPage + 8;
      const midEnd = endPage - 4;
      const step = Math.max(1, Math.floor((midEnd - midStart + 1) / 10));
      for (let p = midStart; p <= midEnd; p += step) {
        if (pageList.length >= 20) break;
        pageList.push(p);
      }
      for (let p = Math.max(midEnd + 1, endPage - 3); p <= endPage; p++) {
        if (!pageList.includes(p)) pageList.push(p);
      }
    }

    for (const pageNum of pageList) {
      const page = await pdfDoc.getPage(pageNum);
      const content = await page.getTextContent();
      let pageText = (content.items as any[])
        .map((item: any) => (typeof item?.str === 'string' ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (pageText && isLikelyPreetiText(pageText)) {
        pageText = convertPreetiPageToUnicode(pageText);
      }

      if (pageText) {
        const entry = `\n--- [PDF पृष्ठ ${toDevanagariDigits(pageNum)} / Page ${pageNum}] ---\n${pageText}`;
        if (totalChars + entry.length <= MAX_EXTRACTED_CHARS) {
          chunks.push(entry);
          totalChars += entry.length;
        } else {
          const remaining = MAX_EXTRACTED_CHARS - totalChars;
          if (remaining > 200) {
            chunks.push(entry.slice(0, remaining) + '...');
          }
          break;
        }
      }
    }

    const extractedText = chunks.join('\n').trim();
    const nonSpace = extractedText.replace(/\s+/g, '');
    const devChars = (nonSpace.match(/[\u0900-\u097F]/g) || []).length;
    const devanagariRatio = nonSpace.length > 0 ? devChars / nonSpace.length : 0;
    const isCorruptedCmap = hasCorruptedPdfCmap(extractedText);
    const hasUsableUnicodeText =
      !isCorruptedCmap && extractedText.length >= 250 && devanagariRatio >= 0.25;

    return {
      totalPages,
      startPage,
      endPage,
      extractedText,
      devanagariRatio,
      hasUsableUnicodeText,
      isCorruptedCmap,
    };
  } finally {
    await pdfDoc.cleanup();
    await loadingTask.destroy();
  }
}

function getStructuredRowsForDoc(
  pdfPath: string,
  startPage?: number,
  endPage?: number
): LegalRow[] {
  try {
    const allRowsPath = path.resolve(import.meta.dirname, '../data/all_rows.json');
    if (!fs.existsSync(allRowsPath)) return [];
    const allRows = JSON.parse(fs.readFileSync(allRowsPath, 'utf8')) as LegalRow[];
    const filename = path.basename(pdfPath);

    const docRows = allRows.filter(
      r => r.pdf_path === pdfPath || r.pdf_name === filename
    );

    if (!startPage && !endPage) return docRows;

    const s = startPage || 1;
    const e = endPage || Number.MAX_SAFE_INTEGER;
    const ranged = docRows.filter(r => {
      const p = toEnglishInt(r.title_page) ?? toEnglishInt(r.anusuchi_print_page);
      if (!p) return false;
      return p >= s && p <= e;
    });

    return ranged.length > 0 ? ranged : docRows.slice(0, 60);
  } catch {
    return [];
  }
}

function getModeInstructions(mode: PdfSummaryMode): string {
  switch (mode) {
    case 'sections':
      return 'Focus heavily on mapping out the most important statutory Sections/Articles/Rules (दफा/धारा/नियम) and Schedules (अनुसूची) with accurate PDF page citations and practical legal effect.';
    case 'compliance':
      return 'Focus on legal authorities/committees, powers and duties, citizen/landowner rights, mandatory procedures, statutory deadlines/timeframes (हदम्याद/म्याद), and fines/penalties/offenses (दण्ड/सजाय).';
    case 'page_range':
      return 'Focus strictly on summarizing the content found within the specified PDF page range in thorough detail, citing exact section IDs and page numbers from those pages.';
    case 'executive':
    default:
      return 'Provide a crisp, comprehensive executive legal summary covering: objective and preamble (उद्देश्य), scope and applicability (क्षेत्राधिकार), major legal provisions, key institutions/authorities, and schedules.';
  }
}

function getLanguageInstructions(language: PdfSummaryLanguage): string {
  switch (language) {
    case 'en':
      return 'Write all summary fields in clear, professional legal English (you may cite official Nepali statutory terms in parentheses where helpful).';
    case 'bilingual':
      return 'Write clear Nepali Devanagari as the primary language, followed by concise English legal key terms or brief clarifications where helpful.';
    case 'ne':
    default:
      return 'Write ALL summary text fields in 100% pure, natural, grammatically accurate Nepali Devanagari Unicode (नेपाली युनिकोड). NEVER output English filler sentences, "Note:", "Wait", "Schedule", internal thoughts, or corrupted legacy glyphs. Keep numerals readable and legal terms authentic to Nepal Law Commission usage.';
  }
}

export async function summarizePdfWithGemini(
  req: PdfSummaryRequest
): Promise<PdfSummaryResult> {
  if (getGeminiKeysCount() === 0) {
    throw new GeminiServiceError(
      503,
      'सर्भरमा GEMINI_API_KEY_1..6 वा GEMINI_API_KEY कन्फिगर गरिएको छैन। कृपया Settings > Secrets प्यानलमा Key हरू सेट गर्नुहोस्।'
    );
  }

  const pdfPath = (req.pdfPath || '').trim();
  if (!pdfPath) {
    throw new GeminiServiceError(400, 'कृपया सारांशको लागि PDF कागजात छान्नुहोस्।');
  }

  const mode: PdfSummaryMode = req.mode || 'executive';
  const language: PdfSummaryLanguage = req.language || 'ne';
  const customQuestion = (req.customQuestion || '').trim();

  const { buffer } = await resolvePdfBuffer(pdfPath);
  const extraction = await extractPdfTextAndMetadata(buffer, req.startPage, req.endPage);

  const isPartialRange =
    Boolean(req.startPage || req.endPage) &&
    (extraction.startPage > 1 || extraction.endPage < extraction.totalPages);

  const analyzedRange =
    extraction.startPage === 1 && extraction.endPage === extraction.totalPages
      ? `पूरा कागजात (पृष्ठ १–${toDevanagariDigits(extraction.totalPages)})`
      : `पृष्ठ ${toDevanagariDigits(extraction.startPage)}–${toDevanagariDigits(extraction.endPage)} (कुल ${toDevanagariDigits(extraction.totalPages)} मध्ये)`;

  const docRows = getStructuredRowsForDoc(
    pdfPath,
    isPartialRange ? extraction.startPage : undefined,
    isPartialRange ? extraction.endPage : undefined
  );

  // Sample across the whole doc/range up to 80 rows so sections across start, middle, and end are represented without blowing TPM quotas
  const maxIndexRows = 80;
  const sampledRows =
    docRows.length <= maxIndexRows
      ? docRows
      : docRows.filter((_, idx) => idx % Math.ceil(docRows.length / maxIndexRows) === 0).slice(0, maxIndexRows);

  const indexPreview = sampledRows.map(r => ({
    id: r.section_id || r.anusuchi_id || undefined,
    title: r.title_name || r.anusuchi_title || undefined,
    page: r.title_page || r.anusuchi_print_page || undefined,
  }));

  const docDisplayName = path.basename(pdfPath);

  const basePrompt = `Analyze this official Nepal legal PDF document and generate a structured, accurate legal summary.

Document Filename: ${docDisplayName}
Repository Path: ${pdfPath}
Total PDF Pages: ${extraction.totalPages}
Target Scope: ${analyzedRange}
Summary Mode: ${mode} — ${getModeInstructions(mode)}
Output Language Rule: ${getLanguageInstructions(language)}
${
  customQuestion
    ? `User's Specific Question (must answer directly in "customAnswer" unless it violates the Anti-Misuse Policy—if the user asks to falsify, forge, manipulate legal text for fraud, or misuse public data illegally, strictly refuse in "customAnswer"): ${customQuestion}`
    : 'No custom question asked (leave "customAnswer" as empty string "").'
}

${
  indexPreview.length > 0
    ? `Verified Structural Index from Portal Database (${docRows.length} entries in range; ${indexPreview.length} shown):\n${JSON.stringify(indexPreview)}\n`
    : ''
}
Instructions:
- Ground your summary strictly in the PDF content and verified structural index. Never alter, fabricate, or distort the wording or legal meaning of any Section (दफा), Gazette notice (राजपत्र सूचना), or Court Verdict (फैसला/नजिर).
- Present explanations strictly for educational, research, and general legal awareness purposes (clarify they are informational, not formal legal advice).
- Visually inspect attached PDF pages if the embedded font CMap has glyph swaps, and ALWAYS output 100% crisp, spell-checked Nepali Devanagari Unicode (e.g., क्षतिपूर्ति, मिति, प्रारम्भिक, संहिता, व्यक्ति, अनुसूची — NEVER corrupted glyphs like िमतपूमतय, मममत, व्र्त्ति, संविता).
- Do NOT leave keyPoints, importantSections, or complianceAndDeadlines empty. Populate:
  * "importantSections": 6 to 12 most significant sections/articles/rules in this scope (with "reference", "title", 1–2 sentence "summary", and exact PDF "page" in Devanagari digits).
  * "keyPoints": 5 to 8 concise, high-value takeaways.
  * "complianceAndDeadlines": 4 to 8 key authorities, duties, time limits (हदम्याद), or penalties (दण्ड/सजाय).
  * "schedulesOverview": schedules (अनुसूचीहरू) if present in scope, or concise Nepali note if none exist in this range.`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      documentTitle: {
        type: Type.STRING,
        description: 'Official clean title of the legal document.',
      },
      overview: {
        type: Type.STRING,
        description: '2 to 4 clear, cohesive paragraphs summarizing purpose, scope, and core essence.',
      },
      keyPoints: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: '5 to 8 key takeaways from the document or selected page range.',
      },
      importantSections: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            reference: { type: Type.STRING },
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            page: { type: Type.STRING },
          },
        },
        description: 'Most important sections/articles/rules with summary and page number.',
      },
      complianceAndDeadlines: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Key authorities, compliance procedures, timeframes, or penalties.',
      },
      schedulesOverview: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Summary of schedules (अनुसूची) in this document or range.',
      },
      customAnswer: {
        type: Type.STRING,
        description: 'Direct answer to the user custom question, or empty string if none was asked.',
      },
    },
  };

  const useFocusedRangeText =
    isPartialRange && extraction.hasUsableUnicodeText && extraction.extractedText.length >= 250;
  const useLargeUnicodeText =
    (buffer.byteLength > MAX_INLINE_PDF_BYTES || extraction.totalPages > 20) &&
    extraction.hasUsableUnicodeText &&
    extraction.extractedText.length >= 250;

  let inputMethod: PdfSummaryResult['inputMethod'] = 'text-extracted';
  let staticContents: any = null;

  if (useFocusedRangeText || useLargeUnicodeText) {
    inputMethod = 'text-extracted';
    staticContents = `${basePrompt}\n\nExtracted PDF Text (${analyzedRange}):\n${extraction.extractedText}`;
  } else {
    let inlineBuffer = buffer;
    let sliceHint = '';

    if (buffer.byteLength > MAX_INLINE_PDF_BYTES || extraction.totalPages > 12) {
      const repPages = buildRepresentativePageList(
        extraction.totalPages,
        extraction.startPage,
        extraction.endPage,
        10
      );
      const sliced = await slicePdfPages(buffer, repPages, MAX_INLINE_PDF_BYTES);
      inlineBuffer = sliced.buffer;
      if (sliced.sliced && sliced.pageNumbers.length > 0) {
        sliceHint = `\n\nNote: For fast visual accuracy on this ${extraction.totalPages}-page PDF, the attached excerpt contains representative PDF pages: ${sliced.pageNumbers.join(', ')}.`;
      }
    }

    if (inlineBuffer.byteLength <= MAX_INLINE_PDF_BYTES) {
      inputMethod = 'pdf-multimodal';
      const safeTextHint =
        !extraction.isCorruptedCmap && extraction.extractedText
          ? `\n\nSupplemental extracted text hint:\n${extraction.extractedText.slice(0, 6000)}`
          : '';
      const pdfPart = {
        inlineData: {
          mimeType: 'application/pdf',
          data: inlineBuffer.toString('base64'),
        },
      };
      const textPart = {
        text: isPartialRange
          ? `${basePrompt}\n\nCRITICAL: Focus specifically on PDF pages ${extraction.startPage} through ${extraction.endPage}.${sliceHint}${safeTextHint}`
          : `${basePrompt}${sliceHint}${safeTextHint}`,
      };
      staticContents = { parts: [pdfPart, textPart] };
    } else {
      inputMethod = 'files-api';
    }
  }

  const runAttempt = async (
    activeModel: string,
    thinkingLevel: ThinkingLevel,
    failoverOptions: { timeoutMs: number; budgetMs: number }
  ): Promise<PdfSummaryResult> => {
    return runWithGeminiKeyFailover(async ai => {
      let uploadedFileName: string | null = null;
      try {
        let contents = staticContents;

        if (inputMethod === 'files-api') {
          const pdfBlob = new Blob([new Uint8Array(buffer)], { type: 'application/pdf' });
          const uploaded = await ai.files.upload({
            file: pdfBlob,
            config: {
              mimeType: 'application/pdf',
              displayName: docDisplayName,
            },
          });
          uploadedFileName = uploaded.name || null;

          let activeFile = uploaded;
          let attempts = 0;
          while (activeFile.state === 'PROCESSING' && attempts < 10 && activeFile.name) {
            await new Promise(resolve => setTimeout(resolve, 1200));
            activeFile = await ai.files.get({ name: activeFile.name });
            attempts++;
          }

          if (activeFile.state === 'FAILED' || !activeFile.uri) {
            throw new Error('PDF फाइल प्रशोधन गर्न असफल भयो। कृपया पृष्ठ दायरा छान्नुहोस्।');
          }

          const filePart = createPartFromUri(activeFile.uri, activeFile.mimeType || 'application/pdf');
          const textPart = {
            text: isPartialRange
              ? `${basePrompt}\n\nCRITICAL: Focus specifically on PDF pages ${extraction.startPage} through ${extraction.endPage} of this PDF.`
              : basePrompt,
          };
          contents = { parts: [filePart, textPart] };
        }

        const response = await ai.models.generateContent({
          model: activeModel,
          contents,
          config: {
            thinkingConfig: { thinkingLevel },
            responseMimeType: 'application/json',
            responseSchema,
            systemInstruction:
              'You are an expert, neutral, and accurate Nepali Legal Information Assistant for a free public legal portal. Official sources: lawcommission.gov.np, dop.gov.np, supremecourt.gov.np. Output pure JSON in the requested language without internal thoughts, English filler words, or corrupted font characters.',
          },
        });

        const rawJson = (response.text ?? '{}').trim();
        const parsed = JSON.parse(rawJson);

        const rawResult: PdfSummaryResult = {
          documentTitle: parsed.documentTitle || docDisplayName.replace(/\.pdf$/i, ''),
          overview: parsed.overview || '',
          keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
          importantSections: Array.isArray(parsed.importantSections) ? parsed.importantSections : [],
          complianceAndDeadlines: Array.isArray(parsed.complianceAndDeadlines)
            ? parsed.complianceAndDeadlines
            : [],
          schedulesOverview: Array.isArray(parsed.schedulesOverview) ? parsed.schedulesOverview : [],
          customAnswer: parsed.customAnswer || '',
          totalPages: extraction.totalPages,
          analyzedRange,
          inputMethod,
          modelUsed: activeModel,
        };

        return sanitizePdfSummaryResult(rawResult, language);
      } finally {
        if (uploadedFileName) {
          try {
            await ai.files.delete({ name: uploadedFileName });
          } catch {
            // ignore cleanup failure
          }
        }
      }
    }, activeModel, failoverOptions);
  };

  if (req.useFastFallback) {
    return await runAttempt(FAST_FALLBACK_MODEL, ThinkingLevel.MINIMAL, {
      timeoutMs: inputMethod === 'files-api' ? 20_000 : 13_000,
      budgetMs: 25_000,
    });
  }

  // Try primary model first (~11s), then immediately fail over to fast model (~13s)
  // so every attempt satisfies Gemini's 10s minimum deadline while staying safely within gateway limits.
  try {
    return await runAttempt(SUMMARY_MODEL, ThinkingLevel.LOW, {
      timeoutMs: 11_000,
      budgetMs: 11_500,
    });
  } catch (primaryErr: any) {
    const status = primaryErr instanceof GeminiServiceError ? primaryErr.status : 500;
    if (status === 429 || status === 503 || status === 504 || status === 500) {
      return await runAttempt(FAST_FALLBACK_MODEL, ThinkingLevel.MINIMAL, {
        timeoutMs: 12_500,
        budgetMs: 13_500,
      });
    }
    throw primaryErr;
  }
}
