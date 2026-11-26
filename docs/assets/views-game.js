/* 会员小游戏：场景、排位与局次生命周期。 */
import { db, state, esc, toast, zhError, currentUid, needLogin } from './lib.js';
import { startGame } from './game.js';
import { levels } from './game-levels.js';

const app = () => document.getElementById('app');
let activeGame = null;

export function leaveGame() {
  const previous = activeGame;
  activeGame = null;
  previous?.engine?.stop();
}

const field = (name) => `<b data-game-value="${name}">—</b>`;
const metric = (label, name) => `<div><span>${label}</span>${field(name)}</div>`;

export function viewGame() {
  leaveGame();
  if (!needLogin('登录后才能玩小游戏')) return;
  if (state.profile?.banned) {
    app().innerHTML = `<div class="panel"><h2>小游戏暂未开放</h2><p class="muted">账号处于封禁状态，暂不参与小游戏与排名。</p></div>`;
    return;
  }
  app().innerHTML = `
    <section class="game-section" aria-label="标书员大冒险">
      <div class="game-cabinet">
        <header class="game-masthead">
          <div><p class="game-kicker">截标前夜 <span>／</span> 投标档案 01–06</p><h1>标书员大冒险</h1></div>
          <div class="game-switches"><button type="button" data-game="sound" aria-pressed="true">声音：开</button><button type="button" data-game="pause" disabled>暂停</button></div>
        </header>
        <div class="game-dashboard" role="group" aria-label="游戏状态">
          <div class="game-stage-label"><span>章节 ${field('chapter')}</span>${field('area')}</div>
          ${metric('截标倒计时', 'timer')}${metric('收集页码', 'pages')}${metric('生命', 'health')}${metric('得分', 'score')}
        </div>
        <div class="game-scene" tabindex="0" role="region" aria-label="游戏场景" aria-describedby="game-keys">
          <canvas id="game-canvas" width="960" height="540">标书员大冒险横版游戏画面</canvas>
          <div class="game-hint" data-game="status" role="status" hidden></div>
          <div class="game-boss" data-game="boss" hidden>${field('boss')}<div aria-hidden="true"><i data-game-value="bossBar"></i></div></div>
          <div class="game-overlay" data-game="overlay">
            <div class="game-docket">
              <p class="game-docket-tag" data-game-value="tag"></p>
              <h2 data-game-value="title"></h2>
              <p class="game-docket-copy" data-game-value="copy"></p>
              <div class="game-docket-action"><button type="button" data-game="play" data-game-value="buttonHint">开始</button><span data-game-value="shortcut"></span></div>
            </div>
          </div>
        </div>
        <div class="game-readout"><span>资质证书 ${field('bonus')}</span><span>${field('attempts')}</span><span>道具 ${field('gear')}</span></div>
        <div class="game-touch" role="group" aria-label="触屏操作">
          <div><button type="button" data-game-control="left" aria-label="左移">←</button><button type="button" data-game-control="right" aria-label="右移">→</button></div>
          <div><button type="button" data-game-control="fire">发射</button><button type="button" data-game-control="jump">跳跃</button></div>
        </div>
        <p class="game-keys" id="game-keys"><kbd>←</kbd> <kbd>→</kbd> 或 <kbd>A</kbd> <kbd>D</kbd> 移动 <span>·</span> <kbd>空格</kbd> 或 <kbd>↑</kbd> 跳跃 <span>·</span> <kbd>X</kbd> 发射 <span>·</span> <kbd>P</kbd> 暂停 / 继续</p>
        <ol class="game-itinerary" aria-label="六章路线">
          ${levels.map((level, i) => `<li data-game-level><span>${String(i+1).padStart(2,'0')} / ${esc(level.chapter)}</span><b>${esc(level.name)}</b></li>`).join('')}
        </ol>
      </div>
      <div class="game-rows">
        <section class="panel"><h2>投标排行榜</h2><p class="sub">每局结束记录一次成绩，展示得分前 20 名。</p><div data-game-board aria-live="polite"><div class="empty">加载中…</div></div></section>
        <section class="panel game-brief"><h2>小张的投标清单</h2><ol>
          <li>收齐本章要求的页码，抵达校对旗。多收页码可拿加分资质证书。</li>
          <li>从下方顶道具砖：咖啡加速、U 盘护盾、订书机发射钉书针。</li>
          <li>最后一章多收页码削弱废标风险兽，清除风险后再到窗口交标。</li>
        </ol></section>
      </div>
    </section>`;
  const session = { board: app().querySelector('[data-game-board]'), uid: currentUid(), revision: 0 };
  session.engine = startGame(document.getElementById('game-canvas'), { onFinish: async (result) => {
    if (!isCurrent(session)) return;
    const { error } = await db.from('game_scores').insert({
      user_id: session.uid, score: result.score, level: result.level, duration_sec: result.duration
    });
    if (!isCurrent(session)) return;
    if (error) toast(`成绩未记录：${zhError(error.message)}`, 'error');
    else { toast(`成绩已记录：${result.score} 分`); await loadBoard(session); }
  } });
  activeGame = session;
  void loadBoard(session);
}

function isCurrent(session) {
  return activeGame === session && session.board.isConnected && currentUid() === session.uid;
}

async function loadBoard(session) {
  const { board, uid } = session;
  const revision = ++session.revision;
  try {
    const [top, mine] = await Promise.all([
      db.from('game_scores').select('score, level, user:profiles(nickname)').order('score', { ascending: false }).limit(20),
      db.from('game_scores').select('score').eq('user_id', uid).order('score', { ascending: false }).limit(1)
    ]);
    if (!isCurrent(session) || revision !== session.revision) return;
    if (top.error) { board.textContent = zhError(top.error.message); return; }
    const rows = top.data || [], best = mine.data?.[0];
    board.innerHTML = `
      ${best ? `<div class="lb-row lb-personal"><span class="lb-rank top">我</span><span class="lb-name">个人最好成绩</span><span class="lb-score">${esc(String(best.score))} 分</span></div>` : ''}
      ${rows.length ? rows.map((r, i) => `<div class="lb-row"><span class="lb-rank ${i < 3 ? 'top' : ''}">${['金','银','铜'][i] || i+1}</span><span class="lb-name">${esc(r.user?.nickname || '玩家')}</span><span class="muted small">第 ${esc(String(r.level))} 关</span><span class="lb-score">${esc(String(r.score))} 分</span></div>`).join('') : '<div class="empty">还没有成绩，来打第一局。</div>'}`;
  } catch (error) {
    if (isCurrent(session) && revision === session.revision) board.textContent = '暂时读取不到排行榜，请稍后再试。';
  }
}
