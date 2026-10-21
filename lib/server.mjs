import {withDrawableColors} from './cubism-colors.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { modelPayload, containedFile, mime } from './model-library.mjs';
const require = createRequire(import.meta.url);

export async function startServer({ webRoot, models, previewTextures, getCorePath, getAppIconPath=()=>null }) {
  const vendor = new Map([
    ['/appearance-profile.mjs',resolve(webRoot,'../lib/appearance-profile.mjs')],
    ['/vendor/pixi.js', resolve(dirname(require.resolve('pixi.js')), '../browser/pixi.min.js')],
    ['/vendor/csp-shaders.js', resolve(dirname(require.resolve('@pixi/unsafe-eval')), '../browser/unsafe-eval.js')],
    ['/vendor/live2d.js', require.resolve('pixi-live2d-display/cubism4')],
  ]);
  const pages = new Set(['avatar.html', 'control.html', 'avatar.js', 'control.js', 'style.css', 'textures.js', 'appearance-colors.js', 'performance.js', 'desktop-layout.js', 'life-controller.js', 'pose-controller.js', 'reaction-profiles.js', 'prop-themes.js']);
  let origin;
  const server = createServer(async (req, res) => {
    const headers = {
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; media-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store',
    };
    try {
      if (req.headers.host !== new URL(origin).host || (req.headers.origin && req.headers.origin !== origin)) { res.writeHead(403, headers); res.end(); return; }
      if (req.method !== 'GET') { res.writeHead(405, headers); res.end(); return; }
      const pathname = decodeURIComponent(new URL(req.url, origin).pathname);
      let file;
      let body;
      let preview;
      if(pathname==='/app-icon.png')file=getAppIconPath();
      else if (pathname === '/runtime/core.js') file = getCorePath();
      else if (vendor.has(pathname)) file = vendor.get(pathname);
      else if (pages.has(pathname.slice(1))) file = resolve(webRoot, pathname.slice(1));
      else {
        const match = pathname.match(/^\/models\/([^/]+)\/(.+)$/);
        const model = match && models.get(match[1]);
        if (model) {
          if (match[2] === 'manifest.json') body = JSON.stringify(modelPayload(model).manifest);
          else if (model.motionAssets?.has(match[2])) body = model.motionAssets.get(match[2]);
          else if (previewTextures?.get(model.id, match[2])) preview = previewTextures.get(model.id, match[2]);
          else if (model.allowed.has(match[2])) file = await containedFile(model.root, match[2]);
        }
      }
      if (!file && !body && !preview) { res.writeHead(404, headers); res.end('Not found'); return; }
      let data = preview || body || await readFile(file);
      if(pathname==='/vendor/live2d.js')data=withDrawableColors(data.toString());
      res.writeHead(200, { ...headers, 'Content-Type': preview ? 'image/png' : body ? 'application/json' : mime(file) });
      res.end(data);
    } catch { res.writeHead(404, headers); res.end('Asset unavailable'); }
  });
  await new Promise((resolveReady, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { server.removeListener('error', reject); resolveReady(); });
  });
  origin = `http://127.0.0.1:${server.address().port}`;
  return { origin, close: () => new Promise(resolveClosed => server.close(resolveClosed)) };
}
