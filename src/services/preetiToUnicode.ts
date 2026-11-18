/**
 * Standard Preeti-to-Unicode Devanagari detector and converter for legacy
 * Nepal Law Commission PDFs (such as १.२. मुलुकी देवानी संहिता ऐन २०७४).
 */

export function isLikelyPreetiText(text: string): boolean {
  if (!text || text.length < 80) return false;
  const nonSpace = text.replace(/\s+/g, '');
  if (nonSpace.length === 0) return false;

  const devChars = (nonSpace.match(/[\u0900-\u097F]/g) || []).length;
  const devRatio = devChars / nonSpace.length;
  if (devRatio >= 0.25) return false;

  // High-confidence standard Preeti legal tokens
  const preetiMarkers = [
    /d'n'sL/g,
    /sfg"g/g,
    /;+lxtf/g,
    /bkmf/g,
    /pkbkmf/g,
    /Joj:yf/g,
    /k|rlnt/g,
    /g]kfn/g,
    /eGgfn]/g,
    /;Demg'/g,
    /adf]lhd/g,
    /x'g]5/g,
    /ug]{5/g,
    /JolQm/g,
    /Ifltk"lt{/g,
    /k|df0fLs/g,
    /;\s*f/g,
  ];

  let hits = 0;
  for (const rx of preetiMarkers) {
    const m = text.match(rx);
    if (m) hits += m.length;
  }
  return hits >= 3;
}

function convertPreetiSegment(input: string): string {
  if (!input) return '';

  // Multi-character Preeti ligatures (longest match first)
  let s = input
    .replace(/c\s*f\}/g, 'औ')
    .replace(/cf\}/g, 'औ')
    .replace(/cf\]/g, 'ओ')
    .replace(/cf/g, 'आ')
    .replace(/O\{/g, 'ई')
    .replace(/O{/g, 'ई')
    .replace(/p'/g, 'ऊ')
    .replace(/P\]/g, 'ऐ')
    .replace(/c\+/g, 'अं')
    .replace(/Em/g, 'झ')
    .replace(/em/g, 'झ')
    .replace(/km/g, 'फ')
    .replace(/Km/g, 'फ्')
    .replace(/Qm/g, 'क्त')
    .replace(/0ff/g, 'णा')
    .replace(/0f/g, 'ण')
    .replace(/iff/g, 'षा')
    .replace(/if/g, 'ष')
    .replace(/Iff/g, 'क्षा')
    .replace(/If/g, 'क्ष')
    .replace(/Zff/g, 'शा')
    .replace(/Zf/g, 'श')
    .replace(/Yff/g, 'था')
    .replace(/Yf/g, 'थ')
    .replace(/Bff/g, 'धा')
    .replace(/Bf/g, 'ध')
    .replace(/Eff/g, 'भा')
    .replace(/Ef/g, 'भ')
    .replace(/Kff/g, 'पा')
    .replace(/Kf/g, 'प')
    .replace(/Uff/g, 'गा')
    .replace(/Uf/g, 'ग')
    .replace(/Tff/g, 'ता')
    .replace(/Tf/g, 'त')
    .replace(/Sff/g, 'का')
    .replace(/Sf/g, 'क')
    .replace(/Aff/g, 'बा')
    .replace(/Af/g, 'ब')
    .replace(/Dff/g, 'मा')
    .replace(/Df/g, 'म')
    .replace(/Gff/g, 'ना')
    .replace(/Gf/g, 'न')
    .replace(/Hff/g, 'जा')
    .replace(/Hf/g, 'ज')
    .replace(/Jff/g, 'वा')
    .replace(/Jf/g, 'व')
    .replace(/Nff/g, 'ला')
    .replace(/Nf/g, 'ल')
    .replace(/Rff/g, 'चा')
    .replace(/Rf/g, 'च')
    .replace(/Vff/g, 'खा')
    .replace(/Vf/g, 'ख')
    .replace(/:ff/g, 'सा')
    .replace(/:f/g, 'स')
    .replace(/Xff/g, 'हा')
    .replace(/Xf/g, 'ह')
    .replace(/`f/g, 'ञ')
    .replace(/~f/g, 'ञ');

  const charMap: Record<string, string> = {
    ' ': ' ',
    '!': '१',
    '"': 'ू',
    '#': '३',
    '$': '४',
    '%': '५',
    '&': '७',
    "'": 'ु',
    '(': '९',
    ')': '०',
    '*': '८',
    '+': 'ं',
    ',': ',',
    '-': '(',
    '.': '।',
    '/': 'र',
    '0': 'ण्',
    '1': 'ज्ञ',
    '2': 'द्द',
    '3': 'घ',
    '4': 'द्ध',
    '5': 'छ',
    '6': 'ट',
    '7': 'ठ',
    '8': 'ड',
    '9': 'ढ',
    ':': 'स्',
    ';': 'स',
    '<': '?',
    '=': '.',
    '>': 'श्र',
    '?': 'रु',
    '@': '२',
    A: 'ब्',
    B: 'ध्',
    C: 'ऋ',
    D: 'म्',
    E: 'भ्',
    F: 'ँ',
    G: 'न्',
    H: 'ज्',
    I: 'क्ष्',
    J: 'व्',
    K: 'प्',
    L: 'ी',
    M: 'ः',
    N: 'ल्',
    O: 'इ',
    P: 'ए',
    Q: 'त्त',
    R: 'च्',
    S: 'क्',
    T: 'त्',
    U: 'ग्',
    V: 'ख्',
    W: 'ध्',
    X: 'ह्',
    Y: 'थ्',
    Z: 'श्',
    '[': 'ृ',
    '\\': '्',
    ']': 'े',
    '^': '६',
    _: ')',
    '`': 'ञ्',
    a: 'ब',
    b: 'द',
    c: 'अ',
    d: 'म',
    e: 'भ',
    f: 'ा',
    g: 'न',
    h: 'ज',
    i: 'ष्',
    j: 'व',
    k: 'प',
    l: 'ि',
    m: 'फ',
    n: 'ल',
    o: 'य',
    p: 'उ',
    q: 'त्र',
    r: 'च',
    s: 'क',
    t: 'त',
    u: 'ग',
    v: 'ख',
    w: 'ध',
    x: 'ह',
    y: 'थ',
    z: 'श',
    '{': '\uE001',
    '|': '्र',
    '}': 'ै',
    '~': 'ञ्',
    '¥': 'र्‍',
    '°': 'ङ्',
    '±': '+',
    µ: '—',
    '¶': '्',
    '¸': 'ऽ',
    '¹': 'ङ्घ',
    'º': 'द्व',
    '»': 'ङ्क',
    '¼': 'ड्ड',
    '½': 'ट्ट',
    '¾': 'ठ्ठ',
    '¿': 'रू',
    'À': 'क्र',
    'Á': 'फ',
    'Â': 'क्त',
    'Ã': 'क्र',
    'Ä': 'हृ',
    'Å': '्र',
    'Æ': '“',
    'Ç': 'र्‍',
    'È': 'झ्',
    'É': 'ण',
    'Ê': 'द्य',
    'Ë': 'ङ्ग',
    'Ì': 'त्',
    'Í': 'द्ध',
    'Î': 'ह्य',
    'Ï': 'ह्म',
    'Ð': 'द्र',
    'Ñ': 'ङ',
    'Ò': 'ढ',
    'Ó': 'ौ',
    'Ô': 'ो',
    'Õ': 'ै',
    'Ö': 'ऊ',
    'Ø': '्य',
    'Ù': '्र',
    'Ú': 'ू',
    'Û': '!',
    'Ü': '%',
    'Ý': 'ः',
    'Þ': 'ध्र',
    'ß': 'त्त',
    'à': '्र',
    'á': 'ज्ञ',
    'â': 'ऊ',
    'ã': 'ः',
    'ä': 'ङ्क',
    'å': 'द्व',
    'æ': '“',
    'ç': 'ॐ',
    'è': 'झ',
    'é': 'ई',
    'ê': 'ह्र',
    'ë': 'ङ्ख',
    'ì': 'ह्व',
    'í': 'ह्ल',
    'î': 'ह्ण',
    'ï': 'य्',
    'ð': 'ह्न',
    'ñ': 'द्घ',
    'ò': 'द्म',
    'ó': 'ौ',
    'ô': 'ो',
    'õ': 'ै',
    'ø': '्य',
    'ù': 'ः',
    'ú': 'ु',
    'û': 'ू',
    'ü': 'ृ',
    'ý': 'र्',
    'þ': '्र',
    'ÿ': 'र्‍',
    '§': 'ट',
    '¨': 'ठ',
    '©': 'ड',
    'ª': 'ङ',
    '«': '(',
    '¬': ')',
    '®': '?',
    '¯': '>',
    'Š': 'ख्र',
    'Œ': 'ष्',
    'Ž': '्र',
    '‘': '‘',
    '’': '’',
    '“': '“',
    '”': '”',
    '˜': 'ञ',
    '™': 'ः',
    'š': 'ख्र',
    '›': '?',
    'œ': 'ष',
    'ž': '्र',
    'Ÿ': '्र',
    '¡': '।',
  };

  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    out += charMap[ch] !== undefined ? charMap[ch] : ch;
  }

  // Reorder Preeti 'l' (ि) from before consonant/conjunct to after the consonant/conjunct
  out = out.replace(
    /ि((?:[\u0915-\u0939]\u094D)*[\u0915-\u0939](?:\u094D[\u0915-\u0939])*)/g,
    '$1ि'
  );

  // Combine ा + े -> ो and ा + ै -> ौ
  out = out.replace(/ाे/g, 'ो').replace(/ाै/g, 'ौ');

  // Move Preeti reph ({ -> \uE001) placed AFTER consonant+matras to BEFORE the syllable
  out = out.replace(
    /((?:[\u0915-\u0939]\u094D)*[\u0915-\u0939](?:[\u093E-\u094C\u0941-\u0944\u0901\u0902]*))\uE001/g,
    'र्$1'
  );
  out = out.replace(/\uE001/g, 'र्');

  // Clean stray Preeti halant + matra artifacts and Wingdings/Symbol PUA bullets
  out = out
    .replace(/्ा/g, '')
    .replace(/([क-ह])्([ािीुूृेैोौ])/g, '$1$2')
    .replace(/[\uE000-\uF8FF]/g, '•')
    .replace(/\s+/g, ' ')
    .trim();

  return out;
}

/**
 * Converts Preeti ASCII spans to Nepali Devanagari Unicode while preserving
 * headers like `--- [PDF पृष्ठ ...] ---`, URLs, and already-Unicode Devanagari runs.
 */
export function convertPreetiPageToUnicode(rawText: string): string {
  if (!rawText) return '';
  const parts = rawText.split(
    /(www\.lawcommission\.gov\.np\s*\d+|--- \[PDF पृष्ठ [^\]]+\] ---|[\u0900-\u097F][\u0900-\u097F\s,।\-–०-९0-9()]*)/g
  );

  return parts
    .map(part => {
      if (!part) return '';
      if (/^www\.lawcommission\.gov\.np/.test(part)) return part;
      if (/^--- \[PDF पृष्ठ /.test(part)) return part;
      if (/[\u0900-\u097F]/.test(part)) return part;
      return convertPreetiSegment(part);
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
