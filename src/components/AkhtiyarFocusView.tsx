import React, { useState, useMemo } from 'react';
import { 
  FileText, Search, Download, FileSpreadsheet, Eye, 
  Sparkles, CheckCircle2, Bookmark, Columns, Filter, ShieldCheck, Scale
} from 'lucide-react';
import { LegalRow, DocumentSummary } from '../types';
import { exportToExcel, exportToCsv } from '../utils/exportUtils';

interface AkhtiyarFocusViewProps {
  allRows: LegalRow[];
  documents: DocumentSummary[];
  onOpenPdf: (path: string, page: string) => void;
  onOpenMdSync?: (filename: string, page?: string) => void;
  onOpenModal: (row: LegalRow) => void;
  onOpenGeminiAnalyzer: (docPath: string, page?: string) => void;
}

export const AkhtiyarFocusView: React.FC<AkhtiyarFocusViewProps> = ({
  allRows,
  documents,
  onOpenPdf,
  onOpenMdSync,
  onOpenModal,
  onOpenGeminiAnalyzer,
}) => {
  // Extract all rows from Folder 8 (८. अख्तियार दुरुपयोग अनुसन्धान आयोग)
  const akhtiyarRows = useMemo(() => {
    return allRows.filter(r => r.folder_id === '८.' || r.folder_name?.includes('अख्तियार'));
  }, [allRows]);

  const [searchTerm, setSearchTerm] = useState<string>('');

  const filteredRows = useMemo(() => {
    return akhtiyarRows.filter(r => {
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase().trim();
      return (
        r.section_id.toLowerCase().includes(q) ||
        r.title_name.toLowerCase().includes(q) ||
        r.title_page.toLowerCase().includes(q) ||
        r.pdf_name.toLowerCase().includes(q)
      );
    });
  }, [akhtiyarRows, searchTerm]);

  const toDevaNum = (n: number | string) => {
    const devDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
    return String(n).replace(/[0-9]/g, d => devDigits[parseInt(d, 10)]);
  };

  return (
    <div className="space-y-5">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-indigo-700/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 text-xs font-semibold">
              <Scale className="w-3.5 h-3.5 text-indigo-300" />
              <span>फोल्डर ८ • अख्तियार दुरुपयोग अनुसन्धान आयोग (भ्रष्टाचार निवारण ऐन, २०५९)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <span>८. भ्रष्टाचार निवारण ऐन, २०५९</span>
              <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 font-mono">
                १००% प्रमाणित ({toDevaNum(akhtiyarRows.length)} दफा)
              </span>
            </h1>
            <p className="text-indigo-200 text-xs sm:text-sm max-w-3xl leading-relaxed">
              भ्रष्टाचार निवारण ऐन, २०५९ का सम्पूर्ण ६५+ मूल दफाहरू तथा संशोधन दफाहरू (दफा २४क, ३१क, ३५क, ३५ख, आदि) सहित कुल <strong>{toDevaNum(akhtiyarRows.length)}</strong> वटा दफाहरूको आधिकारिक कानुनी मास्टर तालिका।
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-3 items-center">
            <button
              onClick={() => exportToExcel(filteredRows, 'Folder_8_Bhrastachar_Niwaran_Ain_Verified.xlsx')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel डाउनलोड</span>
            </button>
            <button
              onClick={() => exportToCsv(filteredRows, 'Folder_8_Bhrastachar_Niwaran_Ain_Verified.csv')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 shadow-md transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>CSV डाउनलोड</span>
            </button>
          </div>
        </div>

        {/* Quick KPI stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-indigo-800/60">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-indigo-500/30">
            <div className="text-[11px] text-indigo-300 font-medium">ऐनको नाम</div>
            <div className="text-sm font-bold text-white mt-1">भ्रष्टाचार निवारण ऐन, २०५९</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-indigo-500/30">
            <div className="text-[11px] text-indigo-300 font-medium">कुल प्रमाणित दफाहरू</div>
            <div className="text-xl font-bold text-amber-300 mt-1">{toDevaNum(akhtiyarRows.length)} वटा</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-indigo-500/30">
            <div className="text-[11px] text-indigo-300 font-medium">कानुनी शैली</div>
            <div className="text-sm font-bold text-emerald-300 mt-1">१. Bold + Underline</div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="दफा नम्बर, शीर्षक वा पृष्ठ खोज्नुहोस्..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="text-xs text-slate-600 font-medium">
          देखाउँदै: <strong>{toDevaNum(filteredRows.length)}</strong> / {toDevaNum(akhtiyarRows.length)} दफाहरू
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 text-[11px] sm:text-xs">
                <th className="p-3 w-14 text-center">क्र.सं.</th>
                <th className="p-3 w-28">दफा नं.</th>
                <th className="p-3">दफाको शीर्षक (Title)</th>
                <th className="p-3 w-20 text-center">PDF पृष्ठ</th>
                <th className="p-3 w-36">कानुनी शैली</th>
                <th className="p-3 w-28 text-center">कार्य</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {filteredRows.map((row, idx) => (
                <tr key={`${row.section_id}-${idx}`} className="hover:bg-indigo-50/50 transition-colors">
                  <td className="p-3 text-center text-slate-500 font-mono text-xs">{row.sn || toDevaNum(idx + 1)}</td>
                  <td className="p-3 font-bold text-slate-900 font-mono">{row.section_id}</td>
                  <td className="p-3">
                    <span className="font-bold underline decoration-indigo-400 underline-offset-2">
                      {row.title_name}
                    </span>
                  </td>
                  <td className="p-3 text-center font-mono text-xs">
                    {row.title_page ? (
                      <button
                        onClick={() => onOpenPdf(row.pdf_path, row.title_page)}
                        className="px-2.5 py-0.5 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold border border-indigo-200 cursor-pointer"
                      >
                        {row.title_page}
                      </button>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="p-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
                      १. Bold + Underline
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => onOpenModal(row)}
                        title="१०-स्तम्भ विवरण हेर्नुहोस्"
                        className="p-1.5 text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded cursor-pointer transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {onOpenMdSync && (
                        <button
                          onClick={() => onOpenMdSync(row.pdf_name, row.title_page || '१')}
                          title="Dual Sync रिडरमा खोल्नुहोस्"
                          className="p-1.5 text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded cursor-pointer transition-colors"
                        >
                          <Columns className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => onOpenGeminiAnalyzer(row.pdf_path, row.title_page || '१')}
                        title="हेडर एआई विश्लेषक"
                        className="p-1.5 text-slate-600 hover:text-purple-700 hover:bg-purple-50 rounded cursor-pointer transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
