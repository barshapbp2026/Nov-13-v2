import React, { useEffect, useState } from 'react';
import {
  X, Copy, Check, ExternalLink, ShieldCheck, ChevronLeft, ChevronRight,
  FileText, Folder, BookOpen, Sparkles, Database, RefreshCw, ArrowRight, LogIn
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { LegalRow, DafaSummaryItem, StoredDafaSummaryRecord } from '../types';
import {
  toGitHubRawUrl,
  formatAnusuchiIdOnly,
  formatAnusuchiTitleClean,
  getDisplaySectionId,
  getDisplaySectionTitle,
  getDisplaySectionPage,
} from '../utils/urlUtils';
import { toPhysicalPdfPage } from '../utils/pdfPageMap';
import { devaToNum, toDeva } from '../utils/markdownUtils';
import {
  buildDafaSummaryDocId,
  getCachedDafaSummary,
  isAuthorizedMasterUser,
  saveDafaSummariesBatchToFirestore,
} from '../services/firestoreSummaryStore';
import { safeFetchJson } from '../utils/safeFetchJson';
import { FontSizeControls } from './FontSizeControls';

interface TenColumnModalProps {
  row: LegalRow | null;
  isOpen: boolean;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  onOpenPdfViewer?: (path: string, page: string, highlightText?: string) => void;
  cachedDafaMap?: Map<string, StoredDafaSummaryRecord>;
  currentUser?: User | null;
  isAdminOrOwner?: boolean;
  onSignIn?: () => Promise<User | null>;
  onDafaSaved?: (records: StoredDafaSummaryRecord[]) => void;
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
  cachedDafaMap,
  currentUser,
  isAdminOrOwner = false,
  onSignIn,
  onDafaSaved,
}) => {
  const [copied, setCopied] = useState(false);
  const [dafaSummary, setDafaSummary] = useState<DafaSummaryItem | null>(null);
  const [dafaLoading, setDafaLoading] = useState(false);
  const [dafaGenerating, setDafaGenerating] = useState(false);
  const [dafaError, setDafaError] = useState('');
  const [dafaSaved, setDafaSaved] = useState(false);

  const dafaDocId = row ? buildDafaSummaryDocId(row) : '';

  useEffect(() => {
    if (!isOpen || !row || !dafaDocId) return;
    setDafaError('');
    const fromMem = cachedDafaMap?.get(dafaDocId);
    if (fromMem) {
      setDafaSummary(fromMem);
      setDafaSaved(true);
      return;
    }

    let cancelled = false;
    setDafaSummary(null);
    setDafaSaved(false);
    setDafaLoading(true);
    getCachedDafaSummary(dafaDocId)
      .then(cached => {
        if (cancelled) return;
        if (cached) {
          setDafaSummary(cached);
          setDafaSaved(true);
        }
      })
      .catch(() => {
        // ignore read error; user can generate fresh
      })
      .finally(() => {
        if (!cancelled) setDafaLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, row, dafaDocId, cachedDafaMap]);

  if (!isOpen || !row) return null;

  const handleGenerateDafaSummary = async () => {
    setDafaGenerating(true);
    setDafaError('');
    try {
      const { ok, data } = await safeFetchJson('/api/gemini/summarize-dafas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfPath: row.pdf_path,
          items: [{ docId: dafaDocId, row }],
        }),
      });
      if (!ok || !data.success || !Array.isArray(data.results) || data.results.length === 0) {
        setDafaError(data.error || 'दफा सारांश तयार गर्न असफल भयो।');
        return;
      }
      const generated: DafaSummaryItem = data.results[0];
      setDafaSummary(generated);
      if (isAuthorizedMasterUser(currentUser)) {
        const saved = await saveDafaSummariesBatchToFirestore([generated]);
        setDafaSaved(true);
        onDafaSaved?.(saved);
      } else {
        setDafaSaved(false);
      }
    } catch (err: any) {
      setDafaError(err?.message || 'सर्भरसँग सम्पर्क हुन सकेन।');
    } finally {
      setDafaGenerating(false);
    }
  };

  const displaySectionId = getDisplaySectionId(row);
  const displayTitleName = getDisplaySectionTitle(row);
  const displayTitlePage = getDisplaySectionPage(row);
  const displayAnusuchiId = formatAnusuchiIdOnly(row.anusuchi_id);
  const displayAnusuchiTitle = formatAnusuchiTitleClean(row.anusuchi_title);

  const handleCopy = () => {
    const text = [
      `१. Folder ID: ${row.folder_id}`,
      `२. Subfolder ID: ${row.subfolder_id || '(खाली)'}`,
      `३. Folder Name: ${row.folder_name}`,
      `४. Subfolder Name: ${row.subfolder_name || '(खाली)'}`,
      `५. PDF Name: ${row.pdf_name}`,
      `६. धारा/दफा/नियम/निर्देशन/बुँदा ID: ${displaySectionId || '(खाली)'}`,
      `७. Title Name: ${displayTitleName || '(खाली)'}`,
      `८. Title Page: ${displayTitlePage || '(खाली)'}`,
      `९. अनुसूची ID: ${displayAnusuchiId || '(खाली)'}`,
      `१०. अनुसूची Title: ${displayAnusuchiTitle || '(खाली)'}`,
      `११. अनुसूची Print Page: ${row.anusuchi_print_page || '(खाली)'}`,
      ...(isAdminOrOwner ? [`PDF Path: ${row.pdf_path}`] : []),
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const rawPdfUrl = isAdminOrOwner ? toGitHubRawUrl(row.pdf_path) : '';

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
          <div className="flex items-center gap-2 shrink-0">
            <FontSizeControls variant="dark" />
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
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
                    onClick={() => onOpenPdfViewer(row.pdf_path, row.title_page || row.anusuchi_print_page || '1', row.title_name || row.anusuchi_title)}
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
                {displaySectionId || <span className="text-slate-400 italic font-normal">खाली (अनुसूची रेकर्ड)</span>}
              </div>
            </div>

            {/* Column 8: Title Page (Shifted to 8) */}
            <div className="bg-amber-50/50 rounded-xl p-3.5 border border-amber-200/70 hover:border-amber-300 transition-colors">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800 mb-1 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded bg-amber-200 text-amber-900 flex items-center justify-center text-[10px] font-bold">८</span>
                Title Page
              </div>
              <div className="font-bold text-amber-900 text-base bg-white px-2.5 py-1.5 rounded-lg border border-amber-200 flex items-center justify-between gap-2">
                <span>
                  {displayTitlePage ? (() => {
                    const rawN = devaToNum(displayTitlePage);
                    const physN = toPhysicalPdfPage(row.pdf_path, rawN);
                    return physN !== rawN
                      ? `पृष्ठ नं. ${displayTitlePage} (PDF ${toDeva(physN)})`
                      : `पृष्ठ नं. ${displayTitlePage}`;
                  })() : <span className="text-slate-400 italic font-normal">खाली</span>}
                </span>
                {displayTitlePage && onOpenPdfViewer && (
                  <button
                    onClick={() => onOpenPdfViewer(row.pdf_path, displayTitlePage, displayTitleName)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 font-medium cursor-pointer shrink-0"
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
                
                {/* Sub-columns & type indicator */}
                <div className="flex flex-wrap items-center gap-1 text-[10px] font-semibold">
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
                  {row.type === 'संशोधन' && (
                    <span className="px-2 py-0.5 rounded border bg-cyan-100 text-cyan-900 border-cyan-300 font-bold shadow-xs">
                      संशोधन ✓
                    </span>
                  )}
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
                {displayTitleName || <span className="text-slate-400 italic font-normal">खाली (अनुसूची मात्र)</span>}
              </div>
            </div>

            {/* Column 9: अनुसूची ID (Shifted to 9) */}
            <div className="bg-indigo-50/50 rounded-xl p-3.5 border border-indigo-200/70">
              <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-800 mb-1 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded bg-indigo-200 text-indigo-900 flex items-center justify-center text-[10px] font-bold">९</span>
                अनुसूची ID
              </div>
              <div className="font-bold text-indigo-950 text-sm bg-white px-2.5 py-1.5 rounded-lg border border-indigo-200">
                {displayAnusuchiId ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-semibold">
                    {displayAnusuchiId}
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
              <div className="font-bold text-indigo-900 text-sm bg-white px-2.5 py-1.5 rounded-lg border border-indigo-200 flex items-center justify-between gap-2">
                <span>
                  {row.anusuchi_print_page ? (() => {
                    const rawN = devaToNum(row.anusuchi_print_page);
                    const physN = toPhysicalPdfPage(row.pdf_path, rawN);
                    return physN !== rawN
                      ? `पृष्ठ नं. ${row.anusuchi_print_page} (PDF ${toDeva(physN)})`
                      : `पृष्ठ नं. ${row.anusuchi_print_page}`;
                  })() : <span className="text-slate-400 italic font-normal">खाली</span>}
                </span>
                {row.anusuchi_print_page && onOpenPdfViewer && (
                  <button
                    onClick={() => onOpenPdfViewer(row.pdf_path, row.anusuchi_print_page, row.anusuchi_title || row.anusuchi_id)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 font-medium cursor-pointer shrink-0"
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
                {displayAnusuchiTitle || <span className="text-slate-400 italic font-normal">खाली</span>}
              </div>
            </div>
          </div>

          {/* AI दफा सारांश (Firestore मास्टर स्टोर + Gemini) */}
          <div className="mt-4 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/80 via-white to-emerald-50/50 p-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>AI दफा सारांश</span>
                    {dafaSummary && (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                          dafaSaved
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}
                      >
                        <Database className="w-3 h-3" />
                        {dafaSaved ? 'मास्टर स्टोरमा सुरक्षित' : 'अस्थायी सारांश (सेभ बाँकी)'}
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    पहिले Firestore मास्टर स्टोरबाट खोजिन्छ; नयाँ दफा भए Gemini बाट तयार भई स्टोर अद्यावधिक हुन्छ।
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {dafaSummary && !dafaSaved && onSignIn && (
                  <button
                    onClick={async () => {
                      const signed = isAuthorizedMasterUser(currentUser) ? currentUser : await onSignIn();
                      if (isAuthorizedMasterUser(signed)) {
                        try {
                          const saved = await saveDafaSummariesBatchToFirestore([dafaSummary]);
                          setDafaSaved(true);
                          onDafaSaved?.(saved);
                        } catch (err: any) {
                          setDafaError(err?.message || 'Firestore मा सेभ गर्न असफल भयो।');
                        }
                      } else if (signed) {
                        setDafaError('मास्टर स्टोरमा सेभ गर्ने अनुमति Owner वा Admin लाई मात्र छ।');
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Sign-In गरी सेभ गर्नुहोस्</span>
                  </button>
                )}

                <button
                  onClick={handleGenerateDafaSummary}
                  disabled={dafaGenerating || dafaLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${dafaGenerating ? 'animate-spin' : ''}`} />
                  <span>
                    {dafaGenerating
                      ? 'सारांश तयार हुँदै...'
                      : dafaSummary
                        ? 'ताजा पार्नुहोस्'
                        : 'यो दफाको सारांश बनाउनुहोस्'}
                  </span>
                </button>
              </div>
            </div>

            {dafaLoading && (
              <div className="text-xs text-slate-600 bg-white/80 rounded-lg border border-slate-200 px-3 py-2.5 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                <span>मास्टर स्टोरबाट दफा सारांश खोजिँदैछ...</span>
              </div>
            )}

            {dafaError && (
              <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {dafaError}
              </div>
            )}

            {!dafaLoading && dafaSummary && (
              <div className="bg-white rounded-lg border border-indigo-100 p-3.5 space-y-2.5">
                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                  {dafaSummary.summaryNepali}
                </p>

                {dafaSummary.keyObligations && dafaSummary.keyObligations.length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <div className="text-[11px] font-bold text-indigo-900 mb-1.5">
                      मुख्य कानुनी बुँदा र दायित्वहरू:
                    </div>
                    <ul className="space-y-1">
                      {dafaSummary.keyObligations.map((item, idx) => (
                        <li key={idx} className="text-xs text-slate-700 flex items-start gap-1.5">
                          <ArrowRight className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {!dafaLoading && !dafaSummary && !dafaError && (
              <div className="text-xs text-slate-500 bg-white/70 rounded-lg border border-dashed border-slate-300 px-3 py-2.5">
                यस दफा/अनुसूचीको सारांश मास्टर स्टोरमा अझै सुरक्षित छैन। माथिको बटन क्लिक गरी तुरुन्त सारांश तयार गर्नुहोस्।
              </div>
            )}
          </div>

          {/* PDF Source Metadata Banner */}
          <div className="mt-4 p-3.5 rounded-xl bg-slate-900 text-slate-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-slate-800">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="font-mono truncate">
                {isAdminOrOwner ? (
                  <>
                    <span className="text-slate-400">PDF Path: </span>
                    <span className="text-emerald-300 font-semibold">{row.pdf_path}</span>
                  </>
                ) : (
                  <>
                    <span className="text-slate-400 font-sans">कागजात: </span>
                    <span className="text-emerald-300 font-semibold font-sans">{row.pdf_name}</span>
                  </>
                )}
              </div>
            </div>
            {isAdminOrOwner && (
              <a
                href={rawPdfUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 border border-slate-700 transition-colors text-xs font-medium cursor-pointer self-start sm:self-auto shrink-0"
              >
                <span>GitHub बाट मूल PDF डाउनलोड</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
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
