import React, { useState, useEffect } from 'react';
import { 
  X, Sparkles, CheckCircle2, FileText, ArrowRight, RefreshCw, 
  Layers, ExternalLink, ShieldAlert, Cpu, Eye, Check
} from 'lucide-react';
import { DocumentSummary, LegalRow } from '../types';
import { HeaderAnalysisResult } from '../services/geminiHeaderService';

interface GeminiHeaderAnalyzerModalProps {
  isOpen: boolean;
  onClose: () => void;
  documents: DocumentSummary[];
  defaultDocPath?: string;
  defaultPage?: string;
  onOpenPdf: (path: string, page: string) => void;
  onFilterTableDoc?: (filename: string) => void;
}

export const GeminiHeaderAnalyzerModal: React.FC<GeminiHeaderAnalyzerModalProps> = ({
  isOpen,
  onClose,
  documents,
  defaultDocPath,
  defaultPage = '1',
  onOpenPdf,
  onFilterTableDoc,
}) => {
  // Filter Niyamawali, Adhyadesh, and Ain documents for quick access
  const niyamawaliDocs = documents.filter(d => d.folderName.includes('नियमावली') || d.folderId === '४.');
  const adhyadeshDocs = documents.filter(d => d.folderName.includes('अध्यादेश') || d.folderId === '३.');
  const ainDocs = documents.filter(d => d.folderName.includes('ऐन'));
  const allDocs = documents;

  const [selectedPath, setSelectedPath] = useState<string>(
    defaultDocPath || niyamawaliDocs[0]?.path || adhyadeshDocs[0]?.path || ainDocs[0]?.path || documents[0]?.path || ''
  );
  const [selectedPage, setSelectedPage] = useState<string>(defaultPage || '1');
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<HeaderAnalysisResult[]>([]);
  const [modelUsed, setModelUsed] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');

  useEffect(() => {
    if (defaultDocPath) setSelectedPath(defaultDocPath);
    if (defaultPage) setSelectedPage(defaultPage);
  }, [defaultDocPath, defaultPage, isOpen]);

  if (!isOpen) return null;

  const currentDoc = documents.find(d => d.path === selectedPath) || documents[0];

  const handleRunAnalysis = async () => {
    setLoading(true);
    setStatusMessage('Gemini 3.8 Flash मोडेल मार्फत कानुनी हेडर र स्टाइल विश्लेषण गरिँदैछ...');
    try {
      const res = await fetch('/api/gemini/analyze-headers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfPath: selectedPath,
          pageNumber: parseInt(selectedPage, 10) || 1,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResults(data.results || []);
        setModelUsed(data.modelUsed || 'gemini-3.8-flash');
        setStatusMessage(data.message || 'सफलतापूर्वक विश्लेषण सम्पन्न भयो।');
      } else {
        setStatusMessage(data.error || 'विश्लेषण असफल भयो।');
      }
    } catch (err: any) {
      setStatusMessage('सर्भरसँग सम्पर्क हुन सकेन: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-900/40 border border-indigo-400/30">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg">
                  Gemini AI कानूनी हेडर पहिचान तथा प्रमाणीकरण
                </h3>
                <span className="bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[11px] px-2 py-0.5 rounded-full font-mono">
                  gemini-3.8-flash
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                ३ कानूनी हेडिङ ढाँचाहरू: १. Bold + Underline, २. Underline मात्र, ३. Bold मात्र
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Control inputs */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
          <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                १. PDF कागजात छान्नुहोस् ({ainDocs.length} ऐनहरू प्राथमिकता):
              </label>
              <select
                value={selectedPath}
                onChange={e => {
                  setSelectedPath(e.target.value);
                  setResults([]);
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500 truncate"
              >
                <optgroup label="४. नियमावली फोल्डरका ४ कागजातहरू (हुबहु प्रमाणित)">
                  {niyamawaliDocs.map(d => (
                    <option key={d.path} value={d.path}>
                      {d.folderName} - {d.filename}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="३. अध्यादेश फोल्डरका ३ कागजातहरू (हुबहु प्रमाणित)">
                  {adhyadeshDocs.map(d => (
                    <option key={d.path} value={d.path}>
                      {d.folderName} - {d.filename}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="२. ऐन फोल्डरका ५ कागजातहरू">
                  {ainDocs.map(d => (
                    <option key={d.path} value={d.path}>
                      {d.filename}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="अन्य कानूनी कागजातहरू">
                  {allDocs.filter(d => !d.folderName.includes('ऐन') && !d.folderName.includes('अध्यादेश') && !d.folderName.includes('नियमावली')).map(d => (
                    <option key={d.path} value={d.path}>
                      {d.folderName} - {d.filename}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="w-full sm:w-32">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                २. पृष्ठ नम्बर:
              </label>
              <input
                type="number"
                min="1"
                value={selectedPage}
                onChange={e => setSelectedPage(e.target.value)}
                placeholder="पृष्ठ"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold text-slate-800 text-center focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="self-end sm:self-auto pt-2 sm:pt-4">
            <button
              onClick={handleRunAnalysis}
              disabled={loading}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>विश्लेषण हुँदैछ...</span>
                </>
              ) : (
                <>
                  <Cpu className="w-4 h-4 text-amber-300" />
                  <span>AI हेडर विश्लेषण गर्नुहोस्</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 3 Heading Categories Guide */}
        <div className="px-5 py-3 bg-indigo-50/60 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-indigo-950">कानूनी हेडिङका ३ ढाँचाहरू:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-100 text-purple-900 font-semibold border border-purple-200">
              <strong className="underline">१. Bold &amp; Underline</strong>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-100 text-blue-900 font-semibold border border-blue-200">
              <span className="underline">२. Underline Only</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 font-semibold border border-emerald-200">
              <strong>३. Bold Only</strong>
            </span>
          </div>
        </div>

        {/* Status bar */}
        {statusMessage && (
          <div className="px-5 py-2.5 bg-slate-100 border-b border-slate-200 text-xs text-slate-700 flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{statusMessage}</span>
            </span>
            {modelUsed && (
              <span className="text-[11px] text-slate-500 font-mono">
                मोडेल: {modelUsed}
              </span>
            )}
          </div>
        )}

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {results.length === 0 && !loading && (
            <div className="text-center py-12 text-slate-500">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">
                हेडर विश्लेषणका लागि माथिको बटन थिच्नुहोस्
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Gemini AI ले पृष्ठमा रहेका दफा, शीर्षक र अनुसूचीहरूलाई ३ वटा कानूनी ढाँचामा वर्गीकरण गरी क्रिस्टल क्लियर युनिकोडमा प्रस्तुत गर्नेछ।
              </p>
            </div>
          )}

          {results.map((item, idx) => {
            const isBoldUnderline = item.style === 'bold_and_underline';
            const isUnderlineOnly = item.style === 'underline_only';
            const isBoldOnly = item.style === 'bold_only';

            const badgeColor = isBoldUnderline 
              ? 'bg-purple-100 text-purple-900 border-purple-300'
              : isUnderlineOnly 
              ? 'bg-blue-100 text-blue-900 border-blue-300'
              : 'bg-emerald-100 text-emerald-900 border-emerald-300';

            return (
              <div
                key={idx}
                className="bg-white rounded-xl border border-slate-200 p-4 hover:border-indigo-300 transition-all shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white font-bold font-mono text-[11px]">
                      {item.section_id || item.anusuchi_id || `ID #${idx + 1}`}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md font-semibold text-[11px] border ${badgeColor}`}>
                      {item.styleLabel}
                    </span>
                    <span className="text-slate-500 font-mono text-[11px]">
                      PDF पृष्ठ: <strong className="text-indigo-600">{item.title_page || item.anusuchi_print_page}</strong>
                    </span>
                  </div>

                  {/* Visual typography preview as per user request */}
                  <div className="font-sans text-sm text-slate-900 pt-0.5">
                    {isBoldUnderline && (
                      <span className="font-bold underline decoration-purple-500 decoration-2">
                        {item.title_name || item.anusuchi_title}
                      </span>
                    )}
                    {isUnderlineOnly && (
                      <span className="underline decoration-blue-500 decoration-2">
                        {item.title_name || item.anusuchi_title}
                      </span>
                    )}
                    {isBoldOnly && (
                      <span className="font-bold text-emerald-950">
                        {item.title_name || item.anusuchi_title}
                      </span>
                    )}
                  </div>
                </div>

                {/* Jump & Verify actions */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <button
                    onClick={() => {
                      onOpenPdf(selectedPath, item.title_page || item.anusuchi_print_page || '1');
                      onClose();
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>PDF पृष्ठमा हेर्नुहोस्</span>
                  </button>
                  {onFilterTableDoc && currentDoc && (
                    <button
                      onClick={() => {
                        onFilterTableDoc(currentDoc.filename);
                        onClose();
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors cursor-pointer"
                    >
                      <span>मास्टर तालिका</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            कागजात: <code className="text-slate-800 font-semibold font-mono">{currentDoc?.filename}</code>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors cursor-pointer"
          >
            बन्द गर्नुहोस्
          </button>
        </div>
      </div>
    </div>
  );
};
