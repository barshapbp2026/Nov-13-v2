import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Database,
  Sparkles,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Play,
  Square,
  Search,
  LogIn,
  LogOut,
  FileText,
  Layers,
  ShieldCheck,
  KeyRound,
  Zap,
  Copy,
  Upload,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  DafaSummaryItem,
  DocumentSummary,
  LegalRow,
  StoredDafaSummaryRecord,
  StoredPdfSummaryRecord,
} from '../types';
import {
  ADMIN_EMAIL,
  OWNER_EMAIL,
  buildDafaSummaryDocId,
  buildPdfSummaryDocId,
  isAuthorizedMasterUser,
  saveDafaSummariesBatchToFirestore,
  savePdfSummaryToFirestore,
} from '../services/firestoreSummaryStore';
import { compareNumericPrefixes } from '../utils/urlUtils';
import { safeFetchJson } from '../utils/safeFetchJson';
import {
  computePendingFirestoreSyncRecords,
  isDirtyOrIncompleteDafaRecord,
  isDirtyOrIncompletePdfRecord,
  sanitizeDafaSummaryItem,
  sanitizePdfSummaryResult,
} from '../utils/summarySanitizer';
import verifiedRepairsData from '../data/verified_summary_repairs.json';
import { FontSizeControls } from './FontSizeControls';

interface MasterSummaryHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  documents: DocumentSummary[];
  allRows: LegalRow[];
  currentUser: User | null;
  onSignIn: () => Promise<User | null>;
  onSignOut: () => Promise<void>;
  cachedPdfSummaries: StoredPdfSummaryRecord[];
  cachedDafaSummaries: StoredDafaSummaryRecord[];
  rawFirestorePdfSummaries?: StoredPdfSummaryRecord[];
  rawFirestoreDafaSummaries?: StoredDafaSummaryRecord[];
  onRefreshStore: () => Promise<void>;
  onPdfSaved: (record: StoredPdfSummaryRecord) => void;
  onDafasSaved: (records: StoredDafaSummaryRecord[]) => void;
}

function toDevaNum(val: number | string): string {
  const devDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  return String(val).replace(/[0-9]/g, d => devDigits[parseInt(d, 10)]);
}

export const MasterSummaryHubModal: React.FC<MasterSummaryHubModalProps> = ({
  isOpen,
  onClose,
  documents,
  allRows,
  currentUser,
  onSignIn,
  onSignOut,
  cachedPdfSummaries,
  cachedDafaSummaries,
  rawFirestorePdfSummaries,
  rawFirestoreDafaSummaries,
  onRefreshStore,
  onPdfSaved,
  onDafasSaved,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'batch' | 'browse' | 'import'>('batch');
  const [externalJsonInput, setExternalJsonInput] = useState<string>('');
  const [importingJson, setImportingJson] = useState<boolean>(false);
  const [importMessage, setImportMessage] = useState<string>('');
  const [importFolder, setImportFolder] = useState<string>('');
  const [importDocPath, setImportDocPath] = useState<string>('');
  const [importPromptTarget, setImportPromptTarget] = useState<'both' | 'pdf' | 'dafas'>('both');
  const [importSkipCachedDafas, setImportSkipCachedDafas] = useState<boolean>(true);

  const [scopeMode, setScopeMode] = useState<'all' | 'folder' | 'doc'>('all');
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [selectedDocPath, setSelectedDocPath] = useState<string>(documents[0]?.path || '');
  const [skipCached, setSkipCached] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [browseType, setBrowseType] = useState<'pdfs' | 'dafas'>('dafas');

  // Batch runner state
  const [running, setRunning] = useState<boolean>(false);
  const [runningKind, setRunningKind] = useState<'all' | 'pdf' | 'dafa' | null>(null);
  const [progressCurrent, setProgressCurrent] = useState<number>(0);
  const [progressTotal, setProgressTotal] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('');
  const [batchError, setBatchError] = useState<string>('');
  const [batchLogs, setBatchLogs] = useState<
    { id: string; text: string; level: 'info' | 'success' | 'warn' | 'error' }[]
  >([]);
  const [poolKeysCount, setPoolKeysCount] = useState<number | null>(null);
  const [poolActiveCount, setPoolActiveCount] = useState<number | null>(null);
  const [poolInvalidSlots, setPoolInvalidSlots] = useState<string[]>([]);
  const [browsePdfFilter, setBrowsePdfFilter] = useState<string>('all');
  const stopFlagRef = useRef<boolean>(false);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  const appendBatchLog = (
    text: string,
    level: 'info' | 'success' | 'warn' | 'error' = 'info'
  ) => {
    setBatchLogs(prev => {
      const next = [
        ...prev,
        { id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, text, level },
      ];
      return next.length > 500 ? next.slice(next.length - 500) : next;
    });
  };

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [batchLogs.length]);

  const refreshPoolStatus = async () => {
    try {
      const { ok, data } = await safeFetchJson('/api/gemini/pool-status');
      if (ok && typeof data?.configuredKeysCount === 'number') {
        setPoolKeysCount(data.configuredKeysCount);
        setPoolActiveCount(
          typeof data.activeKeysCount === 'number'
            ? data.activeKeysCount
            : data.configuredKeysCount
        );
        setPoolInvalidSlots(Array.isArray(data.invalidKeySlots) ? data.invalidKeySlots : []);
      }
    } catch {
      // ignore non-critical status check error
    }
  };

  useEffect(() => {
    if (isOpen) {
      void refreshPoolStatus();
      void onRefreshStore();
    }
  }, [isOpen, onRefreshStore]);

  const uniqueFolders = useMemo(() => {
    const set = Array.from(new Set(documents.map(d => d.folderName)));
    return set.sort(compareNumericPrefixes);
  }, [documents]);

  // Unique physical PDFs (by path)
  const uniqueDocs = useMemo(() => {
    const map = new Map<string, DocumentSummary>();
    documents.forEach(d => {
      if (!map.has(d.path)) map.set(d.path, d);
    });
    return Array.from(map.values()).sort((a, b) => compareNumericPrefixes(a.filename, b.filename));
  }, [documents]);

  const targetDocs = useMemo(() => {
    if (scopeMode === 'doc' && selectedDocPath) {
      return uniqueDocs.filter(d => d.path === selectedDocPath);
    }
    if (scopeMode === 'folder' && selectedFolder !== 'all') {
      return uniqueDocs.filter(d => d.folderName === selectedFolder);
    }
    return uniqueDocs;
  }, [scopeMode, selectedDocPath, selectedFolder, uniqueDocs]);

  // Exact 1-based position & total count inside each PDF (sorted ascending from Dafa 1)
  const dafaMetaByDocId = useMemo(() => {
    const grouped = new Map<string, LegalRow[]>();
    for (const r of allRows) {
      if (!grouped.has(r.pdf_path)) grouped.set(r.pdf_path, []);
      grouped.get(r.pdf_path)!.push(r);
    }
    const meta = new Map<
      string,
      { orderIndex: number; indexInPdf: number; totalInPdf: number }
    >();
    for (const list of grouped.values()) {
      const sorted = [...list].sort(
        (a, b) => (a.order_index ?? Number.MAX_SAFE_INTEGER) - (b.order_index ?? Number.MAX_SAFE_INTEGER)
      );
      const total = sorted.length;
      sorted.forEach((row, idx) => {
        meta.set(buildDafaSummaryDocId(row), {
          orderIndex: row.order_index ?? idx + 1,
          indexInPdf: idx + 1,
          totalInPdf: total,
        });
      });
    }
    return meta;
  }, [allRows]);

  const targetRows = useMemo(() => {
    const allowedPaths = new Set(targetDocs.map(d => d.path));
    return allRows
      .filter(r => allowedPaths.has(r.pdf_path))
      .sort(
        (a, b) => (a.order_index ?? Number.MAX_SAFE_INTEGER) - (b.order_index ?? Number.MAX_SAFE_INTEGER)
      );
  }, [targetDocs, allRows]);

  const cachedPdfMap = useMemo(() => {
    const map = new Map<string, StoredPdfSummaryRecord>();
    cachedPdfSummaries.forEach(p => map.set(p.docId, p));
    return map;
  }, [cachedPdfSummaries]);

  const cachedPdfByPathMap = useMemo(() => {
    const map = new Map<string, StoredPdfSummaryRecord>();
    for (const p of cachedPdfSummaries) {
      const mode = p.mode || 'executive';
      const lang = p.language || 'ne';
      if (mode !== 'executive' || lang !== 'ne') continue;
      const existing = map.get(p.pdfPath);
      if (!existing || (isDirtyOrIncompletePdfRecord(existing) && !isDirtyOrIncompletePdfRecord(p))) {
        map.set(p.pdfPath, p);
      }
    }
    return map;
  }, [cachedPdfSummaries]);

  const cachedDafaMap = useMemo(() => {
    const map = new Map<string, StoredDafaSummaryRecord>();
    cachedDafaSummaries.forEach(d => map.set(d.docId, d));
    return map;
  }, [cachedDafaSummaries]);

  const hasCleanPdfSummary = (pdfPath: string, docId?: string): boolean => {
    const byId =
      (docId ? cachedPdfMap.get(docId) : undefined) ||
      cachedPdfMap.get(buildPdfSummaryDocId(pdfPath, 'executive', 'ne'));
    const rec = byId || cachedPdfByPathMap.get(pdfPath);
    return Boolean(rec && !isDirtyOrIncompletePdfRecord(rec));
  };

  const hasCleanDafaSummary = (docId: string): boolean => {
    const rec = cachedDafaMap.get(docId);
    return Boolean(rec && !isDirtyOrIncompleteDafaRecord(rec));
  };

  const cleanPdfPathsRef = useRef<Set<string>>(new Set());
  const cleanDafaIdsRef = useRef<Set<string>>(new Set());
  const skipCachedRef = useRef<boolean>(skipCached);
  skipCachedRef.current = skipCached;

  useEffect(() => {
    const pdfSet = new Set<string>();
    for (const docItem of uniqueDocs) {
      if (hasCleanPdfSummary(docItem.path)) {
        pdfSet.add(docItem.path);
      }
    }
    cleanPdfPathsRef.current = pdfSet;

    const dafaSet = new Set<string>();
    for (const [id, rec] of cachedDafaMap.entries()) {
      if (!isDirtyOrIncompleteDafaRecord(rec)) {
        dafaSet.add(id);
      }
    }
    cleanDafaIdsRef.current = dafaSet;
  });

  const pendingBatchDocs = useMemo(() => {
    if (!skipCached) return targetDocs;
    return targetDocs.filter(docItem => !hasCleanPdfSummary(docItem.path));
  }, [targetDocs, skipCached, cachedPdfMap, cachedPdfByPathMap]);

  const pendingBatchRows = useMemo(() => {
    if (!skipCached) return targetRows;
    return targetRows.filter(row => !hasCleanDafaSummary(buildDafaSummaryDocId(row)));
  }, [targetRows, skipCached, cachedDafaMap]);

  const rawFirestoreDafaMap = useMemo(() => {
    const map = new Map<string, StoredDafaSummaryRecord>();
    (rawFirestoreDafaSummaries || []).forEach(d => map.set(d.docId, d));
    return map;
  }, [rawFirestoreDafaSummaries]);

  const rowByDocId = useMemo(() => {
    const map = new Map<string, LegalRow>();
    allRows.forEach(r => map.set(buildDafaSummaryDocId(r), r));
    return map;
  }, [allRows]);

  const rowsByPdfPathMap = useMemo(() => {
    const map = new Map<string, LegalRow[]>();
    for (const r of allRows) {
      if (!map.has(r.pdf_path)) map.set(r.pdf_path, []);
      map.get(r.pdf_path)!.push(r);
    }
    return map;
  }, [allRows]);

  const importDocStatusByPath = useMemo(() => {
    const map = new Map<
      string,
      {
        pdfReady: boolean;
        cleanDafas: number;
        totalDafas: number;
        pendingDafas: number;
        isFullyDone: boolean;
      }
    >();
    for (const docItem of uniqueDocs) {
      const pdfReady = hasCleanPdfSummary(docItem.path);
      const rows = rowsByPdfPathMap.get(docItem.path) || [];
      let cleanDafas = 0;
      for (const r of rows) {
        if (hasCleanDafaSummary(buildDafaSummaryDocId(r))) cleanDafas++;
      }
      const pendingDafas = Math.max(0, rows.length - cleanDafas);
      map.set(docItem.path, {
        pdfReady,
        cleanDafas,
        totalDafas: rows.length,
        pendingDafas,
        isFullyDone: pdfReady && pendingDafas === 0,
      });
    }
    return map;
  }, [uniqueDocs, rowsByPdfPathMap, cachedPdfMap, cachedPdfByPathMap, cachedDafaMap]);

  const defaultImportFolder = useMemo(() => {
    if (importSkipCachedDafas) {
      const twelvePending = uniqueFolders.find(
        f =>
          f.trim().startsWith('१२.') &&
          uniqueDocs.some(
            d => d.folderName === f && !importDocStatusByPath.get(d.path)?.isFullyDone
          )
      );
      if (twelvePending) return twelvePending;
      const firstPendingFolder = uniqueFolders.find(f =>
        uniqueDocs.some(
          d => d.folderName === f && !importDocStatusByPath.get(d.path)?.isFullyDone
        )
      );
      if (firstPendingFolder) return firstPendingFolder;
    }
    return (
      uniqueFolders.find(f => f.trim().startsWith('१२.')) ||
      uniqueFolders[0] ||
      ''
    );
  }, [uniqueFolders, uniqueDocs, importSkipCachedDafas, importDocStatusByPath]);

  const activeImportFolder = useMemo(() => {
    if (importFolder && uniqueFolders.includes(importFolder)) return importFolder;
    return defaultImportFolder;
  }, [importFolder, uniqueFolders, defaultImportFolder]);

  const docsInImportFolder = useMemo(() => {
    return uniqueDocs.filter(d => d.folderName === activeImportFolder);
  }, [uniqueDocs, activeImportFolder]);

  const selectedImportDoc = useMemo(() => {
    if (importDocPath) {
      const exact = docsInImportFolder.find(d => d.path === importDocPath);
      if (exact) return exact;
    }
    if (importSkipCachedDafas) {
      const firstPendingInFolder = docsInImportFolder.find(
        d => !importDocStatusByPath.get(d.path)?.isFullyDone
      );
      if (firstPendingInFolder) return firstPendingInFolder;
    }
    return (
      docsInImportFolder.find(d => d.filename.trim().startsWith('१२.१')) ||
      docsInImportFolder[0] ||
      uniqueDocs[0]
    );
  }, [importDocPath, docsInImportFolder, uniqueDocs, importSkipCachedDafas, importDocStatusByPath]);

  const importDocPdfId = useMemo(() => {
    if (!selectedImportDoc) return '';
    return buildPdfSummaryDocId(selectedImportDoc.path, 'executive', 'ne');
  }, [selectedImportDoc]);

  const importDocHasCleanPdfSummary = useMemo(() => {
    if (!selectedImportDoc) return false;
    return hasCleanPdfSummary(selectedImportDoc.path, importDocPdfId);
  }, [selectedImportDoc, importDocPdfId, cachedPdfMap, cachedPdfByPathMap]);

  const importDocAllRows = useMemo(() => {
    if (!selectedImportDoc) return [];
    return allRows
      .filter(r => r.pdf_path === selectedImportDoc.path)
      .sort(
        (a, b) =>
          (a.order_index ?? Number.MAX_SAFE_INTEGER) - (b.order_index ?? Number.MAX_SAFE_INTEGER)
      );
  }, [allRows, selectedImportDoc]);

  const importDocCleanDafaCount = useMemo(() => {
    let clean = 0;
    for (const r of importDocAllRows) {
      if (hasCleanDafaSummary(buildDafaSummaryDocId(r))) clean++;
    }
    return clean;
  }, [importDocAllRows, cachedDafaMap]);

  const importTargetDafas = useMemo(() => {
    return importDocAllRows
      .map((row, idx) => ({
        indexInPdf: idx + 1,
        docId: buildDafaSummaryDocId(row),
        row,
      }))
      .filter(entry => {
        if (!importSkipCachedDafas) return true;
        return !hasCleanDafaSummary(entry.docId);
      });
  }, [importDocAllRows, importSkipCachedDafas, cachedDafaMap]);

  const importIncludePdfInPrompt = useMemo(() => {
    const wantsPdf = importPromptTarget === 'both' || importPromptTarget === 'pdf';
    if (!wantsPdf) return false;
    if (importSkipCachedDafas && importDocHasCleanPdfSummary) return false;
    return true;
  }, [importPromptTarget, importSkipCachedDafas, importDocHasCleanPdfSummary]);

  const importIncludeDafasInPrompt = useMemo(() => {
    const wantsDafas = importPromptTarget === 'both' || importPromptTarget === 'dafas';
    return wantsDafas && importTargetDafas.length > 0;
  }, [importPromptTarget, importTargetDafas.length]);

  const handleJumpToNextPendingImportDoc = () => {
    if (docsInImportFolder.length === 0) return;
    const currentIdx = selectedImportDoc
      ? docsInImportFolder.findIndex(d => d.path === selectedImportDoc.path)
      : -1;

    if (!importSkipCachedDafas) {
      if (docsInImportFolder.length <= 1) return;
      const nextIdx = (Math.max(0, currentIdx) + 1) % docsInImportFolder.length;
      setImportDocPath(docsInImportFolder[nextIdx].path);
      return;
    }

    // Search forward inside the current folder for a pending PDF
    for (let offset = 1; offset <= docsInImportFolder.length; offset++) {
      const candidate = docsInImportFolder[(Math.max(0, currentIdx) + offset) % docsInImportFolder.length];
      if (!importDocStatusByPath.get(candidate.path)?.isFullyDone) {
        if (candidate.path !== selectedImportDoc?.path) {
          setImportDocPath(candidate.path);
          return;
        }
      }
    }

    // If all PDFs in the current folder are already prepared, jump to the next folder that has pending work
    const folderIdx = uniqueFolders.indexOf(activeImportFolder);
    for (let fOffset = 1; fOffset <= uniqueFolders.length; fOffset++) {
      const nextFolder = uniqueFolders[(Math.max(0, folderIdx) + fOffset) % uniqueFolders.length];
      const nextDoc = uniqueDocs.find(
        d => d.folderName === nextFolder && !importDocStatusByPath.get(d.path)?.isFullyDone
      );
      if (nextDoc) {
        setImportFolder(nextFolder);
        setImportDocPath(nextDoc.path);
        setImportMessage(`फोल्डर "${activeImportFolder}" पूरा भएकाले अर्को बाँकी "${nextDoc.filename}" छानियो।`);
        return;
      }
    }

    setImportMessage('सबै फोल्डर र PDF का सारांश पहिले नै तयार र सेभ भइसकेका छन् ✅');
  };

  const suggestedImportJsonFilename = useMemo(() => {
    if (!selectedImportDoc) return 'कानुनी_सारांश.json';
    const cleanBase = selectedImportDoc.filename
      .replace(/\.pdf$/i, '')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[\\/:*?"<>|]+/g, '');
    return `${cleanBase || 'कानुनी_कागजात'}_सारांश.json`;
  }, [selectedImportDoc]);

  const generatedExternalPrompt = useMemo(() => {
    if (!selectedImportDoc) return '';
    const includePdf = importIncludePdfInPrompt;
    const includeDafas = importIncludeDafasInPrompt;
    if (!includePdf && !includeDafas) return '';

    const pdfFolderId = selectedImportDoc.folderId || '';
    const pdfFolderName = selectedImportDoc.folderName || activeImportFolder;
    const pdfName = selectedImportDoc.filename;
    const pdfPath = selectedImportDoc.path;

    const targetDafaPayload = importTargetDafas.map(entry => ({
      docId: entry.docId,
      sectionId: entry.row.section_id || '',
      titleName: entry.row.title_name || '',
      titlePage: entry.row.title_page || entry.row.anusuchi_print_page || '',
      recordType: entry.row.type || 'दफा',
      anusuchiId: entry.row.anusuchi_id || '',
      anusuchiTitle: entry.row.anusuchi_title || '',
    }));

    const pdfTemplate = {
      docId: importDocPdfId,
      pdfPath,
      pdfName,
      folderId: pdfFolderId,
      folderName: pdfFolderName,
      mode: 'executive',
      language: 'ne',
      documentTitle: pdfName.replace(/\.pdf$/i, ''),
      overview: '२ देखि ४ अनुच्छेदको स्पष्ट, आधिकारिक र शैक्षिक कार्यकारी सारांश...',
      keyPoints: ['मुख्य कानुनी बुँदा १', 'मुख्य कानुनी बुँदा २', 'मुख्य कानुनी बुँदा ३', 'मुख्य कानुनी बुँदा ४', 'मुख्य कानुनी बुँदा ५'],
      importantSections: [
        {
          reference: 'दफा १',
          title: 'संक्षिप्त नाम र प्रारम्भ',
          summary: '१–२ वाक्यको स्पष्ट व्याख्या।',
          page: '१',
        },
      ],
      complianceAndDeadlines: ['अधिकार, हदम्याद, प्रक्रिया वा दण्ड-सजाय सम्बन्धी मुख्य बुँदाहरू...'],
      schedulesOverview: ['अनुसूचीहरू भए तिनको सारांश, नभए "यस कागजातमा छुट्टै अनुसूची उल्लेख छैन।"'],
      totalPages: 10,
      analyzedRange: 'पूरा कागजात',
      inputMethod: 'text-extracted',
      modelUsed: 'external-ai',
    };

    const dafaSample = targetDafaPayload.slice(0, 1).map(d => ({
      docId: d.docId,
      pdfPath,
      pdfName,
      folderId: pdfFolderId,
      sectionId: d.sectionId,
      titleName: d.titleName,
      titlePage: d.titlePage,
      recordType: d.recordType,
      anusuchiId: d.anusuchiId,
      anusuchiTitle: d.anusuchiTitle,
      summaryNepali: 'यस दफा/प्रावधानको २–३ वाक्यको स्पष्ट, तटस्थ र शुद्ध नेपाली युनिकोड सारांश...',
      keyObligations: ['मुख्य दायित्व, शर्त, हदम्याद वा सजाय'],
      modelUsed: 'external-ai',
    }));

    const schemaObj: Record<string, any> = {};
    if (includePdf) schemaObj.pdfSummaries = [pdfTemplate];
    if (includeDafas) schemaObj.dafaSummaries = dafaSample;
    else if (!includePdf) schemaObj.dafaSummaries = [];

    const totalDafaCountDeva = toDevaNum(targetDafaPayload.length);
    const compactTargetDafaJson =
      targetDafaPayload.length > 0
        ? `[\n${targetDafaPayload.map(item => `  ${JSON.stringify(item)}`).join(',\n')}\n]`
        : '[]';

    const lines: string[] = [
      'तपाईं नेपाल कानुन आयोग, मुद्रण विभाग (नेपाल राजपत्र) र सर्वोच्च अदालतका आधिकारिक कानुनी दस्तावेजहरूको विशेषज्ञ नेपाली कानुनी विश्लेषक हुनुहुन्छ।',
      'यी सामग्रीहरू सर्वसाधारण र विद्यार्थीहरूलाई शैक्षिक तथा कानुनी जानकारी दिनका लागि मात्र हुबहु र तथ्यगत रूपमा तयार गरिँदैछन्।',
      '',
      '=== लक्षित दस्तावेज विवरण (TARGET DOCUMENT) ===',
      `फोल्डर (Folder): ${pdfFolderName} (ID: ${pdfFolderId})`,
      `PDF फाइल नाम: ${pdfName}`,
      `PDF Repository Path: ${pdfPath}`,
      `PDF Doc ID: ${importDocPdfId}`,
      `आउटपुट फाइल नाम (Downloadable JSON File): ${suggestedImportJsonFilename}`,
      '',
      '=== अनिवार्य नियमहरू (STRICT RULES — पुरै र डाउनलोडयोग्य .json फाइल) ===',
      '१. १००% शुद्ध नेपाली देवनागरी युनिकोडमा मात्र लेख्नुहोस्। कुनै पनि अङ्ग्रेजी वाक्य, "Note:", "Wait", टिप्पणी वा ब्रोकन Preeti/CMap अक्षर (जस्तै िमतपूमतय, मममत, ठदनु) नलेख्नुहोस्।',
      '२. माथि दिइएको फोल्डर, PDF नाम, pdfPath र प्रत्येक docId हुबहु यही नै राख्नुहोस् (परिवर्तन नगर्नुहोस्)।',
      includeDafas
        ? `३. पार्ट-पार्ट वा भाग-भाग नगरी पुरै एकैपटकमा तयार गर्नुहोस्: १ देखि अन्तिम ${totalDafaCountDeva} सम्मको एउटा पनि दफा/अनुसूची नछोडी र बीचमा "बाँकी अर्को भागमा" वा "Continue?" नसोधी ${includePdf ? 'PDF सारांश सहित ' : ''}सबै ${totalDafaCountDeva} वटै रेकर्ड एउटै पूर्ण JSON भित्र समेट्नुहोस्।`
        : '३. भाग-भाग वा संक्षिप्त नगरी सम्पूर्ण PDF कागजातको पूर्ण सारांश एउटै पूर्ण JSON भित्र तयार गर्नुहोस्।',
      `४. डाउनलोड गर्न मिल्ने .json फाइल दिनुहोस्: तयार भएको सम्पूर्ण वैध UTF-8 JSON डाटालाई "${suggestedImportJsonFilename}" नामको सिधै डाउनलोड गर्न मिल्ने .json फाइल (Downloadable .json File / Code Interpreter / Artifact File) बनाएर दिनुहोस्। यदि तपाईंसँग फाइल डाउनलोड बनाउने सुविधा उपलब्ध छैन भने मात्र पूरा वैध JSON एउटै \`\`\`json कोड ब्लकमा (कुनै काटछाँट वा "..." नराखी) दिनुहोस्।`,
      '५. यदि संलग्न PDF पृष्ठमा वाटरमार्क छ भने पनि मूल कानुनी पाठ र संरचना राम्ररी पढेर सही, तटस्थ र तथ्यगत सारांश लेख्नुहोस्।',
    ];

    if (includeDafas) {
      lines.push(
        '',
        `=== लक्षित सम्पूर्ण दफा/अनुसूची सूची (भाग नगरी पुरै — कुल ${totalDafaCountDeva} वटा: क्रम १ देखि ${totalDafaCountDeva} सम्म) ===`,
        `तल दिइएका सबै ${totalDafaCountDeva} वटै दफा/अनुसूचीको लागि "dafaSummaries" एरेमा एक-एक पूर्ण रेकर्ड अनिवार्य रूपमा बनाउनुहोस् (एउटा पनि नछोड्नुहोस्):`,
        compactTargetDafaJson
      );
    }

    lines.push(
      '',
      '=== अपेक्षित JSON फाइल ढाँचा (EXACT OUTPUT JSON SCHEMA) ===',
      includeDafas
        ? `नोट: तलको "dafaSummaries" मा संरचना देखाउन केवल १ नमूना मात्र छ — वास्तविक आउटपुट .json फाइलमा माथि सूचीबद्ध सबै ${totalDafaCountDeva} वटै दफा/अनुसूचीको रेकर्ड राख्नुहोस्।`
        : 'तलको ढाँचा अनुसार पूर्ण वैध JSON तयार गरी डाउनलोड गर्न मिल्ने .json फाइल दिनुहोस्।',
      JSON.stringify(schemaObj, null, 2)
    );

    return lines.join('\n');
  }, [
    selectedImportDoc,
    activeImportFolder,
    importIncludePdfInPrompt,
    importIncludeDafasInPrompt,
    importDocPdfId,
    importTargetDafas,
    suggestedImportJsonFilename,
  ]);

  const handleBatchImportJson = async () => {
    if (!externalJsonInput.trim()) {
      setImportMessage('कृपया बाह्य AI ले दिएको JSON डाटा पेस्ट गर्नुहोस्।');
      return;
    }
    const signed = await ensureSignedIn();
    if (!signed) {
      setImportMessage('कृपया मास्टर स्टोरमा सेभ गर्न Owner/Admin खाताबाट लगइन गर्नुहोस्।');
      return;
    }
    setImportingJson(true);
    setImportMessage('JSON जाँच तथा सेनिटाइज गरी Firestore मा सेभ हुँदैछ...');
    try {
      let cleanedText = externalJsonInput.trim();
      const fenceMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fenceMatch && fenceMatch[1]) {
        cleanedText = fenceMatch[1].trim();
      } else {
        const firstBrace = cleanedText.search(/[\[{]/);
        const lastObj = cleanedText.lastIndexOf('}');
        const lastArr = cleanedText.lastIndexOf(']');
        const lastEnd = Math.max(lastObj, lastArr);
        if (firstBrace >= 0 && lastEnd > firstBrace) {
          cleanedText = cleanedText.slice(firstBrace, lastEnd + 1);
        }
      }

      const parsedRaw = JSON.parse(cleanedText);
      let rawPdfs: any[] = [];
      let rawDafas: any[] = [];

      if (Array.isArray(parsedRaw)) {
        for (const item of parsedRaw) {
          if (item && typeof item === 'object') {
            if ('overview' in item || 'keyPoints' in item) rawPdfs.push(item);
            else if ('summaryNepali' in item) rawDafas.push(item);
          }
        }
      } else if (parsedRaw && typeof parsedRaw === 'object') {
        if (Array.isArray(parsedRaw.pdfSummaries)) rawPdfs = parsedRaw.pdfSummaries;
        else if (Array.isArray(parsedRaw.pdf_summaries)) rawPdfs = parsedRaw.pdf_summaries;
        if (Array.isArray(parsedRaw.dafaSummaries)) rawDafas = parsedRaw.dafaSummaries;
        else if (Array.isArray(parsedRaw.dafa_summaries)) rawDafas = parsedRaw.dafa_summaries;
        if (rawPdfs.length === 0 && rawDafas.length === 0) {
          if ('overview' in parsedRaw || 'keyPoints' in parsedRaw) rawPdfs = [parsedRaw];
          else if ('summaryNepali' in parsedRaw) rawDafas = [parsedRaw];
        }
      }

      let importedPdfs = 0;
      let importedDafas = 0;
      let skippedInvalid = 0;
      let skippedAlreadySaved = 0;

      for (const p of rawPdfs) {
        if (!p || typeof p !== 'object') continue;
        const targetPath = p.pdfPath || selectedImportDoc?.path || '';
        const matchedDoc =
          documents.find(d => d.path === targetPath) ||
          (p.pdfName ? documents.find(d => d.filename === p.pdfName) : undefined) ||
          selectedImportDoc;
        if (!matchedDoc && !targetPath) {
          skippedInvalid++;
          continue;
        }
        const resolvedPath = matchedDoc?.path || targetPath;
        const resolvedMode = ['executive', 'sections', 'compliance', 'page_range'].includes(p.mode)
          ? p.mode
          : 'executive';
        const resolvedLang = ['ne', 'en', 'bilingual'].includes(p.language) ? p.language : 'ne';
        const resolvedDocId =
          p.docId && /^[a-zA-Z0-9_-]+$/.test(p.docId)
            ? p.docId
            : buildPdfSummaryDocId(resolvedPath, resolvedMode, resolvedLang);

        if (importSkipCachedDafas && hasCleanPdfSummary(resolvedPath, resolvedDocId)) {
          skippedAlreadySaved++;
          continue;
        }

        const rawSummary = {
          documentTitle: p.documentTitle || matchedDoc?.filename?.replace(/\.pdf$/i, '') || 'कानुनी दस्तावेज',
          overview: p.overview || '',
          keyPoints: Array.isArray(p.keyPoints) ? p.keyPoints : [],
          importantSections: Array.isArray(p.importantSections) ? p.importantSections : [],
          complianceAndDeadlines: Array.isArray(p.complianceAndDeadlines) ? p.complianceAndDeadlines : [],
          schedulesOverview: Array.isArray(p.schedulesOverview) ? p.schedulesOverview : [],
          totalPages: Math.max(1, Math.trunc(Number(p.totalPages) || 1)),
          analyzedRange: p.analyzedRange || 'पूरा कागजात',
          inputMethod: (['pdf-multimodal', 'files-api', 'text-extracted'].includes(p.inputMethod)
            ? p.inputMethod
            : 'text-extracted') as 'pdf-multimodal' | 'files-api' | 'text-extracted',
          modelUsed: p.modelUsed || 'external-ai',
        };
        const sanitizedPdf = sanitizePdfSummaryResult(rawSummary, resolvedLang);
        if (isDirtyOrIncompletePdfRecord({ ...sanitizedPdf, language: resolvedLang })) {
          skippedInvalid++;
          continue;
        }

        const docInfo: DocumentSummary = matchedDoc || {
          path: resolvedPath,
          folderId: String(
            p.folderId || (activeImportFolder ? `${activeImportFolder.split('.')[0]}.` : '१.')
          ),
          folderName: String(p.folderName || activeImportFolder || 'कानुनी दस्तावेज'),
          subfolderId: '',
          subfolderName: '',
          filename: String(p.pdfName || resolvedPath.split('/').pop() || 'document.pdf'),
          size: Math.max(0, Math.trunc(Number(p.fileSizeBytes) || 100000)),
          category: 'PDF',
          totalSections: 0,
          totalSchedules: 0,
          totalRows: 0,
        };

        const saved = await savePdfSummaryToFirestore({
          docId: resolvedDocId,
          docInfo,
          pdfPath: resolvedPath,
          mode: resolvedMode,
          language: resolvedLang,
          summary: sanitizedPdf,
        });
        cleanPdfPathsRef.current.add(resolvedPath);
        onPdfSaved(saved);
        importedPdfs++;
      }

      const dafaItemsToSave: DafaSummaryItem[] = [];
      for (const d of rawDafas) {
        if (!d || typeof d !== 'object') continue;
        const matchedRow =
          (d.docId ? rowByDocId.get(d.docId) : undefined) ||
          importDocAllRows.find(
            r =>
              (d.sectionId && r.section_id === d.sectionId) ||
              (d.anusuchiId && r.anusuchi_id === d.anusuchiId)
          );

        const docId = d.docId || (matchedRow ? buildDafaSummaryDocId(matchedRow) : '');
        const pdfPath = matchedRow?.pdf_path || d.pdfPath || selectedImportDoc?.path || '';
        if (!docId || !/^[a-zA-Z0-9_-]+$/.test(docId) || !pdfPath) {
          skippedInvalid++;
          continue;
        }

        if (importSkipCachedDafas && hasCleanDafaSummary(docId)) {
          skippedAlreadySaved++;
          continue;
        }

        const sanitizedDafa = sanitizeDafaSummaryItem<DafaSummaryItem>({
          docId: String(docId),
          pdfPath: String(pdfPath),
          pdfName: String(matchedRow?.pdf_name || d.pdfName || selectedImportDoc?.filename || ''),
          folderId: String(matchedRow?.folder_id || d.folderId || selectedImportDoc?.folderId || ''),
          sectionId: String(matchedRow?.section_id || d.sectionId || ''),
          titleName: String(matchedRow?.title_name || d.titleName || ''),
          titlePage: String(
            matchedRow?.title_page || matchedRow?.anusuchi_print_page || d.titlePage || ''
          ),
          recordType: String(matchedRow?.type || d.recordType || 'दफा'),
          anusuchiId: String(matchedRow?.anusuchi_id || d.anusuchiId || ''),
          anusuchiTitle: String(matchedRow?.anusuchi_title || d.anusuchiTitle || ''),
          summaryNepali: String(d.summaryNepali || ''),
          keyObligations: Array.isArray(d.keyObligations)
            ? d.keyObligations.map((x: any) => String(x || ''))
            : [],
          modelUsed: String(d.modelUsed || 'external-ai'),
        });

        if (isDirtyOrIncompleteDafaRecord(sanitizedDafa)) {
          skippedInvalid++;
          continue;
        }
        dafaItemsToSave.push(sanitizedDafa);
      }

      if (dafaItemsToSave.length > 0) {
        const savedDafas = await saveDafaSummariesBatchToFirestore(
          dafaItemsToSave,
          rawFirestoreDafaMap
        );
        savedDafas.forEach(item => cleanDafaIdsRef.current.add(item.docId));
        onDafasSaved(savedDafas);
        importedDafas = savedDafas.length;
      }

      if (importedPdfs === 0 && importedDafas === 0) {
        if (skippedAlreadySaved > 0 && skippedInvalid === 0) {
          setImportMessage(
            `पहिले नै तयार भइसकेका ${toDevaNum(
              skippedAlreadySaved
            )} सारांश छोडियो — 'पहिले नै तयार/सेभ भएका सारांश छोड्नुहोस्' सक्रिय भएकाले केही ओभरराइट गरिएन ✅`
          );
          setExternalJsonInput('');
        } else {
          setImportMessage(
            `कुनै पनि नयाँ मान्य सारांश सेभ भएन (${toDevaNum(
              skippedAlreadySaved
            )} पहिले नै तयार भएकाले छोडियो, ${toDevaNum(
              skippedInvalid
            )} अपूर्ण/अशुद्ध भेटिए)। कृपया शुद्ध नेपाली युनिकोड र पूरा JSON पक्का गर्नुहोस्।`
          );
        }
      } else {
        setImportMessage(
          `सफलतापूर्वक Firestore मा सेभ भयो! ✅ PDF: ${toDevaNum(importedPdfs)}, दफा: ${toDevaNum(
            importedDafas
          )}${
            skippedAlreadySaved > 0
              ? ` • ${toDevaNum(skippedAlreadySaved)} पहिले नै तयार भएकाले छोडियो`
              : ''
          }${skippedInvalid > 0 ? ` • ${toDevaNum(skippedInvalid)} अमान्य रेकर्ड छाडियो` : ''}`
        );
        setExternalJsonInput('');
      }
    } catch (err: any) {
      setImportMessage(`इम्पोर्ट असफल: ${err?.message || 'अमान्य JSON format'}`);
    } finally {
      setImportingJson(false);
    }
  };

  const pendingFirestoreSync = useMemo(() => {
    const repairedPdfs = (verifiedRepairsData?.pdfSummaries || []) as StoredPdfSummaryRecord[];
    const repairedDafas = (verifiedRepairsData?.dafaSummaries || []) as StoredDafaSummaryRecord[];
    return computePendingFirestoreSyncRecords(
      rawFirestorePdfSummaries ?? cachedPdfSummaries,
      rawFirestoreDafaSummaries ?? cachedDafaSummaries,
      repairedPdfs,
      repairedDafas
    );
  }, [rawFirestorePdfSummaries, rawFirestoreDafaSummaries, cachedPdfSummaries, cachedDafaSummaries]);

  const uniqueCachedPdfDocsCount = useMemo(() => {
    const paths = new Set(cachedPdfSummaries.map(s => s.pdfPath));
    return paths.size;
  }, [cachedPdfSummaries]);

  const sortedCachedDafas = useMemo(() => {
    return [...cachedDafaSummaries].sort((a, b) => {
      const ma = dafaMetaByDocId.get(a.docId);
      const mb = dafaMetaByDocId.get(b.docId);
      if (ma && mb) return ma.orderIndex - mb.orderIndex;
      if (ma) return -1;
      if (mb) return 1;
      const pdfCmp = compareNumericPrefixes(a.pdfName, b.pdfName);
      if (pdfCmp !== 0) return pdfCmp;
      return compareNumericPrefixes(a.sectionId || a.anusuchiId, b.sectionId || b.anusuchiId);
    });
  }, [cachedDafaSummaries, dafaMetaByDocId]);

  const filteredBrowsePdfs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const sorted = [...cachedPdfSummaries].sort((a, b) =>
      compareNumericPrefixes(a.pdfName, b.pdfName)
    );
    if (!q) return sorted;
    return sorted.filter(
      p =>
        p.documentTitle.toLowerCase().includes(q) ||
        p.pdfName.toLowerCase().includes(q) ||
        p.overview.toLowerCase().includes(q)
    );
  }, [cachedPdfSummaries, searchTerm]);

  const filteredBrowseDafas = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const scoped =
      browsePdfFilter === 'all'
        ? sortedCachedDafas
        : sortedCachedDafas.filter(d => d.pdfPath === browsePdfFilter);
    if (!q) return scoped.slice(0, 200);
    return scoped
      .filter(
        d =>
          d.sectionId.toLowerCase().includes(q) ||
          d.titleName.toLowerCase().includes(q) ||
          d.anusuchiTitle.toLowerCase().includes(q) ||
          d.summaryNepali.toLowerCase().includes(q) ||
          d.pdfName.toLowerCase().includes(q)
      )
      .slice(0, 200);
  }, [sortedCachedDafas, searchTerm, browsePdfFilter]);

  if (!isOpen) return null;

  const ensureSignedIn = async (): Promise<boolean> => {
    if (isAuthorizedMasterUser(currentUser)) return true;
    const u = currentUser ? currentUser : await onSignIn();
    return isAuthorizedMasterUser(u);
  };

  const handleStopBatch = () => {
    stopFlagRef.current = true;
    setStatusText('प्रक्रिया रोकिँदैछ (हालसम्म बनेका सारांशहरू Firestore मा सेभ भइसकेका छन्)...');
  };

  const waitWithStop = async (seconds: number, reasonLabel: string): Promise<boolean> => {
    for (let s = seconds; s > 0; s--) {
      if (stopFlagRef.current) return false;
      setStatusText(`${reasonLabel} (${toDevaNum(s)} सेकेन्ड पर्खँदै...)`);
      await new Promise(r => setTimeout(r, 1000));
    }
    return !stopFlagRef.current;
  };

  const runBatchPdfInternal = async (
    manageRunningState: boolean
  ): Promise<{ stopped: boolean; hardStopped: boolean; savedCount: number; failedCount: number }> => {
    const queue = targetDocs.filter(docItem => {
      if (!skipCachedRef.current) return true;
      return !hasCleanPdfSummary(docItem.path);
    });

    if (queue.length === 0) {
      setStatusText('छानिएका सबै PDF कागजातहरूको सफा र पूर्ण सारांश पहिले नै सुरक्षित छन्!');
      appendBatchLog('छानिएका सबै PDF सारांश पहिले नै तयार छन् (छोडियो)।', 'success');
      return { stopped: false, hardStopped: false, savedCount: 0, failedCount: 0 };
    }

    if (manageRunningState) {
      stopFlagRef.current = false;
      setRunning(true);
      setRunningKind('pdf');
      setBatchLogs([]);
    }
    setProgressCurrent(0);
    setProgressTotal(queue.length);
    appendBatchLog(`PDF सारांश Batch सुरु (${toDevaNum(queue.length)} बाँकी PDFs)`, 'info');

    let savedCount = 0;
    let failedCount = 0;
    let hardStopped = false;
    const interDelayMs = (poolKeysCount ?? 1) >= 3 ? 150 : 350;

    for (let i = 0; i < queue.length; i++) {
      if (stopFlagRef.current) break;
      const docInfo = queue[i];
      if (skipCachedRef.current && cleanPdfPathsRef.current.has(docInfo.path)) {
        appendBatchLog(`PDF ${i + 1}/${queue.length}: ${docInfo.filename} — पहिले नै तयार छ (छोडियो)`, 'info');
        setProgressCurrent(i + 1);
        continue;
      }
      let done = false;
      let rateLimitRetries = 0;

      while (!done && !stopFlagRef.current) {
        setStatusText(`PDF सारांश तयार हुँदैछ (${toDevaNum(i + 1)}/${toDevaNum(queue.length)}): ${docInfo.filename}`);
        try {
          const { ok: httpOk, status, data } = await safeFetchJson('/api/gemini/summarize-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pdfPath: docInfo.path,
              mode: 'executive',
              language: 'ne',
            }),
          });

          if (!httpOk || !data.success || !data.summary) {
            const effectiveStatus = data?.upstreamStatus ?? status;
            if ((effectiveStatus === 429 || effectiveStatus === 503 || effectiveStatus === 504) && rateLimitRetries < 3) {
              rateLimitRetries++;
              const reason =
                effectiveStatus === 429
                  ? 'सबै Gemini Key अस्थायी कोटा सीमामा पुगे'
                  : effectiveStatus === 504
                  ? 'Gemini अनुरोध समय सीमा (504 Timeout) नाघ्यो'
                  : 'Gemini सर्भरमा अस्थायी चाप (503 High Demand) छ';
              const resumed = await waitWithStop(
                14,
                `${reason} — स्वतः पुनः प्रयास (${toDevaNum(rateLimitRetries)}/३)`
              );
              if (!resumed) break;
              continue;
            }
            failedCount++;
            setBatchError(`${docInfo.filename}: ${data.error || 'असफल भयो'}`);
            appendBatchLog(`PDF ${i + 1}/${queue.length}: ${docInfo.filename} — असफल (${data.error || 'त्रुटि'})`, 'error');
            if (effectiveStatus === 403) {
              hardStopped = true;
            }
            done = true;
          } else {
            const docId = buildPdfSummaryDocId(docInfo.path, 'executive', 'ne');
            const saved = await savePdfSummaryToFirestore({
              docId,
              docInfo,
              pdfPath: docInfo.path,
              mode: 'executive',
              language: 'ne',
              summary: data.summary,
            });
            cleanPdfPathsRef.current.add(docInfo.path);
            onPdfSaved(saved);
            savedCount++;
            appendBatchLog(`PDF ${i + 1}/${queue.length}: ${docInfo.filename} — सेभ भयो ✅`, 'success');
            done = true;
          }
        } catch (err: any) {
          const msg = String(err?.message || '');
          const isTransientProxy =
            msg.includes('HTML') ||
            msg.includes('Timeout') ||
            msg.includes('खाली जवाफ') ||
            msg.toLowerCase().includes('fetch');
          if (isTransientProxy && rateLimitRetries < 2) {
            rateLimitRetries++;
            const resumed = await waitWithStop(
              8,
              `अस्थायी सर्भर/प्रोक्सी अवरोध — स्वतः पुनः प्रयास (${toDevaNum(rateLimitRetries)}/२)`
            );
            if (!resumed) break;
            continue;
          }
          failedCount++;
          setBatchError(msg || 'नेटवर्क त्रुटि');
          appendBatchLog(`PDF ${i + 1}/${queue.length}: ${docInfo.filename} — ${msg || 'अवरोध'}`, 'error');
          done = true;
        }
      }

      setProgressCurrent(i + 1);
      if (hardStopped || stopFlagRef.current) break;
      await new Promise(r => setTimeout(r, interDelayMs));
    }

    if (manageRunningState) {
      setRunning(false);
      setRunningKind(null);
      if (!stopFlagRef.current) {
        if (savedCount > 0 && failedCount === 0) {
          setStatusText(`सफलतापूर्वक ${toDevaNum(savedCount)} PDF सारांश Firestore मा सेभ भयो।`);
        } else if (savedCount > 0) {
          setStatusText(`${toDevaNum(savedCount)} PDF सेभ भयो, ${toDevaNum(failedCount)} असफल भयो।`);
        } else {
          setStatusText('PDF सारांश प्रक्रिया असफल भयो — तलको त्रुटि विवरण हेर्नुहोस्।');
        }
      }
    }

    return {
      stopped: stopFlagRef.current,
      hardStopped,
      savedCount,
      failedCount,
    };
  };

  const runBatchDafaInternal = async (
    manageRunningState: boolean
  ): Promise<{ stopped: boolean; hardStopped: boolean; savedCount: number; failedCount: number }> => {
    const byPdf = new Map<string, { docId: string; row: LegalRow; indexInPdf: number; totalInPdf: number }[]>();
    const totalPerPdf = new Map<string, number>();
    let totalToProcess = 0;

    // Ensure strict ascending order starting from Dafa 1 inside every PDF
    const rowsByPdfSorted = new Map<string, LegalRow[]>();
    targetRows.forEach(row => {
      if (!rowsByPdfSorted.has(row.pdf_path)) rowsByPdfSorted.set(row.pdf_path, []);
      rowsByPdfSorted.get(row.pdf_path)!.push(row);
    });

    for (const [pdfPath, list] of rowsByPdfSorted.entries()) {
      const sortedList = [...list].sort(
        (a, b) => (a.order_index ?? Number.MAX_SAFE_INTEGER) - (b.order_index ?? Number.MAX_SAFE_INTEGER)
      );
      const totalInPdf = sortedList.length;
      totalPerPdf.set(pdfPath, totalInPdf);

      sortedList.forEach((row, idx) => {
        const docId = buildDafaSummaryDocId(row);
        if (skipCachedRef.current && (hasCleanDafaSummary(docId) || cleanDafaIdsRef.current.has(docId))) return;
        if (!byPdf.has(pdfPath)) byPdf.set(pdfPath, []);
        byPdf.get(pdfPath)!.push({
          docId,
          row,
          indexInPdf: idx + 1,
          totalInPdf,
        });
        totalToProcess++;
      });
    }

    if (totalToProcess === 0) {
      setStatusText('छानिएका सबै दफा/धारा र अनुसूचीहरूको सफा सारांश पहिले नै उपलब्ध छन्!');
      appendBatchLog('छानिएका सबै दफा/धारा पहिले नै अपडेट छन्।', 'success');
      return { stopped: false, hardStopped: false, savedCount: 0, failedCount: 0 };
    }

    if (manageRunningState) {
      stopFlagRef.current = false;
      setRunning(true);
      setRunningKind('dafa');
      setBatchLogs([]);
    }
    setProgressCurrent(0);
    setProgressTotal(totalToProcess);

    let savedDafasCount = 0;
    let failedBatches = 0;
    let hardStopped = false;
    const BATCH_SIZE = 5;
    const interDelayMs = (poolKeysCount ?? 1) >= 3 ? 150 : 400;

    type DafaQueueEntry = { docId: string; row: LegalRow; indexInPdf: number; totalInPdf: number };

    const processDafaChunk = async (
      pdfPath: string,
      pdfFile: string,
      pdfTotal: number,
      rawChunk: DafaQueueEntry[],
      useFastFallback: boolean,
      splitDepth: number
    ): Promise<void> => {
      const chunk = skipCachedRef.current
        ? rawChunk.filter(entry => !cleanDafaIdsRef.current.has(entry.docId))
        : rawChunk;
      if (stopFlagRef.current || hardStopped || chunk.length === 0) return;

      const startPos = chunk[0].indexInPdf;
      const endPos = chunk[chunk.length - 1].indexInPdf;
      const rangeLabel = startPos === endPos ? `दफा ${startPos}/${pdfTotal}` : `दफा ${startPos}–${endPos}/${pdfTotal}`;
      let rateLimitRetries = 0;

      while (!stopFlagRef.current && !hardStopped) {
        setStatusText(
          `${rangeLabel} (सेभ ${toDevaNum(savedDafasCount)} / ${toDevaNum(totalToProcess)}${
            useFastFallback ? ' • फास्ट मोड' : ''
          }): ${pdfFile}`
        );

        try {
          const { ok: httpOk, status, data } = await safeFetchJson('/api/gemini/summarize-dafas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pdfPath,
              items: chunk.map(e => ({ docId: e.docId, row: e.row })),
              useFastFallback,
            }),
          });

          if (!httpOk || !data.success || !Array.isArray(data.results)) {
            const effectiveStatus = data?.upstreamStatus ?? status;

            if (effectiveStatus === 429 && rateLimitRetries < 3) {
              rateLimitRetries++;
              appendBatchLog(
                `${rangeLabel}: सबै Gemini Key अस्थायी कोटा सीमामा पुगे — पुनः प्रयास (${rateLimitRetries}/3)`,
                'warn'
              );
              const resumed = await waitWithStop(
                14,
                `कोटा सीमा (429) — स्वतः पुनः प्रयास (${toDevaNum(rateLimitRetries)}/३)`
              );
              if (!resumed) return;
              continue;
            }

            if (effectiveStatus === 503 || effectiveStatus === 504 || effectiveStatus === 500) {
              const reason =
                effectiveStatus === 504
                  ? 'Gemini अनुरोध समय सीमा (504 Timeout) नाघ्यो'
                  : 'Gemini सर्भरमा अस्थायी चाप (503/500) छ';

              if (chunk.length > 1) {
                const mid = Math.ceil(chunk.length / 2);
                appendBatchLog(
                  `${rangeLabel}: ${reason} — सानो समूह (${mid} + ${chunk.length - mid}) मा बाँडेर पुनः प्रयास हुँदैछ`,
                  'warn'
                );
                await processDafaChunk(pdfPath, pdfFile, pdfTotal, chunk.slice(0, mid), true, splitDepth + 1);
                if (!stopFlagRef.current && !hardStopped) {
                  await processDafaChunk(pdfPath, pdfFile, pdfTotal, chunk.slice(mid), true, splitDepth + 1);
                }
                return;
              }

              if (!useFastFallback) {
                appendBatchLog(
                  `${rangeLabel}: ${reason} — छिटो मोड (gemini-3.1-flash-lite) बाट पुनः प्रयास हुँदैछ`,
                  'warn'
                );
                const resumed = await waitWithStop(2, 'छिटो मोडमा पुनः प्रयास');
                if (!resumed) return;
                await processDafaChunk(pdfPath, pdfFile, pdfTotal, chunk, true, splitDepth);
                return;
              }

              if (rateLimitRetries < 2) {
                rateLimitRetries++;
                appendBatchLog(`${rangeLabel}: ${reason} — पुनः प्रयास (${rateLimitRetries}/2)`, 'warn');
                const resumed = await waitWithStop(8, `${reason} — पुनः प्रयास`);
                if (!resumed) return;
                continue;
              }
            }

            failedBatches++;
            setBatchError(`${pdfFile}: ${data.error || 'दफा सारांश असफल'}`);
            appendBatchLog(`${rangeLabel} छोडियो (${data.error || 'त्रुटि'}) — अर्को ब्याचमा अघि बढ्दै`, 'error');
            if (effectiveStatus === 403) {
              hardStopped = true;
            }
            return;
          }

          const items: DafaSummaryItem[] = data.results;
          const gotIds = new Set(items.map(it => it.docId));
          const saved = await saveDafaSummariesBatchToFirestore(items, rawFirestoreDafaMap);
          saved.forEach(s => cleanDafaIdsRef.current.add(s.docId));
          onDafasSaved(saved);
          savedDafasCount += saved.length;
          setProgressCurrent(savedDafasCount);

          chunk.forEach(entry => {
            if (gotIds.has(entry.docId)) {
              const label = entry.row.section_id || entry.row.anusuchi_id || '';
              const title = entry.row.title_name || entry.row.anusuchi_title || '';
              appendBatchLog(
                `dafa ${entry.indexInPdf}/${entry.totalInPdf} • ${label} ${title}`.trim(),
                'success'
              );
            }
          });

          const missingEntries = chunk.filter(entry => !gotIds.has(entry.docId));
          if (missingEntries.length > 0 && !stopFlagRef.current && !hardStopped) {
            appendBatchLog(
              `${rangeLabel}: ${missingEntries.length} दफा छुट्यो — छिटो मोडबाट पुनः प्रयास`,
              'warn'
            );
            await processDafaChunk(pdfPath, pdfFile, pdfTotal, missingEntries, true, splitDepth + 1);
          }
          return;
        } catch (err: any) {
          const msg = String(err?.message || '');
          const isTransientProxy =
            msg.includes('HTML') ||
            msg.includes('Timeout') ||
            msg.includes('खाली जवाफ') ||
            msg.toLowerCase().includes('fetch');

          if (isTransientProxy && chunk.length > 1) {
            const mid = Math.ceil(chunk.length / 2);
            appendBatchLog(
              `${rangeLabel}: प्रोक्सी समय सीमा — सानो समूह (${mid} + ${chunk.length - mid}) मा पुनः प्रयास`,
              'warn'
            );
            await processDafaChunk(pdfPath, pdfFile, pdfTotal, chunk.slice(0, mid), true, splitDepth + 1);
            if (!stopFlagRef.current && !hardStopped) {
              await processDafaChunk(pdfPath, pdfFile, pdfTotal, chunk.slice(mid), true, splitDepth + 1);
            }
            return;
          }

          if (isTransientProxy && !useFastFallback) {
            appendBatchLog(
              `${rangeLabel}: अस्थायी प्रोक्सी अवरोध — छिटो मोडबाट पुनः प्रयास हुँदैछ`,
              'warn'
            );
            const resumed = await waitWithStop(3, 'छिटो मोडमा पुनः प्रयास');
            if (!resumed) return;
            await processDafaChunk(pdfPath, pdfFile, pdfTotal, chunk, true, splitDepth);
            return;
          }

          if (isTransientProxy && rateLimitRetries < 2) {
            rateLimitRetries++;
            appendBatchLog(`${rangeLabel}: प्रोक्सी पुनः प्रयास (${rateLimitRetries}/2)`, 'warn');
            const resumed = await waitWithStop(6, 'अस्थायी प्रोक्सी अवरोध — पुनः प्रयास');
            if (!resumed) return;
            continue;
          }

          failedBatches++;
          setBatchError(msg || 'नेटवर्क त्रुटि');
          appendBatchLog(`${rangeLabel} अवरुद्ध (${msg || 'त्रुटि'}) — अर्को ब्याचमा अघि बढ्दै`, 'error');
          return;
        }
      }
    };

    outerLoop: for (const [pdfPath, entries] of byPdf.entries()) {
      const pdfFile = pdfPath.split('/').pop() || pdfPath;
      const pdfTotal = totalPerPdf.get(pdfPath) || entries.length;
      const firstPos = entries[0]?.indexInPdf ?? 1;
      appendBatchLog(
        `दफा ${firstPos}/${pdfTotal} बाट सुरु हुँदैछ (${pdfFile})`,
        'info'
      );

      for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        if (stopFlagRef.current || hardStopped) break outerLoop;
        const slice = entries.slice(i, i + BATCH_SIZE);
        await processDafaChunk(pdfPath, pdfFile, pdfTotal, slice, false, 0);
        await refreshPoolStatus();
        await new Promise(r => setTimeout(r, interDelayMs));
      }
    }

    if (manageRunningState) {
      setRunning(false);
      setRunningKind(null);
      if (!stopFlagRef.current) {
        if (savedDafasCount > 0 && failedBatches === 0) {
          setStatusText(`सफलतापूर्वक ${toDevaNum(savedDafasCount)} दफाहरूको सारांश Firestore मास्टर स्टोरमा सेभ गरियो!`);
        } else if (savedDafasCount > 0) {
          setStatusText(`${toDevaNum(savedDafasCount)} दफा सेभ भयो, तर केही ब्याच असफल भए।`);
        } else {
          setStatusText('दफा सारांश प्रक्रिया असफल भयो — तलको त्रुटि विवरण हेर्नुहोस्।');
        }
      }
    }

    return {
      stopped: stopFlagRef.current,
      hardStopped,
      savedCount: savedDafasCount,
      failedCount: failedBatches,
    };
  };

  const handleRunBatchPdfSummaries = async () => {
    setBatchError('');
    if (skipCached && pendingBatchDocs.length === 0) {
      setStatusText(
        'छानिएका सबै PDF कागजातहरूको सफा सारांश पहिले नै सुरक्षित छन् — "पहिले नै तयार भएका छोड्नुहोस्" सक्रिय भएकाले पुनः बनाइएन ✅'
      );
      return;
    }
    await refreshPoolStatus();
    const ok = await ensureSignedIn();
    if (!ok) {
      setBatchError(
        `Firestore मास्टर स्टोरमा सेभ गर्ने अनुमति Owner (${OWNER_EMAIL}) वा Admin (${ADMIN_EMAIL}) लाई मात्र छ।`
      );
      return;
    }
    await runBatchPdfInternal(true);
  };

  const handleRunBatchDafaSummaries = async () => {
    setBatchError('');
    if (skipCached && pendingBatchRows.length === 0) {
      setStatusText(
        'छानिएका सबै दफा/धारा र अनुसूचीहरूको सफा सारांश पहिले नै सुरक्षित छन् — "पहिले नै तयार भएका छोड्नुहोस्" सक्रिय भएकाले पुनः बनाइएन ✅'
      );
      return;
    }
    await refreshPoolStatus();
    const ok = await ensureSignedIn();
    if (!ok) {
      setBatchError(
        `Firestore मास्टर स्टोरमा सेभ गर्ने अनुमति Owner (${OWNER_EMAIL}) वा Admin (${ADMIN_EMAIL}) लाई मात्र छ।`
      );
      return;
    }
    await runBatchDafaInternal(true);
  };

  const handleSyncVerifiedRepairsToFirestore = async () => {
    setBatchError('');
    const ok = await ensureSignedIn();
    if (!ok) {
      setBatchError(
        `Firestore मास्टर स्टोर अपडेट गर्ने अनुमति Owner (${OWNER_EMAIL}) वा Admin (${ADMIN_EMAIL}) लाई मात्र छ।`
      );
      return;
    }

    const { pdfsToSync, dafasToSync } = pendingFirestoreSync;
    const total = pdfsToSync.length + dafasToSync.length;
    if (total === 0) {
      setStatusText('Firestore मास्टर स्टोरमा सबै सारांश पहिले नै पूर्ण र सफा छन्!');
      return;
    }

    stopFlagRef.current = false;
    setRunning(true);
    setRunningKind('all');
    setBatchLogs([]);
    setProgressCurrent(0);
    setProgressTotal(total);
    appendBatchLog(
      `प्रमाणित सफा सारांशहरू Firestore मा सिंक सुरु (${toDevaNum(pdfsToSync.length)} PDF र ${toDevaNum(dafasToSync.length)} दफा)`,
      'info'
    );

    let synced = 0;
    try {
      for (const pdfRec of pdfsToSync) {
        if (stopFlagRef.current) break;
        setStatusText(`PDF सारांश अपडेट हुँदैछ: ${pdfRec.pdfName}`);
        const docInfo = uniqueDocs.find(d => d.path === pdfRec.pdfPath);
        const saved = await savePdfSummaryToFirestore({
          docId: pdfRec.docId,
          docInfo,
          pdfPath: pdfRec.pdfPath,
          mode: pdfRec.mode,
          language: pdfRec.language,
          summary: pdfRec,
        });
        onPdfSaved(saved);
        synced++;
        setProgressCurrent(synced);
        appendBatchLog(`PDF अपडेट ✅ ${pdfRec.pdfName} (${pdfRec.analyzedRange})`, 'success');
      }

      if (!stopFlagRef.current && dafasToSync.length > 0) {
        const CHUNK = 100;
        for (let i = 0; i < dafasToSync.length; i += CHUNK) {
          if (stopFlagRef.current) break;
          const slice = dafasToSync.slice(i, i + CHUNK);
          setStatusText(
            `दफा सारांश Firestore मा अपडेट हुँदैछ (${toDevaNum(i + slice.length)}/${toDevaNum(dafasToSync.length)})`
          );
          const saved = await saveDafaSummariesBatchToFirestore(slice, rawFirestoreDafaMap);
          onDafasSaved(saved);
          synced += saved.length;
          setProgressCurrent(synced);
          appendBatchLog(`दफा ब्याज अपडेट ✅ ${toDevaNum(saved.length)} दफाहरू सेभ भयो`, 'success');
        }
      }

      await onRefreshStore();
      setStatusText(
        `सफलतापूर्वक ${toDevaNum(synced)} सफा र प्रमाणित सारांशहरू Firestore मास्टर स्टोरमा अपडेट गरियो!`
      );
    } catch (err: any) {
      const msg = err?.message || 'Firestore सिंक त्रुटि';
      setBatchError(msg);
      appendBatchLog(`Firestore सिंक त्रुटि: ${msg}`, 'error');
    } finally {
      setRunning(false);
      setRunningKind(null);
    }
  };

  const handleRunAllSummaries = async () => {
    setBatchError('');
    if (skipCached && pendingBatchDocs.length === 0 && pendingBatchRows.length === 0) {
      setStatusText(
        'छानिएका सबै PDF र दफा सारांशहरू पहिले नै Firestore मास्टर स्टोरमा सुरक्षित छन् — "पहिले नै तयार भएका छोड्नुहोस्" सक्रिय भएकाले पुनः बनाइएन ✅'
      );
      return;
    }
    await refreshPoolStatus();
    const ok = await ensureSignedIn();
    if (!ok) {
      setBatchError(
        `Firestore मास्टर स्टोरमा सेभ गर्ने अनुमति Owner (${OWNER_EMAIL}) वा Admin (${ADMIN_EMAIL}) लाई मात्र छ।`
      );
      return;
    }

    stopFlagRef.current = false;
    setRunning(true);
    setRunningKind('all');
    setBatchLogs([]);

    const pdfRes = await runBatchPdfInternal(false);
    let dafaRes = { stopped: false, hardStopped: false, savedCount: 0, failedCount: 0 };

    if (!pdfRes.stopped && !pdfRes.hardStopped) {
      dafaRes = await runBatchDafaInternal(false);
    }

    setRunning(false);
    setRunningKind(null);

    if (!stopFlagRef.current) {
      const totalSaved = pdfRes.savedCount + dafaRes.savedCount;
      if (pdfRes.hardStopped || dafaRes.hardStopped) {
        setStatusText(
          `प्रक्रिया आंशिक रूपमा रोकियो (${toDevaNum(pdfRes.savedCount)} PDF र ${toDevaNum(
            dafaRes.savedCount
          )} दफा सेभ भयो)। बाँकी पछि निरन्तर गर्न सकिन्छ।`
        );
      } else if (totalSaved > 0) {
        setStatusText(
          `सबै सारांश पूरा भयो! ${toDevaNum(pdfRes.savedCount)} PDF र ${toDevaNum(
            dafaRes.savedCount
          )} दफा सारांश Firestore मास्टर स्टोरमा सेभ गरियो।`
        );
      } else if (pdfRes.failedCount === 0 && dafaRes.failedCount === 0) {
        setStatusText('छानिएका सबै PDF र दफा सारांशहरू पहिले नै Firestore मास्टर स्टोरमा सुरक्षित छन्!');
      } else {
        setStatusText('सारांश प्रक्रिया असफल भयो — तलको त्रुटि विवरण हेर्नुहोस्।');
      }
    }
  };

  const handleExportMasterBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      source: 'Nepal Legal Portal Firestore Master Store',
      model: 'gemini-4-hydrogen',
      totalPdfSummaries: cachedPdfSummaries.length,
      totalDafaSummaries: sortedCachedDafas.length,
      pdfSummaries: cachedPdfSummaries,
      dafaSummaries: sortedCachedDafas,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nepal_legal_master_summaries_lfs_backup.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const pct = progressTotal > 0 ? Math.round((progressCurrent / progressTotal) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-5"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[93vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white px-5 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">
                Firestore मास्टर सारांश भण्डार
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                सबै PDF र {toDevaNum(allRows.length)} दफाहरूको सारांश जेनेरेट, सेभ, अपडेट र GitHub/LFS ब्याकअप निर्यात गर्नुहोस्
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {currentUser ? (
              <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-1.5 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="max-w-[160px] truncate text-slate-200">{currentUser.email}</span>
                <button
                  type="button"
                  onClick={() => void onSignOut()}
                  className="text-rose-300 hover:text-rose-200 ml-1 cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void onSignIn()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Google Sign-In</span>
              </button>
            )}
            <FontSizeControls variant="dark" />
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Store Stats Bar */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-500">सुरक्षित PDF सारांशहरू</div>
              <div className="text-lg font-extrabold text-slate-900">
                {toDevaNum(uniqueCachedPdfDocsCount)} / {toDevaNum(uniqueDocs.length)} PDFs
              </div>
            </div>
            <FileText className="w-6 h-6 text-indigo-600" />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-500">सुरक्षित दफा सारांशहरू</div>
              <div className="text-lg font-extrabold text-emerald-700">
                {toDevaNum(cachedDafaSummaries.length)} / {toDevaNum(allRows.length)} दफा
              </div>
            </div>
            <Layers className="w-6 h-6 text-emerald-600" />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => void onRefreshStore()}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>स्टोर रिफ्रेस</span>
            </button>
            <button
              type="button"
              onClick={handleExportMasterBackup}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
              title="GitHub वा GitHub LFS मा राख्नका लागि पूरा Master JSON डाउनलोड गर्नुहोस्"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Master JSON</span>
            </button>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="px-5 pt-3 bg-white border-b border-slate-200 flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveSubTab('batch')}
            className={`px-4 py-2 font-bold border-b-2 transition-colors cursor-pointer ${
              activeSubTab === 'batch'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            १. Batch सारांश जेनेरेटर (सबै / नयाँ अपडेट)
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('browse')}
            className={`px-4 py-2 font-bold border-b-2 transition-colors cursor-pointer ${
              activeSubTab === 'browse'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            २. सुरक्षित मास्टर डेटा खोज्नुहोस् ({toDevaNum(cachedPdfSummaries.length + cachedDafaSummaries.length)})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('import')}
            className={`px-4 py-2 font-bold border-b-2 transition-colors cursor-pointer ${
              activeSubTab === 'import'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            ३. बाह्य AI (ChatGPT/Claude) JSON इम्पोर्ट
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {activeSubTab === 'import' ? (
            <div className="space-y-4 bg-white rounded-xl border border-purple-200 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span>बाह्य AI (ChatGPT, Claude, DeepSeek) मास्टर प्रम्प्ट तथा JSON ब्याच इम्पोर्ट</span>
                </div>
                {selectedImportDoc && (
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span
                      className={`px-2 py-0.5 rounded-md font-bold ${
                        importDocHasCleanPdfSummary
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      PDF सारांश: {importDocHasCleanPdfSummary ? 'सेभ छ ✅' : 'बाँकी'}
                    </span>
                    <span className="px-2 py-0.5 rounded-md font-bold bg-indigo-100 text-indigo-800">
                      दफा: {toDevaNum(importDocCleanDafaCount)} / {toDevaNum(importDocAllRows.length)} सेभ
                    </span>
                  </div>
                )}
              </div>

              <p className="text-slate-600 leading-relaxed">
                अब प्रम्प्टले भाग-भाग नगरी छानिएको <strong>पुरै PDF र सबै बाँकी दफाहरू</strong> को एउटै पूर्ण मास्टर प्रम्प्ट तयार गर्छ र बाह्य AI लाई सिधै <strong>डाउनलोड गर्न मिल्ने <code>.json</code> फाइल</strong> दिन निर्देशन गर्छ। तलबाट फोल्डर र PDF छान्नुहोस्, प्रम्प्ट बाह्य AI मा दिनुहोस्, अनि प्राप्त <code>.json</code> फाइल चरण २ मा अपलोड गरी Firestore मा सेभ गर्नुहोस्।
              </p>

              {/* Folder, PDF & Mode Selectors */}
              <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-3.5 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      १. फोल्डर छान्नुहोस्:
                    </label>
                    <select
                      value={activeImportFolder}
                      onChange={e => {
                        const nextFolder = e.target.value;
                        setImportFolder(nextFolder);
                        const folderDocs = uniqueDocs.filter(d => d.folderName === nextFolder);
                        const nextDoc =
                          (importSkipCachedDafas
                            ? folderDocs.find(d => !importDocStatusByPath.get(d.path)?.isFullyDone)
                            : undefined) || folderDocs[0];
                        setImportDocPath(nextDoc?.path || '');
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                    >
                      {uniqueFolders.map(folder => {
                        const folderDocs = uniqueDocs.filter(d => d.folderName === folder);
                        const pendingDocsCount = folderDocs.filter(
                          d => !importDocStatusByPath.get(d.path)?.isFullyDone
                        ).length;
                        return (
                          <option key={folder} value={folder}>
                            {folder}{' '}
                            {pendingDocsCount === 0
                              ? '(✅ सबै तयार)'
                              : `(बाँकी: ${toDevaNum(pendingDocsCount)} PDF)`}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      २. PDF कागजात छान्नुहोस् ({toDevaNum(docsInImportFolder.length)} वटा):
                    </label>
                    <div className="flex gap-1.5">
                      <select
                        value={selectedImportDoc?.path || ''}
                        onChange={e => {
                          setImportDocPath(e.target.value);
                        }}
                        className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                      >
                        {docsInImportFolder.map(docItem => {
                          const st = importDocStatusByPath.get(docItem.path);
                          const statusSuffix = st?.isFullyDone
                            ? '✅ पूरा तयार'
                            : `बाँकी: ${!st?.pdfReady ? 'PDF' : ''}${
                                !st?.pdfReady && (st?.pendingDafas || 0) > 0 ? ' + ' : ''
                              }${
                                (st?.pendingDafas || 0) > 0
                                  ? `${toDevaNum(st?.pendingDafas || 0)} दफा`
                                  : ''
                              }`;
                          return (
                            <option key={docItem.path} value={docItem.path}>
                              {docItem.filename} ({statusSuffix})
                            </option>
                          );
                        })}
                      </select>
                      <button
                        type="button"
                        onClick={handleJumpToNextPendingImportDoc}
                        className="px-2.5 py-2 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-bold whitespace-nowrap cursor-pointer"
                        title={
                          importSkipCachedDafas
                            ? 'यस फोल्डर वा अर्को फोल्डरको अर्को बाँकी PDF छान्नुहोस्'
                            : 'यसै फोल्डरको अर्को PDF छान्नुहोस्'
                        }
                      >
                        {importSkipCachedDafas ? 'अर्को बाँकी PDF →' : 'अर्को PDF →'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-700">लक्ष्य:</span>
                    {(
                      [
                        { id: 'both', label: 'PDF + दफा दुवै' },
                        { id: 'pdf', label: 'PDF सारांश मात्र' },
                        { id: 'dafas', label: 'दफाहरू मात्र' },
                      ] as const
                    ).map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setImportPromptTarget(opt.id)}
                        className={`px-2.5 py-1 rounded-lg font-bold border cursor-pointer ${
                          importPromptTarget === opt.id
                            ? 'bg-purple-700 text-white border-purple-700'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <label className="inline-flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={importSkipCachedDafas}
                      onChange={e => {
                        setImportSkipCachedDafas(e.target.checked);
                      }}
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span>पहिले नै तयार/सेभ भएका सारांश छोड्नुहोस् (कडाइका साथ लागू)</span>
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-purple-200/70">
                  <div className="font-semibold text-slate-700">
                    प्रम्प्ट दायरा (भाग नगरी पुरै):{' '}
                    {!importIncludePdfInPrompt && !importIncludeDafasInPrompt ? (
                      <span className="text-emerald-700 font-bold">
                        सबै लक्षित सारांश पहिले नै तयार र सेभ छन् ✅ — यो PDF छोडिएको छ (पुनः बनाउन टिक हटाउनुहोस्)
                      </span>
                    ) : (
                      <span className="text-purple-800 font-bold">
                        {importIncludePdfInPrompt && importIncludeDafasInPrompt
                          ? `PDF सारांश + सबै ${toDevaNum(
                              importTargetDafas.length
                            )} बाँकी दफा/अनुसूची (१ देखि ${toDevaNum(
                              importTargetDafas.length
                            )} सम्म एकैपटक)`
                          : importIncludePdfInPrompt
                          ? importPromptTarget === 'both'
                            ? 'PDF सारांश मात्र (सबै दफा पहिले नै तयार भएकाले छोडियो ✅)'
                            : 'सम्पूर्ण PDF कार्यकारी सारांश मात्र'
                          : `${
                              importPromptTarget === 'both'
                                ? 'PDF सारांश पहिले नै तयार छ ✅ — '
                                : ''
                            }बाँकी ${toDevaNum(
                              importTargetDafas.length
                            )} दफा/अनुसूची मात्र (१ देखि ${toDevaNum(
                              importTargetDafas.length
                            )} सम्म एकैपटक)`}
                      </span>
                    )}
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-white border border-purple-200 text-purple-800 font-mono text-[11px] font-semibold">
                    अपेक्षित फाइल: {suggestedImportJsonFilename}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-slate-700">
                    चरण १: तयार गरिएको पूर्ण मास्टर प्रम्प्ट प्रतिलिपि वा डाउनलोड गर्नुहोस्
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={!generatedExternalPrompt}
                      onClick={() => {
                        if (!generatedExternalPrompt) return;
                        const blob = new Blob([generatedExternalPrompt], {
                          type: 'text/plain;charset=utf-8',
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = suggestedImportJsonFilename.replace(/\.json$/i, '_prompt.txt');
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        setImportMessage(
                          `मास्टर प्रम्प्ट (.txt) डाउनलोड भयो! (${selectedImportDoc?.filename || 'PDF'})`
                        );
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-800 font-bold cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>प्रम्प्ट (.txt) डाउनलोड</span>
                    </button>
                    <button
                      type="button"
                      disabled={!generatedExternalPrompt}
                      onClick={() => {
                        if (!generatedExternalPrompt) return;
                        navigator.clipboard.writeText(generatedExternalPrompt);
                        setImportMessage(
                          `पुरै मास्टर प्रम्प्ट कपी भयो! (${selectedImportDoc?.filename || 'PDF'})`
                        );
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-100 hover:bg-purple-200 disabled:opacity-40 disabled:cursor-not-allowed text-purple-800 font-bold cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>प्रम्प्ट कपी गर्नुहोस्</span>
                    </button>
                  </div>
                </div>
                {generatedExternalPrompt ? (
                  <div className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] max-h-56 overflow-y-auto whitespace-pre-wrap select-all">
                    {generatedExternalPrompt}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="font-bold text-xs flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>
                          "{selectedImportDoc?.filename}" को लक्षित सारांश पहिले नै तयार र सेभ भइसकेको छ!
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-800">
                        "पहिले नै तयार/सेभ भएका सारांश छोड्नुहोस्" सक्रिय भएकाले दोहोरो प्रम्प्ट बनाइएन। अर्को बाँकी PDF छान्नुहोस् वा पुनः तयार गर्न टिक हटाउनुहोस्।
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleJumpToNextPendingImportDoc}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                    >
                      अर्को बाँकी PDF छान्नुहोस् →
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="block font-bold text-slate-700">
                    चरण २: बाह्य AI ले दिएको JSON डाटा टाँस्नुहोस् वा .json फाइल छान्नुहोस्
                  </label>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>JSON फाइल छान्नुहोस् (.json)</span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = ev => {
                          const content = typeof ev.target?.result === 'string' ? ev.target.result : '';
                          if (content.trim()) {
                            setExternalJsonInput(content);
                            setImportMessage(
                              `फाइल लोड भयो (${file.name}) — अब तलको "Firestore मा ब्याच सेभ गर्नुहोस्" बटन थिच्नुहोस्।`
                            );
                          } else {
                            setImportMessage('छानिएको JSON फाइल खाली छ।');
                          }
                        };
                        reader.onerror = () => {
                          setImportMessage('JSON फाइल पढ्न सकिएन।');
                        };
                        reader.readAsText(file, 'utf-8');
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
                <textarea
                  value={externalJsonInput}
                  onChange={e => setExternalJsonInput(e.target.value)}
                  placeholder={'{\n  "pdfSummaries": [...],\n  "dafaSummaries": [...]\n}'}
                  rows={8}
                  className="w-full p-3 font-mono text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <div className="flex-1 min-w-[200px]">
                  {importMessage && (
                    <span className="font-bold text-purple-700">{importMessage}</span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={importingJson || !externalJsonInput.trim()}
                  onClick={handleBatchImportJson}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white font-bold cursor-pointer transition-colors shadow-sm"
                >
                  {importingJson ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>इम्पोर्ट हुँदैछ...</span>
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4" />
                      <span>Firestore मा ब्याच सेभ गर्नुहोस्</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : activeSubTab === 'batch' ? (
            <div className="space-y-4">
              {/* Scope Controls */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="font-bold text-slate-800 text-sm">लक्षित दायरा छान्नुहोस्:</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex gap-1.5 bg-white p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setScopeMode('all')}
                      className={`flex-1 py-2 rounded-lg font-bold cursor-pointer ${
                        scopeMode === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      सबै PDF ({toDevaNum(uniqueDocs.length)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setScopeMode('folder')}
                      className={`flex-1 py-2 rounded-lg font-bold cursor-pointer ${
                        scopeMode === 'folder' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      फोल्डर
                    </button>
                    <button
                      type="button"
                      onClick={() => setScopeMode('doc')}
                      className={`flex-1 py-2 rounded-lg font-bold cursor-pointer ${
                        scopeMode === 'doc' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      १ PDF मात्र
                    </button>
                  </div>

                  {scopeMode === 'folder' && (
                    <select
                      value={selectedFolder}
                      onChange={e => setSelectedFolder(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800"
                    >
                      <option value="all">सबै फोल्डरहरू</option>
                      {uniqueFolders.map(f => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  )}

                  {scopeMode === 'doc' && (
                    <select
                      value={selectedDocPath}
                      onChange={e => setSelectedDocPath(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 md:col-span-2 truncate"
                    >
                      {uniqueDocs.map(d => (
                        <option key={d.path} value={d.path}>
                          {d.folderName} — {d.filename}
                        </option>
                      ))}
                    </select>
                  )}

                  <label className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 cursor-pointer font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={skipCached}
                      onChange={e => setSkipCached(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                    <span>पहिले नै तयार/सेभ भएका छोड्नुहोस् (कडाइका साथ लागू)</span>
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
                  <div>
                    {skipCached ? (
                      <>
                        बाँकी प्रक्रिया हुने:{' '}
                        <strong className="text-emerald-700">
                          {toDevaNum(pendingBatchDocs.length)} PDF
                        </strong>{' '}
                        र{' '}
                        <strong className="text-emerald-700">
                          {toDevaNum(pendingBatchRows.length)} दफा
                        </strong>{' '}
                        <span className="text-slate-500">
                          (कुल {toDevaNum(targetDocs.length)} PDF / {toDevaNum(targetRows.length)} दफा मध्ये{' '}
                          {toDevaNum(targetDocs.length - pendingBatchDocs.length)} PDF र{' '}
                          {toDevaNum(targetRows.length - pendingBatchRows.length)} दफा पहिले नै तयार भएकाले छोडिनेछन्)
                        </span>
                      </>
                    ) : (
                      <>
                        पुनः तयार हुने (सबै):{' '}
                        <strong>{toDevaNum(targetDocs.length)} PDF कागजात</strong> र{' '}
                        <strong>{toDevaNum(targetRows.length)} दफा/धारा/अनुसूची रेकर्डहरू</strong>
                      </>
                    )}
                  </div>
                  {poolKeysCount !== null && (
                    <div
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold border ${
                        poolKeysCount > 0
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>
                        {poolKeysCount > 0
                          ? `सक्रिय Gemini Keys: ${toDevaNum(poolActiveCount ?? poolKeysCount)}/${toDevaNum(
                              poolKeysCount
                            )} (Auto Rotation)${
                              poolInvalidSlots.length > 0 ? ` • अमान्य: ${poolInvalidSlots.join(', ')}` : ''
                            }`
                          : 'कुनै Gemini Key सेट छैन (Secrets मा राख्नुहोस्)'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Verified Repair Sync Banner when Firestore has dirty/incomplete/watermark records */}
              {(pendingFirestoreSync.pdfsToSync.length > 0 ||
                pendingFirestoreSync.dafasToSync.length > 0) && (
                <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-bold text-sm text-amber-950">
                      <ShieldCheck className="w-4 h-4 text-amber-700" />
                      <span>
                        सफा र प्रमाणित सारांश Firestore मा अपडेट गर्न तयार ({toDevaNum(pendingFirestoreSync.pdfsToSync.length)} PDF र {toDevaNum(pendingFirestoreSync.dafasToSync.length)} दफा)
                      </span>
                    </div>
                    <p className="text-amber-900/90 text-[11px] leading-relaxed">
                      अङ्ग्रेजी/अपूर्ण पाठ हटाइएको, वाटरमार्क अवरोध समाधान गरिएको, र पृष्ठ संख्यासहित तयार गरिएको सफा नेपाली सारांश एकै क्लिकमा Firestore मा सेभ गर्नुहोस्।
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={running}
                    onClick={() => void handleSyncVerifiedRepairsToFirestore()}
                    className="shrink-0 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Database className="w-4 h-4" />
                    <span>त्रुटिपूर्ण / अङ्ग्रेजी / वाटरमार्क सारांश सफा गरी Firestore अपडेट गर्नुहोस्</span>
                  </button>
                </div>
              )}

              {/* Unified One-Click Run All Card */}
              <div className="rounded-xl border-2 border-slate-900 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-bold text-sm text-emerald-300">
                    <Zap className="w-4 h-4" />
                    <span>
                      {skipCached
                        ? `बाँकी सारांश एकैपटक बनाउनुहोस् (${toDevaNum(pendingBatchDocs.length)} PDF + ${toDevaNum(
                            pendingBatchRows.length
                          )} दफा)`
                        : `सबै सारांश एकैपटक बनाउनुहोस् (PDF + सबै ${toDevaNum(targetRows.length)} दफा)`}
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    पहिले बाँकी सबै PDF को सारांश र लगत्तै सबै बाँकी दफा/अनुसूचीहरूको सारांश Key Pool बाट स्वतः पालैपालो Firestore मा सेभ गर्छ।
                  </p>
                </div>
                <button
                  type="button"
                  disabled={
                    running ||
                    (skipCached && pendingBatchDocs.length === 0 && pendingBatchRows.length === 0)
                  }
                  onClick={() => void handleRunAllSummaries()}
                  className="shrink-0 py-2.5 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <Play className="w-4 h-4" />
                  <span>
                    {skipCached && pendingBatchDocs.length === 0 && pendingBatchRows.length === 0
                      ? 'पहिले नै सबै तयार छ ✅'
                      : 'सबै सारांश सुरु गर्नुहोस्'}
                  </span>
                </button>
              </div>

              {/* Individual Action Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-indigo-950 text-sm">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span>
                      १. PDF कागजातको सारांश मात्र ({toDevaNum(pendingBatchDocs.length)} बाँकी)
                    </span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    प्रत्येक लक्षित PDF को पूर्ण कार्यकारी सारांश (Overview, Key Points, Important Sections, Deadlines) तयार गरी Firestore मा सेभ गर्छ।
                  </p>
                  <button
                    type="button"
                    disabled={running || (skipCached && pendingBatchDocs.length === 0)}
                    onClick={() => void handleRunBatchPdfSummaries()}
                    className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Play className="w-4 h-4" />
                    <span>
                      {skipCached && pendingBatchDocs.length === 0
                        ? 'सबै PDF सारांश तयार छन् ✅'
                        : `PDF सारांश Batch सुरु गर्नुहोस् (${toDevaNum(pendingBatchDocs.length)})`}
                    </span>
                  </button>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-emerald-950 text-sm">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>
                      २. प्रत्येक दफा (Every Dafa) सारांश मात्र ({toDevaNum(pendingBatchRows.length)} बाँकी)
                    </span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    सबै दफा/धारा/नियम/अनुसूचीलाई दफा १ बाट सुरु गरी ५–५ को समूहमा Gemini बाट नेपाली सारांश तयार पारी तुरुन्तै Firestore मा सेभ गर्छ। समय सीमा (504) आएमा स्वतः सानो समूह र छिटो मोडबाट पूरा गर्छ।
                  </p>
                  <button
                    type="button"
                    disabled={running || (skipCached && pendingBatchRows.length === 0)}
                    onClick={() => void handleRunBatchDafaSummaries()}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Play className="w-4 h-4" />
                    <span>
                      {skipCached && pendingBatchRows.length === 0
                        ? 'सबै दफा सारांश तयार छन् ✅'
                        : `प्रत्येक दफा सारांश Batch सुरु गर्नुहोस् (${toDevaNum(pendingBatchRows.length)})`}
                    </span>
                  </button>
                </div>
              </div>

              {/* Progress Box */}
              {(running || progressTotal > 0 || statusText || batchError) && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 font-bold text-slate-800">
                      {running ? (
                        <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      )}
                      <span>
                        {running
                          ? `${
                              runningKind === 'all'
                                ? 'पूर्ण Batch'
                                : runningKind === 'pdf'
                                ? 'PDF Batch'
                                : 'दफा Batch'
                            } चलिरहेको छ (${toDevaNum(pct)}%)`
                          : 'स्थिति'}
                      </span>
                    </div>
                    {running && (
                      <button
                        type="button"
                        onClick={handleStopBatch}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
                      >
                        <Square className="w-3 h-3" />
                        <span>रोक्नुहोस्</span>
                      </button>
                    )}
                  </div>

                  {progressTotal > 0 && (
                    <div className="space-y-1">
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-indigo-600 transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                        <span>{toDevaNum(progressCurrent)} / {toDevaNum(progressTotal)} पूरा</span>
                        <span>{toDevaNum(pct)}%</span>
                      </div>
                    </div>
                  )}

                  {statusText && <div className="text-slate-700 font-medium">{statusText}</div>}

                  {batchLogs.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-slate-950 text-slate-100 p-3 space-y-1 max-h-56 overflow-y-auto font-mono text-[11px]">
                      {batchLogs.map(log => (
                        <div
                          key={log.id}
                          className={
                            log.level === 'success'
                              ? 'text-emerald-300'
                              : log.level === 'warn'
                              ? 'text-amber-300'
                              : log.level === 'error'
                              ? 'text-rose-300'
                              : 'text-sky-300'
                          }
                        >
                          {log.text}
                        </div>
                      ))}
                      <div ref={logsEndRef} />
                    </div>
                  )}

                  {batchError && (
                    <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-rose-800 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{batchError}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="मास्टर स्टोरमा सुरक्षित PDF वा दफा सारांश खोज्नुहोस्..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                {browseType === 'dafas' && (
                  <select
                    value={browsePdfFilter}
                    onChange={e => setBrowsePdfFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 max-w-xs truncate"
                  >
                    <option value="all">सबै PDF (दफा १ बाट क्रमशः)</option>
                    {uniqueDocs.map(d => (
                      <option key={d.path} value={d.path}>
                        {d.filename}
                      </option>
                    ))}
                  </select>
                )}
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setBrowseType('dafas')}
                    className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                      browseType === 'dafas' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    दफा सारांश ({toDevaNum(cachedDafaSummaries.length)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBrowseType('pdfs')}
                    className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                      browseType === 'pdfs' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    PDF सारांश ({toDevaNum(cachedPdfSummaries.length)})
                  </button>
                </div>
              </div>

              {browseType === 'pdfs' ? (
                filteredBrowsePdfs.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                    कुनै PDF सारांश स्टोरमा भेटिएन। Batch ट्याबबाट जेनेरेट गर्नुहोस्।
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredBrowsePdfs.map(item => (
                      <div key={item.docId} className="rounded-xl border border-slate-200 p-3.5 bg-white space-y-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">{item.documentTitle}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono">
                            {item.mode} • {item.language} • {item.analyzedRange}
                          </span>
                        </div>
                        <p className="text-slate-700 leading-relaxed line-clamp-3">{item.overview}</p>
                      </div>
                    ))}
                  </div>
                )
              ) : filteredBrowseDafas.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  कुनै दफा सारांश स्टोरमा भेटिएन। Batch ट्याबबाट जेनेरेट गर्नुहोस्।
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredBrowseDafas.map(d => {
                    const meta = dafaMetaByDocId.get(d.docId);
                    return (
                      <div key={d.docId} className="rounded-xl border border-slate-200 p-3.5 bg-white space-y-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-bold text-slate-900">
                            {meta && (
                              <span className="inline-block mr-2 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono text-[11px]">
                                dafa {meta.indexInPdf}/{meta.totalInPdf}
                              </span>
                            )}
                            {d.sectionId || d.anusuchiId} — {d.titleName || d.anusuchiTitle}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 truncate max-w-xs">
                            {d.pdfName} (पृष्ठ {d.titlePage || '१'})
                          </span>
                        </div>
                        <p className="text-slate-700 leading-relaxed">{d.summaryNepali}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Master Store Engine: Firebase Firestore + Gemini 4 Hydrogen</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold cursor-pointer"
          >
            बन्द गर्नुहोस्
          </button>
        </div>
      </div>
    </div>
  );
};
