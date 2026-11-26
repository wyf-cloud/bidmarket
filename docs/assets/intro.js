/* ============================================================
   进站动画 v2：粒子聚字 + 拖尾 + 光扫 + 辉光
   - 每个会话只播一次，尊重「减少动态效果」
   - 总时长约 2.2 秒
   ============================================================ */

const LINES = ['公益标书', '报价接单平台'];
const INK = '#14110e';

export function playIntro() {
  const el = document.getElementById('intro');
  if (!el) return;

  const canvas = el.querySelector('canvas');
  const reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!canvas || reduce || sessionStorage.getItem('intro-played')) {
    el.remove();
    return;
  }
  sessionStorage.setItem('intro-played', '1');

  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth;
  const H = window.innerHeight;

  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);

  // ---- 把两行字画成点阵，作为粒子目标 ----
  const off = document.createElement('canvas');
  off.width = W;
  off.height = H;
  const octx = off.getContext('2d');

  const size = Math.min((W * 0.8) / 6, H * 0.22, 150);
  const gapY = size * 0.62;
  octx.fillStyle = '#fff';
  octx.textAlign = 'center';
  octx.textBaseline = 'middle';
  octx.font = `600 ${size}px "Songti SC", "SimSun", "Noto Serif SC", serif`;
  octx.fillText(LINES[0], W / 2, H / 2 - gapY);
  octx.fillText(LINES[1], W / 2, H / 2 + gapY);

  const step = W > 900 ? 4 : 6;
  const data = octx.getImageData(0, 0, W, H).data;
  const raw = [];
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      if (data[(y * W + x) * 4 + 3] > 128) raw.push([x, y]);
    }
  }

  const MAX = W > 900 ? 1800 : 900;
  const stride = Math.max(1, Math.ceil(raw.length / MAX));
  const pts = raw.filter((_, i) => i % stride === 0);
  if (!pts.length) { el.remove(); return; }

  const parts = pts.map(([x, y]) => ({
    x: x + (Math.random() - 0.5) * W * 1.35,
    y: y + (Math.random() - 0.5) * H * 1.35,
    tx: x,
    ty: y,
    r: Math.random() * 1.4 + 0.55,
    c: Math.random() < 0.07 ? '#c4553f' : (Math.random() < 0.12 ? '#e9c48f' : '#f6f2e9'),
    d: Math.random() * 0.4,
    sw: Math.random() * Math.PI * 2
  }));

  const DUR = 1000;
  const SWEEP = 460;
  const HOLD = 260;
  const ease = t => 1 - Math.pow(1 - t, 3);
  const start = performance.now();

  const frame = (now) => {
    const t = now - start;
    const k = Math.min(1, t / DUR);

    // 拖尾：每次只盖一层半透明底色，旧光点会自然衰减
    ctx.fillStyle = 'rgba(20, 17, 14, 0.3)';
    ctx.fillRect(0, 0, W, H);

    for (const p of parts) {
      const local = Math.min(1, Math.max(0, (k - p.d) / (1 - p.d)));
      const e = ease(local);
      const x = p.x + (p.tx - p.x) * e;
      const y = p.y + (p.ty - p.y) * e;

      // 到位后轻微呼吸，避免画面死板
      const breathe = e >= 1 ? 1 + Math.sin(now / 620 + p.sw) * 0.12 : 1;

      ctx.globalAlpha = 0.18 + 0.82 * e;
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(x, y, p.r * breathe, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 成型后一道横向光扫
    const sweepT = (t - DUR) / SWEEP;
    if (sweepT > 0 && sweepT < 1) {
      const sx = sweepT * (W + 520) - 260;
      const g = ctx.createLinearGradient(sx - 240, 0, sx + 240, 0);
      g.addColorStop(0, 'rgba(255, 246, 230, 0)');
      g.addColorStop(0.5, 'rgba(255, 246, 230, 0.26)');
      g.addColorStop(1, 'rgba(255, 246, 230, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // 成型后给字一点暖色辉光
    if (k >= 1) {
      const glow = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, size * 5);
      glow.addColorStop(0, 'rgba(255, 238, 214, 0.12)');
      glow.addColorStop(1, 'rgba(255, 238, 214, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
    }

    if (t < DUR + SWEEP + HOLD) {
      requestAnimationFrame(frame);
    } else {
      el.classList.add('hide');
      setTimeout(() => el.remove(), 520);
    }
  };

  requestAnimationFrame(frame);
}
