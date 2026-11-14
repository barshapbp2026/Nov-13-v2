import { stripDocPrefix } from './urlUtils';
import { devaToNum, toDeva } from './markdownUtils';

export interface PdfPageRule {
  /** Offset added to all_rows data page (title_page / anusuchi_print_page) to reach physical PDF page (1-based) */
  toPhysicalOffset: number;
  /** Offset added to physical PDF page to get the printed book page number printed inside the document (usually <= 0) */
  printedOffset: number;
  /** Number of front-matter / cover / TOC pages before printed book page 1 starts */
  frontMatterPages: number;
  /** Optional explanation note in Nepali */
  noteNe?: string;
}

export interface PdfPageCalibration extends PdfPageRule {
  docKey: string;
  builtInPhysicalOffset: number;
  userOverrideOffset: number | null;
  effectivePhysicalOffset: number;
}

const USER_OFFSET_STORAGE_KEY = 'any_pdf_page_offsets_v1';

/**
 * Canonical per-document rules keyed by normalized filename (without folder/numeric prefix or .pdf).
 * Duplicates across folders (e.g., 5.2 & 12.8, or 9 & 10 & 11) share the exact same key automatically.
 */
const BUILT_IN_RULES: Array<{ match: (key: string) => boolean; rule: PdfPageRule }> = [
  {
    // Folder 9 / 10 / 11: सुकुम्बासी समस्या समाधान आयोगका कार्यादेशको संगालो (172 PDF pages; data 1..164; cover+preface+TOC = 8 pages)
    match: key => key.includes('सुकुम्बासी समस्या समाधान आयोगका कार्यादेशको संगालो'),
    rule: {
      toPhysicalOffset: 8,
      printedOffset: -8,
      frontMatterPages: 8,
      noteNe: 'पृष्ठ १–८ आवरण/विषय-सूची हुन्; पुस्तक पृष्ठ १ वास्तविक PDF पृष्ठ ९ बाट सुरु हुन्छ।',
    },
  },
  {
    // Folder 5.2 / 12.8: जग्गा नापजाँच तथा नक्सा स्रेस्ता अध्यावधिक सम्बन्धि निर्देशिका (116 PDF pages; data 1..111; cover+TOC = 5 pages)
    match: key => key.includes('नक्सा स्रेस्ता अध्यावधिक') || key.includes('नक्सा स्रेस्ता अद्यावधिक'),
    rule: {
      toPhysicalOffset: 5,
      printedOffset: -5,
      frontMatterPages: 5,
      noteNe: 'पृष्ठ १–५ आवरण/विषय-सूची हुन्; पुस्तक पृष्ठ १ वास्तविक PDF पृष्ठ ६ बाट सुरु हुन्छ।',
    },
  },
  {
    // Folder 5.1 / 11 / 12.9: भूमि प्रशासन निर्देशिका (453 PDF pages; all_rows already stores physical 26..451, printed book page 1 starts at PDF 26)
    match: key => key.includes('भूमि प्रशासन') && key.includes('निर्देशिका'),
    rule: {
      toPhysicalOffset: 0,
      printedOffset: -25,
      frontMatterPages: 25,
      noteNe: 'डेटा पहिले नै वास्तविक PDF पृष्ठ (२६–४५१) मा छ; PDF भित्र छापिएको पुस्तक पृष्ठ १ PDF पृष्ठ २६ बाट सुरु हुन्छ।',
    },
  },
  {
    // Folder 9 / 11: भूमिहीन दलित लगत सम्बन्धि निर्देशिका (68 PDF pages; data 2..66; PDF p2 prints 1)
    match: key => key.includes('लगत सम्बन्धि निर्देशिका') || key.includes('लगत सम्बन्धी निर्देशिका'),
    rule: {
      toPhysicalOffset: 0,
      printedOffset: -1,
      frontMatterPages: 1,
      noteNe: 'डेटा वास्तविक PDF पृष्ठ (२–६६) मा छ; आवरण पछि PDF पृष्ठ २ मा पुस्तक पृष्ठ १ छापिएको छ।',
    },
  },
  {
    // Folder 9 / 11: भूमिहीन-दलित-सुकुम्बासी-पहिचान र प्रमाणीकरण- मापदण्ड (14 PDF pages; data 2..13; PDF p2 prints 1)
    match: key => key.includes('पहिचान र प्रमाणीकरण') && key.includes('मापदण्ड'),
    rule: {
      toPhysicalOffset: 0,
      printedOffset: -1,
      frontMatterPages: 1,
      noteNe: 'डेटा वास्तविक PDF पृष्ठ (२–१३) मा छ; PDF पृष्ठ २ मा पुस्तक पृष्ठ १ छापिएको छ।',
    },
  },
  {
    // Folder 9 / 11: विगतका आयोग, समिति र कार्यदलका बाँकी काम सम्पन्न गर्ने सम्बन्धी कार्यविधि (13 PDF pages; data 2..12; PDF p2 prints 1)
    match: key => key.includes('विगतका आयोग') && key.includes('बाँकी काम'),
    rule: {
      toPhysicalOffset: 0,
      printedOffset: -1,
      frontMatterPages: 1,
      noteNe: 'डेटा वास्तविक PDF पृष्ठ (२–१२) मा छ; PDF पृष्ठ २ मा पुस्तक पृष्ठ १ छापिएको छ।',
    },
  },
];

export function normalizePdfOffsetKey(pdfPathOrName: string): string {
  const filename = (pdfPathOrName || '').split('/').pop() || pdfPathOrName || '';
  return stripDocPrefix(filename)
    .normalize('NFC')
    .replace(/\.pdf$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function readUserOffsetsMap(): Record<string, number> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(USER_OFFSET_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeUserOffsetsMap(map: Record<string, number>): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(USER_OFFSET_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota/private-mode storage failures
  }
}

export function getPdfPageCalibration(pdfPathOrName: string): PdfPageCalibration {
  const docKey = normalizePdfOffsetKey(pdfPathOrName);
  const found = BUILT_IN_RULES.find(entry => entry.match(docKey));
  const base: PdfPageRule = found
    ? found.rule
    : { toPhysicalOffset: 0, printedOffset: 0, frontMatterPages: 0 };

  const userMap = readUserOffsetsMap();
  const rawOverride = docKey && typeof userMap[docKey] === 'number' && Number.isFinite(userMap[docKey])
    ? Math.trunc(userMap[docKey])
    : null;

  const effectivePhysicalOffset = rawOverride !== null ? rawOverride : base.toPhysicalOffset;

  // If user shifted physical offset from built-in and built-in had 0 printedOffset, mirror the inverse as printedOffset hint
  const printedOffset =
    rawOverride !== null && base.printedOffset === 0
      ? -rawOverride
      : base.printedOffset;

  return {
    docKey,
    toPhysicalOffset: effectivePhysicalOffset,
    printedOffset,
    frontMatterPages: rawOverride !== null && base.frontMatterPages === 0 ? Math.max(0, rawOverride) : base.frontMatterPages,
    noteNe: base.noteNe,
    builtInPhysicalOffset: base.toPhysicalOffset,
    userOverrideOffset: rawOverride,
    effectivePhysicalOffset,
  };
}

export function setUserPdfPageOffset(pdfPathOrName: string, offset: number): void {
  const docKey = normalizePdfOffsetKey(pdfPathOrName);
  if (!docKey) return;
  const map = readUserOffsetsMap();
  const cleanOffset = Math.max(-100, Math.min(200, Math.trunc(offset)));
  map[docKey] = cleanOffset;
  writeUserOffsetsMap(map);
}

export function resetUserPdfPageOffset(pdfPathOrName: string): void {
  const docKey = normalizePdfOffsetKey(pdfPathOrName);
  if (!docKey) return;
  const map = readUserOffsetsMap();
  if (Object.prototype.hasOwnProperty.call(map, docKey)) {
    delete map[docKey];
    writeUserOffsetsMap(map);
  }
}

/**
 * Converts an all_rows data page (title_page or anusuchi_print_page) to the exact 1-based physical PDF page.
 */
export function toPhysicalPdfPage(
  pdfPathOrName: string,
  dataPage: string | number,
  totalPdfPages?: number
): number {
  const raw = typeof dataPage === 'number' ? dataPage : devaToNum(dataPage || '1');
  const basePage = Math.max(1, raw || 1);
  const cal = getPdfPageCalibration(pdfPathOrName);
  let physical = basePage + cal.effectivePhysicalOffset;
  physical = Math.max(1, physical);
  if (totalPdfPages && totalPdfPages > 0) {
    physical = Math.min(totalPdfPages, physical);
  }
  return physical;
}

/**
 * Computes the printed book page number corresponding to a 1-based physical PDF page.
 * Returns null if printed page == physical page (when no front-matter shift exists),
 * or { printedPage, isFrontMatter } when the document prints a shifted book number.
 */
export function getPrintedBookPageInfo(
  pdfPathOrName: string,
  physicalPdfPage: number
): { printedPage: number | null; isFrontMatter: boolean; hasShift: boolean } {
  const cal = getPdfPageCalibration(pdfPathOrName);
  if (cal.printedOffset === 0) {
    return { printedPage: physicalPdfPage, isFrontMatter: false, hasShift: false };
  }
  const printed = physicalPdfPage + cal.printedOffset;
  if (printed < 1) {
    return { printedPage: null, isFrontMatter: true, hasShift: true };
  }
  return { printedPage: printed, isFrontMatter: false, hasShift: true };
}

/**
 * Formats a concise Nepali page label showing Physical PDF page AND Printed Book page when they differ.
 */
export function formatDualPageLabel(
  pdfPathOrName: string,
  physicalPdfPage: number,
  totalPdfPages?: number
): string {
  const base = `PDF पृष्ठ ${toDeva(physicalPdfPage)}${totalPdfPages && totalPdfPages > 0 ? ` / ${toDeva(totalPdfPages)}` : ''}`;
  const info = getPrintedBookPageInfo(pdfPathOrName, physicalPdfPage);
  if (!info.hasShift) return base;
  if (info.isFrontMatter) return `${base} (आवरण/सूची)`;
  return `${base} (पुस्तक ${toDeva(info.printedPage!)})`;
}
