import React, { useState } from 'react';
import { X, ShieldCheck, Copy, Check, ExternalLink } from 'lucide-react';
import { FontSizeControls } from './FontSizeControls';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PORTAL_NAME = 'नेपाल कानून, संबिधान र मुलुकी संहिता १०-स्तम्भ डेटा पोर्टल';
const PORTAL_URL = 'https://ais-pre-vykruns5w23wo2q46u2oyh-337710253799.asia-southeast1.run.app';
const CONTACT_EMAIL = 'barshap.bp2026@gmail.com';

export const UNIQUE_PRIVACY_POLICY_TEXT = `गोपनीयता नीति (Privacy Policy)
अन्तिम अद्यावधिक: मंसिर २०८३ (November 2026)

${PORTAL_NAME} (${PORTAL_URL}) मा तपाईंको स्वागत छ। नेपालका संवैधानिक, कानूनी तथा प्रशासनिक दस्तावेजहरूलाई सर्वसाधारणको सहज अध्ययन र अनुसन्धानका लागि खुला राख्दै प्रयोगकर्ताको डिजिटल गोपनीयताको पूर्ण सम्मान गर्नु हाम्रो आधारभूत प्रतिबद्धता हो।

यो गोपनीयता नीति नेपालको वैयक्तिक गोपनीयता सम्बन्धी ऐन, २०७५ तथा विद्युतीय कारोबार ऐन, २०६३ को भावनाअनुरूप यस पोर्टलको वास्तविक प्राविधिक संरचनाअनुसार तयार पारिएको मौलिक नीति हो।

१. बिना खाता, बिना व्यक्तिगत विवरण खुला पहुँच (Zero-Registration Access)
यस पोर्टलमा संग्रहित नेपालको संविधान, ऐन, अध्यादेश, नियमावली, निर्देशिका, राजपत्र सन्दर्भ, १०-स्तम्भ तालिका, MD + PDF सिंक दृश्य र पूर्व-सञ्चित दफा/PDF सारांशहरू अध्ययन गर्न तपाईंले नाम, फोन नम्बर, ठेगाना, नागरिकता वा कुनै पनि खाता दर्ता गर्नु पर्दैन।

२. ब्राउजर स्थानीय भण्डारण र प्राविधिक लग (Local Storage & Technical Logs)
• Local Storage (स्थानीय प्राथमिकता): तपाईंले छान्नुभएको अक्षरको आकार (Font Size) र PDF पृष्ठ मिलान अफसेट (Page Calibration Offset) जस्ता सेटिङहरू तपाईंकै ब्राउजरभित्र मात्र सुरक्षित रहन्छन्; ती विवरण कुनै तेस्रो-पक्ष सर्भरमा पठाइँदैनन्। तपाईंले ब्राउजर डेटा सफा गरेर जुनसुकै बेला हटाउन सक्नुहुन्छ।
• आधारभूत सर्भर लग: क्लाउड होस्टिङ (Cloud Run / Firebase) प्रणालीले सेवा सञ्चालन, लोड सन्तुलन तथा साइबर सुरक्षा (DDoS/असामान्य ट्राफिक रोकथाम) का लागि अस्थायी रूपमा IP ठेगाना, अनुरोध समय र ब्राउजर प्रकारजस्ता सामान्य प्राविधिक लग मात्र अभिलेख राख्न सक्छ। यस पोर्टलमा कुनै विज्ञापन ट्र्याकर (Ad Trackers) वा प्रयोगकर्ता प्रोफाइलिङ कुकिज प्रयोग गरिएको छैन।

३. AI सारांश र खोज प्रश्नहरूको गोपनीयता (AI Summarization & Search)
• तालिका र दस्तावेज खोज (Search & Filter) पूर्णतः प्रयोगकर्ताको ब्राउजरमै चल्दछ।
• PDF वा दफा सारांश सुविधा प्रयोग गर्दा पहिले सार्वजनिक मास्टर स्टोर (Cloud Firestore) बाट तयार सारांश देखाइन्छ। नयाँ सारांश वा ऐच्छिक प्रश्न पठाउँदा सो अनुरोध हाम्रो सर्भरमार्फत प्रशोधन भई उत्तर मात्र फर्काइन्छ; सर्वसाधारण प्रयोगकर्ताको व्यक्तिगत पहिचान वा खोज इतिहास अलग प्रोफाइलका रूपमा भण्डारण गरिँदैन।

४. व्यवस्थापक प्रमाणीकरण (Admin / Owner Sign-In)
पोर्टलको मास्टर सारांश डेटाबेस अद्यावधिक तथा निर्यात गर्ने अधिकार केवल अधिकृत सञ्चालक (Owner/Admin) को Google प्रमाणीकरण (Firebase Authentication) सँग सीमित छ। सर्वसाधारण पाठकका लागि साइन-इन अनिवार्य छैन।

५. कानूनी दस्तावेजहरूको स्रोत र वैयक्तिक गोपनीयता
• यहाँ प्रस्तुत संकलित PDF तथा सन्दर्भ सामग्रीहरू नेपाल कानून आयोग (https://lawcommission.gov.np), नेपाल राजपत्र / मुद्रण विभाग (http://dop.gov.np) र सर्वोच्च अदालत (https://supremecourt.gov.np) बाट प्राप्त सार्वजनिक सरकारी दस्तावेजमा आधारित छन्।
• अदालत वा कानूनले गोप्य राखेका पक्ष/पीडितको पहिचान खुलाउने वा सार्वजनिक अभिलेखमा अनधिकृत हेरफेर गर्ने कुनै सामग्री यस पोर्टलले प्रकाशन गर्दैन।

६. बाह्य सरकारी लिङ्क तथा बालबालिकाको सुरक्षा
• आधिकारिक सन्दर्भका लागि नेपाल कानून आयोग, मुद्रण विभाग र सर्वोच्च अदालतका वेबसाइट लिङ्क दिइएका छन्; ती बाह्य साइटको नीति सम्बन्धित निकायकै नियमअनुसार हुनेछ।
• यस पोर्टलले १३ वर्ष मुनिका बालबालिकाबाट जानीजानी कुनै पनि व्यक्तिगत विवरण संकलन गर्दैन।

७. नीति संशोधन तथा सम्पर्क (Updates & Contact)
प्राविधिक वा कानूनी आवश्यकताअनुसार यस गोपनीयता नीतिमा समयसापेक्ष अद्यावधिक गर्न सकिनेछ र अद्यावधिक मिति यही पेजमा देखिनेछ। नीति वा कुनै दस्तावेजसम्बन्धी जिज्ञासा वा सुझावका लागि सम्पर्क गर्नुहोस्:
• इमेल: ${CONTACT_EMAIL}
• वेबसाइट: ${PORTAL_URL}`;

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(UNIQUE_PRIVACY_POLICY_TEXT);
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
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-base sm:text-lg truncate">
                गोपनीयता नीति (Privacy Policy)
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
          <div className="rounded-xl bg-indigo-50/70 border border-indigo-200 p-4 text-xs sm:text-sm text-slate-800 space-y-1.5">
            <p className="font-bold text-indigo-950">{PORTAL_NAME}</p>
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
              नेपालको <strong>वैयक्तिक गोपनीयता सम्बन्धी ऐन, २०७५</strong> तथा{' '}
              <strong>विद्युतीय कारोबार ऐन, २०६३</strong> को मर्मअनुरूप यस पोर्टलको वास्तविक
              प्रणालीका आधारमा तयार पारिएको।
            </p>
          </div>

          <section className="space-y-1.5">
            <h4 className="font-bold text-slate-900 text-base">
              १. बिना खाता, बिना व्यक्तिगत विवरण खुला पहुँच
            </h4>
            <p>
              यस पोर्टलमा उपलब्ध नेपालको संविधान, ऐन, अध्यादेश, नियमावली, निर्देशिका,
              १०-स्तम्भ कानूनी तालिका, MD + PDF सिंक दृश्य र पूर्व-सञ्चित दफा/PDF सारांशहरू
              निःशुल्क पढ्न र खोज्न तपाईंले नाम, फोन नम्बर, नागरिकता वा खाता दर्ता जस्ता कुनै
              पनि व्यक्तिगत विवरण बुझाउनु पर्दैन।
            </p>
          </section>

          <section className="space-y-1.5">
            <h4 className="font-bold text-slate-900 text-base">
              २. ब्राउजर स्थानीय भण्डारण र प्राविधिक सुरक्षा लग
            </h4>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Local Storage (स्थानीय प्राथमिकता):</strong> तपाईंले छान्नुभएको
                अक्षरको आकार (Font Size) र PDF पृष्ठ मिलान अफसेट (Page Calibration Offset)
                तपाईंकै ब्राउजरभित्र मात्र सुरक्षित रहन्छ; ती सेटिङ बाह्य सर्भरमा पठाइँदैनन्।
              </li>
              <li>
                <strong>सर्भर सुरक्षा लग:</strong> क्लाउड होस्टिङ प्रणालीले वेबसाइट स्थिर
                राख्न र साइबर आक्रमण वा दुरुपयोग रोक्न अस्थायी रूपमा IP ठेगाना, ब्राउजर
                प्रकार र अनुरोध समय जस्ता गैर-व्यक्तिगत प्राविधिक विवरण मात्र अभिलेख राख्न
                सक्छ। यस पोर्टलमा विज्ञापन ट्र्याकर वा प्रयोगकर्ता प्रोफाइलिङ कुकिज प्रयोग
                गरिएको छैन।
              </li>
            </ul>
          </section>

          <section className="space-y-1.5">
            <h4 className="font-bold text-slate-900 text-base">
              ३. खोज सुविधा र AI सारांश प्रशोधन
            </h4>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                १०-स्तम्भ डेटा खोज र फिल्टर पूर्णतः तपाईंको ब्राउजरमै चल्दछ।
              </li>
              <li>
                दफा वा PDF सारांश खोल्दा पहिले सार्वजनिक मास्टर स्टोर (Cloud Firestore) बाट
                तयार सारांश लोड गरिन्छ। नयाँ सारांश वा ऐच्छिक प्रश्न पठाउँदा अनुरोध सर्भरबाट
                प्रशोधन भई उत्तर मात्र फर्काइन्छ; पाठकको व्यक्तिगत खोज इतिहास प्रोफाइलका
                रूपमा भण्डारण गरिँदैन।
              </li>
            </ul>
          </section>

          <section className="space-y-1.5">
            <h4 className="font-bold text-slate-900 text-base">
              ४. व्यवस्थापक प्रमाणीकरण (Admin / Owner Sign-In)
            </h4>
            <p>
              मास्टर सारांश डेटाबेस अद्यावधिक तथा डेटा निर्यात गर्ने अधिकार केवल अधिकृत
              सञ्चालक (Owner/Admin) को Google प्रमाणीकरणमा सीमित छ। सर्वसाधारण पाठकका
              लागि लगइन आवश्यक पर्दैन।
            </p>
          </section>

          <section className="space-y-1.5">
            <h4 className="font-bold text-slate-900 text-base">
              ५. आधिकारिक सरकारी स्रोत र गोपनीयता सम्मान
            </h4>
            <p>
              यस पोर्टलमा संकलित कानूनी दस्तावेजहरू{' '}
              <a
                href="https://lawcommission.gov.np"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-700 font-semibold hover:underline inline-flex items-center gap-0.5"
              >
                नेपाल कानून आयोग <ExternalLink className="w-3 h-3" />
              </a>
              ,{' '}
              <a
                href="http://dop.gov.np"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-700 font-semibold hover:underline inline-flex items-center gap-0.5"
              >
                नेपाल राजपत्र (मुद्रण विभाग) <ExternalLink className="w-3 h-3" />
              </a>{' '}
              र{' '}
              <a
                href="https://supremecourt.gov.np"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-700 font-semibold hover:underline inline-flex items-center gap-0.5"
              >
                सर्वोच्च अदालत <ExternalLink className="w-3 h-3" />
              </a>{' '}
              का सार्वजनिक अभिलेखमा आधारित छन्। अदालत वा कानूनले गोप्य राखेका व्यक्ति वा
              पीडितको पहिचान खुलाउने कार्य यस प्लेटफर्मबाट गरिँदैन।
            </p>
          </section>

          <section className="space-y-1.5">
            <h4 className="font-bold text-slate-900 text-base">
              ६. बालबालिकाको गोपनीयता तथा नीति अद्यावधिक
            </h4>
            <p>
              हामी जानीजानी १३ वर्ष मुनिका बालबालिकाबाट कुनै व्यक्तिगत विवरण संकलन गर्दैनौं।
              प्राविधिक सुधार वा कानूनी आवश्यकताअनुसार यस गोपनीयता नीतिमा परिवर्तन भएमा
              अद्यावधिक मितिसहित यही पेजमा प्रकाशित गरिनेछ।
            </p>
          </section>

          <section className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-1">
            <h4 className="font-bold text-slate-900 text-sm">
              ७. सम्पर्क (Contact)
            </h4>
            <p className="text-xs sm:text-sm">
              यस गोपनीयता नीति वा दस्तावेजसम्बन्धी जिज्ञासा, सुधार वा गुनासोको लागि:{' '}
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
                <span>पूर्ण नीति कपी गर्नुहोस्</span>
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
