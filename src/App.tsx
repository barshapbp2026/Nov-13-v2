import React, { useState, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { UnifiedFolderView, ThemeColor } from './components/UnifiedFolderView';
import { TenColumnTable } from './components/TenColumnTable';
import { DirectoryView } from './components/DirectoryView';
import { TenColumnModal } from './components/TenColumnModal';
import { PdfViewerModal } from './components/PdfViewerModal';
import { MarkdownPdfSyncView } from './components/MarkdownPdfSyncView';
import { GeminiHeaderAnalyzerModal } from './components/GeminiHeaderAnalyzerModal';
import { exportToExcel, exportToCsv, exportToJson } from './utils/exportUtils';
import { LegalRow, DocumentSummary } from './types';
import { isAnusuchiRow } from './utils/urlUtils';
import { toDeva } from './utils/markdownUtils';

// Pre-compiled verified datasets from barshapbp2026/any-pdf-
import allRowsData from './data/all_rows.json';
import constitutionRowsData from './data/constitution_data.json';
import documentsSummaryData from './data/documents_summary.json';

import { 
  BookOpen, Database, FolderTree, ShieldCheck, Sliders, Layers, 
  Sparkles, Columns, FileText, Scale, BookMarked, Compass, Users, Award 
} from 'lucide-react';

interface FolderConfig {
  id: string;
  folderId: string;
  folderName: string;
  shortLabel: string;
  themeColor: ThemeColor;
  icon: React.ReactNode;
  description: string;
}

const FOLDERS_CONFIG: FolderConfig[] = [
  {
    id: 'folder-1',
    folderId: '१.',
    folderName: '१. संबिधान र मुलुकी संहिता',
    shortLabel: '१. संबिधान र मुलुकी संहिता',
    themeColor: 'red',
    icon: <BookOpen className="w-4 h-4 text-rose-300" />,
    description: 'नेपालको संबिधान (२०७२), मुलुकी अपराध संहिता २०७४, मुलुकी देवानी संहिता २०७४ र फौजदारी कार्यविधि संहिता तथा नियमावलीका १,६४२ धारा/दफा तथा २३८ अनुसूचीहरूको पूर्ण प्रमाणित संकलन।',
  },
  {
    id: 'folder-2',
    folderId: '२.',
    folderName: '२. ऐन',
    shortLabel: '२. ऐन',
    themeColor: 'blue',
    icon: <FileText className="w-4 h-4 text-blue-300" />,
    description: 'जग्गा नापजाँच ऐन २०१९, भुमि सम्बन्धि ऐन २०२१, भूउपयोग ऐन २०७६, र मालपोत ऐन २०३४ सम्बन्धी ४ मूल ऐनहरू (१६८ रेकर्ड)।',
  },
  {
    id: 'folder-3',
    folderId: '३.',
    folderName: '३. अध्यादेश',
    shortLabel: '३. अध्यादेश',
    themeColor: 'emerald',
    icon: <Scale className="w-4 h-4 text-emerald-300" />,
    description: 'केही नेपाल ऐन संशोधन, वन सम्बन्धी संशोधन, र भूमि सम्बन्धी संशोधन अध्यादेश २०८३ (सब-फोल्डर ३.१, ३.२, ३.३) को ७७ रेकर्डहरूको प्रमाणित संकलन।',
  },
  {
    id: 'folder-4',
    folderId: '४.',
    folderName: '४. नियमावली',
    shortLabel: '४. नियमावली',
    themeColor: 'orange',
    icon: <BookMarked className="w-4 h-4 text-orange-300" />,
    description: 'उखडा सम्बन्धी नियमहरू २०२१, जग्गा नाप जाँच नियमावली २०५८, भूउपयोग नियमावली २०७९, र मालपोत नियमावली २०३६ का ४ नियमावलीहरूको २०२ रेकर्डहरू (१५६ नियम र ४६ अनुसूची)।',
  },
  {
    id: 'folder-5',
    folderId: '५.',
    folderName: '५. निर्देशिका',
    shortLabel: '५. निर्देशिका',
    themeColor: 'teal',
    icon: <Compass className="w-4 h-4 text-teal-300" />,
    description: 'भूमि प्रशासन निर्देशिका २०८१ र जग्गा नापजाँच तथा नक्सा स्रेस्ता अद्यावधिक निर्देशिका २०८१ (सब-फोल्डर ५.१, ५.२) को ५८५ रेकर्डहरूको पूर्ण विवरण।',
  },
  {
    id: 'folder-8',
    folderId: '८.',
    folderName: '८. अख्तियार दुरुपयोग अनुसन्धान आयोग',
    shortLabel: '८. अख्तियार',
    themeColor: 'indigo',
    icon: <Scale className="w-4 h-4 text-indigo-300" />,
    description: 'अख्तियार दुरुपयोग अनुसन्धान आयोग र भ्रष्टाचार निवारण ऐन २०५९ का ७७ दफाहरूको प्रमाणित संकलन।',
  },
  {
    id: 'folder-9',
    folderId: '९.',
    folderName: '९. भुमि समस्या समाधान समिति',
    shortLabel: '९. भुमि समस्या समिति',
    themeColor: 'rose',
    icon: <Users className="w-4 h-4 text-rose-300" />,
    description: 'भूमि समस्या समाधान आयोग गठन आदेश, जग्गा उपलब्ध गराउने कार्यविधि, लगत सम्बन्धी निर्देशिका, र मापदण्डका ६ प्रमुख दस्ताबेजहरूको १३५ रेकर्डहरू।',
  },
  {
    id: 'folder-10',
    folderId: '१०.',
    folderName: '१०. कानुनी संगालो',
    shortLabel: '१०. कानुनी संगालो',
    themeColor: 'amber',
    icon: <BookOpen className="w-4 h-4 text-amber-300" />,
    description: 'सुकुम्बासी समस्या समाधान आयोगका विगतका ऐतिहासिक गठन आदेश तथा कार्यादेशको संगालो (सब-फोल्डर १०.१ • भुमि आयोग कानुन संगालो) का २६ रेकर्डहरू।',
  },
  {
    id: 'folder-11',
    folderId: '११.',
    folderName: '११. जोड्नु पर्ने कानुन',
    shortLabel: '११. जोड्नु पर्ने कानुन',
    themeColor: 'emerald',
    icon: <Award className="w-4 h-4 text-emerald-300" />,
    description: 'भूमि समस्या समाधान आयोग (सब-फोल्डर ११.१ • भुमि आयोग हाल) का १५ वटा ऐन, अध्यादेश, निर्देशिका, गठन आदेश र कार्यविधिहरूको ८९५ प्रमाणित रेकर्डहरूको पूर्ण संकलन।',
  },
  {
    id: 'folder-12',
    folderId: '१२.',
    folderName: '१२. मालपोत नापी सम्बन्धि ऐन नियम निर्देशिका कार्यविधि',
    shortLabel: '१२. मालपोत नापी',
    themeColor: 'cyan',
    icon: <Compass className="w-4 h-4 text-cyan-300" />,
    description: 'जग्गा नापजाँच ऐन तथा नियमावली, मालपोत ऐन तथा नियमावली, भूउपयोग ऐन तथा नियमावली, र भूमि प्रशासन निर्देशिका सम्बन्धी ९ मूल दस्तावेजहरू (९३६ रेकर्ड)।',
  },
];

export default function App() {
  const allRows: LegalRow[] = allRowsData as LegalRow[];
  const constitutionRows: LegalRow[] = constitutionRowsData as LegalRow[];
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

  // Gemini Analyzer state
  const [geminiAnalyzerOpen, setGeminiAnalyzerOpen] = useState(false);
  const [geminiDocPath, setGeminiDocPath] = useState('pdfs/१. संबिधान र मुलुकी संहिता/१.१. नेपालको संबिधान (२०७२-०६-०३).pdf');
  const [geminiPage, setGeminiPage] = useState('१');

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

  // Pre-selected document filter when user clicks from Directory
  const [selectedDocFilter, setSelectedDocFilter] = useState<string>('all');

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

  // Open PDF viewer at page
  const handleOpenPdf = (path: string, page: string) => {
    const doc = documents.find(d => d.path === path);
    setCurrentPdfPath(path);
    setCurrentPdfName(doc ? doc.filename : path.split('/').pop() || 'कागजात.pdf');
    setCurrentPdfPage(page || '1');
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

  // Open Gemini Header Analyzer modal
  const handleOpenGeminiAnalyzer = (docPath: string, page: string = '१') => {
    setGeminiDocPath(docPath);
    setGeminiPage(page);
    setGeminiAnalyzerOpen(true);
  };

  // Exports
  const handleExportExcelAll = (customRows?: LegalRow[]) => {
    const target = customRows || allRows;
    exportToExcel(target, 'Nepal_Legal_All_PDFs_10_Columns.xlsx');
  };

  const handleExportCsvAll = (customRows?: LegalRow[]) => {
    const target = customRows || allRows;
    exportToCsv(target, 'Nepal_Legal_All_PDFs_10_Columns.csv');
  };

  const handleExportJsonAll = () => {
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
        onExportExcel={() => handleExportExcelAll()}
        onExportCsv={() => handleExportCsvAll()}
        onExportJson={handleExportJsonAll}
        onOpenGeminiAnalyzer={() => handleOpenGeminiAnalyzer('pdfs/१. संबिधान र मुलुकी संहिता/१.१. नेपालको संबिधान (२०७२-०६-०३).pdf', '१')}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 space-y-5">
        {/* Navigation Tabs Header across All Folders in serial order (१. to १२.) */}
        <div className="bg-white rounded-xl border border-slate-200 p-1.5 shadow-sm flex flex-wrap gap-1.5">
          {/* All Folder Buttons (१. to १२.) */}
          {FOLDERS_CONFIG.map(f => {
            const isSelected = activeTab === f.id;

            return (
              <button
                key={f.id}
                onClick={() => setActiveTab(f.id)}
                className={`flex-1 min-w-[130px] flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-md ring-2 ring-indigo-500/40'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {f.icon}
                <span>{f.shortLabel}</span>
              </button>
            );
          })}

          {/* Master Table Tab */}
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg font-bold text-xs sm:text-sm transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white shadow-md ring-2 ring-indigo-500/40'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Database className="w-4 h-4 text-blue-400" />
            <span>मास्टर तालिका</span>
          </button>

          {/* MD Sync Tab */}
          <button
            onClick={() => setActiveTab('md-sync')}
            className={`flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg font-bold text-xs sm:text-sm transition-all cursor-pointer ${
              activeTab === 'md-sync'
                ? 'bg-slate-900 text-white shadow-md ring-2 ring-indigo-500/40'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Columns className="w-4 h-4 text-amber-300" />
            <span>MD + PDF सिंक</span>
          </button>

          {/* Directory Tab */}
          <button
            onClick={() => setActiveTab('directory')}
            className={`flex-1 min-w-[110px] flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg font-bold text-xs sm:text-sm transition-all cursor-pointer ${
              activeTab === 'directory'
                ? 'bg-slate-900 text-white shadow-md ring-2 ring-indigo-500/40'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FolderTree className="w-4 h-4 text-emerald-400" />
            <span>डाइरेक्टरी</span>
          </button>
        </div>

        {/* Unified Folder Window: Consistently Renders ANY Selected Folder with Identical Interface & Master Table */}
        {activeFolderConfig && (
          <UnifiedFolderView
            key={activeFolderConfig.id}
            folderId={activeFolderConfig.folderId}
            folderName={activeFolderConfig.folderName}
            themeColor={activeFolderConfig.themeColor}
            icon={activeFolderConfig.icon}
            description={activeFolderConfig.description}
            allRows={allRows}
            documents={documents}
            onOpenPdf={handleOpenPdf}
            onOpenMdSync={handleOpenInMdSync}
            onOpenModal={handleOpenModal}
            onOpenGeminiAnalyzer={handleOpenGeminiAnalyzer}
          />
        )}

        {/* Master 10-Column Table across ALL Folders */}
        {activeTab === 'all' && (
          <TenColumnTable
            rows={allRows}
            documents={documents}
            onOpenModal={r => handleOpenModal(r, allRows)}
            onOpenPdf={handleOpenPdf}
            onOpenMdSync={handleOpenInMdSync}
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
            onOpen10ColumnTable={handleSelectDocFromDirectory}
          />
        )}

        {/* Folder and Subfolder Directory */}
        {activeTab === 'directory' && (
          <DirectoryView
            documents={documents}
            onSelectDoc={handleSelectDocFromDirectory}
            onOpenPdf={handleOpenPdf}
            onOpenMdSync={handleOpenInMdSync}
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
        />
      )}

      {/* Gemini AI Header & Style Analyzer Modal */}
      <GeminiHeaderAnalyzerModal
        isOpen={geminiAnalyzerOpen}
        onClose={() => setGeminiAnalyzerOpen(false)}
        documents={documents}
        defaultDocPath={geminiDocPath}
        defaultPage={geminiPage}
        onOpenPdf={handleOpenPdf}
        onFilterTableDoc={handleSelectDocFromDirectory}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-8 text-xs text-slate-500 text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            नेपाल कानून, संबिधान र मुलुकी संहिता १०-स्तम्भ डेटा पोर्टल • रिपोजिटरी: <code className="text-slate-700 font-semibold">barshapbp2026/any-pdf-</code>
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
