# MaiMate（舞萌伴侣）项目设计案

> 文档性质：项目事实基线、产品设计、工程约束和持续变更记录。
> 最后更新：2026-08-26
> 当前版本：`v1.7.0`
> 当前状态：Phase A-F、v1.6.x 迭代与 v1.7.0 批次已实现；v1.6.0–v1.6.10 已全部云构建发布，v1.7.0 云构建与下载站部署见 §3.1 与变更记录；真机验收仍待 Android 设备。
> GitHub：<https://github.com/FengLingYaaa/maimate-app>

这份文档的目标不是只描述“理想中的产品”，而是让人类或新对话中的智能体能够回答：

1. 我们正在做什么；
2. 为什么这样做；
3. 目前代码和发布物已经做到什么程度；
4. 哪些功能只是计划，哪些功能已经有代码；
5. 下一步应该做什么；
6. 每次对话结束后，应该把什么追加到这里。

本文件在 App Git 仓库内的路径是 `docs/DESIGN.md`；历史 Linux 工作区还在仓库外维护 `design/DESIGN.md` 镜像，修改设计时应同步两处，避免新智能体读到旧状态。当前 Windows 克隆中只有仓库内这一份。

---

## 0. 新智能体阅读顺序

进入项目后按以下顺序建立上下文，不要直接假设旧对话中的“已完成”仍然准确：

1. 阅读本文件；
2. 阅读 `app/AGENTS.md` 和 `app/CLAUDE.md`；
3. 在 `app/` 中执行只读的 `git status --short --branch` 和 `git log --oneline -12`；
4. 对照“当前事实状态”检查代码、发布物和研究文件；
5. 只有用户明确要求实施时，才修改 App 代码；
6. 完成一个步骤后，把意图、修改、验证、产物和遗留问题追加到本文档的“持续变更记录”。

历史 Linux 工作区中，项目工作区和 App Git 根目录不是同一个目录：

```text
工作区：/home/agent/dsh-workspace/maimate
App Git 根：/home/agent/dsh-workspace/maimate/app
```

自 2026-08-26 起的 Windows 会话把 App 仓库直接克隆为工作区根（`D:\AGENT\dsh\Workspace\flya-workspace\maimate`），两个层级重合，本文提到的 `app/...` 相对路径即该克隆内的实际路径；`design/`、`landing/`、`research/` 镜像不在该克隆内，仍留在历史工作区和下载站部署中。

---

## 1. 产品一句话

MaiMate 是一款面向 MaimaiDX（舞萌DX）街机玩家的手机辅助 App：把曲库、谱面信息、推分计划、随机练习、Rating 估算、Bilibili 外部搜索和拍照识别曲名集中到一个离线优先的移动界面里，让玩家在去机厅或机厅内能快速决定“练什么”。

它不是官方 App，也不提供游戏本体、ROM、音频或自动打歌功能。它只整理公开曲目/谱面资料，并提供练习决策工具。

### 1.1 要解决的问题

- 曲目数量大，到了机厅不知道练哪首；
- 推分计划容易依赖记忆，缺少顺序和备注；
- 想按难度、等级、定数、版本、分类、曲师或谱师找歌时，普通网页在手机上不够顺手；
- 官方机台界面不会完整展示玩家需要的谱面统计和练习上下文；
- 找到谱面确认视频或手元视频后，无法稳定地和曲目、难度对应起来。

### 1.2 目标用户

- 有稳定游玩习惯、希望提高 DX Rating 的 MaimaiDX 玩家；
- 在机厅需要快速选歌的玩家；
- 需要按定数、谱师或版本整理练习内容的玩家。

### 1.3 产品原则

1. **离线优先**：先显示本地缓存，网络只负责更新，不应让已有曲库因网络失败而不可用。
2. **数据来源透明**：Diving-Fish 曲库数据标注来源；Bilibili 只作为外部跳转目标，不复制视频资料。
3. **外部内容不内置**：不在 App 展示未经核验的视频，不在手机端直接爬取 Bilibili；需要观看时交给 Bilibili 应用或网页。
4. **隐私最小化**：OCR 只识别照片中的文字，不识别曲绘；不申请麦克风。玩家成绩只通过用户主动输入的 Import-Token 只读同步，Token 使用 SecureStore，不写入 AsyncStorage、日志或源码。
5. **研究和产品解耦**：Bilibili 研究资料可以保留在研究区，但不作为 App 构建、发布或运行时数据源。
6. **事实和计划分开**：设计案中的“已完成”必须有代码、提交、构建或线上验证证据；计划不能写成完成。

---

## 2. 明确不做的事情

以下内容目前不属于当前版本，不能被新智能体擅自加入：

- 不识别曲绘、封面或图片语义；OCR 只处理文字；
- 不在客户端抓取 Bilibili 搜索结果或 UP 主主页；
- 不自动把未经人工审核的 Bilibili 视频加入正式目录；
- 暂不做玩家通过 Bilibili 链接投稿的第四阶段审核系统；
- 不接入 Developer-Token、B40/B50 或任何成绩写入；玩家成绩仅允许用户主动配置 Import-Token 后进行只读导入；
- 不提供游戏音频、ROM、模拟器或任何与官方机台交互的作弊功能；
- 不把 Bilibili 反爬虫当作需要绕过验证码的目标。遇到风控时应降低频率、换合法网络环境或由用户在本地完成抓取。

早期设计曾把 OCR 列为 P7 并延期；后来用户在第三阶段需求中同意实现“拍照识别曲名”，因此当前代码已经包含 OCR。新智能体应以当前代码和本文件的“事实状态”为准，而不是以旧文档中的 P7 描述为准。

---

## 3. 当前事实状态（2026-08-26）

### 3.1 仓库、发布和包信息

| 项目 | 当前事实 |
|---|---|
| App 仓库 | `FengLingYaaa/maimate-app` |
| 当前分支 | `main` |
| 当前提交 | v1.16.5 功能主体（前一代 `2a9db68` 为 v1.16.4 文档收尾） |
| 当前标签 | v1.16.5 已推送（触发云构建，构建结果见发布补记） |
| Android applicationId | `cc.flya.maimate` |
| App 版本 | `1.16.5`（Android versionCode `31`） |
| 下载站 | <https://maimate.flya.ccwu.cc/>（Cloudflare Pages 直传项目 `maimate-landing`） |
| 稳定 APK 地址 | <https://maimate.flya.ccwu.cc/MaiMate-latest.apk> |
| APK 来源 | GitHub Release 资产 `MaiMate-latest.apk`；v1.7.0 起 Pages `_worker.js` 改为代理 `releases/latest/download/MaiMate-latest.apk`（自动跟随最新 Release） |
| 最新 Release APK SHA-256（v1.15.1） | `75c1debd58af7b7401da72d9264eb2387e834527b044f680b5e06dc88a16c89c`（CI「Print APK checksum」步骤输出） |
| 最新 Release APK 大小 | 62,552,316 bytes（59.6 MB） |
| 下载站同步状态 | 已部署：v1.15.0 SHA/大小已回填并经 wrangler 部署 Pages，线上校验落地页与 `/MaiMate-latest.apk` |
| 下载站同步状态 | 已部署：v1.14.0 SHA/大小已回填并经 wrangler 部署 Pages，线上校验落地页与 `/MaiMate-latest.apk` |
| 下载站同步状态 | 已部署：v1.11.0 SHA/大小已回填并经 wrangler 部署 Pages，线上校验落地页与 `/MaiMate-latest.apk` |
| APK 构建方式 | GitHub Actions 云构建：先跑 lint/route/feature/phase/rating 回归、Expo Doctor 和 Android export 门禁，再出 arm64-v8a debug keystore 内测包 |

当前 App Git 仓库在第三阶段提交之后应保持干净；设计文档本身位于仓库外的工作区镜像和 App 仓库内的文档副本中，更新文档会让 App 仓库产生文档变更，这是预期行为。

### 3.2 已完成能力

| 能力 | 状态 | 事实依据/说明 |
|---|---|---|
| 曲库浏览器 | 已完成基础闭环 | `app/app/index.tsx`、`src/data/music-list.ts` |
| 多维筛选 | 已完成 | 分类、难度、等级、定数、版本、SD/DX、曲师、谱师、BPM、标题等；v1.7.0 重做筛选栏（`src/components/FilterBar.tsx`）：清除键内嵌搜索框内部右侧不再与筛选按钮重叠、「筛选」按钮显示活动条件计数徽标、下方活动筛选摘要条逐项可移除并带「全部清除」，版本筛选值支持合并标签展开匹配（`expandVersionFilterValue`） |
| 模糊搜索 | 已完成基础版本 | 支持标题、曲师、谱师和少量错字容错；结果按相关度排序 |
| 曲库缓存 | 已完成 | AsyncStorage；缓存优先；超过 12 小时后台刷新 |
| `chart_stats` | 已接入 | 独立缓存和后台刷新；详情页显示拟合定数 |
| 推分计划 | 已完成基础版本 | 添加、删除、目标分数和本地持久化；详情页支持自定义目标，顺序/备注字段仍兼容旧数据 |
| 随机抽歌 | 已完成基础版本，v1.7.0 调整 | 推分计划、全曲、按条件三种模式；结果与动画目标一致；v1.7.0 起「按条件」模式抽选时自动收起条件面板并显示展开/收起切换按钮，避免结果卡被抽选按钮挤压遮挡 |
| 歌曲详情 | 已完成基础版本 | 定数、等级、Note 分布、谱师、封面、Rating 预估；v1.7.0 修复定数信息行过长时把右侧 Total Notes 挤出屏幕的问题（信息块 `minWidth: 0` 弹性收缩） |
| Rating 预估 | Phase1 已完成，v1.9.0 可折叠 | 使用完整 Diving-Fish 系数表；官方定数与 fit_diff 严格分开；宴会場不计算官方 Rating；v1.9.0 起默认折叠，收起摘要显示「定数 · 100.5% → Rating」，详情页板块可配置默认折叠 |
| 版本显示 | Phase1 已完成 | 保留 Diving-Fish 原始 `from`，并提供舞萌DX/年份国区展示名 |
| 曲库排序 | Phase2 已完成 | 歌曲名升/降序与选定难度官方定数升/降序；缺失定数末尾并高亮排序难度 |
| 推分计划目标 | Phase2 已完成 | 只展示条目选定难度；支持目标达成率、目标 Rating 和导入成绩 |
| 自定义推分弹窗/Toast | 已完成 | 不使用 Android 原生确认弹窗 |
| 更新/下载入口 | 已完成 | 曲库页可打开下载站 |
| 顺时针曲绘滚筒 | 已完成基础版本 | `src/components/DrumRoll.tsx`，动画中多次切换封面 |
| Bilibili 外部搜索入口 | 本轮已实现 | 优先尝试 `bilibili://search`，失败回退 HTTPS 搜索；用户可按谱面本地保存视频链接、备注和标签，不抓取目录 |
| OCR 拍照识别 | Phase E 已实现 | ML Kit；中文/日文/拉丁文字；连续拍摄、相册多选、逐图识别、合并去重和删除图片 |
| 今日舞萌运势 | Phase F 已实现 | 稳定 SD/DX 推荐键、推荐曲绘、上海日期本地娱乐结果；不读取 Token、不上传运势；v1.7.0 起排除宴会場谱面，仅常规曲目可被推荐 |
| 个人设置 | Phase4 已完成 | SecureStore Token 管理、只读成绩同步、显示/排序偏好和本地数据清理 |
| 本地牌子查询 | v1.6.0 引入，v1.7.0 重做，v1.9.0 折叠筛选 | `app/plates/index.tsx`、`src/data/plates.ts`：按本机已导入成绩计算 FC/SSS/FS DX/AP 位掩码；v1.7.0 起进入页面即渲染（`useFocusEffect` 强刷 + 关闭 `removeClippedSubviews`，修复嵌套 Stack 初次空白）、按难度分别输出汇总卡、同曲多难度合并为一行并逐难度展示牌子位、支持一键把当前筛选中等级 ≥14 的谱面批量加入推分计划并可一键撤回；v1.9.0 起版本/国区/难度筛选默认收起为单行摘要（点开再展开），总计汇总卡保持展开但分难度明细可纵向滚动，避免筛选区过高挤占曲目列表；不上传成绩 |
| 推分计划排序工具 | v1.6.0 引入，v1.7.0 增强，v1.9.0 修复串位 | 计划卡片化 + 计划内搜索 + 拖拽排序（`react-native-draggable-flatlist`）；v1.7.0 起左滑改为置顶 📌 / 置底 🔻 标记（再点取消），置顶/置底条目只与同组交换位置（`applyDragWithPinGroups` 收敛跨组拖拽），新添加曲目插入置顶组下方第一首；v1.9.0 修复 `reorder` 按陈旧 order 字段重排导致拖拽结果被丢弃的串位问题（改为信任传入数组顺序 + 每次拖拽后重建列表内部顺序缓存） |
| 推歌英灵殿 | v1.7.0 已完成 | 从计划移除曲目走应用内自定义确认弹窗（不再使用系统 Alert），移除后进入英灵殿（计划页标题栏 🗑️ 入口）：记录移除时间、可复原回计划或强制彻底删除；数据存于独立 AsyncStorage 键 `maimate_plan_graveyard`，标题在渲染时实时解析不落盘 |
| 版本双轨筛选 | v1.6.0 引入，v1.7.0 修正 | 原始 `from` 与国区年份分组分离筛选（`src/data/version-catalog.ts`）；v1.7.0 起无独立成绩数据的 PLUS 代次（でらっくす/Splash/UNiVERSE/FESTiVAL/BUDDiES）并入母版本标签统一筛选，PRiSM PLUS 有数据保持独立，ALL FiNALE 无数据已从版本常量移除；牌子查询页的原始版本维度只保留 DX 代之前旧世代，避免与国区维度组合必然为空 |
| 外部应用优先打开 | v1.6.x 引入，v1.7.0 调整，v1.9.0 深链修复 | `src/data/external-links.ts` + `plugins/with-external-app-queries.js` + `src/data/bilibili-bvid.ts`：Bilibili 搜索深链优先失败回退 HTTPS 不变；v1.9.0 起 Android 上绕过 `canOpenURL` 预判（package visibility 会造成假阴性）改为直接 openURL + 隐式 intent（不带 packageName），用户自存 B 站视频按 `bilibili://video/<av>`（BV 本地转 av，兼容面更广）多候选逐个尝试，最后回退网页；音乐平台客户端搜索深链路由未公开，v1.7.0 起默认改为直接打开 HTTPS 搜索结果页，v1.9.0 在设置页提供「试开」真机诊断器 |
| 完成率损失试算 | v1.8.0 引入，v1.9.0 修正口径 | `src/data/achievement-loss.ts` + `src/components/AchievementLossCard.tsx`：按官方达成率公式反推各判定下单音符损失；v1.9.0 起常规音符行（Tap/Hold/Slide/Touch）与 Break 行统一为「单音符」口径（不再乘总数），标题去掉「试算」、删除底部规则说明脚注，默认折叠 |
| 详情页板块配置 | v1.9.0 新增 | `src/store/settings-store.ts`（`detailBoards`）+ `app/settings/detail-boards.tsx` + `src/components/MusicPlatformBoard.tsx`：歌曲详情页四个板块（Rating 预估 / 完成率损失 / B 站搜索 / 音乐平台搜索）的上下顺序与默认折叠可在设置页配置；Rating 与完成率损失默认折叠 |
| 音乐平台搜索设置页 | v1.6.0 已完成，v1.9.0 加试开 | `app/settings/music-platform.tsx`、`src/data/music-platforms.ts`：网易云/QQ音乐/酷狗选择，默认网易云且仅使用 HTTPS 搜索页；v1.9.0 增「试开当前平台搜索」真机诊断按钮与候选深链展示 |
| Bilibili 单条链接保存增强 | v1.6.x 已完成 | 分享文本容错解析、按源 URL 键控封面缓存、元数据请求代次防串扰、遗留封面扩展名清理（`bilibili-links/-metadata/-cover-cache`、`bilibili-store`） |
| 设置子页与嵌套导航 | v1.6.5–v1.6.6 已完成，v1.9.0 增 detail-boards | `app/settings/{index,sort,music-platform,detail-boards}`、`app/song/[id]`、`app/plates` 均挂到原生 Stack 子路由并带系统返回；`scripts/route-check.mjs` 做路由树回归 |
| APK 发布链路 | 云构建中 | GitHub Actions（tag 触发，回归门禁）→ GitHub Release `MaiMate-latest.apk` → Cloudflare Pages 项目 `maimate-landing`（maimate.flya.ccwu.cc）`_worker.js` 代理 latest 资产 |

### 3.3 已完成但仍需人工验收的能力

代码、静态检查、云构建和线上下载链路已经完成；仍需真实 Android 设备做最后验收：

- Bilibili 客户端深链是否在真实 Android/Bilibili 版本组合中成功打开搜索；
- 深链失败时 HTTPS 搜索回退是否在真实设备上可用；
- v1.7.0：音乐平台 HTTPS 搜索结果页在真实设备各平台客户端外的浏览器表现；
- v1.7.0：用户自存 Bilibili 视频 `bilibili://video/<BV>` 深链能否直达客户端内播放页（而非网页）；
- OCR 相机、快速加入计划、详情返回 OCR 和随机动画需要真机验收；
- 牌子查询返回导航、计划拖拽排序、外部应用拉起（bilibili/orpheus/qqmusic/kugou）和 Bilibili 封面刷新同样需要真机验收；
- v1.7.0：牌子查询页首次进入即渲染内容（原「点筛选后才显示」）需真机复核；分难度汇总、合并行、一键 14+ 加入/撤回交互验收；
- v1.7.0：推分计划置顶/置底标记、同组拖拽约束、新条目插入位置、英灵殿复原/强制删除流程验收；
- v1.9.0：B 站自存视频 `bilibili://video/<av>`（av 优先）在真实 Android/Bilibili 组合能否直达客户端内播放页；绕过 canOpenURL 后深链是否稳定拉起；
- v1.9.0：音乐平台「试开当前平台搜索」真机诊断——各平台客户端搜索框是否自动填词（未填词为已知限制，路由未公开）；
- v1.9.0：推分计划连续两次拖拽不再串位；牌子页筛选折叠 + 总计卡滚动；完成率损失单音符口径与 DX Rating 默认折叠摘要；设置页「详情页板块」顺序/折叠生效；
- 本会话没有连接 Android 设备（`adb devices` 为空），因此以上真机结果不能虚报为已验证。

---

## 4. 用户界面和主要流程

### 4.1 曲库流程

```text
启动
  ├─ 读取本地曲库缓存并立即展示
  ├─ 缓存超过 12 小时 → 后台请求 Diving-Fish music_data
  └─ 用户手动刷新 → 强制请求最新数据

曲库页
  ├─ 多维筛选/搜索
  ├─ SongCard 展示封面、标题、曲师、分类、BPM、SD/DX、难度
  ├─ 点击歌曲 → 歌曲详情
  ├─ 长按歌曲 → 当前版本仍进入详情；推分操作由详情页完成
  ├─ 拍照识别 → OCR 模态页
  ├─ 排序 → 歌曲名或选定难度官方定数；排序难度高亮
  └─ 更新/下载 → MaiMate 下载站
```

### 4.2 歌曲详情流程

```text
歌曲详情
  ├─ 基本信息和封面
  ├─ 难度选择
  ├─ 谱面详情：等级、官方定数、拟合定数、Note 分布、谱师
  ├─ DX Rating 预估
  ├─ Bilibili 搜索入口（离开 App；不内嵌播放器、不读取视频目录）
  └─ 加入/移出推分计划
```

### 4.3 推分计划、运势与设置流程

```text
歌曲详情 → 选择难度 → 加入推分计划
  ├─ 计划卡只显示该条目的选中难度
  ├─ 输入目标达成率 → 计算官方目标 Rating（缺失/宴会場定数显示 —）
  └─ 若已同步成绩 → 显示当前达成率、DX Score、FC/FS 和服务器 RA

今日运势 Tab
  ├─ 本地生成/读取安装种子
  ├─ 使用上海日期生成当天稳定的人品值、宜/忌和推荐歌曲
  └─ 娱乐功能，不读取成绩 Token、不上传数据

牌子查询 Tab
  ├─ 用本机已导入成绩构建每张谱面的 FC/SSS/FS DX/AP 位掩码
  ├─ 版本 / 国区 / 难度筛选
  ├─ 汇总卡显示各牌子 x/y 计数
  └─ 点击条目进入歌曲详情（source=plates）；无成绩时提示先在设置导入

设置 Tab
  ├─ SecureStore 保存/删除用户主动输入的 Import-Token
  ├─ 只读验证并同步 Diving-Fish 成绩
  └─ 控制国区版本名、默认排序和目标 Rating 显示
```

### 4.4 随机抽歌流程

```text
推分计划 / 全曲随机 / 按条件
  ↓
构造候选集
  ↓
随机确定真实目标
  ↓
滚筒动画展示若干候选
  ↓
最终停在真实目标
  ↓
点击结果卡片进入歌曲详情
```

### 4.5 OCR 流程

```text
曲库页 → 拍照识别
  ↓
请求相机权限
  ↓
拍照
  ↓
ML Kit 分别尝试日文、中文、拉丁文字模型
  ↓
只把识别出的文字与 MusicData.title 匹配
  ↓
展示候选歌曲和匹配文字
```

不得把上述流程扩展成“通过封面识别歌曲”。

---

## 5. 工程架构和文件地图

### 5.1 技术栈（以当前代码为准）

- Expo SDK `~57.0.14`；
- React `19.2.3`、React Native `0.86.2`；
- TypeScript；
- Expo Router；
- Zustand；
- AsyncStorage（曲库、计划、偏好和已导入成绩）；
- `expo-secure-store`（仅保存用户主动配置的 Import-Token）；
- `@react-native-ml-kit/text-recognition`；
- `expo-image-picker`、`expo-file-system`、`expo-sqlite` 等 Expo 模块；
- `react-native-reanimated`、`react-native-worklets`；
- `react-native-draggable-flatlist` + `react-native-gesture-handler`（推分计划拖拽排序，v1.6.0 起）；
- `expo-intent-launcher`、`expo-linking`（外部应用优先打开与深链回退）；
- 纯函数回归脚本用 `tsx` 运行：`npm run test:rating` / `test:phase-af` / `test:features` / `test:routes`；
- `react-native-webview` 目前在 package.json 中但源码零引用，属未使用依赖待清理，不构成内嵌 WebView 能力；
- 样式主要使用 React Native `StyleSheet.create`，不是旧设计案中描述的 NativeWind/SQLite 全量架构。

### 5.2 目录地图

```text
App Git 根（2026-08-26 起 = Windows 工作区 D:\AGENT\dsh\Workspace\flya-workspace\maimate）
├── docs/DESIGN.md                  本设计案（仓库内副本）
├── docs/BUILD.md                   构建指南
├── AGENTS.md / CLAUDE.md           智能体说明
├── app.json                        Expo 配置（version/versionCode、权限、插件）
├── app/                            Expo Router 路由
│   ├── _layout.tsx                 根布局、Tabs、启动加载
│   ├── index.tsx                   曲库首页
│   ├── random.tsx                  随机抽歌
│   ├── plan.tsx                    推分计划
│   ├── fortune.tsx                 今日舞萌运势
│   ├── plates/index.tsx            本地牌子查询（Stack 子路由）
│   ├── settings/index.tsx          个人设置和成绩导入（Stack 子路由）
│   ├── settings/sort.tsx           默认排序选择子页
│   ├── settings/music-platform.tsx 音乐平台选择子页
│   └── song/[id].tsx               歌曲详情（Stack 子路由）
├── src/api/
│   ├── prober.ts                   music_data 和曲库缓存
│   ├── chart-stats.ts              chart_stats 和统计缓存
│   └── score-import.ts             SecureStore Token、只读成绩 API 和归一化
├── src/data/
│   ├── types.ts                    MusicData/ChartStats 等类型
│   ├── music-list.ts               纯函数筛选和搜索引擎
│   ├── rating.ts                   完整 Diving-Fish Rating 计算
│   ├── fortune.ts                  本地确定性今日运势
│   ├── bilibili-search.ts          外部客户端深链和 HTTPS 搜索 URL
│   ├── bilibili-links.ts           用户主动保存的单条视频链接模型
│   ├── bilibili-metadata.ts        单条链接公开元数据获取（显式链接限定）
│   ├── bilibili-cover-cache.ts     按源 URL 键控的封面文件缓存
│   ├── external-links.ts           外部应用优先打开与 HTTPS 回退
│   ├── music-platforms.ts          网易云/QQ音乐/酷狗搜索 URL
│   ├── plates.ts                   本地牌子位掩码计算与筛选
│   ├── plan-order.ts               计划排序保护（过滤视图防拖拽丢条目）
│   ├── version-catalog.ts          原始版本与国区年份分组目录
│   ├── song-aliases.ts             别名层（当前不预置别名表）
│   ├── cover-resolver.ts           统一曲绘解析（宴会場同名回退等）
│   ├── title-search.ts             OCR 曲名匹配
│   └── settings-options.ts         设置选项定义
├── src/store/
│   ├── music-store.ts              曲库、缓存、筛选、chart_stats 状态
│   ├── plan-store.ts               推分计划持久化
│   ├── score-store.ts              SecureStore Token 与本地成绩状态
│   ├── settings-store.ts           显示偏好持久化
│   └── bilibili-store.ts           单条链接、元数据与封面缓存状态
├── src/components/
│   ├── FilterBar.tsx / SongCard.tsx / CoverImage.tsx / RangeSlider.tsx
│   ├── BilibiliSearchPanel.tsx / TitleRecognizer.tsx / DrumRoll.tsx
│   └── PlanEntryCard.tsx / RatingPanel.tsx / NoteBar.tsx / DifficultyBadge.tsx
├── plugins/
│   └── with-external-app-queries.js  Android 包可见性（查询外部应用）配置插件
├── scripts/
│   ├── feature-check.ts / phase-af-check.ts / rating-check.ts  纯函数回归（tsx）
│   └── route-check.mjs             路由树回归
└── .github/workflows/build-apk.yml tag 触发的云构建（回归门禁 + arm64 APK → Release）
```

历史 Linux 工作区中的 `README.md`、`design/`、`landing/`、`research/djnaughty/` 不在本克隆内；`landing/` 的 Cloudflare Pages/Worker 部署仍由下载站侧维护。

### 5.3 关键数据来源

```text
https://www.diving-fish.com/api/maimaidxprober/music_data
https://www.diving-fish.com/api/maimaidxprober/chart_stats
https://www.diving-fish.com/covers/{id}.png
```

曲库缓存键定义在 `app/src/constants/game.ts`，过期时间当前为 12 小时。曲库和谱面统计缓存分别处理；网络失败时保留旧缓存并显示错误状态。

---

## 6. 关键数据模型和边界

### 6.1 MusicData / ChartData

```ts
interface MusicData {
  id: string;
  title: string;
  type: 'SD' | 'DX';
  ds: number[];
  level: string[];
  cids: number[];
  charts: ChartData[];
  basic_info: {
    title: string;
    artist: string;
    genre: string;
    bpm: number;
    release_date: string;
    from: string;
    is_new: boolean;
  };
}

interface ChartData {
  notes: number[];
  charter: string;
  stats?: ChartStats;
}
```

### 6.2 ChartStats

`fit_diff` 是 Diving-Fish 统计接口的拟合定数，不等同于官方定数。界面必须同时标明“官方定数”和“拟合定数”，不能把拟合值伪装成官方数据。

### 6.3 Rating、官方定数和宴会場边界

`src/data/rating.ts` 使用完整的 Diving-Fish 系数表，计算为：

```text
floor(ds × min(achievement, 100.5) / 100 × coefficient)
```

`MusicData.ds[index]` 是官方定数；`ChartStats.fit_diff` 只是统计拟合参考。`basic_info.genre === 宴会場` 或定数缺失时，界面显示“无详细定数”，不计算官方目标 Rating；拟合值必须单独标注。

### 6.4 版本展示边界

`basic_info.from` 原始字符串永远保留，用于 API 数据完整性和版本筛选。`src/constants/game.ts` 的 `getChinaVersionName()` 只负责展示舞萌DX、Splash/UNiVERSE/FESTiVAL/BUDDiES/PRiSM 年份名；未知未来版本回退原始字符串。

### 6.5 PlayerScore 与 Token 边界

成绩同步只调用：

- `GET /api/maimaidxprober/player/validate`；
- `GET /api/maimaidxprober/player/records`。

请求使用用户在设置页主动输入的 `Import-Token`；Token 只进 `expo-secure-store`，不进入 AsyncStorage 成绩 JSON、日志、测试 fixture、文档或构建参数。成绩记录归一化为 `songId + type + difficultyIndex + achievement + dxScore + fc/fs + serverRating`，App 不执行任何写入接口。

### 6.6 今日舞萌运势边界

运势由安装种子和上海日期在本地确定性生成，结果包含人品值、宜/忌和推荐歌曲。每天结果稳定，不依赖玩家成绩、不调用远程运势接口，也不上传安装种子。

### 6.7 Bilibili 外部搜索参数

新方案不生成全量 Bilibili 视频目录，不维护 `ChartVideo[]` 正式目录，也不通过搜索结果自动写入 BV/UP 主资料。歌曲详情页使用本地歌曲信息构造搜索内容：

- 歌曲标题：`songTitle`；
- 谱面难度：只对 Expert/Master/Re:MASTER 提供入口；
- 搜索词：保持当前行为，使用 `${songTitle} ${difficultyLabel} maimai`；
- 规范网页地址：Bilibili HTTPS 搜索 URL，并对搜索词进行 URL 编码；
- 用户主动保存的单条链接可以另外保存视频 URL、公开标题和封面缓存，不形成目录。

客户端深链只是外部跳转手段；保存的单条链接同样优先尝试 Bilibili 应用，失败时回退到其 HTTPS 页面。单条链接元数据请求不使用账号、Cookie 或 Diving-Fish Token。

### 6.4 研究 JSON

`research/djnaughty/djnaughty-all-videos.json` 仅作为历史研究和可选的人工资料，不再是 App 发布前置条件，也不直接作为 App 数据源。它仍可保留：

- `status`：`complete` 或 `partial`；
- `source`：UP 主、MID、接口和标题规则；
- `crawl`：页数、数量、错误；
- `allVideos`：所有抓到的公开视频；
- `chartConfirmVideos`：标题符合规则的候选子集。

在外部搜索方案下，`status: partial` 不阻塞 App 发布；不再为了填满这个 JSON 继续对 Bilibili 风控接口重试。若未来需要人工研究，公开 BV/CSV/JSON 仍可单独整理，但不能自动进入 App。

---

## 7. Bilibili 外部搜索跳转策略

### 7.1 产品决策

- App 歌曲详情页不内置全量 Bilibili 视频目录、不嵌入播放器；只展示用户主动保存到当前谱面的单条链接；
- App 提供“去 Bilibili 搜索该谱面”外部操作，也允许用户粘贴分享文本保存链接；
- 搜索内容保持当前实现：歌曲标题、当前谱面难度和 `maimai` 关键词；
- 只对 Expert/Master/Re:MASTER（红、紫、白谱）提供搜索入口；
- 对用户主动提供的单条 HTTPS 视频链接，可以按需请求公开页面/API 元数据并在本机缓存标题、公开封面地址和封面文件；不保存 Cookie、账号信息或视频内容；
- 不建立自动视频目录、全量视频 JSON 或视频内容审核流程；
- 玩家投稿、审核队列、举报和下架仍不属于当前阶段。

历史版本的全量视频目录为空，用户实际上已经主要使用“去 Bilibili 搜索该谱面”入口。本轮保留这一搜索入口，同时增加显式链接的主动保存：用户粘贴单条分享文本后，App 才解析该链接并按需获取公开标题/封面，不生成全量视频目录。

### 7.2 外部跳转与显式链接行为

- 规范搜索地址继续使用当前 HTTPS URL：
  `https://search.bilibili.com/all?keyword={encodedSongTitleDifficultyQuery}`；
- 实施时可以优先尝试 Bilibili 应用支持的搜索深链；
- 深链不可用、Bilibili 应用未安装或系统拒绝时，必须回退到同一搜索词的 HTTPS 页面；
- 用户粘贴单条分享文本时，只解析其中明确给出的 Bilibili 链接；不得通过搜索结果或用户主页生成目录；
- 单条链接的标题、公开封面地址和封面文件可以按需获取并写入本机缓存；请求不得依赖账号、Cookie 或 Diving-Fish Token；
- 不使用 App 内嵌 WebView，不在 MaiMate 内播放视频；保存的视频仍通过应用优先/HTTPS 回退在外部打开；
- “直接打开 Bilibili 应用”属于尽力而为能力，具体 Scheme、Android 版本和 Bilibili 客户端版本必须用真实设备验证，设计案不能保证所有设备都能拦截 HTTPS 链接；
- 跳转失败时仍应让用户得到可用的网页结果，而不是让详情页报错。

### 7.3 搜索入口 UI 范围

歌曲详情页只保留：

- Bilibili 搜索标题；
- 当前难度标签；
- 一个“去 Bilibili 搜索该谱面”按钮；
- 用户主动粘贴并保存的单条链接入口，以及公开标题/封面预览。

应删除或不再设计：

- 自动生成的全量视频列表；
- 依赖 UP 主抓取、人工审核队列或视频审核状态的功能；
- 通过搜索结果自动写入 Bilibili 视频目录；
- “视频目录由人工整理”等内部流程说明；
- 全量 Bilibili 视频目录或 BV 数据的正式填充。

### 7.4 研究和反爬虫边界

`research/djnaughty/` 保留为历史研究区，但不再是 App 功能的前置依赖。已有的 HTTP 412、`-403`、`-799` 和 `risk-captcha` 结果作为风控证据保存；不再为了给 App 准备视频而继续请求或绕过 Bilibili 限制。

项目明确不做以下事情：

- App 客户端抓取 Bilibili 搜索结果或主页；
- 自动解析并写入视频目录；
- 绕过 CAPTCHA、伪造设备、重放 Cookie 或轮换代理规避限制；
- 把 `SESSDATA`、Cookie、Token 或二维码交给 agent；
- 让视频资料研究阻塞曲库、OCR、推分计划或新版本发布。

未来如果有人愿意单独整理公开 BV/CSV/JSON，可以作为外部研究资料保存，但不自动进入 App。

### 7.5 新方案验收标准（实施时）

- Expert/Master/Re:MASTER 详情页能够生成正确的歌曲名 + 难度搜索词；
- 安装 Bilibili 客户端的真实 Android 设备上，若客户端支持该深链，则优先进入应用搜索；
- 未安装客户端或深链不可用时，能够打开 HTTPS 搜索页；
- App 包内不包含自动生成的视频目录、BV 列表或人工视频队列；
- 用户主动提供单条链接后，才允许请求公开元数据并缓存标题/封面；不需要账号、Cookie、Diving-Fish Token 或新增权限；
- 不影响歌曲详情页其余信息、OCR、推分计划和曲库缓存；
- 真机验证完成前，不声称“所有 Android 设备都能直接拉起 Bilibili”。

---

## 8. 当前未完成事项和优先级

### A0：Bilibili 资料研究（降级为可选归档，不阻塞发布）

状态：不再作为产品阻塞。已有研究结果确认 Bilibili 风控会返回 HTTP 412、`-403`、`-799` 或验证码页面；继续自动抓取没有必要。

目标：保留现有研究证据，必要时允许人类单独整理公开链接；不为 App 建立内置视频目录。

完成标准：

- 保留 `research/djnaughty/` 的脚本、README 和历史 partial JSON；
- 不要求 JSON 的 `status` 变为 `complete`；
- 不要求 `allVideos` 或 `chartConfirmVideos` 非空；
- 不把研究文件作为 App 构建或发布前置条件；
- 不把任何研究结果自动写入 App，也不生成 `app/src/data/bilibili-search.ts` 之外的视频数据文件。

### A1：用户提出的下一版交互修订（代码和云发布已完成，等待真机验收）

1. 将 Bilibili 区域简化为一个“去 Bilibili 搜索该谱面”按钮，删除内部说明文字；
2. 删除视频列表、视频类型、UP 主、单条打开、复制链接和“暂无已确认的视频”状态；
3. 优先尝试 Bilibili 客户端搜索深链，失败后回退 HTTPS 搜索页；
4. 删除曲库下拉刷新，避免误触；
5. 点击抽歌滚动区域立即结束动画；
6. 删除歌曲详情的“全难度比较”区块；
7. OCR 匹配歌曲下方展示该条识别文字；
8. OCR 结果支持快速加入推分计划；
9. 从 OCR 详情返回时回到 OCR 页面；
10. 修复随机滚筒左右曲绘裁切；
11. 删除随机页未开始时的老虎机图标。

新方案不包含“人工审核视频后填充正式目录”这一步。本轮代码已实现上述交互；仍需通过 GitHub Actions 云构建、真实 Android 验收和个人站部署后才能称为本版本发布完成。

### A1.5：用户第二轮修订（代码已完成，等待真机验收）

2026-08-26 提出、当日完成实现；尚未云构建与发版：

1. **B 站深链**：b23.tv 短链在打开时自动解析成最终视频地址（结果会话内缓存），再拉起 `bilibili://video` 深链；视频 ID 提取扩展覆盖 mobile 主站、`?bvid=`/`?avid=` 参数形态；面板新增可折叠「深链诊断」区，逐条显示跳转策略并支持试开；
2. **音乐平台应用优先（默认开启）**：恢复逐个尝试客户端搜索深链候选（社区路由，无官方文档），全部失败自动回退 HTTPS 搜索页；设置 → 默认音乐平台页提供「优先打开应用（实验）」开关与候选深链列表；
3. **牌子查询筛选无字**：三行筛选 chips 从横向 ScrollView 改为 flexWrap 换行容器，外层容器以 focusTick 作 key 整树重挂载，规避嵌套 Stack 首帧测量异常；
4. **推分计划拖拽串位**：每次拖拽提交后自增 dragEpoch 强制 DraggableFlatList 重建内部顺序缓存，并在应用结果前校验拖拽键与 store 条目一一对应；
5. **详情页返回来源**：路由重构为根 Stack（`(tabs)` 分组 + `song` 兄弟路由），详情页压在 Tabs 之上，返回自然回到进入前的 Tab；
6. **完成率损失试算（新功能）**：详情页 Rating 板块下方新增折叠卡片，按谱面 Note 分布计算单音符各判定损失的达成率百分点与等效 Great·Tap 数（两种口径按钮切换）；计分口径见 `src/data/achievement-loss.ts` 头注释（基础分单位权重 Tap1/Hold2/Slide3/Break5，Break 内部档位 G-2000/1500/1250 等效 5/10/12.5 个 Tap·Great、Good=15、Miss=25，奖励分池每 Break 平分 1 点、份额 CP100%/P-2550 75%/P-2500 50%/Great 统一 40%/Good 30%/Miss 0%，理论满分 101%）。


### A3：用户第三轮修订 v1.15.0（代码已完成，云构建中，等待真机验收）

2026-08-28 提出、当日完成实现（功能提交 `e1d5846`）：

1. **B50 顶栏与状态栏重合**：根级路由自定义头部补 `paddingTop: insets.top + 10`；
2. **新曲/旧曲切换按钮消失**：根因是上版 `{selectionToolbar ?? (池切换行)}` 中 selectionToolbar 表达式在网格模式下恒为非空 JSX，`??` 永走左分支顶掉池切换；改为显式 `showSelectionToolbar` 三元分支；
3. **计划底部遮挡（三保险）**：`contentContainerStyle paddingBottom` + `ListFooterComponent` 高度占位（v1.14 的 padding 曾被 DraggableFlatList 内部结构吃掉）；
4. **分享卡表格布局**：B50 卡重排为旧曲 35 上（7×5）新曲 15 下（3×5），每格难度色外框曲绘 + 左下定数 + 右下 Rating + 完成率着色底纹；新增 `Fit50ShareCard` 全 50 格（10×5）同款；
5. **拟合 50（新功能）**：`src/data/fit50.ts` `computeFit50(rawData, scores, chartStats)`——全库谱面按拟合定数（fit_diff）计算单谱 Rating = floor(fit_diff × ach/100 × 系数)，排除无 fit_diff/无成绩谱面，取最高 50；B50 页新增 B50/拟合50 模式切换（汇总卡、列表/网格、排序切换「按 Rating/按拟合定数」、长按多选入计划、分享全共享）；
6. **详情页曲绘大图**：点 hero 曲绘打开自绘全屏 overlay（512×512 源图，点背景关闭）；
7. **删设置页「只读同步成绩…」提示**；**删详情页 B 站面板深链诊断折叠区**（含死代码清理）；
8. **快照推分战报（新功能）**：`src/data/snapshot-battle.ts` `buildSnapshotBattleReport`——逐曲卡片（曲绘/曲名/难度徽章/旧→新达成率/±Rating）+ 汇总条（Rating 总变化/新增/上分/移除/服务器 RA）；
9. **计划排序切换**：「手动序/缺口优先」chips——缺口 = 目标 Rating − 当前 Rating（按官方定数），未设目标视为无穷缺口排最前，已达标排最后；缺口序下禁用拖拽；
10. **网格完成率底纹**：格子曲绘下 3px 着色进度条（金/绿/灰三档与文本同色）；
11. **快照保留数量**：默认 6 → 20，设置页可改 1–1000（修改时 Alert 警告存储占用；`normalizeSnapshotLimit` 归一化，备份/恢复与 store 加载均走该口径）；syncScores 按 `settings.snapshotLimit` 裁剪。

验收关注：B50 顶栏安全区、池切换按钮恢复、拟合 50 数值合理性（依赖 chart_stats 缓存）、分享卡表格视觉、计划底部余量、战报累计口径。


### A2：第三阶段只读审查

审查以下文件的 TypeScript、Expo SDK 57、运行时、权限和范围边界：

```text
app/src/components/DifficultyBadge.tsx
app/src/components/BilibiliSearchPanel.tsx
app/src/components/TitleRecognizer.tsx
app/src/data/title-search.ts
app/src/data/bilibili-search.ts
app/app/index.tsx
app/app/song/[id].tsx
app/app.json
app/package.json
```

审查只输出问题等级和建议，不在审查阶段修改文件。

### B：其他 UP 主资料接入（当前取消）

其他 UP 主的视频资料不再作为 MaiMate App 的产品数据接入。若未来做独立研究，只保留公开资料整理，不改变 App 的外部搜索策略，也不增加每个 UP 主的内置 JSON、审核状态或视频目录。

### C：未来第四阶段

未来如果真的开放玩家投稿，需要单独设计：

- 投稿链接格式和 BV 校验；
- 曲目/难度匹配；
- 去重；
- 人工审核队列；
- 举报、下架、审核日志；
- 管理员权限和后端存储。

在没有后端和审核流程前，不要在 App 中伪装成“支持投稿”。

---

## 9. 构建、验证和发布规则

### 9.1 本地静态验证

在 `app/` 中：

```bash
npm install
npm run lint
npx expo export --platform android
```

Windows 沙盒环境（2026-08-26 实测）补充：npm 默认缓存目录在用户 AppData 下会被文件沙盒拒绝，需 `--cache "$env:TEMP\npm-cache"`；esbuild 的 postinstall 与 Hermes `hermesc` 需要子进程 spawn 同样被拒，因此 npm 安装加 `--ignore-scripts`、本地 export 加 `--no-bytecode`（Hermes 字节码由 CI Ubuntu 门禁验证）；`tsx` CLI 会 spawn esbuild 子进程同样不可用，TS 回归脚本改用「`tsc --module node16 --rewriteRelativeImportExtensions --outDir <仓库内临时目录>` 编译成 CJS 后用 node 直跑」的方式执行。

本机不适合 Gradle 原生构建；正式 APK 使用 GitHub Actions。完整说明见 `app/docs/BUILD.md`。

### 9.2 发布链路

```text
App Git commit/tag
  ↓
GitHub Actions Build Android APK
  ↓
GitHub Release 上传 MaiMate-latest.apk
  ↓
landing/_worker.js 指向固定 Release
  ↓
https://maimate.flya.ccwu.cc/MaiMate-latest.apk
```

每次发布必须记录：

- Git commit/tag；
- Actions run；
- APK 大小、ABI、包名；
- SHA-256；
- 公网下载 URL 和 HTTP 状态；
- 是否只是研究文件，还是已经进入 App。

---

## 10. 变更记录写法（以后每一步都追加）

不要删除历史记录，也不要用“现在已经完成”覆盖过去的事实。每次对话涉及设计、研究、代码或发布，都在本文档末尾追加一个条目：

```markdown
### YYYY-MM-DD — 简短标题

- 用户目标：
- 本步范围：
- 状态：计划中 / 进行中 / 已完成 / 部分完成 / 阻塞
- 实际修改：列出精确文件路径；没有修改则明确写“无 App 代码修改”
- 验证证据：命令、返回码、提交、URL、文件统计或错误
- 人类需要确认：
- 下一步：
```

如果遇到网络、凭据、反爬、设备或构建阻塞，必须记录：

- 阻塞发生在哪里；
- 已经尝试了什么；
- 哪些结果可以确认；
- 人类可以提供什么帮助；
- 在阻塞解除前不要声称任务完成。

---

## 11. 历史背景和已完成里程碑

### 2026-08-16 — 初始设计

- 确定项目名 MaiMate；
- 确定 Expo + React Native + TypeScript；
- 确定 Diving-Fish 为曲库数据源；
- 确定“霓虹舞伴”深色配色；
- 确定曲库、推分计划、随机抽歌三条核心闭环；
- 创建公开仓库 `FengLingYaaa/maimate-app`。

### 2026-08-18 — P0～P6 修复和 v1.1.0-alpha

- 修复分类、SD/DX、版本、谱师和模糊搜索；
- 增加定数范围筛选和高亮；
- 增加曲库/谱面统计缓存和后台更新；
- 完成计划默认随机、确定性抽选结果、最高难度默认值；
- 完成官方/拟合 Rating 展示；
- 完成自定义推分弹窗、Toast、更新入口和滚筒动画；
- 云构建并发布 `v1.1.0-alpha`。

### 2026-08-18 — 第三阶段基础代码和 v1.2.0-alpha

- 增加 Bilibili 视频面板架构；
- 限定视频难度为 Expert/Master/Re:MASTER；
- 支持打开链接、复制链接和 Bilibili 搜索；
- 增加设备端 OCR 曲名识别；
- 明确“不识别曲绘、不做第四阶段投稿审核”；
- 提交 `2e353ae` 并发布 `v1.2.0-alpha`；
- 当前人工视频目录仍为空。

### 2026-08-18 — 用户提出下一版修订和视频研究

- 用户要求先不修改 App；
- 提出 OCR、返回路径、滚筒、刷新、Bilibili 客户端拉起和详情页简化等交互修订；
- 指定先研究 UP 主 DJNaughty（MID `27347789`）；
- 明确谱面确认标题规则；
- 要求把全部公开视频整理成文件，之后由人类审核，再决定是否实施下一版。

### 2026-08-18 — 当前设计案重写和抓取重试

- 重写本设计案，使产品目标、事实状态、工程结构、边界和后续流程可被新智能体理解；
- 同步更新 `app/docs/DESIGN.md`；
- 保持 App 代码不变；
- 已存在的 `research/djnaughty/djnaughty-all-videos.json` 此前为 partial，首个请求遇到 HTTP 412；
- 本轮以更低频率启动一次公开接口探测；WBI 重试两次后得到 `-403：访问权限不足`；
- 同时测试旧接口得到 `-799：请求过于频繁，请稍后再试`，公开主页返回 `risk-captcha` 验证码页面；
- 没有新增视频记录，`research/djnaughty/djnaughty-all-videos.json` 仍为 partial/0 条；
- 无 App 代码修改；下一步需要用户在个人网络运行、导出公开 JSON/CSV，或提供公开 BV 列表。

---

## 12. 当前工作结论

截至 2026-08-26：代码主线已推进到 v1.7.0（用户提出的 17 项修复/功能全部实现并推送云构建），设计案事实基线同步更新。当前正确下一步是：

1. 若接入 Android 设备，按 §3.3 清单完成 v1.6.x 与 v1.7.0 全部真机验收（深链回退、OCR、拖拽、牌子页渲染、英灵殿等）；
2. 确认 Cloudflare Pages 落地站 `maimate.flya.ccwu.cc` 已由本会话重新部署到 v1.7.0 内容与 latest 资产代理（见变更记录）；
3. 清理未使用的 `react-native-webview` 依赖（v1.7.0 未处理，源码零引用仅存在于 package.json/package-lock.json）；
4. 保持 `research/djnaughty/` 为历史研究证据，不恢复自动抓取或内置视频目录；
5. 后续每次设计、研究、代码或发布步骤继续追加到本文档。

当前不需要、也不允许把任何视频条目写入正式 App。

### 2026-08-18 — Windows 家庭网络执行仍返回 HTTP 412

- 用户目标：在 Windows 个人电脑和家庭网络运行 DJNaughty 公开视频资料抓取。
- 本步范围：确认 Windows 执行方式可用，并判断 HTTP 412 是否只是 Bash/PowerShell 命令格式问题。
- 状态：阻塞
- 实际修改：无 App 代码修改；仅追加本设计记录。
- 验证证据：用户已在 Windows 环境运行脚本，仍收到 HTTP 412；因此阻塞发生在 Bilibili 风控而不是 Windows 命令格式、Python 依赖或标题解析器。
- 人类需要确认：不要继续高频重试，也不要提供 Cookie、`SESSDATA`、Token、二维码或 HAR 请求文件。若普通浏览器可以正常打开公开页面，可只导出公开视频的公开 JSON/CSV/BV 链接。
- 下一步：优先采用普通浏览器人工访问并导出公开结果；也可以人工整理标题和公开链接，或提供一份公开 BV 列表。若页面同样要求验证码，则停止自动化尝试，不绕过验证码、伪造设备或轮换代理；收到公开结果后先验证完整性，再进行人工视频审核。

### 2026-08-18 — 取消 App 内置视频，改为外部 Bilibili 搜索

- 用户目标：不再在 MaiMate 内置视频，直接跳转 Bilibili 应用搜索当前歌曲和谱面；保持现有搜索能力，只删除多余的视频目录和展示内容。
- 本步范围：修改产品设计和事实基线，不实施 App 代码改动。
- 状态：设计已调整，实施待用户明确开始。
- 实际修改：同步更新 `design/DESIGN.md` 和 `app/docs/DESIGN.md`；无 App 源代码、研究 JSON、构建产物或发布版本修改。
- 设计决策：详情页不展示视频列表、不嵌入播放器、不保存 BV/UP/审核数据；只保留歌曲标题 + 难度生成的 Bilibili 搜索入口。优先尝试客户端搜索深链，失败或未安装客户端时回退 HTTPS 搜索页。
- 可行性结论：可行。当前版本已有 HTTPS 搜索入口；新方案主要是删除空目录、单条视频操作和内部说明。客户端深链是否能在不同 Android/Bilibili 版本中稳定拉起，必须在实施阶段用真实设备验证，不能在设计阶段保证。
- 人类需要确认：本条只代表设计方向，不代表已经开始改 App；在用户明确开工前保持源代码不变。
- 下一步：用户确认后，按 A1 实施 UI 简化和深链回退，再进行 Expo SDK 57 兼容性检查、真机验证、lint、导出、云构建和发布记录。

### 2026-08-18 — v1.3.0-alpha 代码实施完成，等待云构建部署

- 用户目标：按已确认方案移除 App 内置视频，保留 Bilibili 外部搜索，并同时完成此前列出的交互修订。
- 本步范围：实施 App 代码、依赖清理、版本号和 GitHub Actions 发布链路；不抓取 Bilibili，不新增视频数据。
- 状态：代码已完成；云端构建、Release 资产和个人站部署待完成。
- 实际修改：`app/src/components/BilibiliSearchPanel.tsx`、`app/src/data/bilibili-search.ts`、`app/app/index.tsx`、`app/app/random.tsx`、`app/app/song/[id].tsx`、`app/src/components/DrumRoll.tsx`、`app/src/components/TitleRecognizer.tsx`、`app/src/data/types.ts`、`app/src/components/index.ts`、`app/app.json`、`app/package.json`、`app/package-lock.json`、`app/.github/workflows/build-apk.yml`、`landing/_worker.js`、`landing/index.html`；删除旧的 `ChartVideoPanel`、`chart-videos.ts` 和 `expo-clipboard`。
- 实际功能：Bilibili 客户端深链优先、HTTPS 回退；删除下拉刷新和全难度比较；滚筒点击停止、侧边曲绘不裁切、移除抽歌前老虎机图标；OCR 显示匹配文字、快速加入最高可用难度并在返回时恢复 OCR；Android 版本改为 `1.3.0`。
- 验证证据：提交 `a74b19d933b01ffcdbe5e2689d8857a2612c6270`；`npm run lint` 成功；`npm ci --legacy-peer-deps --ignore-scripts --dry-run` 成功；`npx expo export --platform android` 成功；`git diff --check` 成功。尚未完成真实 Android 深链/相机验收和 GitHub Actions 云构建。
- 发布设计：tag `v1.3.0-alpha` 触发 `.github/workflows/build-apk.yml`，工作流使用 `contents: write` 将 APK 上传到同名 GitHub Release；`landing/_worker.js` 已指向该 Release，Cloudflare Pages 部署脚本仍负责个人站发布。
- 人类需要确认：本步没有把任何视频条目写入 App；云构建完成后仍需确认 APK 下载、版本、包名、SHA-256 和个人站线上结果。
- 下一步：提交设计记录后推送 `main` 和 `v1.3.0-alpha`，等待 GitHub Actions 完成，下载/核验 Release APK，运行 `landing/deploy-download-site.sh` 部署个人站，再做线上 HTTP 验证。

### 2026-08-18 — 云发布资产名修正并重新触发构建

- 用户目标：确保云构建产物能被个人站 Worker 以固定路径 `/MaiMate-latest.apk` 下载。
- 本步范围：修正 `.github/workflows/build-apk.yml` 的 Release 上传文件名，并重新触发同一 release tag；不改变 App 功能。
- 状态：已完成。
- 实际修改：工作流先复制 Gradle APK 到 `${RUNNER_TEMP}/MaiMate-latest.apk`，再创建/覆盖同名 GitHub Release 资产；提交 `5759b603e27bb4b842f9aedbeb6a5201940ebe58`，`v1.3.0-alpha` 已更新到该提交并推送。
- 验证证据：第一次运行 `32169009368` 成功但仅上传了旧名 `app-release.apk`；第二次运行 `32169500810` 以 `5759b60` 成功完成，固定资产 URL 返回 200；APK 为 59,889,321 bytes，SHA-256 为 `7144f9a14d08f719fa141a8baf1caa05b4f818a43676de1f69bc751a554c485a`；Cloudflare `wrangler whoami` 成功，个人站部署脚本 `bash -n` 成功。
- 人类需要确认：云构建和线上下载链路已完成；真机安装、OCR 相机和 Bilibili 深链仍需 Android 设备验收。
- 下一步：保留 Release/下载站证据，若接入 Android 设备再完成深链、HTTPS 回退、OCR 返回和随机抽歌的真机回归。

### 2026-08-18 — v1.3.0-alpha 云构建、Release 和个人站部署完成

- 用户目标：完成代码后必须使用 GitHub Actions 云构建，并部署到个人站，不能只停留在本地导出。
- 本步范围：下载云端 Release APK，更新下载页校验信息，部署 Cloudflare Pages/Worker，并验证公开页面和 APK 代理。
- 状态：已完成；发布链路可用，真机验收因无连接设备保留为后续事项。
- 实际修改：`landing/MaiMate-latest.apk`、`landing/MaiMate-latest.apk.sha256`、`landing/index.html`；`landing/_worker.js` 已指向 `v1.3.0-alpha/MaiMate-latest.apk`；工作区 `README.md` 已更新当前 Release。
- 验证证据：GitHub Actions run `32169500810` success，Release 页面为 <https://github.com/FengLingYaaa/maimate-app/releases/tag/v1.3.0-alpha>；APK 59,889,321 bytes，SHA-256 `7144f9a14d08f719fa141a8baf1caa05b4f818a43676de1f69bc751a554c485a`；`landing/deploy-download-site.sh` 部署成功，预览地址为 <https://a1460cb5.maimate-landing.pages.dev>；生产页 <https://maimate.flya.ccwu.cc/> 显示 `v1.3.0-alpha` 和同一 SHA；`GET/HEAD https://maimate.flya.ccwu.cc/MaiMate-latest.apk` 返回 HTTP 200、`application/vnd.android.package-archive`、`content-length: 59889321`、固定附件名；完整下载后的 SHA 与本地 Release APK 一致。
- 人类需要确认：本会话 `adb devices` 只有标题行、没有设备，因此没有虚报安装、相机、Bilibili 深链或 HTTPS 回退的真机结果。
- 下一步：若提供 Android 设备，完成深链优先/HTTPS 回退、OCR 快速加入和返回恢复、随机抽歌点击停止的真机回归；不恢复 Bilibili 自动抓取或内置视频目录。

### 2026-08-18 — 审查修正 DrumRoll 提前停止竞态

- 用户目标：处理后台审查发现的点击停止竞态，确保停止时不会留下 interval、部分旋转角度或重复 `onSpinEnd` 回调。
- 本步范围：只修正 `DrumRoll` 的提前停止完成路径，不改变抽选目标、结果卡片路由或其他产品边界。
- 状态：代码修正已完成，等待重新推送 tag、云构建和个人站 APK 更新。
- 实际修改：`app/src/components/DrumRoll.tsx`；新增完成回调 ref、spin generation guard 和幂等 `finish`，点击时清理 interval、取消 Reanimated 动画、回到最终角度、显示真实 `resultIndex` 并只调用一次 `onSpinEnd`。
- 验证证据：提交 `0ebf7f8f6389bfcbdf5f96ccc1785530c106ce8e`；`npm run lint`、`npx expo export --platform android`、`git diff --check` 均成功。审查没有修改其他文件。
- 人类需要确认：此次修正仍不代表真机验收完成；需沿用 `v1.3.0-alpha` 的 GitHub Actions/个人站发布链路重新生成 APK。
- 下一步：提交本记录，推送 `main`，将 `v1.3.0-alpha` 更新到本修正，等待云构建成功后更新下载站 SHA 并验证固定 APK URL。

### 2026-08-18 — 审查补充：保留抽歌按钮图标

- 用户目标：只删除随机页无结果区域的预旋转 `🎰` 占位图标，不误删实际“抽一项”按钮上的操作图标。
- 本步范围：恢复 `app/app/random.tsx` 抽歌按钮的 `🎰`，保留预旋转占位区删除结果；不改变滚筒空状态提示。
- 状态：代码修正已完成，等待最终云构建和个人站更新。
- 实际修改：`app/app/random.tsx`；按钮恢复为 `🎰 抽一项（...）`，旋转中仍显示 `🌀 旋转中...`。
- 验证证据：提交 `cd83ce2a26a1d33a69ade3d9079bef00e1b494e6`；`npm run lint`、`npx expo export --platform android`、`git diff --check` 均成功。
- 人类需要确认：最终 APK 必须来自包含本条修正的 tag，而不是上一轮已发布的 APK。
- 下一步：将 tag 更新到本提交及同步设计记录，完成最后一次 GitHub Actions 云构建、APK 校验值更新和个人站验证。

### 2026-08-18 — 最终审查修正版云构建与个人站更新完成

- 用户目标：确保后台审查指出的 DrumRoll 提前停止竞态和随机页图标误删都进入最终 APK，并重新完成云构建与个人站部署。
- 本步范围：以 `24c94e8ce9481581cafe6a7b19a8c6c8c37c0c72` 为 `v1.3.0-alpha` 最终 tag，执行 GitHub Actions、更新固定 Release 资产和 Cloudflare Worker 下载站。
- 状态：已完成；最终 APK 已发布，真机验收仍因没有连接设备而保留。
- 实际修改：最终 APK 为 `59889781` bytes；`landing/MaiMate-latest.apk.sha256` 更新为 `9764119d96a5f0620f913e8675b433a7f544d062333b0fb841485221a5be5196`；`landing/index.html` 同步更新校验值；设计副本继续保持同步。
- 验证证据：GitHub Actions run `32173744736` success，构建提交为 `24c94e8ce9481581cafe6a7b19a8c6c8c37c0c72`；固定 Release URL 返回成功；`landing/deploy-download-site.sh` 部署成功，预览地址为 <https://66b1a735.maimate-landing.pages.dev>；生产首页 <https://maimate.flya.ccwu.cc/> 显示 `v1.3.0-alpha` 和新 SHA；APK 返回 HTTP 200、`content-length: 59889781`、`application/vnd.android.package-archive`、固定附件名；完整下载后的 SHA 与本地 APK 一致。
- 人类需要确认：`adb devices` 仍没有 Android 设备，不能把 Bilibili 深链、HTTPS 回退、OCR 相机、OCR 返回和随机点击停止宣称为真机已验收。
- 下一步：接入 Android 设备后做最后回归；继续保持不抓取 Bilibili、不内置视频目录的产品边界。

### 2026-08-18 — 发布后 OCR/路由只读审查

- 用户目标：复核 OCR 文字展示、快速加入推分计划和 OCR 详情返回路径，确认最终发布代码没有遗漏。
- 本步范围：只读审查，不修改代码、不重新发布 APK。
- 状态：审查完成；报告中的部分“待修复”描述对应较早快照，当前最终代码已经包含这些修正。
- 当前证据：`TitleRecognizer` 已显示完整 OCR 和每条匹配的 `match.recognizedText`；快速加入已保护空谱面数据，并在 `planLoaded` 前禁用；`app/index.tsx` 已用 `restoreTitleRecognizerOnFocus`、`useFocusEffect` 和导航前 preserve 标志在返回曲库时恢复 OCR 弹窗。当前 Tabs 布局下该方案仍需真实设备验证返回行为。
- 运行时边界：`@react-native-ml-kit/text-recognition` 是原生模块，最终验证应使用云构建 APK 而不是 Expo Go；本次 `npm run lint` 通过，App Git 工作树干净，设计副本同步，`git diff --check` 通过。
- 人类需要确认：仍无 Android 设备，因此不能把 OCR 相机、详情返回、Bilibili 深链/HTTPS 回退等宣称为真机验收完成；不新增视频目录或 Bilibili 自动化抓取。
- 下一步：接入 Android 设备后执行最后的 OCR、路由、深链和回退回归。

### 2026-08-19 — Phase1–Phase4 v1.4.0-alpha 云构建与个人站同步完成

- 用户目标：实施 Phase1–Phase4，完成校验、云端 Android 构建，并把可测试 APK 同步到个人站；用户提供的测试 Token 不得进入应用、日志、文档或构建环境。
- 实际修改：完整 Diving-Fish Rating 系数表；宴会場/缺失定数边界；原始/国区版本名；歌曲名与选定难度定数排序；只显示计划选定难度、目标达成率/Rating 和导入成绩；本地确定性今日运势；SecureStore 只读成绩同步与设置页；OCR 候选优先显示。实现提交为 `8d6f51b45fbcdaf565f6c21a46e42a6386f7509f`。
- 验证证据：`npm run lint`、`npm run test:rating`（28 个系数边界）、`git diff --check`、`npx expo export --platform android` 和 `npx expo prebuild --platform android --no-install` 成功。GitHub Actions run `32213629250` success；Release 为 <https://github.com/FengLingYaaa/maimate-app/releases/tag/v1.4.0-alpha>；APK `60,097,909` bytes，SHA-256 `109d4b04a1217814f355d01fa20804108500ab85a25df5e22762814210f74170`。
- 个人站：`landing/_worker.js` 指向 `v1.4.0-alpha/MaiMate-latest.apk`；Cloudflare Pages 部署成功，预览部署地址为 <https://30d572c9.maimate-landing.pages.dev>；生产首页显示 v1.4.0-alpha 和同一 SHA；APK URL 返回 HTTP 200、`application/vnd.android.package-archive`、`content-length: 60097909`、固定附件名；完整下载后与本地 APK 字节一致。
- 人类需要确认：`adb devices` 没有 Android 设备，因此不把安装、OCR 相机/返回、Bilibili 深链/HTTPS 回退或五个新 Tab 的真机行为宣称为已验收。APK 是 GitHub Actions 生成的 arm64-v8a debug-signed 内测包；正式分发前仍应配置稳定的 release keystore。

### 2026-08-20 — Phase A-F v1.5.0-alpha 实现、云构建与下载站同步完成

- 独立别名层：新增 `src/data/song-aliases.ts`，当前不预置别名表；普通搜索和 OCR 通过该层扩展，Diving-Fish 原始标题保持不变。
- 曲绘与版本：新增统一 `CoverImage`/`cover-resolver`；宴会場同标题谱面优先使用普通同名歌曲封面，并处理六位数 ID、404 和本地占位图；版本筛选保留原始值，同时展示中国区名称、PLUS 版本和暂无记录状态。
- 成绩：导入保留标题、定数、等级、Rate 等字段；新增最多 6 次本地同步快照与变化记录。快照不是官方游玩次数或逐局历史，Token 仍只存 SecureStore。
- Bilibili：视频链接按 `SD/DX + songId + difficultyIndex` 本地保存，支持备注、快捷标签、编辑和删除；不抓取 Bilibili 页面或 API。
- 推分计划：详情路由传递来源、类型和难度；从计划详情返回计划页；计划列表提供 `100`/`100.5` 快捷目标，自定义目标移到详情页。
- OCR/运势/音乐平台：支持连续拍摄、相册多选、逐图识别、合并去重、删除和 Android pending result；运势推荐保存 SD/DX 身份并直接显示曲绘；音乐搜索支持网易云、QQ 音乐、酷狗，默认网易云且仅使用 HTTPS 搜索页。
- 验证：`npm run lint`、`npm run test:rating`、`npm run test:phase-af`、`git diff --check`、`npx expo export --platform android` 和 `npx expo prebuild --platform android --no-install` 均通过；没有使用或写入任何 Diving-Fish 测试 Token。
- 云构建：GitHub Actions run `32259141373` 成功，Release 为 <https://github.com/FengLingYaaa/maimate-app/releases/tag/v1.5.0-alpha>；arm64-v8a APK `60,134,005` bytes，SHA-256 `f748ae60535ecc2e58f1b7aec17ab3e4bc78d176af2ef8d02ca56f2ad62e73b1`。
- 下载站：Cloudflare Pages 预览部署为 <https://c7259680.maimate-landing.pages.dev>；生产入口 <https://maimate.flya.ccwu.cc/> 显示 v1.5.0-alpha，APK URL 返回 HTTP 200、`application/vnd.android.package-archive`、`content-length: 60134005`、固定附件名；完整下载与本地 APK 字节一致。
- 人类需要确认：仍无 Android 设备，不能把安装、OCR 相机/相册生命周期、计划返回、SecureStore 导入、Bilibili 深链或音乐平台页面宣称为真机验收完成；APK 为 arm64-v8a debug-signed 内测包，正式分发仍需稳定 release keystore。

### 2026-08-19 — v1.6.0–v1.6.10 补录：外部链接、计划工具、本地牌子与导航重构

- 说明：本条为 2026-08-26 会话补录。`fad5974..7ac3a26` 共 11 个提交当时未按第 10 节追加记录，本条依据提交信息和 Release 证据重建；此前另有 `e2d7c4f`（npm 元数据对齐 v1.5.0 + Phase A-F 纯回归检查）、`28d32ee`（锁定版本恢复）、`6f33085`（v1.5.0 发布验证入档）三个收尾提交。
- 实际功能：
  - v1.6.0（`fad5974`）：原生应用优先的外部搜索与 HTTPS 回退；Bilibili 分享文本容错解析与显式单条链接元数据缓存；原始/国区双轨版本筛选；推分计划卡片、搜索与拖拽排序；设置子页 sort/music-platform；本地 FC/SSS/FS DX/AP 牌子查询；新增 Android 包可见性插件 `plugins/with-external-app-queries.js`、手势依赖和纯函数回归检查。
  - v1.6.1（`f656549`）：Bilibili 封面 URL 归一化后安全缓存；计划卡保留投影 Rating 设置；已存链接先用显式 Android intent 打开再 HTTPS 回退。
  - v1.6.2（`4ccc8f2`）：歌曲详情与设置选择器加嵌套 Stack 布局并从根 Tabs 隐藏；链接 URL/曲源变更时清理陈旧封面。
  - v1.6.3（`90d6545`）：派生搜索/显式排序视图禁用拖拽并在重排时保留隐藏条目；重启后恢复持久化的 Bilibili 加载状态；歌曲与牌子筛选暴露基础舞萌DX国区分组；同步更新本文 §6.7/§7 显式链接边界。
  - v1.6.4（`7338d39`）：牌子页增加可见返回控件（无导航历史时回首页）。
  - v1.6.5（`41b7361`）：settings 首页移入 layout 目录，嵌套路由不再注册为根 Tabs 屏幕；新增路由树回归检查 `scripts/route-check.mjs`。
  - v1.6.6（`d0d6493`）：plates 移入嵌套 layout 目录获得原生 Stack 头部；删除页内重复返回按钮。
  - v1.6.7（`425e047`）：封面缓存文件名按源 URL 键控，编辑链接不再复用旧封面像素；URL 变更/删除时清理旧文件；忽略属于旧 URL 的元数据响应。
  - v1.6.8（`7b78163`）：链接级清理覆盖 JPG/JPEG/PNG/WebP 全部遗留扩展名并加 WebP 回归断言。
  - v1.6.9（`5eb70f0`）：逐链接元数据请求代次防止 A→B→A 编辑串扰；同源封面强制 no-cache 临时文件并发布新本地 URI；迁移遗留持久化路径并序列化 AsyncStorage 快照保序；CI 在 arm64 构建前运行 lint/回归/Expo Doctor/export 门禁。
  - v1.6.10（`7ac3a26`）：TypeScript 检查改用固定 tsx runner 替代 Node 22 strip-types，修复 v1.6.9 校验任务失败；versionCode 升至 14。
- 验证证据：GitHub Releases v1.6.0→v1.6.10 于 2026-08-19T18:46Z–22:42Z 先后发布，各含 `MaiMate-latest.apk`（62,037,314 → 62,045,742 bytes）；v1.6.10 由 Actions run `32308852870` 构建（success）；2026-08-26 全量下载 v1.6.10 APK 复核 SHA-256 `86136c0dda907c9dbb3460e63d958c8c05633885bed02ab21fbc34e35e8496cc`。
- 人类需要确认：以上全部新交互仍未做真机验收；下载站线上资产经 HEAD 核实仍停留在 v1.6.6。

### 2026-08-26 — Windows 工作区重建克隆、GitHub Token 配置与设计案事实基线修复

- 用户目标：在新 Windows 工作区恢复项目上下文；用户为本会话配置 GitHub token；把设计案补充修复到与代码一致并推送。
- 本步范围：只修改 `docs/DESIGN.md` 并推送 `main`；不改 App 代码、不动 Release 和下载站。
- 实际修改：`docs/DESIGN.md` —— 头部事实基线更新为 v1.6.10；§0 增补 Windows 克隆层级说明；§3 标题日期与 §3.1 事实表重写（当前提交/标签/versionCode/SHA-256/下载站同步状态）；§3.2 新增牌子查询、计划排序工具、双轨版本筛选、外部应用优先打开、Bilibili 链接保存增强、音乐平台设置页、嵌套导航共 8 行能力事实；§3.3 扩充待真机验收清单；§4.3 增加牌子查询流程；§5.1 补充拖拽/意图打开依赖、tsx 回归脚本和 webview 未使用备注；§5.2 目录地图按当前仓库重写；§12 当前结论更新；追加本两条记录。
- 验证证据：`git log --oneline/--stat v1.5.0-alpha..HEAD` 共 14 提交；GitHub API releases 列表（Node fetch）确认 v1.6.0–v1.6.10 十一个 Release 及资产大小；v1.6.10 APK 全量下载 62,045,742 bytes，SHA-256 `86136c0dda907c9dbb3460e63d958c8c05633885bed02ab21fbc34e35e8496cc`；线上 HEAD <https://maimate.flya.ccwu.cc/MaiMate-latest.apk> 返回 200 / content-length `62,040,886`（= v1.6.6 资产）；`react-native-webview` 经全仓 grep 仅出现在 package.json/package-lock.json，源码零引用；push dry-run 成功。
- 环境阻塞记录：本 Windows 沙盒 schannel TLS 损坏（Invoke-RestMethod/curl 连 GitHub 报 SSL 错误），git 改用 openssl 后端解决；msys sh.exe 无法创建信号管道导致一切 git 凭据助手（manager/store）不可执行，改用 remote URL 内嵌 token；HTTPS API 统一走 Node fetch。GH_TOKEN 与 CLOUDFLARE_API_TOKEN 由用户配置在 `D:\AGENT\dsh\Workspace\flya-workspace\.env`（配套 load-env.ps1）。
- 人类需要确认：token 明文存在于 `.env` 与本克隆 `.git/config` 两处，如泄露可随时在 GitHub 撤销重发；CLOUDFLARE_API_TOKEN 本会话未验证。
- 推送结果补记：文档提交 `5e2480d` 已推送。由于 github.com:443 在本会话后期被间歇阻断（api.github.com 与 ssh.github.com 正常），最终推送链路为：注册仓库级只读写 Deploy Key `maimate-win-agent (auto)`（可在仓库 Settings → Deploy keys 撤销）→ remote push URL 改为 `ssh://git@ssh.github.com:443/…` → `GIT_SSH` 指向 `.git/ssh/ssh-wrapper.bat` 包装器（内含 `-F .git/ssh/.ssh/config` 固定参数，绕开 msys sh 执行含空格命令必死的问题）。fetch 仍走 HTTPS+token。
- 下一步：更新 landing Worker 指向 v1.6.10 并做线上校验；接入 Android 设备完成 v1.6.x 新交互真机回归；清理 webview 依赖。

### 2026-08-26 — v1.7.0：用户 17 项修复与功能（计划英灵殿、牌子查询重做、筛选栏改版）

- 用户目标：① 今日运势抽到宴会場谱面不合理（修复）；② 详情页官方定数行过长挤出 Total Notes（修复）；③ 问音乐平台跳转成功但不能直接搜索是否正常；④ 问 B 站已存视频仍跳网页是否正常；⑤ 牌子页初始文字不显示、点筛选后才显示（修复）；⑥ 整个界面筛选显示重做；⑦ 国区版本与 DX 代之前版本混用导致筛选必然为空（修复）；⑧ 五个难度 FC/AP 分开显示、歌曲列表多难度合并；⑨ 牌子查询放到推分计划上方；⑩ 一键把当前筛选中 14+ 谱面加入推分计划并可撤回（一次删整批）；⑪ 计划难度字段用对应难度颜色；⑫ 置顶置底只能同组拖拽、新曲目加到置顶组下方第一首；⑬ 抽选后结果卡被按钮阻挡（修复）；⑭ 移除曲目用自定义控件并进「推歌英灵殿」（显示删除时间、可强制删除）；⑮ 确认 Diving-Fish 无 DX PLUS/Splash PLUS 等数据则合并版本标签、ALL FiNALE 无曲目则删除；⑯ 搜索框 × 清除键与筛选重叠难点（修复）；⑰ 触发云构建 v1.7.0 并尝试推个人站下载站。
- 对③④的回答记录：③ 不算异常而是已知限制——各音乐客户端搜索深链路由未公开，`canOpenURL` 只能验证 scheme 注册，深链常落在应用首页不带关键词，故 v1.7.0 改为直接打开带关键词的 HTTPS 搜索结果页（保证看到候选列表）；④ 不符合设计预期——自存视频此前直接 `Linking.openURL(https)`，v1.7.0 新增 `getBilibiliVideoAppUrl` 提取 BV/av 号后优先 `bilibili://video/<id>` 深链，其次 Android intent，最后才回退网页。
- 实际修改（22 文件，+1089/−220，提交 `818b57a`）：`src/constants/game.ts`（移除 ALL FiNALE、新增 `MERGED_VERSION_GROUPS` 与 `expandVersionFilterValue`、graveyard 存储键）；`src/data/version-catalog.ts`（合并标签分组选项）；`src/data/music-list.ts`（版本筛选展开匹配）；`src/data/fortune.ts`（排除宴会場）；`src/data/types.ts`（`PlanEntry.pin`、`PlanGraveyardEntry`）；`src/data/plan-order.ts`（pin 分组比较与跨组拖拽收敛）；`src/store/plan-store.ts`（graveyard/setPin/bulkAdd/bulkRemove/purge/restore、新增条目插入置顶组下方）；`src/data/bilibili-search.ts`（视频深链提取）；`src/data/external-links.ts`（音乐平台 HTTPS 直达、B 站视频深链优先）；`app/song/[id].tsx`（定数行弹性收缩防溢出 + 平台说明文案）；`app/_layout.tsx`（牌子 Tab 提到推分计划上方可见）；`app/plates/index.tsx` 全量重写（初始渲染修复、旧世代/国区维度拆分、分难度汇总卡、合并行、一键 14+/撤回）；`app/plan.tsx` 全量重写（自定义确认弹窗、置顶置底左滑、英灵殿底部弹层）；`src/components/PlanEntryCard.tsx`（难度颜色徽标、置顶标记）；`src/components/FilterBar.tsx` 重做快捷栏（内嵌清除键、计数徽标、活动筛选摘要条）；`app/random.tsx`（按条件模式抽选时自动收起条件面板）；`scripts/feature-check.ts`（新增 7 组断言）、`scripts/route-check.mjs`（修复 Windows `fileURLToPath` 路径拼接）；`.landing-deploy/{index.html,_worker.js}`（落地站新版素材，Pages 直传用）；后续补丁提交 `0ca36fd` 同步 Expo SDK 57 六个包的 patch 版本以通过 expo-doctor 门禁。
- 验证证据：本地全绿——`tsc --noEmit` 通过；feature-check（含合并标签展开、ALL FiNALE 移除、牌子维度拆分、分难度汇总/合并行/14+ 筛选、pin 分组拖拽约束、B 站深链提取、运势 30 天种子扫描无宴会場且纯宴会場库返回空推荐）通过；rating-check 28 边界通过；phase-af-check 通过；route-check 通过；`expo export --platform android --no-bytecode` 成功导出（1750 模块打包、30 文件约 4.4MB）。本地环境限制记录：沙盒拒绝 esbuild postinstall/Hermes hermesc 的子进程 spawn（EPERM），npm 安装需 `--ignore-scripts`、export 用 `--no-bytecode`，Hermes 字节码由 CI Ubuntu 门禁验证。
- 云构建记录：首次 tag 构建 run `32924763598` 失败——expo-doctor 检出上游 SDK 57 已发新 patch 而 lockfile 锁旧版（时间腐化型门禁失败），以提交 `0ca36fd` 升级 expo/expo-constants/expo-file-system/expo-image-picker/expo-linking/expo-router 后删除并重打 v1.7.0 标签触发 run `32925269083`，结论 `success`。
- Release 资产：`MaiMate-latest.apk` 大小 `62,073,150` bytes，SHA-256 `5040f9dea6776439283fa738fce5607ce99439d3022ba89fd52c2d00072f3175`。
- 下载站部署：确认 maimate.flya.ccwu.cc 为 Cloudflare Pages 直传项目 `maimate-landing`（非 Workers 脚本；账户 Worker 列表无 maimate 路由）。本会话以 wrangler 重新部署 `.landing-deploy/`（新版 index.html 文案与更新日志 + `_worker.js` 改为代理 `releases/latest/download/MaiMate-latest.apk`，发布新版无需再改 Worker）。部署结果：部署成功（deployment preview `3ebea0c6.maimate-landing.pages.dev`）；线上校验通过——落地页 200 且含 v1.7.0 文案与新 SHA，`HEAD /MaiMate-latest.apk` 返回 200 / content-length `62,073,150`，与 Release 资产逐字节一致。
- 下一步：真机验收 §3.3 清单；观察 `releases/latest/download` 302 代理在 Cloudflare 边缘的稳定性。

### 2026-08-26 — 用户第二轮修订：B 站短链深链、音乐平台应用优先、路由重构与完成率损失试算

- 用户目标（6 项）：① B 站短链/长链都要能跳进 bilibili 应用（此前点击正确打开网页但深链失效）；② 音乐平台直跳应用默认开启并留回退，用户自行真机测试；③ 牌子查询版本选择初始仍无字（上一轮 focusTick 方案无效）；④ 推分计划调整一首后长按另一首会串位到上一首的位置；⑤ 详情页返回应回到进入时的界面而非固定落在推分计划；⑥ 新功能「完成率损失试算」，口径经多轮人工核对后确认。
- 路由重构（修 ⑤ 的根因方案）：`app/_layout.tsx` 改为根 Stack（`(tabs)` 分组 + `song` 兄弟 Stack），六个 Tab 屏移入 `app/(tabs)/`（index/random/plan/fortune/plates/settings），相对导入整体加深一层；`song/[id]` 压在 Tabs 之上，返回自然回到进入前 Tab；`scripts/route-check.mjs` 断言重写以匹配新树。
- 其余实现：`src/data/bilibili-search.ts`（新增 `isBilibiliShortLink`/`extractBilibiliVideoId` 扩展形态/`resolveBilibiliShortLink` 跟随 302）；`src/data/bilibili-resolve.ts` 新建（解析结果会话内存缓存，不依赖 react-native 可被回归脚本直测）；`src/data/music-platforms.ts` 恢复候选深链表；`src/data/external-links.ts`（`openMusicPlatformSearch` 应用优先可关、`openBilibiliVideo` 短链先解析再深链）；`AppSettings.musicAppSearchFirst` 默认 true；设置页加实验开关与候选列表；牌子页 chips 改 flexWrap + 整树 key 重挂载；计划页 dragEpoch 重建 DraggableFlatList 内部缓存 + 键一致性校验；`src/data/achievement-loss.ts` 新建纯计算模块（口径见 §8 A1.5 第 6 条）；`src/components/AchievementLossCard.tsx` 新建双口径表格卡片插入详情页 Rating 与 Bilibili 板块之间。
- 验证证据：本地全绿——`tsc --noEmit` 通过；feature-check 通过（新增扩展 ID 形态提取、短链判定、达成率损失矩阵断言：717/115/166/87 示例谱面 totalUnits=1880、单音符 Tap·Great=0.010638%、Break 合计 Good=0.1676%、全谱 Miss 合计=101.0000 理论上限、无 Break 谱面 breakRows=null）；route-check 通过（新 `(tabs)` 树）。本轮尚未触发云构建与发版。
- 发布补记（同日）：版本升至 `1.8.0`（versionCode `16`，提交 `ed2632f`）并打标 `v1.8.0` 触发云构建 run `32970206183`，一次通过。Release 资产 `MaiMate-latest.apk` 大小 `62,090,006` bytes，SHA-256 `ff98747946007b50343f535e35f336add042d3abeccb698d47a5e1cb8d3f7238`（取自 CI「Print APK checksum」步骤输出）。落地页更新 v1.8.0 文案、日志与新 SHA 后经 wrangler 重新部署 Pages（deployment `d9c7f496.maimate-landing.pages.dev`）；线上校验通过——落地页 200 且含新文案与 SHA，HEAD `/MaiMate-latest.apk` 返回 200 / content-length `62,090,006` 与资产一致。SHA 回填提交 `ef2344d`。等待用户真机验收 §8 A1.5 六项。

### 2026-08-26 — v1.9.0：深链与布局修复批次（6 项真机问题）

- 用户目标（6 项，真机验收反馈）：① B 站点击仍跳网页搜索（深链失效）；② 音乐平台应用能打开但搜索框未自动填词；③ 返回导航已正常（无需处理）；④ 推分计划拖拽串位仍存在，需重新定位；⑤ 牌子页筛选区过高挡住曲目列表滚动，需折叠版本筛选、总计汇总保持展开但可滚动；⑥ 完成率损失口径问题——去掉标题「试算」、Break 之外的行都算的是类型总计而非单音符需统一、删底部规则说明脚注、DX Rating 预估板块默认收起、板块顺序与默认折叠进设置页可配置。
- 修复①根因：Android 11+ package visibility 让 `canOpenURL` 对已声明 `<queries>` 之外的情况产生假阴性而误回退；改为 Android 上直接 `Linking.openURL` + 隐式 intent（不再带 packageName），并新增 `src/data/bilibili-bvid.ts` 本地 BV↔AV 互转（置换表 `[6,4,2,3,1,5,0,7,8]` 为对合置换，用公开接口 50 条权威 (aid,bvid) 双向全对），视频深链改为 `bilibili://video/<av>` 优先、BV 次选、多候选逐个尝试。
- 修复④根因：`reorder` 走 `normalizeOrder` 会按陈旧 `order` 字段重新排序，把拖拽计算出的数组顺序整个丢弃（纯函数模拟确认拖拽为 no-op）；改为 `reorder` 信任传入数组顺序只做 `order=下标`，保留 dragEpoch 重建列表内部缓存，并新增连续两次拖拽的纯函数回归断言。
- 其余实现：`src/data/achievement-loss.ts` 常规行改单音符口径（去掉 `count` 乘数）；`AchievementLossCard` 标题去「试算」+ 删脚注 + `defaultCollapsed`；`RatingPanel` 默认折叠、收起摘要「定数 · 100.5% → Rating」+ `defaultCollapsed`；`BilibiliSearchPanel` 加折叠；新增 `MusicPlatformBoard`；`types.ts`/`settings-store.ts` 加 `DetailBoardId`/`detailBoards`（默认 rating/achievement 折叠）；新增设置子页 `app/settings/detail-boards.tsx`（上下移动 + 折叠开关）；`app/song/[id].tsx` 按 `boardOrder` 渲染四个板块；牌子页筛选默认收起为单行摘要、总计卡分难度明细 `maxHeight` 可滚动；音乐平台设置页加「试开当前平台搜索」真机诊断；`scripts/feature-check.ts` 增 BV↔AV、拖拽连续两次、损失单音符断言；`scripts/route-check.mjs` settings 子页加 `detail-boards`。
- 验证证据：`tsc --noEmit` 通过；feature-check 通过（BV1xx411c7mD↔2、BV17x411w7KC↔170001、拖拽 D→A→B 连续顺序、损失单音符口径）；route-check 通过。云构建与下载站部署见发布补记。
- 发布补记（当日，含 GitHub Actions 故障）：版本升至 `1.9.0`（versionCode `17`，功能提交 `2302ea9`）。首次以**附注标签**打 `v1.9.0` 推送触发云构建出现 `startup_failure`（v1.8.0 等历史标签均为轻量标签），改为**轻量标签**后 run 卡「queued/0 jobs」——经查系 GitHub Actions 官方 `major_outage`（数据库主库故障 + 上游 Vitess 问题，16:50Z 起恢复、17:54Z 缓解；期间 github.com:443 HTTPS 亦间歇不可达）。为规避同标签重推并发互卡，移除 workflow `concurrency` 块（提交 `b98cbc0`）并将标签移到 `b98cbc0`；故障恢复后删标签重推，触发 run `32998575544` 一次通过。Release 为 <https://github.com/FengLingYaaa/maimate-app/releases/tag/v1.9.0>；资产 `MaiMate-latest.apk` 大小 `62,101,346` bytes（59.2 MB），SHA-256 `70229f8c6ca050c82bf39c0eff6f1a0349ea6c8eca9281e5698ca182d5d9eec4`（取自 CI「Print APK checksum」步骤输出）。落地页更新 v1.9.0 文案、日志与 SHA 后经 wrangler 部署 Pages，线上校验落地页 200 且含新 SHA、`HEAD /MaiMate-latest.apk` 与资产一致。等待用户真机验收 §8 A1.5 六项。

### 2026-08-27 — v1.10.0：拖拽彻底重写、音乐平台剪贴板兜底、牌子页滚动重构、数据备份/恢复与更新检查

- 用户目标（Android only，iOS 明确延后）：① 音乐平台跳应用（仅测网易云）搜索框仍不自动填词、网页可正确填入 → 修复 + 把要填的信息复制到剪贴板作备用；② 拖拽仍串位 → 拖拽代码从头重写；③ 牌子页删除「根据本机已导入成绩…」提示行、完成度总计加入滚动（随页面下滑）、歌曲旁加曲绘；④ 完成率损失删掉 CP 列（CP 永不失完成率）；⑤ 设置页删除「牌子查询」入口（牌子已是底部 Tab）；⑥ 推分计划页面最下侧曲目目标达成率被下边栏遮挡 → 列表底部留白；⑦ 做数据导入导出与备份；⑧ 做应用内更新检查。
- 拖拽重写（修②根因）：新增 `src/data/plan-entries.ts`（`createPlanEntryId`/`migratePlanEntryIds`/`migratePlanGraveyardIds`/`normalizePlanEntries`/`reorderPlanEntriesById`）；`PlanEntry` 增加持久 `entryId`（`types.ts`）；`plan-store.ts` 重写——首次加载为旧数据补发 entryId 并回写、写入串行队列、`reorderByIds(orderedIds)` 全量 ID 原子校验后替换、增 `removeEntryById`/`updateTargetScoreById`/`setPinById`；`PlanDragList.tsx` 独立组件（key=entryId、取消 Swipeable 手势叠加、置顶/置底改显式按钮、`onDragEnd` 只提交 ID 顺序、底部 `96+insets.bottom` 留白）；`canDragPlanRows` 改为对所有筛选维度全量判断（任何非空筛选禁用拖拽），彻底移除 dragEpoch 重挂载、业务拼接 key、`reorderVisibleEntries` 筛选槽位回填等旧补丁。
- 音乐平台（修①）：`external-links.ts` 的 `openMusicPlatformSearch` 跳转前自动 `Clipboard.setStringAsync` 搜索词；`music-platforms.ts` 网易云候选增至 4 条（含 `orpheus://search?query=`、`orpheus://nm/search?keyword=`）；`MusicPlatformBoard` 展示搜索词 + 「复制搜索词」按钮；详情页 Toast 提示「搜索词已复制」。
- 牌子页（修③）：`plates/index.tsx` 改为单一 `FlatList` + `ListHeaderComponent`（筛选、总计卡、批量按钮、提示全部随页面滚动），删除副标题提示行与内层 `maxHeight` ScrollView，`PlateRow` 加 `CoverImage` 曲绘（56×56），底部 `96+insets.bottom` 留白。
- 完成率损失（修④）：`AchievementLossCard` 用 `VISIBLE_JUDGMENTS`（去掉 CP 头列与每行 CP 单元格，按显式 key 顺序渲染），CP 判定仍保留在底层计算但不再展示。
- 设置页（修⑤⑥⑦⑧入口）：删除「牌子查询」入口；「数据与隐私」新增「数据备份与恢复」「检查更新」两行；`settings/_layout.tsx` 注册 `data-backup`/`update` 子页；`route-check.mjs` settings children 更新为 `['data-backup','detail-boards','index','music-platform','sort','update']`。
- 数据备份/恢复（⑦）：新增 `src/data/backup.ts`（版本化 JSON schema `cc.flya.maimate.backup` v1，严格校验/迁移/数组上限/未来版本拒绝/非法数值剔除/B 站本机 coverUri 剥离）、`src/data/backup-io.ts`（导出→系统分享、导入→校验→回滚快照→`multiSet` 事务写入→reload stores；SecureStore Token 与曲库/封面缓存明确排除）、`src/data/settings-defaults.ts`（把 settings-store 默认值与 `mergeDetailBoards` 抽成纯模块复用）；设置子页 `data-backup.tsx`（导出/选择/摘要/二次确认恢复）。新增 `expo-document-picker`/`expo-sharing`/`expo-clipboard` 依赖。
- 应用内更新检查（⑧）：新增 `src/api/app-update.ts`（GitHub `releases/latest` + 下载站 APK 地址、`AbortController` 15s 超时、draft/prerelease 忽略、SemVer 比较、仅 Android 参与下载）+ `src/data/semver.ts`（纯函数可测）；设置子页 `update.tsx`（当前版本/检查/新版本说明/下载与发布页按钮）。
- 依赖与版本：`expo` 及若干 SDK 57 包对齐到 Expo 最新补丁（`expo-doctor` 21/21 全绿），`react-native` 升 `0.86.3`，`app.json` 升 `1.10.0`/versionCode `18`，`package.json` 升 `1.10.0`。
- 回归测试：`scripts/feature-check.ts` 拖拽断言改为 entryId 语义（迁移幂等、合法/非法顺序拒绝、连续两次拖拽）；新增 `scripts/backup-check.ts`（round-trip/未知字段/损坏 JSON/未来 schema 拒绝/旧计划无 entryId 迁移/非法数值剔除/数组截断/coverUri 剥离）与 `scripts/update-check.ts`（SemVer）；`package.json` 增 `test:backup`/`test:update` 并接入 CI 门禁。
- 发布补记（当日）：版本升至 `1.10.0`（versionCode `18`，功能提交 `0740d3f`）。打轻量标签 `v1.10.0` 推送触发云构建 run `33037908454`，一次通过（lint + 6 组回归 + expo-doctor + Android export + arm64 gradle 全绿）。Release 为 <https://github.com/FengLingYaaa/maimate-app/releases/tag/v1.10.0>；资产 `MaiMate-latest.apk` 大小 `62,260,714` bytes（59.4 MB），SHA-256 `969e5c02ea5da00139627b596c1e09cf23ca015825aebdfabdcebe0f34daced0`（取自 CI「Print APK checksum」步骤输出）。落地页更新 v1.10.0 文案、日志与 SHA 后经 wrangler 部署 Pages（deployment `790e41d1.maimate-landing.pages.dev`）；线上校验落地页 200 且含新 SHA、`HEAD /MaiMate-latest.apk` 返回 200 / content-length `62,260,714` 与资产一致。等待用户真机验收（拖拽、网易云搜索填词/剪贴板、牌子滚动、备份/恢复、更新检查）。

### 2026-08-27 — v1.11.0：五项体验修复 + B50 总览 + 成绩折线图 + 曲绘本地缓存 + 更新红点

- 用户目标：① 置顶曲目与未置顶曲目之间拖拽仍出问题 → 应当不允许不同组之间拖拽；② 每首歌下方「长按曲目信息拖拽」提示删除；③ 牌子查询默认聚焦 Master/ReMaster，收起歌曲和总计两个板块中的前三个难度并提供展开按钮；④ 完成率损失表格 P 判定橙色、G 判定粉色、Good 绿色、Miss 保持灰色（含具体损失数字）；⑤ 检查更新页删除「检查通过 GitHub Release…」提示行；⑥ 做 B50 总览；⑦ 做成绩折线图；⑧ 做曲绘本地缓存；⑨ 做更新红点。⑥–⑨ 完成后触发云构建并同步下载站。
- 跨组拖拽禁令（修①）：`src/data/plan-order.ts` 新增纯函数 `isLegalDragResult`（拖拽结果分组序必须保持「置顶→普通→置底」单调，否则返回 false）；`PlanDragList.onDragEnd` 落点校验失败即作废（不写 Store），列表自动回弹；同组内拖拽不受影响。
- 行内提示删除（修②）：`PlanDragList` 移除「长按曲目信息拖拽…」文字块及样式。
- 牌子页聚焦高难（修③）：默认 `showLowDifficulties=false`，歌曲行与总计卡都只统计/展示 `difficultyIndex >= 3`（Master/ReMaster）；总计卡底部新增「展开低难度（N 行）/ 收起低难度」按钮；`PlateRow` 接收 `showLowDifficulties` 同步控制行内明细。
- 完成率损失配色（修④）：`AchievementLossCard` 的 `VISIBLE_JUDGMENTS` 每列带判定色——P·2550/P·2500 `#fb923c` 橙、G·2000/G·1500/G·1250 `#ff6b9d` 粉、Good 绿（`Colors.functional.success`）、Miss 灰（`Colors.text.muted`）；表头与数值单元格同色。
- 更新页文案（修⑤）：`settings/update.tsx` 删除底部 GitHub Releases hint 文案与样式。
- B50 总览（⑥⑦）：新增 `src/data/b50.ts`（纯函数 `computeB50`：单谱 Rating=calculateRating，新曲池 TOP15 + 旧曲池 TOP35，池内 rating 降序、并列按定数高/ID/difficulty 稳定排序，输出统一 rank/pool/poolRank、oldSum/newSum/total 与池满标记）；新增根级路由 `app/b50.tsx`（总分卡 + 两池合计 + 服务器 Rating 对照、`react-native-svg` 双线折线图——本地估算实线粉 + 服务器 RA 虚线青、最多 7 点=6 快照+当前、不足 2 点提示、明细列表 50 行含曲绘/定数/达成率/单谱 Rating，点击进歌曲详情）；`_layout.tsx` 注册 `b50` 根级 Screen；设置页成绩导入区加「查看 B50 总览」、推分计划页头部加「B50 总览 →」入口。
- 曲绘本地缓存（⑧）：新增 `src/data/cover-cache-names.ts`（纯函数：`getCoverCacheFilename` = `cover-<songId>-<fnv1a(url)>.png`、`isCoverCacheFileForSong` 前缀识别，node 可测）与 `src/data/cover-cache.ts`（`resolveCoverCacheUri`：本地命中直读、未命中守卫去重后 `downloadAsync` 临时文件再 `moveAsync` 原子落盘、失败静默回退远端；`clearCoverCache` 清空 covers 目录）；`CoverImage` 改为逐候选「先本地后远端」加载，不劣于 v1.10 行为。
- 更新红点（⑨）：`src/api/app-update.ts` 增 `UpdateState` 持久化（AsyncStorage）与 `autoCheckForUpdate`（启动延迟 4s 静默检查、≥24h 节流、写 `knownLatestVersion`）、`hasUpdateBadge`/`markUpdateSeen`（进更新页即熄灭）；`(tabs)/_layout.tsx` 设置 Tab 图标加红点组件（`useFocusEffect` 回前台复核）；`settings/update.tsx` 改用 `manualCheckForUpdate`。
- 回归测试：`feature-check.ts` 新增 `isLegalDragResult` 五组断言（同组合法、置顶拖入普通块拒绝、置底拖到最前拒绝、置顶组内互换合法、普通拖入置顶块拒绝）、`computeB50` 断言（35+15 池满、池内 rating 非递增 + poolRank 连续、total=oldSum+newSum）、曲绘缓存文件名断言（同 URL 稳定、异 URL 不同、按歌曲前缀识别）；`route-check.mjs` 断言 `b50` 为根级 route、settings children 不变。
- 版本与验证：`app.json` 升 `1.11.0`/versionCode `19`，`package.json` 升 `1.11.0`；本地全绿——tsc、route/feature/phase-af/rating/backup/update 六组回归、`expo-doctor` 21/21、`expo export --platform android`（1785→1789 模块、4.5MB hbc）。
- 发布补记（当日）：功能提交 `4f93d1f`，打轻量标签 `v1.11.0` 推送触发云构建 run `33083384357`，一次通过（lint + 6 组回归 + expo-doctor + Android export + arm64 gradle 全绿）。Release 为 <https://github.com/FengLingYaaa/maimate-app/releases/tag/v1.11.0>；资产 `MaiMate-latest.apk` 大小 `62,426,874` bytes（59.5 MB），SHA-256 `5a4a0992c7783de264f210270e8a7e62e87c67417a35de4c2168a3a026f39f75`（取自 CI「Print APK checksum」步骤输出）。落地页更新 v1.11.0 文案、日志与 SHA 后经 wrangler 部署 Pages（deployment `bfb1b42f.maimate-landing.pages.dev`）；线上校验落地页 200 且含 v1.11.0 与新 SHA、`HEAD /MaiMate-latest.apk` 返回 200 / content-length `62,426,874` 与资产一致。SHA/大小回填为文档收尾提交。等待用户真机验收（跨组拖拽禁令、牌子页高难聚焦、判定着色、B50/折线图、曲绘离线、更新红点）。

### 2026-08-27 — v1.12.0：删置顶置底、B50 页重做（分池切换/难度染色/同分附加）、目标增量（+**）、曲库 B50 徽标、CSV 导出、批量清除已达标

- 用户目标：① 推分计划拖拽排序仍有问题 → 删除置顶置底功能；② B50 删除折线图走势；③ 新曲15/旧曲35 分成两个可切换页面，每首歌标注难度并按难度染色；④ 删除「本地估算」措辞（本地口径与服务器一致）；⑤ B50 各池页面下方用提示条隔开，展示与最后一首同 Rating 的曲目；⑥ 推分计划目标 Rating 右侧加「（+**）」显示达成后可为 B50 增加的分数（重算口径），无目标不显示；⑦ 删曲库页「更新 / 下载」按钮。附加四项：曲库行 B50 徽标、成绩 CSV 导出、B50 池切换状态保持、批量清除已达标目标。完成后云构建并同步下载站。
- 置顶置底删除（修①）：`PlanDragList` 移除 📌/🔻 按钮列、`onPin` prop、`isLegalDragResult` 调用（无分组后任何拖拽天然合法），保留 entryId 落点长度校验与原子提交；`PlanEntryCard` 删 pin 标记渲染；`plan.tsx` 删 `setPinById` 引用、头部文案改「长按曲目拖拽排序」。`entry.pin` 字段、store `setPin`/`setPinById`、`normalizePlanEntries` 的 pin 排序全部保留（数据不迁移，UI 不再展示生效）。
- B50 页重做（修②③④⑤）：`app/b50.tsx` 重写——删除折线图（Svg/Polyline/buildTrend 全删）；标题改「B50 总分」不再称本地估算；新曲 TOP15 / 旧曲 TOP35 用分段切换器分两页展示（useState 池选择状态，返回后保持）；每行加难度 chip 按 `DifficultyColorMap` 染色（Master 紫/Re:MASTER 浅紫白等）；各池末尾提示条「以下 N 首与第 15/35 名同 Rating，暂未计入总分」+ 同分未入榜曲目列表（点击同样跳详情）。
- B50 纯函数（支撑③⑤⑥）：`computeB50` 返回值新增 `newTies`/`oldTies`（与池末位同 rating 的未入榜曲目，按定数高者靠前、ID/难度稳定排序，池未满时为空）；新增 `computeB50Gain(musicList, scores, chart, targetAchievement)`——把指定谱面成绩替换为目标达成率后重算 B50 总分，返回与当前总分的差值（目标非法或谱面不在库返回 null）。
- 目标增量（修⑥）：`PlanEntryCard` 新增 `allScores` prop（全量成绩，plan.tsx 传入），`b50Gain` memo 一次重算，目标 Rating 右侧渲染 `（+N）`/`（−N）`，无目标不显示；+0 如实显示（该谱面进不了 TOP50）。
- 曲库更新按钮删除（修⑦）：`app/(tabs)/index.tsx` 删「更新 / 下载」按钮、样式与 `openDownloadSite`/`Linking` 导入（用户改走设置→检查更新）。
- 附加四项：`SongCard` 新增 `b50Badge` prop（曲库行标题旁「B50 #池内排名」徽标，新曲青色/旧曲灰色，`app/(tabs)/index.tsx` 以 `computeB50` 结果建 songId→最佳排名映射传入）；新增 `src/data/scores-csv-core.ts`（纯函数 `buildScoresCsv`/`CSV_HEADER`/`CsvScoreRow`，RFC 4180 转义、CRLF 行尾）与 `src/data/scores-csv.ts`（IO 壳：store 收集成绩→曲库补全 title/ds/level→写缓存文件→系统分享→清理），设置页「数据与隐私」加「导出成绩 CSV」入口；B50 池切换状态保持（useState 天然保持，useFocusEffect 不重置）；`plan-store` 新增 `clearAchievedTargets(entryIds)`，`plan.tsx` 计算已达标条目（当前达成率 ≥ 目标），头部条件渲染「清已达」按钮，确认后批量清除目标分数（曲目保留）。
- 回归测试：feature-check 删除 v1.11 跨组拖拽断言；新增 ties 断言（40 首同分旧曲 → 35 入榜 + 5 未入榜 ties 且 ID 稳定 985–989）、`computeB50Gain` 断言（非法目标/不在库→null、Song 1 成绩 90→100.5 增量=新旧单谱 Rating 差、低定数谱面即使 100.5% 也进不了池→+0）、CSV 断言（表头逐列、含逗号引号值转义、CRLF 结尾）。
- 版本与验证：`app.json` 升 `1.12.0`/versionCode `20`，`package.json` 升 `1.12.0`；本地全绿——tsc、route/feature/phase-af/rating/backup/update 六组回归、`expo-doctor` 21/21、`expo export --platform android`（4.4MB hbc）。
- 发布补记（当日）：功能提交 `8f03358`，打轻量标签 `v1.12.0` 推送（GitHub 间歇阻断约 5 分钟，第 3 次重试成功）触发云构建 run `33097427159`，一次通过（lint + 6 组回归 + expo-doctor + Android export + arm64 gradle 全绿）。Release 为 <https://github.com/FengLingYaaa/maimate-app/releases/tag/v1.12.0>；资产 `MaiMate-latest.apk` 大小 `62,292,306` bytes（59.4 MB），SHA-256 `72557b93f6bcf9301d222a551fb422778c0603bcb17b957f1c105440b9cb4e3e`（取自 CI「Print APK checksum」步骤输出）。落地页更新 v1.12.0 文案、日志与 SHA 后经 wrangler 部署 Pages（deployment `647c6a8e.maimate-landing.pages.dev`）；线上校验落地页 200 且含 v1.12.0 与新 SHA、`HEAD /MaiMate-latest.apk` 返回 200 / content-length `62,292,306` 与资产一致。SHA/大小回填为文档收尾提交。等待用户真机验收（无分组拖拽、B50 分池/染色/同分附加、目标增量、曲库徽标、CSV 导出、清已达）。

### 2026-08-28 — v1.13.0：牌子页排序/文案/状态记忆、计划进度闭环、B50 网格模式与修复、查分分享卡片、快照管理

- 用户目标：① 牌子查询页歌曲按 Master 定数从大到小排布；② 推分计划最下侧一首仍被下边栏遮挡，留空一些；③「一键加入 14+」改为「一键加入 14 以上谱面」避免歧义；④ 曲库 B50 徽标区分 B15（新曲15）/B35（旧曲35）；⑤ 曲库筛选后进 B50 只显示筛选曲目——B50 不应被筛选影响（bug）；⑥ B50 加图标模式（每行 5 首，难度色框住曲绘，左下定数、右下 Rating、正下方完成率）。追加：推分进度闭环、查分分享卡片（B50 + 单曲）、牌子页状态记忆、快照管理 UI、B50 网格长按快捷入计划。曲绘识别经方案讨论后本版不做。
- 牌子页（修①③）：`mergedRows` 按 `music.ds[3]` 降序排列（无 Master 定数排末尾）；按钮与 Toast 文案 14+ → 14 以上。
- 底部遮挡（修②）：新建 `src/constants/layout.ts` 统一 `LIST_BOTTOM_INSET = 160`（原 96），`PlanDragList` footer 与牌子页 `paddingBottom` 共用。
- B50 徽标（修④）：`SongCard` 徽标文案按 pool 显示 `B15 #N` / `B35 #N`。
- B50 数据源修复（修⑤根因）：`app/b50.tsx` 从 `musicList`（应用筛选后的列表）改为 `rawData`（全量曲库），与曲库徽标数据源一致。
- B50 网格模式（修⑥）：页头右上 ⊞/☰ 切换（useState 保持）；每行 5 格，曲绘 2px 难度色边框，左下定数、右下 Rating 半透明胶囊，正下方完成率；网格模式下提示「长按加入计划」。
- B50 网格长按入计划：`quickAdd` 确认弹窗（已在计划中则提示），调用 `plan-store.addEntry`。
- 推分进度闭环：`PlanEntryCard` 加进度条（当前→目标百分比，达标变绿显示「已达标 ✓」）；`plan.tsx` 头部加进度摘要环（平均进度%）+ 统计（有目标/已达标/未设目标）+「全部/已达标/未达标」过滤 chips；过滤状态下禁用拖拽（`canDrag` 需 `achieveFilter === 'all'`）。
- 查分分享卡片：新增 `react-native-view-shot@5.1.0`（expo-doctor 对齐版本）；`src/data/share-card.ts`（`captureAndShare`：captureRef → 缓存文件 → expo-sharing 分享 → 清理）；`src/components/B50ShareCard.tsx`（总分+两池+服务器 RA+新曲 TOP15/旧曲 TOP35 曲绘网格，曲绘难度色框，屏外渲染 collapsable 隐藏）；`src/components/SongShareCard.tsx`（曲绘+曲名/曲师+难度徽章+定数/完成率→Rating/FC/FS 徽章）；B50 页头部「分享」按钮与详情页「分享成绩卡片」按钮触发。
- 牌子页状态记忆：版本/国区/难度筛选、筛选区收起、低难度展开状态持久化到 AsyncStorage（`maimate_plates_ui_state`），hydration 前不回写。
- 快照管理 UI：`score-store` 新增 `deleteSnapshot(id)`（过滤+持久化）；新建设置子页 `snapshots.tsx`（按时间倒序列出快照、记录数/服务器 RA、删除需确认），设置页同步状态卡加「管理快照 →」入口；`route-check` settings children 加 `snapshots`。
- 回归与版本：route-check 更新；`app.json` 升 `1.13.0`/versionCode `21`，`package.json` 升 `1.13.0`；本地全绿——tsc、六组回归、`expo-doctor` 21/21（view-shot 降到 SDK 映射版本 5.1.0）、`expo export --platform android`。
- 发布补记（当日）：功能提交 `bb894cd`，轻量标签 `v1.13.0`（推送第 6 次重试成功，GitHub 间歇阻断）触发云构建 run `33139297657`，一次通过（lint + 6 组回归 + expo-doctor + Android export + arm64 gradle 全绿）。Release 为 <https://github.com/FengLingYaaa/maimate-app/releases/tag/v1.13.0>；资产 `MaiMate-latest.apk` 大小 `62,336,434` bytes（59.4 MB），SHA-256 `d07a14b3d1c98e1c5f1de190cc4f72b0af766dcbe37679a065f5d579788c869f`。落地页更新 v1.13.0 文案、日志与 SHA 后经 wrangler 部署 Pages（deployment `835f5234.maimate-landing.pages.dev`）；线上校验落地页 200 且含 v1.13.0 与新 SHA、`HEAD /MaiMate-latest.apk` 返回 200 / content-length `62,336,434` 与资产一致。SHA/大小回填为文档收尾提交。等待用户真机验收（B50 网格/修复、分享卡片效果、进度闭环、牌子排序/记忆、快照管理）。

### 2026-08-28 — v1.14.0：分享卡预览/存相册重构、9 项用户验收反馈修复、快照对比、完成率着色与多选入计划

- 用户真机验收 v1.13.0 后反馈：① 进详情页会直接触发分享；② B50 分享点了没反应；③ 推分计划底部仍被遮挡；④ 进度环虚报 100%（很多曲目未达标）；⑤ 要求删卡片进度条但保留达标标识与「还差**」；⑥ 牌子页难度标注改带小数定数（如 14.4）；⑦ 曲库长曲名把 B35 徽标顶出屏幕；⑧ B50 网格同分附加曲目与前榜之间无分隔；⑨ 长按入计划改多选打钩（已在计划的默认打钩）+ 自绘弹窗；另有设置页有新版不亮红点。追加功能：分享卡预览+存相册、网格完成率着色、快照对比、一键加入撤销（后核实 v1.12 已实现，无需改动）。
- 分享重构（修①②+预览/存相册）：删除「隐藏常驻卡片 + onReady 注册捕获函数」模式（B50ShareCard 曾在 render 期调 setState 致注册失效＝②根因；常驻注册函数存在误触发路径＝①根因；opacity:0 屏外渲染 Android 捕获全透明）。新 `ShareCardOverlay`：点分享按钮按需渲染卡片（页面内绝对定位遮罩，非 RN Modal，避免 Android 捕获独立窗口），`captureRef` 捕获真实可见视图；预览大图后可选「分享」（expo-sharing）或「存相册」（新增 expo-media-library，写入「MaiMate」相簿）；`src/data/share-card.ts` 重写为 `captureCardToTempFile`/`savePngToMediaLibrary`/`sharePngFile`；失败/成功有行内提示。
- 更新红点修复：根因是 update 页挂载时无条件 `markUpdateSeen`——升级后路过更新页会把尚未展示过的新版本静默 dismiss，红点从此不亮。改为仅当 `result.status === 'update'`（确实展示了新版本信息）时熄灭；`hasUpdateBadge` 增加已知版本≤当前版本的先决短路。
- 底部遮挡（修③）：`DraggableFlatList` 的 `ListFooterComponent` 不生效，`PlanDragList` 改 `contentContainerStyle paddingBottom`；`LIST_BOTTOM_INSET` 160→200。
- 进度环（修④）：主文案改「达标 x/y」（环形边框，全达标变金色），平均完成率降为副文案且 `Math.floor` 保留一位小数（不再四舍五入虚报 100%）。
- 卡片进度条（修⑤）：删除进度条轨道，压为一行文字并入成绩行下方：未达标「当前 → 目标（还差 **）」、已达标绿色「已达标 ✓」。
- 牌子页定数（修⑥）：`mergePlateRows` charts 增加 `ds` 字段（取 `music.ds[difficultyIndex]`），`PlateChartLine` 难度徽章渲染「MS 14.4」（无定数回退等级标签）。
- 曲库徽标（修⑦）：`SongCard.title` 加 `flex: 1`，长曲名省略号截断，B15/B35 徽标固定右侧不再溢出。
- B50 网格增强（修⑧+着色+多选）：正榜与同分附加曲目之间插入 `GridTieDivider` 全宽分隔条；完成率按 `achievementTier` 三档着色（≥100.5 金 / ≥100 绿 / <100 灰紫，纯函数 `achievementTier`+`ACHIEVEMENT_TIER_COLORS` 导出便于测试）；长按任一格进入多选模式（已在计划条目默认打钩），格子右上角自绘勾选圈，顶部自绘工具栏（全选/已选 N/取消/加入计划）替代原生 Alert，Android 返回键先退选择，提交后 `bulkAddEntries` 并 Toast 结果（自动跳过已存在）。
- 快照对比：`snapshots.tsx` 新增「对比」两步选择（旧时间在前），`buildComparisonRows` 纯函数逐谱面 diff（新增/变化/移除，达成率四位小数），头部显示记录数与服务器 RA 变化。
- 回归与版本：六组本地回归全绿；`expo-doctor` 21/21（expo-media-library 与 SDK 对齐）；`expo export --platform android` 通过；`app.json` 升 `1.14.0`/versionCode `22`，`package.json` 升 `1.14.0`。发布补记待构建后回填。
- 发布补记（当日）：功能提交 `d28a509`；轻量标签 `v1.14.0` 的 git 推送受 GitHub 间歇阻断影响失败约 1 小时（根因排查中发现首轮推送超时导致本地 tag 实际未创建，后续「推送失败」实为 unknown revision；创建本地 tag 后 git 协议仍被连接重置），最终改用 GitHub REST API `POST /git/refs` 直接创建 `refs/tags/v1.14.0`（api.github.com 不受阻断）成功，同样触发 `v*` push 构建事件。云构建 run `33150585789` 一次通过（lint + 6 组回归 + expo-doctor + Android export + arm64 gradle 全绿）。Release 为 <https://github.com/FengLingYaaa/maimate-app/releases/tag/v1.14.0>；资产 `MaiMate-latest.apk` 大小 `62,537,092` bytes（59.6 MB），SHA-256 `8efa31d9aad7b53ff9d102124152142ad4329e40020049d02821fc8b9eb82ab4`。落地页更新 v1.14.0 文案、日志、大小与 SHA 后经 wrangler 部署 Pages（deployment `23ccb281.maimate-landing.pages.dev`）；线上校验落地页 200 且含 v1.14.0 与新 SHA、`HEAD /MaiMate-latest.apk` 返回 200 / content-length `62,537,092` 与资产一致。SHA/大小回填为文档收尾提交。等待用户真机验收（分享卡预览/存相册、红点、底部遮挡、进度环、B50 网格着色/分隔/多选、牌子定数标注、徽标防溢出、快照对比）。

### v1.15.0（2026-08-28）

- 背景与修复（用户反馈三连）：① B50 顶栏与手机状态栏重合——根级路由自定义头部只写了 `paddingTop: 10`，补 `insets.top`；② 新曲/旧曲切换按钮消失——根因是 v1.14 的 `{selectionToolbar ?? (池切换行)}` 写法中 selectionToolbar 表达式在网格模式恒为非空 JSX（`&&` 短路 false 时才是 null），`??` 永走左分支顶掉池切换行，改为 `showSelectionToolbar` 显式三元；③ 计划底部仍遮挡——`contentContainerStyle` paddingBottom 也被 DraggableFlatList 内部结构吃掉，`PlanDragList` 补 `ListFooterComponent` 高度占位（与 paddingBottom 双保险）。
- 分享卡表格布局（用户点名）：`B50ShareCard` 重写为旧曲 35 上（7×5）+ 新曲 15 下（3×5）表格，每格 = 难度色外框曲绘 + 左下定数 + 右下 Rating + 正下方完成率（着色底纹）；新增 `Fit50ShareCard` 全 50 格（10×5）同款；池汇总 chips 行 + 服务器 RA。
- 拟合 50（新功能）：`src/data/fit50.ts` `computeFit50(rawData, scores, chartStats)` 纯函数——全库有成绩谱面按拟合定数（chart_stats fit_diff）计算单谱 Rating = floor(fit_diff × ach/100 × 系数)，排除无 fit_diff 谱面，取最高 50；B50 页升级为 B50/拟合50 双模式（segment 切换、汇总卡、排序切换「按 Rating/按拟合定数」`sortFit50Entries`、列表/网格/多选/分享全共享，网格同分分隔仅 B50 模式）；chartStats 未加载时显示「拟合定数加载中，榜单暂不完整」提示条（补充提交 `884b35f`）；数据获取路径与详情页一致（浏览任意详情页自动缓存全库 fit_diff）。
- 展示组件抽公共模块：`src/components/RatingGrid.tsx`（UnifiedEntry 统一视图模型 + `b50ToUnified`/`fitToUnified` 映射 + `RatingEntryRow`/`RatingGridCell`/`RatingTieDivider`），B50 与拟合 50 共用；网格完成率底纹 = 曲绘下 3px 着色进度条（金/绿/灰三档与文本同色）。
- 快照推分战报：`src/data/snapshot-battle.ts` `buildSnapshotBattleReport` 纯函数——逐曲（曲绘/曲名/难度徽章/旧→新达成率/单谱 ±Rating）+ 汇总条（Rating 总变化/新增/上分/移除计数/服务器 RA 变化）；`snapshots.tsx` 重写为战报卡片；联表曲名曲绘经 `rawData`（songId+type）。
- 计划排序切换：plan.tsx「手动序/缺口优先」chips——缺口 = 目标 Rating − 当前 Rating（官方定数计算），未设目标 = +∞ 排最前、已达标 = −∞ 排最后；缺口序下副标题提示且 `canDrag` 关闭（沿用手动序判断）。
- 快照保留数量：`AppSettings.snapshotLimit`（默认 20，1–1000），`normalizeSnapshotLimit` 归一化（非法/越界回退），settings-store 加载/更新与 backup normalizeSettings 均走该口径；`syncScores` 按 `settings.snapshotLimit` 裁剪；设置页新增数字输入（onBlur/onSubmitEditing 提交，调高 Alert 警告「数量越多占用存储越多」，调低提示旧快照将在下次同步时自动裁剪）；同步状态卡文案随设置联动（不再硬编码 6）。
- 详情页曲绘大图：hero 曲绘 Pressable → 自绘全屏 overlay Modal（512×512 源图、点背景关闭）；说明 Diving-Fish covers CDN 实际返回 512×512 PNG（本地缓存同源）。
- 界面精简：删设置页「只读同步成绩…」隐私提示（v1.10 时代文案）；删 B 站面板「深链诊断」折叠区（diagVisible state、describeDeepLink、getDirectVideoAppUrls/isBilibiliShortLink import 与 diag* 样式一并清理）。
- 回归与版本：feature-check 新增拟合 50（Rating 数值/缺 fit_diff 排除/排序切换）、快照战报（上分 +12/新增/总变化）、快照上限归一化断言；六组本地回归全绿；`expo-doctor` 21/21（expo、expo-constants 对齐 ~57.0.18/~57.0.16）；`expo export --platform android` 通过；`app.json` 升 `1.15.0`/versionCode `23`，`package.json` 升 `1.15.0`。
- 工程事故记录：版本号用 `Set-Content -Encoding UTF8` 批量替换时给 package.json/app.json 写入 BOM（PS 5.1 UTF8 = UTF-8 BOM），tsx 因 BOM 解析 package.json 失败导致三组回归报错；app.json 中文内容被 GBK 写坏后 `git restore` 恢复。教训：PowerShell 5.1 批量改文件必须用 `[System.IO.File]::WriteAllText`（无 BOM 重载）或 edit 工具。
- 发布补记（当日）：功能提交 `e1d5846`（22 文件 +1168/−486）、补充 `884b35f`（拟合 50 加载提示）；轻量标签 `v1.15.0` git 推送一次成功（本季度首次未被阻断）。云构建 run `33171695275` 一次通过。Release 为 <https://github.com/FengLingYaaa/maimate-app/releases/tag/v1.15.0>；资产 `MaiMate-latest.apk` 大小 `62,550,008` bytes（59.6 MB），SHA-256 `9979d845350d4cfc063d095600c499202060f713f2292deecdfc5a716b184a98`。落地页更新 v1.15.0 文案、日志与 SHA 后经 wrangler 部署 Pages（deployment `c4012395.maimate-landing.pages.dev`）；线上校验落地页 200 且含 v1.15.0 与新 SHA（CDN 缓存约 40s 内刷新）、`HEAD /MaiMate-latest.apk` 返回 200 / content-length `62,550,008` 与资产一致。SHA/大小回填为文档收尾提交。等待用户真机验收（A3 全部 11 项：顶栏安全区、池切换、计划底部、B50/拟合50 分享卡表格、拟合 50 榜单与排序、曲绘大图、两处删减、快照战报、计划缺口排序、网格底纹、快照数量设置）。

### v1.15.1（2026-08-28，第四轮用户反馈）

- 用户反馈与处置：① 存相册要求整个相册权限——Android 13+ 系统行为（媒体权限组不可只写），`requestPermissionsAsync({ writeOnly: true })` 让 iOS 弹「仅添加照片」；② 分享卡一行 4 个——卡片内容区 320px 放不下 5×62+gap，CELL 62→61（5×61+4×3=317≤320）精确一行；③ 图片超屏看不到——ShareCardOverlay 预览包 ScrollView（captureRef 拍 holder 全量内容不受滚动/裁剪影响，出图完整）；④ 曲绘左上角加歌曲 ID——B50/拟合50 分享卡与 app 内网格格都加左上角 ID 角标（拟合 50 卡排名 #n 移到右上角）；⑤ 删除「缺口优先」排序，计划页恢复 v1.14 布局（B50 总览按钮按用户要求一并删除）；⑥ 完成率损失板块新增「等效容错 ≈ x 个 Tap(Great)」（x = (当前达成率−100.5)/tapGreatUnit 向下取整一位小数，复用 achievement-loss.ts 的 tapGreatUnit，达成率<100.5% 显示提示文案，未导入成绩不显示该行）；⑦ 拟合 50 入口缺失——根因是 v1.15.0 的 screenMode state 从未接到任何切换 UI（setScreenMode 只在声明处出现），顶栏标题下方补 B50/拟合50 segment；⑧ 新增「信息查询」🔎 tab（曲库|抽歌|计划|信息查询|设置 五 tab）：聚合 B50/牌子/运势/快照管理入口卡，牌子与运势 tab 用 `href: null` 隐藏（路由保留），删设置页「管理快照 →」与「查看 B50 总览」入口。
- 工程记录：explore.tsx 首次 write 工具产出损坏（`</Title>`、`</图标说明>`），heredoc 重写解决；Expo Router 会把 (tabs) 目录下所有文件自动注册 tab，必须显式 `href: null` 隐藏；route-check.mjs 增加 explore 叶子断言。
- 回归与版本：六组本地回归全绿；`expo-doctor` 21/21；`expo export --platform android` 通过；`app.json` 升 `1.15.1`/versionCode `24`。发布补记待构建后回填。
- 发布补记（当日）：功能提交 `0f4b71c`（15 文件 +195/−78）；轻量标签 `v1.15.1` git 推送一次成功。云构建 run `33178995317` 一次通过。Release 为 <https://github.com/FengLingYaaa/maimate-app/releases/tag/v1.15.1>；资产 `MaiMate-latest.apk` 大小 `62,552,316` bytes（59.6 MB），SHA-256 `75c1debd58af7b7401da72d9264eb2387e834527b044f680b5e06dc88a16c89c`。落地页更新 v1.15.1 文案、日志与 SHA 后经 wrangler 部署 Pages（deployment `4826c5c8.maimate-landing.pages.dev`）；线上校验落地页 200 且含 v1.15.1 与新 SHA、`HEAD /MaiMate-latest.apk` 返回 200 / content-length `62,552,316` 与资产一致。SHA/大小回填为文档收尾提交。等待用户真机验收（信息查询 tab 聚合、拟合 50 segment 入口、分享卡一行 5 格与滚动预览与曲绘 ID、等效容错数值、writeOnly 权限弹窗、缺口排序删除后布局恢复）。

### v1.15.2（2026-08-28，第五轮用户反馈）

- 用户反馈与处置：① 等效容错口径错误（应为 101%→100.5% 的固定折算而非依赖当前成绩）——公式改为 x = 0.5 / tapGreatUnit 向下取整一位小数，删 `currentAchievement` prop，无成绩也显示；② 分享卡一行仍 4 个——v1.15.1 的 CELL 61 方案算术有误（外层容器宽 62/64px 未同步），改为 cellWrap `width: '20%'`（320px 内容区精确五分之一）+ CELL 60 + padding 2（60+4=64 精确），去掉 grid gap，B50/拟合50 两卡同修；③ 单曲分享图错位——详情页 ShareCardOverlay 放在 ScrollView 内部，绝对定位遮罩随内容定位，移到 ScrollView 外与曲绘 Modal 平级；④ 存相册失效——`requestPermissionsAsync({ writeOnly: true } as any)` 把对象传给了位置布尔参数，Android 上 writeOnly 导致 granted=false 抛「未授予相册权限」，改为 `Platform.OS === 'ios'` 才传 writeOnly（iOS 保留仅添加照片弹窗，Android 恢复完整权限与 MaiMate 相簿）；⑤ 推分战报汇总删「Rating 变化」「移除」两个 chip（保留新增/上分/服务器 RA），明细过滤移除类行；⑥ 推分计划卡删「还差…」行（保留「已达标 ✓」）；⑦ 试做分享卡：快照对比战报卡（BattleReportShareCard，快照管理页战报头部「分享战报」入口）与牌子完成度卡（PlatesShareCard，牌子页头部「分享」按钮，按当前筛选出卡、含各难度分行）；⑧ 曲库搜索历史：FilterBar 记录最近 5 条有效搜索（≥2 字符，防抖提交/回车提交时记录，AsyncStorage 持久化），搜索框下方横滑 chips 点击复用、输入时自动隐藏。
- 下载站改造：`_worker.js` 的 `/MaiMate-latest.apk` 从流式代理 GitHub Release 改为 302 重定向到 GitHub 直链（`releases/latest/download/MaiMate-latest.apk`）——重定向响应仅数百字节，消除 Workers 大文件代理流量与 CF 服务条款 2.8 风险，下载流量直接走 GitHub CDN；落地页下载按钮文案改「GitHub 直链」、大小徽标改静态展示（302 无 content-length 可探测），移除 HEAD 探测 content-length 逻辑。
- 回归与版本：六组本地回归全绿；`expo-doctor` 21/21；`expo export --platform android` 通过；`app.json` 升 `1.15.2`/versionCode `25`。发布补记待构建后回填。
- 发布补记（当日）：功能提交 `860ab48`（16 文件 +422/−94）；轻量标签 `v1.15.2` git 推送一次成功。云构建 run `33189356190` 一次通过。Release 为 <https://github.com/FengLingYaaa/maimate-app/releases/tag/v1.15.2>；资产 `MaiMate-latest.apk` 大小 `62,560,632` bytes（59.7 MB），SHA-256 `8a1f048cbc08005430b55d289ac20a30345c18c069ab0ca533779e9b00146d79`（本地下载资产复算，构建日志仅落 step summary）。落地页更新 v1.15.2 文案、日志与 SHA 后经 wrangler 部署 Pages（deployment `8e7c69a2.maimate-landing.pages.dev`）；线上校验落地页 200 且含 v1.15.2 与新 SHA、`HEAD /MaiMate-latest.apk` 返回 302 → GitHub 直链、GitHub 直链 200 / content-length `62,560,632` 与资产一致。SHA/大小回填为文档收尾提交。等待用户真机验收（分享卡一行 5 格、详情页分享预览全屏居中与存相册、等效容错无成绩显示、战报/牌子分享卡样式、搜索历史、下载站 302 跳转）。

### v1.16.0（2026-08-28，第六轮用户反馈 + 图标换新）

- 用户反馈与处置：① 牌子页分享功能按反馈整体移除（按钮/overlay/`PlatesShareCard` 组件与导出）；② 存相册报 `createAssetAsync` deprecated——expo-media-library 57 起旧函数式 API 从主入口移除，`share-card.ts` 改从 `expo-media-library/legacy` 导入（API 不变零逻辑改动）；③ 分享卡 FIT50 简写改 `nb50`；④ 战报缺 Rating 上涨值——页内战报与分享卡汇总统一加「DX Rating」chip（target−base 的 serverRating，正数带 +），「服务器 RA」标签同步改名；⑤ 切走再切回设置页误入快照管理——`settings/_layout` 加 `useFocusEffect`：聚焦时 pathname 非 `/settings` 即 `router.replace('/settings')` 归位；⑥ B50 总览默认网格——`viewMode` 初始值 `'list'→'grid'`（v1.15.2 漏改项）；⑦ 计划进度环重做为 SVG 环形进度条 `PlanProgressRing`（react-native-svg 已有依赖）：底环暗色、进度弧按平均完成率着色（<30% 红/<70% 黄/≥70% 绿，全达标金色），环心 x/y 文案，从 12 点顺时针；⑧ 曲库新增拟合定数排序 `fitDesc`/`fitAsc`——`SortMode` 扩两档，`music-list` 加 `getFitChartConstant`（读 chart_stats fit_diff，无数据排末尾），`MusicList.filter` 与 store `applyFilters` 透传 chartStats，筛选弹窗加两 chip + 活动标签映射，启用时 `SongCard` 徽章旁标注 `fit 13.9`（`fitDiffForIndex` 回调 prop）；⑨ 应用图标换新——方向 B（八色分段街机环，接缝落 12/3/6/9 点方位左右各 4 分区）用户定稿，程序化生成全套资产：`icon.png`（1024 圆角全幅）、`android-icon-foreground/background`（自适应 66% 安全区）、`android-icon-monochrome`（白色剪影主题图标）、`splash-icon.png`、`favicon.png`，生成脚本存 `design-candidates/`。
- R2 决策：APK 分发迁 Cloudflare R2 方案已向用户说明（bucket+Worker 绑定+发版上传步骤、免费额度 10GB/千万次读、Workers 免费档 10 万请求/天硬顶天然兜底超额），用户选择后续自行配置，落地页本轮仍走 302 → GitHub 直链。
- 回归与版本：六组本地回归全绿；`expo-doctor` 21/21；`expo export --platform android` 通过；`app.json` 升 `1.16.0`/versionCode `26`。发布补记待构建后回填。
- 发布补记（当日）：功能提交 `2c64758`（33 文件 +474/−176）；轻量标签 `v1.16.0` git 推送一次成功。云构建 run `33198702590` 一次通过。Release 为 <https://github.com/FengLingYaaa/maimate-app/releases/tag/v1.16.0>；资产 `MaiMate-latest.apk` 大小 `62,223,316` bytes（59.3 MB），SHA-256 `e8507acc64adf2a33a1e3a86144388e589751be9f877c423ac8e4b21a354c868`（本地下载资产复算）。落地页更新 v1.16.0 文案、日志与 SHA 后经 wrangler 部署 Pages（deployment `6e565ccf.maimate-landing.pages.dev`）；线上校验落地页 200 且含 v1.16.0 与新 SHA、`HEAD /MaiMate-latest.apk` 返回 302 → GitHub 直链、GitHub 直链 200 / content-length `62,223,316` 与资产一致。SHA/大小回填为文档收尾提交。等待用户真机验收（新图标各处置显示、拟合定数排序与标注、环形进度条配色、战报 DX Rating chip、设置栈归位、B50/nb50 默认网格、存相册 legacy 导入后无告警、牌子页分享已移除）。

### v1.16.1（2026-08-28，第七轮用户反馈）

- 用户反馈与处置：① 设置页次级界面全部无法进入/点快照管理跳回设置/检查更新进不去——同一根因：v1.16.0 的 `useFocusEffect` 把 `pathname` 放进依赖数组，栈内导航（pathname 变化）也触发归位 replace 回首页；修法为 pathname 存 ref、回调依赖仅 router，用 `prevFocused` ref 区分布局首次挂载与真正切 tab 聚焦，只在聚焦时检查归位（`settings/_layout.tsx`）；② 环形进度条没生效——弧长按平均完成率填充，成绩未导入时恒为 0 只剩隐形底环；改按达标比例 `achieved/total` 填充与配色（<30% 红/<70% 黄/≥70% 绿/全达标金），底环色从 `bg.tertiary` 提亮到 `border.medium`，`averagePercent` prop 保留兼容（`PlanProgressRing.tsx`）；③ 搜索历史曲库与计划同步——FilterBar 加 `historyKey` prop（'library'|'plan'），存储键分 `maimate_search_history:library` / `:plan`，旧共享 key 数据迁给曲库，曲库页显式传 library、计划页传 plan。
- 新功能：④ nb50 挤榜提示——`computeFit50` 返回 `pushOutGap`（榜满且榜外有候补时 = 第 50 名 Rating − 榜首候补 Rating + 1，下限 1）与 `outsideCount`，nb50 总览在汇总卡下显示「榜已满 · 榜外还有 N 张谱面，打出 X 分以上的单谱拟合 Rating 即可挤掉第 50 名」；⑤ 更新日志浮层——`src/data/changelog.ts` 内置最近版本日志（离线数据），`ChangelogOverlay` 挂根布局最上层：`Constants.expoConfig.version` 对照 AsyncStorage 已读标记（键存版本号非布尔，跨版本自然再弹），有当日志即自绘 overlay 展示「更新完成 v版 · 日期 + 亮点列表 + 知道了」，读取失败静默不阻塞启动。
- 回归与版本：六组本地回归全绿；`expo-doctor` 21/21；`expo export --platform android` 通过；`app.json` 升 `1.16.1`/versionCode `27`。发布补记待构建后回填。
- 发布补记（当日）：功能提交 `cffef63`（13 文件 +213/−24）；轻量标签 `v1.16.1` git 推送一次成功。云构建 run `33232230351` 一次通过。Release 为 <https://github.com/FengLingYaaa/maimate-app/releases/tag/v1.16.1>；资产 `MaiMate-latest.apk` 大小 `62,228,744` bytes（59.3 MB），SHA-256 `b80a0deaab46bfc355b9fe8c8987215f272da707b875aa36f2e9f03b072bbeda`（本地下载资产复算）。落地页更新 v1.16.1 文案、日志与 SHA 后经 wrangler 部署 Pages（deployment `ebeb2570.maimate-landing.pages.dev`）；线上校验落地页 200 且含 v1.16.1 与新 SHA、`HEAD /MaiMate-latest.apk` 返回 302 → GitHub 直链、GitHub 直链 200 / content-length `62,228,744` 与资产一致。SHA/大小回填为文档收尾提交。等待用户真机验收（设置次级页恢复正常导航、进度环可见、搜索历史分页面记忆、nb50 挤榜提示、更新浮层首启弹出）。

### v1.16.2（2026-08-29，第八轮用户反馈）

- 用户反馈与处置：① 拟合定数标注 `fit 13.9` 改为 `13.86`（去前缀 + `toFixed(2)` 两位小数，SongCard），难度行更容易保持单行；② 删 nb50「榜外还有…」板块，`computeFit50` 撤 `pushOutGap`/`outsideCount` 字段；③ 成绩同步后新达标曲目自动沉底——`plan-store` 新增 `sinkAchievedEntries(entryIds)`（保持相对顺序移到末尾并持久化），`score-store.syncScores` 在 diffScores 后按「条目设了目标分且 before < 目标 ≤ after」检出并调用；设置新增 `autoSinkAchieved`（默认开，设置页「新达标自动沉底」行可关，backup 归一化同步兼容 + sortMode 补 fitAsc/fitDesc）；④ 计划页右下悬浮「到底部」按钮——`PlanDragList` 挂 `onScroll`（距底 <40 判定到底）、`React.ElementRef<typeof DraggableFlatList>` ref 调 `scrollToEnd`，到底或拖拽中隐藏；⑤ 计划抽歌默认排除已达标（`achievedPlanIds` 由目标分与成绩比对得出，「含已达标」开关可包含），每日不重复优先——`plan-draw-history.ts` 按本地日期记录最近 7 天已抽键，抽取时优先从未抽池选、抽遍后回落全量并提示；⑥ 抽歌历史——抽歌页「抽歌历史」按钮开自绘弹层，最近 7 天按日分组展示（曲名 + 难度缩写）；⑦ 牌子页一键导入后自绘弹窗（非原生 Alert）询问是否为本次加入谱面统一设 100% 目标，确认后 `updateTargetScore` 逐条写入。更新日志浮层数据源 `changelog.ts` 同步补 1.16.2 条目。
- 回归与版本：六组本地回归全绿；`expo-doctor` 21/21；`expo export --platform android` 通过；`app.json` 升 `1.16.2`/versionCode `28`。发布补记待构建后回填。
- 发布补记（当日）：功能提交 `eea481e`（17 文件 +441/−70）；轻量标签 `v1.16.2` git 推送一次成功。云构建 run `33234979260` 一次通过。Release 为 <https://github.com/FengLingYaaa/maimate-app/releases/tag/v1.16.2>；资产 `MaiMate-latest.apk` 大小 `62,243,892` bytes（59.4 MB），SHA-256 `f2242fdf5a03820fe32bedeb0fe453e37394325220f0f877c187b81a9064c2ba`（本地下载资产复算）。落地页更新 v1.16.2 文案、日志与 SHA 后经 wrangler 部署 Pages（deployment `241f8138.maimate-landing.pages.dev`）；线上校验落地页 200 且含 v1.16.2 与新 SHA、`HEAD /MaiMate-latest.apk` 返回 302 → GitHub 直链、GitHub 直链 200 / content-length `62,243,892` 与资产一致。SHA/大小回填为文档收尾提交。等待用户真机验收（拟合标注两位小数一行显示、计划到底按钮、同步后沉底与开关、计划抽歌排除已达标与每日不重复、抽歌历史弹层、牌子页导入 100% 目标弹窗）。

### v1.16.3（2026-08-29，第九轮用户反馈）

- 用户反馈与处置：① 快照管理仍会跳转设置页——独立为根级路由 `/snapshots`（app/snapshots.tsx，脱离设置 Stack，归位逻辑从此不可达），根 `_layout` 注册、信息查询入口改跳、设置栈移除注册并简化归位逻辑（不再比较 pathname，仅「从其它 tab 切回」时 replace 回设置首页）；② 战报对比逐曲 RA 改为「对 B50 的影响」——`SnapshotBattleRow` 新增 `b50Delta`：以新快照侧 `computeB50` 榜内键集合为准，榜内显示 `+N RA（B50）`、榜外不显示（`app/snapshots.tsx` 与 `BattleReportShareCard` 同步切换渲染字段，`ratingDelta` 保留在数据层）；③ 计划「到底部」悬浮按钮贴右下角（bottom 200+insets → 12，tab 容器已排除 tab 栏）；④ 计划卡已设目标的条目隐藏「点击重新选择」提示行压缩高度（点卡片仍可进入行内改目标）；⑤ 计划查漏——计划页摘要下新增可折叠提示条，列出计划中无成绩记录的曲目（`type:songId:difficulty` 与 scores 比对），每项可跳详情；⑥ 下载站「检查下载地址」在国内卡 GitHub——下载按钮改 GitHub Release 直链并删除 fetch 探测脚本（页面不再发任何预检请求）。落地页 route-check 断言同步（settings 栈不再含 snapshots、根级必须有 snapshots）。
- 回归与版本：lint/routes/features/phase-af/rating/backup/update 全绿；`expo-doctor` 21/21；`expo export --platform android` 通过；`app.json` 升 `1.16.3`/versionCode `29`。发布补记待构建后回填。
- 发布补记（当日）：功能提交 `f20a4e2`（14 文件 +113/−56）；轻量标签 `v1.16.3` git 推送一次成功。云构建 run `33241108334` 一次通过。Release 为 <https://github.com/FengLingYaaa/maimate-app/releases/tag/v1.16.3>；资产 `MaiMate-latest.apk` 大小 `62,246,388` bytes（59.4 MB），SHA-256 `a784260fce6035e7565c8cfc64f23af0fbe8009f6ae3021cc045a248c05c85d5`（本地下载资产复算）。落地页更新 v1.16.3 文案、日志、SHA 与 GitHub 直链下载按钮（探测脚本已删）后经 wrangler 部署 Pages（deployment `fad35420.maimate-landing.pages.dev`）；线上校验落地页含 v1.16.3 与新 SHA、下载按钮 href 为 `releases/latest/download/MaiMate-latest.apk` 直链、页面无 fetch 探测代码、GitHub 直链 200 / content-length `62,246,388` 与资产一致。SHA/大小回填为文档收尾提交。等待用户真机验收（快照管理从信息查询进入为独立页面且不再跳设置、战报 RA（B50）口径、到底按钮右下角、计划卡紧凑、计划查漏条、下载站直链在国内的连通性）。

### v1.16.4（2026-08-29，第十轮用户反馈）

- 用户反馈与处置：① 快照页无标题/返回键且文字被状态栏遮挡——根级 `_layout` 给 `snapshots` 启用原生 header（标题「快照管理」+ 深色底 + 返回键），内容自然落在安全区下；② 战报 B50 榜内曲目仍不显示 RA——定位为键序 bug：`b50Keys` 用 `musicType:songId:difficultyIndex` 而行键是 `songId:type:difficultyIndex`，永远匹配不上，统一为后者（`snapshot-battle.ts`）；③ 搜索历史长按删除——`FilterBar` 历史 chip 加 `onLongPress`（350ms）逐条移除并持久化（曲库/计划/牌子三处共用组件自动生效）；④ 新功能「单谱成绩曲线」——新组件 `ScoreTrendCard`（react-native-svg 纯折线，无新依赖），从本地快照重建该谱面达成率序列，纵轴下限按 20% 取整、显示快照次数与净变化、无数据整卡隐藏；挂在歌曲详情页 boardOrder（Rating/胜负场/B站/音乐平台）之后，切难度即切换曲线。更新日志浮层补 1.16.4 条目。
- 回归与版本：七组门禁全绿；`expo-doctor` 21/21；`expo export --platform android` 通过；`app.json` 升 `1.16.4`/versionCode `30`。发布补记待构建后回填。
- 发布补记（当日）：功能提交 `8e6ba6d`（9 文件 +176/−6）；轻量标签 `v1.16.4` git 推送一次成功。云构建 run `33243998179` 一次通过。Release 为 <https://github.com/FengLingYaaa/maimate-app/releases/tag/v1.16.4>；资产 `MaiMate-latest.apk` 大小 `62,250,492` bytes（59.4 MB），SHA-256 `febe9869970eaea67ab958b2ba85056b5b55339bc068014c73ef6c101bd5fd25`（本地下载资产复算）。落地页更新 v1.16.4 文案、日志与 SHA 后经 wrangler 部署 Pages（deployment `4fd06512.maimate-landing.pages.dev`，部署后边缘传播约 20 秒）；线上校验落地页含 v1.16.4 与新 SHA、下载按钮 GitHub 直链有效、GitHub 直链 200 / content-length `62,250,492` 与资产一致。SHA/大小回填为文档收尾提交。等待用户真机验收（快照页标题/返回键/状态栏不再遮挡、战报榜内曲目显示 +N RA（B50）、搜索历史长按删除、详情页成绩曲线（多快照后更有意义））。

### v1.16.5（2026-08-29，第十一轮用户反馈）

- 用户反馈与处置：① 长按删除交互重做——长按历史 chip 进入管理模式（`FilterBar` `historyManaging` 状态）：chip 右上角红 × 角标删单条、行尾「清空」按钮一键清空、管理模式下点 chip 不回填防误触，曲库/计划/牌子三处共用组件同时生效；② 滑动/到底卡顿闪退——根因为每张计划卡渲染时 `computeB50Gain` 跑两遍全量 `computeB50`（700+ 曲），惯性滚动穿越数百卡阻塞 JS 线程被系统杀进程。修复三层：`computeB50` 结果按 (musicList, scores) 数组身份 WeakMap 缓存；`computeB50Gain` 结果按「谱面+目标+自身成绩指纹」缓存（`b50.ts`）；「到底」按钮 `scrollToEnd({animated:false})` 瞬时跳转避免动画连续渲染；③ 成绩曲线板块移除（v1.16.4 试验下线，组件与导出删除）；④ 战报 RA 口径修正为「该曲成绩对 B50 总分的真实影响」——`b50ImpactOf`：当前 B50 总分 − 把该曲替换回旧成绩（新增行则移除）后的 B50 总分，替换后不进榜或无变化即 0 不显示（v1.16.4 的「榜内显示单曲 RA 差值」口径确实错误）；⑤ 运势页曲绘 `songCover` 改 `aspectRatio:1` 正方形完整展示（原 height:180 裁切）；⑥ 设置页新增「存储占用」板块——新模块 `storage-usage.ts`：应用本体（APK 约 59.4 MB 只读）、成绩与计划数据（AsyncStorage 全量字节，清理=现有「清除本地成绩」链路）、曲绘缓存（covers 目录字节+张数，清理=`clearCoverCache`）。更新日志浮层补 1.16.5 条目。
- 回归与版本：七组门禁全绿；`expo-doctor` 21/21；`expo export --platform android` 通过；`app.json` 升 `1.16.5`/versionCode `31`。发布补记待构建后回填。
- 发布补记（当日）：功能提交 `2c8a780`（13 文件 +313/−163）；轻量标签 `v1.16.5` git 推送一次成功。云构建 run `33249234129` 一次通过。Release 为 <https://github.com/FengLingYaaa/maimate-app/releases/tag/v1.16.5>；资产 `MaiMate-latest.apk` 大小 `62,258,012` bytes（59.4 MB），SHA-256 `1d9a679b002e9b0290d7aa61de915db92b3cb88f022ba92be7334e0646b28e3e`（本地下载资产复算）。落地页更新 v1.16.5 文案、日志与 SHA 后经 wrangler 部署 Pages（deployment `6cd1e0ea.maimate-landing.pages.dev`）；线上校验落地页含 v1.16.5 与新 SHA、GitHub 直链 200 / content-length `62,258,012` 与资产一致。SHA/大小回填为文档收尾提交。等待用户真机验收（计划长列表滑动与「到底」不再卡顿闪退、战报 RA（B50）为真实总分影响、搜索历史管理模式、存储占用三项与清理、运势曲绘完整正方形）。
- 发布补记（当日）：功能提交 `8e6ba6d`（9 文件 +176/−6）；轻量标签 `v1.16.4` git 推送一次成功。云构建 run `33243998179` 一次通过。Release 为 <https://github.com/FengLingYaaa/maimate-app/releases/tag/v1.16.4>；资产 `MaiMate-latest.apk` 大小 `62,250,492` bytes（59.4 MB），SHA-256 `febe9869970eaea67ab958b2ba85056b5b55339bc068014c73ef6c101bd5fd25`（本地下载资产复算）。落地页更新 v1.16.4 文案、日志与 SHA 后经 wrangler 部署 Pages（deployment `4fd06512.maimate-landing.pages.dev`，部署后边缘传播约 20 秒）；线上校验落地页含 v1.16.4 与新 SHA、下载按钮 GitHub 直链有效、GitHub 直链 200 / content-length `62,250,492` 与资产一致。SHA/大小回填为文档收尾提交。等待用户真机验收（快照页标题/返回键/状态栏不再遮挡、战报榜内曲目显示 +N RA（B50）、搜索历史长按删除、详情页成绩曲线（多快照后更有意义））。
- 发布补记（当日）：功能提交 `f20a4e2`（14 文件 +113/−56）；轻量标签 `v1.16.3` git 推送一次成功。云构建 run `33241108334` 一次通过。Release 为 <https://github.com/FengLingYaaa/maimate-app/releases/tag/v1.16.3>；资产 `MaiMate-latest.apk` 大小 `62,246,388` bytes（59.4 MB），SHA-256 `a784260fce6035e7565c8cfc64f23af0fbe8009f6ae3021cc045a248c05c85d5`（本地下载资产复算）。落地页更新 v1.16.3 文案、日志、SHA 与 GitHub 直链下载按钮（探测脚本已删）后经 wrangler 部署 Pages（deployment `fad35420.maimate-landing.pages.dev`）；线上校验落地页含 v1.16.3 与新 SHA、下载按钮 href 为 `releases/latest/download/MaiMate-latest.apk` 直链、页面无 fetch 探测代码、GitHub 直链 200 / content-length `62,246,388` 与资产一致。SHA/大小回填为文档收尾提交。等待用户真机验收（快照管理从信息查询进入为独立页面且不再跳设置、战报 RA（B50）口径、到底按钮右下角、计划卡紧凑、计划查漏条、下载站直链在国内的连通性）。
