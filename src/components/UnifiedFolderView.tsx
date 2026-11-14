import React, { useState, useMemo } from 'react';
import {
  FileText, Search, ExternalLink, Download, FileSpreadsheet, Eye,
  Sparkles, Columns, ArrowRight, FolderTree, RefreshCw
} from 'lucide-react';
import { LegalRow, DocumentSummary } from '../types';
import { exportToExcel, exportToCsv, exportToJson } from '../utils/exportUtils';
import {
  toGitHubRawUrl,
  matchesDocName,
  rowBelongsToFolder,
  isAnusuchiRow,
  compareLegalRows,
  compareNumericPrefixes,
  formatAnusuchiIdOnly,
  formatAnusuchiTitleClean,
  getDisplaySectionId,
  getDisplaySectionTitle,
  getDisplaySectionPage,
} from '../utils/urlUtils';
import { toPhysicalPdfPage } from '../utils/pdfPageMap';
import { devaToNum } from '../utils/markdownUtils';
import { FontSizeControls } from './FontSizeControls';

export type ThemeColor = 'cyan' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'teal' | 'orange' | 'blue' | 'red';

interface ThemeStyles {
  activeBtn: string;
  ring: string;
  cardActiveBorder: string;
  cardActiveBg: string;
  tableHover: string;
  titleText: string;
}

const themeMap: Record<ThemeColor, ThemeStyles> = {
  cyan: {
    activeBtn: 'bg-cyan-700 text-white',
    ring: 'ring-cyan-500/20',
    cardActiveBorder: 'border-cyan-600',
    cardActiveBg: 'bg-cyan-50/70',
    tableHover: 'hover:bg-cyan-50/60',
    titleText: 'text-cyan-950',
  },
  emerald: {
    activeBtn: 'bg-emerald-700 text-white',
    ring: 'ring-emerald-500/20',
    cardActiveBorder: 'border-emerald-600',
    cardActiveBg: 'bg-emerald-50/70',
    tableHover: 'hover:bg-emerald-50/60',
    titleText: 'text-emerald-950',
  },
  amber: {
    activeBtn: 'bg-amber-700 text-white',
    ring: 'ring-amber-500/20',
    cardActiveBorder: 'border-amber-600',
    cardActiveBg: 'bg-amber-50/70',
    tableHover: 'hover:bg-amber-50/60',
    titleText: 'text-amber-950',
  },
  rose: {
    activeBtn: 'bg-rose-700 text-white',
    ring: 'ring-rose-500/20',
    cardActiveBorder: 'border-rose-600',
    cardActiveBg: 'bg-rose-50/70',
    tableHover: 'hover:bg-rose-50/60',
    titleText: 'text-rose-950',
  },
  indigo: {
    activeBtn: 'bg-indigo-700 text-white',
    ring: 'ring-indigo-500/20',
    cardActiveBorder: 'border-indigo-600',
    cardActiveBg: 'bg-indigo-50/70',
    tableHover: 'hover:bg-indigo-50/60',
    titleText: 'text-indigo-950',
  },
  teal: {
    activeBtn: 'bg-teal-700 text-white',
    ring: 'ring-teal-500/20',
    cardActiveBorder: 'border-teal-600',
    cardActiveBg: 'bg-teal-50/70',
    tableHover: 'hover:bg-teal-50/60',
    titleText: 'text-teal-950',
  },
  orange: {
    activeBtn: 'bg-orange-700 text-white',
    ring: 'ring-orange-500/20',
    cardActiveBorder: 'border-orange-600',
    cardActiveBg: 'bg-orange-50/70',
    tableHover: 'hover:bg-orange-50/60',
    titleText: 'text-orange-950',
  },
  blue: {
    activeBtn: 'bg-blue-700 text-white',
    ring: 'ring-blue-500/20',
    cardActiveBorder: 'border-blue-600',
    cardActiveBg: 'bg-blue-50/70',
    tableHover: 'hover:bg-blue-50/60',
    titleText: 'text-blue-950',
  },
  red: {
    activeBtn: 'bg-red-700 text-white',
    ring: 'ring-red-500/20',
    cardActiveBorder: 'border-red-600',
    cardActiveBg: 'bg-red-50/70',
    tableHover: 'hover:bg-red-50/60',
    titleText: 'text-red-950',
  },
};

export interface UnifiedFolderViewProps {
  folderId: string;
  folderName: string;
  themeColor: ThemeColor;
  description: string;
  allRows: LegalRow[];
  documents: DocumentSummary[];
  onOpenPdf: (path: string, page: string, highlightText?: string) => void;
  onOpenMdSync?: (filename: string, page?: string) => void;
  onOpenModal: (row: LegalRow, contextList?: LegalRow[]) => void;
  onSummarizePdf?: (docPath: string, page?: string) => void;
  isAdminOrOwner?: boolean;
}

export const UnifiedFolderView: React.FC<UnifiedFolderViewProps> = ({
  folderId,
  folderName,
  themeColor,
  description,
  allRows,
  documents,
  onOpenPdf,
  onOpenMdSync,
  onOpenModal,
  onSummarizePdf,
  isAdminOrOwner = false,
}) => {
  const styles = themeMap[themeColor] || themeMap.indigo;

  // Filter all rows strictly for this folder and sort serially (so १.२ precedes १.३, sections sort numerically, etc.)
  const folderRows = useMemo(() => {
    return allRows
      .filter(r => rowBelongsToFolder(r, folderId, folderName))
      .sort(compareLegalRows);
  }, [allRows, folderId, folderName]);

  // Documents for this folder (sorted serially by filename prefix)
  const folderDocs = useMemo(() => {
    return documents
      .filter(d => {
        if (d.folderId === folderId) return true;
        if (d.folderId) {
          const ids = d.folderId.split(',').map(s => s.trim());
          if (ids.includes(folderId)) return true;
        }
        if (d.folderName === folderName || d.folderName?.startsWith(folderId + ' ')) return true;
        if (folderId === '१.' && (d.filename?.includes('संबिधान') || d.filename?.includes('संविधान') || d.filename?.includes('अपराध संहिता') || d.filename?.includes('देवानी संहिता') || d.filename?.includes('फौजदारी कार्यविधि'))) return true;
        return false;
      })
      .sort((a, b) => compareNumericPrefixes(a.filename, b.filename));
  }, [documents, folderId, folderName]);

  // Extract all subfolders in this folder (sorted numerically)
  const subfolders = useMemo(() => {
    const set = new Set<string>();
    folderDocs.forEach(d => {
      if (d.subfolderName && d.subfolderName.trim() !== '') {
        set.add(d.subfolderName);
      }
    });
    return Array.from(set).sort(compareNumericPrefixes);
  }, [folderDocs]);

  // States
  const [selectedSubfolder, setSelectedSubfolder] = useState<string>('all');
  const [selectedDoc, setSelectedDoc] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'दफा' | 'अनुसूची'>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(100);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return folderRows.filter(r => {
      // Subfolder filter
      if (selectedSubfolder !== 'all' && r.subfolder_name !== selectedSubfolder && r.subfolder_id !== selectedSubfolder) {
        return false;
      }

      // Document filter
      if (selectedDoc !== 'all') {
        if (!matchesDocName(r.pdf_name, selectedDoc)) return false;
      }

      // Type filter
      if (typeFilter !== 'all') {
        if (typeFilter === 'अनुसूची' && !isAnusuchiRow(r)) return false;
        if (typeFilter === 'दफा' && isAnusuchiRow(r)) return false;
      }

      // Search term
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase().trim();
      return (
        r.section_id.toLowerCase().includes(q) ||
        r.title_name.toLowerCase().includes(q) ||
        r.title_page.toLowerCase().includes(q) ||
        r.anusuchi_id.toLowerCase().includes(q) ||
        r.anusuchi_title.toLowerCase().includes(q) ||
        r.anusuchi_print_page.toLowerCase().includes(q) ||
        r.pdf_name.toLowerCase().includes(q) ||
        (r.subfolder_name && r.subfolder_name.toLowerCase().includes(q))
      );
    });
  }, [folderRows, selectedSubfolder, selectedDoc, typeFilter, searchTerm]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedSubfolder, selectedDoc, typeFilter, searchTerm]);

  const effectivePageSize = pageSize === 0 ? Math.max(1, filteredRows.length) : pageSize;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / effectivePageSize));
  const safePage = Math.min(currentPage, totalPages);

  const displayedRows = useMemo(() => {
    if (pageSize === 0) return filteredRows;
    const start = (safePage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, safePage, pageSize]);

  // Compute row spans for consecutive rows with identical folder, subfolder, PDF, section, or anusuchi values
  const rowSpans = useMemo(() => {
    const list = displayedRows;
    const pdfSpans: { isFirst: boolean; rowSpan: number }[] = new Array(list.length);
    const subfolderSpans: { isFirst: boolean; rowSpan: number }[] = new Array(list.length);
    const folderSpans: { isFirst: boolean; rowSpan: number }[] = new Array(list.length);
    const sectionSpans: { isFirst: boolean; rowSpan: number }[] = new Array(list.length);
    const anusuchiSpans: { isFirst: boolean; rowSpan: number }[] = new Array(list.length);

    // 1. PDF spans and nested section / schedule spans
    let i = 0;
    while (i < list.length) {
      const cur = list[i];
      const pKey = `${cur.folder_id}__${cur.subfolder_id || ''}__${cur.pdf_name}`;
      let j = i + 1;
      while (j < list.length && `${list[j].folder_id}__${list[j].subfolder_id || ''}__${list[j].pdf_name}` === pKey) {
        j++;
      }
      const count = j - i;
      pdfSpans[i] = { isFirst: true, rowSpan: count };
      for (let k = i + 1; k < j; k++) {
        pdfSpans[k] = { isFirst: false, rowSpan: 0 };
      }

      // Check sections within this PDF
      let s = i;
      while (s < j) {
        const curSec = list[s];
        const curSecId = getDisplaySectionId(curSec);
        if (!curSecId) {
          sectionSpans[s] = { isFirst: true, rowSpan: 1 };
          s++;
          continue;
        }
        const sKey = `${curSecId}__${getDisplaySectionTitle(curSec)}`;
        let sn = s + 1;
        while (sn < j && getDisplaySectionId(list[sn]) && `${getDisplaySectionId(list[sn])}__${getDisplaySectionTitle(list[sn])}` === sKey) {
          sn++;
        }
        const sCount = sn - s;
        sectionSpans[s] = { isFirst: true, rowSpan: sCount };
        for (let sk = s + 1; sk < sn; sk++) {
          sectionSpans[sk] = { isFirst: false, rowSpan: 0 };
        }
        s = sn;
      }

      // Check anusuchis within this PDF
      let a = i;
      while (a < j) {
        const curA = list[a];
        const curAid = formatAnusuchiIdOnly(curA.anusuchi_id);
        if (!curAid) {
          anusuchiSpans[a] = { isFirst: true, rowSpan: 1 };
          a++;
          continue;
        }
        const aKey = `${curAid}__${formatAnusuchiTitleClean(curA.anusuchi_title)}`;
        let an = a + 1;
        while (an < j && formatAnusuchiIdOnly(list[an].anusuchi_id) && `${formatAnusuchiIdOnly(list[an].anusuchi_id)}__${formatAnusuchiTitleClean(list[an].anusuchi_title)}` === aKey) {
          an++;
        }
        const aCount = an - a;
        anusuchiSpans[a] = { isFirst: true, rowSpan: aCount };
        for (let ak = a + 1; ak < an; ak++) {
          anusuchiSpans[ak] = { isFirst: false, rowSpan: 0 };
        }
        a = an;
      }

      i = j;
    }

    // Subfolder spans
    let si = 0;
    while (si < list.length) {
      const cur = list[si];
      const sfKey = `${cur.folder_id}__${cur.subfolder_id || ''}`;
      let sj = si + 1;
      while (sj < list.length && `${list[sj].folder_id}__${list[sj].subfolder_id || ''}` === sfKey) {
        sj++;
      }
      const count = sj - si;
      subfolderSpans[si] = { isFirst: true, rowSpan: count };
      for (let k = si + 1; k < sj; k++) {
        subfolderSpans[k] = { isFirst: false, rowSpan: 0 };
      }
      si = sj;
    }

    // Folder spans
    let fi = 0;
    while (fi < list.length) {
      const cur = list[fi];
      const fKey = cur.folder_id;
      let fj = fi + 1;
      while (fj < list.length && list[fj].folder_id === fKey) {
        fj++;
      }
      const count = fj - fi;
      folderSpans[fi] = { isFirst: true, rowSpan: count };
      for (let k = fi + 1; k < fj; k++) {
        folderSpans[k] = { isFirst: false, rowSpan: 0 };
      }
      fi = fj;
    }

    return { pdfSpans, subfolderSpans, folderSpans, sectionSpans, anusuchiSpans };
  }, [displayedRows]);

  // Total counts
  const totalSections = useMemo(() => folderRows.filter(r => r.section_id && !isAnusuchiRow(r)).length, [folderRows]);
  const totalSchedules = useMemo(() => folderRows.filter(r => isAnusuchiRow(r)).length, [folderRows]);
  const totalSizeKB = useMemo(() => folderDocs.reduce((acc, d) => acc + (d.size || 0), 0) / 1024, [folderDocs]);

  const toDevaNum = (n: number | string) => {
    const devDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
    return String(n).replace(/[0-9]/g, d => devDigits[parseInt(d, 10)]);
  };

  const handleSubfolderClick = (sf: string) => {
    setSelectedSubfolder(sf);
    setSelectedDoc('all'); // reset specific doc filter when switching subfolder
  };

  const handleDocCardClick = (filename: string) => {
    if (selectedDoc === filename) {
      setSelectedDoc('all');
    } else {
      setSelectedDoc(filename);
    }
  };

  const handleClearFilters = () => {
    setSelectedSubfolder('all');
    setSelectedDoc('all');
    setSearchTerm('');
    setTypeFilter('all');
  };

  // Export names
  const exportBaseName = `Nepal_Legal_Folder_${folderId.replace(/\./g, '')}_${folderName.replace(/[^a-zA-Z0-9_\u0900-\u097F]/g, '_')}`;

  return (
    <div className="space-y-4">
      {/* 1. Clean Editorial Archive Header */}
      <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
          <div className="space-y-2 max-w-3xl w-full">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium">
                <span>फोल्डर {folderId}</span>
                {subfolders.length > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{toDevaNum(subfolders.length)} सब-फोल्डर</span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{toDevaNum(folderDocs.length)} PDF ({Math.round(totalSizeKB).toLocaleString()} KB)</span>
              </div>
              <FontSizeControls variant="light" className="lg:hidden" />
            </div>

            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {folderName}
            </h2>

            <p className="text-slate-600 text-sm leading-relaxed">
              {description}
            </p>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-slate-600 tabular-nums">
              <span>
                दफा/शीर्षक: <strong className="text-slate-900">{toDevaNum(totalSections)}</strong>
              </span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span>
                अनुसूची: <strong className="text-slate-900">{toDevaNum(totalSchedules)}</strong>
              </span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span>
                कुल रेकर्ड: <strong className="text-slate-900">{toDevaNum(folderRows.length)}</strong>
              </span>
            </div>
          </div>

          {/* Clean Action Controls */}
          <div className="flex flex-wrap lg:flex-col items-stretch sm:items-center lg:items-end gap-2 shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              {onSummarizePdf && (
                <button
                  onClick={() => {
                    const targetDoc =
                      (selectedDoc !== 'all'
                        ? folderDocs.find(d => d.filename === selectedDoc)
                        : undefined) || folderDocs[0];
                    if (targetDoc) {
                      onSummarizePdf(targetDoc.path);
                    }
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI PDF सारांश</span>
                </button>
              )}
              <FontSizeControls variant="light" className="hidden lg:inline-flex" />
            </div>
            {isAdminOrOwner && (
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  onClick={() => exportToExcel(folderRows, `${exportBaseName}.xlsx`)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Excel</span>
                </button>
                <button
                  onClick={() => exportToCsv(folderRows, `${exportBaseName}.csv`)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-blue-700" />
                  <span>CSV</span>
                </button>
                <button
                  onClick={() => exportToJson(folderRows, `${exportBaseName}.json`)}
                  className="inline-flex items-center px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors cursor-pointer"
                  title="Export as JSON"
                >
                  <span>JSON</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Subfolder Selector (If folder contains subfolders) */}
      {subfolders.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <FolderTree className="w-3.5 h-3.5 text-indigo-600" />
              <span>सब-फोल्डर छान्नुहोस् ({toDevaNum(subfolders.length)} सब-फोल्डरहरू)</span>
            </h3>
            {selectedSubfolder !== 'all' && (
              <button
                onClick={() => handleSubfolderClick('all')}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
              >
                सबै सब-फोल्डरहरू देखाउनुहोस्
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleSubfolderClick('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedSubfolder === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              सबै सब-फोल्डरहरू ({toDevaNum(folderDocs.length)} PDFs)
            </button>
            {subfolders.map(sf => {
              const sfDocs = folderDocs.filter(d => d.subfolderName === sf);
              const sfRows = folderRows.filter(r => r.subfolder_name === sf);
              const isSelected = selectedSubfolder === sf;
              return (
                <button
                  key={sf}
                  onClick={() => handleSubfolderClick(sf)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? `${styles.activeBtn} shadow-xs ring-2 ${styles.ring}`
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>{sf}</span>
                  <span className={`text-[11px] font-mono tabular-nums ${
                    isSelected ? 'text-white/80' : 'text-slate-500'
                  }`}>
                    ({toDevaNum(sfDocs.length)}/{toDevaNum(sfRows.length)})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Clean Document List */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500" />
            <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
              कागजातहरू ({toDevaNum(folderDocs.length)} PDF)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {selectedDoc !== 'all' && (
              <button
                onClick={() => setSelectedDoc('all')}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>सबै देखाउनुहोस्</span>
              </button>
            )}
            <FontSizeControls variant="light" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {folderDocs.map(doc => {
            const isSelected = selectedDoc === doc.filename;
            const docRows = folderRows.filter(r => matchesDocName(r.pdf_name, doc.filename));
            const rawUrl = isAdminOrOwner ? toGitHubRawUrl(doc.path) : '';

            return (
              <div
                key={doc.path}
                onClick={() => handleDocCardClick(doc.filename)}
                className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-colors flex flex-col justify-between ${
                  isSelected
                    ? `${styles.cardActiveBorder} ${styles.cardActiveBg}`
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                }`}
              >
                <div className="space-y-1">
                  <div className="font-semibold text-slate-900 text-xs sm:text-sm line-clamp-2 leading-snug" title={doc.filename}>
                    {doc.filename.replace('.pdf', '')}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 tabular-nums">
                    {doc.subfolderName && (
                      <>
                        <span className="truncate max-w-[140px]">{doc.subfolderName}</span>
                        <span aria-hidden="true">·</span>
                      </>
                    )}
                    <span>{Math.round(doc.size / 1024)} KB</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-slate-700">{toDevaNum(docRows.length)} रेकर्ड</span>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                  {onSummarizePdf && (
                    <button
                      onClick={() => onSummarizePdf(doc.path)}
                      className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
                      title="AI सारांश"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>सार</span>
                    </button>
                  )}
                  {onOpenMdSync && (
                    <button
                      onClick={() => onOpenMdSync(doc.filename, '1')}
                      className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
                      title="MD + PDF सिंक"
                    >
                      <Columns className="w-3 h-3" />
                      <span>MD</span>
                    </button>
                  )}
                  <button
                    onClick={() => onOpenPdf(doc.path, '1')}
                    className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
                    title="PDF हेर्नुहोस्"
                  >
                    <Eye className="w-3 h-3 text-rose-600" />
                    <span>PDF</span>
                  </button>
                  {isAdminOrOwner && (
                    <a
                      href={rawUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
                      title="GitHub बाट PDF खोल्नुहोस्"
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

      {/* 4. Filter & Search Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Document Selector Dropdown */}
        <div className="w-full md:w-80">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            कागजात फिल्टर गर्नुहोस्
          </label>
          <select
            value={selectedDoc}
            onChange={e => setSelectedDoc(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-indigo-500 text-slate-800 font-medium"
          >
            <option value="all">सबै {toDevaNum(folderDocs.length)} कागजातहरू ({toDevaNum(folderRows.length)} रेकर्ड)</option>
            {folderDocs.map(d => {
              const count = folderRows.filter(r => matchesDocName(r.pdf_name, d.filename)).length;
              return (
                <option key={d.path} value={d.filename}>
                  {d.filename.replace('.pdf', '')} ({toDevaNum(count)} रेकर्ड)
                </option>
              );
            })}
          </select>
        </div>

        {/* Live Search Input */}
        <div className="flex-1 w-full relative">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            दफा, शीर्षक वा अनुसूची खोज्नुहोस्
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="दफा नम्बर, शीर्षक नाम, अनुसूची ID, पृष्ठ वा शब्द खोज्नुहोस्..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Type Filter Buttons */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            प्रकार छान्नुहोस्
          </label>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                typeFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              सबै ({toDevaNum(folderRows.length)})
            </button>
            <button
              onClick={() => setTypeFilter('दफा')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                typeFilter === 'दफा'
                  ? `${styles.activeBtn} shadow-xs`
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              दफा मात्र ({toDevaNum(totalSections)})
            </button>
            <button
              onClick={() => setTypeFilter('अनुसूची')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                typeFilter === 'अनुसूची'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              अनुसूची मात्र ({toDevaNum(totalSchedules)})
            </button>
          </div>
        </div>
      </div>

      {/* 5. 10-Column Master Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 text-xs sm:text-sm">
              {folderName}: १०-स्तम्भ तालिका
            </span>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              · {toDevaNum(filteredRows.length)} रेकर्ड
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
            <span>कुनै पनि रो-मा क्लिक गरेर १० स्तम्भ मोडलमा विस्तृत विवरण हेर्नुहोस्</span>
            {(selectedDoc !== 'all' || selectedSubfolder !== 'all' || searchTerm || typeFilter !== 'all') && (
              <button
                onClick={handleClearFilters}
                className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>सबै रिसेट गर्नुहोस्</span>
              </button>
            )}
            <FontSizeControls variant="light" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200 whitespace-nowrap">
                <th className="py-2.5 px-3 font-bold text-center whitespace-nowrap">क्र.सं.</th>
                <th className="py-2.5 px-3 font-bold whitespace-nowrap">१. फोल्डर</th>
                <th className="py-2.5 px-3 font-bold whitespace-nowrap">२. सबफोल्डर</th>
                <th className="py-2.5 px-3 font-bold whitespace-nowrap">३. दफा ID</th>
                <th className="py-2.5 px-3 font-bold min-w-[200px] whitespace-nowrap">४. दफा शीर्षक</th>
                <th className="py-2.5 px-3 font-bold text-center whitespace-nowrap">५. पेज</th>
                <th className="py-2.5 px-3 font-bold whitespace-nowrap">६. अनुसूची ID</th>
                <th className="py-2.5 px-3 font-bold min-w-[220px] whitespace-nowrap">७. अनुसूची शीर्षक</th>
                <th className="py-2.5 px-3 font-bold text-center whitespace-nowrap">८. प्रिन्ट पेज</th>
                <th className="py-2.5 px-3 font-bold min-w-[160px] whitespace-nowrap">९. कागजात</th>
                <th className="py-2.5 px-3 font-bold text-center whitespace-nowrap">१०. कार्यहरू</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    कुनै रेकर्ड फेला परेन। खोज शब्द वा फिल्टर परिवर्तन गर्नुहोस्।
                  </td>
                </tr>
              ) : (
                displayedRows.map((row, idx) => {
                  const isAnusuchi = isAnusuchiRow(row) || !!row.anusuchi_id;
                  const fSpan = rowSpans.folderSpans[idx];
                  const sfSpan = rowSpans.subfolderSpans[idx];
                  const secSpan = rowSpans.sectionSpans[idx];
                  const aSpan = rowSpans.anusuchiSpans[idx];
                  const pSpan = rowSpans.pdfSpans[idx];
                  const serialNo = (pageSize === 0 ? 0 : (safePage - 1) * pageSize) + idx + 1;

                  return (
                    <tr
                      key={`${row.folder_id}-${row.pdf_name}-${row.section_id}-${row.anusuchi_id}-${serialNo}`}
                      onClick={() => onOpenModal(row, folderRows)}
                      className={`${styles.tableHover} cursor-pointer transition-colors ${
                        isAnusuchi ? 'bg-purple-50/20' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center text-slate-500 font-mono whitespace-nowrap">
                        {toDevaNum(serialNo)}
                      </td>

                      {/* Column 1: Folder ID (Merged) */}
                      {fSpan?.isFirst && (
                        <td 
                          rowSpan={fSpan.rowSpan}
                          className="py-2.5 px-3 font-mono font-semibold text-slate-800 align-top bg-slate-50/70 border-r border-slate-200 whitespace-nowrap"
                        >
                          {row.folder_id}
                        </td>
                      )}

                      {/* Column 2: Subfolder ID (Merged) */}
                      {sfSpan?.isFirst && (
                        <td 
                          rowSpan={sfSpan.rowSpan}
                          className="py-2.5 px-3 font-mono text-slate-600 text-[11px] align-top bg-slate-50/50 border-r border-slate-200 whitespace-nowrap"
                        >
                          {row.subfolder_id || '-'}
                        </td>
                      )}

                      {/* Column 3: Section ID (Merged) */}
                      {secSpan?.isFirst && (() => {
                        const displaySecId = getDisplaySectionId(row);
                        return (
                          <td 
                            rowSpan={secSpan.rowSpan}
                            className={`py-2.5 px-3 font-mono font-bold whitespace-nowrap ${styles.titleText} ${secSpan.rowSpan > 1 ? 'align-top bg-slate-50/30' : ''}`}
                          >
                            {displaySecId || <span className="text-slate-300 font-normal">-</span>}
                          </td>
                        );
                      })()}

                      {/* Column 4: Title Name (Merged) */}
                      {secSpan?.isFirst && (() => {
                        const displayTitle = getDisplaySectionTitle(row);
                        return (
                          <td 
                            rowSpan={secSpan.rowSpan}
                            className={`py-2.5 px-3 w-auto max-w-md whitespace-normal break-words font-['Mukta','Noto_Sans_Devanagari',sans-serif] font-semibold text-slate-900 text-xs tracking-wide antialiased leading-relaxed ${secSpan.rowSpan > 1 ? 'align-top bg-slate-50/30' : ''}`}
                          >
                            {displayTitle ? (
                              <span>{displayTitle}</span>
                            ) : (
                              <span className="text-slate-300 italic">-</span>
                            )}
                          </td>
                        );
                      })()}

                      {/* Column 5: Title Page (Merged) */}
                      {secSpan?.isFirst && (() => {
                        const displayPage = getDisplaySectionPage(row);
                        return (
                          <td 
                            rowSpan={secSpan.rowSpan}
                            className={`py-2.5 px-3 text-center font-mono text-slate-700 whitespace-nowrap ${secSpan.rowSpan > 1 ? 'align-top bg-slate-50/30' : ''}`}
                          >
                            {displayPage ? (() => {
                              const rawNum = devaToNum(displayPage);
                              const physNum = toPhysicalPdfPage(row.pdf_path, rawNum);
                              return (
                                <span>
                                  {displayPage}
                                  {physNum !== rawNum && (
                                    <span className="block text-[10px] text-amber-700 font-sans">
                                      (PDF {toDevaNum(physNum)})
                                    </span>
                                  )}
                                </span>
                              );
                            })() : <span className="text-slate-300">-</span>}
                          </td>
                        );
                      })()}

                      {/* Column 6: Anusuchi ID (Merged) */}
                      {aSpan?.isFirst && (() => {
                        const displayAid = formatAnusuchiIdOnly(row.anusuchi_id);
                        return (
                          <td 
                            rowSpan={aSpan.rowSpan}
                            className={`py-2.5 px-3 font-mono font-bold text-purple-700 whitespace-nowrap ${aSpan.rowSpan > 1 ? 'align-top bg-slate-50/30' : ''}`}
                          >
                            {displayAid ? (
                              <span className="inline-block px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[11px] whitespace-nowrap">
                                {displayAid}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        );
                      })()}

                      {/* Column 7: Anusuchi Title (Merged) */}
                      {aSpan?.isFirst && (() => {
                        const displayAtitle = formatAnusuchiTitleClean(row.anusuchi_title);
                        return (
                          <td 
                            rowSpan={aSpan.rowSpan}
                            className={`py-2.5 px-3 font-medium text-purple-950 ${aSpan.rowSpan > 1 ? 'align-top bg-slate-50/30' : ''}`}
                          >
                            {displayAtitle ? (
                              <span>{displayAtitle}</span>
                            ) : (
                              <span className="text-slate-300 italic">-</span>
                            )}
                          </td>
                        );
                      })()}

                      {/* Column 8: Anusuchi Print Page (Merged) */}
                      {aSpan?.isFirst && (
                        <td 
                          rowSpan={aSpan.rowSpan}
                          className={`py-2.5 px-3 text-center font-mono text-purple-800 font-semibold whitespace-nowrap ${aSpan.rowSpan > 1 ? 'align-top bg-slate-50/30' : ''}`}
                        >
                          {row.anusuchi_print_page ? (() => {
                            const rawNum = devaToNum(row.anusuchi_print_page);
                            const physNum = toPhysicalPdfPage(row.pdf_path, rawNum);
                            return (
                              <span>
                                {row.anusuchi_print_page}
                                {physNum !== rawNum && (
                                  <span className="block text-[10px] text-purple-600 font-sans font-normal">
                                    (PDF {toDevaNum(physNum)})
                                  </span>
                                )}
                              </span>
                            );
                          })() : '-'}
                        </td>
                      )}

                      {/* Column 9: PDF Name (Merged) */}
                      {pSpan?.isFirst && (
                        <td 
                          rowSpan={pSpan.rowSpan}
                          className="py-2.5 px-3 text-slate-600 truncate max-w-[180px] align-top bg-slate-50/40 border-l border-slate-200" 
                          title={row.pdf_name}
                        >
                          {row.pdf_name}
                        </td>
                      )}

                      {/* Column 10: Action buttons */}
                      <td 
                        className="py-2.5 px-3 text-center"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onOpenPdf(row.pdf_path, row.anusuchi_print_page || row.title_page || '1', row.title_name || row.anusuchi_title)}
                            className="p-1 rounded hover:bg-slate-200 text-slate-600 hover:text-indigo-700 transition-colors"
                            title="यस पेजको PDF हेर्नुहोस्"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {onOpenMdSync && (
                            <button
                              onClick={() => onOpenMdSync(row.pdf_name, row.anusuchi_print_page || row.title_page || '1')}
                              className="p-1 rounded hover:bg-indigo-100 text-indigo-600 transition-colors"
                              title="MD + PDF सिंक हेर्नुहोस्"
                            >
                              <Columns className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => onOpenModal(row, folderRows)}
                            className="p-1 rounded hover:bg-slate-200 text-slate-600 hover:text-indigo-600 transition-colors"
                            title="१० स्तम्भ विवरण खोल्नुहोस्"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {filteredRows.length > 0 && (
            <div className="px-4 py-3 text-xs text-slate-600 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                देखाउँदै: <strong>{toDevaNum((pageSize === 0 ? 0 : (safePage - 1) * pageSize) + 1)}</strong> देखि <strong>{toDevaNum(pageSize === 0 ? filteredRows.length : Math.min(safePage * pageSize, filteredRows.length))}</strong> सम्म (जम्मा: <strong>{toDevaNum(filteredRows.length)}</strong> रेकर्डहरू)
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <label className="flex items-center gap-1.5 text-slate-500">
                  <span>प्रति पृष्ठ:</span>
                  <select
                    value={pageSize}
                    onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                    className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs font-medium text-slate-800"
                  >
                    <option value={100}>१००</option>
                    <option value={200}>२००</option>
                    <option value={500}>५००</option>
                    <option value={0}>सबै ({toDevaNum(filteredRows.length)})</option>
                  </select>
                </label>
                {pageSize !== 0 && totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={safePage === 1}
                      className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                    >
                      पहिलो
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={safePage === 1}
                      className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                    >
                      अघिल्लो
                    </button>
                    <span className="px-2 py-1 font-mono font-bold text-slate-800">
                      {toDevaNum(safePage)} / {toDevaNum(totalPages)}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={safePage === totalPages}
                      className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                    >
                      अर्को
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={safePage === totalPages}
                      className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                    >
                      अन्तिम
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
