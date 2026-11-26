import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { startDemoServer } from './preview-game.mjs';

// Usage: set PLAYWRIGHT_MODULE and GAME_CHROME when these aren't on the default paths.
// Optional GAME_QA_SCREENSHOTS writes local PNGs without touching the published assets.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const shots = process.env.GAME_QA_SCREENSHOTS;
if (shots) await mkdir(shots, { recursive: true });
const { server, url } = await startDemoServer();
let browser;
const errors = [];
const external = [];
const frames = globalThis.setTimeout;
const wait = ms => new Promise(resolve => frames(resolve, ms));

const cabinet = '.game-cabinet';
const value = key => `[data-game-value="${key}"]`;
const action = key => `[data-game="${key}"]`;
const state = page => page.evaluate(() => {
  const p = window.__gameQA.current.p;
  return { x:p.x, y:p.y, time:window.__gameQA.current.time, frames:window.__gameQA.frames };
});
const mode = (page, name) => page.locator(`${cabinet}[data-game-mode="${name}"]`).waitFor();

async function setUp(options) {
  const context = await browser.newContext(options);
  await context.route('**/*', async route => {
    if (new URL(route.request().url()).origin !== new URL(url).origin) {
      external.push(route.request().url()); await route.abort(); return;
    }
    const path = new URL(route.request().url()).pathname;
    if (path !== '/assets/game-core.js') { await route.continue(); return; }
    // Test-only probes. Game rules and browser engine code are unchanged.
    const response = await route.fetch();
    const source = await response.text();
    assert.ok(source.includes('export function createRun(') && source.includes('export function step('));
    await route.fulfill({ response, body:source
      .replace('export function createRun(', 'function makeRun(')
      .replace('Object.assign(s,createRun(true))', 'Object.assign(s,makeRun(true))')
      .replace('export function step(', 'function tick(') + `
      const probe = window.__gameQA = { current:null, frames:0 };
      export function createRun(play) { return probe.current = makeRun(play); }
      export function step(...args) { probe.frames++; return tick(...args); }
    ` });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(url);
  await mode(page, 'ready');
  return { context, page };
}

try {
  browser = await chromium.launch({ headless:true, executablePath:process.env.GAME_CHROME || undefined });
  {
    const { context, page } = await setUp({ viewport:{ width:1440, height:1040 } });
    assert.equal(await page.locator('[data-game-level]').count(), 6);
    if (shots) await page.screenshot({ path:join(shots,'01-desktop-ready.png') });
    await page.locator(action('play')).click();
    await mode(page, 'play');
    const spawn = await state(page);
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(x => window.__gameQA.current.p.x > x+30, spawn.x);
    await page.keyboard.press('Space');
    await page.waitForFunction(y => window.__gameQA.current.p.y < y-20, spawn.y);
    await page.keyboard.up('ArrowRight');
    await page.keyboard.press('KeyP');
    await mode(page, 'paused');
    const paused = await state(page);
    const timeLabel = await page.locator(value('timer')).textContent();
    await wait(1150);
    assert.deepEqual(await state(page), paused);
    assert.equal(await page.locator(value('timer')).textContent(), timeLabel);
    await page.keyboard.press('Escape');
    await mode(page, 'play');
    await page.waitForFunction(t => window.__gameQA.current.time < t, paused.time);
    await page.locator(action('sound')).click();
    assert.equal(await page.locator(action('sound')).getAttribute('aria-pressed'), 'false');
    console.log('Desktop: 6 chapters displayed; arrow movement, Space jump, paused clock, resume, and mute passed.');

    assert.equal(await page.locator('[data-game-board] .lb-row').count(), 0);
    // Shortcut through the checkpoints only in this browser fixture. Full traversal
    // and Boss combat are separately covered by the input-driven core tests.
    await page.evaluate(async () => {
      const { confirm, step } = await import('/assets/game-core.js');
      const s = window.__gameQA.current;
      for (let i=0;i<6;i++) {
        if (s.index !== i) throw Error('Unexpected test fixture chapter');
        s.score += 1000;
        s.count = s.level.bonus;
        s.totalPages += s.count;
        s.certificates++;
        if (s.boss) s.boss.dead = true;
        s.p.x = s.level.end;
        step(s);
        if (i<5) confirm(s);
      }
    });
    await mode(page, 'won');
    assert.match(await page.locator(value('title')).textContent(), /中标成功/);
    await page.locator('[data-game-board] .lb-row:not(.lb-personal)').first().waitFor();
    assert.match(await page.locator('[data-game-board] .lb-personal').textContent(), /个人最好成绩/);
    if (shots) await page.screenshot({ path:join(shots,'03-desktop-victory.png') });
    await wait(350);
    assert.equal(await page.locator('[data-game-board] .lb-row:not(.lb-personal)').count(), 1);
    await page.locator('[data-nav="how"]').click();
    await page.locator(cabinet).waitFor({ state:'detached' });
    const departed = await state(page);
    await wait(180);
    assert.equal((await state(page)).frames, departed.frames);
    await page.locator('[data-nav="game"]').click();
    await mode(page, 'ready');
    await page.locator('[data-game-board] .lb-row:not(.lb-personal)').first().waitFor();
    assert.equal(await page.locator('[data-game-board] .lb-row:not(.lb-personal)').count(), 1);
    await page.reload();
    await mode(page, 'ready');
    await page.locator('[data-game-board] .empty', { hasText:'还没有成绩' }).waitFor();
    console.log('Route + demo leaderboard: fixture victory inserts one row, re-entry keeps it, reload clears it, and old engine stops on exit.');
    await page.locator('#logout-btn').click();
    await page.waitForURL(url => url.hash === '#/');
    await page.locator(cabinet).waitFor({ state:'detached' });
    await page.locator('[data-nav="game"]').click();
    await page.waitForURL(/#\/login$/);
    assert.equal(await page.locator(cabinet).count(), 0);
    console.log('Route access: after signing out, revisiting the game redirects to login.');
    await context.close();
  }
  {
    const { context, page } = await setUp({ viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true, deviceScaleFactor:2 });
    await page.locator(action('play')).tap();
    await mode(page, 'play');
    if (shots) await page.screenshot({ path:join(shots,'02-mobile-play.png'), fullPage:true });
    const spawn = await state(page);
    let overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false, 'narrow screen should not scroll sideways');
    const point = async (key, id) => {
      const box = await page.locator(`[data-game-control="${key}"]`).boundingBox();
      assert.ok(box && box.width>=44 && box.height>=44);
      return { x:box.x+box.width/2, y:box.y+box.height/2, id };
    };
    const right = await point('right', 1), jump = await point('jump', 2);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[right] });
    await cdp.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[right, jump] });
    await page.waitForFunction(({x,y}) => window.__gameQA.current.p.x > x+22 && window.__gameQA.current.p.y < y-20, spawn);
    assert.equal(await page.locator('[data-game-control][data-held]').count(), 2);
    await cdp.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
    assert.equal(await page.locator('[data-game-control][data-held]').count(), 0);
    console.log('390 px touch viewport: no horizontal overflow; real browser two-contact movement + jump and release passed.');
    await context.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  console.log('Chrome verification passed; no page/console errors or external HTTP requests.');
} finally {
  try { await browser?.close(); } finally { await new Promise(resolve => server.close(resolve)); }
}
