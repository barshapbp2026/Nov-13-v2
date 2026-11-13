const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'src', 'data');
const files = ['all_rows.json', 'all_documents.json', 'constitution_data.json', 'documents_summary.json', 'const_pages.json'];

function cleanNepaliText(text) {
  if (!text || typeof text !== 'string') return text;
  
  let t = text;
  // Fix common OCR corruptions of धरौटी, जमानत, बैंक जमानत, etc.
  t = t.replace(/ि\s*रौटी/g, 'धरौटी');
  t = t.replace(/रौटी/g, 'धरौटी');
  t = t.replace(/िरौट/g, 'धरौटी');
  t = t.replace(/रौट/g, 'धरौटी');
  t = t.replace(/रौटिाज/g, 'धरौटी वा जमानत');
  t = t.replace(/रजमा\s*नत/g, 'जमानत');
  t = t.replace(/बैङ्कज\s*मानत/g, 'बैंक जमानत');
  t = t.replace(/बैङ्क\s*जमानत/g, 'बैंक जमानत');
  t = t.replace(/मानत/g, 'जमानत');
  t = t.replace(/फुकुईगिन/g, 'फुकुवा हुन');
  t = t.replace(/वफताय/g, 'फिर्ता वा');
  t = t.replace(/िसअविधिथत्र/g, 'विशेष विधिद्वारा');
  t = t.replace(/ििुहििाि/g, 'सजाय');
  t = t.replace(/िम्र्ादा/g, 'मर्यादा');
  t = t.replace(/इत्र्ाठद/g, 'इत्यादि');
  
  // Specific replacements for section titles in Faujdari Karyabidhi
  if (t.includes('रौटीजफत हुने')) t = 'धरौटी जफत हुने';
  if (t.includes('रौटवफताय रजमा नतफुकुिािुन सक्ने')) t = 'धरौटी फिर्ता वा जमानत फुकुवा हुन सक्ने';
  if (t.includes('अधि र्ुिसँगि रौटिाजमा नतिाबैङ्कजमा नतधलने')) t = 'धरौटी, जमानत वा बैंक जमानत लिने';
  if (t.includes('थपिरौट, ज मा नतिाबैङ्कज मानतमा ग्नसवकने')) t = 'थप धरौटी, जमानत वा बैंक जमानत माग गर्न सकिने';
  if (t.includes('िरौट, ज मा नतिाबैङ्कज मानतको रकम तोक्ने आिा रा')) t = 'धरौटी, जमानत वा बैंक जमानतको रकम तोक्ने आधार';
  if (t.includes('िरौट, ज मा नतिाबैङ्कज मानतधलँदा कागजगराउनु पर्ने')) t = 'धरौटी, जमानत वा बैंक जमानत लिंदा कागजात गराउनु पर्ने';

  // Clean up stray/orphaned leading i-kar or matras
  t = t.replace(/([^\u0900-\u097F\s])ि\s+/g, '$1');
  
  return t;
}

files.forEach(filename => {
  const filePath = path.join(dataDir, filename);
  if (fs.existsSync(filePath)) {
    console.log(`Processing ${filename}...`);
    const content = fs.readFileSync(filePath, 'utf8');
    let data = JSON.parse(content);
    
    function walk(obj) {
      if (Array.isArray(obj)) {
        return obj.map(item => walk(item));
      } else if (obj !== null && typeof obj === 'object') {
        const newObj = {};
        for (const key of Object.keys(obj)) {
          if (typeof obj[key] === 'string') {
            newObj[key] = cleanNepaliText(obj[key]);
          } else {
            newObj[key] = walk(obj[key]);
          }
        }
        return newObj;
      }
      return obj;
    }
    
    const cleaned = walk(data);
    fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2), 'utf8');
    console.log(`Successfully cleaned ${filename}`);
  }
});
console.log('All data files cleaned successfully!');
