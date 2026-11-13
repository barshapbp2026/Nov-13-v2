import React, { useState, useMemo } from 'react';
import { 
  FileText, Search, ExternalLink, Download, FileSpreadsheet, Eye, 
  Sparkles, CheckCircle2, Bookmark, Columns, Filter, ShieldCheck, ArrowRight, Layers, Users, BookOpen, Scale, Compass, Award
} from 'lucide-react';
import { LegalRow, DocumentSummary } from '../types';
import { exportToExcel, exportToCsv } from '../utils/exportUtils';

interface MalpotNapiFocusViewProps {
  allRows: LegalRow[];
  documents: DocumentSummary[];
  onOpenPdf: (path: string, page: string) => void;
  onOpenMdSync?: (filename: string, page?: string) => void;
  onOpenModal: (row: LegalRow) => void;
  onOpenGeminiAnalyzer: (docPath: string, page?: string) => void;
}

export const MalpotNapiFocusView: React.FC<MalpotNapiFocusViewProps> = ({
  allRows,
  documents,
  onOpenPdf,
  onOpenMdSync,
  onOpenModal,
  onOpenGeminiAnalyzer,
}) => {
  // Extract all rows from Folder 12 (१२. मालपोत नापी सम्बन्धि ऐन नियम निर्देशिका कार्यविधि)
  const folder12Rows = useMemo(() => {
    return allRows.filter(r => r.folder_id === '१२.' || r.folder_name?.includes('मालपोत नापी'));
  }, [allRows]);

  // Unique Folder 12 PDFs
  const folder12Docs = useMemo(() => {
    return documents.filter(d => d.folderName?.includes('मालपोत नापी') || d.folderId === '१२.');
  }, [documents]);

  const [selectedDoc, setSelectedDoc] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'दफा' | 'अनुसूची'>('all');

  const filteredRows = useMemo(() => {
    return folder12Rows.filter(r => {
      if (selectedDoc !== 'all' && r.pdf_name !== selectedDoc) return false;

      if (typeFilter !== 'all') {
        if (typeFilter === 'अनुसूची' && !r.anusuchi_id) return false;
        if (typeFilter === 'दफा' && r.anusuchi_id) return false;
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
        r.pdf_name.toLowerCase().includes(q)
      );
    });
  }, [folder12Rows, selectedDoc, typeFilter, searchTerm]);

  const totalSections = useMemo(() => folder12Rows.filter(r => r.section_id && !r.anusuchi_id).length, [folder12Rows]);
  const totalSchedules = useMemo(() => folder12Rows.filter(r => r.anusuchi_id).length, [folder12Rows]);

  const toDevaNum = (n: number | string) => {
    const devDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
    return String(n).replace(/[0-9]/g, d => devDigits[parseInt(d, 10)]);
  };

  return (
    <div className="space-y-5">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-slate-900 via-cyan-950 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-cyan-700/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 text-xs font-semibold">
              <Compass className="w-3.5 h-3.5 text-cyan-300" />
              <span>फोल्डर १२ • मालपोत नापी सम्बन्धि ऐन नियम निर्देशिका कार्यविधि</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <span>१२. मालपोत नापी संग्रह - ८ मूल कानुनी दस्ताबेजहरू</span>
              <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                १००% सिङ्क्रोनाइज्ड
              </span>
            </h2>
            <p className="text-slate-300 text-sm max-w-3xl leading-relaxed">
              जग्गा नापजाँच ऐन तथा नियमावली, मालपोत ऐन तथा नियमावली, भूउपयोग ऐन तथा नियमावली, र भूमि प्रशासन निर्देशिका सम्बन्धी ८ वटा प्रमुख कानुनी दस्तावेजहरूको पूर्ण प्रमाणित संकलन। कुल ९३६ रेकर्डहरू (८२८ दफा/शीर्षक र १०८ अनुसूचीहरू) १०-स्तम्भ ढाँचामा पूर्ण रूपमा सिङ्क गरिएको छ।
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-cyan-200/90">
              <span className="flex items-center gap-1.5 bg-black/30 px-3 py-1.5 rounded-lg border border-cyan-500/20">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                कुल कागजात: <strong className="text-white">{toDevaNum(folder12Docs.length)} PDF</strong> (१२.५ MB)
              </span>
              <span className="flex items-center gap-1.5 bg-black/30 px-3 py-1.5 rounded-lg border border-cyan-500/20">
                <Bookmark className="w-4 h-4 text-amber-400" />
                दफा/शीर्षक: <strong className="text-white">{toDevaNum(totalSections)} वटा</strong>
              </span>
              <span className="flex items-center gap-1.5 bg-black/30 px-3 py-1.5 rounded-lg border border-cyan-500/20">
                <Layers className="w-4 h-4 text-purple-400" />
                अनुसूची: <strong className="text-white">{toDevaNum(totalSchedules)} वटा</strong>
              </span>
              <span className="flex items-center gap-1.5 bg-black/30 px-3 py-1.5 rounded-lg border border-cyan-500/20">
                <Columns className="w-4 h-4 text-cyan-300" />
                कुल रेकर्डहरू: <strong className="text-white">{toDevaNum(folder12Rows.length)} वटा</strong>
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
            <button
              onClick={() => onOpenGeminiAnalyzer(
                'pdfs/१२. मालपोत नापी सम्बन्धि ऐन नियम निर्देशिका कार्यविधि/१२.९. भूमि प्रशासन ( तेस्रो संसोधन २०८२) निर्देशिका २०८१, २०८२-१२-०६.pdf',
                '१'
              )}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-semibold text-xs shadow-lg shadow-purple-950/40 border border-purple-400/40 transition-all active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>AI हेडर विश्लेषक (Gemini)</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportToExcel(folder12Rows, 'Nepal_Legal_Folder12_Malpot_Napi.xlsx')}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs transition-all active:scale-95 cursor-pointer border border-emerald-500/40"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>
              <button
                onClick={() => exportToCsv(folder12Rows, 'Nepal_Legal_Folder12_Malpot_Napi.csv')}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-semibold text-xs transition-all active:scale-95 cursor-pointer border border-blue-500/40"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Document Selector */}
        <div className="w-full md:w-80">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            कागजात छान्नुहोस्
          </label>
          <select
            value={selectedDoc}
            onChange={e => setSelectedDoc(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-cyan-500 text-slate-800 font-medium"
          >
            <option value="all">सबै ८ कागजातहरू ({toDevaNum(folder12Rows.length)} रेकर्ड)</option>
            {folder12Docs.map(d => {
              const docRowsCount = folder12Rows.filter(r => r.pdf_name === d.filename).length;
              return (
                <option key={d.path} value={d.filename}>
                  {d.filename.replace('.pdf', '')} ({toDevaNum(docRowsCount)} रेकर्ड)
                </option>
              );
            })}
          </select>
        </div>

        {/* Search */}
        <div className="flex-1 w-full relative">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            दफा, शीर्षक वा अनुसूची खोज्नुहोस्
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="दफा नम्बर, शीर्षक नाम, अनुसूची ID वा पृष्ठ खोज्नुहोस्..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
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
              सबै ({toDevaNum(folder12Rows.length)})
            </button>
            <button
              onClick={() => setTypeFilter('दफा')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                typeFilter === 'दफा'
                  ? 'bg-cyan-700 text-white shadow-xs'
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

      {/* 8 Documents Grid Cards */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
          <h3 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-600" />
            <span>फोल्डर १२ का ८ प्रमुख कागजातहरूको सूची र स्थिति</span>
          </h3>
          <span className="text-xs text-slate-500">
            कुनै पनि कागजात चयन गर्न क्लिक गर्नुहोस्
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {folder12Docs.map(doc => {
            const isSelected = selectedDoc === doc.filename;
            const docRows = folder12Rows.filter(r => r.pdf_name === doc.filename);
            const dafaCount = docRows.filter(r => r.section_id && !r.anusuchi_id).length;
            const anusCount = docRows.filter(r => r.anusuchi_id).length;
            return (
              <div
                key={doc.path}
                onClick={() => setSelectedDoc(isSelected ? 'all' : doc.filename)}
                className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-cyan-600 bg-cyan-50/70 ring-2 ring-cyan-500/20 shadow-xs'
                    : 'border-slate-200 hover:border-cyan-300 hover:bg-slate-50/70'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-900">
                      {doc.category || 'ऐन/नियम'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {Math.round(doc.size / 1024)} KB
                    </span>
                  </div>
                  <div className="font-bold text-slate-900 text-xs line-clamp-2 leading-snug" title={doc.filename}>
                    {doc.filename.replace('.pdf', '')}
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="font-mono text-cyan-900 font-bold">
                    {toDevaNum(docRows.length)} रेकर्ड
                  </span>
                  <span className="text-slate-500">
                    {toDevaNum(dafaCount)} दफा • {toDevaNum(anusCount)} अनुसूची
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 10-Column Verified Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 text-xs sm:text-sm">
              १२. मालपोत नापी: प्रमाणित १०-स्तम्भ तालिका
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 font-semibold font-mono">
              {toDevaNum(filteredRows.length)} रेकर्डहरू
            </span>
          </div>
          <div className="text-[11px] text-slate-500 hidden sm:block">
            रो-मा क्लिक गरेर पूर्ण १० स्तम्भ मोडलमा विस्तृत विवरण हेर्नुहोस्
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200">
                <th className="py-2.5 px-3 font-bold text-center w-12">क्र.सं.</th>
                <th className="py-2.5 px-3 font-bold w-20">१. फोल्डर</th>
                <th className="py-2.5 px-3 font-bold w-20">२. सबफोल्डर</th>
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
                  <td colSpan={11} className="py-10 text-center text-slate-400">
                    कुनै रेकर्ड फेला परेन। खोज शब्द वा फिल्टर परिवर्तन गर्नुहोस्।
                  </td>
                </tr>
              ) : (
                filteredRows.slice(0, 300).map((row, idx) => {
                  const isAnusuchi = !!row.anusuchi_id;
                  return (
                    <tr
                      key={`${row.folder_id}-${row.pdf_name}-${row.section_id}-${row.anusuchi_id}-${idx}`}
                      onClick={() => onOpenModal(row)}
                      className={`hover:bg-cyan-50/60 cursor-pointer transition-colors ${
                        isAnusuchi ? 'bg-purple-50/20' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center text-slate-500 font-mono">
                        {toDevaNum(idx + 1)}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">
                        {row.folder_id}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 text-[11px]">
                        {row.subfolder_id || '-'}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-cyan-950">
                        {row.section_id || '-'}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        {row.title_name ? (
                          <span>{row.title_name}</span>
                        ) : (
                          <span className="text-slate-300 italic">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-700">
                        {row.title_page || '-'}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-purple-700">
                        {row.anusuchi_id ? (
                          <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[11px]">
                            {row.anusuchi_id}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-purple-950">
                        {row.anusuchi_title ? (
                          <span>{row.anusuchi_title}</span>
                        ) : (
                          <span className="text-slate-300 italic">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-purple-800 font-semibold">
                        {row.anusuchi_print_page || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 truncate max-w-[180px]" title={row.pdf_name}>
                        {row.pdf_name}
                      </td>
                      <td 
                        className="py-2.5 px-3 text-center"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onOpenPdf(row.pdf_path, row.anusuchi_print_page || row.title_page || '1')}
                            className="p-1 rounded hover:bg-slate-200 text-slate-600 hover:text-cyan-700 transition-colors"
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
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => onOpenModal(row)}
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
          {filteredRows.length > 300 && (
            <div className="p-3 text-center text-xs text-slate-500 bg-slate-50 border-t border-slate-200">
              पहिलो ३०० रेकर्डहरू देखाइँदैछ (कुल {toDevaNum(filteredRows.length)} रेकर्डहरू)। पूर्ण डेटा हेर्न खोज वा कागजात फिल्टर गर्नुहोस् वा Excel मा निर्यात गर्नुहोस्।
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
