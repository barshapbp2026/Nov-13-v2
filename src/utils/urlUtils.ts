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

/**
 * Normalizes an Anusuchi ID cell so only the Anusuchi ID (never an Anusuchi title) is shown.
 */
export function formatAnusuchiIdOnly(anusuchiId?: string): string {
  const raw = (anusuchiId || '').trim();
  if (!raw) return '';
  return raw
    .split(',')
    .map(part =>
      part
        .trim()
        .replace(/[:：].*$/, '')
        .replace(/\.+$/, '')
        .trim()
    )
    .filter(Boolean)
    .join(', ');
}

/**
 * Strips redundant leading "अनुसूची-X:" prefix from Anusuchi Title when there is remaining title text
 * and it is not a multi-schedule "|" summary string.
 */
export function formatAnusuchiTitleClean(anusuchiTitle?: string): string {
  const raw = (anusuchiTitle || '').trim();
  if (!raw) return '';
  if (raw.includes('|')) return raw;
  const stripped = raw
    .replace(/^अनुसूची\s*[-–]?\s*[०-९0-9]+(?:\s*\(?[क-ह]\)?)?\s*[:：]\s*/i, '')
    .trim();
  return stripped || raw;
}

export function getDisplaySectionId(row: LegalRow): string {
  if (isAnusuchiRow(row)) return '';
  return row.section_id || '';
}

export function getDisplaySectionTitle(row: LegalRow): string {
  if (isAnusuchiRow(row)) return '';
  return row.title_name || '';
}

export function getDisplaySectionPage(row: LegalRow): string {
  if (isAnusuchiRow(row)) return '';
  return row.title_page || '';
}


/**
 * Converts Devanagari digits (०-९) in a string to ASCII digits (0-9)
 */
export function devaDigitsToAscii(s: string): string {
  return (s || '').replace(/[०-९]/g, d => String('०१२३४५६७८९'.indexOf(d)));
}

/**
 * Extracts leading integer from Devanagari/ASCII string, or 999999 if none
 */
export function parseDevaInt(s: string): number {
  if (!s) return 999999;
  const ascii = devaDigitsToAscii(s).trim();
  const m = ascii.match(/^([0-9]+)/);
  return m ? parseInt(m[1], 10) : 999999;
}

/**
 * Extracts hierarchical numeric prefix from filenames/subfolder IDs (e.g., "१.४.१. ..." -> [1, 4, 1])
 */
export function extractNumericPrefixParts(s: string): number[] {
  const ascii = devaDigitsToAscii(s || '').trim();
  const m = ascii.match(/^([0-9]+(?:\.[0-9]+)*)/);
  if (!m) return [999999];
  return m[1].split('.').map(n => parseInt(n, 10) || 0);
}

export function compareNumericPrefixes(a: string, b: string): number {
  const pa = extractNumericPrefixParts(a);
  const pb = extractNumericPrefixParts(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const va = pa[i] ?? -1;
    const vb = pb[i] ?? -1;
    if (va !== vb) return va - vb;
  }
  return (a || '').localeCompare(b || '', 'ne');
}

const NEPALI_SUFFIX_ORDER = 'कखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसह';

function parseSectionSortKey(row: LegalRow): {
  isSchedule: boolean;
  nums: number[];
  suffixRank: number;
  raw: string;
} {
  const isSchedule = isAnusuchiRow(row);
  const target = isSchedule
    ? (row.anusuchi_id || row.section_id || '')
    : (row.section_id || row.anusuchi_id || '');
  const ascii = devaDigitsToAscii(target).trim();

  // Extract all numbers in order (e.g., "अनुसूची-1 (2.1.1.10)" -> [1, 2, 1, 1, 10], "3(5क)" -> [3, 5])
  const numMatches = ascii.match(/[0-9]+/g);
  const nums = numMatches ? numMatches.map(n => parseInt(n, 10)) : [999998];

  // Check Devanagari alphabetical suffix like क, ख, ग inside "१२क." or "३(५क)"
  let suffixRank = 0;
  const suffixMatch = ascii.match(/[0-9]+([क-ह])/);
  if (suffixMatch) {
    const idx = NEPALI_SUFFIX_ORDER.indexOf(suffixMatch[1]);
    suffixRank = idx >= 0 ? idx + 1 : 99;
  }

  return { isSchedule, nums, suffixRank, raw: ascii };
}

/**
 * Serial legal comparator: Folder ID -> Subfolder ID -> PDF Name (numeric prefix) -> Sections before Schedules -> Section/Anusuchi numeric parts
 */
export function compareLegalRows(a: LegalRow, b: LegalRow): number {
  const fA = parseDevaInt(a.folder_id);
  const fB = parseDevaInt(b.folder_id);
  if (fA !== fB) return fA - fB;

  if ((a.subfolder_id || '') !== (b.subfolder_id || '')) {
    const sfCmp = compareNumericPrefixes(a.subfolder_id || '', b.subfolder_id || '');
    if (sfCmp !== 0) return sfCmp;
  }

  if (a.pdf_name !== b.pdf_name) {
    const pdfCmp = compareNumericPrefixes(a.pdf_name, b.pdf_name);
    if (pdfCmp !== 0) return pdfCmp;
  }

  const ka = parseSectionSortKey(a);
  const kb = parseSectionSortKey(b);

  if (ka.isSchedule !== kb.isSchedule) {
    return ka.isSchedule ? 1 : -1;
  }

  const len = Math.max(ka.nums.length, kb.nums.length);
  for (let i = 0; i < len; i++) {
    const va = ka.nums[i] ?? -1;
    const vb = kb.nums[i] ?? -1;
    if (va !== vb) return va - vb;
  }

  if (ka.suffixRank !== kb.suffixRank) {
    return ka.suffixRank - kb.suffixRank;
  }

  if (a.order_index !== undefined && b.order_index !== undefined && a.order_index !== b.order_index) {
    return a.order_index - b.order_index;
  }

  return ka.raw.localeCompare(kb.raw, 'ne');
}
