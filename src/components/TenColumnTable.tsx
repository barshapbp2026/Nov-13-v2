import React, { useState, useMemo } from 'react';
import {
  Search, Eye, ArrowUpRight, Copy, Check, ChevronDown, ChevronRight,
  Download, FileSpreadsheet, RefreshCw, Folder, Columns3,
  ChevronLeft, ChevronRight as ChevronRightIcon, FileText, Columns, Sparkles
} from 'lucide-react';
import { LegalRow, DocumentSummary } from '../types';
import {
  rowBelongsToFolder,
  matchesDocName,
  isAnusuchiRow,
  compareLegalRows,
  parseDevaInt,
  formatAnusuchiIdOnly,
  formatAnusuchiTitleClean,
  getDisplaySectionId,
  getDisplaySectionTitle,
  getDisplaySectionPage,
} from '../utils/urlUtils';
import { toPhysicalPdfPage } from '../utils/pdfPageMap';
import { devaToNum, toDeva } from '../utils/markdownUtils';
import { FontSizeControls } from './FontSizeControls';

interface TenColumnTableProps {
  rows: LegalRow[];
  documents: DocumentSummary[];
  onOpenModal: (row: LegalRow) => void;
  onOpenPdf: (path: string, page: string, highlightText?: string) => void;
  onOpenMdSync?: (filename: string, page?: string) => void;
  onSummarizePdf?: (path: string, page?: string) => void;
  selectedDocFilter?: string;
  onClearDocFilter?: () => void;
  onExportExcel: (filteredRows: LegalRow[]) => void;
  onExportCsv: (filteredRows: LegalRow[]) => void;
  isAdminOrOwner?: boolean;
}

// Compute row spans for consecutive rows with identical folder_id, folder_name, subfolder_id, subfolder_name, and pdf_name
function computeRowSpans(rowsList: LegalRow[]) {
  const spans: { isFirst: boolean; rowSpan: number }[] = new Array(rowsList.length);
  let i = 0;
  while (i < rowsList.length) {
    const current = rowsList[i];
    const key = `${current.folder_id}__${current.folder_name}__${current.subfolder_id || ''}__${current.subfolder_name || ''}__${current.pdf_name}`;
    let j = i + 1;
    while (
      j < rowsList.length &&
      `${rowsList[j].folder_id}__${rowsList[j].folder_name}__${rowsList[j].subfolder_id || ''}__${rowsList[j].subfolder_name || ''}__${rowsList[j].pdf_name}` === key
    ) {
      j++;
    }
    const count = j - i;
    spans[i] = { isFirst: true, rowSpan: count };
    for (let k = i + 1; k < j; k++) {
      spans[k] = { isFirst: false, rowSpan: 0 };
    }
    i = j;
  }
  return spans;
}

export const TenColumnTable: React.FC<TenColumnTableProps> = ({
  rows,
  documents,
  onOpenModal,
  onOpenPdf,
  onOpenMdSync,
  onSummarizePdf,
  selectedDocFilter,
  onClearDocFilter,
  onExportExcel,
  onExportCsv,
  isAdminOrOwner = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [folderFilter, setFolderFilter] = useState('all');
  const [docFilter, setDocFilter] = useState(selectedDocFilter || 'all');
  const [typeFilter, setTypeFilter] = useState('all');
  
  // View mode: 'folder-grouped' (default as requested) or 'flat-paginated'
  const [viewMode, setViewMode] = useState<'folder-grouped' | 'flat-paginated'>('folder-grouped');
  
  // Sub-columns toggle for Column 6 (धारा, दफा, नियम, निर्देशन, बुँदा)
  const [showSubColumns, setShowSubColumns] = useState(true);

  // Row merge is always enabled across the application
  const mergeIdenticalRows = true;

  // Collapsed state for folder groups
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  // Pagination for flat-paginated mode
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sync external filter changes
  React.useEffect(() => {
    if (selectedDocFilter) {
      setDocFilter(selectedDocFilter);
      setPage(1);
    }
  }, [selectedDocFilter]);

  // Serial sorting for folders (१, २, ३, ४, ५, ८, ९, १०, ११, १२)
  const sortedFolders = useMemo(() => {
    const list = Array.from(new Set(documents.map(d => d.folderName)));
    list.sort((a, b) => parseDevaInt(a) - parseDevaInt(b));
    return list;
  }, [documents]);

  // Map folderName -> folderId from documents for consistent multi-folder filtering
  const folderNameToId = useMemo(() => {
    const map = new Map<string, string>();
    documents.forEach(d => {
      if (d.folderName && d.folderId) {
        map.set(d.folderName, d.folderId);
      }
    });
    return map;
  }, [documents]);

  const filteredDocs = useMemo(() => {
    if (folderFilter === 'all') return documents;
    const targetId = folderNameToId.get(folderFilter) || '';
    return documents.filter(d => {
      if (d.folderName === folderFilter) return true;
      if (targetId && d.folderId) {
        return d.folderId.split(',').map(s => s.trim()).includes(targetId);
      }
      return false;
    });
  }, [documents, folderFilter, folderNameToId]);

  const uniqueDocOptions = useMemo(() => {
    const map = new Map<string, { filename: string; count: number }>();
    filteredDocs.forEach(d => {
      if (!map.has(d.filename)) {
        map.set(d.filename, { filename: d.filename, count: 1 });
      } else {
        map.get(d.filename)!.count++;
      }
    });
    return Array.from(map.values());
  }, [filteredDocs]);

  const hasExactDocMatch = useMemo(() => {
    if (docFilter === 'all') return false;
    return rows.some(r => r.pdf_name === docFilter);
  }, [rows, docFilter]);

  // Filtered rows sorted serially
  const filteredRows = useMemo(() => {
    const res = rows.filter(r => {
      if (folderFilter !== 'all') {
        const targetId = folderNameToId.get(folderFilter) || '';
        if (!rowBelongsToFolder(r, targetId, folderFilter)) return false;
      }
      if (docFilter !== 'all') {
        if (folderFilter === 'all' && hasExactDocMatch) {
          if (r.pdf_name !== docFilter) return false;
        } else if (!matchesDocName(r.pdf_name, docFilter)) {
          return false;
        }
      }
      if (typeFilter !== 'all') {
        if (typeFilter === 'अनुसूची' && !isAnusuchiRow(r) && !r.anusuchi_id) return false;
        if (typeFilter === 'धारा' && r.type !== 'धारा') return false;
        if (typeFilter === 'दफा' && r.type !== 'दफा') return false;
        if (typeFilter === 'संशोधन' && r.type !== 'संशोधन') return false;
        if (typeFilter === 'नियम' && r.type !== 'नियम') return false;
        if (typeFilter === 'निर्देशन' && r.type !== 'निर्देशन') return false;
        if (typeFilter === 'बुँदा' && (r.type !== 'बुँदा' && r.type !== 'महल')) return false;
      }

      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase().trim();
      return (
        r.section_id.toLowerCase().includes(q) ||
        r.title_name.toLowerCase().includes(q) ||
        r.title_page.toLowerCase().includes(q) ||
        r.anusuchi_id.toLowerCase().includes(q) ||
        r.anusuchi_title.toLowerCase().includes(q) ||
        r.anusuchi_print_page.toLowerCase().includes(q) ||
        r.folder_name.toLowerCase().includes(q) ||
        r.subfolder_name.toLowerCase().includes(q) ||
        r.pdf_name.toLowerCase().includes(q)
      );
    });

    // Ensure serial sorting: Folder ID -> Subfolder ID -> PDF numeric prefix -> Sections before Schedules -> Section/Schedule numeric parts
    res.sort(compareLegalRows);

    return res;
  }, [rows, folderFilter, folderNameToId, docFilter, hasExactDocMatch, typeFilter, searchTerm]);

  // Group filtered rows by folder serially for unified master table
  const folderGroupedRows = useMemo(() => {
    const map = new Map<string, LegalRow[]>();
    const foldersToGroup = folderFilter === 'all' ? sortedFolders : [folderFilter];
    foldersToGroup.forEach(fName => {
      const targetId = folderNameToId.get(fName) || '';
      const inFolder = filteredRows.filter(r =>
        folderFilter !== 'all'
          ? rowBelongsToFolder(r, targetId, fName)
          : r.folder_name === fName
      );
      if (inFolder.length > 0) {
        map.set(fName, inFolder);
      }
    });
    return map;
  }, [filteredRows, sortedFolders, folderFilter, folderNameToId]);

  // Flat pagination
  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  // Pre-calculate spans for flat paginated rows
  const flatRowSpans = useMemo(() => {
    return computeRowSpans(paginatedRows);
  }, [paginatedRows]);

  const handleCopyRow = (r: LegalRow, uniqueKey: string) => {
    const secId = getDisplaySectionId(r);
    const secTitle = getDisplaySectionTitle(r);
    const secPage = getDisplaySectionPage(r);
    const anuId = formatAnusuchiIdOnly(r.anusuchi_id);
    const anuTitle = formatAnusuchiTitleClean(r.anusuchi_title);
    const text = `${r.folder_id}\t${r.subfolder_id}\t${r.folder_name}\t${r.subfolder_name}\t${r.pdf_name}\t${r.type}\t${secId}\t${secTitle}\t${secPage}\t${anuId}\t${anuTitle}\t${r.anusuchi_print_page}`;
    navigator.clipboard.writeText(text);
    setCopiedId(uniqueKey);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const toggleFolderCollapse = (fName: string) => {
    setCollapsedFolders(prev => ({
      ...prev,
      [fName]: !prev[fName]
    }));
  };

  const expandAllFolders = () => setCollapsedFolders({});
  const collapseAllFolders = () => {
    const allCollapsed: Record<string, boolean> = {};
    Array.from(folderGroupedRows.keys()).forEach(k => {
      allCollapsed[k] = true;
    });
    setCollapsedFolders(allCollapsed);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setFolderFilter('all');
    setDocFilter('all');
    setTypeFilter('all');
    setPage(1);
    if (onClearDocFilter) onClearDocFilter();
  };


  // Helper to render table row with rowSpan support for merged folder/subfolder/PDF cells
  const renderRow = (
    r: LegalRow, 
    rowKey: string, 
    spanInfo?: { isFirst: boolean; rowSpan: number }
  ) => {
    const isSchedule = isAnusuchiRow(r);
    const shouldMerge = mergeIdenticalRows && spanInfo;
    const displaySectionId = getDisplaySectionId(r);
    const displayTitleName = getDisplaySectionTitle(r);
    const displayTitlePage = getDisplaySectionPage(r);
    const displayAnusuchiId = formatAnusuchiIdOnly(r.anusuchi_id);
    const displayAnusuchiTitle = formatAnusuchiTitleClean(r.anusuchi_title);

    return (
      <tr
        key={rowKey}
        className={`hover:bg-indigo-50/60 transition-colors text-xs ${
          isSchedule ? 'bg-indigo-50/30' : 'bg-white'
        }`}
      >
        {/* Column 1: Folder ID */}
        {(!shouldMerge || spanInfo.isFirst) && (
          <td 
            rowSpan={shouldMerge ? spanInfo.rowSpan : 1}
            className={`p-2.5 text-center border-r border-b border-slate-200 font-bold text-slate-800 whitespace-nowrap ${
              shouldMerge && spanInfo.rowSpan > 1 ? 'align-top bg-slate-50/90 pt-3 shadow-2xs' : ''
            }`}
          >
            <span className="inline-block px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-800 text-xs whitespace-nowrap">
              {r.folder_id}
            </span>
          </td>
        )}

        {/* Column 2: Subfolder ID */}
        {(!shouldMerge || spanInfo.isFirst) && (
          <td 
            rowSpan={shouldMerge ? spanInfo.rowSpan : 1}
            className={`p-2.5 text-center border-r border-b border-slate-200 text-slate-500 font-mono whitespace-nowrap ${
              shouldMerge && spanInfo.rowSpan > 1 ? 'align-top bg-slate-50/60 pt-3' : ''
            }`}
          >
            {r.subfolder_id ? (
              <span className="inline-block px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 font-semibold text-xs border border-blue-200 whitespace-nowrap">
                {r.subfolder_id}
              </span>
            ) : (
              <span className="text-slate-400 italic text-[11px]">-</span>
            )}
          </td>
        )}

        {/* Column 3: Folder Name */}
        {(!shouldMerge || spanInfo.isFirst) && (
          <td 
            rowSpan={shouldMerge ? spanInfo.rowSpan : 1}
            className={`p-2.5 border-r border-b border-slate-200 font-bold text-slate-900 ${
              shouldMerge && spanInfo.rowSpan > 1 ? 'align-top bg-slate-50/90 pt-3 min-w-[130px]' : 'min-w-[120px]'
            }`}
            title={r.folder_name}
          >
            <div className="flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>{r.folder_name}</span>
            </div>
          </td>
        )}

        {/* Column 4: Subfolder Name */}
        {(!shouldMerge || spanInfo.isFirst) && (
          <td 
            rowSpan={shouldMerge ? spanInfo.rowSpan : 1}
            className={`p-2.5 border-r border-b border-slate-200 text-slate-700 ${
              shouldMerge && spanInfo.rowSpan > 1 ? 'align-top bg-slate-50/60 pt-3 min-w-[120px]' : 'min-w-[110px]'
            }`}
            title={r.subfolder_name}
          >
            {r.subfolder_name ? (
              <span className="font-medium text-slate-800">
                {r.subfolder_name}
              </span>
            ) : (
              <span className="text-slate-400 italic text-[11px]">-</span>
            )}
          </td>
        )}

        {/* Column 5: PDF Name (५. PDF Name - User requested: "4. Paxi 5. pdf name rakhnus") */}
        {(!shouldMerge || spanInfo.isFirst) && (
          <td 
            rowSpan={shouldMerge ? spanInfo.rowSpan : 1}
            className={`p-2.5 border-r border-b border-slate-200 font-medium text-slate-900 ${
              shouldMerge && spanInfo.rowSpan > 1 ? 'align-top bg-rose-50/30 pt-3 min-w-[180px]' : 'min-w-[170px]'
            }`}
            title={r.pdf_name}
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-start gap-1.5">
                <FileText className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                <button
                  onClick={() => onOpenPdf(r.pdf_path, r.title_page || r.anusuchi_print_page || '1', r.title_name || r.anusuchi_title)}
                  className="text-left font-semibold text-slate-900 hover:text-red-700 hover:underline leading-snug cursor-pointer transition-colors"
                  title="क्लिक गरी मूल PDF हेर्नुहोस्"
                >
                  {r.pdf_name}
                </button>
              </div>
              {shouldMerge && spanInfo.rowSpan > 1 && (
                <div className="text-[11px] font-medium text-slate-500 tabular-nums">
                  {spanInfo.rowSpan} रेकर्ड
                </div>
              )}
            </div>
          </td>
        )}

        {/* Column 6: धारा/दफा/नियम/निर्देशन/बुँदा ID (Shifted from 5 to 6) */}
        <td className="p-2.5 text-center border-r border-slate-200 font-bold text-amber-700 whitespace-nowrap">
          {displaySectionId || <span className="text-slate-300">-</span>}
        </td>

        {/* Column 7: धारा/दफा/नियम/निर्देशन/बुँदा Title Name (५ उप-स्तम्भ वा १ स्तम्भ) */}
        {showSubColumns ? (
          <>
            <td className={`p-2.5 border-r border-slate-200 w-auto max-w-[240px] whitespace-normal break-words font-['Mukta','Noto_Sans_Devanagari',sans-serif] font-semibold text-xs tracking-wide antialiased leading-relaxed ${r.type === 'धारा' && displayTitleName ? 'bg-amber-50/70 text-amber-950 shadow-2xs' : 'text-slate-300 text-center'}`}>
              {r.type === 'धारा' && displayTitleName ? displayTitleName : '-'}
            </td>
            <td className={`p-2.5 border-r border-slate-200 w-auto max-w-[240px] whitespace-normal break-words font-['Mukta','Noto_Sans_Devanagari',sans-serif] font-semibold text-xs tracking-wide antialiased leading-relaxed ${(r.type === 'दफा' || r.type === 'संशोधन') && displayTitleName ? 'bg-blue-50/70 text-blue-950 shadow-2xs' : 'text-slate-300 text-center'}`}>
              {(r.type === 'दफा' || r.type === 'संशोधन') && displayTitleName ? (
                <>
                  <span>{displayTitleName}</span>
                  {r.type === 'संशोधन' && (
                    <span className="ml-1.5 inline-block px-1.5 py-0.2 rounded text-[9px] font-bold bg-teal-100 text-teal-800 border border-teal-200 align-middle">
                      संशोधन
                    </span>
                  )}
                </>
              ) : '-'}
            </td>
            <td className={`p-2.5 border-r border-slate-200 w-auto max-w-[240px] whitespace-normal break-words font-['Mukta','Noto_Sans_Devanagari',sans-serif] font-semibold text-xs tracking-wide antialiased leading-relaxed ${r.type === 'नियम' && displayTitleName ? 'bg-emerald-50/70 text-emerald-950 shadow-2xs' : 'text-slate-300 text-center'}`}>
              {r.type === 'नियम' && displayTitleName ? displayTitleName : '-'}
            </td>
            <td className={`p-2.5 border-r border-slate-200 w-auto max-w-[240px] whitespace-normal break-words font-['Mukta','Noto_Sans_Devanagari',sans-serif] font-semibold text-xs tracking-wide antialiased leading-relaxed ${r.type === 'निर्देशन' && displayTitleName ? 'bg-purple-50/70 text-purple-950 shadow-2xs' : 'text-slate-300 text-center'}`}>
              {r.type === 'निर्देशन' && displayTitleName ? displayTitleName : '-'}
            </td>
            <td className={`p-2.5 border-r border-slate-200 w-auto max-w-[240px] whitespace-normal break-words font-['Mukta','Noto_Sans_Devanagari',sans-serif] font-semibold text-xs tracking-wide antialiased leading-relaxed ${(r.type === 'बुँदा' || r.type === 'महल') && displayTitleName ? 'bg-rose-50/70 text-rose-950 shadow-2xs' : 'text-slate-300 text-center'}`}>
              {(r.type === 'बुँदा' || r.type === 'महल') && displayTitleName ? displayTitleName : '-'}
            </td>
          </>
        ) : (
          <td className="p-2.5 border-r border-slate-200 w-auto max-w-md whitespace-normal break-words font-['Mukta','Noto_Sans_Devanagari',sans-serif] font-semibold text-slate-900 text-xs tracking-wide antialiased leading-relaxed">
            {displayTitleName ? (
              <>
                <span>{displayTitleName}</span>
                {r.type === 'संशोधन' && (
                  <span className="ml-1.5 inline-block px-1.5 py-0.2 rounded text-[9px] font-bold bg-teal-100 text-teal-800 border border-teal-200 align-middle">
                    संशोधन
                  </span>
                )}
              </>
            ) : <span className="text-slate-300 italic">-</span>}
          </td>
        )}

        {/* Column 8: Title Page (Shifted from 7 to 8) */}
        <td className="p-2.5 text-center border-r border-slate-200 font-bold text-amber-900 whitespace-nowrap">
          {displayTitlePage ? (() => {
            const rawNum = devaToNum(displayTitlePage);
            const physNum = toPhysicalPdfPage(r.pdf_path, rawNum);
            return (
              <button
                onClick={() => onOpenPdf(r.pdf_path, displayTitlePage, displayTitleName)}
                className="px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 transition-colors cursor-pointer text-[11px] whitespace-nowrap"
                title={
                  physNum !== rawNum
                    ? `पुस्तक पृष्ठ ${displayTitlePage} → मूल PDF पृष्ठ ${toDeva(physNum)} मा खोल्नुहोस्`
                    : 'मूल PDF मा यो पृष्ठ खोल्नुहोस्'
                }
              >
                {displayTitlePage}
                {physNum !== rawNum && (
                  <span className="ml-1 text-[9px] text-amber-700 font-normal">(PDF {toDeva(physNum)})</span>
                )}
              </button>
            );
          })() : (
            <span className="text-slate-300">-</span>
          )}
        </td>

        {/* Column 9: अनुसूची ID (Shifted from 8 to 9) */}
        <td className="p-2.5 border-r border-slate-200 font-bold text-indigo-700 whitespace-nowrap">
          {displayAnusuchiId ? (
            <span className="inline-block px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-900 text-[11px] whitespace-nowrap">
              {displayAnusuchiId}
            </span>
          ) : (
            <span className="text-slate-300">-</span>
          )}
        </td>

        {/* Column 10: अनुसूची Title (Shifted from 9 to 10) */}
        <td className="p-2.5 border-r border-slate-200 text-slate-800 text-[11px] leading-snug min-w-[200px]">
          {displayAnusuchiTitle || <span className="text-slate-300">-</span>}
        </td>

        {/* Column 11: अनुसूची Print Page (Shifted from 10 to 11) */}
        <td className="p-2.5 text-center border-r border-slate-200 font-bold text-indigo-900 whitespace-nowrap">
          {r.anusuchi_print_page ? (() => {
            const rawNum = devaToNum(r.anusuchi_print_page);
            const physNum = toPhysicalPdfPage(r.pdf_path, rawNum);
            return (
              <button
                onClick={() => onOpenPdf(r.pdf_path, r.anusuchi_print_page, r.anusuchi_title || displayAnusuchiId)}
                className="px-1.5 py-0.5 rounded bg-indigo-100 hover:bg-indigo-200 text-indigo-900 transition-colors cursor-pointer text-[11px] whitespace-nowrap"
                title={
                  physNum !== rawNum
                    ? `पुस्तक पृष्ठ ${r.anusuchi_print_page} → मूल PDF पृष्ठ ${toDeva(physNum)} मा खोल्नुहोस्`
                    : 'मूल PDF मा अनुसूची पृष्ठ खोल्नुहोस्'
                }
              >
                {r.anusuchi_print_page}
                {physNum !== rawNum && (
                  <span className="ml-1 text-[9px] text-indigo-700 font-normal">(PDF {toDeva(physNum)})</span>
                )}
              </button>
            );
          })() : (
            <span className="text-slate-300">-</span>
          )}
        </td>

        {/* Action buttons */}
        <td className="p-2 text-center whitespace-nowrap">
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={() => onOpenModal(r)}
              className="p-1 rounded bg-slate-100 hover:bg-indigo-100 text-indigo-700 transition-colors cursor-pointer"
              title="मास्टर मोडलमा हेर्नुहोस्"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            {onOpenMdSync && (
              <button
                onClick={() => onOpenMdSync(r.pdf_name, r.title_page || r.anusuchi_print_page || '1')}
                className="p-1 rounded bg-slate-100 hover:bg-indigo-100 text-indigo-600 transition-colors cursor-pointer"
                title="MD + PDF सिंकमा हेर्नुहोस्"
              >
                <Columns className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => handleCopyRow(r, rowKey)}
              className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
              title="यो पंक्ति कपि गर्नुहोस्"
            >
              {copiedId === rowKey ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
            {onSummarizePdf && (
              <button
                onClick={() => onSummarizePdf(r.pdf_path, r.title_page || r.anusuchi_print_page || '1')}
                className="p-1 rounded bg-slate-100 hover:bg-emerald-100 text-emerald-700 transition-colors cursor-pointer"
                title="यस PDF वा पृष्ठको AI सारांश"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => onOpenPdf(r.pdf_path, r.title_page || r.anusuchi_print_page || '1', r.title_name || r.anusuchi_title)}
              className="p-1 rounded bg-slate-100 hover:bg-red-100 text-red-700 transition-colors cursor-pointer"
              title="PDF खोल्नुहोस्"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const totalTableColumns = showSubColumns ? 16 : 12;

  return (
    <div className="space-y-4">
      {/* Top Folder Quick-Jump Pills (Strictly Serially Ordered: १ देखि १२ सम्म) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <Folder className="w-3.5 h-3.5 text-indigo-600" />
            Folder ID सेरियल्ली (१ देखि १२ सम्म क्रमबद्ध):
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline text-slate-400 font-normal normal-case">
              कुनै फोल्डरमा क्लिक गरी सिधै फिल्टर गर्नुहोस्
            </span>
            <FontSizeControls variant="light" />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => { setFolderFilter('all'); setDocFilter('all'); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              folderFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            सबै फोल्डरहरू (All)
          </button>
          {sortedFolders.map(f => {
            const targetId = folderNameToId.get(f) || '';
            const count = rows.filter(r => rowBelongsToFolder(r, targetId, f)).length;
            const isSelected = folderFilter === f;
            return (
              <button
                key={f}
                onClick={() => {
                  setFolderFilter(isSelected ? 'all' : f);
                  setDocFilter('all');
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{f}</span>
                <span className={`text-[11px] font-mono tabular-nums ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search, Filter & View Controls */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="धारा, दफा, नियम, निर्देशन, बुँदा, अनुसूची वा पृष्ठ खोज्नुहोस्..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-sm"
            />
          </div>

          {/* View Toggles & Exports */}
          <div className="flex items-center gap-2 flex-wrap self-end lg:self-auto shrink-0">

            {/* Sub-columns toggle */}
            <button
              onClick={() => setShowSubColumns(!showSubColumns)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                showSubColumns 
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-bold' 
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
              title="७. Title मा ५ वटा Sub-columns (धारा/दफा/नियम/निर्देशन/बुँदा) देखाउने वा लुकाउने"
            >
              <Columns3 className="w-3.5 h-3.5" />
              <span>{showSubColumns ? '७. उप-स्तम्भहरू: अन (५ Sub-columns)' : '७. एकल स्तम्भ'}</span>
            </button>

            {/* Folder-wise vs Flat toggle */}
            <div className="bg-slate-100 p-0.5 rounded-lg flex items-center border border-slate-200 text-xs">
              <button
                onClick={() => setViewMode('folder-grouped')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  viewMode === 'folder-grouped'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                फोल्डर अनुसार तालिका
              </button>
              <button
                onClick={() => setViewMode('flat-paginated')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  viewMode === 'flat-paginated'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                निरन्तर तालिका
              </button>
            </div>

            {/* Exports (Owner/Admin only) */}
            {isAdminOrOwner && (
              <>
                <button
                  onClick={() => onExportExcel(filteredRows)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
                  title="सबै ५ उप-स्तम्भहरू सहित Excel मा डाउनलोड"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Excel</span>
                </button>
                <button
                  onClick={() => onExportCsv(filteredRows)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                  title="सबै ५ उप-स्तम्भहरू सहित CSV मा डाउनलोड"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
              </>
            )}
            {(folderFilter !== 'all' || docFilter !== 'all' || typeFilter !== 'all' || searchTerm) && (
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                title="सबै फिल्टरहरू हटाउनुहोस्"
              >
                <RefreshCw className="w-3 h-3" />
                <span>रिसेट</span>
              </button>
            )}
          </div>
        </div>

        {/* Dropdown Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 text-xs">
          {/* Folder filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              १. फोल्डर छान्नुहोस् ({sortedFolders.length} वटा - सेरियल्ली)
            </label>
            <select
              value={folderFilter}
              onChange={e => {
                setFolderFilter(e.target.value);
                setDocFilter('all');
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">सबै फोल्डरहरू (All Folders)</option>
              {sortedFolders.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* PDF document filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              २. PDF कागजात छान्नुहोस् ({uniqueDocOptions.length} वटा)
            </label>
            <select
              value={docFilter}
              onChange={e => { setDocFilter(e.target.value); setPage(1); }}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-indigo-500 truncate"
            >
              <option value="all">सबै PDF कागजातहरू ({uniqueDocOptions.length} वटा)</option>
              {uniqueDocOptions.map(d => (
                <option key={d.filename} value={d.filename}>
                  {d.filename} {d.count > 1 && folderFilter === 'all' ? `(${d.count} फोल्डरमा)` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Type filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              ३. किसिम / प्रकार छान्नुहोस्
            </label>
            <select
              value={typeFilter}
              onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">सबै प्रकार (All Types)</option>
              <option value="धारा">धारा (संविधानका ३०८ धारा)</option>
              <option value="दफा">दफा (ऐन तथा गठन आदेशका दफाहरू)</option>
              <option value="संशोधन">संशोधन (अध्यादेशका संशोधन दफाहरू)</option>
              <option value="नियम">नियम (नियमावलीका नियमहरू)</option>
              <option value="निर्देशन">निर्देशन (निर्देशिकाका निर्देशहरू)</option>
              <option value="बुँदा">बुँदा (मापदण्ड, कार्यविधि, महल)</option>
              <option value="अनुसूची">अनुसूची (सबै अनुसूचीहरू)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Active Document Filter Quick Banner */}
      {docFilter !== 'all' && (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-slate-500">फिल्टर गरिएको PDF कागजात:</div>
              <div className="font-bold text-slate-900 text-sm">{docFilter}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {onSummarizePdf && (() => {
              const targetPath =
                filteredRows[0]?.pdf_path ||
                documents.find(d => d.filename === docFilter)?.path;
              if (!targetPath) return null;
              return (
                <button
                  onClick={() => onSummarizePdf(targetPath)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                  title="यस PDF कागजातको Gemini AI सारांश तयार गर्नुहोस्"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                  <span>AI PDF सारांश</span>
                </button>
              );
            })()}
            {onOpenMdSync && (
              <button
                onClick={() => onOpenMdSync(docFilter, '1')}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                title="यस कागजातलाई Markdown र PDF सँगै हेर्नुहोस्"
              >
                <span>MD रिडर र PDF सिंकमा खोल्नुहोस्</span>
              </button>
            )}
            <button
              onClick={() => {
                setDocFilter('all');
                if (onClearDocFilter) onClearDocFilter();
              }}
              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition-colors cursor-pointer"
            >
              फिल्टर हटाउनुहोस्
            </button>
          </div>
        </div>
      )}

      {/* Main Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table summary bar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 tabular-nums">
              कुल {filteredRows.length.toLocaleString('ne-NP')} रेकर्ड
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-600 font-medium">
              {viewMode === 'folder-grouped' 
                ? `${folderGroupedRows.size} फोल्डरमा विभाजित` 
                : `पृष्ठ ${page} / ${totalPages}`}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {viewMode === 'folder-grouped' ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={expandAllFolders}
                  className="px-2 py-1 rounded bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] cursor-pointer"
                >
                  सबै खोल्नुहोस्
                </button>
                <button
                  onClick={collapseAllFolders}
                  className="px-2 py-1 rounded bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] cursor-pointer"
                >
                  सबै बन्द गर्नुहोस्
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs">
                <span>प्रति पृष्ठ:</span>
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs"
                >
                  <option value={50}>५०</option>
                  <option value={100}>१००</option>
                  <option value={200}>२००</option>
                </select>
              </div>
            )}
            <FontSizeControls variant="light" />
          </div>
        </div>

        {/* Master Table with multi-level header */}
        <div className="overflow-x-auto max-h-[720px] overflow-y-auto">
          <table className="min-w-full text-xs text-left border-collapse">
            {/* Multi-level Table Header */}
            <thead className="bg-slate-900 text-white font-semibold sticky top-0 z-20 text-[11px] shadow-sm">
              {/* Row 1: Main Column Headers (५. PDF Name inserted, ६-११ shifted) */}
              <tr className="h-[38px]">
                <th rowSpan={showSubColumns ? 2 : 1} className="p-2 text-center w-14 border-r border-slate-800 bg-slate-900 align-middle whitespace-nowrap">
                  १. Folder ID
                </th>
                <th rowSpan={showSubColumns ? 2 : 1} className="p-2 text-center w-16 border-r border-slate-800 bg-slate-900 align-middle whitespace-nowrap">
                  २. Subfolder ID
                </th>
                <th rowSpan={showSubColumns ? 2 : 1} className="p-2 border-r border-slate-800 min-w-[130px] bg-slate-900 align-middle whitespace-nowrap">
                  ३. Folder Name
                </th>
                <th rowSpan={showSubColumns ? 2 : 1} className="p-2 border-r border-slate-800 min-w-[120px] bg-slate-900 align-middle whitespace-nowrap">
                  ४. Subfolder Name
                </th>
                <th rowSpan={showSubColumns ? 2 : 1} className="p-2 border-r border-slate-800 min-w-[180px] bg-rose-950 text-rose-200 align-middle font-bold whitespace-nowrap">
                  ५. PDF Name
                </th>
                <th rowSpan={showSubColumns ? 2 : 1} className="p-2 text-center border-r border-slate-800 w-20 bg-slate-900 align-middle whitespace-nowrap">
                  ६. ID
                </th>

                {/* Column 7 Header: Span 5 if sub-columns are enabled! */}
                {showSubColumns ? (
                  <th colSpan={5} className="px-2 py-1.5 text-center border-r border-slate-800 bg-indigo-950 text-indigo-200 font-bold h-[38px] whitespace-nowrap">
                    ७. धारा/दफा/नियम/निर्देशन/बुँदा Title Name (५ वटा उप-स्तम्भहरू)
                  </th>
                ) : (
                  <th className="p-2 border-r border-slate-800 min-w-[220px] bg-slate-900 align-middle whitespace-nowrap">
                    ७. Title Name
                  </th>
                )}

                <th rowSpan={showSubColumns ? 2 : 1} className="p-2 text-center border-r border-slate-800 w-16 bg-slate-900 align-middle whitespace-nowrap">
                  ८. Title Page
                </th>
                <th rowSpan={showSubColumns ? 2 : 1} className="p-2 border-r border-slate-800 w-24 bg-slate-900 align-middle whitespace-nowrap">
                  ९. अनुसूची ID
                </th>
                <th rowSpan={showSubColumns ? 2 : 1} className="p-2 border-r border-slate-800 min-w-[200px] bg-slate-900 align-middle whitespace-nowrap">
                  १०. अनुसूची Title
                </th>
                <th rowSpan={showSubColumns ? 2 : 1} className="p-2 text-center border-r border-slate-800 w-20 bg-slate-900 align-middle whitespace-nowrap">
                  ११. अनुसूची Page
                </th>
                <th rowSpan={showSubColumns ? 2 : 1} className="p-2 text-center w-28 bg-slate-900 align-middle whitespace-nowrap">
                  कार्यहरू
                </th>
              </tr>

              {/* Row 2: The 5 Sub-columns for Column 7 */}
              {showSubColumns && (
                <tr className="bg-slate-800 text-[10px] uppercase font-bold text-slate-200 border-t border-slate-700 h-[34px]">
                  <th className="p-1.5 text-center border-r border-slate-700 bg-amber-950/80 text-amber-300 min-w-[160px] whitespace-nowrap">
                    ७.१ धारा (Dhara)
                  </th>
                  <th className="p-1.5 text-center border-r border-slate-700 bg-blue-950/80 text-blue-300 min-w-[160px] whitespace-nowrap">
                    ७.२ दफा / संशोधन
                  </th>
                  <th className="p-1.5 text-center border-r border-slate-700 bg-emerald-950/80 text-emerald-300 min-w-[160px] whitespace-nowrap">
                    ७.३ नियम (Niyam)
                  </th>
                  <th className="p-1.5 text-center border-r border-slate-700 bg-purple-950/80 text-purple-300 min-w-[160px] whitespace-nowrap">
                    ७.४ निर्देशन (Nirdeshan)
                  </th>
                  <th className="p-1.5 text-center border-r border-slate-700 bg-rose-950/80 text-rose-300 min-w-[160px] whitespace-nowrap">
                    ७.५ बुँदा (Bunda)
                  </th>
                </tr>
              )}
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-200 font-sans">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={totalTableColumns} className="p-10 text-center text-slate-400 italic">
                    कुनै डेटा फेला परेन। कृपया खोज शब्द वा फिल्टर परिवर्तन गर्नुहोस्।
                  </td>
                </tr>
              ) : viewMode === 'folder-grouped' ? (
                /* FOLDER-WISE GROUPED UNIFIED TABLE ("sabai folder wise eutai table") */
                Array.from(folderGroupedRows.entries()).map(([fName, fRows]) => {
                  const isCollapsed = !!collapsedFolders[fName];
                  const targetFolderId = folderNameToId.get(fName) || '';
                  const folderId = targetFolderId || fRows[0]?.folder_id || '';
                  const uniquePdfsInFolder = Array.from(new Set(fRows.map(r => r.pdf_name))).length;
                  const sharedTotalCount = folderFilter === 'all'
                    ? rows.filter(r => rowBelongsToFolder(r, targetFolderId, fName)).length
                    : fRows.length;
                  // Compute row spans specifically inside this folder group
                  const folderSpans = computeRowSpans(fRows);

                  return (
                    <React.Fragment key={`folder-group-${fName}`}>
                      {/* Folder Group Header Row */}
                      <tr className={`bg-gradient-to-r from-slate-800 via-indigo-950 to-slate-800 text-white font-bold sticky z-10 border-y-2 border-indigo-500/50 ${showSubColumns ? 'top-[72px]' : 'top-[38px]'}`}>
                        <td colSpan={totalTableColumns} className="p-2.5 px-4">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <button
                              onClick={() => toggleFolderCollapse(fName)}
                              className="flex items-center gap-2 hover:text-amber-300 transition-colors cursor-pointer text-left"
                            >
                              {isCollapsed ? (
                                <ChevronRight className="w-4 h-4 text-amber-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-amber-400" />
                              )}
                              <span className="px-1.5 min-w-[24px] h-6 rounded bg-amber-500 text-slate-950 flex items-center justify-center text-xs font-bold shrink-0 whitespace-nowrap">
                                {folderId || '📁'}
                              </span>
                              <span className="text-sm font-bold text-white tracking-wide">
                                फोल्डर: {fName}
                              </span>
                              <span className="text-xs font-normal text-slate-300 tabular-nums">
                                · {fRows.length} रेकर्ड · {uniquePdfsInFolder} PDF
                              </span>
                              {folderFilter === 'all' && sharedTotalCount > fRows.length && (
                                <span className="text-[11px] font-normal text-amber-300">
                                  (साझा सहित {sharedTotalCount})
                                </span>
                              )}
                            </button>

                            <span className="text-[11px] text-slate-400 hidden sm:inline-block">
                              {isCollapsed ? 'क्लिक गरी खोल्नुहोस्' : 'क्लिक गरी संकुचित गर्नुहोस्'}
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* Folder Rows (with merged cells when enabled) */}
                      {!isCollapsed &&
                        fRows.map((r, rIdx) => {
                          const rowKey = `m-${r.folder_id}-${r.subfolder_id || '0'}-${r.pdf_name}-${r.section_id || 'sec'}-${r.anusuchi_id || 'sch'}-${rIdx}`;
                          return renderRow(r, rowKey, folderSpans[rIdx]);
                        })}
                    </React.Fragment>
                  );
                })
              ) : (
                /* FLAT PAGINATED TABLE */
                paginatedRows.map((r, idx) => {
                  const rowKey = `m-flat-${r.folder_id}-${r.subfolder_id || '0'}-${r.pdf_name}-${r.section_id || 'sec'}-${r.anusuchi_id || 'sch'}-${(page - 1) * pageSize + idx}`;
                  return renderRow(r, rowKey, flatRowSpans[idx]);
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info & pagination (in flat-paginated mode) */}
        {viewMode === 'flat-paginated' && (
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-slate-500">
              देखाउँदै: {(page - 1) * pageSize + 1} देखि {Math.min(page * pageSize, filteredRows.length)} सम्म (जम्मा: {filteredRows.length})
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer text-xs"
              >
                पहिलो
              </button>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 py-1 font-semibold text-slate-800">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer text-xs"
              >
                अन्तिम
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
