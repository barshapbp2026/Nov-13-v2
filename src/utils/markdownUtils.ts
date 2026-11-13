import { LegalRow, DocumentSummary } from '../types';

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
  const clean = s
    .toString()
    .replace(/[०-९]/g, d => String('०१२३४५६७८९'.indexOf(d)))
    .replace(/[^0-9]/g, '');
  return parseInt(clean, 10) || 1;
};

/**
 * Generates structured Markdown text for any legal document given its summary and row entries
 */
export function generateMarkdownForDoc(doc: DocumentSummary, rows: LegalRow[]): LegalMarkdownDoc {
  const docRows = rows.filter(r => r.pdf_name === doc.filename || r.pdf_path === doc.path);
  
  const sections = docRows.filter(r => r.section_id && r.title_name);
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
  md += `> - **🔗 रिपोजिटरी स्रोत:** [barshapbp2026/any-pdf-](https://github.com/barshapbp2026/any-pdf-)\n`;
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
      const pageStr = sch.anusuchi_print_page ? ` [पृष्ठ ${sch.anusuchi_print_page}]` : '';
      const itemTitle = `${sch.anusuchi_id}: ${sch.anusuchi_title}`;
      md += `${idx + 1}. [${itemTitle}](#sch-${sch.anusuchi_id.replace(/[^a-zA-Z0-9०-९]/g, '')})${pageStr}\n`;

      toc.push({
        id: `sch-${sch.anusuchi_id.replace(/[^a-zA-Z0-9०-९]/g, '')}`,
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
        md += `| **मूल PDF पृष्ठ (Page)** | **पृष्ठ ${s.title_page}** [🔗 PDF सिंक गर्नुहोस्](sync://${s.title_page}) |\n`;
      }
      md += `| **सम्बन्धित कागजात** | \`${doc.filename}\` |\n\n`;

      md += `> **नोट/विवरण:** यस ${typeLabel} सम्बन्धी पूर्ण कानूनी प्रावधान र उपदफाहरू मूल कागजातको पृष्ठ **${s.title_page || '१'}** मा विस्तृत रूपमा उल्लेख गरिएको छ। दायाँपट्टिको PDF भ्युअरमा सिधै हेर्न सिंक बटन थिच्नुहोस्।\n\n`;
    });
  }

  // Schedules
  if (schedules.length > 0) {
    md += `---\n\n`;
    md += `## अनुसूचीहरू (Schedules)\n\n`;
    schedules.forEach(sch => {
      const schAnchor = `sch-${sch.anusuchi_id.replace(/[^a-zA-Z0-9०-९]/g, '')}`;
      md += `<a id="${schAnchor}"></a>\n`;
      md += `### ${sch.anusuchi_id}: ${sch.anusuchi_title}\n\n`;
      md += `| विवरण | अनुसूची जानकारी |\n`;
      md += `| :--- | :--- |\n`;
      md += `| **अनुसूची नम्बर** | **${sch.anusuchi_id}** |\n`;
      md += `| **शीर्षक** | ${sch.anusuchi_title} |\n`;
      if (sch.anusuchi_print_page) {
        md += `| **PDF पृष्ठ (Print Page)** | **पृष्ठ ${sch.anusuchi_print_page}** [🔗 PDF सिंक गर्नुहोस्](sync://${sch.anusuchi_print_page}) |\n`;
      }
      md += `\n`;
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
