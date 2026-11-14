import { ThinkingLevel, Type, createPartFromUri } from '@google/genai';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import path from 'path';
import { resolvePdfBuffer } from './pdfResolver.ts';
import { slicePdfPages } from './pdfSlicer.ts';
import {
  GeminiServiceError,
  getGeminiKeysCount,
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
    const minPage = pageNumbers.length > 0 ? Math.max(1, Math.min(...pageNumbers)) : 1;
    const maxPage =
      pageNumbers.length > 0
        ? Math.min(totalPages, Math.max(...pageNumbers) + 1)
        : Math.min(totalPages, 25);

    const chunks: string[] = [];
    let totalChars = 0;

    for (let p = minPage; p <= maxPage; p++) {
      const page = await pdfDoc.getPage(p);
      const content = await page.getTextContent();
      const pageText = (content.items as any[])
        .map((item: any) => (typeof item?.str === 'string' ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

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
    const hasUsableUnicodeText = text.length >= 200 && devRatio >= 0.25;

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
      'सर्भरमा GEMINI_API_KEY_1..6 वा GEMINI_API_KEY कन्फिगर गरिएको छैन। कृपया Settings > Secrets प्यानलमा Key हरू सेट गर्नुहोस्।'
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

  const prompt = `You are a senior Nepal legal scholar creating a master reference encyclopedia of individual statutory sections (धारा/दफा/नियम/निर्देशन/बुँदा/अनुसूची) from Nepal official legal PDFs.

Document: ${docDisplayName} (${pdfPath})
Target Records to Summarize (${batchItems.length} entries):
${JSON.stringify(indexedTargets)}

INSTRUCTIONS:
1. Return one entry in the JSON array for EVERY rowIndex from 0 to ${batchItems.length - 1}.
2. For each rowIndex, read the exact statutory provision on the corresponding PDF page(s) and write:
   - "summaryNepali": 2 to 3 crisp, accurate, plain-language sentences in flawless Nepali Devanagari Unicode explaining what this section/schedule actually establishes, grants, prohibits, or requires.
   - "keyObligations": 1 to 3 short bullet points in Nepali highlighting key conditions, authorities, deadlines (हदम्याद), or penalties (सजाय) if mentioned in that section.
3. Never output corrupted font glyphs. Output standard Nepali Unicode only.
4. Stay strictly faithful to the legal PDF text.`;

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
    staticContents = `${prompt}\n\nExtracted PDF Text for Referenced Pages:\n${extraction.text}`;
  } else {
    // Scanned / legacy-font PDF: slice down to ONLY the referenced page window so Gemini reads fast & accurately inline
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
      for (let p = minPage; p <= maxPage && targetPages.length < 24; p++) {
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

  const activeModel = useFastFallback ? FAST_FALLBACK_MODEL : SUMMARY_MODEL;
  const thinkingLevel = useFastFallback ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW;
  const failoverOptions = needsFilesApi
    ? { timeoutMs: 42_000, budgetMs: 52_000 }
    : useFastFallback
    ? { timeoutMs: 25_000, budgetMs: 45_000 }
    : { timeoutMs: 36_000, budgetMs: 48_000 };

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
        while (activeFile.state === 'PROCESSING' && attempts < 20 && activeFile.name) {
          await new Promise(resolve => setTimeout(resolve, 1500));
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
            'You summarize individual Nepal statutory sections and schedules into concise, accurate Nepali Devanagari JSON. Output valid JSON array matching rowIndex 0..N-1.',
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

      return batchItems.map((it, idx) => {
        const generated = byIndex.get(idx);
        const fallbackTitle =
          it.row.title_name || it.row.anusuchi_title || it.row.section_id || it.row.anusuchi_id;
        return {
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
          summaryNepali:
            generated?.summaryNepali ||
            `${it.row.section_id || it.row.anusuchi_id} (${fallbackTitle}) सम्बन्धी कानूनी व्यवस्था।`,
          keyObligations: generated?.keyObligations || [],
          modelUsed: activeModel,
        };
      });
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
}
