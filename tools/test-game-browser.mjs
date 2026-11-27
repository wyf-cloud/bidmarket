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
const board = '[data-game-board]';
const rows = page => page.locator(`${board} tbody tr`);
const receipt = page => page.locator(action('submission'));
const shot = (page, name) => shots && page.screenshot({ path:join(shots,name+'.png'), fullPage:true });
const value = key => `[data-game-value="${key}"]`;
const action = key => `[data-game="${key}"]`;
const state = page => page.evaluate(() => {
  const p = window.__gameQA.current.p;
  return { x:p.x, y:p.y, time:window.__gameQA.current.time, frames:window.__gameQA.frames };
});
const mode = (page, name) => page.locator(`${cabinet}[data-game-mode="${name}"]`).waitFor();

async function assertNarrowLayout(page, width, label, selectors) {
  const layout = await page.evaluate(selectors => ({
    viewport:innerWidth,
    documentWidth:document.documentElement.scrollWidth,
    overflow:selectors.flatMap(selector => {
      const element = document.querySelector(selector);
      if (!element || !element.getClientRects().length) return [`${selector}: not visible`];
      const {left,right} = element.getBoundingClientRect();
      const parent = element.parentElement.getBoundingClientRect();
      return left < Math.max(0,parent.left)-1 || right > Math.min(innerWidth,parent.right)+1
        ? [`${selector}: [${left},${right}] outside [${parent.left},${parent.right}]`]
        : [];
    })
  }), selectors);
  assert.equal(layout.viewport, width, `${label}: layout viewport must not grow`);
  assert.ok(layout.documentWidth <= width, `${label}: document ${layout.documentWidth}px exceeds ${width}px`);
  assert.deepEqual(layout.overflow, [], `${label}: game content must fit its container`);
}

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
  await page.evaluate(async () => {
    const { createDemoClient } = await import('/assets/demo.js');
    const db = createDemoClient();
    const prototype = Object.getPrototypeOf(db.from('game_scores'));
    const original = prototype._run;
    const qa = window.__boardQA = { inserts:[], held:[], hold:false, fail:false, readError:false };
    qa.seed = entries => original.call(db.from('game_scores').insert(entries));
    prototype._run = async function () {
      if (this.table === 'game_scores' && this.op === 'insert') {
        qa.inserts.push({ ...this.payload });
        if (qa.hold) await new Promise(release => qa.held.push(release));
        if (qa.fail) return { data:null, error:{ message:'测试：成绩登记失败' } };
      }
      if (this.table === 'game_scores' && this.op === 'select' && qa.readError) {
        return { data:null, error:{ message:'测试：榜单读取失败' } };
      }
      return original.call(this);
    };
  });
  return { context, page };
}

try {
  browser = await chromium.launch({ headless:true, executablePath:process.env.GAME_CHROME || undefined });
  {
    const { context, page } = await setUp({ viewport:{ width:1440, height:1040 } });
    assert.equal(await page.locator('[data-game-level]').count(), 6);
    await shot(page,'01-desktop-ready');
    assert.equal(await page.locator(action('stats')).isVisible(), false);
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
    await shot(page,'02-desktop-play');
    console.log('Desktop: 6 chapters displayed; arrow movement, Space jump, paused clock, resume, and mute passed.');

    assert.equal(await rows(page).count(), 0);
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
    await rows(page).first().waitFor();
    assert.match(await page.locator('[data-game-board] .lb-personal').textContent(), /个人最好成绩/);
    await page.locator(`${action('submission')}[data-state="saved"]:visible`).waitFor();
    assert.equal(await page.locator(value('endCert')).textContent(), '6');
    if (shots) await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-scene="won"] .game-docket')).opacity === '1');
    await shot(page,'03-desktop-victory');
    await wait(350);
    assert.equal(await rows(page).count(), 1);
    await page.locator('[data-nav="how"]').click();
    await page.locator(cabinet).waitFor({ state:'detached' });
    const departed = await state(page);
    await wait(180);
    assert.equal((await state(page)).frames, departed.frames);
    await page.locator('[data-nav="game"]').click();
    await mode(page, 'ready');
    await rows(page).first().waitFor();
    assert.equal(await rows(page).count(), 1);
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
    const { context, page } = await setUp({ viewport:{ width:1440, height:1040 } });
    const records = rows(page);
    await page.locator('[data-game-board] .empty', { hasText:'还没有成绩' }).waitFor();
    await page.locator(action('play')).click();
    await mode(page, 'play');
    assert.equal(await page.locator(value('health')).getAttribute('aria-label'), '生命 3 / 3');
    for (const [index, key] of ['Enter', 'Space'].entries()) {
      const score = 725+index*100;
      await page.evaluate(async score => {
        const { confirm, step } = await import('/assets/game-core.js');
        const s = window.__gameQA.current;
        s.count = s.level.required;
        s.p.x = s.level.end;
        step(s);
        if (s.mode !== 'clear') throw Error('Expected a chapter-one checkpoint');
        confirm(s);
        s.score = score;
      }, score);
      await page.locator(value('chapter'), { hasText:'02 / 06' }).waitFor();
      assert.equal(await page.locator(value('health')).getAttribute('aria-label'), '生命 3 / 3');
      const hitEnemy = hp => page.evaluate(hp => {
        const s = window.__gameQA.current;
        const floor = s.level.solids[0].y;
        const foe = s.enemies.find(e => e.kind === 'bug');
        if (!foe) throw Error('Expected an enemy for the contact fixture');
        if (!hp) s.duration = 17;
        Object.assign(s.p, { x:82, y:floor-s.p.h, vx:0, vy:0, flash:0, shield:0, buffer:0, coyote:0 });
        Object.assign(foe, { home:s.p.x+8, base:floor, range:0, y:floor-foe.h, dead:false });
      }, hp);
      for (const hp of [2,1,0]) {
        if (!hp) await page.keyboard.down(key);
        await hitEnemy(hp);
        await page.waitForFunction(hp => window.__gameQA.current.p.hp === hp, hp);
        if (hp) await mode(page, 'play');
      }
      await mode(page, 'lost');
      assert.equal(await page.locator(value('title')).textContent(), '本局结算');
      assert.equal(await page.locator(value('health')).textContent(), '♡♡♡');
      assert.equal(await page.locator(value('copy')).textContent(), '三颗心已耗尽。本局止于第 2 章「打印室危机」。');
      assert.equal(await page.locator(value('endScore')).textContent(), String(score));
      assert.equal(await page.locator(value('endTime')).textContent(), '00:17');
      assert.equal(await page.locator(value('buttonHint')).textContent(), '再来一局');
      const row = records.filter({has:page.getByRole('cell',{name:String(score),exact:true})});
      await row.waitFor();
      assert.equal(await row.locator('td').nth(2).textContent(), '02 章');
      assert.match(await page.locator(`${board} .lb-personal`).textContent(), /第 2 章/);
      assert.equal(await receipt(page).getAttribute('data-state'), 'saved');
      const frozen = await page.evaluate(() => {
        const { index, time, duration, result } = window.__gameQA.current;
        return { index, time, duration, result };
      });
      if (index === 0) await shot(page,'04-desktop-settlement');
      for (let i=0;i<6;i++) { await page.keyboard.down(key); await wait(55); }
      await page.keyboard.up(key);
      // Assert after releasing, too: a focused HTML button can activate on Space keyup.
      await wait(120);
      assert.equal(await page.locator(cabinet).getAttribute('data-game-mode'), 'lost');
      assert.deepEqual(await page.evaluate(() => {
        const { index, time, duration, result } = window.__gameQA.current;
        return { index, time, duration, result };
      }), frozen);
      assert.equal(await records.count(), index+1);
      assert.equal(await page.evaluate(() => window.__boardQA.inserts.length), index+1);
      if (index === 0) await page.keyboard.press(key);
      else await page.locator(action('play')).click();
      await mode(page, 'play');
      assert.equal(await page.locator(value('chapter')).textContent(), '01 / 06');
      assert.equal(await page.locator(value('health')).getAttribute('aria-label'), '生命 3 / 3');
      assert.equal(await page.locator(value('score')).textContent(), '0');
    }
    console.log('Settlement: three enemy hits end each run; score posts once, Enter and Space hold/release cannot restart, and replay starts at chapter one with three hearts.');
    await context.close();
  }
  {
    const { context, page } = await setUp({ viewport:{ width:1440, height:1040 } });
    const timeout = score => page.evaluate(score => {
      const s = window.__gameQA.current;
      s.score=score; s.time=0; s.duration=12;
    },score);
    await page.evaluate(() => { window.__boardQA.hold=true; });
    await page.locator(action('play')).click();
    await timeout(240);
    await mode(page,'lost');
    await page.locator(`${action('submission')}[data-state="pending"]:visible`).waitFor();
    await page.locator(action('play')).click();
    await mode(page,'play');
    assert.equal(await receipt(page).isVisible(), false);
    await page.evaluate(() => { window.__boardQA.hold=false; window.__boardQA.fail=true; });
    await timeout(480);
    await mode(page,'lost');
    await page.locator(`${action('submission')}[data-state="error"]:visible`).waitFor();
    await page.evaluate(() => { const qa=window.__boardQA; qa.fail=false; qa.held.shift()(); });
    await rows(page).first().waitFor();
    assert.equal(await receipt(page).getAttribute('data-state'), 'error', 'older success must not replace the latest receipt');
    assert.deepEqual(await page.evaluate(() => window.__boardQA.inserts.map(row=>row.score)), [240,480]);
    await page.evaluate(async () => {
      const base={score:1400, created_at:'2026-01-01T00:00:00Z'};
      await window.__boardQA.seed([
        {...base,id:'order-0',user_id:'u1',level:3,duration_sec:35},
        {...base,id:'order-2',user_id:'u2',level:4,duration_sec:33},
        {...base,id:'order-4',user_id:'u3',level:4,duration_sec:28},
        {...base,id:'order-3',user_id:'u1',level:4,duration_sec:28},
        {...base,id:'order-1',user_id:'u2',level:4,duration_sec:28,created_at:'2025-12-31T12:00:00Z'},
        {id:'long',user_id:'u1',level:6,score:12900,duration_sec:103,created_at:base.created_at}
      ]);
    });
    const mine = page.locator('[data-board-scope="mine"]');
    const all = page.locator('[data-board-scope="all"]');
    await mine.click();
    await rows(page).filter({hasText:'12,900'}).waitFor();
    assert.equal(await mine.getAttribute('aria-pressed'),'true');
    assert.equal(await rows(page).count(),4);
    assert.equal(await page.locator(`${board} .game-podium`).count(),0);
    await page.evaluate(() => { window.__boardQA.readError=true; });
    await all.click();
    const retry = page.locator('[data-board-retry]');
    await retry.waitFor();
    await page.evaluate(() => { window.__boardQA.readError=false; });
    await retry.click();
    await rows(page).nth(6).waitFor();
    assert.equal(await all.getAttribute('aria-pressed'),'true');
    const ranking = await rows(page).evaluateAll(nodes=>nodes.map(row=>[...row.cells].slice(1).map(cell=>cell.firstChild.textContent)));
    assert.deepEqual(ranking.map(c=>c.slice(0,3)), [
      ['张工','06 章','01:43'],['李工','04 章','00:28'],['张工','04 章','00:28'],
      ['王工','04 章','00:28'],['李工','04 章','00:33'],['张工','03 章','00:35'],['张工','01 章','00:12']
    ]);
    await page.locator('[data-game-board-jump]').click();
    assert.equal(await page.evaluate(()=>document.activeElement.id),'game-board-heading');
    if (shots) {
      await page.locator('#toast').waitFor({ state:'hidden' });
      await page.locator('.game-board').screenshot({ path:join(shots,'05-desktop-leaderboard.png') });
    }
    console.log('Leaderboard: pending/success/failure, stale receipt protection, two scopes, all tie breakers, retry, and board focus passed.');
    await context.close();
  }
  {
    const width = 390;
    const { context, page } = await setUp({ viewport:{ width, height:844 }, isMobile:true, hasTouch:true, deviceScaleFactor:2 });
    const scene = ['.game-cabinet', '.game-scene', '#game-canvas'];
    await assertNarrowLayout(page, width, 'Mobile title', [...scene, '.game-cover', '.game-overlay .game-docket']);
    await shot(page,'07-mobile-ready');
    await page.locator(action('play')).tap();
    await mode(page, 'play');
    await assertNarrowLayout(page, width, 'Mobile gameplay', scene);
    await shot(page,'06-mobile-play');
    const spawn = await state(page);
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
    await page.evaluate(() => {
      const s = window.__gameQA.current;
      s.score = 12900;
      s.time = 0;
    });
    await mode(page, 'lost');
    await rows(page).first().waitFor();
    await assertNarrowLayout(page, width, 'Mobile leaderboard', ['.game-board', '.game-podium', '.game-score-table']);
    if (shots) await page.locator('.game-board').screenshot({ path:join(shots,'08-mobile-leaderboard.png') });
    console.log('390 px touch viewport: title, gameplay and populated leaderboard fit; two-contact movement + jump and release passed.');
    await context.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  console.log('Chrome verification passed; no page/console errors or external HTTP requests.');
} finally {
  try { await browser?.close(); } finally { await new Promise(resolve => server.close(resolve)); }
}
