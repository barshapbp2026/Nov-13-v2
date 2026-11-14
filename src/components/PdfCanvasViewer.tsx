import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ExternalLink,
  Maximize2,
} from 'lucide-react';
import { toGitHubRawUrl } from '../utils/urlUtils';
import { formatDualPageLabel } from '../utils/pdfPageMap';
import { toDeva } from '../utils/markdownUtils';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// Global coordinator: ensures strictly 1 PDF document is loaded in browser RAM at any time
let currentActiveOwner: symbol | null = null;
let currentActiveCleanup: (() => void) | null = null;

interface PdfCanvasViewerProps {
  pdfPath: string;
  page: number;
  title?: string;
  highlightText?: string;
  suspended?: boolean;
  allowDownload?: boolean;
  onNumPages?: (numPages: number) => void;
  onPageChange?: (page: number) => void;
}

function devaToAsciiDigits(s: string): string {
  return (s || '').replace(/[०-९]/g, d => String('०१२३४५६७८९'.indexOf(d)));
}

function normalizeHighlightStr(s: string): string {
  return devaToAsciiDigits((s || '').normalize('NFC'))
    .replace(/[()[\]{}.,।:;ः'"`\-–—/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

interface ParsedHighlightQuery {
  leadingId: string;
  titleNorm: string;
  tokens: string[];
}

function parseHighlightQuery(query: string): ParsedHighlightQuery {
  const clean = devaToAsciiDigits((query || '').normalize('NFC')).trim();
  if (!clean) return { leadingId: '', titleNorm: '', tokens: [] };

  let leadingId = '';
  const schM = clean.match(/अनुसूची[\s–-]*([0-9]+[क-ह]?)/);
  if (schM) {
    leadingId = `अनुसूची-${schM[1]}`;
  } else {
    const secM = clean.match(/^([0-9]+[क-ह]?(?:\([0-9क-ह]+\))?)\s*[.):ः–-]?/);
    if (secM) leadingId = secM[1];
  }

  const titleOnly = clean
    .replace(/^(?:अनुसूची[\s–-]*[0-9]+[क-ह]?\s*[:.\-–]*\s*)+/, '')
    .replace(/^(?:[0-9]+[क-ह]?(?:\([0-9क-ह]+\))?\s*[.):ः–-]+\s*)+/, '')
    .trim();

  const titleNorm = normalizeHighlightStr(titleOnly);
  const stopWords = new Set([
    'धारा', 'दफा', 'नियम', 'निर्देशन', 'बुँदा', 'महल', 'अनुसूची',
    'को', 'का', 'की', 'र', 'तथा', 'वा', 'मा', 'सम्बन्धी', 'गर्ने', 'हुने', 'लागि',
  ]);
  const tokens = titleNorm
    .split(' ')
    .filter(t => t.length >= 2 && !stopWords.has(t))
    .slice(0, 8);

  return { leadingId, titleNorm, tokens };
}

function extractLineSectionId(rawLine: string): string {
  const s = devaToAsciiDigits(rawLine.trim());
  const schM = s.match(/^अनुसूची[\s–-]*([0-9]+[क-ह]?)/);
  if (schM) return `अनुसूची-${schM[1]}`;
  const secM = s.match(/^([0-9]+[क-ह]?)\s*(?:\(([0-9क-ह]+)\))?\s*[.:ः–-]/);
  if (secM) return secM[2] ? `${secM[1]}(${secM[2]})` : secM[1];
  return '';
}

interface PositionedPdfItem {
  item: any;
  x: number;
  y: number;
  w: number;
  h: number;
  str: string;
}

interface PdfVisualLine {
  y: number;
  avgH: number;
  items: PositionedPdfItem[];
  rawText: string;
  normText: string;
  lineId: string;
  score: number;
}

function buildVisualLines(
  rawItems: any[],
  viewportTransform: number[] | null,
  finalScale: number,
  parsed: ParsedHighlightQuery
): PdfVisualLine[] {
  const positioned: PositionedPdfItem[] = [];
  for (const it of rawItems) {
    if (typeof it?.str !== 'string' || !it.str.trim() || !Array.isArray(it.transform)) continue;
    let x: number;
    let y: number;
    let h: number;
    let w: number;
    if (viewportTransform) {
      const tx = pdfjsLib.Util.transform(viewportTransform, it.transform);
      x = tx[4];
      y = tx[5];
      h = Math.max(10, Math.hypot(tx[2], tx[3]) || Math.hypot(tx[0], tx[1]) || 12);
      w = Math.max(
        10,
        typeof it.width === 'number' && it.width > 0 ? it.width * finalScale : h * it.str.length * 0.5
      );
    } else {
      x = it.transform[4];
      y = -it.transform[5]; // invert PDF bottom-up Y to top-down order
      h = Math.max(10, Math.hypot(it.transform[2], it.transform[3]) || Math.hypot(it.transform[0], it.transform[1]) || 12);
      w = Math.max(10, typeof it.width === 'number' && it.width > 0 ? it.width : h * it.str.length * 0.5);
    }
    positioned.push({ item: it, x, y, w, h, str: it.str });
  }

  positioned.sort((a, b) => a.y - b.y || a.x - b.x);

  const lines: { y: number; avgH: number; items: PositionedPdfItem[] }[] = [];
  for (const p of positioned) {
    const existing = lines.find(l => Math.abs(l.y - p.y) <= Math.max(5, l.avgH * 0.45));
    if (existing) {
      existing.items.push(p);
      existing.y = (existing.y * (existing.items.length - 1) + p.y) / existing.items.length;
    } else {
      lines.push({ y: p.y, avgH: p.h, items: [p] });
    }
  }

  const scoredLines: PdfVisualLine[] = [];
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
    const rawText = line.items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim();
    if (
      !rawText ||
      rawText.includes('....') ||
      rawText.includes('. . .') ||
      rawText.includes('……') ||
      /^www\.[a-z0-9.-]+/i.test(rawText) ||
      /^[०-९0-9]+$/.test(rawText)
    ) {
      continue;
    }

    const normText = normalizeHighlightStr(rawText);
    const lineId = extractLineSectionId(rawText);
    let score = 0;

    if (parsed.leadingId) {
      if (lineId === parsed.leadingId) {
        score += 120;
      } else if (lineId && lineId.split('(')[0] === parsed.leadingId.split('(')[0]) {
        score += 70;
      } else if (lineId) {
        score -= 200; // Strictly reject neighbor sections/headers with different numbers
      }
    }

    if (parsed.titleNorm && parsed.titleNorm.length >= 4 && normText.includes(parsed.titleNorm)) {
      score += 90;
    }

    let exactTokenHits = 0;
    for (const tok of parsed.tokens) {
      if (normText.includes(tok)) {
        score += 28;
        exactTokenHits++;
      } else if (tok.length >= 4 && normText.includes(tok.slice(0, 3))) {
        score += 10;
      }
    }
    if (parsed.tokens.length > 0 && exactTokenHits === parsed.tokens.length) {
      score += 30;
    }

    if (/[ः:]/.test(rawText)) {
      score += 12;
    }
    // Penalize amendment date/title footnotes like "... २०८२।०१।०४" when a real clause heading is present
    if (/२०[७८९][०-९]।\d{2}।\d{2}\s*$/.test(devaToAsciiDigits(rawText))) {
      score -= 25;
    }

    scoredLines.push({
      y: line.y,
      avgH: line.avgH,
      items: line.items,
      rawText,
      normText,
      lineId,
      score,
    });
  }

  return scoredLines;
}

function pickBestHeaderLine(lines: PdfVisualLine[], parsed: ParsedHighlightQuery): PdfVisualLine | null {
  if (lines.length === 0) return null;
  let best: PdfVisualLine | null = null;
  for (const line of lines) {
    if (!best || line.score > best.score) {
      best = line;
    }
  }
  if (!best) return null;
  const minThreshold = parsed.leadingId ? 70 : parsed.tokens.length <= 1 ? 28 : 50;
  return best.score >= minThreshold ? best : null;
}

function selectHeaderItemsOnLine(line: PdfVisualLine, parsed: ParsedHighlightQuery): PositionedPdfItem[] {
  const items = line.items;
  if (items.length <= 2) return items;

  // Locate where the heading ends (usually `ः` or `:`, or right before subclause `(१)` / `(क)`)
  const maxScan = Math.min(items.length, Math.max(5, parsed.tokens.length + 5));
  let endIdx = -1;
  for (let i = 0; i < items.length; i++) {
    const s = items[i].str.trim();
    if (i > 0 && /^\([०-९0-9क-ह]+\)$/.test(s)) {
      endIdx = i - 1;
      break;
    }
    if (i < maxScan && /[ः:]\s*$/.test(s)) {
      endIdx = i;
      break;
    }
  }

  if (endIdx >= 0) {
    return items.slice(0, Math.max(1, endIdx + 1));
  }

  // Fallback for headers without `ः`/`:` — capture from start (if line starts with ID) up to last matched token item
  let firstMatchIdx = line.lineId ? 0 : -1;
  let lastMatchIdx = line.lineId ? 0 : -1;
  for (let i = 0; i < items.length; i++) {
    const itemNorm = normalizeHighlightStr(items[i].str);
    if (!itemNorm) continue;
    const matchesToken = parsed.tokens.some(
      tok => itemNorm.includes(tok) || (tok.length >= 4 && itemNorm.includes(tok.slice(0, 3)))
    );
    if (matchesToken) {
      if (firstMatchIdx === -1) firstMatchIdx = i;
      lastMatchIdx = i;
    }
  }

  if (firstMatchIdx >= 0 && lastMatchIdx >= firstMatchIdx) {
    return items.slice(firstMatchIdx, lastMatchIdx + 1);
  }
  return items.slice(0, Math.min(items.length, 6));
}

export const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({
  pdfPath,
  page,
  title,
  highlightText,
  suspended = false,
  allowDownload = false,
  onNumPages,
  onPageChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const renderSeqRef = useRef<number>(0);
  const probedQueryRef = useRef<string>('');

  const [viewerMode, setViewerMode] = useState<'canvas' | 'iframe'>('canvas');
  const [loadingDoc, setLoadingDoc] = useState<boolean>(true);
  const [renderingPage, setRenderingPage] = useState<boolean>(false);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [zoomScale, setZoomScale] = useState<number>(1); // 1 = fit container width
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [reloadNonce, setReloadNonce] = useState<number>(0);

  const proxyUrl = pdfPath ? `/api/pdf-proxy?path=${encodeURIComponent(pdfPath)}` : '';
  const rawUrl = allowDownload && pdfPath ? toGitHubRawUrl(pdfPath) : '';

  // Observe container width for crisp responsive page sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateWidth = () => {
      const w = el.clientWidth;
      if (w > 0) setContainerWidth(w);
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, [suspended, viewerMode]);

  // Load ONLY ONE active PDF via /api/pdf-proxy using chunked HTTP Range requests
  useEffect(() => {
    if (suspended || !proxyUrl || viewerMode !== 'canvas') {
      return;
    }

    const ownerToken = Symbol('pdf-viewer-owner');
    if (currentActiveCleanup) {
      currentActiveCleanup();
    }

    let cancelled = false;
    let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
    let activeDoc: pdfjsLib.PDFDocumentProxy | null = null;

    const releaseMemory = () => {
      cancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
        renderTaskRef.current = null;
      }
      if (activeDoc) {
        const docToCleanup = activeDoc;
        activeDoc = null;
        pdfDocRef.current = null;
        void docToCleanup.cleanup().catch(() => undefined);
      }
      if (loadingTask) {
        const taskToDestroy = loadingTask;
        loadingTask = null;
        void taskToDestroy.destroy().catch(() => undefined);
      }
      if (canvasRef.current) {
        canvasRef.current.width = 0;
        canvasRef.current.height = 0;
      }
      if (currentActiveOwner === ownerToken) {
        currentActiveOwner = null;
        currentActiveCleanup = null;
      }
    };

    currentActiveOwner = ownerToken;
    currentActiveCleanup = releaseMemory;

    setLoadingDoc(true);
    setErrorMsg('');
    setTotalPages(0);

    loadingTask = pdfjsLib.getDocument({
      url: proxyUrl,
      rangeChunkSize: 65536, // 64 KB byte-range chunks -> minimal browser & server RAM
      disableAutoFetch: true, // Fetch only active pages instead of preloading entire document
      disableStream: false,
      useSystemFonts: true,
    });

    loadingTask.promise
      .then(doc => {
        if (cancelled) {
          void doc.cleanup().catch(() => undefined);
          return;
        }
        activeDoc = doc;
        pdfDocRef.current = doc;
        setTotalPages(doc.numPages);
        setLoadingDoc(false);
        onNumPages?.(doc.numPages);
      })
      .catch(err => {
        if (cancelled) return;
        const msg = err?.message || 'PDF लोड गर्न सकिएन।';
        if (!String(msg).toLowerCase().includes('destroy')) {
          setErrorMsg(msg);
        }
        setLoadingDoc(false);
      });

    return releaseMemory;
  }, [proxyUrl, suspended, viewerMode, reloadNonce]);

  // Render requested page in-place on the active canvas and release page caches immediately
  const renderCurrentPage = useCallback(async () => {
    const doc = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || loadingDoc || suspended || viewerMode !== 'canvas') return;

    const safePage = Math.max(1, Math.min(doc.numPages || 1, page || 1));
    if (safePage !== page && onPageChange) {
      onPageChange(safePage);
    }

    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        // ignore
      }
      renderTaskRef.current = null;
    }

    const mySeq = ++renderSeqRef.current;
    setRenderingPage(true);

    try {
      const pdfPage = await doc.getPage(safePage);
      if (mySeq !== renderSeqRef.current || pdfDocRef.current !== doc) {
        pdfPage.cleanup();
        return;
      }

      const baseViewport = pdfPage.getViewport({ scale: 1 });
      const availWidth = Math.max(280, (containerWidth || 720) - 24);
      const fitScale = availWidth / baseViewport.width;
      const finalScale = Math.max(0.4, Math.min(3.5, fitScale * zoomScale));

      // Cap devicePixelRatio at 2 to prevent huge canvas bitmap RAM allocation on high-DPI mobile screens
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = pdfPage.getViewport({ scale: finalScale });

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) {
        pdfPage.cleanup();
        if (mySeq === renderSeqRef.current) setRenderingPage(false);
        return;
      }

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, viewport.width, viewport.height);

      const renderTask = pdfPage.render({
        canvas,
        canvasContext: ctx,
        viewport,
      });
      renderTaskRef.current = renderTask;

      await renderTask.promise;
      if (mySeq !== renderSeqRef.current || pdfDocRef.current !== doc) {
        pdfPage.cleanup();
        return;
      }

      // Highlight ONLY the single best matching header in RED directly on rendered page
      let firstHighlightTop: number | null = null;
      const parsedQuery = highlightText ? parseHighlightQuery(highlightText) : { leadingId: '', titleNorm: '', tokens: [] };
      const hasQuery = Boolean(parsedQuery.leadingId || parsedQuery.tokens.length > 0);
      if (hasQuery && mySeq === renderSeqRef.current && pdfDocRef.current === doc) {
        try {
          const textContent = await pdfPage.getTextContent();
          const rawItems = textContent.items as any[];
          const fullDevaCount = (rawItems.map(it => it?.str || '').join('').match(/[\u0900-\u097F]/g) || []).length;
          const visualLines = buildVisualLines(rawItems, viewport.transform, finalScale, parsedQuery);
          const bestLine = pickBestHeaderLine(visualLines, parsedQuery);

          if (bestLine) {
            const headerItems = selectHeaderItemsOnLine(bestLine, parsedQuery);
            const boxesToDraw: { x: number; y: number; w: number; h: number }[] = [];

            if (headerItems.length > 0) {
              const minX = Math.min(...headerItems.map(it => it.x));
              const maxX = Math.max(...headerItems.map(it => it.x + it.w));
              const minY = Math.min(...headerItems.map(it => it.y - it.h * 0.92));
              const maxY = Math.max(...headerItems.map(it => it.y + it.h * 0.36));
              boxesToDraw.push({
                x: Math.max(0, minX - 4),
                y: Math.max(0, minY - 3),
                w: maxX - minX + 8,
                h: maxY - minY + 6,
              });
            }

            // If title had no heading delimiter on line 1 and clearly wraps onto the immediate next non-numbered line, highlight that continuation too
            const bestIdx = visualLines.indexOf(bestLine);
            const nextLine = bestIdx >= 0 ? visualLines[bestIdx + 1] : undefined;
            if (
              nextLine &&
              !bestLine.rawText.includes('ः') &&
              !bestLine.rawText.includes(':') &&
              !nextLine.lineId &&
              !/^\([०-९0-9]+\)/.test(nextLine.rawText.trim()) &&
              nextLine.y - bestLine.y <= bestLine.avgH * 2.1 &&
              parsedQuery.tokens.some(t => nextLine.normText.includes(t))
            ) {
              const contItems = selectHeaderItemsOnLine(nextLine, parsedQuery);
              if (contItems.length > 0) {
                const minX = Math.min(...contItems.map(it => it.x));
                const maxX = Math.max(...contItems.map(it => it.x + it.w));
                const minY = Math.min(...contItems.map(it => it.y - it.h * 0.92));
                const maxY = Math.max(...contItems.map(it => it.y + it.h * 0.36));
                boxesToDraw.push({
                  x: Math.max(0, minX - 4),
                  y: Math.max(0, minY - 3),
                  w: maxX - minX + 8,
                  h: maxY - minY + 6,
                });
              }
            }

            if (boxesToDraw.length > 0) {
              ctx.save();
              ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
              ctx.strokeStyle = 'rgba(220, 38, 38, 0.95)';
              ctx.lineWidth = 2;
              for (const box of boxesToDraw) {
                ctx.fillRect(box.x, box.y, box.w, box.h);
                ctx.strokeRect(box.x, box.y, box.w, box.h);
                if (firstHighlightTop === null || box.y < firstHighlightTop) {
                  firstHighlightTop = box.y;
                }
              }
              ctx.restore();
            }
          } else if (fullDevaCount >= 40 && onPageChange) {
            // Readable Unicode Devanagari PDF had no matching header on landed page:
            // Probe ±4 nearby pages once per query using the same strict single-header scorer and clean up immediately.
            const probeKey = `${pdfPath}::${highlightText}`;
            if (probedQueryRef.current !== probeKey) {
              probedQueryRef.current = probeKey;
              const offsets = [1, -1, 2, -2, 3, -3, 4, -4];
              const minNonToc = safePage >= 6 ? 3 : 1;
              for (const delta of offsets) {
                const candidate = safePage + delta;
                if (candidate < minNonToc || candidate > doc.numPages) continue;
                if (mySeq !== renderSeqRef.current || pdfDocRef.current !== doc) break;
                const probePage = await doc.getPage(candidate);
                try {
                  const ptc = await probePage.getTextContent();
                  const pVisual = buildVisualLines(ptc.items as any[], null, 1, parsedQuery);
                  const matchedLine = pickBestHeaderLine(pVisual, parsedQuery);
                  if (matchedLine && mySeq === renderSeqRef.current && pdfDocRef.current === doc) {
                    onPageChange(candidate);
                    break;
                  }
                } finally {
                  probePage.cleanup();
                }
              }
            }
          }
        } catch {
          // Non-fatal: continue showing rendered page even if text extraction fails
        }
      }

      if (firstHighlightTop !== null && containerRef.current) {
        const containerEl = containerRef.current;
        const targetScrollTop = Math.max(0, firstHighlightTop - containerEl.clientHeight * 0.28);
        containerEl.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
      }

      pdfPage.cleanup();
      void doc.cleanup().catch(() => undefined);
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException' && !String(err?.message || '').includes('cancel')) {
        setErrorMsg(err?.message || 'पृष्ठ रेन्डर गर्न समस्या भयो।');
      }
    } finally {
      if (mySeq === renderSeqRef.current) {
        setRenderingPage(false);
      }
    }
  }, [page, loadingDoc, suspended, viewerMode, containerWidth, zoomScale, highlightText, onPageChange]);

  useEffect(() => {
    void renderCurrentPage();
  }, [renderCurrentPage]);

  if (suspended) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-400 p-6 text-center text-xs gap-2">
        <Maximize2 className="w-5 h-5 text-slate-500" />
        <span>अर्को PDF मोडल सक्रिय रहेकोले RAM बचतको लागि यो दृश्य पज गरिएको छ।</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 overflow-hidden">
      {/* Compact Viewer Sub-bar (Zoom + Mode Switch + Proxy Link) */}
      <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2 text-[11px] text-slate-300 shrink-0">
        <div className="flex items-center gap-1.5">
          {viewerMode === 'canvas' && (
            <>
              <button
                type="button"
                onClick={() => setZoomScale(z => Math.max(0.6, Number((z - 0.15).toFixed(2))))}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                title="जुम घटाउनुहोस्"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoomScale(1)}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono tabular-nums cursor-pointer"
                title="स्क्रिन फिट रिसेट"
              >
                {Math.round(zoomScale * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setZoomScale(z => Math.min(2.4, Number((z + 0.15).toFixed(2))))}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                title="जुम बढाउनुहोस्"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {totalPages > 0 && (
            <span className="ml-1 text-slate-300 font-medium tabular-nums truncate max-w-[230px]">
              {formatDualPageLabel(pdfPath, Math.max(1, Math.min(totalPages, page)), totalPages)}
            </span>
          )}
        </div>

        {allowDownload && (
          <div className="flex items-center gap-1.5">
            <div className="bg-slate-800 rounded p-0.5 flex items-center border border-slate-700">
              <button
                type="button"
                onClick={() => setViewerMode('canvas')}
                className={`px-2 py-0.5 rounded text-[11px] cursor-pointer transition-colors ${
                  viewerMode === 'canvas' ? 'bg-slate-700 text-white font-semibold' : 'text-slate-400 hover:text-white'
                }`}
                title="कम RAM स्ट्रिमिङ दर्शक (सबै डिभाइसका लागि उपयुक्त)"
              >
                स्ट्रिम
              </button>
              <button
                type="button"
                onClick={() => setViewerMode('iframe')}
                className={`px-2 py-0.5 rounded text-[11px] cursor-pointer transition-colors ${
                  viewerMode === 'iframe' ? 'bg-slate-700 text-white font-semibold' : 'text-slate-400 hover:text-white'
                }`}
                title="नेटिभ ब्राउजर PDF दर्शक"
              >
                नेटिभ
              </button>
            </div>

            <a
              href={`${proxyUrl}#page=${page}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              title="Proxy मार्फत नयाँ ट्याबमा खोल्नुहोस्"
            >
              <ExternalLink className="w-3 h-3" />
              <span className="hidden sm:inline">Proxy खोल्नुहोस्</span>
            </a>
          </div>
        )}
      </div>

      {/* Main Content Surface */}
      {allowDownload && viewerMode === 'iframe' ? (
        <div className="flex-1 bg-slate-950 relative">
          <iframe
            key={`${pdfPath}-${page}`}
            src={`${proxyUrl}#page=${page}&view=FitH`}
            title={title || 'PDF Document'}
            className="w-full h-full border-0"
          />
        </div>
      ) : (
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-slate-900/95 p-3 flex flex-col items-center relative"
        >
          {(loadingDoc || renderingPage) && !errorMsg && (
            <div className="sticky top-2 z-10 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950/90 border border-slate-700 text-xs text-slate-200 shadow-lg mb-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              <span>
                {loadingDoc ? 'PDF Proxy बाट स्ट्रिम हुँदैछ...' : `पृष्ठ ${toDeva(page)} रेन्डर हुँदैछ...`}
              </span>
            </div>
          )}

          {errorMsg ? (
            <div className="my-auto max-w-md w-full bg-slate-800 border border-rose-500/40 rounded-xl p-5 text-center space-y-3 text-xs text-slate-200">
              <AlertTriangle className="w-7 h-7 text-rose-400 mx-auto" />
              <div className="font-semibold text-sm text-white">PDF लोड गर्न समस्या भयो</div>
              <p className="text-slate-300 break-words">{errorMsg}</p>
              <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
                <button
                  type="button"
                  onClick={() => setReloadNonce(n => n + 1)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>पुनः प्रयास</span>
                </button>
                {allowDownload && (
                  <>
                    <button
                      type="button"
                      onClick={() => setViewerMode('iframe')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>नेटिभ Iframe खोल्नुहोस्</span>
                    </button>
                    <a
                      href={rawUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>GitHub PDF</span>
                    </a>
                  </>
                )}
              </div>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              onContextMenu={allowDownload ? undefined : e => e.preventDefault()}
              className="shadow-2xl rounded bg-white block mx-auto"
            />
          )}
        </div>
      )}
    </div>
  );
};
