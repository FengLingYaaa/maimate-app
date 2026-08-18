# MaiMate（舞萌伴侣）项目设计案

> 文档性质：项目事实基线、产品设计、工程约束和持续变更记录。
> 最后更新：2026-08-18
> 当前版本：`v1.3.0-alpha`
> 当前状态：第一、第二阶段完成；第三阶段基础代码和 v1.3.0-alpha 云端发布完成；外部 Bilibili 搜索和交互修订已实现，真机验收仍待设备。
> GitHub：<https://github.com/FengLingYaaa/maimate-app>

这份文档的目标不是只描述“理想中的产品”，而是让人类或新对话中的智能体能够回答：

1. 我们正在做什么；
2. 为什么这样做；
3. 目前代码和发布物已经做到什么程度；
4. 哪些功能只是计划，哪些功能已经有代码；
5. 下一步应该做什么；
6. 每次对话结束后，应该把什么追加到这里。

`app/docs/DESIGN.md` 是 App 仓库内的同步副本。修改设计时应同时更新这两个文件，避免只更新工作区文档而让新智能体读到旧状态。

---

## 0. 新智能体阅读顺序

进入项目后按以下顺序建立上下文，不要直接假设旧对话中的“已完成”仍然准确：

1. 阅读本文件；
2. 阅读 `app/AGENTS.md` 和 `app/CLAUDE.md`；
3. 在 `app/` 中执行只读的 `git status --short --branch` 和 `git log --oneline -12`；
4. 对照“当前事实状态”检查代码、发布物和研究文件；
5. 只有用户明确要求实施时，才修改 App 代码；
6. 完成一个步骤后，把意图、修改、验证、产物和遗留问题追加到本文档的“持续变更记录”。

项目工作区和 App Git 根目录不是同一个目录：

```text
工作区：/home/agent/dsh-workspace/maimate
App Git 根：/home/agent/dsh-workspace/maimate/app
```

`design/`、`landing/`、`research/` 在 App Git 根之外；修改 App 代码时不要把文件写到错误层级。

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
4. **隐私最小化**：OCR 只识别照片中的文字，不识别曲绘；不申请麦克风；不接入玩家成绩，除非未来明确设计授权流程。
5. **研究和产品解耦**：Bilibili 研究资料可以保留在研究区，但不作为 App 构建、发布或运行时数据源。
6. **事实和计划分开**：设计案中的“已完成”必须有代码、提交、构建或线上验证证据；计划不能写成完成。

---

## 2. 明确不做的事情

以下内容目前不属于当前版本，不能被新智能体擅自加入：

- 不识别曲绘、封面或图片语义；OCR 只处理文字；
- 不在客户端抓取 Bilibili 搜索结果或 UP 主主页；
- 不自动把未经人工审核的 Bilibili 视频加入正式目录；
- 暂不做玩家通过 Bilibili 链接投稿的第四阶段审核系统；
- 暂不接入 Diving-Fish 玩家成绩、Import-Token、Developer-Token、B40/B50；
- 不提供游戏音频、ROM、模拟器或任何与官方机台交互的作弊功能；
- 不把 Bilibili 反爬虫当作需要绕过验证码的目标。遇到风控时应降低频率、换合法网络环境或由用户在本地完成抓取。

早期设计曾把 OCR 列为 P7 并延期；后来用户在第三阶段需求中同意实现“拍照识别曲名”，因此当前代码已经包含 OCR。新智能体应以当前代码和本文件的“事实状态”为准，而不是以旧文档中的 P7 描述为准。

---

## 3. 当前事实状态（2026-08-18）

### 3.1 仓库、发布和包信息

| 项目 | 当前事实 |
|---|---|
| App 仓库 | `FengLingYaaa/maimate-app` |
| 当前分支 | `main` |
| 当前提交 | `5759b60 fix: name release asset for download site` |
| 当前标签 | `v1.3.0-alpha`（云构建/个人站已发布） |
| Android applicationId | `cc.flya.maimate` |
| App 版本 | `1.3.0` |
| 下载站 | <https://maimate.flya.ccwu.cc/> |
| 稳定 APK 地址 | <https://maimate.flya.ccwu.cc/MaiMate-latest.apk> |
| APK 来源 | GitHub Release `v1.3.0-alpha`，由 `landing/_worker.js` 代理/转发 |
| APK 构建方式 | GitHub Actions 云构建，arm64-v8a，内部测试使用 debug keystore |

当前 App Git 仓库在第三阶段提交之后应保持干净；设计文档本身位于仓库外的工作区镜像和 App 仓库内的文档副本中，更新文档会让 App 仓库产生文档变更，这是预期行为。

### 3.2 已完成能力

| 能力 | 状态 | 事实依据/说明 |
|---|---|---|
| 曲库浏览器 | 已完成基础闭环 | `app/app/index.tsx`、`src/data/music-list.ts` |
| 多维筛选 | 已完成 | 分类、难度、等级、定数、版本、SD/DX、曲师、谱师、BPM、标题等 |
| 模糊搜索 | 已完成基础版本 | 支持标题、曲师、谱师和少量错字容错；结果按相关度排序 |
| 曲库缓存 | 已完成 | AsyncStorage；缓存优先；超过 12 小时后台刷新 |
| `chart_stats` | 已接入 | 独立缓存和后台刷新；详情页显示拟合定数 |
| 歌曲详情 | 已完成基础版本 | 定数、等级、Note 分布、谱师、封面、Rating 预估 |
| 推分计划 | 已完成基础版本 | 添加、删除、顺序、备注/目标分数字段和本地持久化 |
| 随机抽歌 | 已完成基础版本 | 推分计划、全曲、按条件三种模式；结果与动画目标一致 |
| Rating 预估 | 已完成基础版本 | 官方定数/拟合定数分别估算；主要显示 97%～100.5% 区间 |
| 自定义推分弹窗/Toast | 已完成 | 不使用 Android 原生确认弹窗 |
| 更新/下载入口 | 已完成 | 曲库页可打开下载站 |
| 顺时针曲绘滚筒 | 已完成基础版本 | `src/components/DrumRoll.tsx`，动画中多次切换封面 |
| Bilibili 外部搜索入口 | 本轮已实现 | 优先尝试 `bilibili://search`，失败回退 HTTPS 搜索；不在 App 内置视频目录 |
| OCR 拍照识别 | 已完成基础版本 | ML Kit；中文/日文/拉丁文字；只匹配曲名 |
| APK 发布链路 | v1.3.0-alpha 已完成 | GitHub Actions → GitHub Release `MaiMate-latest.apk` → Cloudflare Worker 下载站 |

### 3.3 已完成但仍需人工验收的能力

代码、静态检查、云构建和线上下载链路已经完成；仍需真实 Android 设备做最后验收：

- Bilibili 客户端深链是否在真实 Android/Bilibili 版本组合中成功打开搜索；
- 深链失败时 HTTPS 搜索回退是否在真实设备上可用；
- OCR 相机、快速加入计划、详情返回 OCR 和随机动画需要真机验收；
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

### 4.3 随机抽歌流程

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

### 4.4 OCR 流程

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
- AsyncStorage；
- `@react-native-ml-kit/text-recognition`；
- `expo-image-picker`、`expo-file-system`、`expo-sqlite` 等 Expo 模块；
- `react-native-reanimated`、`react-native-worklets`；
- 样式主要使用 React Native `StyleSheet.create`，不是旧设计案中描述的 NativeWind/SQLite 全量架构。

### 5.2 目录地图

```text
/home/agent/dsh-workspace/maimate/
├── README.md                         工作区说明和 APK 交接位置
├── design/DESIGN.md                  本设计案的工作区镜像
├── app/                              独立 Git 仓库
│   ├── app/
│   │   ├── _layout.tsx               根布局、Tabs、启动加载
│   │   ├── index.tsx                 曲库首页
│   │   ├── random.tsx                随机抽歌
│   │   ├── plan.tsx                  推分计划
│   │   └── song/[id].tsx             歌曲详情
│   ├── src/api/
│   │   ├── prober.ts                 music_data 和曲库缓存
│   │   └── chart-stats.ts            chart_stats 和统计缓存
│   ├── src/data/
│   │   ├── types.ts                  MusicData/ChartStats 等类型
│   │   ├── music-list.ts              纯函数筛选和搜索引擎
│   │   ├── rating.ts                  Rating 计算
│   │   ├── bilibili-search.ts         外部客户端深链和 HTTPS 搜索 URL
│   │   └── title-search.ts            OCR 曲名匹配
│   ├── src/store/
│   │   ├── music-store.ts             曲库、缓存、筛选、chart_stats 状态
│   │   └── plan-store.ts              推分计划持久化
│   ├── src/components/
│   │   ├── FilterBar.tsx
│   │   ├── SongCard.tsx
│   │   ├── BilibiliSearchPanel.tsx
│   │   ├── TitleRecognizer.tsx
│   │   ├── DrumRoll.tsx
│   │   ├── RatingPanel.tsx
│   │   └── NoteBar.tsx
│   ├── docs/DESIGN.md                 App 仓库内设计案同步副本
│   └── docs/BUILD.md                  构建指南
├── landing/                           Cloudflare Pages/Worker 下载站
└── research/djnaughty/                只读研究区，不直接改 App
```

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

### 6.3 Bilibili 外部搜索参数

新方案不把任何 Bilibili 视频条目写入 App，不维护 `ChartVideo[]` 正式目录，也不保存 BV 号、UP 主、标题、审核状态或视频 URL。歌曲详情页只使用本地已经存在的歌曲信息构造搜索内容：

- 歌曲标题：`songTitle`；
- 谱面难度：只对 Expert/Master/Re:MASTER 提供入口；
- 搜索词：保持当前行为，使用 `${songTitle} ${difficultyLabel} maimai`；
- 规范网页地址：Bilibili HTTPS 搜索 URL，并对搜索词进行 URL 编码。

客户端深链只是外部跳转手段，不是 App 数据模型：优先尝试 Bilibili 应用能够识别的搜索深链；深链不可用、应用未安装或系统拒绝时，回退到同一搜索词的 HTTPS 页面。

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

- App 歌曲详情页不内置 Bilibili 视频条目、不展示视频列表、不嵌入播放器；
- App 只提供一个简洁的“去 Bilibili 搜索该谱面”外部操作；
- 搜索内容保持当前实现：歌曲标题、当前谱面难度和 `maimai` 关键词；
- 只对 Expert/Master/Re:MASTER（红、紫、白谱）提供搜索入口；
- App 不在运行时请求 Bilibili API，不保存 Cookie、BV 号、UP 主、视频标题或视频审核状态；
- 不再要求人工视频目录、全量视频 JSON 或视频内容审核才能发布 App；
- 玩家投稿、审核队列、举报和下架仍不属于当前阶段。

当前 `v1.2.0-alpha` 的视频目录为空，用户实际上已经主要使用“去 Bilibili 搜索该谱面”入口。本轮 `v1.3.0-alpha` 删除了空目录分支及多余说明，把它收敛成稳定的外部搜索按钮，没有增加新的视频数据源。

### 7.2 外部跳转行为

- 规范搜索地址继续使用当前 HTTPS URL：
  `https://search.bilibili.com/all?keyword={encodedSongTitleDifficultyQuery}`；
- 实施时可以优先尝试 Bilibili 应用支持的搜索深链；
- 深链不可用、Bilibili 应用未安装或系统拒绝时，必须回退到同一搜索词的 HTTPS 页面；
- 不使用 App 内嵌 WebView，不在 MaiMate 内播放视频；
- “直接打开 Bilibili 应用”属于尽力而为能力，具体 Scheme、Android 版本和 Bilibili 客户端版本必须用真实设备验证，设计案不能保证所有设备都能拦截 HTTPS 链接；
- 跳转失败时仍应让用户得到可用的网页搜索结果，而不是让详情页报错。

### 7.3 搜索入口 UI 范围

歌曲详情页只保留：

- Bilibili 搜索标题；
- 当前难度标签；
- 一个“去 Bilibili 搜索该谱面”按钮。

应删除或不再设计：

- “暂无已确认的视频”状态；
- 视频列表、视频类型、UP 主和人工审核状态；
- 打开单条视频、复制单条视频链接；
- “视频目录由人工整理”等内部流程说明；
- Bilibili 视频目录或 BV 数据的正式填充。

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
- App 包内不包含视频条目、BV 列表或人工视频目录；
- App 不请求 Bilibili API，也不需要账号、Cookie 或新增权限；
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

本机 4GB 容器不适合 Gradle 原生构建；正式 APK 使用 GitHub Actions。完整说明见 `app/docs/BUILD.md`。

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

在外部 Bilibili 搜索方案下，v1.3.0-alpha 的代码、云构建、Release 和个人站部署已经完成，当前正确下一步是：

1. 若接入 Android 设备，验证 Bilibili 客户端深链和 HTTPS 回退；
2. 真机验收 OCR 相机、快速加入计划、详情返回 OCR 和随机抽歌点击停止；
3. 保持 `research/djnaughty/` 为历史研究证据，不恢复自动抓取或内置视频目录；
4. 后续每次设计、研究、代码或发布步骤继续追加到本文档。

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
