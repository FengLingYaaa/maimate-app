/**
 * MaiMate 落地页 Worker（Cloudflare Pages _worker.js）。
 *
 * - `/MaiMate-latest.apk`：流式代理 GitHub Release 最新资产（releases/latest/download
 *   自动跟随 302 到最新 tag），发布新版无需改动本 Worker；
 * - 其余路径走 Pages 静态资产（index.html）。
 */
const APK_PATH = '/MaiMate-latest.apk';
const APK_SOURCE = 'https://github.com/FengLingYaaa/maimate-app/releases/latest/download/MaiMate-latest.apk';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === APK_PATH) {
      const upstream = await fetch(APK_SOURCE, {
        method: request.method,
        headers: { 'User-Agent': 'maimate-landing-worker' },
        redirect: 'follow',
        cache: 'no-store',
      });
      if (!upstream.ok && upstream.status !== 304) {
        return new Response(`上游 Release 资产暂不可用（${upstream.status}），请稍后重试。`, {
          status: 502,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
      const headers = new Headers(upstream.headers);
      headers.set('Cache-Control', 'no-store');
      headers.set('Access-Control-Allow-Origin', '*');
      return new Response(upstream.body, { status: upstream.status, headers });
    }

    const asset = await env.ASSETS.fetch(request);
    if (asset.status === 200) return asset;

    // 未知路径回退到落地页。
    return env.ASSETS.fetch(new URL('/', url).toString());
  },
};
