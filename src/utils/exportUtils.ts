import * as XLSX from 'xlsx';
import { LegalRow } from '../types';
import {
  formatAnusuchiIdOnly,
  formatAnusuchiTitleClean,
  getDisplaySectionId,
  getDisplaySectionTitle,
  getDisplaySectionPage,
} from './urlUtils';

export const MASTER_TABLE_HEADERS = [
  '१. Folder ID',
  '२. Subfolder ID',
  '३. Folder Name',
  '४. Subfolder Name',
  '५. PDF Name',
  '६. धारा/दफा/नियम/निर्देशन/बुँदा ID',
  '७. Title Name (संयुक्त)',
  '७.१ धारा Title',
  '७.२ दफा Title',
  '७.३ नियम Title',
  '७.४ निर्देशन Title',
  '७.५ बुँदा Title',
  '८. Title Page',
  '९. अनुसूची ID',
  '१०. अनुसूची Title',
  '११. अनुसूची Print Page',
  'PDF Path'
];

/**
 * Merges all rows having the same value in Excel (.xlsx) using worksheet['!merges'].
 * Consecutive rows sharing the same Folder ID, Subfolder, and PDF Name are merged into single cells,
 * and duplicate repeated values in subsequent rows are hidden from users.
 */
export function exportToExcel(rows: LegalRow[], filename = 'Nepal_Legal_Master_Table_Data.xlsx') {
  if (!rows || rows.length === 0) return;

  const merges: XLSX.Range[] = [];
  const formattedData: Record<string, string>[] = [];

  // 1. Prepare formatted data and detect runs of identical values
  let i = 0;
  while (i < rows.length) {
    const parentKey = `${rows[i].folder_id}__${rows[i].subfolder_id || ''}__${rows[i].folder_name}__${rows[i].subfolder_name || ''}__${rows[i].pdf_name || ''}`;
    let j = i + 1;
    while (
      j < rows.length &&
      `${rows[j].folder_id}__${rows[j].subfolder_id || ''}__${rows[j].folder_name}__${rows[j].subfolder_name || ''}__${rows[j].pdf_name || ''}` === parentKey
    ) {
      j++;
    }

    const docStartRow = i + 1; // Row 0 is header row
    const docEndRow = j;       // 1-indexed for header offset

    // If multiple rows share the same folder & PDF, merge columns 0, 1, 2, 3, 4, and 16
    if (j - i > 1) {
      // 0: '१. Folder ID'
      merges.push({ s: { r: docStartRow, c: 0 }, e: { r: docEndRow, c: 0 } });
      // 1: '२. Subfolder ID'
      merges.push({ s: { r: docStartRow, c: 1 }, e: { r: docEndRow, c: 1 } });
      // 2: '३. Folder Name'
      merges.push({ s: { r: docStartRow, c: 2 }, e: { r: docEndRow, c: 2 } });
      // 3: '४. Subfolder Name'
      merges.push({ s: { r: docStartRow, c: 3 }, e: { r: docEndRow, c: 3 } });
      // 4: '५. PDF Name'
      merges.push({ s: { r: docStartRow, c: 4 }, e: { r: docEndRow, c: 4 } });
      // 16: 'PDF Path'
      merges.push({ s: { r: docStartRow, c: 16 }, e: { r: docEndRow, c: 16 } });
    }

    // Populate formatted rows for this block
    for (let k = i; k < j; k++) {
      const r = rows[k];
      const isFirstInDoc = k === i;
      const secId = getDisplaySectionId(r);
      const secTitle = getDisplaySectionTitle(r);
      const secPage = getDisplaySectionPage(r);

      formattedData.push({
        '१. Folder ID': isFirstInDoc ? r.folder_id : '',
        '२. Subfolder ID': isFirstInDoc ? (r.subfolder_id || '') : '',
        '३. Folder Name': isFirstInDoc ? r.folder_name : '',
        '४. Subfolder Name': isFirstInDoc ? (r.subfolder_name || '') : '',
        '५. PDF Name': isFirstInDoc ? (r.pdf_name || '') : '',
        '६. धारा/दफा/नियम/निर्देशन/बुँदा ID': secId,
        '७. Title Name': secTitle,
        '७.१ धारा': r.type === 'धारा' ? secTitle : '',
        '७.२ दफा': (r.type === 'दफा' || r.type === 'संशोधन') ? secTitle : '',
        '७.३ नियम': r.type === 'नियम' ? secTitle : '',
        '७.४ निर्देशन': r.type === 'निर्देशन' ? secTitle : '',
        '७.५ बुँदा': (r.type === 'बुँदा' || r.type === 'महल') ? secTitle : '',
        '८. Title Page': secPage,
        '९. अनुसूची ID': formatAnusuchiIdOnly(r.anusuchi_id),
        '१०. अनुसूची Title': formatAnusuchiTitleClean(r.anusuchi_title),
        '११. अनुसूची Print Page': r.anusuchi_print_page || '',
        'PDF Path': isFirstInDoc ? (r.pdf_path || '') : ''
      });
    }

    // Also merge consecutive rows within this document that share the exact same section_id and title_name
    let sIdx = i;
    while (sIdx < j) {
      const sId = getDisplaySectionId(rows[sIdx]);
      if (!sId) {
        sIdx++;
        continue;
      }
      const sKey = `${sId}__${getDisplaySectionTitle(rows[sIdx])}`;
      let sNext = sIdx + 1;
      while (sNext < j && `${getDisplaySectionId(rows[sNext])}__${getDisplaySectionTitle(rows[sNext])}` === sKey) {
        sNext++;
      }
      if (sNext - sIdx > 1) {
        const secStart = sIdx + 1;
        const secEnd = sNext;
        // Merge Col 5 (Section ID), Col 6 (Title Name), Cols 7-11 (Sub-columns), Col 12 (Title Page)
        merges.push({ s: { r: secStart, c: 5 }, e: { r: secEnd, c: 5 } });
        merges.push({ s: { r: secStart, c: 6 }, e: { r: secEnd, c: 6 } });
        merges.push({ s: { r: secStart, c: 7 }, e: { r: secEnd, c: 7 } });
        merges.push({ s: { r: secStart, c: 8 }, e: { r: secEnd, c: 8 } });
        merges.push({ s: { r: secStart, c: 9 }, e: { r: secEnd, c: 9 } });
        merges.push({ s: { r: secStart, c: 10 }, e: { r: secEnd, c: 10 } });
        merges.push({ s: { r: secStart, c: 11 }, e: { r: secEnd, c: 11 } });
        merges.push({ s: { r: secStart, c: 12 }, e: { r: secEnd, c: 12 } });

        // Blank out subsequent rows so values are hidden
        for (let sk = sIdx + 1; sk < sNext; sk++) {
          formattedData[sk]['६. धारा/दफा/नियम/निर्देशन/बुँदा ID'] = '';
          formattedData[sk]['७. Title Name'] = '';
          formattedData[sk]['७.१ धारा'] = '';
          formattedData[sk]['७.२ दफा'] = '';
          formattedData[sk]['७.३ नियम'] = '';
          formattedData[sk]['७.४ निर्देशन'] = '';
          formattedData[sk]['७.५ बुँदा'] = '';
          formattedData[sk]['८. Title Page'] = '';
        }
      }
      sIdx = sNext;
    }

    i = j;
  }

  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  worksheet['!merges'] = merges;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Master_Table_Merged');

  // Auto-width columns
  worksheet['!cols'] = [
    { wch: 14 },
    { wch: 16 },
    { wch: 28 },
    { wch: 28 },
    { wch: 45 },
    { wch: 22 },
    { wch: 40 },
    { wch: 35 },
    { wch: 35 },
    { wch: 35 },
    { wch: 35 },
    { wch: 35 },
    { wch: 14 },
    { wch: 16 },
    { wch: 50 },
    { wch: 18 },
    { wch: 60 }
  ];

  XLSX.writeFile(workbook, filename);
}

/**
 * Merges all rows having the same value in CSV export.
 * Consecutive rows sharing identical Folder ID, Subfolder ID, Folder Name, Subfolder Name,
 * and PDF Name have repeated values hidden from users (rendered blank in subsequent rows).
 */
export function exportToCsv(rows: LegalRow[], filename = 'Nepal_Legal_Master_Table_Data.csv') {
  const headers = [
    '१. Folder ID',
    '२. Subfolder ID',
    '३. Folder Name',
    '४. Subfolder Name',
    '५. PDF Name',
    '६. धारा/दफा/नियम/निर्देशन/बुँदा ID',
    '७.१ धारा Title',
    '७.२ दफा Title',
    '७.३ नियम Title',
    '७.४ निर्देशन Title',
    '७.५ बुँदा Title',
    '७. Title Name (संयुक्त)',
    '८. Title Page',
    '९. अनुसूची ID',
    '१०. अनुसूची Title',
    '११. अनुसूची Print Page'
  ];

  const escapeCsv = (str: string) => {
    if (!str) return '""';
    const clean = str.replace(/"/g, '""');
    return `"${clean}"`;
  };

  const csvRows = [headers.map(escapeCsv).join(',')];

  rows.forEach((r, idx) => {
    const isSameParent = idx > 0 &&
      rows[idx - 1].folder_id === r.folder_id &&
      rows[idx - 1].folder_name === r.folder_name &&
      (rows[idx - 1].subfolder_id || '') === (r.subfolder_id || '') &&
      (rows[idx - 1].subfolder_name || '') === (r.subfolder_name || '') &&
      (rows[idx - 1].pdf_name || '') === (r.pdf_name || '');

    const curSecId = getDisplaySectionId(r);
    const curSecTitle = getDisplaySectionTitle(r);
    const prevSecId = idx > 0 ? getDisplaySectionId(rows[idx - 1]) : '';
    const prevSecTitle = idx > 0 ? getDisplaySectionTitle(rows[idx - 1]) : '';

    const isSameSection = isSameParent &&
      !!curSecId &&
      prevSecId === curSecId &&
      prevSecTitle === curSecTitle;

    csvRows.push([
      escapeCsv(isSameParent ? '' : r.folder_id),
      escapeCsv(isSameParent ? '' : (r.subfolder_id || '')),
      escapeCsv(isSameParent ? '' : r.folder_name),
      escapeCsv(isSameParent ? '' : (r.subfolder_name || '')),
      escapeCsv(isSameParent ? '' : (r.pdf_name || '')),
      escapeCsv(isSameSection ? '' : curSecId),
      escapeCsv(isSameSection ? '' : (r.type === 'धारा' ? curSecTitle : '')),
      escapeCsv(isSameSection ? '' : ((r.type === 'दफा' || r.type === 'संशोधन') ? curSecTitle : '')),
      escapeCsv(isSameSection ? '' : (r.type === 'नियम' ? curSecTitle : '')),
      escapeCsv(isSameSection ? '' : (r.type === 'निर्देशन' ? curSecTitle : '')),
      escapeCsv(isSameSection ? '' : ((r.type === 'बुँदा' || r.type === 'महल') ? curSecTitle : '')),
      escapeCsv(isSameSection ? '' : curSecTitle),
      escapeCsv(isSameSection ? '' : getDisplaySectionPage(r)),
      escapeCsv(formatAnusuchiIdOnly(r.anusuchi_id)),
      escapeCsv(formatAnusuchiTitleClean(r.anusuchi_title)),
      escapeCsv(r.anusuchi_print_page || '')
    ].join(','));
  });

  // UTF-8 BOM (\uFEFF) ensures Excel opens Devanagari Unicode without garbling
  const blob = new Blob(['\uFEFF' + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Merges all rows having the same value in JSON export.
 * Groups records by folder_id, subfolder_id, and pdf_name into consolidated merged objects,
 * hiding repeated values and organizing sections and schedules cleanly.
 */
export function exportToJson(rows: LegalRow[], filename = 'Nepal_Legal_10_Columns_Merged_Data.json') {
  // 1. Group rows by identical parent values (folder_id, subfolder_id, pdf_name)
  const mergedMap = new Map<string, {
    folder_id: string;
    subfolder_id: string;
    folder_name: string;
    subfolder_name: string;
    pdf_name: string;
    pdf_path: string;
    total_records: number;
    sections: Array<{
      section_id: string;
      title_name: string;
      title_page: string;
      type?: string;
      legal_style?: string;
    }>;
    schedules: Array<{
      anusuchi_id: string;
      anusuchi_title: string;
      anusuchi_print_page: string;
    }>;
    rows: LegalRow[];
  }>();

  for (const r of rows) {
    const key = `${r.folder_id}__${r.subfolder_id || ''}__${r.pdf_name || ''}`;
    if (!mergedMap.has(key)) {
      mergedMap.set(key, {
        folder_id: r.folder_id,
        subfolder_id: r.subfolder_id || '',
        folder_name: r.folder_name,
        subfolder_name: r.subfolder_name || '',
        pdf_name: r.pdf_name || '',
        pdf_path: r.pdf_path || '',
        total_records: 0,
        sections: [],
        schedules: [],
        rows: []
      });
    }

    const docGroup = mergedMap.get(key)!;
    docGroup.total_records++;
    docGroup.rows.push(r);

    const secId = getDisplaySectionId(r);
    const secTitle = getDisplaySectionTitle(r);
    const secPage = getDisplaySectionPage(r);
    const anuId = formatAnusuchiIdOnly(r.anusuchi_id);
    const anuTitle = formatAnusuchiTitleClean(r.anusuchi_title);

    if (secId && !docGroup.sections.some(s => s.section_id === secId && s.title_name === secTitle)) {
      docGroup.sections.push({
        section_id: secId,
        title_name: secTitle,
        title_page: secPage,
        type: r.type,
        legal_style: r.legal_style
      });
    }

    if (anuId && !docGroup.schedules.some(sch => sch.anusuchi_id === anuId && sch.anusuchi_title === anuTitle)) {
      docGroup.schedules.push({
        anusuchi_id: anuId,
        anusuchi_title: anuTitle,
        anusuchi_print_page: r.anusuchi_print_page
      });
    }
  }

  // 2. Also construct flat merged rows where repeated parent values are merged
  const flatMergedRows = rows.map((r, idx) => {
    const isSameParent = idx > 0 &&
      rows[idx - 1].folder_id === r.folder_id &&
      rows[idx - 1].folder_name === r.folder_name &&
      (rows[idx - 1].subfolder_id || '') === (r.subfolder_id || '') &&
      (rows[idx - 1].subfolder_name || '') === (r.subfolder_name || '') &&
      (rows[idx - 1].pdf_name || '') === (r.pdf_name || '');

    return {
      folder_id: isSameParent ? '' : r.folder_id,
      subfolder_id: isSameParent ? '' : (r.subfolder_id || ''),
      folder_name: isSameParent ? '' : r.folder_name,
      subfolder_name: isSameParent ? '' : (r.subfolder_name || ''),
      pdf_name: isSameParent ? '' : (r.pdf_name || ''),
      section_id: getDisplaySectionId(r),
      title_name: getDisplaySectionTitle(r),
      title_page: getDisplaySectionPage(r),
      anusuchi_id: formatAnusuchiIdOnly(r.anusuchi_id),
      anusuchi_title: formatAnusuchiTitleClean(r.anusuchi_title),
      anusuchi_print_page: r.anusuchi_print_page || '',
      pdf_path: isSameParent ? '' : (r.pdf_path || ''),
      type: r.type || ''
    };
  });

  const payload = {
    total_records: rows.length,
    total_documents: mergedMap.size,
    merged_documents: Array.from(mergedMap.values()),
    merged_rows: flatMergedRows
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
