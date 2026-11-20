import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Columns,
  Eye,
  FileText,
  GitCompare,
  Layers,
  Link2,
  Pencil,
  RefreshCw,
  Scale,
  Search,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { marked } from 'marked';
import type { DocumentSummary, LegalRow, StoredDafaSummaryRecord } from '../types';
import { buildDafaSummaryDocId } from '../services/firestoreSummaryStore';
import {
  canonicalPdfKey,
  compareLegalRows,
  compareNumericPrefixes,
  getDisplaySectionId,
  getDisplaySectionPage,
  getDisplaySectionTitle,
  isAnusuchiRow,
  matchesDocName,
  formatAnusuchiIdOnly,
  formatAnusuchiTitleClean,
} from '../utils/urlUtils';
import { toPhysicalPdfPage } from '../utils/pdfPageMap';
import { devaToNum } from '../utils/markdownUtils';
import { toDevaDigits } from '../utils/summaryCoverage';
import { computeWordDiff } from '../utils/diffUtils';
import { safeFetchJson } from '../utils/safeFetchJson';
import { PdfCanvasViewer } from './PdfCanvasViewer';
import { FontSizeControls } from './FontSizeControls';

interface CompareViewProps {
  documents: DocumentSummary[];
  allRows: LegalRow[];
  cachedDafaMap: Map<string, StoredDafaSummaryRecord>;
  initialLeftRow?: LegalRow | null;
  onOpenPdf: (path: string, page: string, highlightText?: string) => void;
  onOpenModal?: (row: LegalRow, contextList?: LegalRow[]) => void;
}

type CompareMode = 'two-acts' | 'same-act-revision';
type DiffSourceMode = 'text' | 'summary';

interface PresetComparison {
  id: string;
  label: string;
  desc: string;
  mode: CompareMode;
  leftDocHint: string;
  rightDocHint: string;
  leftSectionHint?: string;
  rightSectionHint?: string;
}

const COMPARE_PRESETS: PresetComparison[] = [
  {
    id: 'bhumi-amend',
    label: 'भूमि ऐन २०२१ vs भूमि संशोधन अध्यादेश २०८३',
    desc: 'मूल ऐन र नयाँ संशोधन अध्यादेशको तुलना',
    mode: 'two-acts',
    leftDocHint: 'भुमि सम्बन्धि (आठौ संसोधन) ऐन २०२१',
    rightDocHint: 'भूमि सम्बन्धी केही नेपाल ऐन संशोधन गर्ने अध्यादेश, २०८३',
  },
  {
    id: 'constitution-civil',
    label: 'संविधान (धारा २५) vs देवानी संहिता (सम्पत्ति)',
    desc: 'सम्पत्ति अधिकार सम्बन्धी संवैधानिक र देवानी व्यवस्था',
    mode: 'two-acts',
    leftDocHint: 'नेपालको संबिधान',
    rightDocHint: 'मुलुकी देवानी संहिता ऐन २०७४',
    leftSectionHint: '२५',
    rightSectionHint: '२५१',
  },
  {
    id: 'napi-act-rule',
    label: 'जग्गा नापजाँच ऐन २०१९ vs नियमावली २०५८',
    desc: 'ऐन र नियमावलीका समानान्तर प्रावधान',
    mode: 'two-acts',
    leftDocHint: 'जग्गा नापजाँच (आठौँ संसोधन २०५६) ऐन २०१९',
    rightDocHint: 'जग्गा नाप जाँच ( दोस्रो संसोधन २०८३) नियमावली २०५८',
  },
  {
    id: 'malpot-directive',
    label: 'मालपोत ऐन २०३४ vs भूमि प्रशासन निर्देशिका २०८१',
    desc: 'कानुनी व्यवस्था र कार्यान्वयन निर्देशिका',
    mode: 'two-acts',
    leftDocHint: 'मालपोत (पाँचौ संसोधन २०५४) ऐन २०३४',
    rightDocHint: 'भूमि प्रशासन ( तेस्रो संसोधन २०८२) निर्देशिका २०८१',
  },
  {
    id: 'crime-ciia',
    label: 'मुलुकी अपराध संहिता vs भ्रष्टाचार निवारण ऐन',
    desc: 'कसुर तथा दण्ड सजाय तुलना',
    mode: 'two-acts',
    leftDocHint: 'मुलुकी अपराध संहिता २०७४',
    rightDocHint: 'भ्रष्टाचार निवारण (पहिलो संसोधन २०८१) ऐन २०५९',
  },
];

interface PageTextFetchState {
  loading: boolean;
  text: string;
  corruptedCmap: boolean;
  error: string;
}

function getRowLabel(row: LegalRow): string {
  if (isAnusuchiRow(row)) {
    const id = formatAnusuchiIdOnly(row.anusuchi_id) || 'अनुसूची';
    const title = formatAnusuchiTitleClean(row.anusuchi_title);
    return title ? `${id}: ${title}` : id;
  }
  const secId = getDisplaySectionId(row);
  const title = getDisplaySectionTitle(row);
  return title || secId || 'विवरण';
}

function getRowNumericCode(row: LegalRow): string {
  const raw = isAnusuchiRow(row)
    ? row.anusuchi_id || row.section_id || ''
    : row.section_id || row.title_name || '';
  const m = raw.match(/[०-९0-9]+/);
  return m ? m[0] : '';
}

function renderSafeMarkdownHtml(markdownText: string): string {
  const escaped = String(markdownText || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return marked.parse(escaped, { async: false, breaks: true, gfm: true }) as string;
}

export const CompareView: React.FC<CompareViewProps> = ({
  documents,
  allRows,
  cachedDafaMap,
  initialLeftRow,
  onOpenPdf,
  onOpenModal,
}) => {
  const sortedDocs = useMemo(() => {
    return [...documents].sort((a, b) => {
      const fCmp = compareNumericPrefixes(a.folderName, b.folderName);
      if (fCmp !== 0) return fCmp;
      return compareNumericPrefixes(a.filename, b.filename);
    });
  }, [documents]);

  // Canonical Dafa lookup fallback so repeated PDFs share clean summaries immediately
  const canonicalDafaLookup = useMemo(() => {
    const map = new Map<string, StoredDafaSummaryRecord>();
    for (const d of cachedDafaMap.values()) {
      const k = `${canonicalPdfKey(d.pdfName || d.pdfPath)}||${(d.sectionId || '').trim()}||${(d.anusuchiId || '').trim()}||${(d.titlePage || '').trim()}`;
      if (!map.has(k)) map.set(k, d);
    }
    return map;
  }, [cachedDafaMap]);

  const getCleanDafaRecord = (row: LegalRow | null): StoredDafaSummaryRecord | undefined => {
    if (!row) return undefined;
    const direct = cachedDafaMap.get(buildDafaSummaryDocId(row));
    if (direct) return direct;
    const k = `${canonicalPdfKey(row.pdf_name || row.pdf_path)}||${(row.section_id || '').trim()}||${(row.anusuchi_id || '').trim()}||${(row.title_page || '').trim()}`;
    return canonicalDafaLookup.get(k);
  };

  const getRowsForDoc = (docPath: string): LegalRow[] => {
    const doc = documents.find(d => d.path === docPath);
    if (!doc) return [];
    const direct = allRows.filter(r => r.pdf_path === docPath);
    const list =
      direct.length > 0
        ? direct
        : allRows.filter(r => matchesDocName(r.pdf_name, doc.filename));
    return [...list].sort(compareLegalRows);
  };

  const defaultLeftDoc = useMemo(() => {
    if (initialLeftRow) {
      const m = sortedDocs.find(
        d => d.path === initialLeftRow.pdf_path || matchesDocName(initialLeftRow.pdf_name, d.filename)
      );
      if (m) return m.path;
    }
    return (
      sortedDocs.find(d => d.filename.includes('भुमि सम्बन्धि (आठौ संसोधन) ऐन २०२१'))?.path ||
      sortedDocs[0]?.path ||
      ''
    );
  }, [initialLeftRow, sortedDocs]);

  const defaultRightDoc = useMemo(() => {
    return (
      sortedDocs.find(d => d.filename.includes('भूमि सम्बन्धी केही नेपाल ऐन संशोधन गर्ने अध्यादेश'))?.path ||
      sortedDocs[1]?.path ||
      sortedDocs[0]?.path ||
      ''
    );
  }, [sortedDocs]);

  const [compareMode, setCompareMode] = useState<CompareMode>('two-acts');
  const [leftDocPath, setLeftDocPath] = useState<string>(defaultLeftDoc);
  const [rightDocPath, setRightDocPath] = useState<string>(defaultRightDoc);

  const leftRows = useMemo(() => getRowsForDoc(leftDocPath), [leftDocPath, allRows, documents]);
  const rightRows = useMemo(
    () => getRowsForDoc(compareMode === 'same-act-revision' ? leftDocPath : rightDocPath),
    [compareMode, leftDocPath, rightDocPath, allRows, documents]
  );

  const [leftRowIndex, setLeftRowIndex] = useState<number>(0);
  const [rightRowIndex, setRightRowIndex] = useState<number>(0);
  const [leftFilter, setLeftFilter] = useState<string>('');
  const [rightFilter, setRightFilter] = useState<string>('');
  const [syncSectionNumber, setSyncSectionNumber] = useState<boolean>(false);
  const [diffSourceMode, setDiffSourceMode] = useState<DiffSourceMode>('summary');
  const [showDiffPanel, setShowDiffPanel] = useState<boolean>(true);
  const [showPdfPreview, setShowPdfPreview] = useState<boolean>(false);
  const [pdfPreviewSide, setPdfPreviewSide] = useState<'left' | 'right'>('left');
  const [customRevisionMode, setCustomRevisionMode] = useState<boolean>(false);
  const [customLeftText, setCustomLeftText] = useState<string>('');
  const [customRightText, setCustomRightText] = useState<string>('');

  // Extracted PDF page text state for Left & Right panes
  const [leftPageState, setLeftPageState] = useState<PageTextFetchState>({
    loading: false,
    text: '',
    corruptedCmap: false,
    error: '',
  });
  const [rightPageState, setRightPageState] = useState<PageTextFetchState>({
    loading: false,
    text: '',
    corruptedCmap: false,
    error: '',
  });

  // Optional AI legal comparison analysis
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState<boolean>(false);
  const [aiAnalysisText, setAiAnalysisText] = useState<string>('');
  const [aiAnalysisError, setAiAnalysisError] = useState<string>('');

  // Apply initialLeftRow when user jumps from TenColumnTable or TenColumnModal
  useEffect(() => {
    if (!initialLeftRow) return;
    const docMatch = sortedDocs.find(
      d => d.path === initialLeftRow.pdf_path || matchesDocName(initialLeftRow.pdf_name, d.filename)
    );
    if (docMatch) {
      setLeftDocPath(docMatch.path);
      const rows = getRowsForDoc(docMatch.path);
      const idx = rows.findIndex(
        r =>
          r.section_id === initialLeftRow.section_id &&
          r.anusuchi_id === initialLeftRow.anusuchi_id &&
          r.title_page === initialLeftRow.title_page
      );
      if (idx >= 0) setLeftRowIndex(idx);
    }
  }, [initialLeftRow]);

  const leftRow = leftRows[leftRowIndex] || leftRows[0] || null;
  const rightRow = rightRows[rightRowIndex] || rightRows[0] || null;

  const activeRightDocPath = compareMode === 'same-act-revision' ? leftDocPath : rightDocPath;
  const leftDocInfo = useMemo(() => documents.find(d => d.path === leftDocPath), [documents, leftDocPath]);
  const rightDocInfo = useMemo(
    () => documents.find(d => d.path === activeRightDocPath),
    [documents, activeRightDocPath]
  );

  // Compute physical PDF pages
  const leftPhysicalPage = useMemo(() => {
    if (!leftRow) return 1;
    const rawPage = isAnusuchiRow(leftRow)
      ? leftRow.anusuchi_print_page || leftRow.title_page
      : getDisplaySectionPage(leftRow) || leftRow.anusuchi_print_page;
    return toPhysicalPdfPage(leftDocPath, devaToNum(rawPage) || 1);
  }, [leftRow, leftDocPath]);

  const rightPhysicalPage = useMemo(() => {
    if (!rightRow) return 1;
    const rawPage = isAnusuchiRow(rightRow)
      ? rightRow.anusuchi_print_page || rightRow.title_page
      : getDisplaySectionPage(rightRow) || rightRow.anusuchi_print_page;
    return toPhysicalPdfPage(activeRightDocPath, devaToNum(rawPage) || 1);
  }, [rightRow, activeRightDocPath]);

  // Fetch clean PDF page text for Left Pane
  useEffect(() => {
    if (!leftDocPath || !leftRow) return;
    let cancelled = false;
    setLeftPageState(prev => ({ ...prev, loading: true, error: '' }));
    safeFetchJson(
      `/api/pdf-page-text?path=${encodeURIComponent(leftDocPath)}&page=${leftPhysicalPage}&span=1`
    )
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok || !data?.success) {
          setLeftPageState({
            loading: false,
            text: '',
            corruptedCmap: false,
            error: data?.error || 'पृष्ठ पाठ लोड गर्न सकिएन।',
          });
          return;
        }
        setLeftPageState({
          loading: false,
          text: String(data.text || ''),
          corruptedCmap: Boolean(data.corruptedCmap),
          error: '',
        });
      })
      .catch(err => {
        if (!cancelled) {
          setLeftPageState({
            loading: false,
            text: '',
            corruptedCmap: false,
            error: err?.message || 'पृष्ठ पाठ लोड त्रुटि।',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [leftDocPath, leftPhysicalPage, leftRow?.order_index]);

  // Fetch clean PDF page text for Right Pane
  useEffect(() => {
    if (!activeRightDocPath || !rightRow) return;
    let cancelled = false;
    setRightPageState(prev => ({ ...prev, loading: true, error: '' }));
    safeFetchJson(
      `/api/pdf-page-text?path=${encodeURIComponent(activeRightDocPath)}&page=${rightPhysicalPage}&span=1`
    )
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok || !data?.success) {
          setRightPageState({
            loading: false,
            text: '',
            corruptedCmap: false,
            error: data?.error || 'पृष्ठ पाठ लोड गर्न सकिएन।',
          });
          return;
        }
        setRightPageState({
          loading: false,
          text: String(data.text || ''),
          corruptedCmap: Boolean(data.corruptedCmap),
          error: '',
        });
      })
      .catch(err => {
        if (!cancelled) {
          setRightPageState({
            loading: false,
            text: '',
            corruptedCmap: false,
            error: err?.message || 'पृष्ठ पाठ लोड त्रुटि।',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeRightDocPath, rightPhysicalPage, rightRow?.order_index]);

  // Keep custom revision editor seeded when toggling on
  useEffect(() => {
    if (!customRevisionMode) return;
    const leftFallback = leftPageState.text || getCleanDafaRecord(leftRow)?.summaryNepali || '';
    const rightFallback = rightPageState.text || getCleanDafaRecord(rightRow)?.summaryNepali || '';
    if (!customLeftText && leftFallback) setCustomLeftText(leftFallback);
    if (!customRightText && rightFallback) setCustomRightText(rightFallback);
  }, [customRevisionMode, leftPageState.text, rightPageState.text]);

  // Sync section index automatically when syncSectionNumber is ON
  const handleSelectLeftRowIndex = (newIdx: number) => {
    setLeftRowIndex(newIdx);
    setAiAnalysisText('');
    setAiAnalysisError('');
    if (syncSectionNumber && leftRows[newIdx] && rightRows.length > 0) {
      const code = getRowNumericCode(leftRows[newIdx]);
      if (code) {
        const matchIdx = rightRows.findIndex(r => getRowNumericCode(r) === code);
        if (matchIdx >= 0) {
          setRightRowIndex(matchIdx);
        }
      }
    }
  };

  const handleSelectLeftDoc = (path: string) => {
    setLeftDocPath(path);
    setLeftRowIndex(0);
    setLeftFilter('');
    setAiAnalysisText('');
    if (compareMode === 'same-act-revision') {
      const rows = getRowsForDoc(path);
      setRightRowIndex(rows.length > 1 ? 1 : 0);
    }
  };

  const handleSelectRightDoc = (path: string) => {
    setRightDocPath(path);
    setRightRowIndex(0);
    setRightFilter('');
    setAiAnalysisText('');
  };

  const handleApplyPreset = (preset: PresetComparison) => {
    setCompareMode(preset.mode);
    const lDoc = sortedDocs.find(d => d.filename.includes(preset.leftDocHint));
    const rDoc = sortedDocs.find(d => d.filename.includes(preset.rightDocHint));
    if (lDoc) {
      setLeftDocPath(lDoc.path);
      const lRows = getRowsForDoc(lDoc.path);
      const lIdx = preset.leftSectionHint
        ? lRows.findIndex(r => getRowNumericCode(r) === preset.leftSectionHint)
        : 0;
      setLeftRowIndex(lIdx >= 0 ? lIdx : 0);
    }
    if (rDoc) {
      setRightDocPath(rDoc.path);
      const rRows = getRowsForDoc(rDoc.path);
      const rIdx = preset.rightSectionHint
        ? rRows.findIndex(r => getRowNumericCode(r) === preset.rightSectionHint)
        : 0;
      setRightRowIndex(rIdx >= 0 ? rIdx : 0);
    }
    setCustomRevisionMode(false);
    setAiAnalysisText('');
    setAiAnalysisError('');
  };

  const handleSwapSides = () => {
    if (compareMode === 'same-act-revision') {
      const prevL = leftRowIndex;
      setLeftRowIndex(rightRowIndex);
      setRightRowIndex(prevL);
    } else {
      const prevDoc = leftDocPath;
      const prevIdx = leftRowIndex;
      setLeftDocPath(rightDocPath);
      setLeftRowIndex(rightRowIndex);
      setRightDocPath(prevDoc);
      setRightRowIndex(prevIdx);
    }
    if (customRevisionMode) {
      const prevTxt = customLeftText;
      setCustomLeftText(customRightText);
      setCustomRightText(prevTxt);
    }
    setAiAnalysisText('');
  };

  const filteredLeftRows = useMemo(() => {
    const q = leftFilter.trim().toLowerCase();
    return leftRows
      .map((row, idx) => ({ row, idx }))
      .filter(({ row }) => {
        if (!q) return true;
        return getRowLabel(row).toLowerCase().includes(q);
      });
  }, [leftRows, leftFilter]);

  const filteredRightRows = useMemo(() => {
    const q = rightFilter.trim().toLowerCase();
    return rightRows
      .map((row, idx) => ({ row, idx }))
      .filter(({ row }) => {
        if (!q) return true;
        return getRowLabel(row).toLowerCase().includes(q);
      });
  }, [rightRows, rightFilter]);

  const leftDafaRec = getCleanDafaRecord(leftRow);
  const rightDafaRec = getCleanDafaRecord(rightRow);

  const leftCompareStr = useMemo(() => {
    if (customRevisionMode) return customLeftText;
    if (diffSourceMode === 'text' && leftPageState.text) return leftPageState.text;
    return leftDafaRec?.summaryNepali || leftPageState.text || (leftRow ? getRowLabel(leftRow) : '');
  }, [customRevisionMode, customLeftText, diffSourceMode, leftPageState.text, leftDafaRec, leftRow]);

  const rightCompareStr = useMemo(() => {
    if (customRevisionMode) return customRightText;
    if (diffSourceMode === 'text' && rightPageState.text) return rightPageState.text;
    return rightDafaRec?.summaryNepali || rightPageState.text || (rightRow ? getRowLabel(rightRow) : '');
  }, [customRevisionMode, customRightText, diffSourceMode, rightPageState.text, rightDafaRec, rightRow]);

  const diffSummary = useMemo(
    () => computeWordDiff(leftCompareStr, rightCompareStr),
    [leftCompareStr, rightCompareStr]
  );

  const handleRunAiComparison = async () => {
    if (!leftRow || !rightRow || aiAnalysisLoading) return;
    setAiAnalysisLoading(true);
    setAiAnalysisError('');
    try {
      const prompt = `तल दिइएका दुई कानुनी प्रावधानहरूको स्पष्ट र व्यावहारिक साइड-बाइ-साइड तुलनात्मक विश्लेषण शुद्ध नेपालीमा बुँदागत रूपमा लेख्नुहोस्:

【पक्ष १ (${compareMode === 'same-act-revision' ? 'संशोधनपूर्व / मूल प्रावधान' : 'ऐन/दस्तावेज १'})】
दस्तावेज: ${leftDocInfo?.filename || leftRow.pdf_name}
प्रावधान: ${getRowLabel(leftRow)} (पृष्ठ ${leftRow.title_page || leftRow.anusuchi_print_page || '-'})
सारांश: ${leftDafaRec?.summaryNepali || 'उपलब्ध छैन'}
${leftPageState.text ? `मूल पृष्ठ अंश:\n${leftPageState.text.slice(0, 1400)}` : ''}

【पक्ष २ (${compareMode === 'same-act-revision' ? 'संशोधनपछि / तुलनात्मक प्रावधान' : 'ऐन/दस्तावेज २'})】
दस्तावेज: ${rightDocInfo?.filename || rightRow.pdf_name}
प्रावधान: ${getRowLabel(rightRow)} (पृष्ठ ${rightRow.title_page || rightRow.anusuchi_print_page || '-'})
सारांश: ${rightDafaRec?.summaryNepali || 'उपलब्ध छैन'}
${rightPageState.text ? `मूल पृष्ठ अंश:\n${rightPageState.text.slice(0, 1400)}` : ''}

कृपया निम्न ४ शीर्षकमा स्पष्ट उत्तर दिनुहोस्:
१. मुख्य समानता
२. प्रमुख कानुनी भिन्नता वा संशोधनको सार
३. अधिकार, समयसीमा वा दण्ड सजायमा प्रभाव
४. व्यावहारिक निष्कर्ष`;

      const { ok, data } = await safeFetchJson('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          taskMode: 'fast',
          enableSearch: false,
        }),
      });
      if (!ok || !data?.success || !data?.reply) {
        setAiAnalysisError(data?.error || 'AI तुलनात्मक विश्लेषण तयार गर्न सकिएन।');
        return;
      }
      setAiAnalysisText(data.reply);
    } catch (err: any) {
      setAiAnalysisError(err?.message || 'AI तुलनात्मक विश्लेषण त्रुटि।');
    } finally {
      setAiAnalysisLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Mode Controls */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-slate-900">
              <GitCompare className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base sm:text-lg font-extrabold">
                साइड-बाइ-साइड तुलना दृश्य (Compare View)
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600">
              दुई फरक ऐन/नियमका दफाहरू वा एउटै ऐनका संशोधनपूर्व र पछिका दफाहरू सँगसँगै राखेर सारांश, मूल पाठ र शब्द-अन्तर (Diff) तुलना गर्नुहोस्।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setCompareMode('two-acts')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  compareMode === 'two-acts'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                दुई फरक ऐन तुलना
              </button>
              <button
                type="button"
                onClick={() => {
                  setCompareMode('same-act-revision');
                  if (rightRowIndex === leftRowIndex && leftRows.length > 1) {
                    setRightRowIndex(Math.min(leftRows.length - 1, leftRowIndex + 1));
                  }
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  compareMode === 'same-act-revision'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                एउटै ऐन: संशोधनपूर्व / पछि वा दुई दफा
              </button>
            </div>
            <FontSizeControls />
          </div>
        </div>

        {/* Quick Preset Comparisons */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-500 mr-1">तत्काल तुलना:</span>
          {COMPARE_PRESETS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleApplyPreset(p)}
              title={p.desc}
              className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 transition-colors cursor-pointer"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Comparison Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSyncSectionNumber(prev => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                syncSectionNumber
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>समान दफा नम्बर मिलाउनुहोस्</span>
            </button>

            <button
              type="button"
              onClick={handleSwapSides}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>बायाँ ↔ दायाँ साट्नुहोस्</span>
            </button>

            <button
              type="button"
              onClick={() => setCustomRevisionMode(prev => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                customRevisionMode
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
              title="संशोधनपूर्वको पुरानो पाठ र संशोधनपछिको नयाँ पाठ सिधै राखेर शब्द-अन्तर हेर्नुहोस्"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>संशोधन पाठ पेस्ट/सम्पादन</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPdfPreview(prev => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                showPdfPreview
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>PDF पृष्ठ सँगै हेर्नुहोस्</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDiffPanel(prev => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                showDiffPanel
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>शब्द-अन्तर (Diff: {toDevaDigits(diffSummary.similarityPercent)}%)</span>
            </button>

            <button
              type="button"
              onClick={() => void handleRunAiComparison()}
              disabled={aiAnalysisLoading || !leftRow || !rightRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-colors cursor-pointer"
            >
              {aiAnalysisLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>AI तुलनात्मक विश्लेषण</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Side-by-Side Dual Panes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LEFT PANE */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col overflow-hidden">
          <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[11px] font-bold shrink-0">
                {compareMode === 'same-act-revision' ? 'संशोधनपूर्व / पक्ष १' : 'पक्ष १ (बायाँ)'}
              </span>
              <span className="text-xs font-semibold truncate text-slate-200">
                {leftDocInfo?.filename || 'दस्तावेज छान्नुहोस्'}
              </span>
            </div>
            {leftRow && (
              <button
                type="button"
                onClick={() =>
                  onOpenPdf(
                    leftDocPath,
                    String(leftPhysicalPage),
                    getDisplaySectionId(leftRow) || getDisplaySectionTitle(leftRow)
                  )
                }
                className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <FileText className="w-3 h-3" />
                <span>PDF पन्ना {toDevaDigits(leftPhysicalPage)}</span>
              </button>
            )}
          </div>

          {/* Document & Section Selectors */}
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 space-y-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                दस्तावेज / ऐन / नियमावली छान्नुहोस्:
              </label>
              <select
                value={leftDocPath}
                onChange={e => handleSelectLeftDoc(e.target.value)}
                className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {sortedDocs.map(d => (
                  <option key={d.path} value={d.path}>
                    [{d.folderId}] {d.filename}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <div className="sm:col-span-4 relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={leftFilter}
                  onChange={e => setLeftFilter(e.target.value)}
                  placeholder="दफा/शीर्षक खोज्नुहोस्..."
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg pl-8 pr-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="sm:col-span-8 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSelectLeftRowIndex(Math.max(0, leftRowIndex - 1))}
                  disabled={leftRowIndex <= 0}
                  className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  title="अघिल्लो दफा"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <select
                  value={leftRowIndex}
                  onChange={e => handleSelectLeftRowIndex(Number(e.target.value))}
                  className="flex-1 min-w-0 text-xs font-semibold bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {filteredLeftRows.map(({ row, idx }) => (
                    <option key={`${row.order_index}_${idx}`} value={idx}>
                      {getRowLabel(row)} (पृ. {row.title_page || row.anusuchi_print_page || '-'})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    handleSelectLeftRowIndex(Math.min(leftRows.length - 1, leftRowIndex + 1))
                  }
                  disabled={leftRowIndex >= leftRows.length - 1}
                  className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  title="अर्को दफा"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Left Section Content */}
          {leftRow ? (
            <div className="p-4 space-y-3.5 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-bold">
                      {leftRow.type || (isAnusuchiRow(leftRow) ? 'अनुसूची' : 'दफा/धारा')}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 text-[11px] font-bold">
                      पृष्ठ: {leftRow.title_page || leftRow.anusuchi_print_page || '—'}
                    </span>
                    {leftDafaRec && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[11px] font-bold">
                        <CheckCircle2 className="w-3 h-3" />
                        सारांश उपलब्ध
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                    {getRowLabel(leftRow)}
                  </h3>
                </div>
                {onOpenModal && (
                  <button
                    type="button"
                    onClick={() => onOpenModal(leftRow, leftRows)}
                    className="text-[11px] font-semibold text-indigo-700 hover:underline cursor-pointer shrink-0"
                  >
                    १०-स्तम्भ हेर्नुहोस् →
                  </button>
                )}
              </div>

              {/* Clean AI Summary */}
              {leftDafaRec ? (
                <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-3.5 space-y-2">
                  <div className="text-xs font-extrabold text-emerald-900 flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-emerald-700" />
                    <span>नेपाली कानुनी सारांश</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                    {leftDafaRec.summaryNepali}
                  </p>
                  {leftDafaRec.keyObligations && leftDafaRec.keyObligations.length > 0 && (
                    <ul className="pt-1.5 border-t border-emerald-200/70 space-y-1 text-xs text-emerald-950 list-disc pl-4">
                      {leftDafaRec.keyObligations.map((ob, i) => (
                        <li key={i}>{ob}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-500">
                  यस दफाको AI सारांश अझै तयार छैन — तल मूल PDF पृष्ठ पाठ वा PDF पृष्ठ दृश्य उपलब्ध छ।
                </div>
              )}

              {/* Custom Editable Before-Text OR Extracted PDF Text */}
              {customRevisionMode ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-amber-900 flex items-center justify-between">
                    <span>संशोधनपूर्व / पक्ष १ पाठ (सम्पादनयोग्य):</span>
                    <button
                      type="button"
                      onClick={() => setCustomLeftText(leftPageState.text || leftDafaRec?.summaryNepali || '')}
                      className="text-[11px] text-indigo-700 hover:underline cursor-pointer"
                    >
                      PDF/सारांशबाट भर्नुहोस्
                    </button>
                  </label>
                  <textarea
                    value={customLeftText}
                    onChange={e => setCustomLeftText(e.target.value)}
                    rows={7}
                    placeholder="संशोधनपूर्वको दफा पाठ यहाँ पेस्ट वा सम्पादन गर्नुहोस्..."
                    className="w-full text-xs sm:text-sm rounded-xl border border-amber-300 bg-amber-50/30 p-3 text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                      <span>मूल PDF पृष्ठ पाठ (पन्ना {toDevaDigits(leftPhysicalPage)})</span>
                    </span>
                    {leftPageState.loading && (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                    )}
                  </div>
                  {leftPageState.corruptedCmap ? (
                    <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                      यस PDF को फन्ट इन्कोडिङ (CMap) स्क्यान/गडबड भएकाले माथिको सारांश र तलको PDF पृष्ठ दृश्य प्रयोग गर्नुहोस्।
                    </div>
                  ) : leftPageState.error ? (
                    <div className="text-xs text-rose-700">{leftPageState.error}</div>
                  ) : leftPageState.text ? (
                    <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto pr-1">
                      {leftPageState.text}
                    </div>
                  ) : (
                    !leftPageState.loading && (
                      <div className="text-xs text-slate-500">यस पृष्ठमा निकाल्न मिल्ने पाठ फेला परेन।</div>
                    )
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-slate-500">दफा/रेकर्ड फेला परेन।</div>
          )}
        </div>

        {/* RIGHT PANE */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col overflow-hidden">
          <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[11px] font-bold shrink-0">
                {compareMode === 'same-act-revision' ? 'संशोधनपछि / पक्ष २' : 'पक्ष २ (दायाँ)'}
              </span>
              <span className="text-xs font-semibold truncate text-slate-200">
                {rightDocInfo?.filename || 'दस्तावेज छान्नुहोस्'}
              </span>
            </div>
            {rightRow && (
              <button
                type="button"
                onClick={() =>
                  onOpenPdf(
                    activeRightDocPath,
                    String(rightPhysicalPage),
                    getDisplaySectionId(rightRow) || getDisplaySectionTitle(rightRow)
                  )
                }
                className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <FileText className="w-3 h-3" />
                <span>PDF पन्ना {toDevaDigits(rightPhysicalPage)}</span>
              </button>
            )}
          </div>

          {/* Document & Section Selectors */}
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 space-y-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                {compareMode === 'same-act-revision'
                  ? 'सोही दस्तावेज (संशोधन / अर्को दफा तुलना):'
                  : 'तुलना गरिने दोस्रो दस्तावेज / ऐन छान्नुहोस्:'}
              </label>
              {compareMode === 'same-act-revision' ? (
                <div className="w-full text-xs font-semibold bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-700 truncate">
                  [{rightDocInfo?.folderId}] {rightDocInfo?.filename}
                </div>
              ) : (
                <select
                  value={rightDocPath}
                  onChange={e => handleSelectRightDoc(e.target.value)}
                  className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {sortedDocs.map(d => (
                    <option key={d.path} value={d.path}>
                      [{d.folderId}] {d.filename}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <div className="sm:col-span-4 relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={rightFilter}
                  onChange={e => setRightFilter(e.target.value)}
                  placeholder="दफा/शीर्षक खोज्नुहोस्..."
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg pl-8 pr-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="sm:col-span-8 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setRightRowIndex(Math.max(0, rightRowIndex - 1))}
                  disabled={rightRowIndex <= 0}
                  className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  title="अघिल्लो दफा"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <select
                  value={rightRowIndex}
                  onChange={e => setRightRowIndex(Number(e.target.value))}
                  className="flex-1 min-w-0 text-xs font-semibold bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {filteredRightRows.map(({ row, idx }) => (
                    <option key={`${row.order_index}_${idx}`} value={idx}>
                      {getRowLabel(row)} (पृ. {row.title_page || row.anusuchi_print_page || '-'})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    setRightRowIndex(Math.min(rightRows.length - 1, rightRowIndex + 1))
                  }
                  disabled={rightRowIndex >= rightRows.length - 1}
                  className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  title="अर्को दफा"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Section Content */}
          {rightRow ? (
            <div className="p-4 space-y-3.5 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-bold">
                      {rightRow.type || (isAnusuchiRow(rightRow) ? 'अनुसूची' : 'दफा/धारा')}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[11px] font-bold">
                      पृष्ठ: {rightRow.title_page || rightRow.anusuchi_print_page || '—'}
                    </span>
                    {rightDafaRec && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[11px] font-bold">
                        <CheckCircle2 className="w-3 h-3" />
                        सारांश उपलब्ध
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                    {getRowLabel(rightRow)}
                  </h3>
                </div>
                {onOpenModal && (
                  <button
                    type="button"
                    onClick={() => onOpenModal(rightRow, rightRows)}
                    className="text-[11px] font-semibold text-emerald-700 hover:underline cursor-pointer shrink-0"
                  >
                    १०-स्तम्भ हेर्नुहोस् →
                  </button>
                )}
              </div>

              {/* Clean AI Summary */}
              {rightDafaRec ? (
                <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-3.5 space-y-2">
                  <div className="text-xs font-extrabold text-emerald-900 flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-emerald-700" />
                    <span>नेपाली कानुनी सारांश</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                    {rightDafaRec.summaryNepali}
                  </p>
                  {rightDafaRec.keyObligations && rightDafaRec.keyObligations.length > 0 && (
                    <ul className="pt-1.5 border-t border-emerald-200/70 space-y-1 text-xs text-emerald-950 list-disc pl-4">
                      {rightDafaRec.keyObligations.map((ob, i) => (
                        <li key={i}>{ob}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-500">
                  यस दफाको AI सारांश अझै तयार छैन — तल मूल PDF पृष्ठ पाठ वा PDF पृष्ठ दृश्य उपलब्ध छ।
                </div>
              )}

              {/* Custom Editable After-Text OR Extracted PDF Text */}
              {customRevisionMode ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-emerald-900 flex items-center justify-between">
                    <span>संशोधनपछि / पक्ष २ पाठ (सम्पादनयोग्य):</span>
                    <button
                      type="button"
                      onClick={() => setCustomRightText(rightPageState.text || rightDafaRec?.summaryNepali || '')}
                      className="text-[11px] text-emerald-700 hover:underline cursor-pointer"
                    >
                      PDF/सारांशबाट भर्नुहोस्
                    </button>
                  </label>
                  <textarea
                    value={customRightText}
                    onChange={e => setCustomRightText(e.target.value)}
                    rows={7}
                    placeholder="संशोधनपछिको दफा पाठ यहाँ पेस्ट वा सम्पादन गर्नुहोस्..."
                    className="w-full text-xs sm:text-sm rounded-xl border border-emerald-300 bg-emerald-50/30 p-3 text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                      <span>मूल PDF पृष्ठ पाठ (पन्ना {toDevaDigits(rightPhysicalPage)})</span>
                    </span>
                    {rightPageState.loading && (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    )}
                  </div>
                  {rightPageState.corruptedCmap ? (
                    <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                      यस PDF को फन्ट इन्कोडिङ (CMap) स्क्यान/गडबड भएकाले माथिको सारांश र तलको PDF पृष्ठ दृश्य प्रयोग गर्नुहोस्।
                    </div>
                  ) : rightPageState.error ? (
                    <div className="text-xs text-rose-700">{rightPageState.error}</div>
                  ) : rightPageState.text ? (
                    <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto pr-1">
                      {rightPageState.text}
                    </div>
                  ) : (
                    !rightPageState.loading && (
                      <div className="text-xs text-slate-500">यस पृष्ठमा निकाल्न मिल्ने पाठ फेला परेन।</div>
                    )
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-slate-500">दफा/रेकर्ड फेला परेन।</div>
          )}
        </div>
      </div>

      {/* Inline PDF Page Preview (Single RAM-safe Viewer with Left/Right Switcher) */}
      {showPdfPreview && (leftRow || rightRow) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold">
              <Eye className="w-4 h-4 text-emerald-400" />
              <span>सन्दर्भ PDF पृष्ठ दृश्य (पन्ना प्रमाणिकरण)</span>
            </div>
            <div className="inline-flex rounded-lg bg-slate-800 p-0.5 border border-slate-700 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setPdfPreviewSide('left')}
                className={`px-3 py-1 rounded-md cursor-pointer transition-colors ${
                  pdfPreviewSide === 'left'
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                पक्ष १ (बायाँ • पन्ना {toDevaDigits(leftPhysicalPage)})
              </button>
              <button
                type="button"
                onClick={() => setPdfPreviewSide('right')}
                className={`px-3 py-1 rounded-md cursor-pointer transition-colors ${
                  pdfPreviewSide === 'right'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                पक्ष २ (दायाँ • पन्ना {toDevaDigits(rightPhysicalPage)})
              </button>
            </div>
          </div>
          <div className="h-[520px] bg-slate-100">
            {pdfPreviewSide === 'left' && leftRow ? (
              <PdfCanvasViewer
                pdfPath={leftDocPath}
                page={leftPhysicalPage}
                title={leftDocInfo?.filename}
                highlightText={getDisplaySectionId(leftRow) || getDisplaySectionTitle(leftRow)}
              />
            ) : rightRow ? (
              <PdfCanvasViewer
                pdfPath={activeRightDocPath}
                page={rightPhysicalPage}
                title={rightDocInfo?.filename}
                highlightText={getDisplaySectionId(rightRow) || getDisplaySectionTitle(rightRow)}
              />
            ) : null}
          </div>
        </div>
      )}

      {/* Inline Word-Level Diff Comparison Panel */}
      {showDiffPanel && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 sm:p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-extrabold text-slate-900">
                शब्द-स्तरीय तुलनात्मक अन्तर (Side-by-Side Text Diff)
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!customRevisionMode && (
                <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setDiffSourceMode('summary')}
                    className={`px-2.5 py-1 rounded-md cursor-pointer ${
                      diffSourceMode === 'summary'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600'
                    }`}
                  >
                    सारांश तुलना
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiffSourceMode('text')}
                    className={`px-2.5 py-1 rounded-md cursor-pointer ${
                      diffSourceMode === 'text'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600'
                    }`}
                  >
                    मूल PDF पाठ तुलना
                  </button>
                </div>
              )}

              <span className="px-2 py-1 rounded bg-slate-100 text-slate-800 text-[11px] font-bold">
                समानता: {toDevaDigits(diffSummary.similarityPercent)}%
              </span>
              <span className="px-2 py-1 rounded bg-rose-50 text-rose-800 border border-rose-200 text-[11px] font-bold">
                − हटाइएको/बायाँ मात्र: {toDevaDigits(diffSummary.removedTokens)} शब्द
              </span>
              <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                + थपिएको/दायाँ मात्र: {toDevaDigits(diffSummary.addedTokens)} शब्द
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 sm:p-4 text-xs sm:text-sm leading-loose text-slate-800">
            {diffSummary.segments.length === 0 ? (
              <span className="text-slate-500">तुलना गर्न पाठ उपलब्ध छैन।</span>
            ) : (
              diffSummary.segments.map((seg, i) => {
                if (seg.type === 'same') {
                  return <span key={i}>{seg.text} </span>;
                }
                if (seg.type === 'removed') {
                  return (
                    <del
                      key={i}
                      className="bg-rose-100 text-rose-900 px-1 py-0.5 rounded mx-0.5 decoration-rose-600"
                    >
                      {seg.text}
                    </del>
                  );
                }
                return (
                  <ins
                    key={i}
                    className="bg-emerald-100 text-emerald-950 font-semibold px-1 py-0.5 rounded mx-0.5 no-underline border-b-2 border-emerald-500"
                  >
                    {seg.text}
                  </ins>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Optional AI Legal Comparison Output */}
      {(aiAnalysisError || aiAnalysisText) && (
        <div className="bg-white rounded-xl border border-indigo-200 shadow-2xs p-4 sm:p-5 space-y-2.5">
          <div className="flex items-center gap-2 text-indigo-950">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-extrabold">AI तुलनात्मक कानुनी विश्लेषण</h3>
          </div>
          {aiAnalysisError ? (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{aiAnalysisError}</span>
            </div>
          ) : (
            <div
              className="prose prose-sm max-w-none prose-slate leading-relaxed text-xs sm:text-sm"
              dangerouslySetInnerHTML={{ __html: renderSafeMarkdownHtml(aiAnalysisText) }}
            />
          )}
        </div>
      )}
    </div>
  );
};
