import { ThinkingLevel, Type } from '@google/genai';
import { resolvePdfBuffer } from './pdfResolver.ts';
import { slicePdfPages } from './pdfSlicer.ts';
import { runWithGeminiKeyFailover } from './geminiKeyPool.ts';
import { toPhysicalPdfPage } from '../utils/pdfPageMap.ts';
import { devaToNum } from '../utils/markdownUtils.ts';

const DEFAULT_MODEL = 'gemini-4-hydrogen';
const MAX_INLINE_PDF_BYTES = 14 * 1024 * 1024;

export interface TitleRepairInputItem {
  idx: number;
  section_id: string;
  title_name: string;
  anusuchi_id: string;
  anusuchi_title: string;
  page: string;
}

export interface TitleRepairOutputItem {
  idx: number;
  clean_title_name: string;
  clean_anusuchi_title: string;
  clean_anusuchi_id: string;
}

export async function repairTitlesBatchFromPdf(
  pdfPath: string,
  items: TitleRepairInputItem[],
  options?: { model?: string; omitCorruptedText?: boolean }
): Promise<TitleRepairOutputItem[]> {
  const activeModel = options?.model || DEFAULT_MODEL;
  const omitCorruptedText = options?.omitCorruptedText ?? false;
  const { buffer } = await resolvePdfBuffer(pdfPath);

  const physPages = items
    .map(it => toPhysicalPdfPage(pdfPath, devaToNum(it.page || '1')))
    .filter(p => Number.isFinite(p) && p >= 1);

  const minPage = physPages.length > 0 ? Math.max(1, Math.min(...physPages) - 1) : 1;
  const maxPage = physPages.length > 0 ? Math.max(...physPages) + 2 : 12;
  const targetPages: number[] = [];
  for (let p = minPage; p <= maxPage && targetPages.length < 16; p++) {
    targetPages.push(p);
  }

  const sliced = await slicePdfPages(buffer, targetPages, MAX_INLINE_PDF_BYTES);

  const indexed = items.map((it, rowIndex) =>
    omitCorruptedText
      ? {
          rowIndex,
          section_id: it.section_id,
          anusuchi_id: it.anusuchi_id,
          has_anusuchi_title: Boolean(it.anusuchi_title),
          physicalPdfPageHint: toPhysicalPdfPage(pdfPath, devaToNum(it.page || '1')),
        }
      : {
          rowIndex,
          section_id: it.section_id,
          broken_ocr_reference: it.title_name,
          anusuchi_id: it.anusuchi_id,
          broken_anusuchi_reference: it.anusuchi_title,
          physicalPdfPageHint: toPhysicalPdfPage(pdfPath, devaToNum(it.page || '1')),
        }
  );

  const prompt = `You are a master Nepali legal proofreader inspecting the attached official Nepal legal PDF pages (${sliced.pageNumbers[0]}..${sliced.pageNumbers[sliced.pageNumbers.length - 1]}).

CRITICAL: Read the EXACT visual heading printed on the attached PDF pages for each entry below.
${
  omitCorruptedText
    ? 'Locate each section_id / anusuchi_id on its physicalPdfPageHint (or adjacent page) and transcribe its exact printed Nepali heading.'
    : 'WARNING: The broken_ocr_reference field contains corrupted Preeti/OCR glyphs (such as ¥, «, म/ि swaps, ङ्क instead of ङ्ग, स्त्ा, नेे double matras, merged/split words, ASCII digits, or leaked body text). NEVER copy broken spellings or broken spacing from broken_ocr_reference — always verify visually against the PDF and output 100% grammatically clean, spell-checked Nepali Devanagari Unicode.'
}

Input entries (${items.length}):
${JSON.stringify(indexed)}

RULES:
1. Return one object for every rowIndex 0..${items.length - 1}.
2. "clean_title_name":
   - Format strictly as "<section_id> <clean Nepali heading>" when section_id is present (e.g., "१. संक्षिप्त नाम र प्रारम्भ", "३२१. सम्पत्ति हस्तान्तरण नभएमा गुठी भङ्ग हुने"). Note: no colon ":" or trailing "ः" unless genuinely part of the statutory heading, and NO double vowel signs like नेे/कोे.
   - For schedule entries (anusuchi_id present), format as "<anusuchi_id>: <clean title>" (or for अनुसूची-१ sub-rows like (२.१.१.३), format as "२.१.१.३ <clean offense title>").
   - ONLY output the heading title as printed in the PDF (never leak body text like "विषय वा प्रसङ्गले अर्को अर्थ नलागेमा..." or next section numbers).
   - Ensure proper Nepali word spacing and orthography (e.g. "गर्नु पर्ने" or "गर्नुपर्ने", NOT "गर्नु प ने" or "गर्नुपने"; "प्रारम्भ", NOT "प्रारम्भा"; "परिभाषा", NOT "परिभाषाा"; "सङ्गठित", NOT "सङ्कठित"; "पुर्‍याउनुपर्ने", NOT "पु¥याउनुपर्ने").
3. "clean_anusuchi_title":
   - If the entry is an anusuchi record (${omitCorruptedText ? 'has_anusuchi_title is true' : 'broken_anusuchi_reference is non-empty'}), provide the cleaned Nepali Unicode version matching clean_title_name; otherwise return "".
4. "clean_anusuchi_id":
   - Keep anusuchi_id identical, EXCEPT convert any ASCII digits inside parentheses like "(2.1.1.3)" to Devanagari "(२.१.१.३)". If empty, return "".`;

  const responseSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        rowIndex: { type: Type.INTEGER },
        clean_title_name: { type: Type.STRING },
        clean_anusuchi_title: { type: Type.STRING },
        clean_anusuchi_id: { type: Type.STRING },
      },
    },
  };

  const contents = {
    parts: [
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: sliced.buffer.toString('base64'),
        },
      },
      { text: prompt },
    ],
  };

  return runWithGeminiKeyFailover(
    async ai => {
      const response = await ai.models.generateContent({
        model: activeModel,
        contents,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema,
          systemInstruction:
            'Visually read official Nepal legal PDF pages and transcribe exact, spell-checked Nepali Devanagari Unicode section and schedule headings. Never output Preeti/OCR artifacts or broken spacing.',
        },
      });
      const parsed = JSON.parse((response.text ?? '[]').trim());
      const byIndex = new Map<number, any>();
      if (Array.isArray(parsed)) {
        for (const p of parsed) {
          if (typeof p?.rowIndex === 'number') byIndex.set(p.rowIndex, p);
        }
      }
      return items.map((it, idx) => {
        const res = byIndex.get(idx);
        return {
          idx: it.idx,
          clean_title_name: res?.clean_title_name ? String(res.clean_title_name).trim() : it.title_name,
          clean_anusuchi_title:
            it.anusuchi_title && res?.clean_anusuchi_title
              ? String(res.clean_anusuchi_title).trim()
              : it.anusuchi_title,
          clean_anusuchi_id:
            it.anusuchi_id && res?.clean_anusuchi_id
              ? String(res.clean_anusuchi_id).trim()
              : it.anusuchi_id,
        };
      });
    },
    activeModel,
    { timeoutMs: 25_000, budgetMs: 52_000 }
  );
}
