import { ThinkingLevel, Type, createPartFromUri } from '@google/genai';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import path from 'path';
import { resolvePdfBuffer } from './pdfResolver.ts';
import { slicePdfPages } from './pdfSlicer.ts';
import { convertPreetiPageToUnicode, isLikelyPreetiText } from './preetiToUnicode.ts';
import {
  hasCorruptedPdfCmap,
  isDirtyOrIncompleteDafaRecord,
  sanitizeDafaSummaryItem,
} from '../utils/summarySanitizer.ts';
import {
  GeminiServiceError,
  getGeminiKeysCount,
  isModelInCooldown,
  markModelInCooldown,
  runWithGeminiKeyFailover,
} from './geminiKeyPool.ts';
import type { DafaSummaryItem, LegalRow } from '../types';

const SUMMARY_MODEL = 'gemini-4-hydrogen';
const FAST_FALLBACK_MODEL = 'gemini-3.1-flash-lite';
const MAX_INLINE_PDF_BYTES = 14 * 1024 * 1024;
const MAX_CONTEXT_CHARS = 90_000;

interface DafaBatchInputRow {
  docId: string;
  row: LegalRow;
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

function toDevanagariDigits(val: number | string): string {
  const devDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  return String(val).replace(/[0-9]/g, d => devDigits[parseInt(d, 10)]);
}

async function extractPageRangeText(
  buffer: Buffer,
  pageNumbers: number[]
): Promise<{ totalPages: number; text: string; hasUsableUnicodeText: boolean }> {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    verbosity: 0,
    useSystemFonts: true,
    disableFontFace: true,
  });

  const pdfDoc = await loadingTask.promise;
  try {
    const totalPages = pdfDoc.numPages || 1;
    const minPage = pageNumbers.length > 0 ? Math.max(1, Math.min(...pageNumbers) - 1) : 1;
    const maxPage =
      pageNumbers.length > 0
        ? Math.min(totalPages, Math.max(...pageNumbers) + 2)
        : Math.min(totalPages, 25);

    const chunks: string[] = [];
    let totalChars = 0;

    for (let p = minPage; p <= maxPage; p++) {
      const page = await pdfDoc.getPage(p);
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
        const entry = `\n--- [PDF पृष्ठ ${toDevanagariDigits(p)} / Page ${p}] ---\n${pageText}`;
        if (totalChars + entry.length <= MAX_CONTEXT_CHARS) {
          chunks.push(entry);
          totalChars += entry.length;
        } else {
          break;
        }
      }
    }

    const text = chunks.join('\n').trim();
    const nonSpace = text.replace(/\s+/g, '');
    const devChars = (nonSpace.match(/[\u0900-\u097F]/g) || []).length;
    const devRatio = nonSpace.length > 0 ? devChars / nonSpace.length : 0;
    const isCorruptedCmap = hasCorruptedPdfCmap(text);
    const hasUsableUnicodeText = !isCorruptedCmap && text.length >= 200 && devRatio >= 0.25;

    return { totalPages, text, hasUsableUnicodeText };
  } finally {
    await pdfDoc.cleanup();
    await loadingTask.destroy();
  }
}

export async function summarizeDafasBatchWithGemini(
  pdfPath: string,
  items: DafaBatchInputRow[],
  useFastFallback = false
): Promise<DafaSummaryItem[]> {
  if (getGeminiKeysCount() === 0) {
    throw new GeminiServiceError(
      503,
      'सर्भरमा GEMINI_API_KEY_1..10 वा GEMINI_API_KEYS कन्फिगर गरिएको छैन (प्रोजेक्टको डिफल्ट GEMINI_API_KEY प्रयोग गरिँदैन)। कृपया Settings > Secrets प्यानलमा Key हरू सेट गर्नुहोस्।'
    );
  }

  if (!pdfPath || !Array.isArray(items) || items.length === 0) {
    throw new GeminiServiceError(400, 'कृपया सारांशको लागि PDF र दफाहरू पठाउनुहोस्।');
  }

  const batchItems = items.slice(0, 30);
  const { buffer } = await resolvePdfBuffer(pdfPath);

  const referencedPages = batchItems
    .map(it => toEnglishInt(it.row.title_page) || toEnglishInt(it.row.anusuchi_print_page))
    .filter((p): p is number => typeof p === 'number');

  const extraction = await extractPageRangeText(buffer, referencedPages);
  const docDisplayName = path.basename(pdfPath);

  const indexedTargets = batchItems.map((it, idx) => ({
    rowIndex: idx,
    section_id: it.row.section_id || '',
    title_name: it.row.title_name || '',
    title_page: it.row.title_page || '',
    type: it.row.type || '',
    anusuchi_id: it.row.anusuchi_id || '',
    anusuchi_title: it.row.anusuchi_title || '',
    anusuchi_print_page: it.row.anusuchi_print_page || '',
  }));

  const prompt = `You are a neutral, accurate Nepali Legal Information Assistant creating a master reference of individual statutory sections (धारा/दफा/नियम/निर्देशन/बुँदा/अनुसूची) sourced from official portals of Nepal (lawcommission.gov.np, dop.gov.np, supremecourt.gov.np).

Document: ${docDisplayName} (${pdfPath})
Target Records to Summarize (${batchItems.length} entries):
${JSON.stringify(indexedTargets)}

STRICT INSTRUCTIONS:
1. Return one entry in the JSON array for EVERY rowIndex from 0 to ${batchItems.length - 1}.
2. For each rowIndex, read the statutory provision on the corresponding PDF page(s) and write:
   - "summaryNepali": 2 crisp, accurate, neutral sentences in 100% pure Nepali Devanagari Unicode explaining what this section/schedule actually establishes, grants, prohibits, or requires (for educational and informational awareness only).
   - "keyObligations": 1 to 3 short bullet points in 100% pure Nepali Devanagari highlighting key conditions, authorities, deadlines (हदम्याद), or penalties (सजाय) if mentioned.
3. FORBIDDEN:
   - NEVER output English words, self-corrections ("Note:", "Wait", "Let's", "However", "Done"), or internal thought commentary.
   - NEVER output watermark excuse text or refusal messages. If exact text spans adjacent pages, read the context visually/textually across pages accurately.
   - NEVER output corrupted font glyphs (like िमतपूमतय, मममत, व्र्त्ति, ठदनु) or Private Use Area symbols.`;

  const responseSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        rowIndex: { type: Type.INTEGER },
        summaryNepali: { type: Type.STRING },
        keyObligations: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
    },
  };

  let staticContents: any = null;
  let needsFilesApi = false;

  if (extraction.hasUsableUnicodeText) {
    staticContents = `${prompt}\n\nVerified Nepali Text for Referenced Pages:\n${extraction.text}`;
  } else {
    let inlineBuffer = buffer;
    let sliceHint = '';

    if (buffer.byteLength > 8 * 1024 * 1024 || extraction.totalPages > 20) {
      const minPage =
        referencedPages.length > 0 ? Math.max(1, Math.min(...referencedPages) - 1) : 1;
      const maxPage =
        referencedPages.length > 0
          ? Math.min(extraction.totalPages, Math.max(...referencedPages) + 2)
          : Math.min(extraction.totalPages, 20);
      const targetPages: number[] = [];
      for (let p = minPage; p <= maxPage && targetPages.length < 18; p++) {
        targetPages.push(p);
      }
      const sliced = await slicePdfPages(buffer, targetPages, MAX_INLINE_PDF_BYTES);
      inlineBuffer = sliced.buffer;
      if (sliced.sliced && sliced.pageNumbers.length > 0) {
        sliceHint = `\n\nNote: This attached PDF excerpt contains PDF pages ${sliced.pageNumbers[0]} through ${
          sliced.pageNumbers[sliced.pageNumbers.length - 1]
        } (from the full ${extraction.totalPages}-page document).`;
      }
    }

    if (inlineBuffer.byteLength <= MAX_INLINE_PDF_BYTES) {
      staticContents = {
        parts: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: inlineBuffer.toString('base64'),
            },
          },
          { text: `${prompt}${sliceHint}` },
        ],
      };
    } else {
      needsFilesApi = true;
    }
  }

  const runBatchWithModel = async (
    activeModel: string,
    thinkingLevel: ThinkingLevel,
    failoverOptions: { timeoutMs: number; budgetMs: number }
  ): Promise<DafaSummaryItem[]> => {
    return runWithGeminiKeyFailover(async ai => {
      let uploadedFileName: string | null = null;
      try {
        let contents = staticContents;
        if (needsFilesApi) {
          const pdfBlob = new Blob([new Uint8Array(buffer)], { type: 'application/pdf' });
          const uploaded = await ai.files.upload({
            file: pdfBlob,
            config: { mimeType: 'application/pdf', displayName: docDisplayName },
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
            throw new Error('ठूलो PDF फाइल प्रशोधन गर्न असफल भयो।');
          }
          contents = {
            parts: [
              createPartFromUri(activeFile.uri, activeFile.mimeType || 'application/pdf'),
              { text: prompt },
            ],
          };
        }

        const response = await ai.models.generateContent({
          model: activeModel,
          contents,
          config: {
            thinkingConfig: { thinkingLevel },
            responseMimeType: 'application/json',
            responseSchema,
            systemInstruction:
              'You are a neutral, accurate Nepali Legal Information Assistant summarizing Nepal statutory sections/schedules into 100% pure Nepali Devanagari JSON (educational awareness only). Never emit English text, self-corrections, thoughts, placeholders, or corrupted glyphs.',
          },
        });

        const rawText = (response.text ?? '[]').trim();
        const parsed = JSON.parse(rawText);
        const byIndex = new Map<number, { summaryNepali: string; keyObligations: string[] }>();
        if (Array.isArray(parsed)) {
          for (const entry of parsed) {
            if (typeof entry?.rowIndex === 'number') {
              byIndex.set(entry.rowIndex, {
                summaryNepali: String(entry.summaryNepali || '').trim(),
                keyObligations: Array.isArray(entry.keyObligations)
                  ? entry.keyObligations.map((x: any) => String(x || '').trim()).filter(Boolean)
                  : [],
              });
            }
          }
        }

        const validResults: DafaSummaryItem[] = [];
        for (let idx = 0; idx < batchItems.length; idx++) {
          const it = batchItems[idx];
          const generated = byIndex.get(idx);
          if (!generated?.summaryNepali) continue;

          const cleaned = sanitizeDafaSummaryItem<DafaSummaryItem>({
            docId: it.docId,
            pdfPath: it.row.pdf_path || pdfPath,
            pdfName: it.row.pdf_name || docDisplayName,
            folderId: it.row.folder_id || '',
            sectionId: it.row.section_id || '',
            titleName: it.row.title_name || '',
            titlePage: it.row.title_page || it.row.anusuchi_print_page || '',
            recordType: it.row.type || '',
            anusuchiId: it.row.anusuchi_id || '',
            anusuchiTitle: it.row.anusuchi_title || '',
            summaryNepali: generated.summaryNepali,
            keyObligations: generated.keyObligations || [],
            modelUsed: activeModel,
          });

          if (!isDirtyOrIncompleteDafaRecord(cleaned)) {
            validResults.push(cleaned);
          }
        }

        if (validResults.length === 0) {
          throw new GeminiServiceError(
            503,
            'AI बाट मान्य र सफा नेपाली सारांश प्राप्त हुन सकेन — सानो समूहबाट पुनः प्रयास गरिँदैछ।'
          );
        }

        return validResults;
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

  if (useFastFallback || isModelInCooldown(SUMMARY_MODEL)) {
    return runBatchWithModel(FAST_FALLBACK_MODEL, ThinkingLevel.MINIMAL, {
      timeoutMs: needsFilesApi ? 22_000 : 16_000,
      budgetMs: 48_000,
    });
  }

  try {
    return await runBatchWithModel(SUMMARY_MODEL, ThinkingLevel.LOW, {
      timeoutMs: needsFilesApi ? 14_000 : 10_500,
      budgetMs: needsFilesApi ? 15_000 : 11_000,
    });
  } catch (primaryErr: any) {
    const status = primaryErr instanceof GeminiServiceError ? primaryErr.status : 500;
    if (status === 429 || status === 503 || status === 504 || status === 500) {
      if (status === 503 || status === 504) {
        markModelInCooldown(SUMMARY_MODEL, 60_000);
      }
      return await runBatchWithModel(FAST_FALLBACK_MODEL, ThinkingLevel.MINIMAL, {
        timeoutMs: 16_000,
        budgetMs: 45_000,
      });
    }
    throw primaryErr;
  }
}
