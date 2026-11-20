import React, { useState, useMemo } from 'react';
import { FolderTree, FileText, Search, ExternalLink, Sparkles, CheckCircle2 } from 'lucide-react';
import { DocumentSummary } from '../types';
import { toGitHubRawUrl } from '../utils/urlUtils';
import { FontSizeControls } from './FontSizeControls';
import { devaToNum } from '../utils/markdownUtils';
import {
  toDevaDigits,
  type DocSummaryCoverage,
  type FolderSummaryCoverage,
} from '../utils/summaryCoverage';

interface DirectoryViewProps {
  documents: DocumentSummary[];
  isAdminOrOwner?: boolean;
  docStatusByPath?: Map<string, DocSummaryCoverage>;
  folderStatusByName?: Map<string, FolderSummaryCoverage>;
  totalCompleteDocs?: number;
  totalCompleteFolders?: number;
  onSelectDoc: (filename: string) => void;
  onOpenPdf: (path: string, page: string) => void;
  onOpenMdSync?: (filename: string, page?: string) => void;
  onSummarizePdf?: (path: string, page?: string) => void;
}

export const DirectoryView: React.FC<DirectoryViewProps> = ({
  documents,
  isAdminOrOwner = false,
  docStatusByPath,
  folderStatusByName,
  totalCompleteDocs = 0,
  totalCompleteFolders = 0,
  onSelectDoc,
  onOpenPdf,
  onOpenMdSync,
  onSummarizePdf,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('all');

  const folders = useMemo(() => {
    const list = Array.from(new Set(documents.map(d => d.folderName)));
    list.sort((a, b) => devaToNum(a) - devaToNum(b));
    return list;
  }, [documents]);

  const filteredDocs = useMemo(() => {
    return documents.filter(doc => {
      if (selectedFolder !== 'all' && doc.folderName !== selectedFolder) return false;
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase().trim();
      return (
        doc.filename.toLowerCase().includes(q) ||
        doc.folderName.toLowerCase().includes(q) ||
        doc.subfolderName.toLowerCase().includes(q) ||
        doc.path.toLowerCase().includes(q)
      );
    });
  }, [documents, selectedFolder, searchTerm]);

  // Group by folder
  const groupedByFolder = useMemo(() => {
    const map = new Map<string, DocumentSummary[]>();
    filteredDocs.forEach(doc => {
      if (!map.has(doc.folderName)) map.set(doc.folderName, []);
      map.get(doc.folderName)!.push(doc);
    });
    return map;
  }, [filteredDocs]);

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-indigo-600 shrink-0" />
                <h2 className="text-lg font-bold text-slate-900">
                  सबै {documents.length} PDF कागजातहरूको वास्तविक फोल्डर तथा फाइल संरचना
                </h2>
              </div>
              <FontSizeControls variant="light" className="md:hidden" />
            </div>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              {isAdminOrOwner ? (
                <>
                  रिपोजिटरी <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-mono text-xs">barshapbp2026/any-pdf-</code> मा रहेका सबै फोल्डर, सब-फोल्डर र मूल PDF फाइलहरूको प्रमाणित सूची।
                </>
              ) : (
                'नेपाली कानुनी दस्तावेजहरूको सङ्गालोमा रहेका सबै फोल्डर, सब-फोल्डर र प्रमाणित कानुनी दस्तावेजहरूको सूची।'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-start gap-3 text-xs shrink-0">
            <div className="bg-indigo-50 border border-indigo-200/60 rounded-xl px-3 py-2 text-indigo-900">
              <span className="block text-slate-500 text-[10px] uppercase font-bold">कुल फोल्डरहरू</span>
              <span className="text-base font-bold">{toDevaDigits(folders.length)} वटा</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900">
              <span className="block text-slate-500 text-[10px] uppercase font-bold">कुल PDF कागजात</span>
              <span className="text-base font-bold">{toDevaDigits(documents.length)} वटा</span>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-emerald-900">
              <span className="block text-emerald-700 text-[10px] uppercase font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>पूर्ण सारांश तयार</span>
              </span>
              <span className="text-base font-bold">
                {toDevaDigits(totalCompleteDocs)}/{toDevaDigits(documents.length)} PDF ·{' '}
                {toDevaDigits(totalCompleteFolders)}/{toDevaDigits(folders.length)} फोल्डर
              </span>
            </div>
            <FontSizeControls variant="light" className="hidden md:inline-flex" />
          </div>
        </div>

        {/* Filter bar */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="PDF नाम, फोल्डर वा सबफोल्डर खोज्नुहोस्..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="w-full sm:w-auto">
            <select
              value={selectedFolder}
              onChange={e => setSelectedFolder(e.target.value)}
              className="w-full sm:w-64 px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-indigo-500 text-slate-700"
            >
              <option value="all">सबै फोल्डरहरू ({documents.length} PDFs)</option>
              {folders.map(f => (
                <option key={f} value={f}>
                  {f} ({documents.filter(d => d.folderName === f).length})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Folders and documents cards */}
      <div className="space-y-4">
        {Array.from(groupedByFolder.entries()).map(([folderName, docs]) => {
          const folderId = docs[0]?.folderId || '';
          const fStat = folderStatusByName?.get(folderName);
          const completeCount =
            fStat?.completeDocs ??
            docs.filter(d => docStatusByPath?.get(d.path)?.isComplete).length;
          const totalInFolder = fStat?.totalDocs ?? docs.length;
          const isFolderComplete = totalInFolder > 0 && completeCount === totalInFolder;

          return (
            <div
              key={folderName}
              className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
                isFolderComplete ? 'border-emerald-300' : 'border-slate-200'
              }`}
            >
              {/* Folder header */}
              <div
                className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2 ${
                  isFolderComplete
                    ? 'bg-emerald-50/70 border-emerald-200'
                    : 'bg-slate-50/80 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0">
                    {folderId || '📁'}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm flex flex-wrap items-center gap-2">
                      <span>{folderName}</span>
                      <span className="text-xs font-normal text-slate-500 tabular-nums">
                        · {toDevaDigits(docs.length)} फाइल
                      </span>
                    </h3>
                  </div>
                </div>

                {completeCount > 0 && (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                      isFolderComplete
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        : 'bg-white text-emerald-800 border-emerald-200'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      {isFolderComplete
                        ? `सबै सारांश पूरा (${toDevaDigits(completeCount)}/${toDevaDigits(totalInFolder)})`
                        : `पूर्ण सारांश: ${toDevaDigits(completeCount)}/${toDevaDigits(totalInFolder)} PDF`}
                    </span>
                  </span>
                )}
              </div>

              {/* Document list */}
              <div className="divide-y divide-slate-100">
                {docs.map((doc) => {
                  const hasSubfolder = !!doc.subfolderName;
                  const docStatus = docStatusByPath?.get(doc.path);
                  const rawUrl = isAdminOrOwner ? toGitHubRawUrl(doc.path) : '';
                  return (
                    <div
                      key={doc.path}
                      className={`p-3.5 sm:px-5 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                        docStatus?.isComplete
                          ? 'bg-emerald-50/25 hover:bg-emerald-50/50'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        {docStatus?.isComplete ? (
                          <span title="सारांश पूरा तयार छ" className="shrink-0 mt-0.5 inline-flex">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          </span>
                        ) : (
                          <FileText className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-900 text-sm hover:text-indigo-600 transition-colors truncate">
                              {doc.filename}
                            </span>
                            {docStatus?.isComplete ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>सारांश पूरा ({toDevaDigits(docStatus.cleanDafas)}/{toDevaDigits(docStatus.totalRows)})</span>
                              </span>
                            ) : docStatus?.isPartial ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-semibold">
                                {docStatus.pdfReady ? 'PDF ✓ · ' : ''}
                                {toDevaDigits(docStatus.cleanDafas)}/{toDevaDigits(docStatus.totalRows)} दफा
                              </span>
                            ) : null}
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 mt-1 font-mono text-[11px]">
                            {hasSubfolder ? (
                              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 font-sans">
                                सबफोल्डर: <strong>{doc.subfolderName}</strong>
                              </span>
                            ) : (
                              <span className="text-slate-400 font-sans italic">
                                सबफोल्डर: खाली (वास्तविक फोल्डरमै अवस्थित)
                              </span>
                            )}
                            <span className="text-slate-400">•</span>
                            <span>साइज: {Math.round(doc.size / 1024).toLocaleString()} KB</span>
                            <span className="text-slate-400">•</span>
                            <span className="text-emerald-700 font-medium font-sans">
                              {toDevaDigits(doc.totalSections)} दफा/शीर्षक, {toDevaDigits(doc.totalSchedules)} अनुसूची ({toDevaDigits(doc.totalRows)} रेकर्ड)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto flex-wrap">
                        {onSummarizePdf && (
                          <button
                            onClick={() => onSummarizePdf(doc.path)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                            title="यस PDF को Gemini AI सारांश तयार गर्नुहोस्"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                            <span>AI सारांश</span>
                          </button>
                        )}
                        {onOpenMdSync && (
                          <button
                            onClick={() => onOpenMdSync(doc.filename, '1')}
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                            title="यस कागजातलाई Markdown र PDF सँगै हेर्नुहोस्"
                          >
                            <span>MD रिडर र PDF सिंक</span>
                          </button>
                        )}
                        <button
                          onClick={() => onSelectDoc(doc.filename)}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-xs transition-colors cursor-pointer"
                        >
                          तालिकामा १० स्तम्भ
                        </button>
                        <button
                          onClick={() => onOpenPdf(doc.path, '1')}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-colors cursor-pointer"
                        >
                          PDF हेर्नुहोस्
                        </button>
                        {isAdminOrOwner && (
                          <a
                            href={rawUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                            title="मूल फाइल नयाँ ट्याबमा खोल्नुहोस्"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
