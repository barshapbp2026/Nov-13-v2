import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { summarizePdfWithGemini, GeminiServiceError } from './src/services/geminiPdfSummaryService.ts';
import { summarizeDafasBatchWithGemini } from './src/services/geminiDafaSummaryService.ts';
import { getGeminiPoolStatus } from './src/services/geminiKeyPool.ts';
import { resolvePdfForProxy } from './src/services/pdfResolver.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(express.json({ limit: '2mb' }));

// 0. Gemini Multi-Key Pool Status (counts only, zero secret values)
app.get('/api/gemini/pool-status', (_req, res) => {
  res.json({ success: true, ...getGeminiPoolStatus() });
});

function sendGeminiErrorJson(res: express.Response, err: any, fallbackMessage: string) {
  const upstreamStatus = err instanceof GeminiServiceError ? err.status : 500;
  // AI Studio nginx intercepts 403, 502, 503, 504 with HTML pages (/forbidden.html, /warmup.html).
  // Return 422 / 500 so clients always receive structured JSON with the exact upstreamStatus.
  const safeHttpStatus =
    upstreamStatus === 403
      ? 422
      : upstreamStatus === 502 || upstreamStatus === 503 || upstreamStatus === 504
      ? 500
      : upstreamStatus;

  res.status(safeHttpStatus).json({
    success: false,
    upstreamStatus,
    error: err?.message || fallbackMessage,
  });
}

// 1. Gemini AI PDF Summary Endpoint
app.post('/api/gemini/summarize-pdf', async (req, res) => {
  try {
    const { pdfPath, mode, language, startPage, endPage, customQuestion } = req.body || {};
    const summary = await summarizePdfWithGemini({
      pdfPath: String(pdfPath || ''),
      mode,
      language,
      startPage: startPage ? parseInt(String(startPage), 10) : undefined,
      endPage: endPage ? parseInt(String(endPage), 10) : undefined,
      customQuestion: customQuestion ? String(customQuestion) : undefined,
    });
    res.json({ success: true, summary });
  } catch (err: any) {
    sendGeminiErrorJson(res, err, 'PDF सारांश तयार गर्न असफल भयो।');
  }
});

// 3. Gemini AI Batch Dafa Summary Endpoint
app.post('/api/gemini/summarize-dafas', async (req, res) => {
  try {
    const { pdfPath, items, useFastFallback } = req.body || {};
    const results = await summarizeDafasBatchWithGemini(
      String(pdfPath || ''),
      items || [],
      Boolean(useFastFallback)
    );
    res.json({ success: true, results });
  } catch (err: any) {
    sendGeminiErrorJson(res, err, 'दफा सारांश तयार गर्न असफल भयो।');
  }
});

// 4. PDF Streaming Proxy Endpoint (Range-capable, single active remote slot, minimal RAM)
app.get('/api/pdf-proxy', async (req, res) => {
  try {
    const pdfPath = String(req.query.path || '').trim();
    if (!pdfPath) {
      return res.status(400).send('Missing PDF path parameter');
    }

    const { filePath, source } = await resolvePdfForProxy(pdfPath);

    const isDownload = req.query.download === '1';
    const downloadName = path.basename(pdfPath).replace(/["\r\n]/g, '');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      isDownload ? `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}` : 'inline'
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
      'Access-Control-Expose-Headers',
      'Accept-Ranges, Content-Range, Content-Length'
    );
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-PDF-Source', source === 'github' ? 'remote' : source);

    return res.sendFile(filePath, err => {
      if (err && !res.headersSent) {
        const code = (err as any)?.code;
        if (code !== 'ECONNABORTED' && code !== 'ERR_STREAM_PREMATURE_CLOSE') {
          res.status(500).send('PDF स्ट्रिम गर्न असफल भयो।');
        }
      }
    });
  } catch (err: any) {
    if (res.headersSent) return;
    if (err?.name === 'AbortError' || String(err?.message || '').includes('रद्द')) {
      return res.status(499).send('PDF लोड रद्द गरियो।');
    }
    const msg = err?.message || 'Internal error streaming PDF';
    const status = msg.includes('फेला परेन') ? 404 : msg.includes('अमान्य') ? 400 : 500;
    return res.status(status).send(msg);
  }
});

// Ensure unmatched /api/* routes never fall back to HTML
app.use('/api', (_req, res) => {
  res.status(404).json({ success: false, error: 'API endpoint फेला परेन।' });
});

// Ensure Express middleware errors (e.g., invalid JSON body) return JSON
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path.startsWith('/api')) {
    return res.status(err?.status || 500).json({
      success: false,
      error: err?.message || 'आन्तरिक सर्भर त्रुटि भयो।',
    });
  }
  return next(err);
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
