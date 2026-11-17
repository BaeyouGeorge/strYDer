// Usage:
//   node render.js stills out_dir t1 t2 ...        -> PNG stills at given times
//   node render.js video out.mp4 [--w 1920 --h 1080 --from 0 --to 18.6 --mb N]
const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const serve = require('./serve');

const CHROME = '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';

function arg(name, def) { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; }

(async () => {
  const mode = process.argv[2], out = process.argv[3];
  const W = +arg('w', 1280), H = +arg('h', 720);
  const server = await serve(0);
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  const mb = arg('mb');
  await page.goto(`http://localhost:${port}/index.html?w=${W}&h=${H}${mb !== undefined ? '&mb=' + mb : ''}`);
  await page.waitForFunction(() => window.ready || window.initError, null, { timeout: 120000 });
  const err = await page.evaluate(() => window.initError);
  if (err) { console.error(err); process.exit(1); }
  const shot = async (t) => {
    const url = await page.evaluate((t) => { window.renderFrame(t); return window.frameData(); }, t);
    return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
  };

  if (mode === 'stills') {
    fs.mkdirSync(out, { recursive: true });
    for (const ts of process.argv.slice(4).filter(a => /^[\d.]+$/.test(a))) {
      const t0 = Date.now();
      fs.writeFileSync(path.join(out, `t${(+ts).toFixed(2)}.png`), await shot(+ts));
      console.log('still', ts, (Date.now() - t0) + 'ms');
    }
  } else {
    const fps = await page.evaluate(() => window.FPS);
    const dur = await page.evaluate(() => window.DURATION);
    const from = +arg('from', 0), to = +arg('to', dur);
    const n0 = Math.round(from * fps), n1 = Math.round(to * fps);
    const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', arg('crf', '16'), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const tStart = Date.now();
    for (let n = n0; n < n1; n++) {
      const buf = await shot(n / fps);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if ((n - n0) % 15 === 0) {
        const el = (Date.now() - tStart) / 1000, done = n - n0 + 1;
        console.log(`frame ${n}/${n1}  ${(el / done).toFixed(2)}s/frame  eta ${((n1 - n - 1) * el / done / 60).toFixed(1)}min`);
      }
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    console.log('done', out);
  }
  await browser.close();
  server.close();
})();
