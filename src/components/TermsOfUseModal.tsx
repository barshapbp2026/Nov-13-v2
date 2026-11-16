import React, { useState } from 'react';
import { X, Scale, Copy, Check, ExternalLink } from 'lucide-react';
import { FontSizeControls } from './FontSizeControls';

interface TermsOfUseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PORTAL_NAME = 'नेपाली कानुनी दस्तावेजहरूको सङ्गालो';
const PORTAL_URL = 'https://ais-pre-vykruns5w23wo2q46u2oyh-337710253799.asia-southeast1.run.app';
const CONTACT_EMAIL = 'barshap.bp2026@gmail.com';

export const UNIQUE_TERMS_OF_USE_TEXT = `प्रयोगका शर्तहरू (Terms of Use)
अन्तिम अद्यावधिक मिति: मंसिर २०८३ (November 2026)

${PORTAL_NAME} (${PORTAL_URL}) मा तपाईंको स्वागत छ। यस पोर्टलमा प्रवेश गरेर, १०-स्तम्भ कानूनी तालिका, MD + PDF सिंक दृश्य, मूल PDF वा AI सारांश अध्ययन तथा प्रयोग गरेर तपाईंले तल उल्लेखित प्रयोगका शर्तहरू पालना गर्न सहमति जनाउनुभएको मानिनेछ। यदि तपाईं यी शर्तहरूसँग सहमत हुनुहुन्न भने कृपया यस पोर्टलको प्रयोग नगर्नुहोला।

१. पोर्टलको शैक्षिक उद्देश्य र खुला पहुँच (Educational Purpose & Open Access)
• यो पोर्टल सर्वसाधारण नागरिक, कानूनका विद्यार्थी, शोधकर्ता तथा अध्येताहरूका लागि नेपालको संविधान, ऐन, अध्यादेश, नियमावली, निर्देशिका र कार्यविधिहरू १–१२ फोल्डर तथा १०-स्तम्भ ढाँचामा एकैठाउँमा खोज्न र अध्ययन गर्न सहज बनाउने उद्देश्यले तयार पारिएको हो।
• यहाँ उपलब्ध कानूनी अभिलेख, पृष्ठ-सिंक दृश्य र सार्वजनिक दफा/PDF सारांशहरू निःशुल्क अध्ययन र अनुसन्धान प्रयोजनका लागि उपलब्ध छन्; पाठकबाट कुनै प्रत्यक्ष शुल्क लिइँदैन।

२. आधिकारिक सरकारी स्रोतहरू (Official Sources)
यस पोर्टलमा संकलित कानूनी दस्तावेज र सन्दर्भ सामग्रीहरू नेपालका आधिकारिक सार्वजनिक निकायका पोर्टलहरूबाट साभार गरिएका हुन्:
• नेपाल कानून आयोग (https://lawcommission.gov.np): संविधान, ऐन, अध्यादेश, नियमावली तथा गठन आदेशहरू।
• नेपाल राजपत्र / मुद्रण विभाग (http://dop.gov.np): राजपत्रमा प्रकाशित सूचना तथा प्रमाणित पाठहरू।
• सर्वोच्च अदालत (https://supremecourt.gov.np): अदालतका फैसला, नजिर तथा कानूनी प्रकाशन सन्दर्भ।

३. निषेधित कार्य र दुरुपयोग रोकथाम (Prohibited Uses & Anti-Misuse)
यस पोर्टलका PDF, दफा विवरण वा सारांश प्रयोग गर्दा निम्न कार्यहरू पूर्णतः वर्जित छन्:
• कीर्ते र अनधिकृत फेरबदल: संकलित ऐन, नियम, राजपत्र वा फैसलाको मूल पाठ, दफा संख्या वा अर्थमा अनधिकृत तोडमोड, नक्कली दस्तावेज निर्माण वा कीर्ते (Forgery) गर्नु।
• अनधिकृत व्यावसायिक बिक्री: यस पोर्टलबाट निःशुल्क प्राप्त सामग्री वा संकलित संरचनालाई शुल्क लिएर पुनः बिक्री गर्नु वा भ्रामक व्यावसायिक प्रयोजनमा प्रयोग गर्नु।
• प्रणालीमा अवरोध र बोट आक्रमण: API वा सर्भरमा अत्यधिक भार पार्ने गरी स्वचालित Scraper, Bot, Brute-force वा साइबर आक्रमण गर्नु। यस्ता कार्य नेपालको विद्युतीय कारोबार ऐन, २०६३ बमोजिम दण्डनीय हुनेछन्।
• गोपनीयता उल्लंघन: संवेदनशील कानूनी प्रकरणमा गोप्य राखिनुपर्ने पीडित वा पक्षको पहिचान खुलाउने वा दुष्प्रचार गर्ने कार्य गर्नु।

४. कानूनी सल्लाह नभएको स्पष्टीकरण (No Formal Legal Advice)
• यस पोर्टलका तालिका, पृष्ठ नक्साङ्कन र Gemini AI बाट तयार पारिएका दफा/PDF सारांशहरू केवल शैक्षिक तथा सामान्य जानकारीका लागि मात्र हुन्।
• यो पोर्टल इजाजतपत्र प्राप्त अधिवक्ता, ल फर्म वा औपचारिक कानूनी सल्लाहकार होइन। वास्तविक मुद्दा, जग्गा/मालपोत विवाद वा कानूनी निर्णयका लागि योग्य कानून व्यवसायीसँग प्रत्यक्ष परामर्श लिनुहोला।

५. अस्वीकरण, डेटा सीमा र अन्तिम प्रमाण (Disclaimer & Authoritative Proof)
• यो वेबसाइट नेपाल सरकार, नेपाल कानून आयोग, मुद्रण विभाग वा सर्वोच्च अदालतको आधिकारिक पोर्टल होइन।
• प्राविधिक रूपान्तरण (जस्तै Preeti/स्क्यान गरिएको PDF बाट पृष्ठ मिलान वा सारांश निर्माण) का क्रममा कतै टङ्कण वा पृष्ठ क्रमको त्रुटि रहन सक्ने भएकाले त्यसबाट उत्पन्न हुने कुनै पनि क्षतिका लागि पोर्टल सञ्चालक उत्तरदायी हुने छैन।
• आधिकारिक कानूनी विवाद वा अदालती प्रयोजनका लागि सम्बन्धित सरकारी निकायको आधिकारिक वेबसाइट वा नेपाल राजपत्रमा प्रकाशित सक्कल प्रतिलाई नै अन्तिम र प्रमाणित आधार मान्नुपर्नेछ।

६. प्रशासकीय अधिकार तथा प्रचलित नेपाल कानून (Governing Law)
मास्टर डेटाबेस अद्यावधिक र बल्क निर्यात अधिकार अधिकृत सञ्चालकमा सीमित छ र पोर्टल आवश्यकतानुसार अद्यावधिक वा परिमार्जन हुन सक्नेछ। यी शर्तहरूको व्याख्या नेपालको प्रचलित कानून—विशेषतः विद्युतीय कारोबार ऐन, २०६३, प्रतिलिपि अधिकार ऐन, २०५९, वैयक्तिक गोपनीयता सम्बन्धी ऐन, २०७५ तथा मुलुकी अपराध संहिता, २०७४ बमोजिम हुनेछ।

७. त्रुटि सुधार र सम्पर्क (Corrections & Contact)
कुनै दस्तावेजको पृष्ठ मिलान, दफा विवरण वा सारांशमा त्रुटि भेटिएमा वा आधिकारिक स्रोतअनुसार सच्याउन/हटाउन अनुरोध गर्नुपरेमा प्रमाणसहित सम्पर्क गर्नुहोस्:
• इमेल: ${CONTACT_EMAIL}
• पोर्टल: ${PORTAL_URL}`;

export const TermsOfUseModal: React.FC<TermsOfUseModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(UNIQUE_TERMS_OF_USE_TEXT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-5"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-base sm:text-lg truncate">
                प्रयोगका शर्तहरू (Terms of Use)
              </h3>
              <p className="text-xs text-slate-300 truncate">
                अन्तिम अद्यावधिक: मंसिर २०८३ (२०२६) • {PORTAL_NAME}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <FontSizeControls variant="dark" />
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="बन्द गर्नुहोस्"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-sm text-slate-700 leading-relaxed font-['Mukta','Noto_Sans_Devanagari',sans-serif]">
          <div className="rounded-xl bg-amber-50/80 border border-amber-200 p-4 text-xs sm:text-sm text-slate-800 space-y-1.5">
            <p className="font-bold text-amber-950">{PORTAL_NAME}</p>
            <p>
              <strong>पोर्टल ठेगाना:</strong>{' '}
              <a
                href={PORTAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-700 hover:underline break-all"
              >
                {PORTAL_URL}
              </a>
            </p>
            <p className="text-slate-600">
              यस पोर्टलमा प्रवेश गरेर, १०-स्तम्भ कानूनी तालिका, मूल PDF वा AI सारांश अध्ययन तथा
              प्रयोग गरेर तपाईंले तल उल्लेखित प्रयोगका शर्तहरूमा सहमति जनाउनुभएको मानिनेछ।
            </p>
          </div>

          <section className="space-y-1.5">
            <h4 className="font-bold text-slate-900 text-base">
              १. पोर्टलको शैक्षिक उद्देश्य र निःशुल्क खुला पहुँच
            </h4>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                यो प्लेटफर्म सर्वसाधारण, विद्यार्थी, शोधकर्ता तथा अध्येताहरूका लागि नेपालको
                संविधान, ऐन, अध्यादेश, नियमावली, निर्देशिका र कार्यविधिहरू १–१२ फोल्डर तथा
                १०-स्तम्भ ढाँचामा एकैठाउँमा खोज्न र अध्ययन गर्न सहज बनाउने उद्देश्यले तयार
                पारिएको हो।
              </li>
              <li>
                पोर्टलमा उपलब्ध कानूनी विवरण, MD + PDF सिंक दृश्य र पूर्व-सञ्चित सारांशहरू
                पूर्ण रूपमा निःशुल्क अध्ययन र अनुसन्धानका लागि खुला छन्।
              </li>
            </ul>
          </section>

          <section className="space-y-1.5">
            <h4 className="font-bold text-slate-900 text-base">
              २. आधिकारिक सरकारी स्रोतहरू
            </h4>
            <p>
              यस पोर्टलमा संकलित कानूनी दस्तावेजहरू नेपालका निम्नलिखित आधिकारिक निकायका
              सार्वजनिक वेबसाइटमा आधारित छन्:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <a
                  href="https://lawcommission.gov.np"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-700 font-semibold hover:underline inline-flex items-center gap-0.5"
                >
                  नेपाल कानून आयोग (lawcommission.gov.np) <ExternalLink className="w-3 h-3" />
                </a>{' '}
                — संविधान, ऐन, अध्यादेश, नियमावली तथा गठन आदेशहरू।
              </li>
              <li>
                <a
                  href="http://dop.gov.np"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-700 font-semibold hover:underline inline-flex items-center gap-0.5"
                >
                  नेपाल राजपत्र / मुद्रण विभाग (dop.gov.np) <ExternalLink className="w-3 h-3" />
                </a>{' '}
                — राजपत्रमा प्रकाशित प्रमाणित सूचना तथा पाठहरू।
              </li>
              <li>
                <a
                  href="https://supremecourt.gov.np"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-700 font-semibold hover:underline inline-flex items-center gap-0.5"
                >
                  सर्वोच्च अदालत (supremecourt.gov.np) <ExternalLink className="w-3 h-3" />
                </a>{' '}
                — सर्वोच्च अदालतका फैसला तथा नजिर सन्दर्भ।
              </li>
            </ul>
          </section>

          <section className="space-y-1.5">
            <h4 className="font-bold text-slate-900 text-base">
              ३. निषेधित कार्य र दुरुपयोग चेतावनी (Anti-Misuse Policy)
            </h4>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>दस्तावेज तोडमोड र कीर्ते:</strong> संकलित ऐन, नियम, राजपत्र वा
                फैसलाको मूल भाषा, दफा संख्या वा अर्थमा अनधिकृत हेरफेर, नक्कली दस्तावेज तयार
                पार्ने वा कीर्ते (Forgery) गर्ने कार्य पूर्ण निषेध छ।
              </li>
              <li>
                <strong>अनधिकृत व्यावसायिक बेचबिखन:</strong> यस पोर्टलबाट निःशुल्क प्राप्त
                सार्वजनिक सरकारी दस्तावेज वा संकलित संरचनालाई शुल्क लिएर बिक्री गर्नु वा
                गलत व्यावसायिक लाभका लागि दुरुपयोग गर्नु वर्जित छ।
              </li>
              <li>
                <strong>प्रणालीमा अवरोध (Scraping / Cyber Attack):</strong> सर्भर वा API
                मा अनावश्यक भार पार्ने स्वचालित Bot, Scraper वा साइबर आक्रमण गर्नु नेपालको
                विद्युतीय कारोबार ऐन, २०६३ अन्तर्गत दण्डनीय हुनेछ।
              </li>
              <li>
                <strong>गोपनीयता भङ्ग:</strong> अदालत वा कानूनले गोप्य राखेका पीडित वा
                पक्षहरूको पहिचान खुलाउने वा दुष्प्रचार गर्ने कार्य निषेध छ।
              </li>
            </ul>
          </section>

          <section className="space-y-1.5">
            <h4 className="font-bold text-slate-900 text-base">
              ४. कानूनी सल्लाह नभएको स्पष्टीकरण (No Legal Advice)
            </h4>
            <p>
              यस पोर्टलमा उपलब्ध कानूनी विवरण, १०-स्तम्भ डेटा र Gemini AI बाट तयार सारांशहरू
              केवल शैक्षिक, अनुसन्धान र सामान्य जानकारीका लागि मात्र हुन्। यो वेबसाइट कुनै
              अधिवक्ता, ल फर्म वा औपचारिक कानूनी सल्लाहकार होइन; व्यक्तिगत वा मुद्दा-मामिलासम्बन्धी
              निर्णयका लागि इजाजतपत्र प्राप्त कानून व्यवसायीसँग परामर्श लिनुहोला।
            </p>
          </section>

          <section className="space-y-1.5">
            <h4 className="font-bold text-slate-900 text-base">
              ५. अस्वीकरण, दायित्वको सीमा तथा प्रचलित कानून
            </h4>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                यो वेबसाइट नेपाल सरकार, नेपाल कानून आयोग, मुद्रण विभाग वा सर्वोच्च अदालतको
                आधिकारिक पोर्टल होइन।
              </li>
              <li>
                <strong>अन्तिम आधिकारिक प्रमाण:</strong> प्राविधिक प्रशोधन वा पृष्ठ मिलानमा
                कुनै त्रुटि भेटिएमा त्यसबाट हुने क्षतिका लागि सञ्चालक उत्तरदायी हुने छैन;
                आधिकारिक कानूनी प्रयोजन वा विवादमा सम्बन्धित निकायको वेबसाइट वा नेपाल राजपत्रमा
                प्रकाशित सक्कल प्रति नै मान्य हुनेछ।
              </li>
              <li>
                <strong>प्रचलित कानून:</strong> यी शर्तहरूको व्याख्या नेपालको विद्युतीय कारोबार
                ऐन, २०६३, प्रतिलिपि अधिकार ऐन, २०५९, वैयक्तिक गोपनीयता सम्बन्धी ऐन, २०७५ र
                मुलुकी अपराध संहिता, २०७४ बमोजिम हुनेछ।
              </li>
            </ul>
          </section>

          <section className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-1">
            <h4 className="font-bold text-slate-900 text-sm">
              ६. त्रुटि सुधार तथा सम्पर्क (Contact)
            </h4>
            <p className="text-xs sm:text-sm">
              कुनै दस्तावेजको विवरण सच्याउन, अद्यावधिक गर्न वा कानूनी अनुरोध पठाउन प्रमाणसहित
              सम्पर्क गर्नुहोस्:{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-semibold text-indigo-700 hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between gap-2 text-xs">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">कपी भयो!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>पूर्ण शर्तहरू कपी गर्नुहोस्</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold cursor-pointer"
          >
            बन्द गर्नुहोस्
          </button>
        </div>
      </div>
    </div>
  );
};
