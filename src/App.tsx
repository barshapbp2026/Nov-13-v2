import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { Navbar } from './components/Navbar';
import { UnifiedFolderView, ThemeColor } from './components/UnifiedFolderView';
import { TenColumnTable } from './components/TenColumnTable';
import { DirectoryView } from './components/DirectoryView';
import { TenColumnModal } from './components/TenColumnModal';
import { PdfViewerModal } from './components/PdfViewerModal';
import { MarkdownPdfSyncView } from './components/MarkdownPdfSyncView';
import { PdfSummaryModal } from './components/PdfSummaryModal';
import { MasterSummaryHubModal } from './components/MasterSummaryHubModal';
import { exportToExcel, exportToCsv, exportToJson } from './utils/exportUtils';
import {
  LegalRow,
  DocumentSummary,
  StoredPdfSummaryRecord,
  StoredDafaSummaryRecord,
} from './types';
import { isAnusuchiRow } from './utils/urlUtils';
import { toDeva } from './utils/markdownUtils';
import {
  checkIsAdminOrOwner,
  listAllCachedPdfSummaries,
  listAllCachedDafaSummaries,
} from './services/firestoreSummaryStore';

// Pre-compiled verified datasets from barshapbp2026/any-pdf-
import allRowsData from './data/all_rows.json';
import documentsSummaryData from './data/documents_summary.json';

import {
  BookOpen,
  Database,
  FolderTree,
  Columns,
} from 'lucide-react';

interface FolderConfig {
  id: string;
  folderId: string;
  folderName: string;
  shortLabel: string;
  themeColor: ThemeColor;
  description: string;
}

const FOLDERS_CONFIG: FolderConfig[] = [
  {
    id: 'folder-1',
    folderId: '१.',
    folderName: '१. संबिधान र मुलुकी संहिता',
    shortLabel: '१. संबिधान र मुलुकी संहिता',
    themeColor: 'red',
    description: 'नेपालको संबिधान (२०७२), मुलुकी अपराध संहिता २०७४, मुलुकी देवानी संहिता २०७४ र फौजदारी कार्यविधि संहिता तथा नियमावलीका १,६४२ धारा/दफा तथा २३८ अनुसूचीहरूको पूर्ण प्रमाणित संकलन।',
  },
  {
    id: 'folder-2',
    folderId: '२.',
    folderName: '२. ऐन',
    shortLabel: '२. ऐन',
    themeColor: 'blue',
    description: 'जग्गा नापजाँच ऐन २०१९, भुमि सम्बन्धि ऐन २०२१, भूउपयोग ऐन २०७६, र मालपोत ऐन २०३४ सम्बन्धी ४ मूल ऐनहरू (१६८ रेकर्ड)।',
  },
  {
    id: 'folder-3',
    folderId: '३.',
    folderName: '३. अध्यादेश',
    shortLabel: '३. अध्यादेश',
    themeColor: 'emerald',
    description: 'केही नेपाल ऐन संशोधन, वन सम्बन्धी संशोधन, र भूमि सम्बन्धी संशोधन अध्यादेश २०८३ (सब-फोल्डर ३.१, ३.२, ३.३) को ७७ रेकर्डहरूको प्रमाणित संकलन।',
  },
  {
    id: 'folder-4',
    folderId: '४.',
    folderName: '४. नियमावली',
    shortLabel: '४. नियमावली',
    themeColor: 'orange',
    description: 'उखडा सम्बन्धी नियमहरू २०२१, जग्गा नाप जाँच नियमावली २०५८, भूउपयोग नियमावली २०७९, र मालपोत नियमावली २०३६ का ४ नियमावलीहरूको २०५ रेकर्डहरू (१५९ नियम र ४६ अनुसूची)।',
  },
  {
    id: 'folder-5',
    folderId: '५.',
    folderName: '५. निर्देशिका',
    shortLabel: '५. निर्देशिका',
    themeColor: 'teal',
    description: 'भूमि प्रशासन निर्देशिका २०८१ र जग्गा नापजाँच तथा नक्सा स्रेस्ता अद्यावधिक निर्देशिका २०८१ (सब-फोल्डर ५.१, ५.२) को ५८५ रेकर्डहरूको पूर्ण विवरण।',
  },
  {
    id: 'folder-8',
    folderId: '८.',
    folderName: '८. अख्तियार दुरुपयोग अनुसन्धान आयोग',
    shortLabel: '८. अख्तियार',
    themeColor: 'indigo',
    description: 'अख्तियार दुरुपयोग अनुसन्धान आयोग र भ्रष्टाचार निवारण ऐन २०५९ का ७७ दफाहरूको प्रमाणित संकलन।',
  },
  {
    id: 'folder-9',
    folderId: '९.',
    folderName: '९. भुमि समस्या समाधान समिति',
    shortLabel: '९. भुमि समस्या समिति',
    themeColor: 'rose',
    description: 'भूमि समस्या समाधान आयोग गठन आदेश, जग्गा उपलब्ध गराउने कार्यविधि, लगत सम्बन्धी निर्देशिका, र मापदण्डका ६ प्रमुख दस्ताबेजहरूको १३५ रेकर्डहरू।',
  },
  {
    id: 'folder-10',
    folderId: '१०.',
    folderName: '१०. कानुनी संगालो',
    shortLabel: '१०. कानुनी संगालो',
    themeColor: 'amber',
    description: 'सुकुम्बासी समस्या समाधान आयोगका विगतका ऐतिहासिक गठन आदेश तथा कार्यादेशको संगालो (सब-फोल्डर १०.१ • भुमि आयोग कानुन संगालो) का २६ रेकर्डहरू।',
  },
  {
    id: 'folder-11',
    folderId: '११.',
    folderName: '११. जोड्नु पर्ने कानुन',
    shortLabel: '११. जोड्नु पर्ने कानुन',
    themeColor: 'emerald',
    description: 'भूमि समस्या समाधान आयोग (सब-फोल्डर ११.१ • भुमि आयोग हाल) का १५ वटा ऐन, अध्यादेश, निर्देशिका, गठन आदेश र कार्यविधिहरूको ८९५ प्रमाणित रेकर्डहरूको पूर्ण संकलन।',
  },
  {
    id: 'folder-12',
    folderId: '१२.',
    folderName: '१२. मालपोत नापी सम्बन्धि ऐन नियम निर्देशिका कार्यविधि',
    shortLabel: '१२. मालपोत नापी',
    themeColor: 'cyan',
    description: 'जग्गा नापजाँच ऐन तथा नियमावली, मालपोत ऐन तथा नियमावली, भूउपयोग ऐन तथा नियमावली, र भूमि प्रशासन निर्देशिका सम्बन्धी ९ मूल दस्तावेजहरू (९३९ रेकर्ड)।',
  },
];

export default function App() {
  const allRows: LegalRow[] = allRowsData as LegalRow[];
  const documents: DocumentSummary[] = documentsSummaryData as DocumentSummary[];

  const totalSectionCount = useMemo(
    () => allRows.filter(r => !isAnusuchiRow(r) && !!r.section_id).length,
    [allRows]
  );
  const totalScheduleCount = useMemo(
    () => allRows.filter(r => isAnusuchiRow(r)).length,
    [allRows]
  );

  // Navigation tab state - serial order default 'folder-1'
  const [activeTab, setActiveTab] = useState<string>('folder-1');

  // Gemini PDF Summary state
  const [pdfSummaryOpen, setPdfSummaryOpen] = useState(false);
  const [summaryDocPath, setSummaryDocPath] = useState('pdfs/१. संबिधान र मुलुकी संहिता/१.१. नेपालको संबिधान (२०७२-०६-०३).pdf');
  const [summaryPage, setSummaryPage] = useState('');

  // MD + PDF Sync navigation context
  const [mdSyncDoc, setMdSyncDoc] = useState<string>('१.१. नेपालको संबिधान (२०७२-०६-०३).pdf');
  const [mdSyncPage, setMdSyncPage] = useState<string>('३');

  // Modal inspection state
  const [activeModalRow, setActiveModalRow] = useState<LegalRow | null>(null);
  const [modalRowIndex, setModalRowIndex] = useState<number>(-1);
  const [activeRowsContext, setActiveRowsContext] = useState<LegalRow[]>(allRows);

  // PDF Viewer state
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [currentPdfPath, setCurrentPdfPath] = useState('');
  const [currentPdfName, setCurrentPdfName] = useState('');
  const [currentPdfPage, setCurrentPdfPage] = useState('1');
  const [currentPdfHighlight, setCurrentPdfHighlight] = useState('');

  // Pre-selected document filter when user clicks from Directory
  const [selectedDocFilter, setSelectedDocFilter] = useState<string>('all');

  // Firebase Auth & Firestore Master Summary Store state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdminOrOwner, setIsAdminOrOwner] = useState<boolean>(false);
  const [masterHubOpen, setMasterHubOpen] = useState<boolean>(false);
  const [cachedPdfSummaries, setCachedPdfSummaries] = useState<StoredPdfSummaryRecord[]>([]);
  const [cachedDafaSummaries, setCachedDafaSummaries] = useState<StoredDafaSummaryRecord[]>([]);

  const cachedDafaMap = useMemo(() => {
    const map = new Map<string, StoredDafaSummaryRecord>();
    for (const item of cachedDafaSummaries) {
      map.set(item.docId, item);
    }
    return map;
  }, [cachedDafaSummaries]);

  const refreshMasterStore = useCallback(async () => {
    try {
      const [pdfs, dafas] = await Promise.all([
        listAllCachedPdfSummaries(),
        listAllCachedDafaSummaries(),
      ]);
      setCachedPdfSummaries(pdfs);
      setCachedDafaSummaries(dafas);
    } catch {
      // Gracefully ignore offline/initial transient read failures
    }
  }, []);

  useEffect(() => {
    let active = true;
    const unsub = onAuthStateChanged(auth, async user => {
      if (!active) return;
      setCurrentUser(user);
      const authorized = await checkIsAdminOrOwner(user);
      if (active) {
        setIsAdminOrOwner(authorized);
        if (!authorized) setMasterHubOpen(false);
      }
    });
    void refreshMasterStore();
    return () => {
      active = false;
      unsub();
    };
  }, [refreshMasterStore]);

  const handleSignIn = useCallback(async (): Promise<User | null> => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      return cred.user;
    } catch {
      return null;
    }
  }, []);

  const handleSignOut = useCallback(async (): Promise<void> => {
    await signOut(auth);
  }, []);

  const handlePdfSaved = useCallback((record: StoredPdfSummaryRecord) => {
    setCachedPdfSummaries(prev => {
      const idx = prev.findIndex(p => p.docId === record.docId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = record;
        return next;
      }
      return [record, ...prev];
    });
  }, []);

  const handleDafasSaved = useCallback((records: StoredDafaSummaryRecord[]) => {
    if (records.length === 0) return;
    setCachedDafaSummaries(prev => {
      const map = new Map<string, StoredDafaSummaryRecord>(prev.map(r => [r.docId, r]));
      for (const r of records) {
        map.set(r.docId, r);
      }
      return Array.from(map.values());
    });
  }, []);

  // Open 10-column Modal
  const handleOpenModal = (row: LegalRow, contextList?: LegalRow[]) => {
    const list = contextList || allRows;
    setActiveRowsContext(list);
    const idx = list.findIndex(
      r => r.folder_id === row.folder_id && r.pdf_name === row.pdf_name && r.section_id === row.section_id && r.anusuchi_id === row.anusuchi_id
    );
    setModalRowIndex(idx >= 0 ? idx : 0);
    setActiveModalRow(row);
  };

  const handleNextModalRow = () => {
    if (modalRowIndex < activeRowsContext.length - 1) {
      const nextIdx = modalRowIndex + 1;
      setModalRowIndex(nextIdx);
      setActiveModalRow(activeRowsContext[nextIdx]);
    }
  };

  const handlePrevModalRow = () => {
    if (modalRowIndex > 0) {
      const prevIdx = modalRowIndex - 1;
      setModalRowIndex(prevIdx);
      setActiveModalRow(activeRowsContext[prevIdx]);
    }
  };

  // Open PDF viewer at page (with optional section heading highlight)
  const handleOpenPdf = (path: string, page: string, highlightText?: string) => {
    const doc = documents.find(d => d.path === path);
    setCurrentPdfPath(path);
    setCurrentPdfName(doc ? doc.filename : path.split('/').pop() || 'कागजात.pdf');
    setCurrentPdfPage(page || '1');
    setCurrentPdfHighlight(highlightText || '');
    setPdfViewerOpen(true);
  };

  // Switch to All Docs table with specific doc filtered
  const handleSelectDocFromDirectory = (filename: string) => {
    setSelectedDocFilter(filename);
    setActiveTab('all');
  };

  // Switch to MD + PDF Sync Dual View with a specific document
  const handleOpenInMdSync = (filename: string, page: string = '1') => {
    setMdSyncDoc(filename);
    setMdSyncPage(page);
    setActiveTab('md-sync');
  };

  // Open Gemini PDF Summary modal
  const handleOpenPdfSummary = (docPath: string, page: string = '') => {
    setSummaryDocPath(docPath);
    setSummaryPage(page);
    setPdfSummaryOpen(true);
  };

  // Exports (Owner/Admin only)
  const handleExportExcelAll = (customRows?: LegalRow[]) => {
    if (!isAdminOrOwner) return;
    const target = customRows || allRows;
    exportToExcel(target, 'Nepal_Legal_All_PDFs_10_Columns.xlsx');
  };

  const handleExportCsvAll = (customRows?: LegalRow[]) => {
    if (!isAdminOrOwner) return;
    const target = customRows || allRows;
    exportToCsv(target, 'Nepal_Legal_All_PDFs_10_Columns.csv');
  };

  const handleExportJsonAll = () => {
    if (!isAdminOrOwner) return;
    exportToJson(allRows, 'Nepal_Legal_All_PDFs_Data.json');
  };

  // Active folder config if a folder tab is selected
  const activeFolderConfig = useMemo(() => {
    return FOLDERS_CONFIG.find(f => f.id === activeTab);
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        totalRows={allRows.length}
        totalDocs={documents.length}
        isAdminOrOwner={isAdminOrOwner}
        onExportExcel={() => handleExportExcelAll()}
        onExportCsv={() => handleExportCsvAll()}
        onExportJson={handleExportJsonAll}
        onOpenPdfSummary={() => handleOpenPdfSummary('pdfs/१. संबिधान र मुलुकी संहिता/१.१. नेपालको संबिधान (२०७२-०६-०३).pdf')}
        onOpenMasterHub={isAdminOrOwner ? () => setMasterHubOpen(true) : undefined}
        cachedCount={cachedPdfSummaries.length + cachedDafaSummaries.length}
        currentUser={currentUser}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 space-y-4">
        {/* Clean Top Workspace Switcher (4 Primary Views) */}
        <div className="bg-white rounded-xl border border-slate-200 p-1.5 shadow-2xs flex flex-wrap sm:flex-nowrap gap-1">
          <button
            onClick={() => {
              if (!activeFolderConfig) setActiveTab('folder-1');
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-semibold text-xs sm:text-sm transition-colors cursor-pointer ${
              Boolean(activeFolderConfig)
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>फोल्डर संग्रह (१–१२)</span>
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-semibold text-xs sm:text-sm transition-colors cursor-pointer ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>मास्टर तालिका</span>
          </button>

          <button
            onClick={() => setActiveTab('md-sync')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-semibold text-xs sm:text-sm transition-colors cursor-pointer ${
              activeTab === 'md-sync'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Columns className="w-4 h-4" />
            <span>MD + PDF सिंक</span>
          </button>

          <button
            onClick={() => setActiveTab('directory')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-semibold text-xs sm:text-sm transition-colors cursor-pointer ${
              activeTab === 'directory'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            <span>डाइरेक्टरी</span>
          </button>
        </div>

        {/* Compact Folder Selector Strip (Visible in Folder View) */}
        {activeFolderConfig && (
          <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-2xs flex items-center gap-1.5 overflow-x-auto">
            {FOLDERS_CONFIG.map(f => {
              const isSelected = activeTab === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setActiveTab(f.id)}
                  className={`shrink-0 inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <span>{f.shortLabel}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Unified Folder Window: Consistently Renders ANY Selected Folder with Identical Interface & Master Table */}
        {activeFolderConfig && (
          <UnifiedFolderView
            key={activeFolderConfig.id}
            folderId={activeFolderConfig.folderId}
            folderName={activeFolderConfig.folderName}
            themeColor={activeFolderConfig.themeColor}
            description={activeFolderConfig.description}
            allRows={allRows}
            documents={documents}
            onOpenPdf={handleOpenPdf}
            onOpenMdSync={handleOpenInMdSync}
            onOpenModal={handleOpenModal}
            onSummarizePdf={handleOpenPdfSummary}
            isAdminOrOwner={isAdminOrOwner}
          />
        )}

        {/* Master 10-Column Table across ALL Folders */}
        {activeTab === 'all' && (
          <TenColumnTable
            rows={allRows}
            documents={documents}
            isAdminOrOwner={isAdminOrOwner}
            onOpenModal={r => handleOpenModal(r, allRows)}
            onOpenPdf={handleOpenPdf}
            onOpenMdSync={handleOpenInMdSync}
            onSummarizePdf={handleOpenPdfSummary}
            selectedDocFilter={selectedDocFilter}
            onClearDocFilter={() => setSelectedDocFilter('all')}
            onExportExcel={filtered => handleExportExcelAll(filtered)}
            onExportCsv={filtered => handleExportCsvAll(filtered)}
          />
        )}

        {/* Markdown Reader & Synchronized PDF Dual View */}
        {activeTab === 'md-sync' && (
          <MarkdownPdfSyncView
            documents={documents}
            allRows={allRows}
            initialDocFilename={mdSyncDoc}
            initialPage={mdSyncPage}
            suspended={pdfViewerOpen}
            isAdminOrOwner={isAdminOrOwner}
            cachedDafaMap={cachedDafaMap}
            onOpen10ColumnTable={handleSelectDocFromDirectory}
            onSummarizePdf={handleOpenPdfSummary}
          />
        )}

        {/* Folder and Subfolder Directory */}
        {activeTab === 'directory' && (
          <DirectoryView
            documents={documents}
            isAdminOrOwner={isAdminOrOwner}
            onSelectDoc={handleSelectDocFromDirectory}
            onOpenPdf={handleOpenPdf}
            onOpenMdSync={handleOpenInMdSync}
            onSummarizePdf={handleOpenPdfSummary}
          />
        )}
      </main>

      {/* 10-Column Modal Inspector */}
      {activeModalRow && (
        <TenColumnModal
          row={activeModalRow}
          isOpen={true}
          onClose={() => setActiveModalRow(null)}
          onPrev={handlePrevModalRow}
          onNext={handleNextModalRow}
          hasPrev={modalRowIndex > 0}
          hasNext={modalRowIndex < activeRowsContext.length - 1}
          onOpenPdfViewer={handleOpenPdf}
          cachedDafaMap={cachedDafaMap}
          currentUser={currentUser}
          isAdminOrOwner={isAdminOrOwner}
          onSignIn={handleSignIn}
          onDafaSaved={handleDafasSaved}
        />
      )}

      {/* Embedded PDF Page Verifier Modal */}
      {pdfViewerOpen && (
        <PdfViewerModal
          isOpen={true}
          onClose={() => setPdfViewerOpen(false)}
          pdfPath={currentPdfPath}
          pdfName={currentPdfName}
          targetPage={currentPdfPage}
          highlightText={currentPdfHighlight}
          isAdminOrOwner={isAdminOrOwner}
          onSummarizePdf={(path, page) => {
            setPdfViewerOpen(false);
            handleOpenPdfSummary(path, page);
          }}
        />
      )}

      {/* Gemini AI PDF Summary Modal */}
      <PdfSummaryModal
        isOpen={pdfSummaryOpen}
        onClose={() => setPdfSummaryOpen(false)}
        documents={documents}
        defaultDocPath={summaryDocPath}
        defaultPage={summaryPage}
        currentUser={currentUser}
        isAdminOrOwner={isAdminOrOwner}
        onSignIn={handleSignIn}
        onSummarySaved={handlePdfSaved}
        onOpenPdf={handleOpenPdf}
        onOpenMdSync={handleOpenInMdSync}
      />

      {/* Master Summary Store & Batch Generator Hub (Owner/Admin only) */}
      {isAdminOrOwner && (
        <MasterSummaryHubModal
          isOpen={masterHubOpen}
          onClose={() => setMasterHubOpen(false)}
          documents={documents}
          allRows={allRows}
          currentUser={currentUser}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
          cachedPdfSummaries={cachedPdfSummaries}
          cachedDafaSummaries={cachedDafaSummaries}
          onRefreshStore={refreshMasterStore}
          onPdfSaved={handlePdfSaved}
          onDafasSaved={handleDafasSaved}
        />
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-8 text-xs text-slate-500 text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            नेपाल कानून, संबिधान र मुलुकी संहिता १०-स्तम्भ डेटा पोर्टल
            {isAdminOrOwner && (
              <>
                {' '}• रिपोजिटरी: <code className="text-slate-700 font-semibold">barshapbp2026/any-pdf-</code>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span>{toDeva(totalSectionCount)} धारा तथा दफा</span>
            <span>•</span>
            <span>{toDeva(totalScheduleCount)} अनुसूची</span>
            <span>•</span>
            <span>{toDeva(documents.length)} कानुनी PDF कागजात</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
