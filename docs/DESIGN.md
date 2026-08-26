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
| 当前提交 | v1.9.0 功能主体（前一代 `ef2344d` 为 v1.8.0 landing SHA 回填） |
| 当前标签 | `v1.9.0`（v1.8.0 及更早标签均已发布） |
| Android applicationId | `cc.flya.maimate` |
| App 版本 | `1.9.0`（Android versionCode `17`） |
| 下载站 | <https://maimate.flya.ccwu.cc/>（Cloudflare Pages 直传项目 `maimate-landing`） |
| 稳定 APK 地址 | <https://maimate.flya.ccwu.cc/MaiMate-latest.apk> |
| APK 来源 | GitHub Release 资产 `MaiMate-latest.apk`；v1.7.0 起 Pages `_worker.js` 改为代理 `releases/latest/download/MaiMate-latest.apk`（自动跟随最新 Release） |
| 最新 Release APK SHA-256（v1.9.0） | 待回填（CI「Print APK checksum」步骤输出，构建完成后补） |
| 最新 Release APK 大小 | 待回填 |
| 下载站同步状态 | 待部署：v1.9.0 构建通过后回填 SHA/大小并 wrangler 部署 Pages，线上校验落地页与 `/MaiMate-latest.apk` |
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
