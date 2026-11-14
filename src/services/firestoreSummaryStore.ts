import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import type {
  DafaSummaryItem,
  DocumentSummary,
  LegalRow,
  PdfSummaryLanguage,
  PdfSummaryMode,
  PdfSummaryResult,
  StoredDafaSummaryRecord,
  StoredPdfSummaryRecord,
} from '../types';

export const OWNER_EMAIL = 'barshap.bp2026@gmail.com';
export const ADMIN_EMAIL = 'utshabp.upp@gmail.com';

export function isAuthorizedMasterUser(
  user: { email?: string | null; emailVerified?: boolean | null } | null | undefined
): boolean {
  if (!user || !user.emailVerified || !user.email) return false;
  const email = user.email.trim().toLowerCase();
  return email === OWNER_EMAIL || email === ADMIN_EMAIL;
}

export async function checkIsAdminOrOwner(
  user: { uid?: string; email?: string | null; emailVerified?: boolean | null } | null | undefined
): Promise<boolean> {
  if (!user || !user.emailVerified) return false;
  if (isAuthorizedMasterUser(user)) return true;
  if (!user.uid) return false;
  try {
    const adminSnap = await getDoc(doc(db, 'admins', user.uid));
    return adminSnap.exists();
  } catch {
    return false;
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function stableHash64(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= code + ((h1 >>> 16) & 0xff);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${part1}${part2}`;
}

export function buildPdfSummaryDocId(
  pdfPath: string,
  mode: PdfSummaryMode = 'executive',
  language: PdfSummaryLanguage = 'ne',
  startPage?: number,
  endPage?: number
): string {
  const rangePart = startPage || endPage ? `p${startPage || 1}_${endPage || 'end'}` : 'full';
  const raw = `${pdfPath}__${mode}__${language}__${rangePart}`;
  return `pdf_${stableHash64(raw)}_${mode}_${language}_${rangePart}`.slice(0, 128);
}

export function buildDafaSummaryDocId(row: Pick<LegalRow, 'pdf_name' | 'section_id' | 'anusuchi_id' | 'title_page' | 'anusuchi_print_page' | 'order_index'>): string {
  const canonicalKey = [
    row.pdf_name || '',
    row.section_id || '',
    row.anusuchi_id || '',
    row.title_page || '',
    row.anusuchi_print_page || '',
    String(row.order_index ?? ''),
  ].join('||');
  return `dafa_${stableHash64(canonicalKey)}`.slice(0, 128);
}

function clampStr(val: string | undefined | null, maxLen: number): string {
  const s = String(val ?? '');
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

export async function getCachedPdfSummary(
  docId: string
): Promise<StoredPdfSummaryRecord | null> {
  const path = `pdf_summaries/${docId}`;
  try {
    const snap = await getDoc(doc(db, 'pdf_summaries', docId));
    if (!snap.exists()) return null;
    return snap.data() as StoredPdfSummaryRecord;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function listAllCachedPdfSummaries(): Promise<StoredPdfSummaryRecord[]> {
  const path = 'pdf_summaries';
  try {
    const q = query(collection(db, 'pdf_summaries'), where('isPublic', '==', true));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as StoredPdfSummaryRecord);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function savePdfSummaryToFirestore(params: {
  docId: string;
  docInfo?: DocumentSummary;
  pdfPath: string;
  mode: PdfSummaryMode;
  language: PdfSummaryLanguage;
  summary: PdfSummaryResult;
}): Promise<StoredPdfSummaryRecord> {
  const user = auth.currentUser;
  if (!user || !isAuthorizedMasterUser(user)) {
    throw new Error(
      `Firestore मास्टर स्टोरमा सेभ गर्ने अनुमति Owner (${OWNER_EMAIL}) वा Admin (${ADMIN_EMAIL}) लाई मात्र छ।`
    );
  }

  const { docId, docInfo, pdfPath, mode, language, summary } = params;
  const docPath = `pdf_summaries/${docId}`;
  try {
    const ref = doc(db, 'pdf_summaries', docId);
    const existingSnap = await getDoc(ref);
    const existingData = existingSnap.exists() ? (existingSnap.data() as StoredPdfSummaryRecord) : null;

    const payload = {
      docId,
      isPublic: true,
      pdfPath: existingData ? existingData.pdfPath : clampStr(pdfPath, 500),
      pdfName: existingData
        ? existingData.pdfName
        : clampStr(docInfo?.filename || pdfPath.split('/').pop() || 'document.pdf', 300),
      folderId: existingData ? existingData.folderId : clampStr(docInfo?.folderId || '', 30),
      folderName: existingData ? existingData.folderName : clampStr(docInfo?.folderName || '', 200),
      mode: existingData ? existingData.mode : mode,
      language: existingData ? existingData.language : language,
      analyzedRange: clampStr(summary.analyzedRange || 'पूरा कागजात', 150),
      totalPages: Math.max(1, Math.min(10000, Math.trunc(summary.totalPages || 1))),
      fileSizeBytes: Math.max(0, Math.min(200000000, Math.trunc(docInfo?.size || 0))),
      documentTitle: clampStr(summary.documentTitle || docInfo?.filename || 'कानुनी कागजात', 500),
      overview: clampStr(summary.overview || 'सारांश उपलब्ध छ।', 12000),
      keyPoints: (summary.keyPoints || []).slice(0, 30).map(s => clampStr(s, 1000)),
      importantSections: (summary.importantSections || []).slice(0, 40).map(sec => ({
        reference: clampStr(sec.reference, 120),
        title: clampStr(sec.title, 300),
        summary: clampStr(sec.summary, 1500),
        page: clampStr(sec.page, 30),
      })),
      complianceAndDeadlines: (summary.complianceAndDeadlines || [])
        .slice(0, 40)
        .map(s => clampStr(s, 1000)),
      schedulesOverview: (summary.schedulesOverview || []).slice(0, 40).map(s => clampStr(s, 1000)),
      inputMethod: summary.inputMethod || 'pdf-multimodal',
      modelUsed: clampStr(summary.modelUsed || 'gemini-4-hydrogen', 100),
      updatedByUid: user.uid,
      createdAt: existingData?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(ref, payload);
    const saved = await getDoc(ref);
    return (saved.exists() ? saved.data() : payload) as StoredPdfSummaryRecord;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function getCachedDafaSummary(
  dafaId: string
): Promise<StoredDafaSummaryRecord | null> {
  const path = `dafa_summaries/${dafaId}`;
  try {
    const snap = await getDoc(doc(db, 'dafa_summaries', dafaId));
    if (!snap.exists()) return null;
    return snap.data() as StoredDafaSummaryRecord;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function listAllCachedDafaSummaries(): Promise<StoredDafaSummaryRecord[]> {
  const path = 'dafa_summaries';
  try {
    const q = query(collection(db, 'dafa_summaries'), where('isPublic', '==', true));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as StoredDafaSummaryRecord);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveDafaSummariesBatchToFirestore(
  items: DafaSummaryItem[],
  existingMap?: Map<string, StoredDafaSummaryRecord>
): Promise<StoredDafaSummaryRecord[]> {
  const user = auth.currentUser;
  if (!user || !isAuthorizedMasterUser(user)) {
    throw new Error(
      `Firestore मास्टर स्टोरमा दफा सारांश सेभ गर्ने अनुमति Owner (${OWNER_EMAIL}) वा Admin (${ADMIN_EMAIL}) लाई मात्र छ।`
    );
  }
  if (items.length === 0) return [];

  const savedRecords: StoredDafaSummaryRecord[] = [];
  const CHUNK_SIZE = 150;

  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    const path = 'dafa_summaries';

    try {
      for (const item of chunk) {
        const ref = doc(db, 'dafa_summaries', item.docId);
        let existingData = existingMap?.get(item.docId) || null;
        if (!existingMap) {
          const snap = await getDoc(ref);
          if (snap.exists()) existingData = snap.data() as StoredDafaSummaryRecord;
        }

        const record = {
          docId: item.docId,
          isPublic: true,
          pdfPath: existingData ? existingData.pdfPath : clampStr(item.pdfPath, 500),
          pdfName: existingData ? existingData.pdfName : clampStr(item.pdfName, 300),
          folderId: existingData ? existingData.folderId : clampStr(item.folderId, 30),
          sectionId: existingData ? existingData.sectionId : clampStr(item.sectionId, 120),
          titleName: existingData ? existingData.titleName : clampStr(item.titleName, 600),
          titlePage: existingData ? existingData.titlePage : clampStr(item.titlePage, 30),
          recordType: existingData ? existingData.recordType : clampStr(item.recordType, 60),
          anusuchiId: existingData ? existingData.anusuchiId : clampStr(item.anusuchiId, 120),
          anusuchiTitle: existingData ? existingData.anusuchiTitle : clampStr(item.anusuchiTitle, 600),
          summaryNepali: clampStr(item.summaryNepali || 'सारांश उपलब्ध छ।', 3000),
          keyObligations: (item.keyObligations || []).slice(0, 15).map(s => clampStr(s, 500)),
          modelUsed: clampStr(item.modelUsed || 'gemini-4-hydrogen', 100),
          updatedByUid: user.uid,
          createdAt: existingData?.createdAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        batch.set(ref, record);
        savedRecords.push(record as StoredDafaSummaryRecord);
      }

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  return savedRecords;
}
