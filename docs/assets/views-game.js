/* 会员小游戏：投标大厅、排位与局次生命周期。 */
import { db, state, esc, toast, zhError, currentUid, needLogin } from './lib.js';
import { startGame } from './game.js';
import { levels } from './game-levels.js';
import { keyArt, brandIcon, chapterIcon, motifs, routeBrief } from './game-poster.js';

const app = () => document.getElementById('app');
let activeGame = null;
export function leaveGame() {
  const previous = activeGame;
  activeGame = null;
  previous?.engine?.stop();
}

const field = name => `<b data-game-value="${name}">—</b>`;
const metric = (label,name,icon) => `<div class="game-meter game-meter-${name}"><span aria-hidden="true" class="game-meter-icon">${icon}</span><div><span>${label}</span>${field(name)}</div></div>`;
const number = n => Number(n).toLocaleString('zh-CN');
const duration = n => `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
const slot = n => String(n).padStart(2,'0');

export function viewGame() {
  leaveGame();
  if (!needLogin('登录后才能玩小游戏')) return;
  if (state.profile?.banned) {
    app().innerHTML = `<div class="panel"><h2>小游戏暂未开放</h2><p class="muted">账号处于封禁状态，暂不参与小游戏与排名。</p></div>`;
    return;
  }
  app().innerHTML = `
  <section class="game-section" aria-label="标书员大冒险">
    <div class="game-cabinet" data-game-mode="ready">
      <header class="game-masthead">
        <div class="game-brand">${brandIcon}<div><strong>标书员大冒险</strong><span>截标前夜</span></div></div>
        <div class="game-switches"><button type="button" data-game="sound" aria-pressed="true">声音：开</button><button type="button" data-game="pause" disabled>暂停</button></div>
      </header>
      <div class="game-dashboard" role="group" aria-label="游戏状态">
        <div class="game-stage-label"><span>章节 ${field('chapter')}</span>${field('area')}</div>
        ${metric('截标倒计时','timer','◴')}${metric('收集页码','pages','▤')}${metric('生命','health','')}${metric('得分','score','✦')}
      </div>
      <div class="game-scene" tabindex="0" role="region" aria-label="游戏场景" aria-describedby="game-keys">
        <canvas id="game-canvas" width="960" height="540">标书员大冒险横版游戏画面</canvas>
        <div class="game-cover">${keyArt}<div class="game-cover-frame" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="game-cover-mark" aria-hidden="true">第 01–06 章 <i></i> 夜间交付档案</div></div>
        <div class="game-hint" data-game="status" role="status" hidden></div>
        <div class="game-boss" data-game="boss" hidden>${field('boss')}<div aria-hidden="true"><i data-game-value="bossBar"></i></div></div>
        <div class="game-overlay" data-game="overlay">
          <div class="game-docket">
            <p class="game-docket-tag" data-game-value="tag"></p>
            <h1 data-game-value="title"></h1>
            <p class="game-docket-copy" data-game-value="copy"></p>
            <div class="game-result-stats" data-game="stats" hidden>${metric('本局得分','endScore','')}${metric('收集页码','endPages','')}${metric('资质证书','endCert','')}${metric('用时','endTime','')}</div>
            <p class="game-submit-status" data-game="submission" role="status" hidden></p>
            <div class="game-docket-action"><button type="button" data-game="play" data-game-value="buttonHint">开始</button><span data-game-value="shortcut"></span></div>
            <button class="game-text-button" type="button" data-game-board-jump>查看投标排行榜 <span aria-hidden="true">↘</span></button>
          </div>
        </div>
      </div>
      <div class="game-readout"><span>资质证书 ${field('bonus')}</span><span>道具 ${field('gear')}</span><span>速递连页 ${field('chain')}</span><div aria-hidden="true" class="game-progress"><i data-game-value="progress"></i></div></div>
      <div class="game-touch" role="group" aria-label="触屏操作">
        <div><button type="button" data-game-control="left" aria-label="左移">←</button><button type="button" data-game-control="right" aria-label="右移">→</button></div>
        <div><button type="button" data-game-control="fire">发射</button><button type="button" data-game-control="jump">跳跃</button></div>
      </div>
      <p class="game-keys" id="game-keys"><span><kbd>←</kbd> <kbd>→</kbd> / <kbd>A</kbd> <kbd>D</kbd> 移动</span><span><kbd>空格</kbd> 跳跃</span><span><kbd>X</kbd> 发射</span><span><kbd>P</kbd> 暂停</span></p>
      <section class="game-route" aria-label="六章路线"><div><h2>交付路线</h2><span>06 个办公区域</span></div>
        <ol class="game-itinerary">${levels.map((level,i)=>`<li data-game-level class="route-${motifs[i]}"><span class="route-number">${slot(i+1)}</span>${chapterIcon(i)}<b>${esc(level.name)}</b><small>${routeBrief[i]}</small></li>`).join('')}</ol>
      </section>
    </div>
    <div class="game-rows">
      <section class="game-board" aria-labelledby="game-board-heading">
        <header class="game-board-heading"><div><p>交付档案</p><h2 id="game-board-heading" tabindex="-1">投标排行榜</h2></div><div class="game-board-tabs" role="group" aria-label="榜单范围"><button type="button" data-board-scope="all" aria-pressed="true">全站</button><button type="button" data-board-scope="mine" aria-pressed="false">我的成绩</button></div></header>
        <p class="game-board-rule">最高 20 笔成绩 · 同分时先比较章节，再比较用时</p>
        <div data-game-board aria-live="polite"><div class="empty">正在读取成绩…</div></div>
      </section>
      <aside class="game-brief" aria-label="速递手册"><span aria-hidden="true" class="brief-index">FIELD NOTES / 01</span><h2>速递手册</h2><dl>
        <div><dt>连页有加成</dt><dd>连续捡页、不中断，最多每页额外 +30 分。受伤或间隔过久会断掉连页。</dd></div>
        <div><dt>稳走还是抄近路？</dt><dd>按住跳得更高，点按越过低障。上层文件柜藏着更多页码和加分资质。</dd></div>
        <div><dt>顶砖补给</dt><dd>咖啡加速、U 盘护盾、订书机击退幽灵。末章多收页码还能削弱废标风险兽。</dd></div>
      </dl></aside>
    </div>
  </section>`;
  const session = { board:app().querySelector('[data-game-board]'), uid:currentUid(), revision:0, scope:'all' };
  const submission = app().querySelector('[data-game="submission"]');
  const showSubmission = (text,tone) => { submission.textContent=text; submission.dataset.state=tone; submission.hidden=false; };
  app().querySelector('[data-game-board-jump]').addEventListener('click',()=>{
    app().querySelector('#game-board-heading').focus();
  });
  for (const button of app().querySelectorAll('[data-board-scope]')) button.addEventListener('click',()=>{
    if(session.scope===button.dataset.boardScope)return;
    session.scope=button.dataset.boardScope;
    for(const tab of app().querySelectorAll('[data-board-scope]')) tab.setAttribute('aria-pressed',String(tab===button));
    void loadBoard(session);
  });
  session.board.addEventListener('click',e=>{if(e.target.closest('[data-board-retry]'))void loadBoard(session);});
  session.engine = startGame(document.getElementById('game-canvas'), { onFinish:async (result, isLatest)=>{
    if (!isCurrent(session)) return;
    showSubmission('正在登记成绩…','pending');
    try {
      const { error } = await db.from('game_scores').insert({user_id:session.uid,score:result.score,level:result.level,duration_sec:result.duration});
      if(!isCurrent(session))return;
      if(error) throw error;
      if(isLatest())showSubmission('成绩已登记至排行榜','saved');
      void loadBoard(session);
    }catch(error){
      if(!isCurrent(session)||!isLatest())return;
      showSubmission('成绩登记未获确认 · 本局不会重复提交','error');
      toast(`成绩登记失败：${zhError(error.message)}`, 'error');
    }
  }});
  activeGame=session;
  void loadBoard(session);
}

function isCurrent(session) {
  return activeGame === session && session.board.isConnected && currentUid() === session.uid;
}
const ranking = query => query.order('score',{ascending:false}).order('level',{ascending:false}).order('duration_sec',{ascending:true}).order('created_at',{ascending:true}).order('id',{ascending:true});
const playerName = r => r.user?.nickname || '匿名标书员';
const row = (r,i,mine) => `<tr class="lb-row"${r.user_id===mine?' data-self':''}><td class="lb-rank">${slot(i+1)}</td><td class="lb-name">${esc(playerName(r))}${r.user_id===mine?'<small>我</small>':''}</td><td>${slot(r.level)} 章</td><td class="lb-time">${duration(r.duration_sec)}</td><td class="lb-score">${number(r.score)}</td></tr>`;
function podium(rows,uid){
  return `<div class="game-podium" aria-label="前三笔成绩">${[1,0,2].map(i=>{
    const r=rows[i];
    return `<div class="game-podium-seat" data-medal="${i+1}"${r?'':' data-vacant'}><span>${['首席','次席','三席'][i]} <i>${slot(i+1)}</i></span><b>${r?esc(playerName(r)):'等待交付'}${r?.user_id===uid?' <small>我</small>':''}</b><strong>${r?number(r.score):'—'}</strong></div>`;
  }).join('')}</div>`;
}
async function loadBoard(session) {
  const { board, uid, scope } = session;
  const revision=++session.revision;
  board.setAttribute('aria-busy','true');
  board.innerHTML='<div class="empty">正在读取成绩…</div>';
  try {
    const top=ranking(db.from('game_scores').select('id,user_id,score,level,duration_sec,created_at,user:profiles(nickname)'));
    const [scores,mine]=await Promise.all([
      (scope==='mine'?top.eq('user_id',uid):top).limit(20),
      ranking(db.from('game_scores').select('score,level,duration_sec').eq('user_id',uid)).limit(1)
    ]);
    if(!isCurrent(session)||revision!==session.revision)return;
    if(scores.error)throw scores.error;
    const rows=scores.data||[],best=mine.data?.[0];
    board.innerHTML=`
      <div class="lb-row lb-personal"><span>个人最好成绩</span><strong>${best?number(best.score):'—'}</strong><span>${best?`第 ${best.level} 章 / ${duration(best.duration_sec)}`:mine.error?'暂未读取':'完成一局后更新'}</span></div>
      ${rows.length?`${scope==='all'?podium(rows,uid):''}<table class="game-score-table"><thead><tr><th scope="col">${scope==='all'?'排名':'顺序'}</th><th scope="col">标书员</th><th scope="col">章节</th><th scope="col">用时</th><th scope="col">得分</th></tr></thead><tbody>${rows.map((r,i)=>row(r,i,uid)).join('')}</tbody></table>`:'<div class="empty">还没有成绩，完成一局就能留下第一份交付记录。</div>'}`;
  } catch {
    if(isCurrent(session)&&revision===session.revision)board.innerHTML='<div class="empty">成绩暂未加载。 <button type="button" data-board-retry>重新加载</button></div>';
  } finally {
    if(isCurrent(session)&&revision===session.revision)board.removeAttribute('aria-busy');
  }
}