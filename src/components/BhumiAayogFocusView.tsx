import React, { useState, useMemo } from 'react';
import { 
  FileText, Search, ExternalLink, Download, FileSpreadsheet, Eye, 
  Sparkles, CheckCircle2, Bookmark, Columns, Filter, ShieldCheck, ArrowRight, Layers, Users
} from 'lucide-react';
import { LegalRow, DocumentSummary } from '../types';
import { exportToExcel, exportToCsv } from '../utils/exportUtils';

interface BhumiAayogFocusViewProps {
  allRows: LegalRow[];
  documents: DocumentSummary[];
  onOpenPdf: (path: string, page: string) => void;
  onOpenMdSync?: (filename: string, page?: string) => void;
  onOpenModal: (row: LegalRow) => void;
  onOpenGeminiAnalyzer: (docPath: string, page?: string) => void;
}

export const BhumiAayogFocusView: React.FC<BhumiAayogFocusViewProps> = ({
  allRows,
  documents,
  onOpenPdf,
  onOpenMdSync,
  onOpenModal,
  onOpenGeminiAnalyzer,
}) => {
  // Extract all rows from Folder 9 (९. भुमि समस्या समाधान समिति)
  const bhumiRows = useMemo(() => {
    return allRows.filter(r => r.folder_id === '९.' || r.folder_name?.includes('भुमि समस्या समाधान समिति'));
  }, [allRows]);

  // Unique Folder 9 PDFs
  const bhumiDocs = useMemo(() => {
    return documents.filter(d => d.folderName?.includes('भुमि समस्या समाधान समिति') || d.folderId === '९.');
  }, [documents]);

  const [selectedDoc, setSelectedDoc] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'दफा' | 'अनुसूची'>('all');
  const [styleFilter, setStyleFilter] = useState<'all' | 'bold_and_underline' | 'underline_only' | 'bold_only'>('all');

  const filteredRows = useMemo(() => {
    return bhumiRows.filter(r => {
      if (selectedDoc !== 'all' && r.pdf_name !== selectedDoc) return false;
      if (typeFilter !== 'all') {
        if (typeFilter === 'अनुसूची' && !r.anusuchi_id) return false;
        if (typeFilter === 'दफा' && r.anusuchi_id) return false;
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
  }, [bhumiRows, selectedDoc, typeFilter, styleFilter, searchTerm]);

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

  const docStats = useMemo(() => {
    const totalDafas = bhumiRows.filter(r => !r.anusuchi_id).length;
    const totalAnusuchis = bhumiRows.filter(r => !!r.anusuchi_id).length;
    return { totalDafas, totalAnusuchis };
  }, [bhumiRows]);

  return (
    <div className="space-y-5">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-rose-900 via-pink-900 to-rose-950 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-rose-700/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 text-rose-200 border border-rose-400/30 text-xs font-semibold">
              <Users className="w-3.5 h-3.5 text-rose-300" />
              <span>फोल्डर ९ • भुमि समस्या समाधान समिति (६ दस्ताबेजहरू — हुबहु दफा र अनुसूची)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <span>९. भुमि समस्या समाधान समिति</span>
              <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 font-mono">
                १००% प्रमाणित
              </span>
            </h1>
            <p className="text-rose-200 text-xs sm:text-sm max-w-3xl leading-relaxed">
              जग्गा उपलब्ध गराउने कार्यविधि, भूमिहीन दलित लगत संकलन निर्देशिका, पहिचान र प्रमाणीकरण मापदण्ड, गठन आदेश, विगतका आयोग कार्यविधि र सुकुम्बासी समस्या आयोगका कार्यादेशको संगालो (१७ अनुसूचीहरू) सहित कुल <strong>{toDevaNum(bhumiRows.length)}</strong> रेकर्डहरू हुबहु समावेश।
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-3 items-center">
            <button
              onClick={() => exportToExcel(filteredRows, 'Folder_9_Bhumi_Samasya_Samiti_Verified.xlsx')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel डाउनलोड</span>
            </button>
            <button
              onClick={() => exportToCsv(filteredRows, 'Folder_9_Bhumi_Samasya_Samiti_Verified.csv')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 shadow-md transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>CSV डाउनलोड</span>
            </button>
          </div>
        </div>

        {/* Quick KPI stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-rose-800/60">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-rose-500/30">
            <div className="text-[11px] text-rose-300 font-medium">कुल दस्ताबेजहरू</div>
            <div className="text-xl font-bold text-white mt-1">६ वटा PDF</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-rose-500/30">
            <div className="text-[11px] text-rose-300 font-medium">कुल दफा / बुँदाहरू</div>
            <div className="text-xl font-bold text-amber-300 mt-1">{toDevaNum(docStats.totalDafas)} वटा</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-rose-500/30">
            <div className="text-[11px] text-rose-300 font-medium">कुल अनुसूचीहरू</div>
            <div className="text-xl font-bold text-emerald-300 mt-1">{toDevaNum(docStats.totalAnusuchis)} वटा</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-rose-500/30">
            <div className="text-[11px] text-rose-300 font-medium">मास्टर रो (१०/११ स्तम्भ)</div>
            <div className="text-xl font-bold text-cyan-300 mt-1">{toDevaNum(bhumiRows.length)} रेकर्डहरू</div>
          </div>
        </div>
      </div>

      {/* 6 PDFs Quick Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { name: 'जग्गा उपलब्ध गराउने सम्बन्धि कार्यविधि, २०८३-०३-०२.pdf', label: '९.१ जग्गा उपलब्ध गराउने कार्यविधि', count: '२६ (१४ दफा + १२ अनुसूची)' },
          { name: 'भुमि आयोग गठन आदेश, २०८१-०६-१४.pdf', label: '९.२ भुमि आयोग गठन आदेश', count: '१५ दफा' },
          { name: 'भूमिहीन दलित भूमिहीन सुकुम्बासी र अव्यवस्थित बसोबासीको लगत सम्बन्धि निर्देशिका२०८३-०३-०२.pdf', label: '९.३ लगत सम्बन्धि निर्देशिका', count: '४३ (२४ निर्देशन + १९ अनुसूची)' },
          { name: 'भूमिहीन-दलित-सुकुम्बासी-पहिचान र प्रमाणीकरण- मापदण्ड २०८३-३-०२.pdf', label: '९.४ पहिचान र प्रमाणीकरण मापदण्ड', count: '१३ (९ बुँदा + ४ अनुसूची)' },
          { name: 'विगतका आयोग, समिति र कार्यदलका बाँकी काम सम्पन्न गर्ने सम्बन्धी कार्यविधि २०८३-०३-०२.pdf', label: '९.५ विगतका आयोग कार्यविधि', count: '१२ (१० दफा + २ अनुसूची)' },
          { name: 'सुकुम्बासी समस्या समाधान आयोगका कार्यादेशको संगालो, २०७७-०१-०१.pdf', label: '९.६ कार्यादेशको संगालो', count: '२६ (४ बुँदा + २२ अनुसूची)' },
        ].map(item => {
          const isSelected = selectedDoc === item.name;
          return (
            <div
              key={item.name}
              onClick={() => setSelectedDoc(isSelected ? 'all' : item.name)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left ${
                isSelected
                  ? 'bg-rose-50 border-rose-500 shadow-sm ring-2 ring-rose-400/40'
                  : 'bg-white border-slate-200 hover:border-rose-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs sm:text-sm text-slate-800 line-clamp-1">{item.label}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                  {item.count}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1 line-clamp-1">{item.name}</div>
            </div>
          );
        })}
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="दफा, बुँदा, अनुसूची, शीर्षक वा पृष्ठ नम्बर खोज्नुहोस्..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                typeFilter === 'all' ? 'bg-white text-rose-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              सबै ({toDevaNum(bhumiRows.length)})
            </button>
            <button
              onClick={() => setTypeFilter('दफा')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                typeFilter === 'दफा' ? 'bg-white text-rose-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              दफा / बुँदा मात्र ({toDevaNum(docStats.totalDafas)})
            </button>
            <button
              onClick={() => setTypeFilter('अनुसूची')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                typeFilter === 'अनुसूची' ? 'bg-white text-rose-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              अनुसूची मात्र ({toDevaNum(docStats.totalAnusuchis)})
            </button>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
            <span>प्रमाणित रेकर्डहरू:</span>
            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-mono text-xs font-semibold">
              {toDevaNum(filteredRows.length)} वटा भेटियो
            </span>
          </div>
          {selectedDoc !== 'all' && (
            <button
              onClick={() => setSelectedDoc('all')}
              className="text-xs text-rose-700 hover:underline font-semibold cursor-pointer"
            >
              फिल्टर हटाउनुहोस् (सबै ६ वटा देखाउनुहोस्)
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 text-[11px] sm:text-xs">
                <th className="p-3 w-12 text-center">क्र.सं.</th>
                <th className="p-3 w-28">दस्ताबेज</th>
                <th className="p-3 w-24">दफा/बुँदा नं.</th>
                <th className="p-3">शीर्षक (Title)</th>
                <th className="p-3 w-16 text-center">पृष्ठ</th>
                <th className="p-3 w-24">अनुसूची नं.</th>
                <th className="p-3">अनुसूची शीर्षक</th>
                <th className="p-3 w-20 text-center">प्रिन्ट पृ.</th>
                <th className="p-3 w-28">शैली</th>
                <th className="p-3 w-24 text-center">कार्य</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {filteredRows.map((row, idx) => {
                const isAnusuchi = !!row.anusuchi_id;
                return (
                  <tr
                    key={`${row.pdf_name}-${row.section_id}-${row.anusuchi_id}-${idx}`}
                    className={`hover:bg-rose-50/50 transition-colors ${
                      isAnusuchi ? 'bg-emerald-50/20' : 'bg-white'
                    }`}
                  >
                    <td className="p-3 text-center text-slate-500 font-mono text-xs">{row.sn || toDevaNum(idx + 1)}</td>
                    <td className="p-3 text-[11px] text-slate-600 font-medium">
                      <span className="line-clamp-1" title={row.pdf_name}>{row.pdf_name}</span>
                    </td>
                    <td className="p-3 font-bold text-slate-900 font-mono">{row.section_id || '-'}</td>
                    <td className="p-3">
                      {row.title_name ? (
                        <span className="font-bold underline decoration-slate-400 underline-offset-2">
                          {row.title_name}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="p-3 text-center font-mono text-xs">
                      {row.title_page ? (
                        <button
                          onClick={() => onOpenPdf(row.pdf_path, row.title_page)}
                          className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 font-semibold border border-rose-200 cursor-pointer"
                        >
                          {row.title_page}
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="p-3 font-bold text-emerald-800 font-mono">{row.anusuchi_id || '-'}</td>
                    <td className="p-3">
                      {row.anusuchi_title ? (
                        <span className="font-bold text-emerald-950">{row.anusuchi_title}</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="p-3 text-center font-mono text-xs">
                      {row.anusuchi_print_page ? (
                        <button
                          onClick={() => onOpenPdf(row.pdf_path, row.anusuchi_print_page)}
                          className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold border border-emerald-200 cursor-pointer"
                        >
                          {row.anusuchi_print_page}
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="p-3">{renderStyleBadge(row.legal_style)}</td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onOpenModal(row)}
                          title="१०-स्तम्भ विवरण हेर्नुहोस्"
                          className="p-1.5 text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {onOpenMdSync && (
                          <button
                            onClick={() => onOpenMdSync(row.pdf_name, row.title_page || row.anusuchi_print_page || '१')}
                            title="Dual Sync रिडरमा खोल्नुहोस्"
                            className="p-1.5 text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded cursor-pointer transition-colors"
                          >
                            <Columns className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => onOpenGeminiAnalyzer(row.pdf_path, row.title_page || row.anusuchi_print_page || '१')}
                          title="हेडर एआई विश्लेषक"
                          className="p-1.5 text-slate-600 hover:text-purple-700 hover:bg-purple-50 rounded cursor-pointer transition-colors"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
