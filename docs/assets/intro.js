/* ============================================================
   进站动画：粒子聚合成字
   - 只在每个会话首次进入时播放
   - 尊重系统「减少动态效果」
   - 全过程约 1.8 秒，不阻塞交互
   ============================================================ */

const TEXT = '公益标书';
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

  // 用离屏画布把文字画成点阵，得到粒子目标坐标
  const off = document.createElement('canvas');
  off.width = W;
  off.height = H;
  const octx = off.getContext('2d');

  const fontSize = Math.min(W * 0.17, 150);
  octx.fillStyle = '#fff';
  octx.textAlign = 'center';
  octx.textBaseline = 'middle';
  octx.font = `600 ${fontSize}px "Songti SC", "SimSun", "Noto Serif SC", serif`;
  octx.fillText(TEXT, W / 2, H / 2);

  const step = W > 900 ? 5 : 7;
  const data = octx.getImageData(0, 0, W, H).data;
  const raw = [];
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      if (data[(y * W + x) * 4 + 3] > 128) raw.push([x, y]);
    }
  }

  // 控制粒子总数，低端机也不掉帧
  const MAX = W > 900 ? 1500 : 800;
  const stride = Math.max(1, Math.ceil(raw.length / MAX));
  const pts = raw.filter((_, i) => i % stride === 0);

  if (!pts.length) { el.remove(); return; }

  const parts = pts.map(([x, y]) => ({
    x: x + (Math.random() - 0.5) * W * 1.2,
    y: y + (Math.random() - 0.5) * H * 1.2,
    tx: x,
    ty: y,
    r: Math.random() * 1.5 + 0.6,
    c: Math.random() < 0.07 ? '#c4553f' : '#f6f2e9',
    d: Math.random() * 0.45
  }));

  const DUR = 1150;
  const HOLD = 420;
  const ease = t => 1 - Math.pow(1 - t, 3);
  const start = performance.now();

  const frame = (now) => {
    const t = now - start;
    const k = Math.min(1, t / DUR);

    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, W, H);

    for (const p of parts) {
      const local = Math.min(1, Math.max(0, (k - p.d) / (1 - p.d)));
      const e = ease(local);
      const x = p.x + (p.tx - p.x) * e;
      const y = p.y + (p.ty - p.y) * e;
      ctx.globalAlpha = 0.2 + 0.8 * e;
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(x, y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (t < DUR + HOLD) {
      requestAnimationFrame(frame);
    } else {
      el.classList.add('hide');
      setTimeout(() => el.remove(), 520);
    }
  };

  requestAnimationFrame(frame);
}
