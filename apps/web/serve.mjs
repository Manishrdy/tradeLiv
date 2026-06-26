// Minimal zero-dependency static file server for the built SPA (dist/).
// Replaces the Next.js `next start` process: serves prerendered public pages and
// hashed assets, and falls back to the SPA shell (200.html) for client routes —
// idles at ~40 MB RSS vs ~450 MB for the Next server.
import { createServer } from 'node:http';
import { promises as fs, createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'dist');
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

async function resolveFile(urlPath) {
  // Strip query/hash, decode, and prevent path traversal.
  const clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const safe = path.normalize(path.join(DIST, clean)).replace(/\/+$/, '');
  if (!safe.startsWith(DIST)) return null;

  try {
    const stat = await fs.stat(safe);
    if (stat.isFile()) return safe;
    if (stat.isDirectory()) {
      const index = path.join(safe, 'index.html');
      if (await fs.stat(index).then((s) => s.isFile()).catch(() => false)) return index;
    }
  } catch {
    /* not found */
  }
  return null;
}

function send(res, status, filePath, extraHeaders = {}) {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(status, { 'Content-Type': MIME[ext] || 'application/octet-stream', ...extraHeaders });
  createReadStream(filePath).pipe(res);
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end('Method Not Allowed');
    return;
  }

  const file = await resolveFile(req.url || '/');
  if (file) {
    // Hashed build assets are immutable; everything else must revalidate.
    const cache = file.includes(`${path.sep}assets${path.sep}`)
      ? 'public, max-age=31536000, immutable'
      : 'no-cache';
    send(res, 200, file, { 'Cache-Control': cache });
    return;
  }

  // A missing file with an extension (e.g. a stale hashed asset) is a real 404 —
  // don't mask it with the HTML shell. Extension-less paths are client routes.
  const reqPath = (req.url || '/').split('?')[0].split('#')[0];
  if (path.extname(reqPath)) {
    send(res, 404, path.join(DIST, '200.html'), { 'Cache-Control': 'no-cache' });
    return;
  }

  // SPA fallback — serve the shell so client-side routing handles the path.
  send(res, 200, path.join(DIST, '200.html'), { 'Cache-Control': 'no-cache' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[web] static SPA server listening on :${PORT} (root: ${DIST})`);
});
