import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { resolvePdfBuffer } from './pdfResolver.ts';
import { convertPreetiPageToUnicode, isLikelyPreetiText } from './preetiToUnicode.ts';
import { hasCorruptedPdfCmap } from '../utils/summarySanitizer.ts';

export interface PdfPageTextResult {
  pdfPath: string;
  page: number;
  span: number;
  totalPages: number;
  text: string;
  corruptedCmap: boolean;
  isPreetiConverted: boolean;
  pagesIncluded: { page: number; text: string }[];
}

const pageTextCache = new Map<string, PdfPageTextResult>();
const MAX_CACHE_ENTRIES = 120;

export async function extractPdfPageTextForCompare(
  pdfPath: string,
  requestedPage = 1,
  requestedSpan = 1
): Promise<PdfPageTextResult> {
  const safePage = Math.max(1, Math.trunc(requestedPage || 1));
  const safeSpan = Math.max(1, Math.min(3, Math.trunc(requestedSpan || 1)));
  const cacheKey = `${pdfPath}::p${safePage}::s${safeSpan}`;

  const cached = pageTextCache.get(cacheKey);
  if (cached) {
    // Refresh LRU order
    pageTextCache.delete(cacheKey);
    pageTextCache.set(cacheKey, cached);
    return cached;
  }

  const { buffer } = await resolvePdfBuffer(pdfPath);
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    verbosity: 0,
    useSystemFonts: true,
    disableFontFace: true,
  });

  const pdfDoc = await loadingTask.promise;
  try {
    const totalPages = pdfDoc.numPages || 1;
    const startPage = Math.max(1, Math.min(totalPages, safePage));
    const endPage = Math.min(totalPages, startPage + safeSpan - 1);

    const pagesIncluded: { page: number; text: string }[] = [];
    let isPreetiConverted = false;

    for (let p = startPage; p <= endPage; p++) {
      const pageObj = await pdfDoc.getPage(p);
      const content = await pageObj.getTextContent();
      // Preserve visual line breaks roughly by checking Y transform changes
      let lastY: number | null = null;
      const lines: string[] = [];
      let currentLine: string[] = [];

      for (const item of content.items as any[]) {
        const str = typeof item?.str === 'string' ? item.str : '';
        if (!str) continue;
        const y = Array.isArray(item?.transform) ? item.transform[5] : null;
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
          const joined = currentLine.join(' ').replace(/\s+/g, ' ').trim();
          if (joined) lines.push(joined);
          currentLine = [str];
        } else {
          currentLine.push(str);
        }
        if (y !== null) lastY = y;
      }
      const tail = currentLine.join(' ').replace(/\s+/g, ' ').trim();
      if (tail) lines.push(tail);

      let pageText = lines.join('\n').trim();
      if (pageText && isLikelyPreetiText(pageText)) {
        pageText = lines
          .map(ln => convertPreetiPageToUnicode(ln))
          .join('\n')
          .trim();
        isPreetiConverted = true;
      }

      pagesIncluded.push({ page: p, text: pageText });
    }

    const combined = pagesIncluded
      .map(p => p.text)
      .filter(Boolean)
      .join('\n\n')
      .trim();

    const corruptedCmap = hasCorruptedPdfCmap(combined);
    const result: PdfPageTextResult = {
      pdfPath,
      page: startPage,
      span: endPage - startPage + 1,
      totalPages,
      text: corruptedCmap ? '' : combined,
      corruptedCmap,
      isPreetiConverted: corruptedCmap ? false : isPreetiConverted,
      pagesIncluded: corruptedCmap ? [] : pagesIncluded,
    };

    if (pageTextCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = pageTextCache.keys().next().value;
      if (oldestKey) pageTextCache.delete(oldestKey);
    }
    pageTextCache.set(cacheKey, result);
    return result;
  } finally {
    await pdfDoc.cleanup();
    await loadingTask.destroy();
  }
}
