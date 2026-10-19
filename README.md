# MaiMate（舞萌伴侣）

MaiMate 是为 MaimaiDX（舞萌 DX）玩家准备的 Android 辅助应用，帮助你在机厅前后整理曲库、安排推分练习，并快速决定下一首练什么。

> MaiMate 是非官方项目，与 SEGA、华立科技及 MaimaiDX 游戏运营方无关联。它不包含游戏本体、ROM、音频或自动打歌功能。

## 下载

**最新正式发布：v1.17.2 · Android arm64 内测 APK**

v1.17.3 发布源码与官网素材已就绪，等待 GitHub Actions 构建并发布 APK；在发布前请使用上方最新版正式版下载链接。

- [下载最新版 APK](https://github.com/FengLingYaaa/maimate-app/releases/latest/download/MaiMate-latest.apk)
- [查看全部 GitHub Releases](https://github.com/FengLingYaaa/maimate-app/releases)
- [v1.17.2 版本说明](https://github.com/FengLingYaaa/maimate-app/releases/tag/v1.17.2)

APK 为 arm64-v8a 构建，面向常见的现代 Android 设备。当前发布包使用 debug 签名，适用于内测；Android 安装时如出现系统确认，请按设备提示操作。

## 常见问题：成绩 Token 验证失败

MaiMate 用 `GET /player/validate` 验证成绩导入 Import-Token，通过后再调用只读 `GET /player/records` 读取成绩。Diving-Fish 官方 `/player/validate` 使用的认证逻辑支持 Import-Token，并返回当前账号信息；无效 Import-Token 会以 HTTP 400 和“导入token有误”拒绝。

1. 确认复制的是官网个人资料里的**成绩导入 Import-Token**，不是网页登录凭据、Developer-Token 或完整 Shadowrocket URL；若粘贴链接，MaiMate 会提取其中的 `token` 参数。
2. 若再次生成了 Token，先在 MaiMate 设置中用新 Token 执行“验证并替换”，再点“立即同步成绩”。
3. 若仍失败，点击“诊断成绩连接”。诊断只发送随机无效占位 Token 到 `/player/validate` 和 `/player/records`，检查验证及成绩端点是否可达；它**不能验证你个人 Token，也不会发送已保存的 Token**。
4. 如果诊断显示端点可达但 Token 验证仍返回 400，常见原因包括复制不完整、粘贴了网页登录凭据而不是导入 Token、重新生成后继续使用旧 Token，或 Diving-Fish 账号/服务端侧问题。请从当前玩家账号重新生成并直接粘贴新的成绩导入 Token；不要向 Issue、截图或聊天发送 Token。
5. 诊断显示网络错误时，检查 DNS、网络过滤、VPN/代理，或稍后重试。诊断显示 403 / 429 / 5xx 时，按拒绝、限流或服务端状态处理，不要反复重置 Token。

## 主要功能

- **曲库与谱面查询**：搜索歌曲，并按难度、等级、定数、版本、分类、曲师、谱师等条件筛选。
- **推分计划**：记录想练的谱面、目标达成率、备注和练习顺序；开启设置后，只将已有成绩低于目标且本次同步达到目标的曲目一次性移至手动顺序末尾，不改变评分/筛选视图。
- **随机抽歌**：从推分计划、全曲或筛选条件中抽取练习目标。
- **DX Rating 工具**：估算官方定数下的 DX Rating，并提供拟合定数等参考信息。
- **成绩与快照**：按用户主动配置的 Diving-Fish Import-Token 只读导入成绩，保存本机快照并比较变化；支持分享全部变化或只分享接口报告的单谱 `records[].ra` 增长曲目。
- **AP50、B50 与练习信息**：在本机成绩基础上浏览榜单、计划和相关统计。
- **文字 OCR**：从照片中的文字识别歌曲名称并匹配曲库；不进行曲绘识别。
- **本机数据管理**：支持成绩、计划等数据备份与恢复，并可查看缓存占用。

实际功能以当前发布版本和应用内说明为准。

## 隐私与数据来源

- 曲库来自 [Diving-Fish 舞萌 DX 查分器](https://maimai.diving-fish.com/)；曲库数据按项目约定标注来源。曲库缓存优先保存在设备上，联网用于数据更新。
- 成绩导入需要用户自行提供 Diving-Fish 的“成绩导入 Import-Token”（不是网页登录 Token）。MaiMate 使用 Token 进行**只读**成绩请求，不提供成绩写入；Token 存放在设备安全存储中，不应通过 Issue、截图或聊天发送给他人。
- 若 Token 反复被验证为无效，可在设置页运行“诊断成绩连接”。诊断只发送随机无效占位 Token 到 `/player/validate` 与 `/player/records` 确认端点可达性，不会读取或发送已保存 Token；它不能验证用户自己的 Token 是否有效。
- 计划、导入成绩、快照和偏好设置保存在本机。备份文件由用户主动导出和保管。
- OCR 用于识别照片中的文字，不识别曲绘；Bilibili 和音乐平台内容由外部应用或网页打开。

## 开发

项目使用 Expo SDK 57、Expo Router、React Native、TypeScript 和 Zustand。开发前请先阅读仓库中的 [AGENTS.md](AGENTS.md)，并查阅对应版本的 [Expo SDK 57 文档](https://docs.expo.dev/versions/v57.0.0/)。

环境要求：Node.js 20 或更新版本。

```bash
git clone https://github.com/FengLingYaaa/maimate-app.git
cd maimate-app
npm ci --legacy-peer-deps
npx expo start
```

在 Windows/Android Studio、Android 模拟器或设备上运行开发版时，具体命令和原生依赖要求见 [构建指南](docs/BUILD.md)。仓库也包含 Expo Go 之外的原生模块，最终 Android 安装包请优先通过 GitHub Actions 云构建获取。

## 验证

```bash
npm run lint
npm run test:routes
npm run test:landing
npm run test:features
npm run test:phase-af
npm run test:rating
npm run test:backup
npm run test:update
npm run test:match
```

Android APK 的构建流程、产物命名和发布说明见 [docs/BUILD.md](docs/BUILD.md)。产品设计、架构约束和变更记录见 [docs/DESIGN.md](docs/DESIGN.md)。

## 致谢与声明

感谢 [Diving-Fish](https://maimai.diving-fish.com/) 提供公开的曲库与成绩查询服务及相关数据，并按其项目许可要求进行来源标注。歌曲、游戏及相关商标的权利归各自权利人所有。

MaiMate 是社区辅助工具；数据准确性、服务可用性和第三方客户端跳转行为不作官方保证。
