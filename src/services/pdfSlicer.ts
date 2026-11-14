import { execFile } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { PDFDocument } from 'pdf-lib';

const execFileAsync = promisify(execFile);

export function buildRepresentativePageList(
  totalPages: number,
  requestedStart = 1,
  requestedEnd?: number,
  maxPages = 22
): number[] {
  const startPage = Math.max(1, Math.min(totalPages, requestedStart || 1));
  const endPage = Math.max(startPage, Math.min(totalPages, requestedEnd || totalPages));
  const span = endPage - startPage + 1;

  if (span <= maxPages) {
    const all: number[] = [];
    for (let p = startPage; p <= endPage; p++) all.push(p);
    return all;
  }

  const pageList: number[] = [];
  const headCount = Math.min(8, Math.floor(maxPages * 0.4));
  const tailCount = Math.min(4, Math.floor(maxPages * 0.25));

  for (let p = startPage; p < startPage + headCount && p <= endPage; p++) {
    pageList.push(p);
  }

  const midStart = startPage + headCount;
  const midEnd = Math.max(midStart - 1, endPage - tailCount);
  const remainingSlots = Math.max(1, maxPages - headCount - tailCount);
  if (midEnd >= midStart) {
    const step = Math.max(1, Math.floor((midEnd - midStart + 1) / remainingSlots));
    for (let p = midStart; p <= midEnd; p += step) {
      if (pageList.length >= maxPages - tailCount) break;
      if (!pageList.includes(p)) pageList.push(p);
    }
  }

  for (let p = Math.max(startPage, endPage - tailCount + 1); p <= endPage; p++) {
    if (!pageList.includes(p)) pageList.push(p);
  }

  return pageList.sort((a, b) => a - b);
}

async function tryGhostscriptSlice(
  sourceBuffer: Buffer,
  pages: number[],
  maxBytes: number
): Promise<Buffer | null> {
  const id = crypto.randomBytes(8).toString('hex');
  const tmpDir = os.tmpdir();
  const inFile = path.join(tmpDir, `gs_in_${id}.pdf`);
  const outFile = path.join(tmpDir, `gs_out_${id}.pdf`);
  const pageListArg = `-sPageList=${pages.join(',')}`;

  try {
    await fs.promises.writeFile(inFile, sourceBuffer);

    for (const preset of ['/ebook', '/screen']) {
      try {
        await execFileAsync(
          'gs',
          [
            '-sDEVICE=pdfwrite',
            '-dCompatibilityLevel=1.4',
            `-dPDFSETTINGS=${preset}`,
            '-dNOPAUSE',
            '-dQUIET',
            '-dBATCH',
            pageListArg,
            `-sOutputFile=${outFile}`,
            inFile,
          ],
          { timeout: 15_000 }
        );
        if (fs.existsSync(outFile)) {
          const outBuf = await fs.promises.readFile(outFile);
          if (outBuf.byteLength > 0 && (outBuf.byteLength <= maxBytes || preset === '/screen')) {
            return outBuf;
          }
        }
      } catch {
        // try next preset or fallback to pdf-lib
      }
    }
    return null;
  } finally {
    for (const f of [inFile, outFile]) {
      try {
        if (fs.existsSync(f)) await fs.promises.unlink(f);
      } catch {
        // ignore cleanup error
      }
    }
  }
}

/**
 * Extracts and compresses a compact subset of 1-based pages from a PDF buffer.
 * Uses Ghostscript first (which strips unused 15MB+ shared image/font streams in <1s)
 * and falls back to pdf-lib if Ghostscript is unavailable.
 */
export async function slicePdfPages(
  sourceBuffer: Buffer,
  oneBasedPages: number[],
  maxBytes = 14 * 1024 * 1024
): Promise<{ buffer: Buffer; pageNumbers: number[]; sliced: boolean }> {
  try {
    const srcDoc = await PDFDocument.load(sourceBuffer, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    const total = srcDoc.getPageCount();
    const validPages = Array.from(
      new Set(oneBasedPages.filter(p => Number.isFinite(p) && p >= 1 && p <= total))
    ).sort((a, b) => a - b);

    if (validPages.length === 0) {
      return {
        buffer: sourceBuffer,
        pageNumbers: Array.from({ length: total }, (_, i) => i + 1),
        sliced: false,
      };
    }

    // 1. Prefer Ghostscript when extracting a subset or shrinking an oversized PDF
    const gsBuf = await tryGhostscriptSlice(sourceBuffer, validPages, maxBytes);
    if (gsBuf && gsBuf.byteLength <= maxBytes) {
      return {
        buffer: gsBuf,
        pageNumbers: validPages,
        sliced: true,
      };
    }

    if (validPages.length >= total) {
      return {
        buffer: gsBuf && gsBuf.byteLength < sourceBuffer.byteLength ? gsBuf : sourceBuffer,
        pageNumbers: validPages,
        sliced: Boolean(gsBuf && gsBuf.byteLength < sourceBuffer.byteLength),
      };
    }

    // 2. Fallback to pdf-lib if Ghostscript is unavailable
    const buildSlice = async (pages: number[]) => {
      const dstDoc = await PDFDocument.create();
      const copied = await dstDoc.copyPages(
        srcDoc,
        pages.map(p => p - 1)
      );
      copied.forEach(page => dstDoc.addPage(page));
      const bytes = await dstDoc.save({ useObjectStreams: true });
      return Buffer.from(bytes);
    };

    let selected = validPages;
    let outBuf = await buildSlice(selected);

    while (outBuf.byteLength > maxBytes && selected.length > 3) {
      selected = selected.slice(0, Math.max(3, Math.floor(selected.length * 0.65)));
      outBuf = await buildSlice(selected);
    }

    return {
      buffer: outBuf,
      pageNumbers: selected,
      sliced: true,
    };
  } catch {
    return {
      buffer: sourceBuffer,
      pageNumbers: oneBasedPages,
      sliced: false,
    };
  }
}
