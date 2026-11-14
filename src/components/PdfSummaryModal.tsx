import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Sparkles,
  FileText,
  RefreshCw,
  Eye,
  Copy,
  Check,
  Download,
  BookOpen,
  Scale,
  ShieldCheck,
  AlertTriangle,
  MessageSquareText,
  Layers,
  ListChecks,
  ArrowRight,
  Columns,
  Database,
  LogIn,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  DocumentSummary,
  PdfSummaryLanguage,
  PdfSummaryMode,
  PdfSummaryResult,
  StoredPdfSummaryRecord,
} from '../types';
import { compareNumericPrefixes } from '../utils/urlUtils';
import {
  buildPdfSummaryDocId,
  getCachedPdfSummary,
  isAuthorizedMasterUser,
  savePdfSummaryToFirestore,
} from '../services/firestoreSummaryStore';
import { safeFetchJson } from '../utils/safeFetchJson';
import { FontSizeControls } from './FontSizeControls';

interface PdfSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  documents: DocumentSummary[];
  defaultDocPath?: string;
  defaultPage?: string;
  currentUser: User | null;
  isAdminOrOwner?: boolean;
  onSignIn: () => Promise<User | null>;
  onSummarySaved?: (record: StoredPdfSummaryRecord) => void;
  onOpenPdf: (path: string, page: string) => void;
  onOpenMdSync?: (filename: string, page?: string) => void;
}

const MODE_OPTIONS: { id: PdfSummaryMode; label: string; desc: string }[] = [
  {
    id: 'executive',
    label: 'कार्यकारी सारांश',
    desc: 'उद्देश्य, क्षेत्राधिकार र मुख्य सार',
  },
  {
    id: 'sections',
    label: 'मुख्य दफा र अनुसूची',
    desc: 'महत्त्वपूर्ण दफा/धारा र पृष्ठ सन्दर्भ',
  },
  {
    id: 'compliance',
    label: 'अधिकार, समयसीमा र दण्ड',
    desc: 'निकाय, हदम्याद, प्रक्रिया र सजाय',
  },
  {
    id: 'page_range',
    label: 'पृष्ठ दायरा विस्तृत',
    desc: 'छानिएका पृष्ठहरूको गहन सारांश',
  },
];

const LANGUAGE_OPTIONS: { id: PdfSummaryLanguage; label: string }[] = [
  { id: 'ne', label: 'नेपाली' },
  { id: 'bilingual', label: 'नेपाली + English' },
  { id: 'en', label: 'English' },
];

function toAsciiPageStr(val?: string): string {
  if (!val) return '';
  const map: Record<string, string> = {
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
    '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
  };
  return String(val).replace(/[०-९]/g, d => map[d] || d).replace(/[^0-9]/g, '');
}

function toDevaNum(val: number | string): string {
  const devDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  return String(val).replace(/[0-9]/g, d => devDigits[parseInt(d, 10)]);
}

export const PdfSummaryModal: React.FC<PdfSummaryModalProps> = ({
  isOpen,
  onClose,
  documents,
  defaultDocPath,
  defaultPage,
  currentUser,
  isAdminOrOwner = false,
  onSignIn,
  onSummarySaved,
  onOpenPdf,
  onOpenMdSync,
}) => {
  const groupedDocs = useMemo(() => {
    const sorted = [...documents].sort((a, b) => {
      const folderCmp = compareNumericPrefixes(a.folderName, b.folderName);
      if (folderCmp !== 0) return folderCmp;
      return compareNumericPrefixes(a.filename, b.filename);
    });
    const map = new Map<string, DocumentSummary[]>();
    sorted.forEach(doc => {
      if (!map.has(doc.folderName)) map.set(doc.folderName, []);
      map.get(doc.folderName)!.push(doc);
    });
    return Array.from(map.entries());
  }, [documents]);

  const [selectedPath, setSelectedPath] = useState<string>(
    defaultDocPath || documents[0]?.path || ''
  );
  const [mode, setMode] = useState<PdfSummaryMode>('executive');
  const [language, setLanguage] = useState<PdfSummaryLanguage>('ne');
  const [startPage, setStartPage] = useState<string>('');
  const [endPage, setEndPage] = useState<string>('');
  const [customQuestion, setCustomQuestion] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [checkingCache, setCheckingCache] = useState<boolean>(false);
  const [savingToStore, setSavingToStore] = useState<boolean>(false);
  const [savedToStore, setSavedToStore] = useState<boolean>(false);
  const [summarySource, setSummarySource] = useState<'firestore' | 'gemini' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [result, setResult] = useState<PdfSummaryResult | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    if (defaultDocPath) {
      setSelectedPath(defaultDocPath);
      setResult(null);
      setSummarySource(null);
      setErrorMsg('');
    }
    const cleanPage = toAsciiPageStr(defaultPage);
    if (cleanPage && parseInt(cleanPage, 10) > 1) {
      setStartPage(cleanPage);
      setEndPage(cleanPage);
    } else {
      setStartPage('');
      setEndPage('');
    }
  }, [isOpen, defaultDocPath, defaultPage]);

  const currentDoc = documents.find(d => d.path === selectedPath) || documents[0];
  const parsedStart = startPage ? parseInt(startPage, 10) : undefined;
  const parsedEnd = endPage ? parseInt(endPage, 10) : undefined;
  const currentDocId = useMemo(
    () => buildPdfSummaryDocId(selectedPath, mode, language, parsedStart, parsedEnd),
    [selectedPath, mode, language, parsedStart, parsedEnd]
  );

  // Automatic Firestore cache lookup when scope changes
  useEffect(() => {
    if (!isOpen || !selectedPath) return;
    let cancelled = false;
    const checkCache = async () => {
      setCheckingCache(true);
      try {
        const cached = await getCachedPdfSummary(currentDocId);
        if (cancelled) return;
        if (cached) {
          setResult(cached);
          setSummarySource('firestore');
          setSavedToStore(true);
          setErrorMsg('');
        } else {
          setSummarySource(prev => (prev === 'firestore' ? null : prev));
          setSavedToStore(false);
        }
      } catch {
        // Non-blocking: user can still generate fresh via Gemini
      } finally {
        if (!cancelled) setCheckingCache(false);
      }
    };
    void checkCache();
    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedPath, currentDocId]);

  if (!isOpen) return null;

  const persistToFirestore = async (summaryData: PdfSummaryResult) => {
    if (!isAuthorizedMasterUser(currentUser)) return;
    setSavingToStore(true);
    try {
      const saved = await savePdfSummaryToFirestore({
        docId: currentDocId,
        docInfo: currentDoc,
        pdfPath: selectedPath,
        mode,
        language,
        summary: summaryData,
      });
      setSavedToStore(true);
      onSummarySaved?.(saved);
    } catch (err: any) {
      setErrorMsg(
        `सारांश बन्यो तर मास्टर स्टोरमा सेभ गर्न सकिएन: ${err?.message || 'Permission error'}`
      );
    } finally {
      setSavingToStore(false);
    }
  };

  const handleGenerateSummary = async (forceRefresh = false) => {
    if (!selectedPath) return;
    setLoading(true);
    setErrorMsg('');
    setSavedToStore(false);

    const hasQuestion = Boolean(customQuestion.trim());
    try {
      // Cache-first unless forced refresh or custom question asked
      if (!forceRefresh && !hasQuestion) {
        try {
          const cached = await getCachedPdfSummary(currentDocId);
          if (cached) {
            setResult(cached);
            setSummarySource('firestore');
            setSavedToStore(true);
            setLoading(false);
            return;
          }
        } catch {
          // proceed to Gemini generation
        }
      }

      const { ok, data } = await safeFetchJson('/api/gemini/summarize-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfPath: selectedPath,
          mode,
          language,
          startPage: parsedStart,
          endPage: parsedEnd,
          customQuestion: customQuestion.trim() || undefined,
        }),
      });
      if (!ok || !data.success || !data.summary) {
        setErrorMsg(data.error || 'PDF सारांश तयार गर्न असफल भयो।');
        return;
      }

      setResult(data.summary);
      setSummarySource('gemini');

      // Auto-persist standard summaries when signed in as Owner/Admin
      if (!hasQuestion && isAuthorizedMasterUser(currentUser)) {
        await persistToFirestore(data.summary);
      }
    } catch (err: any) {
      setErrorMsg('सर्भरसँग सम्पर्क हुन सकेन: ' + (err?.message || 'Network error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSignInAndSave = async () => {
    if (!result) return;
    const signedUser = isAuthorizedMasterUser(currentUser) ? currentUser : await onSignIn();
    if (isAuthorizedMasterUser(signedUser)) {
      setSavingToStore(true);
      try {
        const saved = await savePdfSummaryToFirestore({
          docId: currentDocId,
          docInfo: currentDoc,
          pdfPath: selectedPath,
          mode,
          language,
          summary: result,
        });
        setSavedToStore(true);
        onSummarySaved?.(saved);
      } catch (err: any) {
        setErrorMsg(`सेभ गर्न असफल भयो: ${err?.message || 'Error'}`);
      } finally {
        setSavingToStore(false);
      }
    } else if (signedUser) {
      setErrorMsg('मास्टर स्टोरमा सेभ गर्ने अनुमति Owner वा Admin लाई मात्र छ।');
    }
  };

  const buildMarkdownReport = (summary: PdfSummaryResult): string => {
    const lines: string[] = [
      `# ${summary.documentTitle}`,
      '',
      `- **फाइल:** ${currentDoc?.filename || selectedPath}`,
      `- **दायरा:** ${summary.analyzedRange} (कुल ${toDevaNum(summary.totalPages)} पृष्ठ)`,
      `- **AI मोडल:** ${summary.modelUsed}`,
      '',
      '## कार्यकारी सारांश',
      summary.overview,
      '',
    ];
    if (summary.customAnswer) {
      lines.push('## विशेष प्रश्नको उत्तर', summary.customAnswer, '');
    }
    if (summary.keyPoints.length > 0) {
      lines.push('## मुख्य बुँदाहरू', ...summary.keyPoints.map(p => `- ${p}`), '');
    }
    if (summary.importantSections.length > 0) {
      lines.push('## महत्त्वपूर्ण दफा / धारा / प्रावधानहरू');
      summary.importantSections.forEach(s => {
        lines.push(`- **${s.reference}${s.title ? ` (${s.title})` : ''}** [पृष्ठ ${s.page}]: ${s.summary}`);
      });
      lines.push('');
    }
    if (summary.complianceAndDeadlines.length > 0) {
      lines.push(
        '## अधिकार, प्रक्रिया, समयसीमा र दण्ड',
        ...summary.complianceAndDeadlines.map(c => `- ${c}`),
        ''
      );
    }
    if (summary.schedulesOverview.length > 0) {
      lines.push('## अनुसूची विवरण', ...summary.schedulesOverview.map(s => `- ${s}`), '');
    }
    return lines.join('\n');
  };

  const handleCopySummary = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(buildMarkdownReport(result));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleDownloadSummary = () => {
    if (!result) return;
    const md = buildMarkdownReport(result);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = (currentDoc?.filename || 'pdf_summary').replace(/\.pdf$/i, '');
    a.download = `${baseName}_AI_Summary.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-5"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[93vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-950/40 border border-emerald-400/30 shrink-0">
              <Sparkles className="w-5 h-5 text-amber-200" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base sm:text-lg truncate">
                  Gemini AI कानूनी PDF सारांश (Firestore Cache-First)
                </h3>
                <span className="bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-[11px] px-2 py-0.5 rounded-md font-mono">
                  gemini-4-hydrogen
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 truncate">
                मास्टर स्टोरमा पहिले सेभ भएको सारांश तुरुन्तै लोड हुन्छ; नयाँ PDF आउँदा AI बाट बनाई स्वतः अपडेट गरिन्छ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <FontSizeControls variant="dark" />
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              title="बन्द गर्नुहोस्"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Configuration Controls */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 space-y-3.5 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-6">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                १. PDF कागजात छान्नुहोस् ({toDevaNum(documents.length)} कागजात):
              </label>
              <select
                value={selectedPath}
                onChange={e => {
                  setSelectedPath(e.target.value);
                  setResult(null);
                  setSummarySource(null);
                  setErrorMsg('');
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500 truncate"
              >
                {groupedDocs.map(([folderName, docs]) => (
                  <optgroup key={folderName} label={folderName}>
                    {docs.map(d => (
                      <option key={d.path} value={d.path}>
                        {d.filename} ({Math.round(d.size / 1024)} KB)
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-600">
                  २. पृष्ठ दायरा (वैकल्पिक):
                </label>
                {(startPage || endPage) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStartPage('');
                      setEndPage('');
                    }}
                    className="text-[10px] text-indigo-600 hover:underline font-semibold cursor-pointer"
                  >
                    पूरा PDF
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="1"
                  value={startPage}
                  onChange={e => setStartPage(e.target.value)}
                  placeholder="सुरु (१)"
                  className="w-full px-2 py-2 rounded-xl border border-slate-200 bg-white text-center font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                />
                <span className="text-slate-400 font-bold">–</span>
                <input
                  type="number"
                  min="1"
                  value={endPage}
                  onChange={e => setEndPage(e.target.value)}
                  placeholder="अन्त्य"
                  className="w-full px-2 py-2 rounded-xl border border-slate-200 bg-white text-center font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                ३. सारांश भाषा:
              </label>
              <div className="grid grid-cols-3 gap-1 bg-slate-200/70 p-1 rounded-xl">
                {LANGUAGE_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setLanguage(opt.id)}
                    className={`py-1.5 px-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer truncate ${
                      language === opt.id
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {MODE_OPTIONS.map(opt => {
              const active = mode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMode(opt.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    active
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <div className="font-bold text-xs">{opt.label}</div>
                  <div className={`text-[10px] mt-0.5 ${active ? 'text-indigo-100' : 'text-slate-500'}`}>
                    {opt.desc}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1">
              <MessageSquareText className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={customQuestion}
                onChange={e => setCustomQuestion(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !loading) void handleGenerateSummary(false);
                }}
                placeholder="ऐच्छिक प्रश्न सोध्नुहोस् (जस्तै: जग्गा दर्ता वा हदबन्दी सम्बन्धी मुख्य व्यवस्था र हदम्याद के छ?)"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="button"
              onClick={() => void handleGenerateSummary(false)}
              disabled={loading || !selectedPath}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50 shrink-0"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>AI सारांश तयार हुँदैछ...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-200" />
                  <span>{summarySource === 'firestore' && !customQuestion.trim() ? 'सारांश देखाउनुहोस्' : 'AI सारांश तयार गर्नुहोस्'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 font-['Mukta','Noto_Sans_Devanagari',sans-serif]">
          {errorMsg && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 flex items-start gap-3 text-rose-900 text-xs sm:text-sm">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold">सारांश तयार गर्न सकिएन</div>
                <p className="leading-relaxed">{errorMsg}</p>
              </div>
            </div>
          )}

          {!result && !errorMsg && (
            <div className="text-center py-12 px-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mx-auto mb-3">
                {loading || checkingCache ? (
                  <RefreshCw className="w-7 h-7 animate-spin" />
                ) : (
                  <BookOpen className="w-7 h-7" />
                )}
              </div>
              <h4 className="font-bold text-slate-900 text-base">
                {checkingCache
                  ? 'Firestore मास्टर स्टोरमा सुरक्षित सारांश खोजिँदैछ...'
                  : loading
                  ? 'Gemini 4 Hydrogen ले मूल PDF अध्ययन गर्दैछ...'
                  : 'कागजातको AI सारांश प्राप्त गर्न माथिको बटन थिच्नुहोस्'}
              </h4>
              <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-xl mx-auto leading-relaxed">
                {loading
                  ? 'PDF का पृष्ठहरू, दफा/धारा शीर्षक र अनुसूचीहरू विश्लेषण गरी संरचित नेपाली सारांश तयार गरिँदैछ।'
                  : 'मास्टर स्टोरमा पहिले नै सारांश उपलब्ध भएमा ०.१ सेकेन्डमै देखिनेछ; नयाँ PDF वा मोडको हकमा AI बाट बनाई तुरुन्तै अपडेट गरिनेछ।'}
              </p>
            </div>
          )}

          {result && (
            <div className="space-y-5">
              {/* Summary Header & Cache Status */}
              <div className="bg-gradient-to-r from-indigo-50 via-white to-emerald-50 rounded-2xl border border-indigo-200/80 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap text-[11px]">
                    {summarySource === 'firestore' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600 text-white font-bold">
                        <Database className="w-3 h-3" />
                        <span>मास्टर स्टोरबाट लोड गरिएको (Cache Hit)</span>
                      </span>
                    ) : savedToStore ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-600 text-white font-bold">
                        <Database className="w-3 h-3" />
                        <span>Firestore मास्टर स्टोरमा सेभ भयो</span>
                      </span>
                    ) : savingToStore ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>मास्टर स्टोरमा सेभ हुँदैछ...</span>
                      </span>
                    ) : null}
                    <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold">
                      {result.analyzedRange}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-mono">
                      कुल {toDevaNum(result.totalPages)} पृष्ठ
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono">
                      {result.modelUsed}
                    </span>
                  </div>
                  <h4 className="text-base sm:text-lg font-extrabold text-slate-900">
                    {result.documentTitle}
                  </h4>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {!savedToStore && !customQuestion.trim() && !currentUser && (
                    <button
                      type="button"
                      onClick={() => void handleSignInAndSave()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Sign-In गरी स्टोरमा सेभ गर्नुहोस्</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleGenerateSummary(true)}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
                    title="Gemini बाट पुनः ताजा सारांश बनाउनुहोस्"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    <span>ताजा पार्नुहोस्</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopySummary}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'कपी भयो' : 'कपी MD'}</span>
                  </button>
                  {(isAdminOrOwner || isAuthorizedMasterUser(currentUser)) && (
                    <button
                      type="button"
                      onClick={handleDownloadSummary}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>सारांश .md</span>
                    </button>
                  )}
                </div>
              </div>

              {result.customAnswer && (
                <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-4 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                    <MessageSquareText className="w-4 h-4 text-amber-700" />
                    <span>तपाईंको प्रश्नको प्रत्यक्ष उत्तर</span>
                  </div>
                  <p className="text-sm text-slate-900 leading-relaxed whitespace-pre-line">
                    {result.customAnswer}
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-2 shadow-2xs">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 uppercase tracking-wider">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  <span>मुख्य सारांश (Overview)</span>
                </div>
                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                  {result.overview}
                </p>
              </div>

              {result.keyPoints.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-2.5 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 uppercase tracking-wider">
                    <ListChecks className="w-4 h-4 text-emerald-600" />
                    <span>प्रमुख निष्कर्ष र बुँदाहरू</span>
                  </div>
                  <ul className="space-y-2">
                    {result.keyPoints.map((pt, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-slate-800 leading-relaxed">
                        <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5 font-mono">
                          {toDevaNum(i + 1)}
                        </span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.importantSections.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
                    <Scale className="w-4 h-4 text-indigo-600" />
                    <span>महत्त्वपूर्ण दफा, धारा र प्रावधानहरू</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {result.importantSections.map((sec, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 flex flex-col justify-between gap-2 hover:border-indigo-300 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-bold text-[11px] font-mono">
                              {sec.reference || `प्रावधान #${toDevaNum(idx + 1)}`}
                            </span>
                            {sec.page && (
                              <button
                                type="button"
                                onClick={() => {
                                  onOpenPdf(selectedPath, sec.page);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-bold text-[11px] cursor-pointer transition-colors"
                                title="PDF मा यो पृष्ठ हेर्नुहोस्"
                              >
                                <Eye className="w-3 h-3" />
                                <span>पृष्ठ {sec.page}</span>
                              </button>
                            )}
                          </div>
                          {sec.title && (
                            <div className="font-bold text-sm text-slate-900">
                              {sec.title}
                            </div>
                          )}
                          <p className="text-xs text-slate-700 leading-relaxed">
                            {sec.summary}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(result.complianceAndDeadlines.length > 0 || result.schedulesOverview.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.complianceAndDeadlines.length > 0 && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-blue-950">
                        <ShieldCheck className="w-4 h-4 text-blue-700" />
                        <span>अधिकार, प्रक्रिया, समयसीमा र दण्ड</span>
                      </div>
                      <ul className="space-y-1.5 text-xs sm:text-sm text-slate-800">
                        {result.complianceAndDeadlines.map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <ArrowRight className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-1" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.schedulesOverview.length > 0 && (
                    <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-purple-950">
                        <Layers className="w-4 h-4 text-purple-700" />
                        <span>अनुसूची तथा ढाँचा विवरण</span>
                      </div>
                      <ul className="space-y-1.5 text-xs sm:text-sm text-slate-800">
                        {result.schedulesOverview.map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <ArrowRight className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-1" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-2 truncate">
            <FileText className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <code className="text-slate-800 font-semibold font-mono truncate">
              {currentDoc?.filename}
            </code>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {currentDoc && (
              <button
                type="button"
                onClick={() => onOpenPdf(selectedPath, startPage || '1')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>PDF हेर्नुहोस्</span>
              </button>
            )}
            {onOpenMdSync && currentDoc && (
              <button
                type="button"
                onClick={() => {
                  onOpenMdSync(currentDoc.filename, startPage || '1');
                  onClose();
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-semibold cursor-pointer"
              >
                <Columns className="w-3.5 h-3.5" />
                <span>MD + PDF सिंक</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium cursor-pointer"
            >
              बन्द गर्नुहोस्
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
