# MaiMate 构建指南

## 方式一：GitHub Actions 云构建（推荐，无需本地 Android 环境）

在任何一台能上网的电脑上都可以，完全不需要安装 Android SDK：

1. 打开仓库页面 https://github.com/FengLingYaaa/maimate-app
2. 点击 **Actions** 标签页
3. 左侧选择 **Build Android APK**
4. 点击右侧 **Run workflow** → **Run workflow**（绿色按钮）
5. 等待约 10~15 分钟，任务完成后进入该次运行页面
6. 在 **Artifacts** 区域下载 `MaiMate-APK`

> GitHub 托管 runner 内存充足，不受本机 4GB 容器限制。

## 方式二：本地构建（需要 Android 环境）

### 前置条件

- Node.js 20+
- JDK 17
- Android SDK（platforms;android-35, build-tools;35.0.0）
- 内存 ≥ 8GB（本机 4GB 容器会 OOM，见下方调优）

### 步骤

```bash
git clone https://github.com/FengLingYaaa/maimate-app.git
cd maimate-app
npm install
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

## 方式三：开发调试（Expo Go）

仅用于开发阶段快速预览（最终安装仍需 APK）：

```bash
npm install
npx expo start
# 手机安装 Expo Go 后扫码
```