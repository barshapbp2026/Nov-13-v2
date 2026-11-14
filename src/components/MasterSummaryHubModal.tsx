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
  onRefreshStore,
  onPdfSaved,
  onDafasSaved,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'batch' | 'browse'>('batch');
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
      }
    } catch {
      // ignore non-critical status check error
    }
  };

  useEffect(() => {
    if (isOpen) {
      void refreshPoolStatus();
    }
  }, [isOpen]);

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

  const cachedPdfIdSet = useMemo(() => {
    return new Set(cachedPdfSummaries.map(p => p.docId));
  }, [cachedPdfSummaries]);

  const cachedDafaMap = useMemo(() => {
    const map = new Map<string, StoredDafaSummaryRecord>();
    cachedDafaSummaries.forEach(d => map.set(d.docId, d));
    return map;
  }, [cachedDafaSummaries]);

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
    const queue = targetDocs.filter(doc => {
      if (!skipCached) return true;
      const docId = buildPdfSummaryDocId(doc.path, 'executive', 'ne');
      return !cachedPdfIdSet.has(docId);
    });

    if (queue.length === 0) {
      setStatusText('छानिएका सबै PDF कागजातहरूको सारांश पहिले नै Firestore मास्टर स्टोरमा सुरक्षित छन्!');
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
    appendBatchLog(`PDF सारांश Batch सुरु (${toDevaNum(queue.length)} PDFs)`, 'info');

    let savedCount = 0;
    let failedCount = 0;
    let hardStopped = false;
    const interDelayMs = (poolKeysCount ?? 1) >= 3 ? 150 : 350;

    for (let i = 0; i < queue.length; i++) {
      if (stopFlagRef.current) break;
      const docInfo = queue[i];
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
                  : 'Gemini सर्भरमा अस्थायी चाप (503 High Demand) छ';
              const resumed = await waitWithStop(
                15,
                `${reason} — स्वतः पुनः प्रयास (${toDevaNum(rateLimitRetries)}/३)`
              );
              if (!resumed) break;
              continue;
            }
            failedCount++;
            setBatchError(`${docInfo.filename}: ${data.error || 'असफल भयो'}`);
            if (effectiveStatus === 429 || effectiveStatus === 403 || effectiveStatus === 503) {
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
              10,
              `अस्थायी सर्भर/प्रोक्सी अवरोध — स्वतः पुनः प्रयास (${toDevaNum(rateLimitRetries)}/२)`
            );
            if (!resumed) break;
            continue;
          }
          failedCount++;
          setBatchError(msg || 'नेटवर्क त्रुटि');
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
        if (skipCached && cachedDafaMap.has(docId)) return;
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
      setStatusText('छानिएका सबै दफा/धारा र अनुसूचीहरूको सारांश पहिले नै Firestore मास्टर स्टोरमा उपलब्ध छन्!');
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

    let processed = 0;
    let savedDafasCount = 0;
    let failedBatches = 0;
    let hardStopped = false;
    const BATCH_SIZE = 10;
    const interDelayMs = (poolKeysCount ?? 1) >= 3 ? 150 : 400;

    outerLoop: for (const [pdfPath, entries] of byPdf.entries()) {
      const pdfFile = pdfPath.split('/').pop() || pdfPath;
      const pdfTotal = totalPerPdf.get(pdfPath) || entries.length;
      const firstPos = entries[0]?.indexInPdf ?? 1;
      appendBatchLog(
        `दफा ${firstPos}/${pdfTotal} बाट सुरु हुँदैछ (${pdfFile})`,
        'info'
      );

      for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        if (stopFlagRef.current) break outerLoop;
        const slice = entries.slice(i, i + BATCH_SIZE);
        const startPos = slice[0].indexInPdf;
        const endPos = slice[slice.length - 1].indexInPdf;
        let done = false;
        let rateLimitRetries = 0;

        while (!done && !stopFlagRef.current) {
          setStatusText(
            `दफा ${startPos}–${endPos}/${pdfTotal} (कुल ${toDevaNum(processed + 1)}–${toDevaNum(
              Math.min(processed + slice.length, totalToProcess)
            )} / ${toDevaNum(totalToProcess)}): ${pdfFile}`
          );

          try {
            const { ok: httpOk, status, data } = await safeFetchJson('/api/gemini/summarize-dafas', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                pdfPath,
                items: slice.map(e => ({ docId: e.docId, row: e.row })),
              }),
            });

            if (!httpOk || !data.success || !Array.isArray(data.results)) {
              const effectiveStatus = data?.upstreamStatus ?? status;
              if ((effectiveStatus === 429 || effectiveStatus === 503 || effectiveStatus === 504) && rateLimitRetries < 3) {
                rateLimitRetries++;
                const reason =
                  effectiveStatus === 429
                    ? 'सबै Gemini Key अस्थायी कोटा सीमामा पुगे'
                    : 'Gemini सर्भरमा अस्थायी चाप (503 High Demand) छ';
                appendBatchLog(
                  `दफा ${startPos}–${endPos}/${pdfTotal}: ${reason} — पुनः प्रयास (${rateLimitRetries}/3)`,
                  'warn'
                );
                const resumed = await waitWithStop(
                  15,
                  `${reason} — स्वतः पुनः प्रयास (${toDevaNum(rateLimitRetries)}/३)`
                );
                if (!resumed) break outerLoop;
                continue;
              }
              failedBatches++;
              setBatchError(`${pdfFile}: ${data.error || 'दफा सारांश असफल'}`);
              appendBatchLog(
                `दफा ${startPos}–${endPos}/${pdfTotal} असफल: ${data.error || 'त्रुटि'}`,
                'error'
              );
              if (effectiveStatus === 429 || effectiveStatus === 403 || effectiveStatus === 503) {
                hardStopped = true;
                break outerLoop;
              }
              done = true;
            } else {
              const items: DafaSummaryItem[] = data.results;
              const saved = await saveDafaSummariesBatchToFirestore(items, cachedDafaMap);
              onDafasSaved(saved);
              savedDafasCount += saved.length;

              // Log every saved Dafa sequentially from startPos (e.g. dafa 1/55, dafa 2/55...)
              slice.forEach(entry => {
                const label =
                  entry.row.section_id || entry.row.anusuchi_id || '';
                const title =
                  entry.row.title_name || entry.row.anusuchi_title || '';
                appendBatchLog(
                  `dafa ${entry.indexInPdf}/${entry.totalInPdf} • ${label} ${title}`.trim(),
                  'success'
                );
              });
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
              appendBatchLog(
                `दफा ${startPos}–${endPos}/${pdfTotal}: अस्थायी प्रोक्सी अवरोध — पुनः प्रयास (${rateLimitRetries}/2)`,
                'warn'
              );
              const resumed = await waitWithStop(
                10,
                `अस्थायी सर्भर/प्रोक्सी अवरोध — स्वतः पुनः प्रयास (${toDevaNum(rateLimitRetries)}/२)`
              );
              if (!resumed) break outerLoop;
              continue;
            }
            failedBatches++;
            setBatchError(msg || 'नेटवर्क त्रुटि');
            appendBatchLog(`दफा ${startPos}–${endPos}/${pdfTotal}: ${msg || 'नेटवर्क त्रुटि'}`, 'error');
            hardStopped = true;
            break outerLoop;
          }
        }

        processed += slice.length;
        setProgressCurrent(processed);
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

  const handleRunAllSummaries = async () => {
    setBatchError('');
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
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {activeSubTab === 'batch' ? (
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
                    <span>पहिले नै सेभ भएका छोड्नुहोस् (नयाँ/बाँकी मात्र)</span>
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
                  <div>
                    लक्षित संख्या: <strong>{toDevaNum(targetDocs.length)} PDF कागजात</strong> र{' '}
                    <strong>{toDevaNum(targetRows.length)} दफा/धारा/अनुसूची रेकर्डहरू</strong>
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
                          ? `सक्रिय Gemini Keys: ${toDevaNum(poolKeysCount)} (Auto Rotation)`
                          : 'कुनै Gemini Key सेट छैन (Secrets मा राख्नुहोस्)'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Unified One-Click Run All Card */}
              <div className="rounded-xl border-2 border-slate-900 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-bold text-sm text-emerald-300">
                    <Zap className="w-4 h-4" />
                    <span>सबै सारांश एकैपटक बनाउनुहोस् (PDF + सबै {toDevaNum(targetRows.length)} दफा)</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    पहिले बाँकी सबै PDF को सारांश र लगत्तै सबै दफा/अनुसूचीहरूको सारांश ६ वटा Key बाट स्वतः पालैपालो Firestore मा सेभ गर्छ।
                  </p>
                </div>
                <button
                  type="button"
                  disabled={running}
                  onClick={() => void handleRunAllSummaries()}
                  className="shrink-0 py-2.5 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <Play className="w-4 h-4" />
                  <span>सबै सारांश सुरु गर्नुहोस्</span>
                </button>
              </div>

              {/* Individual Action Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-indigo-950 text-sm">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span>१. PDF कागजातको सारांश मात्र</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    प्रत्येक लक्षित PDF को पूर्ण कार्यकारी सारांश (Overview, Key Points, Important Sections, Deadlines) तयार गरी Firestore मा सेभ गर्छ।
                  </p>
                  <button
                    type="button"
                    disabled={running}
                    onClick={() => void handleRunBatchPdfSummaries()}
                    className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Play className="w-4 h-4" />
                    <span>PDF सारांश Batch सुरु गर्नुहोस्</span>
                  </button>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-emerald-950 text-sm">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>२. प्रत्येक दफा (Every Dafa) सारांश मात्र</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    सबै दफा/धारा/नियम/अनुसूचीलाई दफा १ बाट सुरु गरी १०–१० को समूहमा Gemini बाट नेपाली सारांश तयार पारी तुरुन्तै Firestore मा सेभ गर्छ। रोकिएमा पछि बाँकीबाटै सुचारु हुन्छ।
                  </p>
                  <button
                    type="button"
                    disabled={running}
                    onClick={() => void handleRunBatchDafaSummaries()}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Play className="w-4 h-4" />
                    <span>प्रत्येक दफा सारांश Batch सुरु गर्नुहोस्</span>
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
