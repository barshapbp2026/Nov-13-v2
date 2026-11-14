import { LegalRow, DocumentSummary, StoredDafaSummaryRecord } from '../types';
import { toPhysicalPdfPage } from './pdfPageMap';
import { isAnusuchiRow, formatAnusuchiIdOnly, formatAnusuchiTitleClean } from './urlUtils';
import { buildDafaSummaryDocId } from '../services/firestoreSummaryStore';

export interface LegalMarkdownDoc {
  id: string;
  filename: string;
  title: string;
  folderName: string;
  pdfPath: string;
  markdownContent: string;
  totalSections: number;
  totalSchedules: number;
  toc: Array<{
    id: string;
    title: string;
    page: string;
    type: string;
  }>;
}

/**
 * Converts English digits to Devanagari numerals
 */
export const toDeva = (n: number | string): string => {
  if (n === null || n === undefined || n === '') return '';
  return n.toString().replace(/[0-9]/g, d => '०१२३४५६७८९'[parseInt(d, 10)]);
};

/**
 * Converts Devanagari numerals to English digits
 */
export const devaToNum = (s: string | number): number => {
  if (!s) return 1;
  let str = s.toString();
  try {
    if (str.includes('%')) {
      str = decodeURIComponent(str);
    }
  } catch {
    // keep raw string if malformed URI sequence
  }
  const ascii = str.replace(/[०-९]/g, d => String('०१२३४५६७८९'.indexOf(d)));
  const match = ascii.match(/[0-9]+/);
  return match ? Math.max(1, parseInt(match[0], 10)) : 1;
};

/**
 * Generates structured Markdown text for any legal document given its summary and row entries
 */
export function generateMarkdownForDoc(
  doc: DocumentSummary,
  rows: LegalRow[],
  cachedDafaMap?: Map<string, StoredDafaSummaryRecord>
): LegalMarkdownDoc {
  const docRows = rows.filter(r => r.pdf_name === doc.filename || r.pdf_path === doc.path);
  
  const sections = docRows.filter(r => r.section_id && r.title_name && !isAnusuchiRow(r));
  const schedules = docRows.filter(r => r.anusuchi_id && r.anusuchi_title);

  const cleanDocTitle = doc.filename.replace(/\.pdf$/i, '');
  const isConst = doc.filename.includes('संबिधान') || doc.filename.includes('संविधान');

  const toc: Array<{ id: string; title: string; page: string; type: string }> = [];

  let md = '';
  md += `# ${cleanDocTitle}\n\n`;
  md += `> **कानूनी दस्तावेज विवरण (Legal Document Metadata)**\n`;
  md += `> - **📁 मूल फोल्डर:** ${doc.folderName}\n`;
  if (doc.subfolderName) {
    md += `> - **📂 सब-फोल्डर:** ${doc.subfolderName}\n`;
  }
  md += `> - **📄 मूल PDF फाइल:** \`${doc.filename}\`\n`;
  md += `> - **🔗 स्रोत:** नेपाल कानून, संबिधान र मुलुकी संहिता डेटा पोर्टल\n`;
  md += `> - **📊 प्रमाणीकरण:** कुल ${toDeva(sections.length)} धारा/दफा/बुँदा र ${toDeva(schedules.length)} अनुसूचीहरू\n\n`;
  md += `---\n\n`;

  // Table of Contents
  md += `## विषय-सूची (Table of Contents)\n\n`;
  if (sections.length > 0) {
    md += `### मुख्य प्रावधानहरू (${toDeva(sections.length)} वटा)\n`;
    sections.forEach((s, idx) => {
      const pageStr = s.title_page ? ` [पृष्ठ ${s.title_page}]` : '';
      const typeLabel = s.type || (isConst ? 'धारा' : 'दफा');
      const itemTitle = s.title_name || `${typeLabel} ${s.section_id}`;
      md += `${idx + 1}. [${itemTitle}](#sec-${s.section_id.replace(/[^a-zA-Z0-9०-९]/g, '')})${pageStr}\n`;
      
      toc.push({
        id: `sec-${s.section_id.replace(/[^a-zA-Z0-9०-९]/g, '')}`,
        title: itemTitle,
        page: s.title_page || '1',
        type: typeLabel,
      });
    });
    md += `\n`;
  }

  if (schedules.length > 0) {
    md += `### अनुसूचीहरू (${toDeva(schedules.length)} वटा)\n`;
    schedules.forEach((sch, idx) => {
      const aid = formatAnusuchiIdOnly(sch.anusuchi_id);
      const atitle = formatAnusuchiTitleClean(sch.anusuchi_title);
      const pageStr = sch.anusuchi_print_page ? ` [पृष्ठ ${sch.anusuchi_print_page}]` : '';
      const itemTitle = `${aid}: ${atitle}`;
      md += `${idx + 1}. [${itemTitle}](#sch-${aid.replace(/[^a-zA-Z0-9०-९]/g, '')})${pageStr}\n`;

      toc.push({
        id: `sch-${aid.replace(/[^a-zA-Z0-9०-९]/g, '')}`,
        title: itemTitle,
        page: sch.anusuchi_print_page || '1',
        type: 'अनुसूची',
      });
    });
    md += `\n`;
  }

  md += `---\n\n`;

  // Body content: Sections
  if (sections.length > 0) {
    md += `## कानूनी दफा/धारा तथा प्रावधान विवरण\n\n`;
    sections.forEach(s => {
      const typeLabel = s.type || (isConst ? 'धारा' : 'दफा');
      const secAnchor = `sec-${s.section_id.replace(/[^a-zA-Z0-9०-९]/g, '')}`;
      md += `<a id="${secAnchor}"></a>\n`;
      md += `### ${s.title_name || `${typeLabel} ${s.section_id}`}\n\n`;
      md += `| विवरण | कानूनी जानकारी |\n`;
      md += `| :--- | :--- |\n`;
      md += `| **प्रकार (Type)** | \`${typeLabel}\` |\n`;
      md += `| **क्रम संख्या (ID)** | **${s.section_id}** |\n`;
      if (s.title_page) {
        const asciiPage = devaToNum(s.title_page);
        const physicalPage = toPhysicalPdfPage(doc.path, asciiPage);
        const pageLabel =
          physicalPage !== asciiPage
            ? `पृष्ठ ${s.title_page} (PDF पृष्ठ ${toDeva(physicalPage)})`
            : `पृष्ठ ${s.title_page}`;
        const syncHint = encodeURIComponent(`${s.section_id} ${s.title_name || ''}`.trim());
        md += `| **मूल PDF पृष्ठ (Page)** | **${pageLabel}** [🔗 PDF सिंक गर्नुहोस्](sync://${asciiPage}?q=${syncHint}) |\n`;
      }
      md += `\n`;

      const dafaSummary = cachedDafaMap?.get(buildDafaSummaryDocId(s));
      const summaryText = dafaSummary?.summaryNepali?.trim() || '';
      if (summaryText) {
        const obligationsText =
          dafaSummary?.keyObligations && dafaSummary.keyObligations.length > 0
            ? '\n> ' + dafaSummary.keyObligations.filter(Boolean).map(item => `• ${item.trim()}`).join('\n> ')
            : '';
        md += `> **नोट/विवरण:** ${summaryText}${obligationsText}\n\n`;
      } else {
        md += `> **नोट/विवरण:**\n\n`;
      }
    });
  }

  // Schedules
  if (schedules.length > 0) {
    md += `---\n\n`;
    md += `## अनुसूचीहरू (Schedules)\n\n`;
    schedules.forEach(sch => {
      const aid = formatAnusuchiIdOnly(sch.anusuchi_id);
      const atitle = formatAnusuchiTitleClean(sch.anusuchi_title);
      const schAnchor = `sch-${aid.replace(/[^a-zA-Z0-9०-९]/g, '')}`;
      md += `<a id="${schAnchor}"></a>\n`;
      md += `### ${aid}: ${atitle}\n\n`;
      md += `| विवरण | अनुसूची जानकारी |\n`;
      md += `| :--- | :--- |\n`;
      md += `| **अनुसूची नम्बर** | **${aid}** |\n`;
      md += `| **शीर्षक** | ${atitle} |\n`;
      if (sch.anusuchi_print_page) {
        const asciiPage = devaToNum(sch.anusuchi_print_page);
        const physicalPage = toPhysicalPdfPage(doc.path, asciiPage);
        const pageLabel =
          physicalPage !== asciiPage
            ? `पृष्ठ ${sch.anusuchi_print_page} (PDF पृष्ठ ${toDeva(physicalPage)})`
            : `पृष्ठ ${sch.anusuchi_print_page}`;
        const syncHint = encodeURIComponent(`${aid} ${atitle || ''}`.trim());
        md += `| **PDF पृष्ठ (Print Page)** | **${pageLabel}** [🔗 PDF सिंक गर्नुहोस्](sync://${asciiPage}?q=${syncHint}) |\n`;
      }
      md += `\n`;
      const schSummary = cachedDafaMap?.get(buildDafaSummaryDocId(sch));
      if (schSummary?.summaryNepali?.trim()) {
        md += `> **नोट/विवरण:** ${schSummary.summaryNepali.trim()}\n\n`;
      }
    });
  }

  return {
    id: doc.path,
    filename: doc.filename,
    title: cleanDocTitle,
    folderName: doc.folderName,
    pdfPath: doc.path,
    markdownContent: md,
    totalSections: sections.length,
    totalSchedules: schedules.length,
    toc,
  };
}
