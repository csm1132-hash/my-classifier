// 로컬 확인용 서버. Vercel처럼 public/ 을 정적 파일로, api/*.js 를 서버 함수로 돌린다.
// 실행: npm run dev  →  http://localhost:3000
// Gemini 키는 파일에 두지 않는다. 실행한 터미널에서만 넣는다 (없으면 규칙 결과만 나옴).
//   PowerShell:  $env:GEMINI_API_KEY="키"; npm.cmd run dev
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
process.chdir(root);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

async function handleApi(req, res, url) {
  const name = url.pathname.slice('/api/'.length);
  const file = path.join(root, 'api', `${name}.js`);
  if (!/^[a-z-]+$/.test(name) || !fs.existsSync(file)) {
    res.writeHead(404).end('Not found');
    return;
  }
  const mod = await import(pathToFileURL(file).href);
  const handler = mod[req.method];
  if (typeof handler !== 'function') {
    res.writeHead(405).end('Method not allowed');
    return;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  headers.set('x-forwarded-for', req.socket.remoteAddress || 'local');
  const request = new Request(url, {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
  });
  const response = await handler(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

function handleStatic(res, url) {
  let rel;
  try {
    rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }
  const file = path.resolve(publicDir, rel);
  if (!file.startsWith(publicDir + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

const port = Number(process.env.PORT) || 3000;
http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    try {
      if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
      else handleStatic(res, url);
    } catch (e) {
      console.error(e);
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
  })
  .listen(port, () => {
    console.log(`http://localhost:${port}`);
    console.log(process.env.GEMINI_API_KEY ? 'Gemini 키 있음' : 'Gemini 키 없음 — 이 터미널에서 $env:GEMINI_API_KEY="키" 를 먼저 입력하고 다시 실행하세요');
  });
