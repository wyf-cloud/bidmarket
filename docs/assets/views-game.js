/* ============================================================
   页面：标书员大冒险（小游戏 + 排行榜）
   仅登录会员可玩；成绩自动写入 game_scores
   ============================================================ */
import { db, state, esc, toast, zhError, currentUid, needLogin, fullTime } from './lib.js';
import { startGame } from './game.js';

const app = () => document.getElementById('app');
let activeGame = null;

export async function viewGame() {
  if (!needLogin('登录后才能玩小游戏')) return;

  if (state.profile && state.profile.banned) {
    app().innerHTML = `<div class="panel"><h2>无法游玩</h2>
      <p class="muted">账号已被封禁，暂时不能参与小游戏。</p></div>`;
    return;
  }

  if (activeGame) { try { activeGame.stop(); } catch { /* noop */ } activeGame = null; }

  app().innerHTML = `
    <section class="section">
      <div class="section-head">
        <h2>标书员大冒险</h2>
        <span class="muted small">会员小游戏 · 共 6 关</span>
      </div>

      <div class="game-frame">
        <canvas id="game-canvas" width="960" height="576"></canvas>
        <div class="game-touch">
          <button data-k="left" aria-label="左">◀</button>
          <button data-k="jump" aria-label="跳">跳</button>
          <button data-k="right" aria-label="右">▶</button>
        </div>
      </div>
      <p class="muted small" style="margin-top:12px">
        键盘：← → 移动，空格 / ↑ 跳跃 · 手机：屏幕下方按钮 ·
        踩中「竞争对手」得 50 分，碰到废标陷阱或掉下平台会损失一条命 · 集齐评分点并抵达「中标」旗帜过关
      </p>

      <div class="game-rows">
        <div class="panel">
          <h2>排行榜</h2>
          <p class="sub">通关或游戏结束时自动记录，按得分排序，取前 20 名。</p>
          <div id="lb"><div class="empty">加载中…</div></div>
        </div>
        <div class="panel">
          <h2>故事背景</h2>
          <p class="muted" style="line-height:1.9">
            你是「公益标书报价接单平台」的一名标书员。距开标只剩 6 个工作日，
            办公室里散落着评分点、堆满文件柜，还有四处游走的竞争对手和一碰就废的陷阱。
            <br><br>
            收集评分点，绕过废标陷阱，把标书送到开标现场——<b>中标，就是你的旗帜</b>。
          </p>
        </div>
      </div>
    </section>`;

  const canvas = document.getElementById('game-canvas');

  const g = startGame(canvas, {
    onFinish: async (r) => {
      await saveRun(r);
      await loadBoard();
    }
  });
  activeGame = g;

  // 触屏按钮
  const touch = document.getElementById('game-touch');
  if (touch) {
    const k = (id) => touch.querySelector(`[data-k="${id}"]`);
    const press = (id) => (e) => {
      e.preventDefault();
      if (id === 'left') g.setLeft(true);
      else if (id === 'right') g.setRight(true);
      else g.pressJump();
    };
    const release = (id) => (e) => {
      e.preventDefault();
      if (id === 'left') g.setLeft(false);
      else if (id === 'right') g.setRight(false);
    };
    for (const id of ['left', 'right', 'jump']) {
      k(id).addEventListener('pointerdown', press(id));
      if (id !== 'jump') {
        k(id).addEventListener('pointerup', release(id));
        k(id).addEventListener('pointercancel', release(id));
        k(id).addEventListener('pointerleave', release(id));
      }
    }
  }

  await loadBoard();
}

async function saveRun(r) {
  const { error } = await db.from('game_scores').insert({
    user_id: currentUid(),
    score: r.score,
    level: r.level,
    duration_sec: r.duration
  });
  if (error) {
    toast(zhError(error.message), 'error');
    return false;
  }
  toast(`成绩已记录：${r.score} 分`);
  return true;
}

async function loadBoard() {
  const lb = document.getElementById('lb');
  if (!lb) return;

  const [top, mine] = await Promise.all([
    db.from('game_scores')
      .select('*, user:profiles(nickname)')
      .order('score', { ascending: false })
      .limit(20),
    db.from('game_scores')
      .select('score, level, created_at')
      .eq('user_id', currentUid())
      .order('score', { ascending: false })
      .limit(1)
  ]);

  if (top.error) { lb.innerHTML = `<div class="empty">${esc(zhError(top.error.message))}</div>`; return; }

  const rows = top.data || [];
  const medals = ['金', '银', '铜'];

  lb.innerHTML = `
    ${mine.data && mine.data.length ? `<div class="lb-row" style="background:rgba(255,255,255,.4);border-radius:8px;padding:8px 10px">
      <span class="lb-rank top">我</span>
      <span class="lb-name">个人最好成绩</span>
      <span class="lb-score">${esc(String(mine.data[0].score))} 分</span>
    </div>` : ''}
    ${rows.length ? rows.map((r, i) => `
      <div class="lb-row">
        <span class="lb-rank ${i < 3 ? 'top' : ''}">${i < 3 ? medals[i] : i + 1}</span>
        <span class="lb-name">${esc(r.user ? r.user.nickname : '玩家')}</span>
        <span class="muted small">到第 ${r.level} 关</span>
        <span class="lb-score">${esc(String(r.score))} 分</span>
      </div>`).join('') : '<div class="empty">还没有成绩，来打第一局。</div>'}
  `;
}
