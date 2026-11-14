export interface LegalRow {
  folder_id: string;              // १. Folder ID
  subfolder_id: string;           // २. Subfolder ID
  folder_name: string;            // ३. Folder Name
  subfolder_name: string;         // ४. Subfolder Name
  section_id: string;             // ५. धारा/दफा/नियम/निर्देशन/बुँदा ID
  title_name: string;             // ६. धारा/दफा/नियम/निर्देशन/बुँदा Title Name
  title_page: string;             // ७. Title Page
  anusuchi_id: string;            // ८. अनुसूची ID
  anusuchi_title: string;         // ९. अनुसूची Title
  anusuchi_print_page: string;    // १०. अनुसूची Print Page
  pdf_name: string;               // PDF Name
  pdf_path: string;               // PDF Path
  type?: string;                  // धारा | दफा | नियम | निर्देशन | बुँदा | अनुसूची | महल | संशोधन
  legal_style?: 'bold_and_underline' | 'underline_only' | 'bold_only' | 'regular';
  sn?: string;
  order_index?: number;
}

export interface DocumentSummary {
  path: string;
  folderId: string;
  folderName: string;
  subfolderId: string;
  subfolderName: string;
  filename: string;
  size: number;
  category: string;
  totalSections: number;
  totalSchedules: number;
  totalRows: number;
}

export type PdfSummaryMode = 'executive' | 'sections' | 'compliance' | 'page_range';
export type PdfSummaryLanguage = 'ne' | 'en' | 'bilingual';

export interface PdfSummaryRequest {
  pdfPath: string;
  mode?: PdfSummaryMode;
  language?: PdfSummaryLanguage;
  startPage?: number;
  endPage?: number;
  customQuestion?: string;
}

export interface PdfSummarySectionItem {
  reference: string;
  title: string;
  summary: string;
  page: string;
}

export interface PdfSummaryResult {
  documentTitle: string;
  overview: string;
  keyPoints: string[];
  importantSections: PdfSummarySectionItem[];
  complianceAndDeadlines: string[];
  schedulesOverview: string[];
  customAnswer?: string;
  totalPages: number;
  analyzedRange: string;
  inputMethod: 'pdf-multimodal' | 'files-api' | 'text-extracted';
  modelUsed: string;
}

export interface StoredPdfSummaryRecord extends PdfSummaryResult {
  docId: string;
  isPublic: boolean;
  pdfPath: string;
  pdfName: string;
  folderId: string;
  folderName: string;
  mode: PdfSummaryMode;
  language: PdfSummaryLanguage;
  fileSizeBytes: number;
  updatedByUid: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface DafaSummaryItem {
  docId: string;
  pdfPath: string;
  pdfName: string;
  folderId: string;
  sectionId: string;
  titleName: string;
  titlePage: string;
  recordType: string;
  anusuchiId: string;
  anusuchiTitle: string;
  summaryNepali: string;
  keyObligations: string[];
  modelUsed: string;
}

export interface StoredDafaSummaryRecord extends DafaSummaryItem {
  isPublic: boolean;
  updatedByUid: string;
  createdAt?: any;
  updatedAt?: any;
}
