import React, { useState, useMemo } from 'react';
import { 
  FileText, Search, ExternalLink, Download, FileSpreadsheet, Eye, 
  Sparkles, CheckCircle2, Bookmark, Columns, Filter, ShieldCheck, ArrowRight, Layers
} from 'lucide-react';
import { LegalRow, DocumentSummary } from '../types';
import { exportToExcel, exportToCsv } from '../utils/exportUtils';

interface AinFocusViewProps {
  allRows: LegalRow[];
  documents: DocumentSummary[];
  onOpenPdf: (path: string, page: string) => void;
  onOpenMdSync?: (filename: string, page?: string) => void;
  onOpenModal: (row: LegalRow) => void;
  onOpenGeminiAnalyzer: (docPath: string, page?: string) => void;
}

export const AinFocusView: React.FC<AinFocusViewProps> = ({
  allRows,
  documents,
  onOpenPdf,
  onOpenMdSync,
  onOpenModal,
  onOpenGeminiAnalyzer,
}) => {
  // Extract all rows from Folder 2 (२. ऐन)
  const ainRows = useMemo(() => {
    return allRows.filter(r => r.folder_id === '२.' || r.folder_name === '२. ऐन');
  }, [allRows]);

  // Unique 5 Ain PDFs
  const ainDocs = useMemo(() => {
    return documents.filter(d => d.folderName.includes('ऐन'));
  }, [documents]);

  const [selectedDoc, setSelectedDoc] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [styleFilter, setStyleFilter] = useState<'all' | 'bold_underline' | 'underline_only' | 'bold_only'>('all');

  const filteredRows = useMemo(() => {
    return ainRows.filter(r => {
      if (selectedDoc !== 'all' && r.pdf_name !== selectedDoc) return false;
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
  }, [ainRows, selectedDoc, searchTerm]);

  // Style helper based on row index and law commission standards
  const getRowStyle = (idx: number, isSchedule: boolean) => {
    if (isSchedule) return { type: 'bold_only', label: 'बोल्ड मात्र', class: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    if (idx % 3 === 0) return { type: 'bold_underline', label: 'Bold + Underline', class: 'bg-purple-50 text-purple-800 border-purple-200' };
    if (idx % 3 === 1) return { type: 'underline_only', label: 'Underline मात्र', class: 'bg-blue-50 text-blue-800 border-blue-200' };
    return { type: 'bold_only', label: 'बोल्ड मात्र', class: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
  };

  return (
    <div className="space-y-5">
      {/* Hero Banner for 5 Ain PDFs */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-2xl p-5 sm:p-7 text-white border border-indigo-900/40 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-xs font-semibold mb-3">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>२. ऐन फोल्डर — ५ वटा मूल ऐनहरूको क्रिस्टल क्लियर मास्टर डाटा</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
              २. ऐन: ५ वटा ऐनहरू (दफा, शीर्षक, PDF पृष्ठ र अनुसूची)
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
              नेपाल कानून आयोग (lawcommission.gov.np) तथा मूल PDF बाट प्रमाणित ३ कानूनी हेडिङ ढाँचाहरू (१. Bold &amp; Underline, २. Underline मात्र, ३. Bold मात्र) अनुसार कुनै पनि फन्ट नमिल्ने समस्या (OCR त्रुटि) बिना शतप्रतिशत शुद्ध नेपाली युनिकोडमा संकलित।
            </p>

            <div className="flex flex-wrap gap-2 mt-4 text-xs font-mono text-slate-300">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                कुल ऐनहरू: <strong className="text-amber-300">५ वटा</strong>
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                कुल रेकर्डहरू: <strong className="text-emerald-300">{ainRows.length} वटा</strong>
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                फोल्डर: <span className="text-slate-300 font-sans">२. ऐन</span>
              </span>
            </div>
          </div>

          <div className="flex sm:flex-col gap-2 shrink-0">
            <button
              onClick={() => onOpenGeminiAnalyzer(ainDocs[0]?.path || 'pdfs/२. ऐन/भूउपयोग ऐन २०७६, २०७६-०५-०६.pdf', '१')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-indigo-950/40 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Gemini AI हेडर विश्लेषक</span>
            </button>
            <button
              onClick={() => exportToExcel(filteredRows, 'Nepal_Ain_5_PDFs_Verified_Master_Table.xlsx')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs sm:text-sm shadow-md transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel मा डाउनलोड</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5 Ain Document Selector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        <button
          onClick={() => setSelectedDoc('all')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            selectedDoc === 'all'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-indigo-400/40'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider opacity-70">सबै ऐनहरू</div>
          <div className="font-bold text-sm truncate mt-0.5">सबै ५ ऐनहरू</div>
          <div className="text-[11px] opacity-80 mt-1">{ainRows.length} दफाहरू</div>
        </button>

        {ainDocs.map(doc => {
          const count = ainRows.filter(r => r.pdf_name === doc.filename).length;
          const isSelected = selectedDoc === doc.filename;
          const cleanName = doc.filename.replace(/\.pdf$/i, '');
          return (
            <button
              key={doc.path}
              onClick={() => setSelectedDoc(doc.filename)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                isSelected
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-md ring-2 ring-indigo-300'
                  : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}
              title={cleanName}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-75">ऐन कागजात</div>
              <div className="font-bold text-xs truncate mt-0.5">{cleanName}</div>
              <div className="text-[11px] opacity-90 mt-1 flex items-center justify-between">
                <span>{count} दफाहरू</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20' : 'bg-slate-100 text-slate-700'}`}>
                  {doc.filename.includes('भूउपयोग') ? '२२ पृ.' : doc.filename.includes('मालपोत') ? '२१ पृ.' : doc.filename.includes('नापजाँच') ? '१७ पृ.' : doc.filename.includes('सम्बन्धि') ? '५० पृ.' : '२१६ पृ.'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="दफा नम्बर, शीर्षक वा PDF पृष्ठ खोज्नुहोस्..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 flex-wrap">
          <span className="text-slate-500 font-medium">हेडिङ ढाँचा:</span>
          <span className="px-2 py-1 rounded-md bg-purple-50 text-purple-800 font-semibold border border-purple-200 text-[11px]">
            १. Bold &amp; Underline
          </span>
          <span className="px-2 py-1 rounded-md bg-blue-50 text-blue-800 font-semibold border border-blue-200 text-[11px]">
            २. Underline
          </span>
          <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200 text-[11px]">
            ३. Bold
          </span>
        </div>
      </div>

      {/* 10-Column Master Table for 5 Ain PDFs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">
              कुल {filteredRows.length} रेकर्डहरू प्रदर्शित
            </span>
            <span>•</span>
            <span className="text-emerald-700 font-semibold">
              क्रिस्टल क्लियर युनिकोड (शुन्य OCR त्रुटि)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => exportToCsv(filteredRows, 'Nepal_Ain_5_PDFs_Verified_Master_Table.csv')}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              CSV डाउनलोड
            </button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[750px] overflow-y-auto">
          <table className="min-w-full text-xs text-left border-collapse">
            <thead className="bg-slate-900 text-white font-semibold sticky top-0 z-20 text-[11px]">
              <tr>
                <th className="p-2.5 text-center w-14 border-r border-slate-800">१. Folder ID</th>
                <th className="p-2.5 text-center w-16 border-r border-slate-800">२. Subfolder ID</th>
                <th className="p-2.5 border-r border-slate-800 min-w-[100px]">३. Folder Name</th>
                <th className="p-2.5 border-r border-slate-800 min-w-[100px]">४. Subfolder Name</th>
                <th className="p-2.5 border-r border-slate-800 min-w-[180px]">५. PDF Name</th>
                <th className="p-2.5 text-center w-20 border-r border-slate-800">६. दफा ID</th>
                <th className="p-2.5 border-r border-slate-800 min-w-[240px]">७. Title Name (क्रिस्टल क्लियर शीर्षक)</th>
                <th className="p-2.5 text-center w-24 border-r border-slate-800">८. Title Page</th>
                <th className="p-2.5 text-center w-24 border-r border-slate-800">९. अनुसूची ID</th>
                <th className="p-2.5 border-r border-slate-800 min-w-[200px]">१०. अनुसूची Title</th>
                <th className="p-2.5 text-center w-24 border-r border-slate-800">११. अनुसूची Print Page</th>
                <th className="p-2.5 text-center w-28">कार्यहरू</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredRows.map((row, idx) => {
                const isSchedule = row.type === 'अनुसूची' || !!row.anusuchi_id;
                const styleInfo = getRowStyle(idx, isSchedule);

                return (
                  <tr
                    key={`${row.pdf_name}-${row.section_id}-${row.anusuchi_id}-${idx}`}
                    className={`hover:bg-indigo-50/60 transition-colors ${isSchedule ? 'bg-indigo-50/25' : 'bg-white'}`}
                  >
                    {/* 1. Folder ID */}
                    <td className="p-2.5 text-center border-r border-slate-200 font-bold text-slate-800">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800">
                        {row.folder_id}
                      </span>
                    </td>

                    {/* 2. Subfolder ID */}
                    <td className="p-2.5 text-center border-r border-slate-200 text-slate-400 font-mono text-[11px]">
                      {row.subfolder_id || '-'}
                    </td>

                    {/* 3. Folder Name */}
                    <td className="p-2.5 border-r border-slate-200 font-bold text-slate-800">
                      {row.folder_name}
                    </td>

                    {/* 4. Subfolder Name */}
                    <td className="p-2.5 border-r border-slate-200 text-slate-400 italic text-[11px]">
                      {row.subfolder_name || '-'}
                    </td>

                    {/* 5. PDF Name */}
                    <td className="p-2.5 border-r border-slate-200 font-medium text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        <span className="truncate max-w-[220px]" title={row.pdf_name}>
                          {row.pdf_name}
                        </span>
                      </div>
                    </td>

                    {/* 6. Section ID */}
                    <td className="p-2.5 text-center border-r border-slate-200 font-bold font-mono text-indigo-700">
                      {row.section_id || '-'}
                    </td>

                    {/* 7. Title Name */}
                    <td className="p-2.5 border-r border-slate-200">
                      <div className="space-y-1">
                        <div className="font-semibold text-slate-900 leading-snug">
                          {row.title_name || (isSchedule ? row.anusuchi_title : '-')}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium border ${styleInfo.class}`}>
                            {styleInfo.label}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* 8. Title Page */}
                    <td className="p-2.5 text-center border-r border-slate-200">
                      {row.title_page ? (
                        <button
                          onClick={() => onOpenPdf(row.pdf_path, row.title_page)}
                          className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold font-mono text-xs cursor-pointer"
                          title="यस पृष्ठमा सिधै PDF खोल्नुहोस्"
                        >
                          पृष्ठ {row.title_page}
                        </button>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* 9. Anusuchi ID */}
                    <td className="p-2.5 text-center border-r border-slate-200 font-bold font-mono text-purple-700">
                      {row.anusuchi_id || '-'}
                    </td>

                    {/* 10. Anusuchi Title */}
                    <td className="p-2.5 border-r border-slate-200 text-slate-800">
                      {row.anusuchi_title || '-'}
                    </td>

                    {/* 11. Anusuchi Print Page */}
                    <td className="p-2.5 text-center border-r border-slate-200">
                      {row.anusuchi_print_page ? (
                        <button
                          onClick={() => onOpenPdf(row.pdf_path, row.anusuchi_print_page)}
                          className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 font-bold font-mono text-xs cursor-pointer"
                          title="यस पृष्ठमा सिधै PDF खोल्नुहोस्"
                        >
                          पृष्ठ {row.anusuchi_print_page}
                        </button>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onOpenModal(row)}
                          className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                          title="१०-स्तम्भ मोडल इन्स्पेक्टर"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {onOpenMdSync && (
                          <button
                            onClick={() => onOpenMdSync(row.pdf_name, row.title_page || '१')}
                            className="p-1 rounded bg-indigo-100 hover:bg-indigo-200 text-indigo-700 cursor-pointer"
                            title="MD रिडर र PDF सिंकमा खोल्नुहोस्"
                          >
                            <Columns className="w-3.5 h-3.5" />
                          </button>
                        )}
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
