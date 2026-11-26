/* ============================================================
   标书员大冒险 · 横版过关小游戏
   画布 960×576，瓦片 48×48，共 12 行、6 关
   主题：收集评分点、躲开废标陷阱和竞争对手、把标书送到开标现场
   ============================================================ */

const TILE = 48;
const ROWS = 12;
const VIEW_W = 960;
const VIEW_H = ROWS * TILE;

const GRAVITY = 2300;
const JUMP_V = -900;
const RUN = 340;
const MAX_FALL = 1150;

/* ---------------- 关卡地图 ----------------
   #  文件柜/纸堆（实心）
   o  评分点（红章，+100）
   E  竞争对手（可踩）
   ^  废标陷阱（碰到掉命）
   P  出生点
   F  开标现场（终点旗帜）
--------------------------------------------- */
const LEVELS = [
// 第 1 关 · 熟悉环境
`............................................................................................
............................................................................................
.....................o....................o....................o..........................
............................................................................................
...................................##...........##......................................o...
.............o..............................................................................
.............................................o.............................................
.........................o..........................o....................................
................##............................##.......................##..................
..........E.....................................................o..............o...........
............................................................................................
############################################################################################`,

// 第 2 关 · 跨过碎纸机
`............................................................................................
............................................................................................
..........o..............o...............o...............o...............o.................
..................................##......................##...............................o
......................##.........................................o.........................
......o....................................................##..........o...................
..............##............................o......................##........................
..........................o......................##........................................
........E......................##....................E.................o....................
.....................^^.........................^^.............................^^...........
............................................................................................
################################################################..######...############....################################################################`,

// 第 3 关 · 复印室
`............................................................................................
............................................................................................
.......o...........o.............o...........o.............o...........o...................
....................##........................##........................##.................
............##.........................##.......................##.........................
.....o..................##...........................##........................o...........
..............E.........................E...........................E.......................
..........................^^..............o.................^^..............................
....##..................####..............####..............####.............o.............
...............o...........................................................................
...............................................................o...........................
##################################################################################################`,

// 第 4 关 · 加急件
`............................................................................................
............................................................................................
......o...............................o...............................o......................
..............##..............##..............##..............##..............##.............
......................................o.......................................o.............
.....o..............o.............................o............................o.............
.......................E...............................E...............................E...
..........^^................................^^................................^^............
....##......................##......................##......................##..............
...............o.......................o.......................o.......................o...
............................................................................................
############################################################################################`,

// 第 5 关 · 废标车间
`............................................................................................
............................................................................................
....o...........o.............o...........o.............o...........o.............o.........
............##....................##....................##....................##............
..................o......................o......................o......................o...
.....##......................##......................##......................##.............
..........E...........E..............E...........E..............E...........E...............
....^^.............^^.............^^.............^^.............^^.............^^............
..................##......................##......................##.......................
.......o...................o...................o...................o...................o...
............................................................................................
############################################################################################`,

// 第 6 关 · 开标冲刺
`............................................................................................
............................................................................................
..o.........o.........o.........o.........o.........o.........o.........o.........o.........
............##....................##....................##....................##............
...............o.......................o.......................o.......................o...
......##......................##......................##......................##............
..........E..........E..............E..........E..............E..........E..............E...
....^^..............^^..............^^..............^^..............^^..............^^.......
...................##......................##......................##.....................
........o....................o....................o....................o..................o
............................................................................................
############################################################################################`
];

/* ---------------- 地图解析 ---------------- */
function normalize(rows) {
  const w = Math.max(...rows.map(r => r.length));
  return rows.map(r => r.padEnd(w, '.'));
}

function parseLevel(map) {
  const rows = normalize(map.trim().split('\n'));
  const tiles = rows.map(r => r.split(''));
  const width = tiles[0].length;
  const spawn = { x: TILE * 1.2, y: 0 };
  const stamps = [];
  const enemies = [];
  const spikes = [];
  let flag = { x: width * TILE - TILE / 2 };

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < width; x++) {
      const c = tiles[y][x];
      if (c === 'P') { spawn = { x: x * TILE + 12, y: y * TILE }; tiles[y][x] = '.'; }
      else if (c === 'o') { stamps.push({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, got: false }); tiles[y][x] = '.'; }
      else if (c === 'E') { enemies.push({ x: x * TILE + 8, y: y * TILE, w: 30, h: 44, vx: -75, dead: false }); tiles[y][x] = '.'; }
      else if (c === '^') { spikes.push({ x: x * TILE, y: y * TILE }); }
      else if (c === 'F') { flag = { x: x * TILE + TILE / 2 }; }
    }
  }
  return { tiles, width, spawn, stamps, enemies, spikes, flag };
}

function solid(tiles, width, px, py) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  if (ty < 0) return false;
  if (ty >= ROWS) return false;
  if (tx < 0 || tx >= width) return true;
  return tiles[ty][tx] === '#';
}

/* ---------------- 游戏主体 ---------------- */
export function startGame(canvas, hooks = {}) {
  const ctx = canvas.getContext('2d');
  const input = { left: false, right: false, jumpQueued: false };

  let level = null;
  let levelIndex = 0;
  let score = 0;
  let lives = 3;
  let status = 'play';          // play | levelclear | over
  let player = {};
  let camX = 0;
  let levelTime = 0;
  let totalTime = 0;
  let invuln = 0;
  let clearTimer = 0;
  let facing = 1;
  let finished = false;
  let raf = 0;
  let last = 0;

  const keys = new Set();
  const onKeyDown = (e) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' '].includes(e.key)) e.preventDefault();
    keys.add(e.key);
    if (e.key === 'ArrowUp' || e.key === ' ') input.jumpQueued = true;
  };
  const onKeyUp = (e) => keys.delete(e.key);

  function loadLevel(i) {
    levelIndex = i;
    level = parseLevel(LEVELS[i]);
    player = {
      x: level.spawn.x, y: level.spawn.y,
      w: 26, h: 44, vx: 0, vy: 0,
      grounded: false
    };
    camX = 0;
    levelTime = 0;
    invuln = 1;
    clearTimer = 0;
    status = 'play';
  }

  function hurt() {
    if (status !== 'play' || invuln > 0) return;
    lives -= 1;
    if (lives <= 0) {
      status = 'over';
      finishRun();
    } else {
      loadLevel(levelIndex);
    }
  }

  function finishRun() {
    if (finished) return;
    finished = true;
    stop();
    if (hooks.onFinish) {
      hooks.onFinish({ score, level: Math.min(levelIndex + 1, 6), duration: Math.round(totalTime) });
    }
  }

  function clearLevel() {
    if (status !== 'play') return;
    const bonus = Math.max(200, 1000 - Math.round(levelTime) * 10);
    score += bonus;
    status = 'levelclear';
    clearTimer = 1.5;
    if (levelIndex + 1 >= LEVELS.length) {
      setTimeout(() => finishRun(), 1500);
    }
  }

  function step(dt) {
    if (status === 'play') {
      levelTime += dt;
      totalTime += dt;
      if (invuln > 0) invuln -= dt;

      // 输入
      if (input.left && !input.right) player.vx = -RUN;
      else if (input.right && !input.left) player.vx = RUN;
      else player.vx = 0;
      if (player.vx !== 0) facing = player.vx > 0 ? 1 : -1;

      if (input.jumpQueued) {
        if (player.grounded) { player.vy = JUMP_V; player.grounded = false; }
        input.jumpQueued = false;
      }

      player.vy = Math.min(player.vy + GRAVITY * dt, MAX_FALL);

      // 水平移动 + 碰撞
      player.x += player.vx * dt;
      if (player.x < 0) player.x = 0;
      if (player.x + player.w > level.width * TILE) player.x = level.width * TILE - player.w;
      if (player.vx !== 0) {
        const edge = player.vx > 0 ? player.x + player.w : player.x;
        if (solid(level.tiles, level.width, edge, player.y + 4) ||
            solid(level.tiles, level.width, edge, player.y + player.h - 4)) {
          player.x = player.vx > 0
            ? Math.floor(edge / TILE) * TILE - player.w - 0.5
            : Math.floor(edge / TILE) * TILE + TILE + 0.5;
          player.vx = 0;
        }
      }

      // 垂直移动 + 碰撞
      player.y += player.vy * dt;
      player.grounded = false;
      if (player.vy >= 0) {
        const foot = player.y + player.h;
        if (solid(level.tiles, level.width, player.x + 6, foot) ||
            solid(level.tiles, level.width, player.x + player.w - 6, foot)) {
          player.y = Math.floor(foot / TILE) * TILE - player.h;
          player.vy = 0;
          player.grounded = true;
        }
      } else {
        const head = player.y;
        if (solid(level.tiles, level.width, player.x + 6, head) ||
            solid(level.tiles, level.width, player.x + player.w - 6, head)) {
          player.y = Math.floor(head / TILE) * TILE + TILE;
          player.vy = 0;
        }
      }

      // 掉出地图
      if (player.y > VIEW_H + 80) hurt();

      // 评分点
      for (const s of level.stamps) {
        if (s.got) continue;
        const dx = s.x - (player.x + player.w / 2);
        const dy = s.y - (player.y + player.h / 2);
        if (dx * dx + dy * dy < (34 * 34)) {
          s.got = true;
          score += 100;
        }
      }

      // 陷阱
      for (const sp of level.spikes) {
        const px = player.x + player.w / 2;
        const py = player.y + player.h / 2;
        if (px > sp.x + 8 && px < sp.x + TILE - 8 &&
            py > sp.y + 18 && py < sp.y + TILE - 2) hurt();
      }

      // 竞争对手
      for (const e of level.enemies) {
        if (e.dead) continue;
        e.vy = (e.vy || 0) + GRAVITY * dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        const foot = e.y + e.h;
        if (solid(level.tiles, level.width, e.x + 4, foot) ||
            solid(level.tiles, level.width, e.x + e.w - 4, foot)) {
          e.y = Math.floor(foot / TILE) * TILE - e.h;
          e.vy = 0;
        }
        const ahead = e.vx > 0 ? e.x + e.w + 2 : e.x - 2;
        if (solid(level.tiles, level.width, ahead, e.y + e.h - 6) ||
            solid(level.tiles, level.width, ahead, e.y + 4)) {
          e.vx = -e.vx;
        }
        if (e.y > VIEW_H + 100) { e.dead = true; continue; }

        const overlap =
          player.x < e.x + e.w && player.x + player.w > e.x &&
          player.y < e.y + e.h && player.y + player.h > e.y;
        if (overlap) {
          if (player.vy > 0 && player.y + player.h - e.y < 20) {
            e.dead = true;
            player.vy = -520;
            score += 50;
          } else {
            hurt();
          }
        }
      }

      // 终点（开标现场）：到达旗帜所在列即过关
      const fx = level.flag.x;
      if (player.x + player.w / 2 >= fx - 26 && player.y + player.h > 11 * TILE - 150) {
        clearLevel();
      }

      // 镜头
      const target = player.x + player.w / 2 - VIEW_W * 0.4;
      const maxCam = level.width * TILE - VIEW_W;
      camX = Math.max(0, Math.min(target, Math.max(0, maxCam)));
    } else if (status === 'levelclear') {
      clearTimer -= dt;
      if (clearTimer <= 0 && levelIndex + 1 < LEVELS.length) {
        loadLevel(levelIndex + 1);
      }
    }
  }

  /* ---------------- 绘制 ---------------- */
  function draw() {
    // 背景
    ctx.fillStyle = '#f4f1ea';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // 远景档案柜剪影
    ctx.fillStyle = '#eae3d3';
    for (let i = 0; i < 6; i++) {
      const x = ((i * 260 - camX * 0.25) % (VIEW_W + 260) + VIEW_W + 260) % (VIEW_W + 260) - 130;
      ctx.fillRect(x, VIEW_H - 210, 150, 210);
    }

    ctx.save();
    ctx.translate(-Math.round(camX), 0);

    // 地块
    for (let y = 0; y < ROWS; y++) {
      for (let x = Math.floor(camX / TILE); x < Math.min(level.width, Math.ceil((camX + VIEW_W) / TILE) + 1); x++) {
        const c = level.tiles[y][x];
        if (c === '#') drawBlock(x * TILE, y * TILE);
      }
    }

    // 陷阱
    for (const sp of level.spikes) drawSpike(sp.x, sp.y);

    // 评分点
    for (const s of level.stamps) {
      if (!s.got) drawStamp(s.x, s.y);
    }

    // 竞争对手
    for (const e of level.enemies) {
      if (!e.dead) drawRival(e);
    }

    // 终点旗帜
    drawFlag(level.flag.x);

    // 玩家（无敌期闪烁）
    if (status !== 'over') {
      if (invuln > 0 && Math.floor(invuln * 12) % 2 === 0) {
        /* 闪烁：跳过一次绘制 */
      } else {
        drawPlayer(player, facing, performance.now());
      }
    }

    ctx.restore();

    // HUD
    drawHud();

    // 过关 / 结束遮罩
    if (status === 'levelclear') {
      ctx.fillStyle = 'rgba(31,27,22,.55)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.fillStyle = '#f6f2e9';
      ctx.font = '600 44px "Songti SC", "SimSun", serif';
      ctx.textAlign = 'center';
      ctx.fillText(`第 ${levelIndex + 1} 关完成`, VIEW_W / 2, VIEW_H / 2 - 8);
      ctx.font = '16px "Songti SC", "SimSun", serif';
      ctx.fillText(levelIndex + 1 >= LEVELS.length ? '全部通关，成绩已记录' : '准备进入下一关…', VIEW_W / 2, VIEW_H / 2 + 30);
    } else if (status === 'over') {
      ctx.fillStyle = 'rgba(31,27,22,.6)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.fillStyle = '#f6f2e9';
      ctx.font = '600 40px "Songti SC", "SimSun", serif';
      ctx.textAlign = 'center';
      ctx.fillText('游戏结束', VIEW_W / 2, VIEW_H / 2 - 16);
      ctx.font = '16px "Songti SC", "SimSun", serif';
      ctx.fillText(`最终得分 ${score} · 到达第 ${levelIndex + 1} 关`, VIEW_W / 2, VIEW_H / 2 + 18);
    }
  }

  function drawBlock(x, y) {
    ctx.fillStyle = '#eee7d8';
    ctx.fillRect(x, y, TILE, TILE);
    ctx.strokeStyle = 'rgba(31,27,22,.14)';
    ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    ctx.strokeStyle = 'rgba(31,27,22,.08)';
    ctx.beginPath();
    ctx.moveTo(x + 4, y + TILE / 3);
    ctx.lineTo(x + TILE - 4, y + TILE / 3);
    ctx.moveTo(x + 4, y + (TILE * 2) / 3);
    ctx.lineTo(x + TILE - 4, y + (TILE * 2) / 3);
    ctx.stroke();
    // 顶面纸页
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fillRect(x, y, TILE, 5);
  }

  function drawSpike(x, y) {
    ctx.fillStyle = '#9e3b2f';
    ctx.beginPath();
    ctx.moveTo(x + 4, y + TILE);
    ctx.lineTo(x + TILE / 2, y + 12);
    ctx.lineTo(x + TILE - 4, y + TILE);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7c2d24';
    ctx.beginPath();
    ctx.moveTo(x + 12, y + TILE);
    ctx.lineTo(x + TILE / 2, y + 26);
    ctx.lineTo(x + TILE - 12, y + TILE);
    ctx.closePath();
    ctx.fill();
  }

  function drawStamp(x, y) {
    ctx.fillStyle = '#9e3b2f';
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f6f2e9';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 6, y - 6, 12, 12);
    ctx.lineWidth = 1;
  }

  function drawRival(e) {
    ctx.fillStyle = '#565b63';
    ctx.fillRect(e.x, e.y + e.h - 10, 8, 10);
    ctx.fillRect(e.x + e.w - 8, e.y + e.h - 10, 8, 10);
    ctx.fillRect(e.x + 2, e.y + 14, e.w - 4, e.h - 24);
    ctx.fillStyle = '#8d9299';
    ctx.fillRect(e.x + 6, e.y, e.w - 12, 16);
    ctx.fillStyle = '#1f1b16';
    ctx.fillRect(e.x + 8, e.y + 6, 4, 3);
    ctx.fillRect(e.x + e.w - 12, e.y + 6, 4, 3);
  }

  function drawFlag(x) {
    const base = 11 * TILE;
    ctx.fillStyle = '#7a4a21';
    ctx.fillRect(x - 2, base - 120, 4, 120);
    ctx.fillStyle = '#9e3b2f';
    ctx.fillRect(x + 2, base - 116, 58, 36);
    ctx.fillStyle = '#f6f2e9';
    ctx.font = '600 16px "Songti SC", "SimSun", serif';
    ctx.textAlign = 'left';
    ctx.fillText('中标', x + 12, base - 91);
  }

  function drawPlayer(p, dir, now) {
    ctx.save();
    ctx.translate(p.x + p.w / 2, p.y + p.h);
    if (dir < 0) ctx.scale(-1, 1);
    const bob = p.grounded && Math.abs(p.vx) > 10 ? Math.sin(now / 90) * 2 : 0;
    // 腿
    ctx.fillStyle = '#2b2f36';
    ctx.fillRect(-11, -8 + (p.grounded ? 0 : 2), 9, 8);
    ctx.fillRect(2, -8 + (p.grounded ? bob : -bob), 9, 8);
    // 西装
    ctx.fillStyle = '#27406b';
    ctx.fillRect(-11, -30, 22, 26);
    // 衬衣与领带
    ctx.fillStyle = '#f2ede1';
    ctx.fillRect(-4, -24, 8, 16);
    ctx.fillStyle = '#9e3b2f';
    ctx.fillRect(-1, -24, 2, 9);
    // 头与头发
    ctx.fillStyle = '#e8c39a';
    ctx.fillRect(-8, -44, 16, 15);
    ctx.fillStyle = '#22242a';
    ctx.fillRect(-8, -46, 16, 5);
    // 公文包
    ctx.fillStyle = '#7a4a21';
    ctx.fillRect(11, -18, 12, 10);
    ctx.fillStyle = '#5d3a1a';
    ctx.fillRect(15, -14, 4, 2);
    ctx.restore();
  }

  function drawHud() {
    const got = level.stamps.filter(s => s.got).length;
    const total = level.stamps.length;
    ctx.fillStyle = 'rgba(255,255,255,.66)';
    ctx.fillRect(12, 10, 430, 30);
    ctx.strokeStyle = 'rgba(31,27,22,.12)';
    ctx.strokeRect(12.5, 10.5, 429, 29);
    ctx.fillStyle = '#1f1b16';
    ctx.font = '600 13px ui-monospace, Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`得分 ${score}`, 22, 30);
    ctx.fillText(`关卡 ${levelIndex + 1}/${LEVELS.length}`, 128, 30);
    ctx.fillText(`评分点 ${got}/${total}`, 232, 30);
    ctx.fillStyle = '#9e3b2f';
    ctx.fillText('♥'.repeat(Math.max(0, lives)), 344, 30);
  }

  /* ---------------- 主循环 ---------------- */
  const STEP = 1 / 120;
  let acc = 0;

  function loop(now) {
    if (!canvas.isConnected) { stop(); return; }
    raf = requestAnimationFrame(loop);
    const dt = Math.min(Math.max((now - last) / 1000, 0), 0.1);
    last = now;
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 8) {
      step(STEP);
      acc -= STEP;
      n++;
    }
    draw();
  }

  function stop() {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  loadLevel(0);
  last = performance.now();
  raf = requestAnimationFrame(loop);

  return {
    setLeft: (v) => { input.left = v; },
    setRight: (v) => { input.right = v; },
    pressJump: () => { input.jumpQueued = true; },
    stop
  };
}
