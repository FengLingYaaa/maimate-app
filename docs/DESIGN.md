# MaiMate — 舞萌伴侣 设计案

> 最后更新：2026-08-16  
> 项目状态：开发阶段  
> 仓库：https://github.com/FengLingYaaa/maimate-app  
> 技术栈：React Native (Expo) + TypeScript  
> 数据源：Diving-Fish 舞萌DX查分器 (maimai.diving-fish.com) — MIT License  
> 配色方案：霓虹舞伴（深色底 + 粉紫/青蓝渐变）

---

## 一、项目概述

MaiMate 是一款面向 MaimaiDX（舞萌DX）街机音游玩家的手机辅助 APP。

### 核心痛点
- 几百首歌，到了机厅不知道练什么
- 推分没有系统性计划，凭感觉选歌
- 想随机抽歌练习但没有方便的按难度/分类筛选工具
- 官方渠道无法查询谱面详细信息（定数、note 分布）

### 目标用户
- 舞萌DX活跃玩家（尤其是追求 DX Rating 提升的玩家）
- 在机厅有"选择困难症"的玩家

### 竞品分析

| 竞品 | 形态 | 优势 | 劣势 |
|------|------|------|------|
| 水鱼查分器网页版 | Web | 数据最全、有社区 | 手机体验一般、无推分计划 |
| FindMaimaiDX_Phone | Android App | 原生体验 | 已归档、功能有限 |
| mai-bot (QQ) | QQ机器人 | 群聊互动 | 不能离线、无计划管理 |
| **MaiMate** | 跨平台App | 推分计划+智能抽歌+离线可用 | 新项目 |

---

## 二、游戏领域知识

### MaimaiDX 核心概念

| 概念 | 说明 |
|------|------|
| **曲目 (Music)** | 每首歌有唯一 ID、标题、艺术家、分类(流行&动漫/东方Project/VOCALOID/其他游戏/舞萌等)、BPM、版本(from) |
| **谱面 (Chart)** | 每首歌有 4~5 个难度谱面：Basic(绿)、Advanced(黄)、Expert(红)、Master(紫)、Re:MASTER(白) |
| **定数 (ds)** | 每个谱面的内部难度常数，如 12.7、14.8，比公开等级(如 12+)更精确 |
| **等级 (level)** | 公开显示的难度等级，如 "12+"、"14"，带 + 号表示该等级内偏高 |
| **Note 构成** | TAP / HOLD / SLIDE / TOUCH(仅DX) / BREAK，不同谱面 note 分布差异大 |
| **类型** | SD(标准) vs DX |
| **版本** | maimai / maimai PLUS / ... / PRiSM 等 |
| **DX Rating** | 玩家综合实力评分，由 Best 40 + 新版 Best 50 的最高定数谱面成绩计算 |
| **推分** | 针对某些歌曲刻意练习以提高分数 |

### 数据模型（来自 Prober API）

```typescript
interface MusicData {
  id: string;              // 歌曲ID
  title: string;           // 歌曲标题
  type: "SD" | "DX";       // 类型
  ds: number[];            // 各难度定数 [Basic, Advanced, Expert, Master, Re:MASTER?]
  level: string[];         // 各难度等级标签 ["5", "7+", "10", "12+", "14"]
  cids: number[];          // Chart内部ID
  charts: ChartData[];     // 各难度谱面详情
  basic_info: {
    title: string;
    artist: string;
    genre: string;         // 分类
    bpm: number;
    release_date: string;
    from: string;          // 出处版本
    is_new: boolean;
  };
}

interface ChartData {
  notes: number[];         // [TAP, HOLD, SLIDE, TOUCH?, BREAK] - SD无TOUCH
  charter: string;         // 谱师
}

type DifficultyIndex = 0 | 1 | 2 | 3 | 4;
type DifficultyLabel = "Basic" | "Advanced" | "Expert" | "Master" | "Re:MASTER";
type DifficultyColor = "绿" | "黄" | "红" | "紫" | "白";
```

---

## 三、设计系统

### 配色方案 —「霓虹舞伴」

深色底 + 粉紫/青蓝霓虹渐变，呼应 MaimaiDX 机台视觉基因，机厅昏暗环境下不刺眼。

```
背景层级:
  bg-primary:    #0f0f1a    深蓝黑（主背景）
  bg-secondary:  #1a1a2e    稍亮的卡片背景
  bg-tertiary:   #252540    悬浮/弹窗背景

主色调:
  accent-primary:  #ff6b9d → #c44dff  粉紫渐变（主按钮、选中态）
  accent-secondary: #00d4ff → #7b68ee  青蓝渐变（次要操作、链接）

文字:
  text-primary:   #f0e6ff    近白（主文字）
  text-secondary: #9888b0    灰紫（辅助文字）
  text-muted:     #5a4a6e    暗紫灰（占位/禁用）

功能色:
  success:  #3dd68c     (SSS评级)
  warning:  #f0b429     (提醒)
  danger:   #ff6b6b     (删除)

难度色 (复刻游戏内):
  basic:     #43a047    绿 🟢
  advanced:  #fdd835    黄 🟡
  expert:    #f44336    红 🔴
  master:    #ab47bc    紫 🟣
  remaster: #d4c5f0    白/浅紫白 ⚪
```

### UI 风格：「软科幻毛玻璃」

- **毛玻璃面板**: `expo-blur` 实现卡片/导航的半透明模糊效果
- **圆角**：卡片 16px、按钮 12px、输入框 10px
- **微妙渐变**：仅关键位置 — Header 底部光条、按钮、选中指示器
- **稀疏留白**：歌曲列表最小 60px 行高，快速扫读
- **字体**：系统默认中文 (PingFang SC / Noto Sans SC)，数字用 Tabular Nums
- **图标**：Lucide Icons（`lucide-react-native`）
- **动画**：`react-native-reanimated` — 抽歌滚筒旋转动画

### UI 技术选型

| 层面 | 选择 | 理由 |
|------|------|------|
| 样式框架 | NativeWind (Tailwind for RN) | 快速开发、暗色模式内置 |
| 组件库 | 自定义轻量组件 | 减少包体积、完全控制样式 |
| 模糊 | `expo-blur` | 毛玻璃卡片 |
| 渐变 | `expo-linear-gradient` | 按钮/Header 渐变 |
| 图标 | `lucide-react-native` | 轻量线性图标 |
| 动画 | `react-native-reanimated` | 高性能动画 |
| 底部导航 | Expo Router Tabs | 自动适配平台 |

---

## 四、筛选维度设计

曲目浏览器支持以下多维度组合筛选（可同时叠加）：

| 维度 | 字段 | 示例 | UI 组件 |
|------|------|------|---------|
| **分类 (Genre)** | `basic_info.genre` | 流行&动漫 / 东方Project / VOCALOID / 其他游戏 / 舞萌 / 原创 | 横向滚动胶囊 |
| **难度 (Difficulty)** | 谱面难度标签 | Basic / Advanced / Expert / Master / Re:MASTER | 难度色圆点切换 |
| **等级 (Level)** | `level[]` | 1~15，带 + 号 | Slider 或 分段选择器 |
| **定数范围 (DS Range)** | `ds[]` | 如 12.5 ~ 13.2 | 双滑块 Range Slider |
| **版本 (Version)** | `basic_info.from` | maimai / FESTiVAL / BUDDiES / PRiSM | 下拉或横滑 |
| **类型 (Type)** | `type` | SD (标准) / DX | 分段切换 |
| **曲师 (Artist)** | `basic_info.artist` | t+pazolite / 削除 / 任意关键词 | 搜索输入 |
| **谱师 (Charter)** | `charts[*].charter` | ニャイン / はっぴー / 譜面-100号 | 搜索输入 |
| **BPM 范围** | `basic_info.bpm` | 如 120 ~ 200 | 双滑块 |
| **标题搜索** | `title` | 模糊关键词搜索 | 搜索框 |

所有筛选条件可组合（AND 逻辑），筛选结果实时更新计数。

---

## 五、技术架构

```
┌─────────────────────────────────────┐
│          Diving-Fish API            │
│  /api/maimaidxprober/music_data     │  ← 曲目数据（公开，无需认证）
│  /covers/{id}.png                   │  ← 曲目封面图（公开）
│  /api/maimaidxprober/player/records │  ← 玩家成绩（需Token，Phase 2）
└────────────┬────────────────────────┘
             │ HTTP GET (首次+定期增量)
             ▼
┌─────────────────────────────────────┐
│         MaiMate App                 │
│  ┌─────────────────────────────┐    │
│  │   React Native (Expo)       │    │
│  │   TypeScript                │    │
│  ├─────────────────────────────┤    │
│  │   状态管理: Zustand         │    │
│  │   本地存储:                  │    │
│  │   - AsyncStorage (设置)     │    │
│  │   - SQLite/WatermelonDB     │    │
│  │     (曲目缓存+推分计划)     │    │
│  ├─────────────────────────────┤    │
│  │   路由: Expo Router         │    │
│  │   UI: React Native Paper /  │    │
│  │       NativeWind(Tailwind)  │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### 为什么选择 Expo？
- iOS/Android 一套代码
- OTA 热更新 — 曲库数据变更不需发版
- TypeScript 与 DSH 生态一致
- `expo-sqlite` 支持离线数据

---

## 六、功能规划

### Phase 1 — MVP（核心闭环）

| 优先级 | 功能 | 说明 |
|--------|------|------|
| P0 | **曲目浏览器** | 按分类/版本/难度筛选，列表+搜索，查看谱面详情（定数、note分布、谱师） |
| P0 | **推分计划表** | 标记歌曲为"推分中"，自定义排序，拖拽调整顺序 |
| P0 | **随机抽歌** | 按难度(紫/红等)+等级(13/13+等)+分类 随机；支持"再来一首"；显示封面 |
| P0 | **快捷列表** | 按推分计划顺序展示，到机厅直接照着打 |
| P1 | **封面缓存** | 预加载曲目封面图，弱网/离线也显示 |
| P1 | **离线可用** | 首次启动拉取完整曲库并缓存到 SQLite，后续启动秒开 |

### Phase 2 — 增强

| 优先级 | 功能 | 说明 |
|--------|------|------|
| P1 | **成绩接入** | 通过 prober Import-Token / Developer-Token 拉取玩家成绩 |
| P1 | **智能推分推荐** | 自动推荐"容易提分"的歌曲：高分未 S/SS/SSS、定数接近但成绩偏低 |
| P1 | **B40/B50 展示** | 交互式展示最佳成绩排行（参考 mai-bot 的生成逻辑） |
| P2 | **定数查歌** | 输入定数范围（如 13.0-13.3），列出所有匹配歌曲 |
| P2 | **分数线计算** | 达成某分数线允许的 TAP GREAT 容错数 |

### Phase 3 — 社交/高级

| 优先级 | 功能 | 说明 |
|--------|------|------|
| P2 | **排卡/机厅队列** | Party 排卡管理（参考 FindMaimaiDX_Phone） |
| P3 | **成绩分享卡** | 生成分享图片（B40/B50 卡片） |
| P3 | **版本更新提醒** | Prober 数据更新时推送新曲通知 |
| P3 | **谱面预览** | 静态谱面图片（需额外数据源，如 simai 格式） |

---

## 七、路线图

```
Week 1-2: 项目脚手架 + 曲库数据层
  - Expo init + TypeScript 配置
  - Prober API 数据拉取模块
  - SQLite 曲库存储 + 缓存策略
  - MusicList 过滤查询封装

Week 3-4: 曲目浏览器
  - 列表页（分类筛选 + 搜索）
  - 谱面详情页（定数、note分布可视化）
  - 封面图加载+缓存

Week 5-6: 推分计划 + 随机抽歌
  - 推分计划表（标记、排序）
  - 随机抽歌面板（难度/分类/等级筛选）
  - 快捷推分列表

Week 7: 打磨 + 内测
  - UI/UX 优化
  - 离线模式完善
  - 部署内测版到里站下载页
```

---

## 八、发布通道

### 里站下载页（测试阶段）
- URL: `https://maimate.flya.ccwu.cc`（private，仅 me.flya.ccwu.cc 里站可见）
- 内容：APP 简介 + APK 下载 + 版本号 + 更新日志 + 安装二维码
- 技术：Cloudflare Pages 静态站，通过 flya-home Worker 反代

### 公开站（正式发布后）
- 改为 `visibility: public` 即在外站 `flya.ccwu.cc` 显示
- 可考虑上架 App Store / Google Play（后续）

### 更新机制
- Expo OTA Update：JS 层热更新（不发版）
- Native 层更新：APK 下载页 + 版本检测提醒

---

## 九、数据标注 & 合规

### 必须标注的内容
```
歌曲数据来源：Diving-Fish 舞萌DX查分器
https://maimai.diving-fish.com
基于 MIT 许可证开放使用

本应用与华立科技、SEGA 等公司无任何关系。
注册商标所有权归相关品牌所有。
曲目数据及定数不保证 100% 准确，仅供推分指导参考。
```

### 标注位置
- APP 设置页「关于」→「数据来源」
- GitHub README
- 下载页底部

---

## 十、风险 & 缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Prober API 关闭/改版 | 无法获取新曲数据 | 本地缓存完整曲库，API 不可用时使用缓存；保留一份 static JSON fallback |
| 曲库更新滞后 | 新版本歌曲缺失 | 定期同步 + 用户手动刷新 |
| 版权方追究 | 法律风险 | 非商业项目 + 免责声明 + 不提供游戏ROM/音频 |
| API 请求限流 | 大量用户时被封 | 客户端内置缓存策略（首次拉取后增量更新）；申请 Developer-Token |
| 手机存储空间 | 封面图太多 | 延迟加载 + LRU 缓存 + 可选低质量模式 |

---

## 十一、开源项目依赖 & 致谢

| 项目 | 作者 | 用途 | 许可证 |
|------|------|------|--------|
| maimaidx-prober | Diving-Fish | 曲目数据API | MIT |
| mai-bot | Diving-Fish | 数据模型参考、过滤逻辑参考 | MIT |
| FindMaimaiDX_Phone | Spaso1 | UI/UX 概念参考 | 无 |

---

## 十二、对话记录索引

> 后续每次设计讨论的摘要应追加到本节。

### 2026-08-16 — 初始设计
- 确定了项目名 MaiMate、技术栈 React Native (Expo)、数据源 Prober API
- 三阶段功能规划（MVP → 增强 → 社交）
- 发布通道：里站 maimate.flya.ccwu.cc → 后续公开
- 待处理：GitHub 仓库创建（需要 gh auth）、项目脚手架搭建

### 2026-08-16 — 设计深化
- 确定配色方案 A「霓虹舞伴」：深色底 #0f0f1a + 粉紫渐变 + 青蓝渐变
- UI 风格：软科幻毛玻璃（expo-blur + NativeWind + Lucide 图标）
- 新增 10 维筛选维度：分类/难度/等级/定数/版本/类型/曲师/谱师/BPM/标题
- 抽歌滚筒旋转动画：用 reanimated 模拟洗衣机滚筒转动
- 仓库已创建：FengLingYaaa/maimate-app（公开，MIT）
- Phase 2 成绩接入暂缓，优先完成 MVP 核心闭环