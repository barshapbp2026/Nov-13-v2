import fs from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../..');
const PROXY_CACHE_DIR = path.join(os.tmpdir(), 'any-pdf-active-slot');
const ACTIVE_CACHE_FILE = path.join(PROXY_CACHE_DIR, 'active.pdf');
const ACTIVE_CACHE_PART = path.join(PROXY_CACHE_DIR, 'active.pdf.part');

// Lazy in-memory filename/path lookup (~51 tiny strings, < 8 KB RAM)
let localIndexByRelPath: Map<string, string> | null = null;
let localIndexByFilename: Map<string, string> | null = null;

// Single active remote PDF slot tracker (strictly max 1 remote PDF on disk & 1 fetch at a time)
let activeRemoteKey: string | null = null;
let inFlightRemote: {
  key: string;
  controller: AbortController;
  promise: Promise<string>;
} | null = null;

function normalizeKey(input: string): string {
  return (input || '')
    .normalize('NFC')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\s+\.pdf$/i, '.pdf')
    .replace(/\s+/g, ' ')
    .trim();
}

function getPublicPdfRoots(): string[] {
  return Array.from(
    new Set([
      path.resolve(PROJECT_ROOT, 'public/pdfs'),
      path.resolve(process.cwd(), 'public/pdfs'),
    ])
  );
}

function getPublicRoots(): string[] {
  return Array.from(
    new Set([
      path.resolve(PROJECT_ROOT, 'public'),
      path.resolve(process.cwd(), 'public'),
    ])
  );
}

function ensureLocalIndex(): void {
  if (localIndexByRelPath && localIndexByFilename) return;

  localIndexByRelPath = new Map();
  localIndexByFilename = new Map();

  for (const root of getPublicPdfRoots()) {
    if (!fs.existsSync(root)) continue;
    const stack: string[] = [root];
    while (stack.length > 0) {
      const dir = stack.pop()!;
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
        } else if (entry.isFile() && /\.pdf$/i.test(entry.name)) {
          const relFromPdfRoot = path.relative(root, full).replace(/\\/g, '/');
          const relWithPdfs = `pdfs/${relFromPdfRoot}`;
          const normRel = normalizeKey(relWithPdfs);
          const normFile = normalizeKey(entry.name);
          if (!localIndexByRelPath.has(normRel)) {
            localIndexByRelPath.set(normRel, full);
          }
          if (!localIndexByFilename.has(normFile)) {
            localIndexByFilename.set(normFile, full);
          }
        }
      }
    }
  }
}

function isSafeInsidePublic(candidate: string): boolean {
  const resolved = path.resolve(candidate);
  return getPublicRoots().some(root => resolved === root || resolved.startsWith(root + path.sep));
}

function buildPathVariants(pdfPath: string): string[] {
  const clean = (pdfPath || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!clean) return [];

  const withPdfs = clean.startsWith('pdfs/') ? clean : `pdfs/${clean}`;
  const variants = new Set<string>([clean, withPdfs]);

  const addAliases = (p: string) => {
    variants.add(p.replace(/अनुसूची-१\.pdf$/, 'अनसुूची-१.pdf'));
    variants.add(p.replace(/अनसुूची-१\.pdf$/, 'अनुसूची-१.pdf'));
    variants.add(p.replace(/^(pdfs\/१२\.[^/]+\/१२\.५\.)\s+/, '$1  '));
    variants.add(p.replace(/\s+\.pdf$/i, '.pdf'));
    variants.add(p.replace(/\.pdf$/i, ' .pdf'));
    variants.add(
      p.replace(
        /^pdfs\/१\.\s*संबिधान र मुलुकी संहिता\//,
        'pdfs/१. नेपालको संबिधान र मुलुकी ऐन/'
      )
    );
    variants.add(
      p.replace(
        /^pdfs\/१\.\s*नेपालको संबिधान र मुलुकी ऐन\//,
        'pdfs/१. संबिधान र मुलुकी संहिता/'
      )
    );
  };

  for (const base of Array.from(variants)) {
    addAliases(base);
  }

  if (clean.includes('१२.८.')) {
    variants.add(
      'pdfs/५. निर्देशिका/५.२. जग्गा नापजाँच तथा नक्सा स्रेस्ता अध्यावधिक सम्बन्धि निर्देशिका, २०८१/जग्गा नापजाँच तथा नक्सा स्रेस्ता अध्यावधिक सम्बन्धि निर्देशिका, २०८१.pdf'
    );
  }

  return Array.from(variants);
}

export function resolvePdfLocalPath(pdfPath: string): string | null {
  if (!pdfPath) return null;
  const trimmed = pdfPath.replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!trimmed || trimmed.split('/').some(seg => seg === '..')) {
    return null;
  }

  const variants = buildPathVariants(trimmed);
  for (const variant of variants) {
    for (const root of getPublicRoots()) {
      const candidate = path.resolve(root, variant);
      if (
        isSafeInsidePublic(candidate) &&
        fs.existsSync(candidate) &&
        fs.statSync(candidate).isFile()
      ) {
        return candidate;
      }
    }
  }

  // Fallback to normalized NFC / filename index across public/pdfs
  ensureLocalIndex();
  for (const variant of variants) {
    const byRel = localIndexByRelPath?.get(normalizeKey(variant));
    if (byRel && fs.existsSync(byRel)) return byRel;
  }

  const baseName = path.basename(trimmed);
  const baseVariants = [
    baseName,
    baseName.replace(/अनुसूची-१\.pdf$/, 'अनसुूची-१.pdf'),
    baseName.replace(/\s+\.pdf$/i, '.pdf'),
  ];
  for (const bv of baseVariants) {
    const byFile = localIndexByFilename?.get(normalizeKey(bv));
    if (byFile && fs.existsSync(byFile)) return byFile;
  }

  return null;
}

function buildRemoteUrls(pdfPath: string): string[] {
  const rawVariants = buildPathVariants(pdfPath);
  const urls: string[] = [];
  const seen = new Set<string>();

  const repo = (process.env.GITHUB_PDF_REPO || 'barshapbp2026/any-pdf-').trim();
  const branch = (process.env.GITHUB_PDF_BRANCH || 'main').trim();

  for (const v of rawVariants) {
    const upstream = v.replace(
      /^pdfs\/१\.\s*संबिधान र मुलुकी संहिता\//,
      'pdfs/१. नेपालको संबिधान र मुलुकी ऐन/'
    );
    const encoded = upstream
      .split('/')
      .filter(Boolean)
      .map(s => encodeURIComponent(s))
      .join('/');
    const url = `https://raw.githubusercontent.com/${repo}/${branch}/${encoded}`;
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }
  return urls;
}

function cleanupOldTempFiles(): void {
  for (const file of [ACTIVE_CACHE_PART, ACTIVE_CACHE_FILE]) {
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch {
      // ignore cleanup race
    }
  }
}

async function downloadRemoteToActiveSlot(
  cacheKey: string,
  pdfPath: string,
  signal: AbortSignal
): Promise<string> {
  fs.mkdirSync(PROXY_CACHE_DIR, { recursive: true });
  activeRemoteKey = null;
  cleanupOldTempFiles();

  const urls = buildRemoteUrls(pdfPath);
  let lastStatus = 404;

  for (const url of urls) {
    if (signal.aborted) {
      throw new Error('PDF लोड रद्द गरियो (नयाँ PDF खोलिएको छ)।');
    }

    const githubToken = (process.env.GITHUB_TOKEN || '').trim();
    const headers: Record<string, string> = {
      'User-Agent': 'any-pdf-proxy/1.0',
    };
    if (githubToken && githubToken !== 'MY_GITHUB_TOKEN') {
      headers.Authorization = `Bearer ${githubToken}`;
    }

    const response = await fetch(url, {
      signal,
      headers,
    });

    if (!response.ok || !response.body) {
      lastStatus = response.status;
      continue;
    }

    const writeStream = fs.createWriteStream(ACTIVE_CACHE_PART);
    try {
      const nodeReadable = Readable.fromWeb(response.body as any);
      await pipeline(nodeReadable, writeStream, { signal });
      if (signal.aborted) {
        cleanupOldTempFiles();
        throw new Error('PDF लोड रद्द गरियो।');
      }
      fs.renameSync(ACTIVE_CACHE_PART, ACTIVE_CACHE_FILE);
      activeRemoteKey = cacheKey;
      return ACTIVE_CACHE_FILE;
    } catch (err) {
      writeStream.destroy();
      try {
        if (fs.existsSync(ACTIVE_CACHE_PART)) fs.unlinkSync(ACTIVE_CACHE_PART);
      } catch {
        // ignore
      }
      throw err;
    }
  }

  throw new Error(`PDF फाइल फेला परेन (${lastStatus}): ${pdfPath}`);
}

/**
 * Resolves ANY PDF for streaming via /api/pdf-proxy with zero RAM buffering.
 * - Local PDFs stream straight from public/pdfs via OS sendfile (0 extra RAM, full Range/206 support).
 * - Remote GitHub PDFs stream chunk-by-chunk into a single-slot temp file (/tmp/any-pdf-active-slot/active.pdf),
 *   immediately aborting & replacing any superseded remote PDF so only 1 PDF is active at a time.
 */
export async function resolvePdfForProxy(
  pdfPath: string
): Promise<{ filePath: string; source: 'local' | 'cache' | 'github' }> {
  const clean = (pdfPath || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!clean || clean.split('/').some(seg => seg === '..')) {
    throw new Error('अमान्य PDF पथ (Invalid path)');
  }

  const localPath = resolvePdfLocalPath(clean);
  if (localPath) {
    return { filePath: localPath, source: 'local' };
  }

  const cacheKey = normalizeKey(clean);

  // If the same remote PDF is already cached in our single-slot disk file, serve it immediately
  if (activeRemoteKey === cacheKey && fs.existsSync(ACTIVE_CACHE_FILE)) {
    return { filePath: ACTIVE_CACHE_FILE, source: 'cache' };
  }

  // Coalesce concurrent requests (e.g. parallel browser Range requests) for the SAME remote PDF
  if (inFlightRemote && inFlightRemote.key === cacheKey) {
    const filePath = await inFlightRemote.promise;
    return { filePath, source: 'github' };
  }

  // If a DIFFERENT remote PDF is currently downloading, abort it immediately to save RAM/sockets
  if (inFlightRemote && inFlightRemote.key !== cacheKey) {
    inFlightRemote.controller.abort();
    inFlightRemote = null;
  }

  const controller = new AbortController();
  const promise = downloadRemoteToActiveSlot(cacheKey, clean, controller.signal)
    .finally(() => {
      if (inFlightRemote?.controller === controller) {
        inFlightRemote = null;
      }
    });

  inFlightRemote = { key: cacheKey, controller, promise };
  const filePath = await promise;
  return { filePath, source: 'github' };
}

/**
 * Reads a PDF buffer on-demand for AI summarization / server parsing only (never cached in RAM).
 */
export async function resolvePdfBuffer(
  pdfPath: string
): Promise<{ buffer: Buffer; localPath?: string; source: 'local' | 'cache' | 'github' }> {
  const { filePath, source } = await resolvePdfForProxy(pdfPath);
  const buffer = await fs.promises.readFile(filePath);
  return {
    buffer,
    localPath: source === 'local' ? filePath : undefined,
    source,
  };
}
