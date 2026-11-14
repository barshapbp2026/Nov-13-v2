import { ThinkingLevel, Type, createPartFromUri } from '@google/genai';
import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { resolvePdfBuffer } from './pdfResolver.ts';
import { buildRepresentativePageList, slicePdfPages } from './pdfSlicer.ts';
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
const MAX_INLINE_PDF_BYTES = 15 * 1024 * 1024; // Keep safely below 20MB inline request cap
const MAX_EXTRACTED_CHARS = 28_000;

interface PdfExtractionSummary {
  totalPages: number;
  startPage: number;
  endPage: number;
  extractedText: string;
  devanagariRatio: number;
  hasUsableUnicodeText: boolean;
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
      const pageText = (content.items as any[])
        .map((item: any) => (typeof item?.str === 'string' ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

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
    const hasUsableUnicodeText = extractedText.length >= 250 && devanagariRatio >= 0.25;

    return {
      totalPages,
      startPage,
      endPage,
      extractedText,
      devanagariRatio,
      hasUsableUnicodeText,
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
      return 'Write ALL summary text fields in natural, clear, grammatically accurate Nepali Devanagari Unicode (नेपाली युनिकोड). Keep numerals readable and legal terms authentic to Nepal Law Commission usage.';
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

  const indexPreview = docRows.slice(0, 80).map(r => ({
    section_id: r.section_id || undefined,
    title_name: r.title_name || undefined,
    page: r.title_page || undefined,
    anusuchi_id: r.anusuchi_id || undefined,
    anusuchi_title: r.anusuchi_title || undefined,
    anusuchi_page: r.anusuchi_print_page || undefined,
  }));

  const docDisplayName = path.basename(pdfPath);

  const basePrompt = `Analyze this official Nepal legal PDF document and generate a structured, accurate legal summary.

Document Filename: ${docDisplayName}
Repository Path: ${pdfPath}
Total PDF Pages: ${extraction.totalPages}
Target Scope: ${analyzedRange}
Summary Mode: ${mode} — ${getModeInstructions(mode)}
Output Language Rule: ${getLanguageInstructions(language)}
${customQuestion ? `User's Specific Question (must answer directly in "customAnswer"): ${customQuestion}` : 'No custom question asked (leave "customAnswer" as empty string "").'}

${
  indexPreview.length > 0
    ? `Verified Structural Index from Portal Database (${docRows.length} total entries; showing up to 80):\n${JSON.stringify(indexPreview)}\n`
    : ''
}
Instructions:
- Ground your summary strictly in the PDF content and verified structural index. Never invent section numbers or penalties not in the text.
- If the PDF uses legacy/Preeti font glyphs or scanned pages, read the document visually/contextually and output flawless Devanagari Unicode (e.g., भूमि, नापजाँच, संहिता, अनुसूची).
- In "importantSections", include 5 to 12 most significant sections/articles/rules (with "reference" like "दफा ४" or "धारा १८", concise "title", practical 1–2 sentence "summary", and exact PDF "page" in Devanagari digits like "१२").
- In "keyPoints", provide 5 to 8 concise, high-value takeaways.
- In "complianceAndDeadlines", list key authorities, procedures, rights/duties, time limits, or penalties (or empty array if none apply in the analyzed range).
- In "schedulesOverview", list key schedules/forms (अनुसूचीहरू) if present in the document/range (or empty array if none).`;

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

    if (buffer.byteLength > MAX_INLINE_PDF_BYTES || extraction.totalPages > 24) {
      const repPages = buildRepresentativePageList(
        extraction.totalPages,
        extraction.startPage,
        extraction.endPage,
        22
      );
      const sliced = await slicePdfPages(buffer, repPages, MAX_INLINE_PDF_BYTES);
      inlineBuffer = sliced.buffer;
      if (sliced.sliced && sliced.pageNumbers.length > 0) {
        sliceHint = `\n\nNote: For fast processing of this ${extraction.totalPages}-page scanned PDF, the attached excerpt contains representative PDF pages: ${sliced.pageNumbers.join(', ')}.`;
      }
    }

    if (inlineBuffer.byteLength <= MAX_INLINE_PDF_BYTES) {
      inputMethod = 'pdf-multimodal';
      const pdfPart = {
        inlineData: {
          mimeType: 'application/pdf',
          data: inlineBuffer.toString('base64'),
        },
      };
      const textPart = {
        text: isPartialRange
          ? `${basePrompt}\n\nCRITICAL: Focus specifically on PDF pages ${extraction.startPage} through ${extraction.endPage} of the attached PDF.${sliceHint}${
              extraction.extractedText ? `\n\nOptional extracted text hint:\n${extraction.extractedText.slice(0, 15000)}` : ''
            }`
          : `${basePrompt}${sliceHint}`,
      };
      staticContents = { parts: [pdfPart, textPart] };
    } else {
      inputMethod = 'files-api';
    }
  }

  const failoverOptions =
    inputMethod === 'files-api'
      ? { timeoutMs: 42_000, budgetMs: 52_000 }
      : { timeoutMs: 28_000, budgetMs: 48_000 };

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
        while (activeFile.state === 'PROCESSING' && attempts < 20 && activeFile.name) {
          await new Promise(resolve => setTimeout(resolve, 1500));
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
        model: SUMMARY_MODEL,
        contents,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema,
          systemInstruction:
            'You are a senior Nepal legal research assistant. Produce accurate, concise, well-structured JSON summaries based strictly on the provided Nepal Gazette/Act/Regulation PDF. Do not invent citations or fabricate text.',
        },
      });

      const rawJson = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawJson);

      return {
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
        modelUsed: SUMMARY_MODEL,
      };
    } finally {
      if (uploadedFileName) {
        try {
          await ai.files.delete({ name: uploadedFileName });
        } catch {
          // ignore cleanup failure
        }
      }
    }
  }, SUMMARY_MODEL, failoverOptions);
}
