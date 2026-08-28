/**
 * MaiMate 落地页 Worker（Cloudflare Pages _worker.js）。
 *
 * - `/MaiMate-latest.apk`：v1.15.2 起改为 302 重定向到 GitHub Release 直链
 *   （releases/latest/download 自动跟随最新 tag）。重定向响应体积极小，
 *   不再消耗 Workers 代理流量，也不再有 CF 服务条款大文件分发风险；
 *   下载流量直接走 GitHub CDN。
 * - 其余路径走 Pages 静态资源（index.html）。
 */
const APK_PATH = '/MaiMate-latest.apk';
const APK_SOURCE = 'https://github.com/FengLingYaaa/maimate-app/releases/latest/download/MaiMate-latest.apk';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === APK_PATH) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: APK_SOURCE,
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const asset = await env.ASSETS.fetch(request);
    if (asset.status === 200) return asset;

    // 未知路径回退到落地页。
    return env.ASSETS.fetch(new URL('/', url).toString());
  },
};
