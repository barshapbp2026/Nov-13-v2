import React, { useState, useMemo } from 'react';
import { 
  FileText, Search, ExternalLink, Download, FileSpreadsheet, Eye, 
  Sparkles, CheckCircle2, Bookmark, Columns, Filter, ShieldCheck, ArrowRight, Layers, Scale
} from 'lucide-react';
import { LegalRow, DocumentSummary } from '../types';
import { exportToExcel, exportToCsv } from '../utils/exportUtils';

interface AdhyadeshFocusViewProps {
  allRows: LegalRow[];
  documents: DocumentSummary[];
  onOpenPdf: (path: string, page: string) => void;
  onOpenMdSync?: (filename: string, page?: string) => void;
  onOpenModal: (row: LegalRow) => void;
  onOpenGeminiAnalyzer: (docPath: string, page?: string) => void;
}

export const AdhyadeshFocusView: React.FC<AdhyadeshFocusViewProps> = ({
  allRows,
  documents,
  onOpenPdf,
  onOpenMdSync,
  onOpenModal,
  onOpenGeminiAnalyzer,
}) => {
  // Extract all rows from Folder 3 (३. अध्यादेश)
  const adhyadeshRows = useMemo(() => {
    return allRows.filter(r => r.folder_id === '३.' || r.folder_name === '३. अध्यादेश');
  }, [allRows]);

  // Unique 3 Adhyadesh PDFs
  const adhyadeshDocs = useMemo(() => {
    return documents.filter(d => d.folderName.includes('अध्यादेश') || d.folderId === '३.');
  }, [documents]);

  const [selectedDoc, setSelectedDoc] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [styleFilter, setStyleFilter] = useState<'all' | 'bold_and_underline' | 'underline_only' | 'bold_only'>('all');

  const filteredRows = useMemo(() => {
    return adhyadeshRows.filter(r => {
      if (selectedDoc !== 'all' && r.pdf_name !== selectedDoc) return false;
      if (styleFilter !== 'all' && r.legal_style !== styleFilter) return false;
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase().trim();
      return (
        r.section_id.toLowerCase().includes(q) ||
        r.title_name.toLowerCase().includes(q) ||
        r.title_page.toLowerCase().includes(q) ||
        r.pdf_name.toLowerCase().includes(q) ||
        r.subfolder_name.toLowerCase().includes(q)
      );
    });
  }, [adhyadeshRows, selectedDoc, styleFilter, searchTerm]);

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

  // Convert English number to Devanagari string
  const toDevaNum = (n: number | string) => {
    const devDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
    return String(n).replace(/[0-9]/g, d => devDigits[parseInt(d, 10)]);
  };

  return (
    <div className="space-y-5">
      {/* Hero Banner for 3 Adhyadesh PDFs */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-teal-950 rounded-2xl p-5 sm:p-7 text-white border border-emerald-900/40 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 text-xs font-semibold mb-3">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>३. अध्यादेश फोल्डर — ३ वटा अध्यादेशहरूको क्रिस्टल क्लियर मास्टर डाटा</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
              ३. अध्यादेश: ३ वटा अध्यादेशहरू (दफा, संशोधित ऐन, शीर्षक र PDF पृष्ठ)
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
              नेपाल कानून आयोग तथा नेपाल राजपत्रको मूल PDF बाट हुबहु प्रमाणित ३ कानूनी हेडिङ शैलीहरू (१. Bold &amp; Underline, २. Underline मात्र, ३. Bold मात्र) अनुसार कुनै पनि फन्ट नमिल्ने समस्या (OCR त्रुटि) बिना शतप्रतिशत शुद्ध नेपाली युनिकोडमा संकलित।
            </p>

            <div className="flex flex-wrap gap-2 mt-4 text-xs font-mono text-slate-300">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                कुल अध्यादेशहरू: <strong className="text-amber-300">३ वटा</strong>
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                कुल प्रमाणित रेकर्डहरू: <strong className="text-emerald-300">{adhyadeshRows.length} वटा</strong>
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                फोल्डर: <span className="text-slate-300 font-sans">३. अध्यादेश (३ उप-फोल्डरहरू)</span>
              </span>
            </div>
          </div>

          <div className="flex sm:flex-col gap-2 shrink-0">
            <button
              onClick={() => onOpenGeminiAnalyzer(adhyadeshDocs[0]?.path || 'pdfs/३. अध्यादेश/३.१. केहि नेपाल ऐन सम्बन्धि अध्यादेश/केही नेपाल ऐन संशोधन गर्ने अध्यादेश, २०८३-०१-२०.pdf', '१')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-950/40 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Gemini AI हेडर विश्लेषण</span>
            </button>
            <button
              onClick={() => {
                const doc = adhyadeshDocs[0];
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

      {/* 3 Adhyadesh Subfolder Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: 3.1 Some Nepal Acts */}
        <div 
          onClick={() => setSelectedDoc(selectedDoc === 'केही नेपाल ऐन संशोधन गर्ने अध्यादेश, २०८३-०१-२०.pdf' ? 'all' : 'केही नेपाल ऐन संशोधन गर्ने अध्यादेश, २०८३-०१-२०.pdf')}
          className={`bg-white rounded-xl p-4 border transition-all cursor-pointer shadow-sm relative overflow-hidden ${
            selectedDoc === 'केही नेपाल ऐन संशोधन गर्ने अध्यादेश, २०८३-०१-२०.pdf'
              ? 'border-emerald-600 ring-2 ring-emerald-500/30 bg-emerald-50/20'
              : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              ३.१. उप-फोल्डर
            </span>
            <span className="text-xs font-mono text-slate-500 font-semibold">१३ पृष्ठ</span>
          </div>
          <h3 className="text-sm font-bold text-slate-900 mt-2 line-clamp-2">
            केही नेपाल ऐन संशोधन गर्ने अध्यादेश, २०८३-०१-२०
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            कर्मचारी सञ्चय कोष, जग्गा नापजाँच, भूमिसुधार, मालपोत, शिक्षा, निजामती, वन, भूउपयोग लगायत २० वटा ऐनहरूमा संशोधन
          </p>
          <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-100">
            <span className="font-semibold text-emerald-700">
              {adhyadeshRows.filter(r => r.pdf_name.includes('केही नेपाल ऐन')).length} वटा रेकर्डहरू
            </span>
            <span className="text-slate-400 text-[11px] font-sans">क्लिक गरी फिल्टर</span>
          </div>
        </div>

        {/* Card 2: 3.2 Forest Ordinance */}
        <div 
          onClick={() => setSelectedDoc(selectedDoc === 'वन सम्बन्धी केही नेपाल ऐनलाई संशोधन गर्ने अध्यादेश, २०८३-०६-२७.pdf' ? 'all' : 'वन सम्बन्धी केही नेपाल ऐनलाई संशोधन गर्ने अध्यादेश, २०८३-०६-२७.pdf')}
          className={`bg-white rounded-xl p-4 border transition-all cursor-pointer shadow-sm relative overflow-hidden ${
            selectedDoc === 'वन सम्बन्धी केही नेपाल ऐनलाई संशोधन गर्ने अध्यादेश, २०८३-०६-२७.pdf'
              ? 'border-emerald-600 ring-2 ring-emerald-500/30 bg-emerald-50/20'
              : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800">
              ३.२. उप-फोल्डर
            </span>
            <span className="text-xs font-mono text-slate-500 font-semibold">२८ पृष्ठ</span>
          </div>
          <h3 className="text-sm font-bold text-slate-900 mt-2 line-clamp-2">
            वन सम्बन्धी केही नेपाल ऐनलाई संशोधन गर्ने अध्यादेश, २०८३-०६-२७
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            वन ऐन २०७६ र राष्ट्रिय निकुञ्ज ऐन २०२९ मा संशोधन (पर्यावरण पर्यटन, कबुलियती वन, जैविक मार्ग, राष्ट्रिय गौरव आयोजना)
          </p>
          <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-100">
            <span className="font-semibold text-teal-700">
              {adhyadeshRows.filter(r => r.pdf_name.includes('वन सम्बन्धी')).length} वटा रेकर्डहरू
            </span>
            <span className="text-slate-400 text-[11px] font-sans">क्लिक गरी फिल्टर</span>
          </div>
        </div>

        {/* Card 3: 3.3 Land Ordinance */}
        <div 
          onClick={() => setSelectedDoc(selectedDoc === 'भूमि सम्बन्धी केही नेपाल ऐन संशोधन गर्ने अध्यादेश, २०८३-०६-२७.pdf' ? 'all' : 'भूमि सम्बन्धी केही नेपाल ऐन संशोधन गर्ने अध्यादेश, २०८३-०६-२७.pdf')}
          className={`bg-white rounded-xl p-4 border transition-all cursor-pointer shadow-sm relative overflow-hidden ${
            selectedDoc === 'भूमि सम्बन्धी केही नेपाल ऐन संशोधन गर्ने अध्यादेश, २०८३-०६-२७.pdf'
              ? 'border-emerald-600 ring-2 ring-emerald-500/30 bg-emerald-50/20'
              : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
              ३.३. उप-फोल्डर
            </span>
            <span className="text-xs font-mono text-slate-500 font-semibold">१४ पृष्ठ</span>
          </div>
          <h3 className="text-sm font-bold text-slate-900 mt-2 line-clamp-2">
            भूमि सम्बन्धी केही नेपाल ऐन संशोधन गर्ने अध्यादेश, २०८३-०६-२७
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            जग्गा नापजाँच, भूमिसुधार (दफा ५२ख, ५२ग, ५२घ), गुठी, मालपोत (स्थानीय तहबाट लिखत रजिष्ट्रेशन), भूउपयोग ऐन संशोधन
          </p>
          <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-100">
            <span className="font-semibold text-blue-700">
              {adhyadeshRows.filter(r => r.pdf_name.includes('भूमि सम्बन्धी')).length} वटा रेकर्डहरू
            </span>
            <span className="text-slate-400 text-[11px] font-sans">क्लिक गरी फिल्टर</span>
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
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-slate-700"
            >
              <option value="all">सबै ३ अध्यादेशहरू ({adhyadeshRows.length} रेकर्ड)</option>
              <option value="केही नेपाल ऐन संशोधन गर्ने अध्यादेश, २०८३-०१-२०.pdf">
                ३.१. केही नेपाल ऐन संशोधन गर्ने अध्यादेश ({adhyadeshRows.filter(r => r.pdf_name.includes('केही नेपाल ऐन')).length})
              </option>
              <option value="वन सम्बन्धी केही नेपाल ऐनलाई संशोधन गर्ने अध्यादेश, २०८३-०६-२७.pdf">
                ३.२. वन सम्बन्धी अध्यादेश ({adhyadeshRows.filter(r => r.pdf_name.includes('वन सम्बन्धी')).length})
              </option>
              <option value="भूमि सम्बन्धी केही नेपाल ऐन संशोधन गर्ने अध्यादेश, २०८३-०६-२७.pdf">
                ३.३. भूमि सम्बन्धी अध्यादेश ({adhyadeshRows.filter(r => r.pdf_name.includes('भूमि सम्बन्धी')).length})
              </option>
            </select>
          </div>

          {/* Style Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">शैली:</span>
            <select
              value={styleFilter}
              onChange={e => setStyleFilter(e.target.value as any)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-slate-700"
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
              placeholder="दफा, संशोधित ऐन, विषय वा पृष्ठ खोज्नुहोस्..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
        </div>

        {/* Action Buttons: Export */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportToExcel(filteredRows, 'Nepal_Adhyadesh_Folder3_Master_Data.xlsx')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel ({filteredRows.length})</span>
          </button>
          <button
            onClick={() => exportToCsv(filteredRows, 'Nepal_Adhyadesh_Folder3_Master_Data.csv')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* 10-Column Master Table for 3 Adhyadesh */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-emerald-600" />
            <span className="font-bold text-slate-800">
              अध्यादेश १०-स्तम्भ मास्टर डाटा तालिका
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
                <th className="py-2.5 px-3 w-20 text-center">२. Subfolder ID</th>
                <th className="py-2.5 px-3 min-w-[120px]">३. Folder Name</th>
                <th className="py-2.5 px-3 min-w-[170px]">४. Subfolder Name</th>
                <th className="py-2.5 px-3 w-24 text-center">५. दफा / संशोधन ID</th>
                <th className="py-2.5 px-3 min-w-[320px]">६. शीर्षक Name</th>
                <th className="py-2.5 px-3 w-24 text-center">७. PDF पृष्ठ</th>
                <th className="py-2.5 px-3 w-36 text-center">कानूनी हेडिङ ढाँचा</th>
                <th className="py-2.5 px-3 w-36 text-center">कार्य (Actions)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    कुनै रेकर्ड फेला परेन। खोज वा फिल्टर परिवर्तन गर्नुहोस्।
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => (
                  <tr 
                    key={`${row.folder_id}-${row.subfolder_id}-${row.section_id}-${idx}`}
                    className="hover:bg-emerald-50/40 transition-colors group"
                  >
                    {/* S.N. */}
                    <td className="py-2.5 px-3 text-center font-mono text-slate-500 font-medium">
                      {toDevaNum(idx + 1)}
                    </td>

                    {/* Folder ID */}
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700">
                      {row.folder_id}
                    </td>

                    {/* Subfolder ID */}
                    <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                      {row.subfolder_id}
                    </td>

                    {/* Folder Name */}
                    <td className="py-2.5 px-3 text-slate-800 font-medium whitespace-nowrap">
                      {row.folder_name}
                    </td>

                    {/* Subfolder Name */}
                    <td className="py-2.5 px-3 text-slate-600 text-[11px] leading-tight">
                      {row.subfolder_name}
                    </td>

                    {/* Dafa / Amendment ID */}
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-slate-100 text-slate-800 border border-slate-300">
                        {row.section_id}
                      </span>
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
                          {row.title_name}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5 font-mono line-clamp-1">
                          {row.pdf_name}
                        </span>
                      </div>
                    </td>

                    {/* PDF Page with direct Jump */}
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => onOpenPdf(row.pdf_path, row.title_page || '१')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-emerald-100 hover:text-emerald-900 text-slate-700 font-mono text-xs font-semibold border border-slate-200 transition-all cursor-pointer group-hover:border-emerald-300"
                        title="PDF को यस पृष्ठमा तुरुन्त जानुहोस्"
                      >
                        <span>पृष्ठ {row.title_page || '१'}</span>
                        <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-emerald-600" />
                      </button>
                    </td>

                    {/* Legal Style Badge */}
                    <td className="py-2.5 px-3 text-center">
                      {renderStyleBadge(row.legal_style)}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onOpenPdf(row.pdf_path, row.title_page || '१')}
                          className="p-1 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
                          title="PDF मा हेर्नुहोस्"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {onOpenMdSync && (
                          <button
                            onClick={() => onOpenMdSync(row.pdf_name, row.title_page || '१')}
                            className="p-1 rounded hover:bg-indigo-100 text-indigo-600 hover:text-indigo-900 transition-all cursor-pointer"
                            title="MD + PDF सिंक हेर्नुहोस्"
                          >
                            <Columns className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => onOpenGeminiAnalyzer(row.pdf_path, row.title_page || '१')}
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
