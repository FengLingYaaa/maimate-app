# MaiMate 构建指南

> 目标是生成可直接安装的独立 `app-release.apk`，**不使用 Expo Go、不需要扫码**。Expo Go 仅是可选的开发预览工具，不适用于本项目当前手机环境。

## 方式一：GitHub Actions 云构建（推荐，无需本地 Android 环境）

在任何一台能上网的电脑上都可以，完全不需要安装 Android SDK：

1. 打开仓库页面 https://github.com/FengLingYaaa/maimate-app
2. 点击 **Actions** 标签页
3. 左侧选择 **Build Android APK**
4. 点击右侧 **Run workflow** → **Run workflow**（绿色按钮）
5. 等待约 10~15 分钟，任务完成后进入该次运行页面
6. 在 **Artifacts** 区域下载 `MaiMate-APK`

> GitHub 托管 runner 内存充足，不受本机 4GB 容器限制。

### 发布到个人下载站

发布版本时，推荐用带 `v` 前缀的 tag 触发同一工作流：

```bash
git tag -a v1.3.0-alpha -m "MaiMate v1.3.0-alpha"
git push origin v1.3.0-alpha
```

工作流会完成 arm64 APK 云构建，并把产物以固定文件名 `MaiMate-latest.apk` 上传到同名 GitHub Release。随后更新 `landing/_worker.js` 中的 Release 地址，执行 `landing/deploy-download-site.sh` 部署 Cloudflare Pages/Worker；下载站不会把 42 MiB APK 直接上传到 Pages，而是由 Worker 转发 GitHub Release 资产。

## 方式二：本地构建（需要 Android 环境）

### 前置条件

- Node.js 20+
- JDK 17
- Android SDK（platforms;android-36, build-tools;36.0.0, NDK 27.1.12297006, CMake 3.30.5）
- 内存 ≥ 8GB（本机 4GB 容器会 OOM，见下方调优）

### 步骤

```bash
git clone https://github.com/FengLingYaaa/maimate-app.git
cd maimate-app
npm install --legacy-peer-deps
npx expo prebuild --platform android --no-install
cd android
./gradlew assembleRelease
# 产物: android/app/build/outputs/apk/release/app-release.apk
```

### 低内存容器（4GB）调优

`android/gradle.properties` 已包含低内存配置（768m 堆、串行构建、仅 arm64）。
如果仍触发内核 OOM（`Gradle build daemon disappeared unexpectedly`）：

```bash
# 构建前释放内存
pkill -f KotlinCompileDaemon   # 清理残留编译守护进程
pkill -f GradleDaemon

# 检查容器内存余量（需要 > 2GB 空闲）
cat /sys/fs/cgroup/memory.current
cat /sys/fs/cgroup/memory.max

# 分步构建降低内存峰值
./gradlew :app:createBundleReleaseJsAndAssets   # 先出 JS bundle
./gradlew assembleRelease                        # 再打包 APK
```

### APK 产物信息

- 路径: `android/app/build/outputs/apk/release/app-release.apk`
- 包名: `cc.flya.maimate`
- 架构: arm64-v8a（覆盖几乎所有现代手机）
- 签名: debug keystore（内测用；正式发布前需替换自己的 keystore）

### 重要：依赖版本必须与 Expo SDK 57 对齐

`package.json` 中的原生库版本已按 `expo/bundledNativeModules.json` 对齐。
**不要**使用 create-expo-app 旧模板的过时版本，否则 JS 打包会报：

```
Unable to resolve module react-native/Libraries/Renderer/shims/ReactNative
from react-native-reanimated/src/platform-specific/findHostInstance.ts
```

正确组合（Expo SDK 57 / RN 0.86）：
- `react-native-reanimated`: **4.5.1**（不是 3.18！）
- `react-native-worklets`: 0.10.1（reanimated v4 必需）
- `react-native-gesture-handler`: ~2.32.0
- `react-native-screens`: ~4.26.0
- `react-native-safe-area-context`: ~5.7.0
- `@react-native-async-storage/async-storage`: 2.2.0

### 本机（DSH 工作区）4GB 容器限制说明

本工作区所在的 Linux 容器给用户进程分配约 4GB cgroup 内存（含 DSH 及其他会话进程），
RN 新架构的原生 C++ 编译峰值会超过该限额，导致内核 OOM：

```
Gradle build daemon disappeared unexpectedly (it may have been killed or may have crashed)
```

`cat /sys/fs/cgroup/memory.max` 可查限额（4294967296 ≈ 4GB）。这是环境硬限制，
**本机构建会失败，请使用方式一（GitHub Actions）或在内存 ≥8GB 的其他电脑上构建**。

## 方式三：开发调试（Expo Go）

仅用于开发阶段快速预览（最终安装仍需 APK）：

```bash
npm install
npx expo start
# 手机安装 Expo Go 后扫码
```