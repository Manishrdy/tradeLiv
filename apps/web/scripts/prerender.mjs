// Post-build SEO prerender: renders the public marketing routes to static HTML
// using Vite's SSR pipeline (React 19 + react-router StaticRouter, no headless
// browser). The authenticated app stays a client-rendered SPA — nginx serves
// index.html as the fallback for every non-prerendered route.
import { createServer } from 'vite';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

const PAGES = {
  '/': {
    title: 'tradeLiv — Trade. Design. Deliver.',
    description:
      'The sourcing platform for interior designers. Extract products from 500+ brands, compare cross-brand, collaborate with clients in real time, and place consolidated orders.',
  },
  '/about': {
    title: 'About — tradeLiv',
    description:
      'The team and mission behind tradeLiv — the sourcing platform built for interior designers.',
  },
  '/contact': {
    title: 'Contact — tradeLiv',
    description: 'Get in touch with the tradeLiv team.',
  },
  '/terms': {
    title: 'Terms of Service — tradeLiv',
    description: 'tradeLiv terms of service.',
  },
  '/privacy': {
    title: 'Privacy Policy — tradeLiv',
    description: 'How tradeLiv handles your data.',
  },
};

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const template = await fs.readFile(path.join(dist, 'index.html'), 'utf-8');

// Empty SPA shell used by nginx as the fallback for non-prerendered (app) routes,
// so deep links don't flash the prerendered landing page before the router boots.
await fs.writeFile(path.join(dist, '200.html'), template);
console.log('[prerender] 200.html (SPA fallback shell)');

const vite = await createServer({
  root,
  logLevel: 'warn',
  server: { middlewareMode: true },
  appType: 'custom',
});

let failures = 0;
try {
  const { render } = await vite.ssrLoadModule('/src/entry-server.tsx');

  for (const [url, meta] of Object.entries(PAGES)) {
    try {
      const appHtml = render(url);
      const html = template
        .replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`)
        .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(meta.title)}</title>`)
        .replace(
          /(<meta name="description" content=")[^"]*(")/,
          `$1${escapeHtml(meta.description)}$2`,
        );

      const outPath =
        url === '/' ? path.join(dist, 'index.html') : path.join(dist, url.slice(1), 'index.html');
      await fs.mkdir(path.dirname(outPath), { recursive: true });
      await fs.writeFile(outPath, html);
      console.log(`[prerender] ${url} -> ${path.relative(root, outPath)}`);
    } catch (err) {
      failures++;
      console.error(`[prerender] FAILED ${url}:`, err?.message || err);
    }
  }
} finally {
  await vite.close();
}

if (failures > 0) {
  console.error(`[prerender] ${failures} page(s) failed.`);
  process.exit(1);
}
