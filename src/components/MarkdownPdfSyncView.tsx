import React, { useState, useMemo, useRef, useEffect } from 'react';
import { marked } from 'marked';
import {
  BookOpen,
  FileText,
  Search,
  ExternalLink,
  Download,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns,
  Maximize2,
  Minimize2,
  X,
  ArrowRight,
  RefreshCw,
  Upload,
  Bookmark,
  FileCode,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { LegalRow, DocumentSummary, StoredDafaSummaryRecord } from '../types';
import { generateMarkdownForDoc, toDeva, devaToNum, LegalMarkdownDoc } from '../utils/markdownUtils';
import { toGitHubRawUrl, toGitHubBlobUrl } from '../utils/urlUtils';
import { PdfCanvasViewer } from './PdfCanvasViewer';
import { FontSizeControls } from './FontSizeControls';
import {
  formatDualPageLabel,
  getPdfPageCalibration,
  getPrintedBookPageInfo,
  resetUserPdfPageOffset,
  setUserPdfPageOffset,
  toPhysicalPdfPage,
} from '../utils/pdfPageMap';

interface MarkdownPdfSyncViewProps {
  documents: DocumentSummary[];
  allRows: LegalRow[];
  initialDocFilename?: string;
  initialPage?: string;
  suspended?: boolean;
  isAdminOrOwner?: boolean;
  cachedDafaMap?: Map<string, StoredDafaSummaryRecord>;
  onOpen10ColumnTable?: (filename: string) => void;
  onSummarizePdf?: (path: string, page?: string) => void;
}

export const MarkdownPdfSyncView: React.FC<MarkdownPdfSyncViewProps> = ({
  documents,
  allRows,
  initialDocFilename,
  initialPage = '1',
  suspended = false,
  isAdminOrOwner = false,
  cachedDafaMap,
  onOpen10ColumnTable,
  onSummarizePdf,
}) => {
  // Available documents
  const sortedDocs = useMemo(() => {
    return [...documents].sort((a, b) => a.path.localeCompare(b.path));
  }, [documents]);

  // Selected document
  const [selectedDocPath, setSelectedDocPath] = useState<string>(() => {
    if (initialDocFilename) {
      const match = documents.find(d => d.filename === initialDocFilename || d.path.includes(initialDocFilename));
      if (match) return match.path;
    }
    // Default to Constitution
    const constDoc = documents.find(d => d.filename.includes('संबिधान') || d.filename.includes('संविधान'));
    return constDoc ? constDoc.path : (documents[0]?.path || '');
  });

  const activeDoc = useMemo(() => {
    return documents.find(d => d.path === selectedDocPath) || documents[0];
  }, [documents, selectedDocPath]);

  // Custom uploaded/edited markdown override (if user uploads their own .md)
  const [customMdContent, setCustomMdContent] = useState<string | null>(null);
  const [customMdTitle, setCustomMdTitle] = useState<string>('');

  // Generated legal markdown document
  const generatedDoc: LegalMarkdownDoc | null = useMemo(() => {
    if (!activeDoc) return null;
    return generateMarkdownForDoc(activeDoc, allRows, cachedDafaMap);
  }, [activeDoc, allRows, cachedDafaMap]);

  // Active markdown text
  const currentMarkdown = customMdContent !== null ? customMdContent : (generatedDoc?.markdownContent || '');
  const currentDocTitle = customMdTitle || generatedDoc?.title || activeDoc?.filename || 'कानूनी दस्तावेज';

  // Synchronized state (syncedPage is ALWAYS the physical 1-based PDF page)
  const [syncedPage, setSyncedPage] = useState<number>(() =>
    toPhysicalPdfPage(selectedDocPath, devaToNum(initialPage) || 1)
  );
  const [syncedDataPage, setSyncedDataPage] = useState<number | null>(() =>
    initialPage ? devaToNum(initialPage) : null
  );
  const [offsetVersion, setOffsetVersion] = useState<number>(0);
  const [totalPdfPages, setTotalPdfPages] = useState<number>(0);
  const [syncedSectionTitle, setSyncedSectionTitle] = useState<string>('');
  const [syncedHighlightQuery, setSyncedHighlightQuery] = useState<string>('');
  const [miniPdfOpen, setMiniPdfOpen] = useState<boolean>(false);
  const [miniPdfExpanded, setMiniPdfExpanded] = useState<boolean>(false);
  const [isDesktopLg, setIsDesktopLg] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  
  // Layout view mode: 'split' | 'md-only' | 'pdf-only'
  const [viewMode, setViewMode] = useState<'split' | 'md-only' | 'pdf-only'>('split');
  
  // Reading theme: 'light' | 'dark' | 'sepia'
  const [readingTheme, setReadingTheme] = useState<'light' | 'dark' | 'sepia'>('light');
  
  // Font size multiplier
  const [fontSizeLevel, setFontSizeLevel] = useState<number>(1); // 0=sm, 1=base, 2=lg, 3=xl

  // Sidebar / TOC state
  const [showToc, setShowToc] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // File upload input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mdContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsDesktopLg(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // When initialDocFilename changes from parent
  useEffect(() => {
    if (initialDocFilename) {
      const match = documents.find(d => d.filename === initialDocFilename || d.path.includes(initialDocFilename));
      if (match) {
        setSelectedDocPath(match.path);
        setCustomMdContent(null);
      }
    }
  }, [initialDocFilename, documents]);

  useEffect(() => {
    if (initialPage) {
      const targetDoc =
        (initialDocFilename &&
          documents.find(d => d.filename === initialDocFilename || d.path.includes(initialDocFilename))) ||
        activeDoc;
      const targetPath = targetDoc?.path || selectedDocPath;
      const dp = devaToNum(initialPage);
      setSyncedDataPage(dp);
      setSyncedPage(toPhysicalPdfPage(targetPath, dp));
    }
  }, [initialPage, initialDocFilename]);

  // Handle section sync trigger from Markdown (converts data/printed page -> exact physical PDF page)
  const handleSyncToPage = (
    pageNum: number | string,
    sectionLabel?: string,
    openMiniWindow: boolean = false,
    highlightHint?: string
  ) => {
    const dataPageNum = devaToNum(pageNum);
    const physicalPage = toPhysicalPdfPage(
      activeDoc?.path || selectedDocPath,
      dataPageNum,
      totalPdfPages > 0 ? totalPdfPages : undefined
    );
    setSyncedDataPage(dataPageNum);
    setSyncedPage(physicalPage);
    if (sectionLabel) {
      setSyncedSectionTitle(sectionLabel);
    }
    setSyncedHighlightQuery(highlightHint || sectionLabel || '');
    if (openMiniWindow) {
      setMiniPdfOpen(true);
    }
  };

  // Convert markdown to HTML with interactive custom click handlers
  const parsedHtml = useMemo(() => {
    marked.setOptions({
      gfm: true,
      breaks: true,
    });

    let raw = marked.parse(currentMarkdown) as string;

    // Transform sync://<page>?q=<hint> URLs into interactive click attributes (safely decoding any percent-encoded numerals)
    raw = raw.replace(/href="sync:\/\/([^"]+)"/g, (_, targetStr: string) => {
      const [rawPagePart, queryPart] = targetStr.split('?');
      let decodedPage = rawPagePart || '1';
      try {
        decodedPage = decodeURIComponent(decodedPage);
      } catch {
        // fallback to raw
      }
      const normalizedPage = String(devaToNum(decodedPage));
      let hint = '';
      if (queryPart) {
        try {
          const params = new URLSearchParams(queryPart);
          hint = params.get('q') || '';
        } catch {
          hint = '';
        }
      }
      const escapedHint = hint.replace(/"/g, '&quot;');
      return `href="#sync-page" data-sync-page="${normalizedPage}" data-sync-query="${escapedHint}" class="sync-page-btn"`;
    });

    return raw;
  }, [currentMarkdown]);

  // Attach click listener for dynamically rendered sync-page-btn links
  useEffect(() => {
    const container = mdContainerRef.current;
    if (!container) return;

    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('[data-sync-page]') as HTMLElement | null;
      if (target) {
        e.preventDefault();
        const pageAttr = target.getAttribute('data-sync-page');
        const queryAttr = target.getAttribute('data-sync-query') || '';

        // Mark clicked button in red inside Markdown view
        container.querySelectorAll('.sync-page-btn-active').forEach(el => {
          el.classList.remove('sync-page-btn-active');
        });
        target.classList.add('sync-page-btn-active');

        if (pageAttr) {
          let label = queryAttr;
          if (!label) {
            const tableEl = target.closest('table');
            let prev = tableEl?.previousElementSibling;
            while (prev && !/^H[1-6]$/.test(prev.tagName)) {
              prev = prev.previousElementSibling;
            }
            label = prev?.textContent || target.closest('h1, h2, h3, h4, tr')?.textContent || '';
          }
          handleSyncToPage(pageAttr, label.slice(0, 60), true, queryAttr || label);
        }
      }
    };

    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [parsedHtml]);

  // Copy Markdown
  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(currentMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  // Download Markdown file
  const handleDownloadMarkdown = () => {
    const blob = new Blob([currentMarkdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentDocTitle.replace(/[^a-zA-Z0-9०-९\-_]/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle local MD file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const text = event.target?.result as string;
      if (text) {
        setCustomMdContent(text);
        setCustomMdTitle(file.name.replace(/\.md$/i, ''));
      }
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  };

  // Filter TOC based on search
  const filteredToc = useMemo(() => {
    if (!generatedDoc?.toc) return [];
    if (!searchQuery.trim()) return generatedDoc.toc;
    const q = searchQuery.toLowerCase().trim();
    return generatedDoc.toc.filter(item =>
      item.title.toLowerCase().includes(q) ||
      item.page.includes(q) ||
      toDeva(item.page).includes(q)
    );
  }, [generatedDoc, searchQuery]);

  // PDF URLs & Calibration
  const pdfRelativePath = activeDoc?.path || '';
  const localProxyUrl = `/api/pdf-proxy?path=${encodeURIComponent(pdfRelativePath)}`;
  const rawGitHubUrl = isAdminOrOwner ? toGitHubRawUrl(pdfRelativePath) : '';
  const githubRepoUrl = isAdminOrOwner ? toGitHubBlobUrl(pdfRelativePath) : '';

  const activeCalibration = useMemo(
    () => getPdfPageCalibration(pdfRelativePath),
    [pdfRelativePath, offsetVersion]
  );

  const printedBookInfo = useMemo(
    () => getPrintedBookPageInfo(pdfRelativePath, syncedPage),
    [pdfRelativePath, syncedPage, offsetVersion]
  );

  const handleAdjustOffset = (delta: number) => {
    if (!pdfRelativePath) return;
    const nextOffset = activeCalibration.effectivePhysicalOffset + delta;
    setUserPdfPageOffset(pdfRelativePath, nextOffset);
    setOffsetVersion(v => v + 1);
    setSyncedPage(p => {
      const next = Math.max(1, p + delta);
      return totalPdfPages > 0 ? Math.min(totalPdfPages, next) : next;
    });
  };

  const handleResetOffset = () => {
    if (!pdfRelativePath) return;
    const prevEffective = activeCalibration.effectivePhysicalOffset;
    resetUserPdfPageOffset(pdfRelativePath);
    const restored = getPdfPageCalibration(pdfRelativePath);
    const diff = restored.effectivePhysicalOffset - prevEffective;
    setOffsetVersion(v => v + 1);
    if (diff !== 0) {
      setSyncedPage(p => {
        const next = Math.max(1, p + diff);
        return totalPdfPages > 0 ? Math.min(totalPdfPages, next) : next;
      });
    }
  };

  // Theme classes
  const themeClasses = {
    light: 'bg-white text-slate-800 border-slate-200',
    dark: 'bg-slate-900 text-slate-100 border-slate-800',
    sepia: 'bg-[#faf6eb] text-[#3d3224] border-[#e8dfc7]',
  }[readingTheme];

  const themeInnerClasses = {
    light: 'md-light',
    dark: 'md-dark',
    sepia: 'md-sepia',
  }[readingTheme];

  const fontSizes = ['text-xs sm:text-sm', 'text-sm sm:text-base', 'text-base sm:text-lg', 'text-lg sm:text-xl'];

  return (
    <div className="space-y-4">
      {/* Hidden file input for uploading custom markdown */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".md,.markdown,.txt"
        className="hidden"
      />

      {/* Main Control Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 flex-1 min-w-0">
            {/* Title and Repo info */}
            <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm">
                <BookOpen className="w-3.5 h-3.5" />
                MD रिडर र PDF सिंक (Dual View)
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-1">
                <RefreshCw className="w-3 h-3 text-emerald-600 animate-spin-slow" />
                {formatDualPageLabel(pdfRelativePath, syncedPage, totalPdfPages)}
              </span>
              {customMdContent !== null && (
                <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 text-xs font-medium flex items-center gap-1">
                  <FileCode className="w-3 h-3" />
                  कस्टम MD मोड सक्रिय
                </span>
              )}
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span>{currentDocTitle}</span>
            </h2>
            <p className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
              <span>मूल PDF: <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded font-mono text-[11px]">{activeDoc?.filename}</code></span>
              {isAdminOrOwner && (
                <>
                  <span>•</span>
                  <span>स्रोत: <a href={githubRepoUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">barshapbp2026/any-pdf-</a></span>
                </>
              )}
            </p>
          </div>

          {/* Quick Actions & View Mode Toggles */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Switcher */}
            <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200 text-xs">
              <button
                onClick={() => setViewMode('split')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'split' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="दुवै (Markdown + PDF) सँगै हेर्नुहोस्"
              >
                <Columns className="w-3.5 h-3.5" />
                <span>५०:५० स्प्लिट</span>
              </button>
              <button
                onClick={() => setViewMode('md-only')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'md-only' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="केवल Markdown कागजात पढ्नुहोस्"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>MD मात्र</span>
              </button>
              <button
                onClick={() => setViewMode('pdf-only')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'pdf-only' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="केवल मूल PDF हेर्नुहोस्"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>PDF मात्र</span>
              </button>
              <button
                type="button"
                onClick={() => setMiniPdfOpen(prev => !prev)}
                className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  miniPdfOpen
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-red-700 hover:bg-red-50'
                }`}
                title="सानो फ्लोटिङ PDF विन्डो खोल्नुहोस् / बन्द गर्नुहोस्"
              >
                <span>सानो PDF</span>
              </button>
            </div>

            {/* Document selector dropdown */}
            <select
              value={selectedDocPath}
              onChange={e => {
                setSelectedDocPath(e.target.value);
                setCustomMdContent(null);
                setSyncedPage(1);
                setSyncedDataPage(null);
                setTotalPdfPages(0);
                setSyncedHighlightQuery('');
                setSyncedSectionTitle('');
              }}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:border-indigo-500 max-w-xs truncate"
            >
              {sortedDocs.map(doc => (
                <option key={doc.path} value={doc.path}>
                  {doc.folderName} - {doc.filename}
                </option>
              ))}
            </select>

            {/* Upload Custom MD */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              title="कम्प्युटरबाट आफ्नो .md फाइल लोड गर्नुहोस्"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">MD फाइल अपलोड</span>
            </button>

            {/* Reset to Generated MD if custom was uploaded */}
            {customMdContent !== null && (
              <button
                onClick={() => setCustomMdContent(null)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                title="पूर्वनिर्धारित कानूनी MD मा फर्कनुहोस्"
              >
                <RotateCcw className="w-3 h-3" />
                <span>रिसेट</span>
              </button>
            )}

            {/* Export / Copy */}
            <button
              onClick={handleCopyMarkdown}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              title="Markdown क्लिपबोर्डमा कपी गर्नुहोस्"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'कपी भयो!' : 'कपी MD'}</span>
            </button>

            {isAdminOrOwner && (
              <button
                onClick={handleDownloadMarkdown}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors cursor-pointer"
                title="डाउनलोड .md फाइल"
              >
                <Download className="w-3.5 h-3.5" />
                <span>.md डाउनलोड</span>
              </button>
            )}

            {onSummarizePdf && activeDoc && (
              <button
                onClick={() => onSummarizePdf(activeDoc.path, String(syncedPage))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
                title="यस कागजात वा हालको पृष्ठको Gemini AI सारांश निकाल्नुहोस्"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                <span>AI सारांश</span>
              </button>
            )}

            {onOpen10ColumnTable && activeDoc && (
              <button
                onClick={() => onOpen10ColumnTable(activeDoc.filename)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer"
                title="यस कागजातको १०-स्तम्भ तालिका खोल्नुहोस्"
              >
                <span>१०-स्तम्भ तालिका</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
          </div>
          <FontSizeControls variant="light" className="mt-0.5" />
        </div>

        {/* Second row: Reading Preference Bar */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            {/* Theme switcher */}
            <div className="flex items-center gap-1">
              <span className="text-slate-500 font-medium">रंग ढाँचा:</span>
              <button
                onClick={() => setReadingTheme('light')}
                className={`px-2 py-1 rounded text-xs cursor-pointer ${readingTheme === 'light' ? 'bg-slate-200 font-bold' : 'hover:bg-slate-100'}`}
              >
                उज्यालो (Light)
              </button>
              <button
                onClick={() => setReadingTheme('sepia')}
                className={`px-2 py-1 rounded text-xs cursor-pointer ${readingTheme === 'sepia' ? 'bg-[#e8dfc7] text-[#3d3224] font-bold' : 'hover:bg-slate-100'}`}
              >
                सेपिया (Sepia)
              </button>
              <button
                onClick={() => setReadingTheme('dark')}
                className={`px-2 py-1 rounded text-xs cursor-pointer ${readingTheme === 'dark' ? 'bg-slate-800 text-white font-bold' : 'hover:bg-slate-100'}`}
              >
                गाढा (Dark)
              </button>
            </div>

            {/* Font size */}
            <div className="flex items-center gap-1 border-l border-slate-200 pl-3">
              <span className="text-slate-500 font-medium">अक्षर साइज:</span>
              <button
                onClick={() => setFontSizeLevel(l => Math.max(0, l - 1))}
                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 font-bold"
                title="अक्षर घटाउनुहोस्"
              >
                A-
              </button>
              <button
                onClick={() => setFontSizeLevel(l => Math.min(3, l + 1))}
                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 font-bold"
                title="अक्षर बढाउनुहोस्"
              >
                A+
              </button>
            </div>

            {/* Toggle TOC */}
            <button
              onClick={() => setShowToc(prev => !prev)}
              className={`px-2.5 py-1 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                showToc ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <Bookmark className="w-3 h-3 inline-block mr-1" />
              विषय-सूची ({filteredToc.length})
            </button>
          </div>

          {/* Sync indicator */}
          <div className="flex items-center gap-2 text-slate-600 flex-wrap">
            <span className="text-slate-400">हालको सिंक:</span>
            <span className="font-bold font-mono text-indigo-700 text-xs sm:text-sm bg-indigo-50 px-2 py-0.5 rounded">
              {formatDualPageLabel(pdfRelativePath, syncedPage, totalPdfPages)}
            </span>
            {activeCalibration.effectivePhysicalOffset !== 0 && syncedDataPage !== null && (
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                डेटा {toDeva(syncedDataPage)} + अफसेट {activeCalibration.effectivePhysicalOffset > 0 ? `+${toDeva(activeCalibration.effectivePhysicalOffset)}` : toDeva(activeCalibration.effectivePhysicalOffset)}
              </span>
            )}
            {syncedSectionTitle && (
              <span className="text-[11px] text-slate-500 max-w-xs truncate">
                • {syncedSectionTitle}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Workspace: Split (desktop only side-by-side when mini window closed) or Single MD/PDF View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Panel: Markdown Document Reader */}
        {(viewMode === 'split' || viewMode === 'md-only') && (
          <div
            className={`${
              viewMode === 'md-only' || miniPdfOpen || !isDesktopLg ? 'lg:col-span-12' : 'lg:col-span-6'
            } flex flex-col space-y-3 transition-all`}
          >
            {/* Table of Contents Drawer / Bar */}
            {showToc && filteredToc.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                    <Bookmark className="w-3.5 h-3.5 text-indigo-600" />
                    <span>विषय-सूची (सिधै दफा/धारामा जानुहोस्)</span>
                  </div>
                  <div className="relative w-44">
                    <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="दफा/धारा खोज्नुहोस्..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-6 pr-2 py-1 text-[11px] rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex gap-1.5 overflow-x-auto pb-1 max-h-36 flex-wrap">
                  {filteredToc.slice(0, 35).map((item, idx) => {
                    const targetPhysical = toPhysicalPdfPage(
                      pdfRelativePath,
                      item.page,
                      totalPdfPages > 0 ? totalPdfPages : undefined
                    );
                    const rawPageNum = devaToNum(item.page);
                    const isCurrent = targetPhysical === syncedPage;
                    return (
                      <button
                        key={`${item.id}-${idx}`}
                        onClick={() => {
                          handleSyncToPage(item.page, item.title, true, item.title);
                          const el = document.getElementById(item.id);
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        className={`text-[11px] px-2 py-1 rounded-md border text-left shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                          isCurrent
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs font-bold'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                        title={
                          targetPhysical !== rawPageNum
                            ? `${item.title} (पुस्तक पृष्ठ ${item.page} → PDF पृष्ठ ${toDeva(targetPhysical)})`
                            : `${item.title} (PDF पृष्ठ ${item.page})`
                        }
                      >
                        <span className="truncate max-w-[150px]">{item.title}</span>
                        <span
                          className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                            isCurrent ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {targetPhysical !== rawPageNum
                            ? `पृ. ${toDeva(item.page)} → PDF ${toDeva(targetPhysical)}`
                            : `पृष्ठ ${toDeva(item.page)}`}
                        </span>
                      </button>
                    );
                  })}
                  {filteredToc.length > 35 && (
                    <span className="text-[11px] text-slate-400 self-center px-1">
                      +{filteredToc.length - 35} थप प्रावधानहरू...
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Markdown Reader Content Box */}
            <div
              className={`rounded-2xl border shadow-sm p-6 sm:p-8 overflow-y-auto max-h-[82vh] transition-colors ${themeClasses}`}
              ref={mdContainerRef}
            >
              {/* Header inside Markdown View */}
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-inherit text-xs opacity-75">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  <span className="font-semibold">Markdown कानुनी स्वरूप</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline">सिंक बटनमा क्लिक गर्दा दायाँतर्फ पृष्ठ स्वतः खुल्नेछ</span>
                  <FontSizeControls variant={readingTheme === 'dark' ? 'dark' : 'light'} />
                </div>
              </div>

              {/* Rendered HTML with bold underlined headers & clean Nepali legal styling */}
              <div
                className={`md-legal-reader max-w-none ${themeInnerClasses} ${fontSizes[fontSizeLevel]} leading-relaxed font-['Mukta','Noto_Sans_Devanagari',sans-serif]`}
                dangerouslySetInnerHTML={{ __html: parsedHtml }}
              />
            </div>
          </div>
        )}

        {/* Docked PDF Viewer (Full-width in 'pdf-only', or side-by-side on desktop when mini window is closed — no unused downward window on mobile) */}
        {(viewMode === 'pdf-only' || (viewMode === 'split' && isDesktopLg && !miniPdfOpen)) && (
          <div
            className={`${
              viewMode === 'pdf-only' ? 'lg:col-span-12' : 'lg:col-span-6'
            } flex flex-col space-y-3 transition-all sticky top-16`}
          >
            {/* PDF Viewer Header Bar */}
            <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-md p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-red-600/30 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-xs sm:text-sm text-white truncate">
                      {activeDoc?.filename}
                    </h4>
                    <p className="text-[11px] text-slate-400 font-mono truncate">
                      {formatDualPageLabel(pdfRelativePath, syncedPage, totalPdfPages)}
                    </p>
                  </div>
                </div>
                <FontSizeControls variant="dark" className="sm:hidden" />
              </div>

              {/* Page Navigator Controls */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-xl border border-slate-700 text-xs">
                  <span className="text-slate-400 font-sans">पृष्ठ:</span>
                  <button
                    onClick={() => setSyncedPage(p => Math.max(1, p - 1))}
                    className="p-1 hover:text-white hover:bg-slate-700 rounded cursor-pointer"
                    title="अघिल्लो पृष्ठ"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={syncedPage}
                    onChange={e => setSyncedPage(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-12 bg-slate-900 text-center font-bold text-amber-300 rounded px-1 py-0.5 border border-slate-600 text-xs"
                  />
                  <button
                    onClick={() => setSyncedPage(p => p + 1)}
                    className="p-1 hover:text-white hover:bg-slate-700 rounded cursor-pointer"
                    title="पछिल्लो पृष्ठ"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {isAdminOrOwner && (
                  <>
                    <a
                      href={rawGitHubUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                      title="GitHub Raw सिधै नयाँ ट्याबमा खोल्नुहोस्"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span className="hidden sm:inline">नयाँ ट्याब</span>
                    </a>

                    <a
                      href={`${localProxyUrl}&download=1`}
                      download={activeDoc?.filename}
                      className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                      title="PDF डाउनलोड गर्नुहोस्"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </>
                )}
                <FontSizeControls variant="dark" className="hidden sm:inline-flex" />
              </div>
            </div>

            {/* Live Streaming PDF Viewer (automatically suspended if floating mini window is active so only 1 PDF loads) */}
            <div className="relative bg-slate-950 rounded-2xl border border-slate-800 shadow-xl overflow-hidden h-[82vh] flex flex-col">
              <div className="flex-1 min-h-0">
                <PdfCanvasViewer
                  pdfPath={pdfRelativePath}
                  page={syncedPage}
                  title={activeDoc?.filename || 'PDF Document'}
                  highlightText={syncedHighlightQuery}
                  suspended={suspended || miniPdfOpen}
                  allowDownload={isAdminOrOwner}
                  onNumPages={setTotalPdfPages}
                  onPageChange={setSyncedPage}
                />
              </div>

              {/* Compact Bottom Sync Status Bar & Offset Tuner */}
              <div className="bg-slate-900 border-t border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white tabular-nums">
                    {formatDualPageLabel(pdfRelativePath, syncedPage, totalPdfPages)}
                  </span>
                  {printedBookInfo.hasShift && !printedBookInfo.isFrontMatter && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px]">
                      पुस्तक पृष्ठ {toDeva(printedBookInfo.printedPage!)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-md px-1.5 py-0.5 text-[11px]">
                    <span className="text-slate-400">अफसेट:</span>
                    <button
                      type="button"
                      onClick={() => handleAdjustOffset(-1)}
                      className="px-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold cursor-pointer"
                      title="अफसेट -1"
                    >
                      -
                    </button>
                    <span className="px-1 font-mono font-bold text-amber-300 tabular-nums">
                      {activeCalibration.effectivePhysicalOffset >= 0
                        ? `+${activeCalibration.effectivePhysicalOffset}`
                        : activeCalibration.effectivePhysicalOffset}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAdjustOffset(1)}
                      className="px-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold cursor-pointer"
                      title="अफसेट +1"
                    >
                      +
                    </button>
                    {activeCalibration.userOverrideOffset !== null && (
                      <button
                        type="button"
                        onClick={handleResetOffset}
                        className="p-0.5 rounded hover:bg-slate-600 text-slate-400 hover:text-white cursor-pointer"
                        title="अफसेट रिसेट"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {isAdminOrOwner && (
                    <a
                      href={githubRepoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline text-[11px]"
                    >
                      GitHub
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Small Floating Red-Highlighted Synced PDF Mini Window (non-blocking over original MD window) */}
      {miniPdfOpen && !suspended && pdfRelativePath && (
        <div
          className={`fixed bottom-3 right-3 z-40 flex flex-col bg-slate-950 rounded-xl border-2 border-red-500 shadow-2xl shadow-red-950/40 overflow-hidden transition-all ${
            miniPdfExpanded
              ? 'w-[calc(100vw-1.5rem)] sm:w-[540px] h-[58vh] sm:h-[520px]'
              : 'w-[calc(100vw-1.5rem)] sm:w-[420px] h-[44vh] sm:h-[360px]'
          }`}
        >
          {/* Red-Accented Compact Mini Header */}
          <div className="px-3 py-2 bg-gradient-to-r from-red-950 via-rose-950 to-slate-900 border-b border-red-500/50 text-white flex items-center justify-between gap-2 shrink-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-200 truncate">
                <span className="inline-block w-2 h-2 rounded-full bg-red-500 shrink-0" />
                <span className="truncate">
                  {syncedSectionTitle || activeDoc?.filename}
                </span>
              </div>
              <div className="text-[10px] text-red-200/90 font-mono truncate">
                {formatDualPageLabel(pdfRelativePath, syncedPage, totalPdfPages)}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setSyncedPage(p => Math.max(1, p - 1))}
                className="p-1 rounded bg-red-900/60 hover:bg-red-800 text-white cursor-pointer"
                title="अघिल्लो पृष्ठ"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setSyncedPage(p => (totalPdfPages > 0 ? Math.min(totalPdfPages, p + 1) : p + 1))
                }
                className="p-1 rounded bg-red-900/60 hover:bg-red-800 text-white cursor-pointer"
                title="पछिल्लो पृष्ठ"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <FontSizeControls variant="dark" />
              <button
                type="button"
                onClick={() => setMiniPdfExpanded(prev => !prev)}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                title={miniPdfExpanded ? 'सानो बनाउनुहोस्' : 'अलि ठूलो बनाउनुहोस्'}
              >
                {miniPdfExpanded ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setMiniPdfOpen(false)}
                className="p-1 rounded bg-slate-800 hover:bg-red-700 text-slate-200 hover:text-white cursor-pointer"
                title="सानो विन्डो बन्द गर्नुहोस्"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Red-Highlighted PDF Canvas inside Small Window */}
          <div className="flex-1 min-h-0">
            <PdfCanvasViewer
              pdfPath={pdfRelativePath}
              page={syncedPage}
              title={activeDoc?.filename || 'PDF Document'}
              highlightText={syncedHighlightQuery}
              allowDownload={isAdminOrOwner}
              onNumPages={setTotalPdfPages}
              onPageChange={setSyncedPage}
            />
          </div>

          {/* Mini Window Compact Offset Bar (adjust & save offset live if PDF vs Book page differs) */}
          <div className="px-3 py-1 bg-slate-900 border-t border-red-900/60 flex items-center justify-between text-[10px] text-slate-300 shrink-0">
            <span className="truncate text-slate-400">
              {syncedDataPage !== null && activeCalibration.effectivePhysicalOffset !== 0
                ? `डेटा पृ. ${toDeva(syncedDataPage)} → PDF पृ. ${toDeva(syncedPage)}`
                : printedBookInfo.hasShift && !printedBookInfo.isFrontMatter
                  ? `पुस्तक पृष्ठ ${toDeva(printedBookInfo.printedPage!)}`
                  : 'सिंक पृष्ठ मिलान'}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-slate-400">अफसेट:</span>
              <button
                type="button"
                onClick={() => handleAdjustOffset(-1)}
                className="px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer"
                title="PDF पृष्ठ -1 सार्नुहोस्"
              >
                -
              </button>
              <span className="font-mono font-bold text-amber-300 px-0.5 tabular-nums">
                {activeCalibration.effectivePhysicalOffset >= 0
                  ? `+${activeCalibration.effectivePhysicalOffset}`
                  : activeCalibration.effectivePhysicalOffset}
              </span>
              <button
                type="button"
                onClick={() => handleAdjustOffset(1)}
                className="px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer"
                title="PDF पृष्ठ +1 सार्नुहोस्"
              >
                +
              </button>
              {activeCalibration.userOverrideOffset !== null && (
                <button
                  type="button"
                  onClick={handleResetOffset}
                  className="p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
                  title="अफसेट रिसेट"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Markdown Reader Typography (All Headers Bold & Underlined) + Red Sync Buttons */}
      <style>{`
        .md-legal-reader h1,
        .md-legal-reader h2,
        .md-legal-reader h3,
        .md-legal-reader h4,
        .md-legal-reader h5,
        .md-legal-reader h6 {
          font-weight: 800;
          text-decoration: underline;
          text-underline-offset: 5px;
          text-decoration-thickness: 2px;
          line-height: 1.45;
          margin-top: 1.25em;
          margin-bottom: 0.55em;
        }
        .md-legal-reader h1 { font-size: 1.45em; }
        .md-legal-reader h2 { font-size: 1.25em; }
        .md-legal-reader h3 { font-size: 1.1em; font-weight: 700; }
        .md-legal-reader h4 { font-size: 1em; font-weight: 700; }
        .md-legal-reader.md-light h1,
        .md-legal-reader.md-light h2,
        .md-legal-reader.md-light h3,
        .md-legal-reader.md-light h4 {
          color: #0f172a;
          text-decoration-color: #1e293b;
        }
        .md-legal-reader.md-sepia h1,
        .md-legal-reader.md-sepia h2,
        .md-legal-reader.md-sepia h3,
        .md-legal-reader.md-sepia h4 {
          color: #292014;
          text-decoration-color: #5c4932;
        }
        .md-legal-reader.md-dark h1,
        .md-legal-reader.md-dark h2,
        .md-legal-reader.md-dark h3,
        .md-legal-reader.md-dark h4 {
          color: #f8fafc;
          text-decoration-color: #94a3b8;
        }
        .md-legal-reader strong,
        .md-legal-reader th {
          font-weight: 700;
        }
        .md-legal-reader th {
          text-decoration: underline;
          text-underline-offset: 4px;
          text-decoration-thickness: 1.5px;
          padding: 0.45rem 0.65rem 0.45rem 0;
          text-align: left;
        }
        .md-legal-reader td {
          padding: 0.35rem 0.65rem 0.35rem 0;
          vertical-align: top;
        }
        .md-legal-reader table {
          width: 100%;
          border-collapse: collapse;
          margin: 0.65rem 0 0.9rem;
        }
        .md-legal-reader tr {
          border-bottom: 1px solid rgba(148, 163, 184, 0.25);
        }
        .md-legal-reader blockquote {
          border-left: 3px solid #6366f1;
          padding-left: 0.85rem;
          margin: 0.75rem 0;
          opacity: 0.92;
        }
        .md-legal-reader hr {
          margin: 1.15rem 0;
          border-color: rgba(148, 163, 184, 0.35);
        }
        .md-legal-reader ol,
        .md-legal-reader ul {
          padding-left: 1.35rem;
          margin: 0.5rem 0 1rem;
        }
        .md-legal-reader ol { list-style-type: decimal; }
        .md-legal-reader ul { list-style-type: disc; }
        .md-legal-reader li { margin: 0.25rem 0; }
        .sync-page-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #fee2e2;
          color: #b91c1c;
          padding: 2px 9px;
          border-radius: 6px;
          font-weight: 700;
          font-size: 11px;
          text-decoration: none;
          margin-left: 6px;
          transition: all 0.15s ease;
          border: 1px solid #fca5a5;
          cursor: pointer;
        }
        .sync-page-btn:hover,
        .sync-page-btn-active {
          background: #dc2626;
          color: #ffffff !important;
          border-color: #991b1b;
          box-shadow: 0 2px 8px rgba(220, 38, 38, 0.32);
        }
      `}</style>
    </div>
  );
};
