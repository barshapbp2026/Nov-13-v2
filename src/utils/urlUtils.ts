import { LegalRow } from '../types';

/**
 * Normalizes a relative PDF path for GitHub Raw/Blob URLs.
 * - Maps Folder 1 display name (`१. संबिधान र मुलुकी संहिता`) to upstream GitHub folder (`१. नेपालको संबिधान र मुलुकी ऐन`)
 * - Encodes each path segment individually (preserving `/` separators)
 */
export function toGitHubPath(pdfPath: string): string {
  if (!pdfPath) return '';
  let mapped = pdfPath.replace(
    /^pdfs\/१\.\s*संबिधान र मुलुकी संहिता\//,
    'pdfs/१. नेपालको संबिधान र मुलुकी ऐन/'
  );
  // Upstream Folder 1.4.1 filename uses अनसुूची-१.pdf
  mapped = mapped.replace(
    '१.४.१. मुलुकी फौजदारी कार्यविधि संहिता २०७४,को अनुसूची-१.pdf',
    '१.४.१. मुलुकी फौजदारी कार्यविधि संहिता २०७४,को अनसुूची-१.pdf'
  );
  return mapped
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
}

export function toGitHubRawUrl(pdfPath: string): string {
  return `https://raw.githubusercontent.com/barshapbp2026/any-pdf-/main/${toGitHubPath(pdfPath)}`;
}

export function toGitHubBlobUrl(pdfPath: string): string {
  return `https://github.com/barshapbp2026/any-pdf-/blob/main/${toGitHubPath(pdfPath)}`;
}

/**
 * Strips leading numeric prefixes (e.g., `१.१. `, `१२.५. `, `1.2. `) and whitespace for consistent doc matching
 */
export function stripDocPrefix(name: string): string {
  return (name || '')
    .replace(/^[०-९0-9]+(\.[०-९0-9]+)*\.\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Consistent prefix-agnostic PDF name matcher used across all folders and master tables
 */
export function matchesDocName(rowPdfName: string, docFilename: string): boolean {
  if (!rowPdfName || !docFilename) return false;
  if (rowPdfName === docFilename) return true;
  const normRow = stripDocPrefix(rowPdfName);
  const normDoc = stripDocPrefix(docFilename);
  return (
    normRow === normDoc ||
    rowPdfName.includes(normDoc) ||
    docFilename.includes(normRow)
  );
}

/**
 * Checks whether a row belongs to a specific folder (supports single or comma-separated folder_id)
 */
export function rowBelongsToFolder(
  row: LegalRow,
  folderId: string,
  folderName: string
): boolean {
  if (row.folder_id === folderId) return true;
  if (row.folder_id) {
    const ids = row.folder_id.split(',').map(s => s.trim());
    if (ids.includes(folderId)) return true;
  }
  if (row.folder_name === folderName || row.folder_name?.startsWith(folderId + ' ')) {
    return true;
  }
  if (
    folderId === '१.' &&
    (row.pdf_name?.includes('संबिधान') ||
      row.pdf_name?.includes('संविधान') ||
      row.pdf_name?.includes('अपराध संहिता') ||
      row.pdf_name?.includes('देवानी संहिता') ||
      row.pdf_name?.includes('फौजदारी कार्यविधि'))
  ) {
    return true;
  }
  return false;
}

/**
 * Identifies dedicated Anusuchi rows consistently (without misclassifying धारा rows that cross-reference schedules)
 */
export function isAnusuchiRow(row: LegalRow): boolean {
  return (
    row.type === 'अनुसूची' ||
    /^अनुसूची/i.test(row.section_id || '') ||
    (!row.section_id && !!row.anusuchi_id)
  );
}
