import React from 'react';
import { X, Copy, Check, ExternalLink, ShieldCheck, ChevronLeft, ChevronRight, FileText, Folder, BookOpen } from 'lucide-react';
import { LegalRow } from '../types';
import { toGitHubRawUrl } from '../utils/urlUtils';

interface TenColumnModalProps {
  row: LegalRow | null;
  isOpen: boolean;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  onOpenPdfViewer?: (path: string, page: string) => void;
}

export const TenColumnModal: React.FC<TenColumnModalProps> = ({
  row,
  isOpen,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  onOpenPdfViewer,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen || !row) return null;

  const handleCopy = () => {
    const text = [
      `१. Folder ID: ${row.folder_id}`,
      `२. Subfolder ID: ${row.subfolder_id || '(खाली)'}`,
      `३. Folder Name: ${row.folder_name}`,
      `४. Subfolder Name: ${row.subfolder_name || '(खाली)'}`,
      `५. PDF Name: ${row.pdf_name}`,
      `६. धारा/दफा/नियम/निर्देशन/बुँदा ID: ${row.section_id || '(खाली)'}`,
      `७. Title Name: ${row.title_name || '(खाली)'}`,
      `८. Title Page: ${row.title_page || '(खाली)'}`,
      `९. अनुसूची ID: ${row.anusuchi_id || '(खाली)'}`,
      `१०. अनुसूची Title: ${row.anusuchi_title || '(खाली)'}`,
      `११. अनुसूची Print Page: ${row.anusuchi_print_page || '(खाली)'}`,
      `PDF Path: ${row.pdf_path}`
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const rawPdfUrl = toGitHubRawUrl(row.pdf_path);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div 
        className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full overflow-hidden transition-all animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-4 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-white">
                  मास्टर मोडल विवरण (Master Modal Data)
                </h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <ShieldCheck className="w-3 h-3 mr-1" /> प्रमाणित
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-md">
                {row.pdf_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Master Table Columns */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Column 1: Folder ID */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 hover:border-slate-300 transition-colors">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">१</span>
                Folder ID
              </div>
              <div className="font-semibold text-slate-900 text-sm font-mono bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                {row.folder_id || <span className="text-slate-400 italic">खाली</span>}
              </div>
            </div>

            {/* Column 2: Subfolder ID */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 hover:border-slate-300 transition-colors">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">२</span>
                Subfolder ID
              </div>
              <div className="font-semibold text-slate-900 text-sm font-mono bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                {row.subfolder_id ? (
                  row.subfolder_id
                ) : (
                  <span className="text-slate-400 italic font-normal">खाली (वास्तविक Folder मा Subfolder छैन)</span>
                )}
              </div>
            </div>

            {/* Column 3: Folder Name */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 hover:border-slate-300 transition-colors">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">३</span>
                Folder Name
              </div>
              <div className="font-semibold text-slate-900 text-sm bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1.5">
                <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                <span>{row.folder_name}</span>
              </div>
            </div>

            {/* Column 4: Subfolder Name */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 hover:border-slate-300 transition-colors">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">४</span>
                Subfolder Name
              </div>
              <div className="font-semibold text-slate-900 text-sm bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                {row.subfolder_name ? (
                  <span className="flex items-center gap-1.5">
                    <Folder className="w-4 h-4 text-blue-500 shrink-0" />
                    {row.subfolder_name}
                  </span>
                ) : (
                  <span className="text-slate-400 italic font-normal">खाली (Subfolder छैन)</span>
                )}
              </div>
            </div>

            {/* Column 5: PDF Name (User requested: "4. Paxi 5. pdf name rakhnus") */}
            <div className="md:col-span-2 bg-rose-50/50 rounded-xl p-3.5 border border-rose-200 hover:border-rose-300 transition-colors">
              <div className="text-[11px] font-bold uppercase tracking-wider text-rose-800 mb-1 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded bg-rose-200 text-rose-900 flex items-center justify-center text-[10px] font-bold">५</span>
                  ५. PDF Name (फाइलको नाम)
                </div>
                {onOpenPdfViewer && (
                  <button
                    onClick={() => onOpenPdfViewer(row.pdf_path, row.title_page || row.anusuchi_print_page || '1')}
                    className="text-xs text-rose-700 hover:text-rose-900 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <span>मूल PDF खोल्नुहोस्</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="font-bold text-slate-900 text-sm bg-white px-3 py-2 rounded-lg border border-rose-200 flex items-center gap-2">
                <FileText className="w-4 h-4 text-red-600 shrink-0" />
                <span className="truncate">{row.pdf_name}</span>
              </div>
            </div>

            {/* Column 6: धारा/दफा/नियम/निर्देशन/बुँदा ID (Shifted to 6) */}
            <div className="bg-amber-50/50 rounded-xl p-3.5 border border-amber-200/70 hover:border-amber-300 transition-colors">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800 mb-1 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded bg-amber-200 text-amber-900 flex items-center justify-center text-[10px] font-bold">६</span>
                धारा/दफा/नियम/निर्देशन/बुँदा ID
              </div>
              <div className="font-bold text-amber-950 text-base bg-white px-2.5 py-1.5 rounded-lg border border-amber-200">
                {row.section_id || <span className="text-slate-400 italic font-normal">खाली (अनुसूची रेकर्ड)</span>}
              </div>
            </div>

            {/* Column 8: Title Page (Shifted to 8) */}
            <div className="bg-amber-50/50 rounded-xl p-3.5 border border-amber-200/70 hover:border-amber-300 transition-colors">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800 mb-1 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded bg-amber-200 text-amber-900 flex items-center justify-center text-[10px] font-bold">८</span>
                Title Page
              </div>
              <div className="font-bold text-amber-900 text-base bg-white px-2.5 py-1.5 rounded-lg border border-amber-200 flex items-center justify-between">
                <span>{row.title_page ? `पृष्ठ नं. ${row.title_page}` : <span className="text-slate-400 italic font-normal">खाली</span>}</span>
                {row.title_page && onOpenPdfViewer && (
                  <button
                    onClick={() => onOpenPdfViewer(row.pdf_path, row.title_page)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <span>PDF मा हेर्नुहोस्</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Column 7: धारा/दफा/नियम/निर्देशन/बुँदा Title Name (Shifted to 7, Span 2) */}
            <div className="md:col-span-2 bg-slate-50 rounded-xl p-3.5 border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">७</span>
                  धारा/दफा/नियम/निर्देशन/बुँदा Title Name
                </div>
                
                {/* 5 Sub-columns indicator */}
                <div className="flex items-center gap-1 text-[10px] font-semibold">
                  <span className={`px-2 py-0.5 rounded border transition-colors ${
                    row.type === 'धारा' ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold shadow-xs' : 'bg-slate-100 text-slate-400 border-slate-200'
                  }`}>
                    धारा {row.type === 'धारा' && '✓'}
                  </span>
                  <span className={`px-2 py-0.5 rounded border transition-colors ${
                    row.type === 'दफा' ? 'bg-blue-100 text-blue-900 border-blue-300 font-bold shadow-xs' : 'bg-slate-100 text-slate-400 border-slate-200'
                  }`}>
                    दफा {row.type === 'दफा' && '✓'}
                  </span>
                  <span className={`px-2 py-0.5 rounded border transition-colors ${
                    row.type === 'नियम' ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold shadow-xs' : 'bg-slate-100 text-slate-400 border-slate-200'
                  }`}>
                    नियम {row.type === 'नियम' && '✓'}
                  </span>
                  <span className={`px-2 py-0.5 rounded border transition-colors ${
                    row.type === 'निर्देशन' ? 'bg-purple-100 text-purple-900 border-purple-300 font-bold shadow-xs' : 'bg-slate-100 text-slate-400 border-slate-200'
                  }`}>
                    निर्देशन {row.type === 'निर्देशन' && '✓'}
                  </span>
                  <span className={`px-2 py-0.5 rounded border transition-colors ${
                    (row.type === 'बुँदा' || row.type === 'महल') ? 'bg-rose-100 text-rose-900 border-rose-300 font-bold shadow-xs' : 'bg-slate-100 text-slate-400 border-slate-200'
                  }`}>
                    बुँदा {(row.type === 'बुँदा' || row.type === 'महल') && '✓'}
                  </span>
                </div>
              </div>
              <div className="font-semibold text-slate-900 text-sm sm:text-base bg-white px-3 py-2.5 rounded-lg border border-slate-200 leading-relaxed shadow-2xs">
                {row.title_name || <span className="text-slate-400 italic font-normal">खाली (अनुसूची मात्र)</span>}
              </div>
            </div>

            {/* Column 9: अनुसूची ID (Shifted to 9) */}
            <div className="bg-indigo-50/50 rounded-xl p-3.5 border border-indigo-200/70">
              <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-800 mb-1 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded bg-indigo-200 text-indigo-900 flex items-center justify-center text-[10px] font-bold">९</span>
                अनुसूची ID
              </div>
              <div className="font-bold text-indigo-950 text-sm bg-white px-2.5 py-1.5 rounded-lg border border-indigo-200">
                {row.anusuchi_id ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-semibold">
                    {row.anusuchi_id}
                  </span>
                ) : (
                  <span className="text-slate-400 italic font-normal">खाली</span>
                )}
              </div>
            </div>

            {/* Column 11: अनुसूची Print Page (Shifted to 11) */}
            <div className="bg-indigo-50/50 rounded-xl p-3.5 border border-indigo-200/70">
              <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-800 mb-1 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded bg-indigo-200 text-indigo-900 flex items-center justify-center text-[10px] font-bold">११</span>
                अनुसूची Print Page
              </div>
              <div className="font-bold text-indigo-900 text-sm bg-white px-2.5 py-1.5 rounded-lg border border-indigo-200 flex items-center justify-between">
                <span>{row.anusuchi_print_page ? `पृष्ठ नं. ${row.anusuchi_print_page}` : <span className="text-slate-400 italic font-normal">खाली</span>}</span>
                {row.anusuchi_print_page && onOpenPdfViewer && (
                  <button
                    onClick={() => onOpenPdfViewer(row.pdf_path, row.anusuchi_print_page)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <span>अनुसूची पृष्ठ हेर्नुहोस्</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Column 10: अनुसूची Title (Shifted to 10, Span 2) */}
            <div className="md:col-span-2 bg-indigo-50/40 rounded-xl p-3.5 border border-indigo-200/60">
              <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-800 mb-1 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded bg-indigo-200 text-indigo-900 flex items-center justify-center text-[10px] font-bold">१०</span>
                अनुसूची Title
              </div>
              <div className="font-medium text-slate-800 text-sm bg-white px-3 py-2 rounded-lg border border-indigo-100 leading-relaxed">
                {row.anusuchi_title || <span className="text-slate-400 italic font-normal">खाली</span>}
              </div>
            </div>
          </div>

          {/* PDF Source Metadata Banner */}
          <div className="mt-4 p-3.5 rounded-xl bg-slate-900 text-slate-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-slate-800">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="font-mono truncate">
                <span className="text-slate-400">PDF Path: </span>
                <span className="text-emerald-300 font-semibold">{row.pdf_path}</span>
              </div>
            </div>
            <a
              href={rawPdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 border border-slate-700 transition-colors text-xs font-medium cursor-pointer self-start sm:self-auto shrink-0"
            >
              <span>GitHub बाट मूल PDF डाउनलोड</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Modal Footer with Controls */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onPrev}
              disabled={!hasPrev}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>अघिल्लो (Prev)</span>
            </button>
            <button
              onClick={onNext}
              disabled={!hasNext}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <span>पछिल्लो (Next)</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">कपि भयो!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>१० स्तम्भ डेटा कपि</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              बन्द गर्नुहोस्
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
