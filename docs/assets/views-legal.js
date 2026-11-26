/* ============================================================
   页面：服务协议 / 隐私政策
   ============================================================ */
import { CONTENT } from './content.js';
import { esc } from './lib.js';

const app = () => document.getElementById('app');

function renderLegal(title, doc) {
  app().innerHTML = `
    <section class="section legal">
      <div class="section-head">
        <h2>${esc(title)}</h2>
        <span class="muted small">更新于 ${esc(doc.updated)}</span>
      </div>
      <div class="panel">
        <p class="lead-small">${esc(doc.intro)}</p>
        ${doc.sections.map(s => `
          <div class="legal-sec">
            <h3>${esc(s.h)}</h3>
            <p>${esc(s.p)}</p>
          </div>`).join('')}
        <p class="muted small" style="margin-top:24px">
          如对以上内容有疑问，可通过平台内的任务或消息联系管理员。
        </p>
      </div>
      <div class="page-foot">
        <a class="link small" href="#/">← 返回首页</a>
        <a class="link small" href="#/terms">服务协议</a>
        <a class="link small" href="#/privacy">隐私政策</a>
      </div>
    </section>`;
}

export function viewTerms() {
  renderLegal('服务协议', CONTENT.terms);
}

export function viewPrivacy() {
  renderLegal('隐私政策', CONTENT.privacy);
}
