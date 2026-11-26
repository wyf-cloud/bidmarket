# 标书报价 · 任务撮合平台

无服务器方案：静态前端放 GitHub Pages / Cloudflare Pages，注册、登录、数据库、权限、文件存储、实时消息全部由 Supabase 承担。**没有云服务器，也没有自己的后端代码。**

```
bidmarket/
├─ supabase/schema.sql      # v1 基础表 + v2 消息互评 + v3 附件/通知/举报
├─ docs/                    # 纯静态站点，GitHub Pages 的 /docs 目录
│  ├─ index.html
│  ├─ start.bat             # 本地预览：起服务并打开浏览器
│  └─ assets/
│     ├─ config.js          # 唯一要填的地方
│     ├─ lib.js             # Supabase 客户端、状态、工具
│     ├─ ui.js              # 顶栏、卡片、弹窗、附件列表
│     ├─ views-feed.js      # 首页 / 大厅 / 任务详情 / 发布编辑
│     ├─ views-auth.js      # 注册登录 / 找回 / 我的 / 设置 / 通知
│     ├─ views-admin.js     # 管理后台 / 怎么用 / 404
│     ├─ app.js             # 路由、启动、实时通知
│     └─ style.css
└─ README.md
```

## 功能清单

**账号**
- 账号密码注册登录（账号可填手机号或邮箱，**不走短信验证码**）
- 找回密码（真实邮箱收重置链接；手机号账号由管理员后台处理）
- 修改密码、编辑昵称 / 简介 / 手机号 / 微信
- 联系方式单独存表，仅本人和管理员可见

**任务**
- 发布、编辑、取消、删除（招募中才可编辑）
- 任务大厅：关键词搜索、类型筛选、按最新 / 预算 / 截止时间排序、分页加载
- 任务以纯文字描述发布，平台不接收招标文件（节约出网流量，涉密资料线下沟通）
- 举报任务

**交易**
- 提交报价（金额 / 工期 / 方案）、撤回报价、一任务一人一价
- 发布方查看全部报价并选定，其余自动置为未中标
- 交付闭环：中标方标记交付 → 双方线下交付 → 发布方确认完成
- 站内消息，**Supabase Realtime 实时推送**
- 完成后互评，评分自动累计到信用分

**通知**
- 新报价、被选定、未中标、新消息、任务状态变化都会写入站内通知
- 顶栏铃铛未读数，实时刷新
- 通知中心可逐条已读 / 全部已读

**管理**
- 概览统计、用户认证 / 封禁、任务下架、举报处理
- 封禁用户无法发布、报价、发消息（数据库层强制）

## 本地预览（重要）

**不要直接双击 `index.html`。** 浏览器在 `file://` 协议下会拦截 ES 模块，
页面只会剩下顶栏和页脚，中间是空的。必须用 HTTP 打开：

- 双击 `docs/start.bat`（自动起服务并打开浏览器），或
- 在 `docs/` 目录执行 `python -m http.server 8000`，访问 `http://localhost:8000/`
- 或用 VS Code 的 Live Server 插件

用 HTTP 打开后，如果 `config.js` 还是空的，会自动进入**演示模式**：
用内存假数据把首页、大厅、详情、报价、消息、互评、后台全部跑起来，不联网、不需要 Supabase。
顶部横幅可以切换三种身份（发布方 / 服务方 / 未认证用户），数据刷新即重置。

点横幅右侧「接入真实数据库」会显示正式环境的接入步骤。

## 五步上线

1. **建 Supabase 项目**：<https://supabase.com> → New project。区域选 Singapore 或 Tokyo。
2. **建表**：Dashboard → SQL Editor，把 `supabase/schema.sql` 整段执行。
   文件按 v1 → v2 → v3 排列，全部幂等，可以整体重跑。
3. **关掉邮箱确认**：Authentication → Providers → Email → 关闭 `Confirm email`。
4. **填配置**：Project Settings → API，把 `Project URL` 和 `anon public` 填进 `docs/assets/config.js`。
5. **部署**：仓库推到 GitHub → Settings → Pages → 分支 `main`、目录 `/docs`。
   Cloudflare Pages 也行：连仓库、构建命令留空、输出目录 `docs`。

> `anon key` 是公开密钥，提交到公开仓库是正常的。真正不能外泄的是 `service_role` key，本项目用不到。

## 推送到 GitHub（本机特调）

这台机器的 git 有两个坑：全局代理指向 `127.0.0.1:12450`（没有监听），
以及 schannel 后端报 `SEC_E_NO_CREDENTIALS`。实测下面这套能连通：

```bash
cd bidmarket
git init
git add .
git config user.name "你的名字"
git config user.email "你的邮箱"
git commit -m "init: bidmarket"
git branch -M main
git remote add origin https://github.com/<用户名>/<仓库名>.git
git -c http.proxy= -c https.proxy= -c http.sslBackend=openssl push -u origin main
```

关键是 `-c http.sslBackend=openssl` 和 `-c http.proxy=` 两个覆盖参数，不用改全局配置。
如果仍然失败，用 GitHub Desktop 或网页版「Upload files」也能完成首次上传。

## 环境自检

部署并填好 `config.js` 后，访问 `#/health`（页脚也有入口）：

- 逐项检查配置、9 张表、5 个数据库函数、存储桶、实时订阅、当前用户资料
- 全部通过才算真正接通
- 还有「写入自检」，会建一条任务再删掉，验证写权限
- 失败项可以一键复制，直接贴出来排查

## 设置第一个管理员

```sql
-- 按邮箱（注册时填的账号）
update public.profiles set is_admin = true
where id = (select id from auth.users where email = '你的账号@example.com');

-- 或把最早注册的用户设为管理员
update public.profiles set is_admin = true
where id = (select id from auth.users order by created_at limit 1);
```

刷新后顶栏出现「管理」。之后可以在界面上认证或封禁其他用户。

## 账号与密码

账号不是邮箱格式时，会合成内部邮箱 `账号@example.com` 交给 Supabase Auth。
好处是完全不走短信、注册即用；代价是**收不到重置邮件**。

- 真实邮箱注册：登录页「找回密码」可直接自助重置。
- 手机号账号：需要管理员在 Supabase 后台或通过服务端脚本重置。

Supabase 免费版内置邮件服务有频率限制（每小时几封），找回密码功能上线前建议在
Authentication → SMTP 配置自己的发信服务。

## 权限模型

所有访问控制都在数据库 RLS 里，前端绕不过去：

| 对象 | 谁能读 | 谁能写 |
|---|---|---|
| `profiles` | 所有人（不含联系方式） | 本人；管理员可改认证/封禁 |
| `profile_contacts` | 本人、管理员 | 本人 |
| `tasks` | 招募中所有人；其余仅发布者与报价方 | 发布者；管理员可删 |
| `bids` | 接单方看自己；发布者看全部 | 接单方插入、撤回 |
| `messages` | 仅任务双方 | 仅任务双方 |
| `reviews` | 仅任务双方 | 只能通过 `submit_review()` |
| `notifications` | 本人、管理员 | 只能由触发器写入 |
| `reports` | 举报人、管理员 | 举报人插入；管理员处理 |

关键 RPC（`security definer`，内部校验身份）：`accept_bid`、`mark_delivered`、`confirm_complete`、`cancel_task`、`submit_review`。

## 纯文字产品

平台**不接收任何文件**，任务是纯文字描述的：

- 招标文件、图纸、成稿都走线下（微信群 / 邮件 / 网盘），平台只负责撮合和流程
- 数据库里仍保留 `files` 表与 `attachments` 存储桶，但界面已不再使用，方便以后按需恢复
- 这样做的好处：出网流量几乎只花在 JSON 上，1GB 存储额度不会被标书吃光

## 常见问题

**打开是白屏 / 只有顶栏和页脚**
两种原因，页面上都有兜底提示：

1. `file://` 直接双击打开 —— 用 `start.bat` 或 `python -m http.server`。
2. `cdn.jsdelivr.net` 被网络拦截，Supabase SDK 拉不下来。
   把 `assets/lib.js` 第一行的 CDN 换成 `https://esm.sh/@supabase/supabase-js@2` 再试。

**打开显示「还差一步：配置 Supabase」**
正常，`config.js` 还是空的。填完 URL 和 anon key 才会出现首页。

**注册后没登录 / 提示去查邮箱**
Supabase 里 `Confirm email` 没关。

**任务大厅一直加载中**
数据库还没建，或 RLS 策略没执行成功。回 SQL Editor 重跑 `schema.sql`。

## 已知限制

- **没有在线支付**：成交后线下结算。个人做支付接口需要营业执照和商户号。
- **没有备案**：用 `pages.dev` / `github.io` 默认域名不需要备案；绑自定义域名到国内节点则必须 ICP 备案。
- Supabase 免费项目**闲置 7 天会暂停**，低流量期要留意。
- 附件不做病毒扫描；大文件建议先压缩。
- 通知只写库 + 实时推送，没有短信 / 邮件 / 微信提醒。

## 建议的运营节奏

1. 先自己当唯一服务方跑两周，验证有没有人真的发任务。
2. 有真实询盘后再开放服务方入驻，用 `verified` 做人工审核。
3. 交易量稳定后再考虑资金托管、抽佣和发票，那时需要公司主体。
