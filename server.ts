import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { analyzeLegalHeadersWithGemini } from './src/services/geminiHeaderService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(express.json());

// 1. Gemini Legal Header Analyzer Endpoint
app.post('/api/gemini/analyze-headers', async (req, res) => {
  try {
    const { pdfPath, pageNumber, snippetText } = req.body;
    const analysis = await analyzeLegalHeadersWithGemini(
      pdfPath || '',
      pageNumber ? parseInt(String(pageNumber), 10) : undefined,
      snippetText || ''
    );
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(analysis);
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 2. PDF Streaming Proxy Endpoint
app.get('/api/pdf-proxy', async (req, res) => {
  try {
    const pdfPath = req.query.path as string;
    if (!pdfPath) {
      return res.status(400).send('Missing PDF path parameter');
    }

    // Candidate local locations (including filename typo/spacing aliases):
    const cleanPath = pdfPath.replace(/अनुसूची-१\.pdf$/, 'अनसुूची-१.pdf');
    const candidates = [
      path.resolve(__dirname, 'public', pdfPath),
      path.resolve(__dirname, 'public/pdfs', pdfPath.replace(/^pdfs\//, '')),
      path.resolve(process.cwd(), 'public', pdfPath),
      path.resolve(process.cwd(), 'public/pdfs', pdfPath.replace(/^pdfs\//, '')),
      path.resolve(process.cwd(), 'public', cleanPath),
    ];

    for (const localFile of candidates) {
      if (fs.existsSync(localFile) && fs.statSync(localFile).isFile()) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.sendFile(localFile);
      }
    }

    // Fallback: Stream directly from GitHub repository
    const upstreamPath = cleanPath.replace(
      /^pdfs\/१\.\s*संबिधान र मुलुकी संहिता\//,
      'pdfs/१. नेपालको संबिधान र मुलुकी ऐन/'
    );
    const encodedPath = upstreamPath.split('/').map(s => encodeURIComponent(s)).join('/');
    const rawUrl = `https://raw.githubusercontent.com/barshapbp2026/any-pdf-/main/${encodedPath}`;
    const response = await fetch(rawUrl);
    if (!response.ok) {
      return res.status(response.status).send('PDF not found on GitHub repository');
    }

    const arrayBuffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    return res.status(500).send(err.message || 'Internal error streaming PDF');
  }
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
});
