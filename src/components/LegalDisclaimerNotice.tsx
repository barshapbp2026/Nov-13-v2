import React from 'react';
import { ShieldAlert, ExternalLink, Scale, Info } from 'lucide-react';
import type { PdfSummaryLanguage } from '../types';

export const LEGAL_DISCLAIMER_MARKDOWN_NE = `---
**स्रोत, चेतावनी तथा अस्वीकरण (Source, Warning & Disclaimer):**
- **स्रोत:** नेपाल कानून आयोग (**lawcommission.gov.np**), नेपाल राजपत्र (**dop.gov.np**) तथा सर्वोच्च अदालत (**supremecourt.gov.np**)।
- **गलत प्रयोग नगर्ने चेतावनी:** यी दस्तावेजहरू सर्वसाधारणको अध्ययन, अनुसन्धान र सामान्य जानकारीका लागि मात्र निःशुल्क उपलब्ध गराइएका हुन्। कृपया यी सरकारी तथा कानूनी दस्तावेजहरूको गलत प्रयोग, अनधिकृत फेरबदल, कीर्ते वा व्यावसायिक दुरुपयोग नगर्नुहोला।
- **अस्वीकरण:** यस प्लेटफर्ममा उपलब्ध कानूनी दस्तावेज तथा सारांशहरू केवल शैक्षिक तथा अध्ययन प्रयोजनका लागि मात्र हुन्। आधिकारिक कानूनी प्रयोजनका लागि मूल सरकारी स्रोत वा नेपाल राजपत्र नै मान्य हुनेछ। (यो वेबसाइट नेपाल सरकार, नेपाल कानून आयोग, मुद्रण विभाग वा सर्वोच्च अदालतको आधिकारिक पोर्टल होइन।)
---`;

export const LEGAL_DISCLAIMER_MARKDOWN_EN = `---
**Source, Warning & Disclaimer:**
- **Official Sources:** Nepal Law Commission (**lawcommission.gov.np**), Nepal Rajpatra / Department of Printing (**dop.gov.np**), and the Supreme Court of Nepal (**supremecourt.gov.np**).
- **Anti-Misuse Warning:** These documents and summaries are provided free of charge strictly for public study, research, and general legal awareness. Do not falsify, alter, forge, or misuse these government and legal documents for fraudulent or unlawful purposes.
- **Disclaimer:** Legal documents and summaries on this platform are strictly for educational and study purposes only. For official legal purposes, the original government source or Nepal Rajpatra shall be authoritative. (This is not an official portal of the Government of Nepal, Nepal Law Commission, Department of Printing, or Supreme Court of Nepal.)
---`;

interface LegalDisclaimerNoticeProps {
  language?: PdfSummaryLanguage;
  variant?: 'full' | 'compact' | 'dark';
  className?: string;
}

const OFFICIAL_PORTALS = [
  {
    nameNe: 'नेपाल कानून आयोग',
    nameEn: 'Nepal Law Commission',
    label: 'lawcommission.gov.np',
    href: 'https://lawcommission.gov.np',
  },
  {
    nameNe: 'नेपाल राजपत्र',
    nameEn: 'Nepal Rajpatra',
    label: 'dop.gov.np',
    href: 'http://dop.gov.np',
  },
  {
    nameNe: 'सर्वोच्च अदालत',
    nameEn: 'Supreme Court of Nepal',
    label: 'supremecourt.gov.np',
    href: 'https://supremecourt.gov.np',
  },
];

export const LegalDisclaimerNotice: React.FC<LegalDisclaimerNoticeProps> = ({
  language = 'ne',
  variant = 'compact',
  className = '',
}) => {
  const isEnglish = language === 'en';

  if (variant === 'dark') {
    return (
      <div
        className={`bg-slate-900/95 border-t border-slate-700/80 px-4 py-2 text-[11px] text-slate-300 flex flex-wrap items-center justify-between gap-2 ${className}`}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1 font-semibold text-amber-300">
            <Scale className="w-3.5 h-3.5 shrink-0" />
            <span>स्रोत:</span>
          </span>
          {OFFICIAL_PORTALS.map((p, idx) => (
            <React.Fragment key={p.href}>
              <a
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200 hover:underline"
              >
                <span>{p.nameNe}</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
              {idx < OFFICIAL_PORTALS.length - 1 && <span className="text-slate-600">•</span>}
            </React.Fragment>
          ))}
        </div>
        <span className="text-slate-400">
          अस्वीकरण: केवल शैक्षिक तथा अध्ययन प्रयोजनका लागि मात्र; आधिकारिक प्रयोजनका लागि मूल सरकारी स्रोत वा नेपाल राजपत्र नै मान्य हुनेछ।
        </span>
      </div>
    );
  }

  if (variant === 'full') {
    return (
      <section
        aria-label="कानुनी सूचना तथा अस्वीकरण"
        className={`bg-slate-950 border-b border-slate-800 text-slate-100 ${className}`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 space-y-3 text-left">
          {/* Source & Purpose Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2.5 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-amber-300 shrink-0" />
              <span className="text-xs sm:text-sm font-bold tracking-wide text-amber-300">
                शैक्षिक प्रयोजन तथा सार्वजनिक कानुनी जानकारी सूचना
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-300">
              <span className="font-semibold text-slate-400">आधिकारिक स्रोत:</span>
              {OFFICIAL_PORTALS.map((p, idx) => (
                <React.Fragment key={p.href}>
                  <a
                    href={p.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-amber-300 hover:text-amber-200 hover:underline"
                  >
                    <span>{p.nameNe}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  {idx < OFFICIAL_PORTALS.length - 1 && <span className="text-slate-600">·</span>}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Catchy & Bold Main Disclaimer Body */}
          <p className="text-[13.5px] sm:text-[15px] font-bold leading-relaxed text-slate-100">
            यी दस्तावेजहरू शैक्षिक तथा सर्वसाधारणलाई कानुनी जानकारी प्रदान गर्नका लागि मात्र नेपाल कानुन आयोग, मुद्रण विभाग (नेपाल राजपत्र) र सर्वोच्च अदालतको आधिकारिक वेबसाइटलाई स्रोत मानी सार्वजनिक रूपमा प्रकाशित भइसकेका संविधान, ऐन, अध्यादेश, नियम, नियमावली, कार्यविधि, अदालतका फैसला र नजिरहरू म्यानुअल डाउनलोड (Manual Download) गरी निःशुल्क र हुबहु राखिएको हो। सरकारी निकायको सम्मान स्वरूप यसमा कुनै प्रतिवेदन, अनुसन्धान वा लेख–रचना आदि समावेश गरिएको छैन। प्राविधिक कारणवश कुनै दस्तावेजको नयाँ संस्करण वा संशोधन अद्यावधिक (Update) गर्न ढिलाइ भएमा वा कुनै त्रुटि भेटिएमा यथाशीघ्र सच्याइने वा हटाइनेछ। उक्त कार्यमा सम्पर्क गरी जानकारी गराएर सहयोग गरिदिनुहुन अनुरोध गरिन्छ। साथै, यी सामग्रीका आधारमा कुनै कानुनी विवाद उत्पन्न भएमा यो वेबसाइट जवाफदेही हुने छैन। आधिकारिक संस्करण, दस्तावेज वा कानुनी परामर्शका लागि सम्बन्धित निकायमा सम्पर्क गर्नुहुन वा नेपाल कानुन आयोग, मुद्रण विभाग तथा सम्बन्धित आधिकारिक वेबसाइटबाट जानकारी लिनुहुन अनुरोध गरिन्छ।
          </p>

          {/* Highlighted Postscript Warning */}
          <div className="rounded-lg border border-amber-400/35 bg-amber-950/50 px-3.5 py-2.5 flex items-start gap-2.5">
            <ShieldAlert className="w-4.5 h-4.5 text-amber-300 shrink-0 mt-0.5" />
            <p className="text-[13px] sm:text-[14px] font-extrabold leading-relaxed text-amber-200">
              पुनश्च: यी दस्तावेजहरू सार्वजनिक सम्पत्ति भएकाले यिनको दुरुपयोग गर्नु दण्डनीय अपराध हो। तसर्थ, यिनलाई शैक्षिक प्रयोजनका लागि मात्र प्रयोग गर्नुहोला।
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div
      className={`rounded-xl border border-amber-200/90 bg-amber-50/70 text-slate-800 p-3.5 text-xs space-y-2.5 text-left ${className}`}
    >
      <div className="flex items-center gap-2 font-bold text-amber-950">
        <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
        <span>
          {isEnglish
            ? 'Source, Warning & Disclaimer'
            : 'स्रोत, चेतावनी तथा अस्वीकरण (Source, Warning & Disclaimer)'}
        </span>
      </div>

      <ul className="space-y-1.5 leading-relaxed text-slate-700">
        <li className="flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <strong className="text-slate-900">
              {isEnglish ? 'Source:' : 'स्रोत:'}
            </strong>
            {OFFICIAL_PORTALS.map((p, idx) => (
              <React.Fragment key={p.href}>
                <a
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 font-semibold text-indigo-700 hover:text-indigo-900 hover:underline"
                >
                  <span>{isEnglish ? p.nameEn : p.nameNe}</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
                {idx === 0 ? ', ' : idx === 1 ? (isEnglish ? ', and ' : ' तथा ') : '।'}
              </React.Fragment>
            ))}
          </div>
        </li>

        <li className="flex items-start gap-2">
          <Scale className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <strong className="text-slate-900">
              {isEnglish ? 'Disclaimer: ' : 'अस्वीकरण: '}
            </strong>
            {isEnglish
              ? 'Legal documents and summaries available on this platform are strictly for educational and study purposes only. For official legal purposes, the original government source or Nepal Rajpatra shall be authoritative.'
              : 'यस प्लेटफर्ममा उपलब्ध कानूनी दस्तावेज तथा सारांशहरू केवल शैक्षिक तथा अध्ययन प्रयोजनका लागि मात्र हुन्। आधिकारिक कानूनी प्रयोजनका लागि मूल सरकारी स्रोत वा नेपाल राजपत्र नै मान्य हुनेछ।'}
          </div>
        </li>

        <li className="flex items-start gap-2">
          <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <strong className="text-slate-900">
              {isEnglish ? 'Warning: ' : 'पुनश्च / चेतावनी: '}
            </strong>
            {isEnglish
              ? 'Do not falsify, alter, forge, or commercially misuse these government and legal documents.'
              : 'यी दस्तावेजहरू सार्वजनिक सम्पत्ति भएकाले यिनको दुरुपयोग गर्नु दण्डनीय अपराध हो। तसर्थ, यिनलाई शैक्षिक प्रयोजनका लागि मात्र प्रयोग गर्नुहोला।'}
          </div>
        </li>
      </ul>
    </div>
  );
};

