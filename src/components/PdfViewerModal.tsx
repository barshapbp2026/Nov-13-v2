import React from 'react';
import { X, ExternalLink, Download, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { toGitHubRawUrl } from '../utils/urlUtils';

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfPath: string;
  pdfName: string;
  targetPage?: string;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  isOpen,
  onClose,
  pdfPath,
  pdfName,
  targetPage,
}) => {
  const toDeva = (n: number) => n.toString().replace(/[0-9]/g, d => '०१२३४५६७८९'[parseInt(d, 10)]);
  const toNum = (s: string) => {
    if (!s) return 1;
    const clean = s.replace(/[०-९]/g, d => String('०१२३४५६७८९'.indexOf(d))).replace(/[^0-9]/g, '');
    return parseInt(clean, 10) || 1;
  };

  const initialPage = toNum(targetPage || '1');
  const [currentPage, setCurrentPage] = React.useState(initialPage);

  React.useEffect(() => {
    if (isOpen && pdfPath) {
      setCurrentPage(toNum(targetPage || '1'));
    }
  }, [targetPage, pdfPath, isOpen]);

  if (!isOpen || !pdfPath) return null;

  const rawUrl = toGitHubRawUrl(pdfPath);
  const proxyUrl = `/api/pdf-proxy?path=${encodeURIComponent(pdfPath)}`;
  // Embed via local/inline proxy with page hash for standard browser PDF viewer
  const iframeUrl = `${proxyUrl}#page=${currentPage}`;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div 
        className="relative bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-800 text-white flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <h3 className="font-bold text-sm sm:text-base text-white truncate">
                {pdfName}
              </h3>
              <p className="text-xs text-slate-400 font-mono truncate">
                {pdfPath}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Page Jumper */}
            <div className="flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-700 text-xs text-slate-300">
              <span>पृष्ठ:</span>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="p-1 hover:text-white hover:bg-slate-800 rounded cursor-pointer"
                title="अघिल्लो पृष्ठ"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <input
                type="number"
                min="1"
                value={currentPage}
                onChange={e => setCurrentPage(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-12 bg-slate-800 text-center font-bold text-amber-300 rounded px-1 py-0.5 border border-slate-600 text-xs"
              />
              <button
                onClick={() => setCurrentPage(p => p + 1)}
                className="p-1 hover:text-white hover:bg-slate-800 rounded cursor-pointer"
                title="पछिल्लो पृष्ठ"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <a
              href={rawUrl}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium cursor-pointer transition-colors"
            >
              <span>नयाँ ट्याबमा खोल्नुहोस्</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF iframe viewer */}
        <div className="flex-1 bg-slate-950 relative">
          <iframe
            key={`${pdfPath}-${currentPage}`}
            src={iframeUrl}
            title={pdfName}
            className="w-full h-full border-0"
          />
        </div>

        {/* Footer info */}
        <div className="px-5 py-2.5 bg-slate-800/90 text-slate-300 text-xs border-t border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>प्रत्यक्ष GitHub Raw स्ट्रिम (barshapbp2026/any-pdf-)</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-400">लक्षित पृष्ठ: {toDeva(currentPage)}</span>
            <a
              href={rawUrl}
              download={pdfName}
              className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              <span>डाउनलोड</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
