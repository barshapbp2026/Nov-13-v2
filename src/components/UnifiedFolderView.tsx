import React, { useState, useMemo } from 'react';
import { 
  FileText, Search, ExternalLink, Download, FileSpreadsheet, Eye, 
  Sparkles, CheckCircle2, Bookmark, Columns, Filter, ShieldCheck, 
  ArrowRight, Layers, Users, BookOpen, Scale, Compass, Award, FolderTree,
  ChevronRight, RefreshCw
} from 'lucide-react';
import { LegalRow, DocumentSummary } from '../types';
import { exportToExcel, exportToCsv, exportToJson } from '../utils/exportUtils';
import { toGitHubRawUrl, matchesDocName, rowBelongsToFolder, isAnusuchiRow } from '../utils/urlUtils';

export type ThemeColor = 'cyan' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'teal' | 'orange' | 'blue' | 'red';

interface ThemeStyles {
  gradient: string;
  border: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  iconText: string;
  activeBtn: string;
  ring: string;
  cardActiveBorder: string;
  cardActiveBg: string;
  tableHover: string;
  titleText: string;
  exportBtn: string;
}

const themeMap: Record<ThemeColor, ThemeStyles> = {
  cyan: {
    gradient: 'from-slate-900 via-cyan-950 to-slate-900',
    border: 'border-cyan-700/50',
    badgeBg: 'bg-cyan-500/20',
    badgeText: 'text-cyan-200',
    badgeBorder: 'border-cyan-400/30',
    iconText: 'text-cyan-300',
    activeBtn: 'bg-cyan-700 text-white',
    ring: 'ring-cyan-500/20',
    cardActiveBorder: 'border-cyan-600',
    cardActiveBg: 'bg-cyan-50/70',
    tableHover: 'hover:bg-cyan-50/60',
    titleText: 'text-cyan-950',
    exportBtn: 'bg-cyan-700 hover:bg-cyan-600',
  },
  emerald: {
    gradient: 'from-slate-900 via-emerald-950 to-slate-900',
    border: 'border-emerald-700/50',
    badgeBg: 'bg-emerald-500/20',
    badgeText: 'text-emerald-200',
    badgeBorder: 'border-emerald-400/30',
    iconText: 'text-emerald-300',
    activeBtn: 'bg-emerald-700 text-white',
    ring: 'ring-emerald-500/20',
    cardActiveBorder: 'border-emerald-600',
    cardActiveBg: 'bg-emerald-50/70',
    tableHover: 'hover:bg-emerald-50/60',
    titleText: 'text-emerald-950',
    exportBtn: 'bg-emerald-700 hover:bg-emerald-600',
  },
  amber: {
    gradient: 'from-slate-900 via-amber-950 to-slate-900',
    border: 'border-amber-700/50',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-200',
    badgeBorder: 'border-amber-400/30',
    iconText: 'text-amber-300',
    activeBtn: 'bg-amber-700 text-white',
    ring: 'ring-amber-500/20',
    cardActiveBorder: 'border-amber-600',
    cardActiveBg: 'bg-amber-50/70',
    tableHover: 'hover:bg-amber-50/60',
    titleText: 'text-amber-950',
    exportBtn: 'bg-amber-700 hover:bg-amber-600',
  },
  rose: {
    gradient: 'from-slate-900 via-rose-950 to-slate-900',
    border: 'border-rose-700/50',
    badgeBg: 'bg-rose-500/20',
    badgeText: 'text-rose-200',
    badgeBorder: 'border-rose-400/30',
    iconText: 'text-rose-300',
    activeBtn: 'bg-rose-700 text-white',
    ring: 'ring-rose-500/20',
    cardActiveBorder: 'border-rose-600',
    cardActiveBg: 'bg-rose-50/70',
    tableHover: 'hover:bg-rose-50/60',
    titleText: 'text-rose-950',
    exportBtn: 'bg-rose-700 hover:bg-rose-600',
  },
  indigo: {
    gradient: 'from-slate-900 via-indigo-950 to-slate-900',
    border: 'border-indigo-700/50',
    badgeBg: 'bg-indigo-500/20',
    badgeText: 'text-indigo-200',
    badgeBorder: 'border-indigo-400/30',
    iconText: 'text-indigo-300',
    activeBtn: 'bg-indigo-700 text-white',
    ring: 'ring-indigo-500/20',
    cardActiveBorder: 'border-indigo-600',
    cardActiveBg: 'bg-indigo-50/70',
    tableHover: 'hover:bg-indigo-50/60',
    titleText: 'text-indigo-950',
    exportBtn: 'bg-indigo-700 hover:bg-indigo-600',
  },
  teal: {
    gradient: 'from-slate-900 via-teal-950 to-slate-900',
    border: 'border-teal-700/50',
    badgeBg: 'bg-teal-500/20',
    badgeText: 'text-teal-200',
    badgeBorder: 'border-teal-400/30',
    iconText: 'text-teal-300',
    activeBtn: 'bg-teal-700 text-white',
    ring: 'ring-teal-500/20',
    cardActiveBorder: 'border-teal-600',
    cardActiveBg: 'bg-teal-50/70',
    tableHover: 'hover:bg-teal-50/60',
    titleText: 'text-teal-950',
    exportBtn: 'bg-teal-700 hover:bg-teal-600',
  },
  orange: {
    gradient: 'from-slate-900 via-orange-950 to-slate-900',
    border: 'border-orange-700/50',
    badgeBg: 'bg-orange-500/20',
    badgeText: 'text-orange-200',
    badgeBorder: 'border-orange-400/30',
    iconText: 'text-orange-300',
    activeBtn: 'bg-orange-700 text-white',
    ring: 'ring-orange-500/20',
    cardActiveBorder: 'border-orange-600',
    cardActiveBg: 'bg-orange-50/70',
    tableHover: 'hover:bg-orange-50/60',
    titleText: 'text-orange-950',
    exportBtn: 'bg-orange-700 hover:bg-orange-600',
  },
  blue: {
    gradient: 'from-slate-900 via-blue-950 to-slate-900',
    border: 'border-blue-700/50',
    badgeBg: 'bg-blue-500/20',
    badgeText: 'text-blue-200',
    badgeBorder: 'border-blue-400/30',
    iconText: 'text-blue-300',
    activeBtn: 'bg-blue-700 text-white',
    ring: 'ring-blue-500/20',
    cardActiveBorder: 'border-blue-600',
    cardActiveBg: 'bg-blue-50/70',
    tableHover: 'hover:bg-blue-50/60',
    titleText: 'text-blue-950',
    exportBtn: 'bg-blue-700 hover:bg-blue-600',
  },
  red: {
    gradient: 'from-slate-900 via-rose-950 to-slate-900',
    border: 'border-red-700/50',
    badgeBg: 'bg-red-500/20',
    badgeText: 'text-red-200',
    badgeBorder: 'border-red-400/30',
    iconText: 'text-red-300',
    activeBtn: 'bg-red-700 text-white',
    ring: 'ring-red-500/20',
    cardActiveBorder: 'border-red-600',
    cardActiveBg: 'bg-red-50/70',
    tableHover: 'hover:bg-red-50/60',
    titleText: 'text-red-950',
    exportBtn: 'bg-red-700 hover:bg-red-600',
  },
};

export interface UnifiedFolderViewProps {
  folderId: string;
  folderName: string;
  themeColor: ThemeColor;
  icon: React.ReactNode;
  description: string;
  allRows: LegalRow[];
  documents: DocumentSummary[];
  onOpenPdf: (path: string, page: string) => void;
  onOpenMdSync?: (filename: string, page?: string) => void;
  onOpenModal: (row: LegalRow, contextList?: LegalRow[]) => void;
  onOpenGeminiAnalyzer: (docPath: string, page?: string) => void;
}

export const UnifiedFolderView: React.FC<UnifiedFolderViewProps> = ({
  folderId,
  folderName,
  themeColor,
  icon,
  description,
  allRows,
  documents,
  onOpenPdf,
  onOpenMdSync,
  onOpenModal,
  onOpenGeminiAnalyzer,
}) => {
  const styles = themeMap[themeColor] || themeMap.indigo;

  // Filter all rows strictly for this folder (handles single or comma-separated folder_ids without '२.' falsely matching '१२.')
  const folderRows = useMemo(() => {
    return allRows.filter(r => rowBelongsToFolder(r, folderId, folderName));
  }, [allRows, folderId, folderName]);

  // Documents for this folder
  const folderDocs = useMemo(() => {
    return documents.filter(d => {
      if (d.folderId === folderId) return true;
      if (d.folderId) {
        const ids = d.folderId.split(',').map(s => s.trim());
        if (ids.includes(folderId)) return true;
      }
      if (d.folderName === folderName || d.folderName?.startsWith(folderId + ' ')) return true;
      if (folderId === '१.' && (d.filename?.includes('संबिधान') || d.filename?.includes('संविधान') || d.filename?.includes('अपराध संहिता') || d.filename?.includes('देवानी संहिता') || d.filename?.includes('फौजदारी कार्यविधि'))) return true;
      return false;
    });
  }, [documents, folderId, folderName]);

  // Extract all subfolders in this folder
  const subfolders = useMemo(() => {
    const set = new Set<string>();
    folderDocs.forEach(d => {
      if (d.subfolderName && d.subfolderName.trim() !== '') {
        set.add(d.subfolderName);
      }
    });
    return Array.from(set).sort();
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
        if (!curSec.section_id) {
          sectionSpans[s] = { isFirst: true, rowSpan: 1 };
          s++;
          continue;
        }
        const sKey = `${curSec.section_id}__${curSec.title_name || ''}`;
        let sn = s + 1;
        while (sn < j && list[sn].section_id && `${list[sn].section_id}__${list[sn].title_name || ''}` === sKey) {
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
        if (!curA.anusuchi_id) {
          anusuchiSpans[a] = { isFirst: true, rowSpan: 1 };
          a++;
          continue;
        }
        const aKey = `${curA.anusuchi_id}__${curA.anusuchi_title || ''}`;
        let an = a + 1;
        while (an < j && list[an].anusuchi_id && `${list[an].anusuchi_id}__${list[an].anusuchi_title || ''}` === aKey) {
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
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. Hero Header Banner */}
      <div className={`bg-gradient-to-r ${styles.gradient} text-white rounded-2xl p-6 sm:p-8 shadow-xl border ${styles.border}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${styles.badgeBg} ${styles.badgeText} border ${styles.badgeBorder} text-xs font-semibold`}>
                {icon}
                <span>फोल्डर {folderId} • {folderName}</span>
              </span>
              {subfolders.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-xs">
                  <FolderTree className="w-3 h-3 text-slate-400" />
                  <span>{toDevaNum(subfolders.length)} सब-फोल्डरहरू</span>
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <span>{folderName}</span>
              <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                १००% सिङ्क्रोनाइज्ड
              </span>
            </h2>

            <p className="text-slate-300 text-sm max-w-3xl leading-relaxed">
              {description}
            </p>

            {/* 4 Stat Pills */}
            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
              <span className="flex items-center gap-1.5 bg-black/35 px-3 py-1.5 rounded-lg border border-white/10 text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                कुल कागजात: <strong className="text-white">{toDevaNum(folderDocs.length)} PDF</strong> ({Math.round(totalSizeKB).toLocaleString()} KB)
              </span>
              <span className="flex items-center gap-1.5 bg-black/35 px-3 py-1.5 rounded-lg border border-white/10 text-slate-200">
                <Bookmark className="w-4 h-4 text-amber-400" />
                दफा/शीर्षक: <strong className="text-white">{toDevaNum(totalSections)} वटा</strong>
              </span>
              <span className="flex items-center gap-1.5 bg-black/35 px-3 py-1.5 rounded-lg border border-white/10 text-slate-200">
                <Layers className="w-4 h-4 text-purple-400" />
                अनुसूची: <strong className="text-white">{toDevaNum(totalSchedules)} वटा</strong>
              </span>
              <span className="flex items-center gap-1.5 bg-black/35 px-3 py-1.5 rounded-lg border border-white/10 text-slate-200">
                <Columns className={`w-4 h-4 ${styles.iconText}`} />
                कुल १०-स्तम्भ रेकर्ड: <strong className="text-white">{toDevaNum(folderRows.length)} वटा</strong>
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
            <button
              onClick={() => {
                const sampleDoc = folderDocs[0];
                if (sampleDoc) {
                  onOpenGeminiAnalyzer(sampleDoc.path, '१');
                }
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold text-xs shadow-lg shadow-purple-950/40 border border-purple-400/40 transition-all active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>AI हेडर विश्लेषक (Gemini)</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportToExcel(folderRows, `${exportBaseName}.xlsx`)}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl ${styles.exportBtn} text-white font-semibold text-xs transition-all active:scale-95 cursor-pointer border border-white/20`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>
              <button
                onClick={() => exportToCsv(folderRows, `${exportBaseName}.csv`)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-semibold text-xs transition-all active:scale-95 cursor-pointer border border-blue-500/40"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
              <button
                onClick={() => exportToJson(folderRows, `${exportBaseName}.json`)}
                className="inline-flex items-center justify-center px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-all active:scale-95 cursor-pointer border border-slate-700"
                title="Export as JSON"
              >
                <span>JSON</span>
              </button>
            </div>
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
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {toDevaNum(sfDocs.length)} PDF • {toDevaNum(sfRows.length)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. PDF Documents Cards Grid ("clicking it open subfolder and pdfs") */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <FileText className={`w-4 h-4 ${styles.iconText}`} />
            <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
              <span>यस फोल्डरका कागजातहरू ({toDevaNum(folderDocs.length)} वटा मूल PDF हरू)</span>
              {selectedDoc !== 'all' && (
                <span className="ml-2 text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                  (१ कागजात छानिएको छ)
                </span>
              )}
            </h3>
          </div>
          {selectedDoc !== 'all' && (
            <button
              onClick={() => setSelectedDoc('all')}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              सबै कागजातहरू देखाउनुहोस्
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {folderDocs.map((doc, docIdx) => {
            const isSelected = selectedDoc === doc.filename;
            const docRows = folderRows.filter(r => matchesDocName(r.pdf_name, doc.filename));
            const dafaCount = docRows.filter(r => r.section_id && !isAnusuchiRow(r)).length;
            const anusCount = docRows.filter(r => isAnusuchiRow(r)).length;
            const rawUrl = toGitHubRawUrl(doc.path);

            return (
              <div
                key={doc.path}
                onClick={() => handleDocCardClick(doc.filename)}
                className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? `${styles.cardActiveBorder} ${styles.cardActiveBg} ring-2 ${styles.ring} shadow-md`
                    : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50/80 shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60 truncate max-w-[140px]">
                      <FileText className="w-2.5 h-2.5" />
                      {doc.category || 'कागजात'} #{toDevaNum(docIdx + 1)}
                    </span>
                    <span className="text-[10px] font-mono font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {Math.round(doc.size / 1024)} KB
                    </span>
                  </div>

                  <div className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-2 leading-snug mb-1" title={doc.filename}>
                    {doc.filename.replace('.pdf', '')}
                  </div>

                  {doc.subfolderName && (
                    <div className="text-[10px] text-slate-500 font-mono mb-1 truncate">
                      सबफोल्डर: {doc.subfolderName}
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-indigo-900 bg-indigo-100/70 px-2 py-0.5 rounded text-[11px]">
                      {toDevaNum(docRows.length)} रेकर्ड
                    </span>
                    {isSelected && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                        ✓ सक्रिय
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    {onOpenMdSync && (
                      <button
                        onClick={() => onOpenMdSync(doc.filename, '1')}
                        className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-[10px] flex items-center gap-1 transition-colors"
                        title="MD + PDF सिंक हेर्नुहोस्"
                      >
                        <Columns className="w-3 h-3" />
                        <span>MD</span>
                      </button>
                    )}
                    <button
                      onClick={() => onOpenPdf(doc.path, '1')}
                      className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-[10px] flex items-center gap-1 transition-colors"
                      title="PDF हेर्नुहोस्"
                    >
                      <Eye className="w-3 h-3 text-red-600" />
                      <span>PDF</span>
                    </button>
                    <a
                      href={rawUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-800 transition-colors"
                      title="मूल PDF GitHub मा खोल्नुहोस्"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
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
              {folderName}: प्रमाणित १०-स्तम्भ तालिका
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 font-semibold font-mono">
              {toDevaNum(filteredRows.length)} रेकर्डहरू
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
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
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200">
                <th className="py-2.5 px-3 font-bold text-center w-12">क्र.सं.</th>
                <th className="py-2.5 px-3 font-bold w-20">१. फोल्डर</th>
                <th className="py-2.5 px-3 font-bold w-24">२. सबफोल्डर</th>
                <th className="py-2.5 px-3 font-bold w-20">३. दफा ID</th>
                <th className="py-2.5 px-3 font-bold min-w-[200px]">४. दफा शीर्षक</th>
                <th className="py-2.5 px-3 font-bold text-center w-20">५. पेज</th>
                <th className="py-2.5 px-3 font-bold w-24">६. अनुसूची ID</th>
                <th className="py-2.5 px-3 font-bold min-w-[220px]">७. अनुसूची शीर्षक</th>
                <th className="py-2.5 px-3 font-bold text-center w-20">८. प्रिन्ट पेज</th>
                <th className="py-2.5 px-3 font-bold min-w-[160px]">९. कागजात</th>
                <th className="py-2.5 px-3 font-bold text-center w-28">१०. कार्यहरू</th>
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
                      <td className="py-2.5 px-3 text-center text-slate-500 font-mono">
                        {toDevaNum(serialNo)}
                      </td>

                      {/* Column 1: Folder ID (Merged) */}
                      {fSpan?.isFirst && (
                        <td 
                          rowSpan={fSpan.rowSpan}
                          className="py-2.5 px-3 font-mono font-semibold text-slate-800 align-top bg-slate-50/70 border-r border-slate-200"
                        >
                          {row.folder_id}
                        </td>
                      )}

                      {/* Column 2: Subfolder ID (Merged) */}
                      {sfSpan?.isFirst && (
                        <td 
                          rowSpan={sfSpan.rowSpan}
                          className="py-2.5 px-3 font-mono text-slate-600 text-[11px] align-top bg-slate-50/50 border-r border-slate-200"
                        >
                          {row.subfolder_id || '-'}
                        </td>
                      )}

                      {/* Column 3: Section ID (Merged) */}
                      {secSpan?.isFirst && (
                        <td 
                          rowSpan={secSpan.rowSpan}
                          className={`py-2.5 px-3 font-mono font-bold ${styles.titleText} ${secSpan.rowSpan > 1 ? 'align-top bg-slate-50/30' : ''}`}
                        >
                          {row.section_id || '-'}
                        </td>
                      )}

                      {/* Column 4: Title Name (Merged) */}
                      {secSpan?.isFirst && (
                        <td 
                          rowSpan={secSpan.rowSpan}
                          className={`py-2.5 px-3 w-auto max-w-md whitespace-normal break-words font-['Mukta','Noto_Sans_Devanagari',sans-serif] font-semibold text-slate-900 text-xs tracking-wide antialiased leading-relaxed ${secSpan.rowSpan > 1 ? 'align-top bg-slate-50/30' : ''}`}
                        >
                          {row.title_name ? (
                            <span>{row.title_name}</span>
                          ) : (
                            <span className="text-slate-300 italic">-</span>
                          )}
                        </td>
                      )}

                      {/* Column 5: Title Page (Merged) */}
                      {secSpan?.isFirst && (
                        <td 
                          rowSpan={secSpan.rowSpan}
                          className={`py-2.5 px-3 text-center font-mono text-slate-700 ${secSpan.rowSpan > 1 ? 'align-top bg-slate-50/30' : ''}`}
                        >
                          {row.title_page || '-'}
                        </td>
                      )}

                      {/* Column 6: Anusuchi ID (Merged) */}
                      {aSpan?.isFirst && (
                        <td 
                          rowSpan={aSpan.rowSpan}
                          className={`py-2.5 px-3 font-mono font-bold text-purple-700 ${aSpan.rowSpan > 1 ? 'align-top bg-slate-50/30' : ''}`}
                        >
                          {row.anusuchi_id ? (
                            <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[11px]">
                              {row.anusuchi_id}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      )}

                      {/* Column 7: Anusuchi Title (Merged) */}
                      {aSpan?.isFirst && (
                        <td 
                          rowSpan={aSpan.rowSpan}
                          className={`py-2.5 px-3 font-medium text-purple-950 ${aSpan.rowSpan > 1 ? 'align-top bg-slate-50/30' : ''}`}
                        >
                          {row.anusuchi_title ? (
                            <span>{row.anusuchi_title}</span>
                          ) : (
                            <span className="text-slate-300 italic">-</span>
                          )}
                        </td>
                      )}

                      {/* Column 8: Anusuchi Print Page (Merged) */}
                      {aSpan?.isFirst && (
                        <td 
                          rowSpan={aSpan.rowSpan}
                          className={`py-2.5 px-3 text-center font-mono text-purple-800 font-semibold ${aSpan.rowSpan > 1 ? 'align-top bg-slate-50/30' : ''}`}
                        >
                          {row.anusuchi_print_page || '-'}
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
                            onClick={() => onOpenPdf(row.pdf_path, row.anusuchi_print_page || row.title_page || '1')}
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
