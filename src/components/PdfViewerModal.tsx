import React from 'react';
import { X, ExternalLink, Download, FileText, ChevronLeft, ChevronRight, Sparkles, RotateCcw } from 'lucide-react';
import { toGitHubRawUrl } from '../utils/urlUtils';
import { PdfCanvasViewer } from './PdfCanvasViewer';
import { FontSizeControls } from './FontSizeControls';
import {
  getPdfPageCalibration,
  getPrintedBookPageInfo,
  resetUserPdfPageOffset,
  setUserPdfPageOffset,
  toPhysicalPdfPage,
} from '../utils/pdfPageMap';
import { devaToNum, toDeva } from '../utils/markdownUtils';

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfPath: string;
  pdfName: string;
  targetPage?: string;
  highlightText?: string;
  isAdminOrOwner?: boolean;
  onSummarizePdf?: (pdfPath: string, page?: string) => void;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  isOpen,
  onClose,
  pdfPath,
  pdfName,
  targetPage,
  highlightText,
  isAdminOrOwner = false,
  onSummarizePdf,
}) => {
  const rawDataPage = devaToNum(targetPage || '1');
  const [currentPage, setCurrentPage] = React.useState(() => toPhysicalPdfPage(pdfPath, rawDataPage));
  const [totalPages, setTotalPages] = React.useState<number>(0);
  const [offsetVersion, setOffsetVersion] = React.useState<number>(0);

  React.useEffect(() => {
    if (isOpen && pdfPath) {
      setCurrentPage(toPhysicalPdfPage(pdfPath, devaToNum(targetPage || '1')));
      setTotalPages(0);
    }
  }, [targetPage, pdfPath, isOpen]);

  const calibration = React.useMemo(
    () => getPdfPageCalibration(pdfPath),
    [pdfPath, offsetVersion]
  );

  const printedInfo = React.useMemo(
    () => getPrintedBookPageInfo(pdfPath, currentPage),
    [pdfPath, currentPage, offsetVersion]
  );

  const handleAdjustOffset = (delta: number) => {
    const nextOffset = calibration.effectivePhysicalOffset + delta;
    setUserPdfPageOffset(pdfPath, nextOffset);
    setOffsetVersion(v => v + 1);
    setCurrentPage(p => {
      const next = Math.max(1, p + delta);
      return totalPages > 0 ? Math.min(totalPages, next) : next;
    });
  };

  const handleResetOffset = () => {
    const prevEffective = calibration.effectivePhysicalOffset;
    resetUserPdfPageOffset(pdfPath);
    const restored = getPdfPageCalibration(pdfPath);
    const diff = restored.effectivePhysicalOffset - prevEffective;
    setOffsetVersion(v => v + 1);
    if (diff !== 0) {
      setCurrentPage(p => {
        const next = Math.max(1, p + diff);
        return totalPages > 0 ? Math.min(totalPages, next) : next;
      });
    }
  };

  if (!isOpen || !pdfPath) return null;

  const rawUrl = isAdminOrOwner ? toGitHubRawUrl(pdfPath) : '';
  const proxyUrl = `/api/pdf-proxy?path=${encodeURIComponent(pdfPath)}`;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 bg-slate-800 text-white flex items-center justify-between gap-2 border-b border-slate-700">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <h3 className="font-bold text-sm sm:text-base text-white truncate">
                {pdfName}
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-400 truncate">
                {isAdminOrOwner && <span className="font-mono truncate">{pdfPath}</span>}
                {printedInfo.hasShift && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold shrink-0 text-[10px]">
                    {printedInfo.isFrontMatter
                      ? 'आवरण / विषय-सूची'
                      : `पुस्तक पृष्ठ ${toDeva(printedInfo.printedPage!)}`}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Physical PDF Page Jumper */}
            <div className="flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-700 text-xs text-slate-300">
              <span className="hidden sm:inline">PDF पृष्ठ:</span>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1 hover:text-white hover:bg-slate-800 disabled:opacity-40 rounded cursor-pointer"
                title="अघिल्लो पृष्ठ"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <input
                type="number"
                min="1"
                max={totalPages || undefined}
                value={currentPage}
                onChange={e => {
                  const next = Math.max(1, parseInt(e.target.value, 10) || 1);
                  setCurrentPage(totalPages > 0 ? Math.min(totalPages, next) : next);
                }}
                className="w-12 bg-slate-800 text-center font-bold text-amber-300 rounded px-1 py-0.5 border border-slate-600 text-xs"
              />
              {totalPages > 0 && (
                <span className="text-slate-400 font-mono tabular-nums">
                  / {toDeva(totalPages)}
                </span>
              )}
              <button
                type="button"
                onClick={() =>
                  setCurrentPage(p => (totalPages > 0 ? Math.min(totalPages, p + 1) : p + 1))
                }
                disabled={totalPages > 0 && currentPage >= totalPages}
                className="p-1 hover:text-white hover:bg-slate-800 disabled:opacity-40 rounded cursor-pointer"
                title="पछिल्लो पृष्ठ"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {onSummarizePdf && (
              <button
                type="button"
                onClick={() => onSummarizePdf(pdfPath, String(currentPage))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer transition-colors"
                title="यस PDF को AI सारांश तयार गर्नुहोस्"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                <span className="hidden sm:inline">AI सारांश</span>
              </button>
            )}

            {isAdminOrOwner && (
              <a
                href={rawUrl}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium cursor-pointer transition-colors"
              >
                <span>GitHub</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            <FontSizeControls variant="dark" />

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
              title="बन्द गर्नुहोस्"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Low-RAM Streaming PDF Canvas Viewer */}
        <div className="flex-1 min-h-0 bg-slate-950 relative">
          <PdfCanvasViewer
            pdfPath={pdfPath}
            page={currentPage}
            title={pdfName}
            highlightText={highlightText}
            allowDownload={isAdminOrOwner}
            onNumPages={setTotalPages}
            onPageChange={setCurrentPage}
          />
        </div>

        {/* Footer info & Live Offset Tuner */}
        <div className="px-4 sm:px-5 py-2 bg-slate-800/90 text-slate-300 text-xs border-t border-slate-700 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 truncate">
            <span>
              {calibration.effectivePhysicalOffset !== 0
                ? `डेटा पृष्ठ ${toDeva(rawDataPage)} → PDF पृष्ठ ${toDeva(currentPage)} (अफसेट ${calibration.effectivePhysicalOffset > 0 ? `+${toDeva(calibration.effectivePhysicalOffset)}` : toDeva(calibration.effectivePhysicalOffset)})`
                : 'प्रत्यक्ष PDF Proxy स्ट्रिम (कम RAM)'}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Inline Per-PDF Offset Adjuster */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-md px-1.5 py-0.5 text-[11px]">
              <span className="text-slate-400">अफसेट:</span>
              <button
                type="button"
                onClick={() => handleAdjustOffset(-1)}
                className="px-1.5 py-0.2 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer"
                title="PDF पृष्ठ १ पछाडि सार्नुहोस् (-1)"
              >
                -
              </button>
              <span className="px-1 font-mono font-bold text-amber-300 tabular-nums">
                {calibration.effectivePhysicalOffset >= 0
                  ? `+${calibration.effectivePhysicalOffset}`
                  : calibration.effectivePhysicalOffset}
              </span>
              <button
                type="button"
                onClick={() => handleAdjustOffset(1)}
                className="px-1.5 py-0.2 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer"
                title="PDF पृष्ठ १ अगाडि सार्नुहोस् (+1)"
              >
                +
              </button>
              {calibration.userOverrideOffset !== null && (
                <button
                  type="button"
                  onClick={handleResetOffset}
                  className="p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
                  title="पूर्वनिर्धारित अफसेटमा रिसेट गर्नुहोस्"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>

            {isAdminOrOwner && (
              <a
                href={`${proxyUrl}&download=1`}
                download={pdfName}
                className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                <span>डाउनलोड</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
