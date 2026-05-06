// 临时 HTTP 服务，给手机下 APK 用。绑 0.0.0.0:8000，挂在 downloads 目录。
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, join, normalize } from 'node:path';

const root = resolve(process.argv[2] || './tuchenguang-site/public/downloads');
const port = Number(process.argv[3]) || 8000;

const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (pathname === '/' || pathname === '/index.html') {
    const { readdir } = await import('node:fs/promises');
    const files = await readdir(root);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><meta name=viewport content="width=device-width">
<style>body{font-family:system-ui;padding:24px;font-size:18px}a{display:block;padding:14px 0;color:#3b82f6;text-decoration:none}</style>
<h2>APK 下载</h2>
${files.map(f => `<a href="/${encodeURIComponent(f)}">${f}</a>`).join('')}`);
    return;
  }
  const filePath = normalize(join(root, pathname));
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  try {
    const st = await stat(filePath);
    if (!st.isFile()) throw new Error('not file');
    const data = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': filePath.endsWith('.apk')
        ? 'application/vnd.android.package-archive'
        : 'application/octet-stream',
      'Content-Length': data.length,
      'Content-Disposition': `attachment; filename="${pathname.slice(1)}"`,
    });
    res.end(data);
    console.log(`[${new Date().toISOString()}] sent ${filePath} (${data.length} bytes) to ${req.socket.remoteAddress}`);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Serving ${root} on http://0.0.0.0:${port}`);
  console.log('Open one of these on your phone:');
  console.log(`  http://10.72.56.198:${port}/`);
  console.log(`  http://10.70.112.237:${port}/`);
});
