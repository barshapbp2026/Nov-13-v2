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
  Folder,
  Layers,
  ArrowRight,
  RefreshCw,
  Upload,
  Eye,
  SlidersHorizontal,
  Bookmark,
  FileCode,
  RotateCcw
} from 'lucide-react';
import { LegalRow, DocumentSummary } from '../types';
import { generateMarkdownForDoc, toDeva, devaToNum, LegalMarkdownDoc } from '../utils/markdownUtils';
import { toGitHubRawUrl, toGitHubBlobUrl } from '../utils/urlUtils';

interface MarkdownPdfSyncViewProps {
  documents: DocumentSummary[];
  allRows: LegalRow[];
  initialDocFilename?: string;
  initialPage?: string;
  onOpen10ColumnTable?: (filename: string) => void;
}

export const MarkdownPdfSyncView: React.FC<MarkdownPdfSyncViewProps> = ({
  documents,
  allRows,
  initialDocFilename,
  initialPage = '1',
  onOpen10ColumnTable,
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
    return generateMarkdownForDoc(activeDoc, allRows);
  }, [activeDoc, allRows]);

  // Active markdown text
  const currentMarkdown = customMdContent !== null ? customMdContent : (generatedDoc?.markdownContent || '');
  const currentDocTitle = customMdTitle || generatedDoc?.title || activeDoc?.filename || 'कानूनी दस्तावेज';

  // Synchronized state
  const [syncedPage, setSyncedPage] = useState<number>(devaToNum(initialPage) || 1);
  const [syncedSectionTitle, setSyncedSectionTitle] = useState<string>('');
  
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
      setSyncedPage(devaToNum(initialPage));
    }
  }, [initialPage]);

  // Handle section sync trigger from Markdown
  const handleSyncToPage = (pageNum: number | string, sectionLabel?: string) => {
    const num = devaToNum(pageNum);
    setSyncedPage(num);
    if (sectionLabel) {
      setSyncedSectionTitle(sectionLabel);
    }
  };

  // Convert markdown to HTML with interactive custom click handlers
  const parsedHtml = useMemo(() => {
    // Configure marked
    marked.setOptions({
      gfm: true,
      breaks: true,
    });

    let raw = marked.parse(currentMarkdown) as string;

    // Transform sync:// URLs into interactive click attributes
    // e.g. href="sync://12" -> href="#page-12" data-sync-page="12"
    raw = raw.replace(/href="sync:\/\/([^"]+)"/g, (_, page) => {
      return `href="#sync-page" data-sync-page="${page}" class="sync-page-btn"`;
    });

    return raw;
  }, [currentMarkdown]);

  // Attach click listener for dynamically rendered sync-page-btn links
  useEffect(() => {
    const container = mdContainerRef.current;
    if (!container) return;

    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('[data-sync-page]');
      if (target) {
        e.preventDefault();
        const pageAttr = target.getAttribute('data-sync-page');
        if (pageAttr) {
          const heading = target.closest('h1, h2, h3, h4, tr')?.textContent || '';
          handleSyncToPage(pageAttr, heading.slice(0, 40));
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

  // PDF URLs
  const pdfRelativePath = activeDoc?.path || '';
  const localProxyUrl = `/api/pdf-proxy?path=${encodeURIComponent(pdfRelativePath)}`;
  const rawGitHubUrl = toGitHubRawUrl(pdfRelativePath);
  const githubRepoUrl = toGitHubBlobUrl(pdfRelativePath);
  const iframeSrc = `${localProxyUrl}#page=${syncedPage}&view=FitH`;

  // Theme classes
  const themeClasses = {
    light: 'bg-white text-slate-800 border-slate-200',
    dark: 'bg-slate-900 text-slate-100 border-slate-800',
    sepia: 'bg-[#faf6eb] text-[#3d3224] border-[#e8dfc7]',
  }[readingTheme];

  const themeInnerClasses = {
    light: 'prose-slate',
    dark: 'prose-invert',
    sepia: 'prose-stone',
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
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Title and Repo info */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm">
                <BookOpen className="w-3.5 h-3.5" />
                MD रिडर र PDF सिंक (Dual View)
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-1">
                <RefreshCw className="w-3 h-3 text-emerald-600 animate-spin-slow" />
                सिंक सक्रिय: पृष्ठ {toDeva(syncedPage)}
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
              <span>•</span>
              <span>स्रोत: <a href={githubRepoUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">barshapbp2026/any-pdf-</a></span>
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
            </div>

            {/* Document selector dropdown */}
            <select
              value={selectedDocPath}
              onChange={e => {
                setSelectedDocPath(e.target.value);
                setCustomMdContent(null);
                setSyncedPage(1);
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

            <button
              onClick={handleDownloadMarkdown}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors cursor-pointer"
              title="डाउनलोड .md फाइल"
            >
              <Download className="w-3.5 h-3.5" />
              <span>.md डाउनलोड</span>
            </button>

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
          <div className="flex items-center gap-2 text-slate-600">
            <span className="text-slate-400">दायाँपट्टि हालको पृष्ठ:</span>
            <span className="font-bold font-mono text-indigo-600 text-sm bg-indigo-50 px-2 py-0.5 rounded">
              {syncedPage} ({toDeva(syncedPage)})
            </span>
            {syncedSectionTitle && (
              <span className="text-[11px] text-slate-500 max-w-xs truncate">
                • {syncedSectionTitle}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Workspace: Split or Single View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Panel: Markdown Document Reader */}
        {(viewMode === 'split' || viewMode === 'md-only') && (
          <div
            className={`${
              viewMode === 'md-only' ? 'lg:col-span-12' : 'lg:col-span-6'
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
                    const isCurrent = devaToNum(item.page) === syncedPage;
                    return (
                      <button
                        key={`${item.id}-${idx}`}
                        onClick={() => {
                          handleSyncToPage(item.page, item.title);
                          const el = document.getElementById(item.id);
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        className={`text-[11px] px-2 py-1 rounded-md border text-left shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                          isCurrent
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs font-bold'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                        title={`${item.title} (PDF पृष्ठ ${item.page})`}
                      >
                        <span className="truncate max-w-[150px]">{item.title}</span>
                        <span
                          className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                            isCurrent ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          पृष्ठ {toDeva(item.page)}
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
                  <span>सिंक बटनमा क्लिक गर्दा दायाँतर्फ पृष्ठ स्वतः खुल्नेछ</span>
                </div>
              </div>

              {/* Rendered HTML with custom styling for Nepali Legal formatting */}
              <div
                className={`prose max-w-none ${themeInnerClasses} ${fontSizes[fontSizeLevel]} leading-relaxed font-['Mukta','Noto_Sans_Devanagari',sans-serif]`}
                dangerouslySetInnerHTML={{ __html: parsedHtml }}
              />
            </div>
          </div>
        )}

        {/* Right Panel: Synchronized PDF Viewer */}
        {(viewMode === 'split' || viewMode === 'pdf-only') && (
          <div
            className={`${
              viewMode === 'pdf-only' ? 'lg:col-span-12' : 'lg:col-span-6'
            } flex flex-col space-y-3 transition-all sticky top-16`}
          >
            {/* PDF Viewer Header Bar */}
            <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-md p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-red-600/30 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-xs sm:text-sm text-white truncate">
                    {activeDoc?.filename}
                  </h4>
                  <p className="text-[11px] text-slate-400 font-mono truncate">
                    barshapbp2026/any-pdf- • पृष्ठ {toDeva(syncedPage)}
                  </p>
                </div>
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
                  href={localProxyUrl}
                  download={activeDoc?.filename}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                  title="PDF डाउनलोड गर्नुहोस्"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Live PDF Viewer Iframe */}
            <div className="relative bg-slate-950 rounded-2xl border border-slate-800 shadow-xl overflow-hidden h-[82vh]">
              <iframe
                key={`${pdfRelativePath}-${syncedPage}`}
                src={iframeSrc}
                title={activeDoc?.filename || 'PDF Document'}
                className="w-full h-full border-0 bg-slate-900"
              />

              {/* Bottom Sync Floating Badge */}
              <div className="absolute bottom-3 left-3 right-3 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl px-4 py-2 flex items-center justify-between text-xs text-slate-300 shadow-lg">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="font-semibold text-white">
                    सिंक गरिएको पृष्ठ: {toDeva(syncedPage)}
                  </span>
                  <span className="text-slate-400 hidden sm:inline">
                    (Markdown मा कुनै पनि दफा क्लिक गरी सिधै सिंक गर्नुहोस्)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={githubRepoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline text-[11px]"
                  >
                    GitHub Repo
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Helper CSS for interactive sync badges */}
      <style>{`
        .sync-page-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #e0e7ff;
          color: #3730a3;
          padding: 2px 8px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 11px;
          text-decoration: none;
          margin-left: 6px;
          transition: all 0.15s ease;
          border: 1px solid #c7d2fe;
          cursor: pointer;
        }
        .sync-page-btn:hover {
          background: #4f46e5;
          color: #ffffff;
          border-color: #4338ca;
          transform: translateY(-1px);
          box-shadow: 0 2px 6px rgba(79, 70, 229, 0.25);
        }
      `}</style>
    </div>
  );
};
