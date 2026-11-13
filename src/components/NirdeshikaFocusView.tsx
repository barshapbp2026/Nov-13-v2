import React, { useState, useMemo } from 'react';
import { 
  FileText, Search, ExternalLink, Download, FileSpreadsheet, Eye, 
  Sparkles, CheckCircle2, Bookmark, Columns, Filter, ShieldCheck, ArrowRight, Layers, Compass
} from 'lucide-react';
import { LegalRow, DocumentSummary } from '../types';
import { exportToExcel, exportToCsv } from '../utils/exportUtils';

interface NirdeshikaFocusViewProps {
  allRows: LegalRow[];
  documents: DocumentSummary[];
  onOpenPdf: (path: string, page: string) => void;
  onOpenMdSync?: (filename: string, page?: string) => void;
  onOpenModal: (row: LegalRow) => void;
  onOpenGeminiAnalyzer: (docPath: string, page?: string) => void;
}

export const NirdeshikaFocusView: React.FC<NirdeshikaFocusViewProps> = ({
  allRows,
  documents,
  onOpenPdf,
  onOpenMdSync,
  onOpenModal,
  onOpenGeminiAnalyzer,
}) => {
  // Extract all rows from Folder 5 (५. निर्देशिका)
  const nirdeshikaRows = useMemo(() => {
    return allRows.filter(r => r.folder_id === '५.' || r.folder_name === '५. निर्देशिका');
  }, [allRows]);

  // Unique 2 Nirdeshika PDFs
  const nirdeshikaDocs = useMemo(() => {
    return documents.filter(d => d.folderName.includes('निर्देशिका') || d.folderId === '५.');
  }, [documents]);

  const [selectedDoc, setSelectedDoc] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'निर्देशन' | 'अनुसूची'>('all');
  const [styleFilter, setStyleFilter] = useState<'all' | 'bold_and_underline' | 'underline_only' | 'bold_only'>('all');

  const filteredRows = useMemo(() => {
    return nirdeshikaRows.filter(r => {
      if (selectedDoc !== 'all' && r.pdf_name !== selectedDoc) return false;
      if (typeFilter !== 'all') {
        if (typeFilter === 'अनुसूची' && !r.anusuchi_id) return false;
        if (typeFilter === 'निर्देशन' && r.anusuchi_id) return false;
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
  }, [nirdeshikaRows, selectedDoc, typeFilter, styleFilter, searchTerm]);

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

  const toDevaNum = (n: number | string) => {
    const devDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
    return String(n).replace(/[0-9]/g, d => devDigits[parseInt(d, 10)]);
  };

  return (
    <div className="space-y-5">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-teal-900 via-emerald-950 to-slate-900 text-white rounded-2xl p-6 sm:p-7 shadow-lg border border-teal-800/40 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30">
              <Compass className="w-3.5 h-3.5" />
              <span>खण्ड ५: निर्देशिका विशेष प्रमाणीकरण पोर्टल (हुबहु PDF अनुसार)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <span>५. निर्देशिका (Nirdeshika) — हुबहु शीर्षक र अनुसूची</span>
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-3xl leading-relaxed">
              मूल PDF का आधारमा ५.१. भूमि प्रशासन निर्देशिका २०८१ (४३६ निर्देशन + ६४ अनुसूची) र ५.२. जग्गा नापजाँच तथा नक्सा स्रेस्ता अद्यावधिक निर्देशिका २०८१ (५२ निर्देशन + ३२ अनुसूची) को आधिकारिक १०/११ स्तम्भ ढाँचा।
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={() => exportToExcel(filteredRows, 'Nepal_Nirdeshika_Folder5_Verified.xlsx')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" /> Excel डाउनलोड
            </button>
            <button
              onClick={() => exportToCsv(filteredRows, 'Nepal_Nirdeshika_Folder5_Verified.csv')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" /> CSV
            </button>
          </div>
        </div>

        {/* 2 Nirdeshika Quick Cards */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3.5 relative z-10">
          <div 
            onClick={() => setSelectedDoc('भूमि प्रशासन ( तेस्रो संसोधन २०८२) निर्देशिका २०८१, २०८२-१२-०६.pdf')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              selectedDoc === 'भूमि प्रशासन ( तेस्रो संसोधन २०८२) निर्देशिका २०८१, २०८२-१२-०६.pdf'
                ? 'bg-teal-900/60 border-teal-400 ring-2 ring-teal-400/30'
                : 'bg-slate-900/50 border-slate-700/60 hover:border-slate-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-300">५.१. भूमि प्रशासन निर्देशिका, २०८१</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-teal-500/20 text-teal-200">
                ५०० रेकर्डहरू
              </span>
            </div>
            <p className="text-[13px] font-semibold text-white mt-1 truncate">
              भूमि प्रशासन (तेस्रो संशोधन २०८२) निर्देशिका २०८१
            </p>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-3">
              <span>४३६ निर्देशनहरू</span>
              <span>•</span>
              <span>६४ अनुसूचीहरू</span>
              <span>•</span>
              <span className="text-emerald-400 font-semibold">पृष्ठ २६-४५३ सम्म प्रमाणित</span>
            </div>
          </div>

          <div 
            onClick={() => setSelectedDoc('जग्गा नापजाँच तथा नक्सा स्रेस्ता अध्यावधिक सम्बन्धि निर्देशिका, २०८१.pdf')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              selectedDoc === 'जग्गा नापजाँच तथा नक्सा स्रेस्ता अध्यावधिक सम्बन्धि निर्देशिका, २०८१.pdf'
                ? 'bg-teal-900/60 border-teal-400 ring-2 ring-teal-400/30'
                : 'bg-slate-900/50 border-slate-700/60 hover:border-slate-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-300">५.२. जग्गा नापजाँच निर्देशिका, २०८१</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-teal-500/20 text-teal-200">
                ८४ रेकर्डहरू
              </span>
            </div>
            <p className="text-[13px] font-semibold text-white mt-1 truncate">
              जग्गा नापजाँच तथा नक्सा स्रेस्ता अध्यावधिक सम्बन्धि निर्देशिका, २०८१
            </p>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-3">
              <span>५२ निर्देशनहरू</span>
              <span>•</span>
              <span>३२ अनुसूचीहरू</span>
              <span>•</span>
              <span className="text-emerald-400 font-semibold">विषय सूचीबाट हुबहु प्रमाणित</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Document Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 whitespace-nowrap">निर्देशिका छनोट:</span>
            <select
              value={selectedDoc}
              onChange={e => setSelectedDoc(e.target.value)}
              className="text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">सबै निर्देशिकाहरू ({toDevaNum(nirdeshikaRows.length)} रेकर्ड)</option>
              <option value="भूमि प्रशासन ( तेस्रो संसोधन २०८२) निर्देशिका २०८१, २०८२-१२-०६.pdf">
                ५.१. भूमि प्रशासन निर्देशिका, २०८१ (५०० रेकर्ड)
              </option>
              <option value="जग्गा नापजाँच तथा नक्सा स्रेस्ता अध्यावधिक सम्बन्धि निर्देशिका, २०८१.pdf">
                ५.२. जग्गा नापजाँच तथा नक्सा स्रेस्ता अध्यावधिक निर्देशिका, २०८१ (८४ रेकर्ड)
              </option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                typeFilter === 'all'
                  ? 'bg-white text-teal-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              सबै ({toDevaNum(nirdeshikaRows.length)})
            </button>
            <button
              onClick={() => setTypeFilter('निर्देशन')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                typeFilter === 'निर्देशन'
                  ? 'bg-white text-teal-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              निर्देशन मात्र ({toDevaNum(nirdeshikaRows.filter(r => !r.anusuchi_id).length)})
            </button>
            <button
              onClick={() => setTypeFilter('अनुसूची')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                typeFilter === 'अनुसूची'
                  ? 'bg-white text-teal-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              अनुसूची मात्र ({toDevaNum(nirdeshikaRows.filter(r => r.anusuchi_id).length)})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative min-w-[240px] flex-1 max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="निर्देशन, अनुसूची, शीर्षक खोज्नुहोस्..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
      </div>

      {/* 10/11 Column Table View */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="font-bold text-slate-800 text-xs sm:text-sm">
              निर्देशिका मास्टर तालिका (१०/११ स्तम्भ पूर्ण ढाँचा)
            </span>
            <span className="text-xs text-slate-500 font-mono">
              ({toDevaNum(filteredRows.length)} रेकर्डहरू प्रदर्शित)
            </span>
          </div>

          <div className="text-xs text-slate-600 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>प्रमाणित ३ वटा प्रोटोकल: Bold & Underline | Underline | Bold</span>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full border-collapse text-left text-xs font-sans">
            <thead className="bg-slate-900 text-white sticky top-0 z-20 shadow-sm text-[11px] font-bold">
              <tr>
                <th className="p-2.5 border-r border-slate-800 text-center w-12">१. सि.नं.</th>
                <th className="p-2.5 border-r border-slate-800 w-16">२. Folder ID</th>
                <th className="p-2.5 border-r border-slate-800 w-20">३. Subfolder ID</th>
                <th className="p-2.5 border-r border-slate-800 w-32">४. Folder Name</th>
                <th className="p-2.5 border-r border-slate-800 w-36">५. Subfolder Name</th>
                <th className="p-2.5 border-r border-slate-800 w-48">६. PDF Name</th>
                <th className="p-2.5 border-r border-slate-800 w-24 text-center bg-teal-950 text-teal-200">
                  ७.४. निर्देशन ID
                </th>
                <th className="p-2.5 border-r border-slate-800 min-w-[260px] bg-teal-950 text-teal-200">
                  ७.४. निर्देशन शीर्षक (Title Name)
                </th>
                <th className="p-2.5 border-r border-slate-800 w-16 text-center">८. Title Page</th>
                <th className="p-2.5 border-r border-slate-800 w-24 text-center bg-amber-950 text-amber-200">
                  ९. अनुसूची ID
                </th>
                <th className="p-2.5 border-r border-slate-800 min-w-[240px] bg-amber-950 text-amber-200">
                  १०. अनुसूची शीर्षक (Anusuchi Title)
                </th>
                <th className="p-2.5 border-r border-slate-800 w-20 text-center">११. Print Page</th>
                <th className="p-2.5 text-center w-20">कार्यहरू</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center py-10 text-slate-500 font-medium">
                    कुनै रेकर्ड फेला परेन।
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const isSchedule = !!row.anusuchi_id;
                  const rowBg = isSchedule 
                    ? 'bg-amber-50/40 hover:bg-amber-100/50' 
                    : idx % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/70 hover:bg-slate-100/70';

                  return (
                    <tr key={`${row.folder_id}-${row.subfolder_id}-${row.section_id}-${row.anusuchi_id}-${idx}`} className={`${rowBg} transition-colors`}>
                      <td className="p-2.5 text-center font-mono text-slate-500 border-r border-slate-200 font-semibold">
                        {toDevaNum(idx + 1)}.
                      </td>
                      <td className="p-2.5 font-mono text-slate-700 border-r border-slate-200">
                        {row.folder_id}
                      </td>
                      <td className="p-2.5 font-mono text-slate-700 border-r border-slate-200">
                        {row.subfolder_id || '-'}
                      </td>
                      <td className="p-2.5 font-semibold text-slate-800 border-r border-slate-200 truncate max-w-[140px]" title={row.folder_name}>
                        {row.folder_name}
                      </td>
                      <td className="p-2.5 text-slate-700 border-r border-slate-200 truncate max-w-[150px]" title={row.subfolder_name}>
                        {row.subfolder_name || '-'}
                      </td>
                      <td className="p-2.5 text-slate-800 border-r border-slate-200 truncate max-w-[180px]" title={row.pdf_name}>
                        <button
                          onClick={() => onOpenPdf(row.pdf_path, row.title_page || row.anusuchi_print_page || '1')}
                          className="text-left font-medium text-teal-700 hover:text-teal-900 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span className="truncate">{row.pdf_name}</span>
                          <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
                        </button>
                      </td>

                      {/* 7.4 Nirdeshan ID */}
                      <td className="p-2.5 text-center font-bold text-teal-900 border-r border-slate-200 bg-teal-50/30">
                        {row.section_id || '-'}
                      </td>

                      {/* 7.4 Nirdeshan Title Name */}
                      <td className="p-2.5 border-r border-slate-200 bg-teal-50/30">
                        {row.title_name ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold underline text-slate-900">
                              {row.title_name}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-purple-100 text-purple-900 border border-purple-200 shrink-0">
                              Bold + Underline
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">-</span>
                        )}
                      </td>

                      {/* 8. Title Page */}
                      <td className="p-2.5 text-center font-mono font-semibold text-slate-800 border-r border-slate-200">
                        {row.title_page ? (
                          <button
                            onClick={() => onOpenPdf(row.pdf_path, row.title_page)}
                            className="px-2 py-0.5 rounded bg-slate-200 hover:bg-teal-200 text-slate-900 font-bold transition-colors cursor-pointer"
                            title="PDF मा यो पृष्ठ हेर्नुहोस्"
                          >
                            {row.title_page}
                          </button>
                        ) : '-'}
                      </td>

                      {/* 9. Anusuchi ID */}
                      <td className="p-2.5 text-center font-bold text-amber-900 border-r border-slate-200 bg-amber-50/50">
                        {row.anusuchi_id ? (
                          <span className="px-2 py-0.5 rounded bg-amber-200/80 text-amber-900 font-bold">
                            {row.anusuchi_id}
                          </span>
                        ) : '-'}
                      </td>

                      {/* 10. Anusuchi Title */}
                      <td className="p-2.5 border-r border-slate-200 bg-amber-50/40">
                        {row.anusuchi_title ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-amber-950">
                              {row.anusuchi_title}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-900 border border-emerald-200 shrink-0">
                              Bold मात्र
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">-</span>
                        )}
                      </td>

                      {/* 11. Anusuchi Print Page */}
                      <td className="p-2.5 text-center font-mono font-semibold text-slate-800 border-r border-slate-200">
                        {row.anusuchi_print_page ? (
                          <button
                            onClick={() => onOpenPdf(row.pdf_path, row.anusuchi_print_page)}
                            className="px-2 py-0.5 rounded bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold transition-colors cursor-pointer"
                            title="PDF मा यो अनुसूची हेर्नुहोस्"
                          >
                            {row.anusuchi_print_page}
                          </button>
                        ) : '-'}
                      </td>

                      {/* Actions */}
                      <td className="p-2.5 text-center">
                        <button
                          onClick={() => onOpenModal(row)}
                          className="p-1 rounded-md text-slate-500 hover:text-teal-700 hover:bg-teal-50 transition-colors cursor-pointer"
                          title="पूर्ण १० स्तम्भ विवरण हेर्नुहोस्"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
