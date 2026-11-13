import React, { useState, useMemo } from 'react';
import { 
  FileText, Search, ExternalLink, Download, FileSpreadsheet, Eye, 
  Sparkles, CheckCircle2, Bookmark, Columns, Filter, ShieldCheck, ArrowRight, Layers, BookOpen, Scale
} from 'lucide-react';
import { LegalRow, DocumentSummary } from '../types';
import { exportToExcel, exportToCsv } from '../utils/exportUtils';
import { toGitHubRawUrl } from '../utils/urlUtils';

interface KanuniSangaloFocusViewProps {
  allRows: LegalRow[];
  documents: DocumentSummary[];
  onOpenPdf: (path: string, page: string) => void;
  onOpenMdSync?: (filename: string, page?: string) => void;
  onOpenModal: (row: LegalRow) => void;
  onOpenGeminiAnalyzer: (docPath: string, page?: string) => void;
}

export const KanuniSangaloFocusView: React.FC<KanuniSangaloFocusViewProps> = ({
  allRows,
  documents,
  onOpenPdf,
  onOpenMdSync,
  onOpenModal,
  onOpenGeminiAnalyzer,
}) => {
  // Extract all rows from Folder 10 (१०. कानुनी संगालो)
  const folder10Rows = useMemo(() => {
    return allRows.filter(r => r.folder_id === '१०.' || r.folder_name?.includes('कानुनी संगालो'));
  }, [allRows]);

  // Unique Folder 10 PDFs
  const folder10Docs = useMemo(() => {
    return documents.filter(d => d.folderName?.includes('कानुनी संगालो') || d.folderId === '१०.');
  }, [documents]);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'दफा' | 'अनुसूची'>('all');

  const filteredRows = useMemo(() => {
    return folder10Rows.filter(r => {
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
  }, [folder10Rows, typeFilter, searchTerm]);

  const totalSections = useMemo(() => folder10Rows.filter(r => r.section_id && !r.anusuchi_id).length, [folder10Rows]);
  const totalSchedules = useMemo(() => folder10Rows.filter(r => r.anusuchi_id).length, [folder10Rows]);

  const toDevaNum = (n: number | string) => {
    const devDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
    return String(n).replace(/[0-9]/g, d => devDigits[parseInt(d, 10)]);
  };

  return (
    <div className="space-y-5">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-amber-700/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/30 text-xs font-semibold">
              <BookOpen className="w-3.5 h-3.5 text-amber-300" />
              <span>फोल्डर १० • कानुनी संगालो (सब-फोल्डर १०.१ • भुमि आयोग कानुन संगालो)</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <span>१०. कानुनी संगालो - प्रमाणित संग्रह</span>
              <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                १००% सिङ्क्रोनाइज्ड
              </span>
            </h2>
            <p className="text-slate-300 text-sm max-w-3xl leading-relaxed">
              सुकुम्बासी समस्या समाधान आयोगका विगतका ऐतिहासिक कार्यादेशहरूको संगालो (२०४८ सालदेखि २०७६ सम्मका गठन आदेश, कार्यादेश र अनुसूचीहरू)। यस फोल्डरका सबै कागजात र अनुसूचीहरू प्रमाणित डेटाबेसमा पूर्ण रूपमा समावेश छन्।
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-amber-200/90">
              <span className="flex items-center gap-1.5 bg-black/30 px-3 py-1.5 rounded-lg border border-amber-500/20">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                कुल कागजात: <strong className="text-white">१ PDF</strong> (९७३ KB)
              </span>
              <span className="flex items-center gap-1.5 bg-black/30 px-3 py-1.5 rounded-lg border border-amber-500/20">
                <Bookmark className="w-4 h-4 text-amber-400" />
                दफा/शीर्षक: <strong className="text-white">{toDevaNum(totalSections)} वटा</strong>
              </span>
              <span className="flex items-center gap-1.5 bg-black/30 px-3 py-1.5 rounded-lg border border-amber-500/20">
                <Layers className="w-4 h-4 text-purple-400" />
                गठन आदेश/अनुसूची: <strong className="text-white">{toDevaNum(totalSchedules)} वटा</strong>
              </span>
              <span className="flex items-center gap-1.5 bg-black/30 px-3 py-1.5 rounded-lg border border-amber-500/20">
                <Columns className="w-4 h-4 text-blue-400" />
                कुल रेकर्ड: <strong className="text-white">{toDevaNum(folder10Rows.length)} वटा</strong>
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
            <button
              onClick={() => onOpenGeminiAnalyzer(
                'pdfs/१०. कानुनी संगालो/१०.१. भुमि आयोग कानुन संगालो/सुकुम्बासी समस्या समाधान आयोगका कार्यादेशको संगालो, २०७७-०१-०१.pdf',
                '१'
              )}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 text-white font-semibold text-xs shadow-lg shadow-purple-950/40 border border-purple-400/40 transition-all active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>AI हेडर विश्लेषक (Gemini)</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportToExcel(folder10Rows, 'Nepal_Legal_Folder10_Kanuni_Sangalo.xlsx')}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs transition-all active:scale-95 cursor-pointer border border-emerald-500/40"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>
              <button
                onClick={() => exportToCsv(folder10Rows, 'Nepal_Legal_Folder10_Kanuni_Sangalo.csv')}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-semibold text-xs transition-all active:scale-95 cursor-pointer border border-blue-500/40"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Document Overview Card */}
      <div className="grid grid-cols-1 gap-4">
        {folder10Docs.map((doc) => (
          <div
            key={doc.path}
            className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    १०.१. भुमि आयोग कानुन संगालो
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                    ऐतिहासिक कार्यादेश संगालो
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{doc.filename}</span>
                </h3>
                <p className="text-xs text-slate-500">
                  पाथ: <span className="font-mono text-slate-600">{doc.path}</span> • {doc.totalSections} दफा • {doc.totalSchedules} गठन आदेश तथा अनुसूची • कुल {doc.totalRows} रेकर्ड
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {onOpenMdSync && (
                  <button
                    onClick={() => onOpenMdSync(doc.filename, '1')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    <span>MD रिडर + PDF सिंक</span>
                  </button>
                )}
                <button
                  onClick={() => onOpenPdf(doc.path, '1')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>PDF हेर्नुहोस्</span>
                </button>
                <a
                  href={toGitHubRawUrl(doc.path)}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                  title="मूल PDF हेर्नुहोस्"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="दफा, शीर्षक, गठन आदेश, अनुसूची खोज्नुहोस्..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
        </div>

        {/* Type Filter Buttons */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              typeFilter === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            सबै ({toDevaNum(folder10Rows.length)})
          </button>
          <button
            onClick={() => setTypeFilter('दफा')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              typeFilter === 'दफा'
                ? 'bg-amber-700 text-white shadow-xs'
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
            गठन आदेश/अनुसूची मात्र ({toDevaNum(totalSchedules)})
          </button>
        </div>
      </div>

      {/* 10-Column Verified Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 text-xs sm:text-sm">
              १०. कानुनी संगालो: प्रमाणित १०-स्तम्भ तालिका
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold font-mono">
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
                <th className="py-2.5 px-3 font-bold w-24">२. सबफोल्डर</th>
                <th className="py-2.5 px-3 font-bold w-20">३. दफा ID</th>
                <th className="py-2.5 px-3 font-bold min-w-[200px]">४. दफा शीर्षक</th>
                <th className="py-2.5 px-3 font-bold text-center w-20">५. पेज</th>
                <th className="py-2.5 px-3 font-bold w-24">६. अनुसूची ID</th>
                <th className="py-2.5 px-3 font-bold min-w-[220px]">७. अनुसूची / गठन आदेश शीर्षक</th>
                <th className="py-2.5 px-3 font-bold text-center w-20">८. प्रिन्ट पेज</th>
                <th className="py-2.5 px-3 font-bold text-center w-28">९. कार्यहरू</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400">
                    कुनै रेकर्ड फेला परेन। खोज शब्द परिवर्तन गर्नुहोस्।
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const isAnusuchi = !!row.anusuchi_id;
                  return (
                    <tr
                      key={`${row.folder_id}-${row.section_id}-${row.anusuchi_id}-${idx}`}
                      onClick={() => onOpenModal(row)}
                      className={`hover:bg-amber-50/60 cursor-pointer transition-colors ${
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
                      <td className="py-2.5 px-3 font-mono font-bold text-amber-900">
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
                      <td 
                        className="py-2.5 px-3 text-center"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onOpenPdf(row.pdf_path, row.anusuchi_print_page || row.title_page || '1')}
                            className="p-1 rounded hover:bg-slate-200 text-slate-600 hover:text-amber-700 transition-colors"
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
        </div>
      </div>
    </div>
  );
};
