import type {
  DocumentSummary,
  LegalRow,
  StoredDafaSummaryRecord,
  StoredPdfSummaryRecord,
} from '../types';
import {
  buildDafaSummaryDocId,
  buildPdfSummaryDocId,
} from '../services/firestoreSummaryStore';
import {
  isDirtyOrIncompleteDafaRecord,
  isDirtyOrIncompletePdfRecord,
} from './summarySanitizer';

export interface DocSummaryCoverage {
  pdfPath: string;
  pdfReady: boolean;
  cleanDafas: number;
  totalRows: number;
  pendingDafas: number;
  isComplete: boolean;
  isPartial: boolean;
}

export interface FolderSummaryCoverage {
  folderId: string;
  folderName: string;
  totalDocs: number;
  completeDocs: number;
  pdfReadyDocs: number;
  cleanDafas: number;
  totalRows: number;
  isFolderComplete: boolean;
}

export interface PortalSummaryCoverage {
  docStatusByPath: Map<string, DocSummaryCoverage>;
  folderStatusByName: Map<string, FolderSummaryCoverage>;
  folderStatusById: Map<string, FolderSummaryCoverage>;
  totalDocs: number;
  totalCompleteDocs: number;
  totalPdfReadyDocs: number;
  totalFolders: number;
  totalCompleteFolders: number;
  totalRows: number;
  totalCleanDafas: number;
}

export function toDevaDigits(val: number | string): string {
  const digits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  return String(val).replace(/[0-9]/g, d => digits[parseInt(d, 10)]);
}

export function computeSummaryCoverage(
  documents: DocumentSummary[],
  allRows: LegalRow[],
  cachedPdfSummaries: StoredPdfSummaryRecord[],
  cachedDafaSummaries: StoredDafaSummaryRecord[]
): PortalSummaryCoverage {
  const pdfById = new Map<string, StoredPdfSummaryRecord>();
  const pdfByPath = new Map<string, StoredPdfSummaryRecord>();

  for (const p of cachedPdfSummaries) {
    pdfById.set(p.docId, p);
    const mode = p.mode || 'executive';
    const lang = p.language || 'ne';
    if (mode === 'executive' && lang === 'ne') {
      const existing = pdfByPath.get(p.pdfPath);
      if (
        !existing ||
        (isDirtyOrIncompletePdfRecord(existing) && !isDirtyOrIncompletePdfRecord(p))
      ) {
        pdfByPath.set(p.pdfPath, p);
      }
    }
  }

  const dafaById = new Map<string, StoredDafaSummaryRecord>();
  for (const d of cachedDafaSummaries) {
    dafaById.set(d.docId, d);
  }

  const rowsByPath = new Map<string, LegalRow[]>();
  for (const r of allRows) {
    if (!rowsByPath.has(r.pdf_path)) rowsByPath.set(r.pdf_path, []);
    rowsByPath.get(r.pdf_path)!.push(r);
  }

  const docStatusByPath = new Map<string, DocSummaryCoverage>();
  const folderStatusByName = new Map<string, FolderSummaryCoverage>();
  const folderStatusById = new Map<string, FolderSummaryCoverage>();

  const uniqueDocsByPath = new Map<string, DocumentSummary>();
  for (const d of documents) {
    if (!uniqueDocsByPath.has(d.path)) {
      uniqueDocsByPath.set(d.path, d);
    }
  }

  let totalCompleteDocs = 0;
  let totalPdfReadyDocs = 0;
  let totalRowsAll = 0;
  let totalCleanDafasAll = 0;

  for (const docItem of uniqueDocsByPath.values()) {
    const pdfRec =
      pdfById.get(buildPdfSummaryDocId(docItem.path, 'executive', 'ne')) ||
      pdfByPath.get(docItem.path);
    const pdfReady = Boolean(pdfRec && !isDirtyOrIncompletePdfRecord(pdfRec));

    const docRows = rowsByPath.get(docItem.path) || [];
    let cleanDafas = 0;
    for (const r of docRows) {
      const rec = dafaById.get(buildDafaSummaryDocId(r));
      if (rec && !isDirtyOrIncompleteDafaRecord(rec)) {
        cleanDafas++;
      }
    }

    // Must have indexed rows (or non-zero rows) AND clean PDF summary AND 100% clean Dafas
    const totalRows = docRows.length;
    const pendingDafas =
      totalRows > 0
        ? Math.max(0, totalRows - cleanDafas)
        : docItem.totalRows > 0
        ? docItem.totalRows
        : 0;
    const isComplete = pdfReady && totalRows > 0 && cleanDafas >= totalRows;
    const isPartial = !isComplete && (pdfReady || cleanDafas > 0);

    docStatusByPath.set(docItem.path, {
      pdfPath: docItem.path,
      pdfReady,
      cleanDafas,
      totalRows,
      pendingDafas,
      isComplete,
      isPartial,
    });

    if (isComplete) totalCompleteDocs++;
    if (pdfReady) totalPdfReadyDocs++;
    totalRowsAll += totalRows;
    totalCleanDafasAll += cleanDafas;

    let fStat = folderStatusByName.get(docItem.folderName);
    if (!fStat) {
      fStat = {
        folderId: docItem.folderId,
        folderName: docItem.folderName,
        totalDocs: 0,
        completeDocs: 0,
        pdfReadyDocs: 0,
        cleanDafas: 0,
        totalRows: 0,
        isFolderComplete: false,
      };
      folderStatusByName.set(docItem.folderName, fStat);
    }
    fStat.totalDocs++;
    if (isComplete) fStat.completeDocs++;
    if (pdfReady) fStat.pdfReadyDocs++;
    fStat.cleanDafas += cleanDafas;
    fStat.totalRows += totalRows;
  }

  let totalCompleteFolders = 0;
  for (const fStat of folderStatusByName.values()) {
    fStat.isFolderComplete = fStat.totalDocs > 0 && fStat.completeDocs === fStat.totalDocs;
    if (fStat.isFolderComplete) totalCompleteFolders++;
    if (fStat.folderId) {
      folderStatusById.set(fStat.folderId, fStat);
    }
  }

  return {
    docStatusByPath,
    folderStatusByName,
    folderStatusById,
    totalDocs: uniqueDocsByPath.size,
    totalCompleteDocs,
    totalPdfReadyDocs,
    totalFolders: folderStatusByName.size,
    totalCompleteFolders,
    totalRows: totalRowsAll,
    totalCleanDafas: totalCleanDafasAll,
  };
}
