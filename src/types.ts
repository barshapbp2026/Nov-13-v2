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
  type?: string;                  // धारा | दफा | नियम | निर्देशन | बुँदा | अनुसूची | महल
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
