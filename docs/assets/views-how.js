/* ============================================================
   页面：怎么用（三种身份的分步教程 + 界面示意）
   ============================================================ */

const app = () => document.getElementById('app');

/* 浏览器窗口外框 */
const shot = (url, body) => `
  <div class="shot">
    <div class="shot-bar"><i></i><i></i><i></i><span class="shot-url">${url}</span></div>
    <div class="shot-body">${body}</div>
  </div>`;

/* 红色标注 */
const anno = (text, cls = '') => `<span class="anno ${cls}">${text}</span>`;

const step = (num, title, desc, tip, visual) => `
  <article class="how-step${visual ? '' : ' no-visual'}">
    <div class="how-copy">
      <span class="how-num">${num}</span>
      <h4>${title}</h4>
      <p>${desc}</p>
      ${tip ? `<p class="how-tip">${tip}</p>` : ''}
    </div>
    ${visual ? `<div class="how-visual">${visual}</div>` : ''}
  </article>`;

export function viewHow() {
  app().innerHTML = `
    <section class="section how">
      <div class="section-head">
        <h2>怎么用</h2>
        <span class="muted">标书 / 成套报价 / 资格预审，同一套流程</span>
      </div>

      <div class="how-roles">
        <div class="how-role">
          <div class="how-role-head">
            <span class="role-tag">需求方</span>
            <h3>发任务、挑报价、验收</h3>
            <p>需要标书但没时间写的一方，三步走完。</p>
          </div>

          ${step('01', '把需求写成文字',
            '标题写项目名，类型选工程 / 货物 / 服务 / 成套报价，预算给个区间，投标截止时间必须填。',
            '标书写清册数、评分点；成套报价写清清单项数、品牌型号要求和交货期——这三项决定报价准不准。',
            shot('bidmarket / 发布任务', `
              <div class="sk-field"><span>任务标题</span><b>某市政道路改造工程投标文件</b></div>
              <div class="sk-row">
                <div class="sk-field"><span>类型</span><b>工程类标书</b></div>
                <div class="sk-field"><span>截止</span><b>11-30</b></div>
              </div>
              <div class="sk-field"><span>需求说明</span><b>一正两副，含资格材料与业绩…</b></div>
              <div class="sk-actions">
                <span class="sk-btn">发布</span>
                ${anno('← 填完点这里')}
              </div>
            `))}

          ${step('02', '等管理员审核',
            '提交后状态是「待审核」，不会立刻出现在任务大厅。管理员通过后自动上线，并给你发通知。',
            '被驳回会附原因，改完可以重新发布。',
            shot('bidmarket / 管理 · 待审核', `
              <div class="sk-list">
                <div class="sk-li"><span>【待审核】某市政道路…</span><em>通过</em><em class="ghost">驳回</em></div>
                <div class="sk-li"><span>【待审核】实验室设备采购</span><em>通过</em><em class="ghost">驳回</em></div>
              </div>
            `))}

          ${step('03', '对比报价，选定一家',
            '服务方会提交金额、工期和方案。你逐条看，点「选定 TA」。',
            '选定后其余报价自动落选，任务状态变成「已选定」。',
            shot('bidmarket / 任务详情', `
              <div class="sk-bid">
                <b>¥3,200</b>
                <div><i>李工</i><span>3 天 · 含两次修改</span></div>
                <em>选定 TA</em>
                ${anno('← 选这个', 'inline')}
              </div>
              <div class="sk-bid">
                <b>¥3,600</b>
                <div><i>王工</i><span>2 天 · 技术标逐条对应</span></div>
                <em class="ghost">选定 TA</em>
              </div>
            `))}
        </div>

        <div class="how-role">
          <div class="how-role-head">
            <span class="role-tag">服务方</span>
            <h3>找任务、报价、交付</h3>
            <p>会写标书的一方，挑能接的活，报能做的价。</p>
          </div>

          ${step('04', '在任务大厅筛任务',
            '按类型和关键词筛选，看预算区间、投标截止时间和需求描述。',
            '截止时间太近的慎接，48 小时内通常要加急价。',
            shot('bidmarket / 任务大厅', `
              <div class="sk-card">
                <div class="sk-card-top"><span class="sk-code">BM-8F3A21</span><em>招募中</em></div>
                <b>市政道路工程投标文件编制</b>
                <div class="sk-meta">工程类标书 · 预算 ¥2,500 – 4,000 · 截止 11-30</div>
                <div class="sk-foot">报价参考 ¥3,200 起</div>
              </div>
            `))}

          ${step('05', '提交报价',
            '填金额、工期和方案。一个任务只能报一次，选定前可以撤回。',
            '方案里写清交付内容、修改次数、是否含电子标上传，比只写价格更容易被选中。',
            shot('bidmarket / 提交报价', `
              <div class="sk-row">
                <div class="sk-field"><span>报价金额</span><b>3200</b></div>
                <div class="sk-field"><span>工期（天）</span><b>3</b></div>
              </div>
              <div class="sk-field"><span>方案说明</span><b>商务标 + 技术标全套，含两次修改…</b></div>
              <div class="sk-actions">
                <span class="sk-btn">提交报价</span>
                ${anno('← 一次报价')}
              </div>
            `))}

          ${step('06', '交付并标记',
            '被选定后用站内消息沟通，把成稿线下发给对方（微信 / 邮件），然后在平台点「标记已交付」。',
            '平台不存文件，交付物不走这里。',
            null)}
        </div>

        <div class="how-role">
          <div class="how-role-head">
            <span class="role-tag">双方</span>
            <h3>沟通、确认、互评</h3>
            <p>选定之后，两个人一起把单子走完。</p>
          </div>

          ${step('07', '站内消息沟通',
            '只有任务双方能看到这段对话。约细节、催进度、确认交付方式都在这里。',
            '涉密资料别发在任务描述里，选定后再私下传递。',
            shot('bidmarket / 任务详情 · 消息', `
              <div class="sk-msg left"><i>李工</i><p>初稿已经发你微信了，看下第三章</p></div>
              <div class="sk-msg right"><i>你</i><p>收到，食安承诺那段再补一句</p></div>
            `))}

          ${step('08', '确认完成，互相评价',
            '发布方点「确认完成」后任务结束，双方各打一次分。',
            '评分会累计到对方信用分，影响以后接单和被选中的概率。',
            shot('bidmarket / 任务详情 · 互评', `
              <div class="sk-review">
                <span>对方的评价</span>
                <b class="sk-stars">★★★★★</b>
                <p>响应快，一次通过初审</p>
              </div>
              <div class="sk-actions"><span class="sk-btn">确认完成</span>${anno('← 验收后点这里')}</div>
            `))}
        </div>
      </div>

      <div class="panel">
        <h2>费用与规则</h2>
        <p class="muted">发布和报价都免费，平台不抽佣、不托管资金。成交后由双方线下结算。</p>
        <p class="muted">平台只提供信息展示与撮合，不参与合同签订与履约，也不接收任何文件。
        涉密材料建议在选定服务方后通过站内消息约定线下传递方式。</p>
        <p class="muted small">遇到虚假信息、诈骗或骚扰，可以在任务页举报，管理员会处理。</p>
      </div>
    </section>`;
}
