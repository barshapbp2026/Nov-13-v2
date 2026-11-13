import React, { useState, useMemo } from 'react';
import { 
  FileText, Search, ExternalLink, Download, FileSpreadsheet, Eye, 
  Sparkles, CheckCircle2, Bookmark, Columns, Filter, ShieldCheck, ArrowRight, Layers, BookMarked
} from 'lucide-react';
import { LegalRow, DocumentSummary } from '../types';
import { exportToExcel, exportToCsv } from '../utils/exportUtils';

interface NiyamawaliFocusViewProps {
  allRows: LegalRow[];
  documents: DocumentSummary[];
  onOpenPdf: (path: string, page: string) => void;
  onOpenMdSync?: (filename: string, page?: string) => void;
  onOpenModal: (row: LegalRow) => void;
  onOpenGeminiAnalyzer: (docPath: string, page?: string) => void;
}

export const NiyamawaliFocusView: React.FC<NiyamawaliFocusViewProps> = ({
  allRows,
  documents,
  onOpenPdf,
  onOpenMdSync,
  onOpenModal,
  onOpenGeminiAnalyzer,
}) => {
  // Extract all rows from Folder 4 (४. नियमावली)
  const niyamawaliRows = useMemo(() => {
    return allRows.filter(r => r.folder_id === '४.' || r.folder_name === '४. नियमावली');
  }, [allRows]);

  // Unique 4 Niyamawali PDFs
  const niyamawaliDocs = useMemo(() => {
    return documents.filter(d => d.folderName.includes('नियमावली') || d.folderId === '४.');
  }, [documents]);

  const [selectedDoc, setSelectedDoc] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'नियम' | 'अनुसूची'>('all');
  const [styleFilter, setStyleFilter] = useState<'all' | 'bold_and_underline' | 'underline_only' | 'bold_only'>('all');

  const filteredRows = useMemo(() => {
    return niyamawaliRows.filter(r => {
      if (selectedDoc !== 'all' && r.pdf_name !== selectedDoc) return false;
      if (typeFilter !== 'all') {
        if (typeFilter === 'अनुसूची' && !r.anusuchi_id) return false;
        if (typeFilter === 'नियम' && r.anusuchi_id) return false;
      }
      if (styleFilter !== 'all' && r.legal_style !== styleFilter) return false;
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase().trim();
      return (
        r.section_id.toLowerCase().includes(q) ||
        r.title_name.toLowerCase().includes(q) ||
        r.title_page.toLowerCase().includes(q) ||
        r.anusuchi_id.toLowerCase().includes(q) ||
        r.anusuchi_title.toLowerCase().includes(q) ||
        r.anusuchi_print_page.toLowerCase().includes(q) ||
        r.pdf_name.toLowerCase().includes(q)
      );
    });
  }, [niyamawaliRows, selectedDoc, typeFilter, styleFilter, searchTerm]);

  // Style badge helper
  const renderStyleBadge = (style?: string) => {
    switch (style) {
      case 'bold_and_underline':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
            १. Bold + Underline
          </span>
        );
      case 'underline_only':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-100 text-blue-900 border border-blue-300 underline">
            २. Underline मात्र
          </span>
        );
      case 'bold_only':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
            ३. Bold मात्र
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-100 text-purple-900 border border-purple-300">
            १. Bold + Underline
          </span>
        );
    }
  };

  // Convert number to Devanagari string
  const toDevaNum = (n: number | string) => {
    const devDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
    return String(n).replace(/[0-9]/g, d => devDigits[parseInt(d, 10)]);
  };

  return (
    <div className="space-y-5">
      {/* Hero Banner for 4 Niyamawali PDFs */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-orange-950 rounded-2xl p-5 sm:p-7 text-white border border-amber-900/40 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/30 text-amber-200 border border-amber-400/30 text-xs font-semibold mb-3">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>४. नियमावली फोल्डर — ४ वटा नियमावलीहरूको क्रिस्टल क्लियर मास्टर डाटा</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
              ४. नियमावली: ४ वटा नियमावलीहरू (नियम, शीर्षक, अनुसूची र PDF पृष्ठ)
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
              नेपाल कानून आयोग तथा नेपाल राजपत्रबाट प्रमाणित ३ कानूनी हेडिङ ढाँचाहरू (१. Bold &amp; Underline, २. Underline मात्र, ३. Bold मात्र) अनुसार कुनै पनि फन्ट नमिल्ने समस्या (OCR त्रुटि) बिना शतप्रतिशत शुद्ध नेपाली युनिकोडमा संकलित।
            </p>

            <div className="flex flex-wrap gap-2 mt-4 text-xs font-mono text-slate-300">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                कुल नियमावलीहरू: <strong className="text-amber-300">४ वटा</strong>
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                कुल प्रमाणित रेकर्डहरू: <strong className="text-emerald-300">{niyamawaliRows.length} वटा</strong>
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                अनुसूचीहरू: <strong className="text-cyan-300">{niyamawaliRows.filter(r => r.anusuchi_id).length} वटा</strong>
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                फोल्डर: <span className="text-slate-300 font-sans">४. नियमावली</span>
              </span>
            </div>
          </div>

          <div className="flex sm:flex-col gap-2 shrink-0">
            <button
              onClick={() => onOpenGeminiAnalyzer(niyamawaliDocs[0]?.path || 'pdfs/४. नियमावली/मालपोत (नवौं संसोधन २०८३) नियमावली २०३६, २०८३-०२-२८.pdf', '१')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-amber-950/40 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-200" />
              <span>Gemini AI हेडर विश्लेषण</span>
            </button>
            <button
              onClick={() => {
                const doc = niyamawaliDocs[0];
                if (doc && onOpenMdSync) onOpenMdSync(doc.filename, '१');
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs sm:text-sm font-semibold transition-all cursor-pointer"
            >
              <Columns className="w-4 h-4 text-indigo-400" />
              <span>MD + PDF सिंक हेर्नुहोस्</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Niyamawali Document Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: उखडा सम्बन्धी नियमहरू */}
        <div 
          onClick={() => setSelectedDoc(selectedDoc.includes('उखडा') ? 'all' : niyamawaliRows.find(r => r.pdf_name.includes('उखडा'))?.pdf_name || 'all')}
          className={`bg-white rounded-xl p-4 border transition-all cursor-pointer shadow-sm relative overflow-hidden ${
            selectedDoc.includes('उखडा')
              ? 'border-amber-600 ring-2 ring-amber-500/30 bg-amber-50/20'
              : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
              ११ पृष्ठ
            </span>
            <span className="text-xs font-mono text-emerald-700 font-bold">४ अनुसूची</span>
          </div>
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 mt-2 line-clamp-2">
            उखडा सम्बन्धी नियमहरू, २०२१
          </h3>
          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
            उखडा जग्गाको लगत, इस्तहार सूचना, हक बेहक, क्षतिपूर्ति भरपाई र दर्ता प्रमाणपुर्जा
          </p>
          <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-100">
            <span className="font-semibold text-amber-700">
              {niyamawaliRows.filter(r => r.pdf_name.includes('उखडा')).length} रेकर्डहरू
            </span>
            <span className="text-slate-400 text-[10px]">क्लिक गरी फिल्टर</span>
          </div>
        </div>

        {/* Card 2: जग्गा नाप जाँच नियमावली */}
        <div 
          onClick={() => setSelectedDoc(selectedDoc.includes('नाप') ? 'all' : niyamawaliRows.find(r => r.pdf_name.includes('नाप'))?.pdf_name || 'all')}
          className={`bg-white rounded-xl p-4 border transition-all cursor-pointer shadow-sm relative overflow-hidden ${
            selectedDoc.includes('नाप')
              ? 'border-amber-600 ring-2 ring-amber-500/30 bg-amber-50/20'
              : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
              ४७ पृष्ठ
            </span>
            <span className="text-xs font-mono text-emerald-700 font-bold">१६ अनुसूची</span>
          </div>
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 mt-2 line-clamp-2">
            जग्गा नाप जाँच नियमावली, २०५८ (दोस्रो संशोधन)
          </h3>
          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
            नियम १ देखि ३८ सम्म, क्षेत्रीय किताब, फिल्डबुक, कित्ता स्रेस्ता, पुर्जा, कित्ताकाट, भूसूचना प्रणाली र १६ अनुसूचीहरू
          </p>
          <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-100">
            <span className="font-semibold text-blue-700">
              {niyamawaliRows.filter(r => r.pdf_name.includes('नाप')).length} रेकर्डहरू
            </span>
            <span className="text-slate-400 text-[10px]">क्लिक गरी फिल्टर</span>
          </div>
        </div>

        {/* Card 3: भूउपयोग नियमावली */}
        <div 
          onClick={() => setSelectedDoc(selectedDoc.includes('भूउपयोग') ? 'all' : niyamawaliRows.find(r => r.pdf_name.includes('भूउपयोग'))?.pdf_name || 'all')}
          className={`bg-white rounded-xl p-4 border transition-all cursor-pointer shadow-sm relative overflow-hidden ${
            selectedDoc.includes('भूउपयोग')
              ? 'border-amber-600 ring-2 ring-amber-500/30 bg-amber-50/20'
              : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              २५ पृष्ठ
            </span>
            <span className="text-xs font-mono text-emerald-700 font-bold">४ अनुसूची</span>
          </div>
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 mt-2 line-clamp-2">
            भूउपयोग नियमावली, २०७९ (तेस्रो संशोधन)
          </h3>
          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
            भूउपयोग क्षेत्र वर्गीकरणका आधार र मापदण्ड (कृषि, आवासीय, खानी...), कित्ताकाट सीमा र भूमि बैंक
          </p>
          <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-100">
            <span className="font-semibold text-emerald-700">
              {niyamawaliRows.filter(r => r.pdf_name.includes('भूउपयोग')).length} रेकर्डहरू
            </span>
            <span className="text-slate-400 text-[10px]">क्लिक गरी फिल्टर</span>
          </div>
        </div>

        {/* Card 4: मालपोत नियमावली */}
        <div 
          onClick={() => setSelectedDoc(selectedDoc.includes('मालपोत') ? 'all' : niyamawaliRows.find(r => r.pdf_name.includes('मालपोत'))?.pdf_name || 'all')}
          className={`bg-white rounded-xl p-4 border transition-all cursor-pointer shadow-sm relative overflow-hidden ${
            selectedDoc.includes('मालपोत')
              ? 'border-amber-600 ring-2 ring-amber-500/30 bg-amber-50/20'
              : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
              ९६ पृष्ठ
            </span>
            <span className="text-xs font-mono text-emerald-700 font-bold">२१ अनुसूची</span>
          </div>
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 mt-2 line-clamp-2">
            मालपोत नियमावली, २०३६ (नवौं संशोधन)
          </h3>
          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
            अनलाइन लिखत रजिस्ट्रेसन, रोक्का/फुकुवा, सरकारी जग्गा लिज, छुट जग्गा दर्ता र घरजग्गा व्यवसायी लाइसेन्स
          </p>
          <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-100">
            <span className="font-semibold text-purple-700">
              {niyamawaliRows.filter(r => r.pdf_name.includes('मालपोत')).length} रेकर्डहरू
            </span>
            <span className="text-slate-400 text-[10px]">क्लिक गरी फिल्टर</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          {/* Document Select */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedDoc}
              onChange={e => setSelectedDoc(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none font-medium text-slate-700"
            >
              <option value="all">सबै ४ नियमावलीहरू ({niyamawaliRows.length} रेकर्ड)</option>
              {niyamawaliDocs.map(d => (
                <option key={d.path} value={d.filename}>
                  {d.filename} ({niyamawaliRows.filter(r => r.pdf_name === d.filename).length})
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">प्रकार:</span>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as any)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none font-medium text-slate-700"
            >
              <option value="all">नियम तथा अनुसूची सबै</option>
              <option value="नियम">नियमहरू मात्र ({niyamawaliRows.filter(r => !r.anusuchi_id).length})</option>
              <option value="अनुसूची">अनुसूचीहरू मात्र ({niyamawaliRows.filter(r => r.anusuchi_id).length})</option>
            </select>
          </div>

          {/* Style Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">शैली:</span>
            <select
              value={styleFilter}
              onChange={e => setStyleFilter(e.target.value as any)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none font-medium text-slate-700"
            >
              <option value="all">सबै ३ कानूनी शैलीहरू</option>
              <option value="bold_and_underline">१. Bold + Underline</option>
              <option value="underline_only">२. Underline मात्र</option>
              <option value="bold_only">३. Bold मात्र</option>
            </select>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="नियम नं., शीर्षक, अनुसूची वा पृष्ठ खोज्नुहोस्..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>
        </div>

        {/* Action Buttons: Export */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportToExcel(filteredRows, 'Nepal_Niyamawali_Folder4_Master_Data.xlsx')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel ({filteredRows.length})</span>
          </button>
          <button
            onClick={() => exportToCsv(filteredRows, 'Nepal_Niyamawali_Folder4_Master_Data.csv')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* 10-Column Master Table for 4 Niyamawali */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <BookMarked className="w-4 h-4 text-amber-600" />
            <span className="font-bold text-slate-800">
              नियमावली १०-स्तम्भ मास्टर डाटा तालिका
            </span>
            <span>•</span>
            <span>जम्मा रेकर्ड: <strong className="text-slate-900 font-mono">{filteredRows.length}</strong></span>
          </div>
          <span className="text-[11px] text-slate-500 font-sans">
            नेपाल कानून आयोग तथा नेपाल राजपत्र प्रमाणीकरण
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold select-none">
                <th className="py-2.5 px-3 w-12 text-center">क्र.सं.</th>
                <th className="py-2.5 px-3 w-16 text-center">१. Folder ID</th>
                <th className="py-2.5 px-3 min-w-[120px]">३. Folder Name</th>
                <th className="py-2.5 px-3 w-24 text-center">५. नियम ID</th>
                <th className="py-2.5 px-3 min-w-[280px]">६. नियम / शीर्षक Name</th>
                <th className="py-2.5 px-3 w-24 text-center">७. PDF पृष्ठ</th>
                <th className="py-2.5 px-3 w-28 text-center">८. अनुसूची ID</th>
                <th className="py-2.5 px-3 min-w-[240px]">९. अनुसूची Title</th>
                <th className="py-2.5 px-3 w-24 text-center">१०. Print Page</th>
                <th className="py-2.5 px-3 w-32 text-center">कानूनी हेडिङ ढाँचा</th>
                <th className="py-2.5 px-3 w-32 text-center">कार्य (Actions)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400">
                    कुनै रेकर्ड फेला परेन। खोज वा फिल्टर परिवर्तन गर्नुहोस्।
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => (
                  <tr 
                    key={`${row.folder_id}-${row.pdf_name}-${row.section_id}-${row.anusuchi_id}-${idx}`}
                    className={`hover:bg-amber-50/40 transition-colors group ${
                      row.anusuchi_id ? 'bg-emerald-50/20' : ''
                    }`}
                  >
                    {/* S.N. */}
                    <td className="py-2.5 px-3 text-center font-mono text-slate-500 font-medium">
                      {toDevaNum(idx + 1)}
                    </td>

                    {/* Folder ID */}
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700">
                      {row.folder_id}
                    </td>

                    {/* Folder Name */}
                    <td className="py-2.5 px-3 text-slate-800 font-medium whitespace-nowrap">
                      {row.folder_name}
                    </td>

                    {/* Niyam ID */}
                    <td className="py-2.5 px-3 text-center">
                      {row.section_id ? (
                        <span className="inline-block px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-slate-100 text-slate-800 border border-slate-300">
                          {row.section_id}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Title Name with legal style rendering */}
                    <td className="py-2.5 px-3">
                      <div className="flex flex-col">
                        <span className={`text-[12px] leading-snug ${
                          row.legal_style === 'bold_and_underline'
                            ? 'font-bold underline text-slate-950 decoration-slate-800 decoration-1 underline-offset-2'
                            : row.legal_style === 'underline_only'
                            ? 'font-medium underline text-blue-950 decoration-blue-700 decoration-1 underline-offset-2'
                            : 'font-bold text-slate-900'
                        }`}>
                          {row.title_name || (row.anusuchi_id ? row.anusuchi_title : '')}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5 font-mono line-clamp-1">
                          {row.pdf_name}
                        </span>
                      </div>
                    </td>

                    {/* Title Page */}
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => onOpenPdf(row.pdf_path, row.title_page || row.anusuchi_print_page || '१')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-amber-100 hover:text-amber-900 text-slate-700 font-mono text-xs font-semibold border border-slate-200 transition-all cursor-pointer group-hover:border-amber-300"
                        title="PDF को यस पृष्ठमा तुरुन्त जानुहोस्"
                      >
                        <span>पृष्ठ {row.title_page || row.anusuchi_print_page || '१'}</span>
                        <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-amber-600" />
                      </button>
                    </td>

                    {/* Anusuchi ID */}
                    <td className="py-2.5 px-3 text-center">
                      {row.anusuchi_id ? (
                        <span className="inline-block px-2 py-0.5 rounded font-bold text-[11px] bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono">
                          {row.anusuchi_id}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Anusuchi Title */}
                    <td className="py-2.5 px-3 text-[11px] text-slate-700 leading-snug">
                      {row.anusuchi_title || <span className="text-slate-300">-</span>}
                    </td>

                    {/* Anusuchi Print Page */}
                    <td className="py-2.5 px-3 text-center font-mono font-semibold text-emerald-800">
                      {row.anusuchi_print_page ? (
                        <button
                          onClick={() => onOpenPdf(row.pdf_path, row.anusuchi_print_page)}
                          className="px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 text-[11px] cursor-pointer"
                        >
                          पृष्ठ {row.anusuchi_print_page}
                        </button>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Legal Style Badge */}
                    <td className="py-2.5 px-3 text-center">
                      {renderStyleBadge(row.legal_style)}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onOpenPdf(row.pdf_path, row.title_page || row.anusuchi_print_page || '१')}
                          className="p-1 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
                          title="PDF मा हेर्नुहोस्"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {onOpenMdSync && (
                          <button
                            onClick={() => onOpenMdSync(row.pdf_name, row.title_page || row.anusuchi_print_page || '१')}
                            className="p-1 rounded hover:bg-indigo-100 text-indigo-600 hover:text-indigo-900 transition-all cursor-pointer"
                            title="MD + PDF सिंक हेर्नुहोस्"
                          >
                            <Columns className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => onOpenGeminiAnalyzer(row.pdf_path, row.title_page || row.anusuchi_print_page || '१')}
                          className="p-1 rounded hover:bg-purple-100 text-purple-600 hover:text-purple-900 transition-all cursor-pointer"
                          title="Gemini AI हेडर विश्लेषण"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onOpenModal(row)}
                          className="p-1 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
                          title="१०-स्तम्भ विवरण मोडल"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
