import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.AUTH_DATA_FILE ||= path.join(__dirname, 'backend', '.data', 'users.json');
process.env.AUTH_SECRET ||= 'local-development-secret-change-me';

const { default: authHandler } = await import('./api/auth/[action].js');

const PORT = Number(process.env.PORT || 4000);
const DIST_DIR = path.join(__dirname, 'dist');

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

async function fileExists(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const requestedPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const normalizedPath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(DIST_DIR, normalizedPath);

  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!(await fileExists(filePath))) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  if (!(await fileExists(filePath))) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Build the frontend first with npm run build, or use npm run dev for Vite.');
    return;
  }

  const content = await fs.readFile(filePath);
  const contentType = contentTypes[path.extname(filePath)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(content);
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/auth/')) {
    authHandler(req, res);
    return;
  }

  serveStatic(req, res).catch((error) => {
    console.error(error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Server error.' }));
  });
});

server.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});
