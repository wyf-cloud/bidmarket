import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const docs = fileURLToPath(new URL('../docs/', import.meta.url));
const types = { js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', html: 'text/html; charset=utf-8' };

// Serve only the pages and assets needed by the local SPA. Never read the real config.
export function startDemoServer(port = 0) {
  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    const path = request.url.split('?')[0];
    const asset = /^\/assets\/[a-z0-9-]+\.(js|css)$/.exec(path);
    if (path !== '/' && path !== '/index.html' && !asset) { response.writeHead(404).end(); return; }
    try {
      const body = path === '/assets/config.js' ? 'window.__SUPABASE__ = {};\n' :
        await readFile(resolve(docs, asset ? path.slice(1) : 'index.html'));
      response.writeHead(200, { 'Content-Type': types[asset?.[1] || 'html'] });
      response.end(request.method === 'GET' ? body : undefined);
    } catch (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500).end();
    }
  });
  return new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      done({ server, url: `http://127.0.0.1:${server.address().port}/#/game` });
    });
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] || 8096);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    console.error('请输入 0–65535 之间的端口。');
    process.exitCode = 1;
  } else {
    try {
      const { url } = await startDemoServer(port);
      console.log(`标书员大冒险（独立演示）：${url}\n在顶栏点击“切换为：发布方”或其它演示身份。进度和排行榜位于浏览器内存；Ctrl+C 关闭。`);
    } catch (error) {
      console.error(`启动失败：${error.code === 'EADDRINUSE' ? '端口已占用，请给脚本传入其它端口。' : error.message}`);
      process.exitCode = 1;
    }
  }
}
