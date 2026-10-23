import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const deployDirectory = join(scriptDirectory, '..', '.landing-deploy');
for (const asset of ['index.html', 'changelog.html', 'icon.png', '_worker.js']) {
  const path = join(deployDirectory, asset);
  assert.equal(existsSync(path), true, `landing deploy asset exists: ${asset}`);
  assert.ok(statSync(path).size > 0, `landing deploy asset is not empty: ${asset}`);
}

const homeHtml = readFileSync(join(deployDirectory, 'index.html'), 'utf8');
const changelogHtml = readFileSync(join(deployDirectory, 'changelog.html'), 'utf8');
assert.match(homeHtml, /下载 MaiMate v1\.17\.3/);
assert.match(homeHtml, /MaiMate-v1\.17\.3\.apk/);
assert.match(homeHtml, /v1\.17\.3/);
assert.doesNotMatch(homeHtml, /当前正式 APK 仍为 v1\.17\.2/);
const loggedVersions = changelogHtml.split('class="version">').slice(1).map(entry => entry.split('</span>')[0]);
assert.ok(loggedVersions.length >= 30, 'the historical changelog includes versioned entries back to the alpha builds');
assert.equal(loggedVersions[0], 'v1.17.3');
assert.match(loggedVersions.at(-1), /v0\.1\.0-alpha/);
assert.ok(loggedVersions.some(version => version === 'v1.17.2'));

// Load the Pages module as an ES module without changing its required _worker.js filename.
const workerSource = readFileSync(join(deployDirectory, '_worker.js'), 'utf8');
const workerModule = await import(`data:text/javascript;base64,${Buffer.from(workerSource).toString('base64')}`);
const assetRequests = [];
const assets = {
  async fetch(input) {
    const request = input instanceof Request ? input : new Request(input);
    const pathname = new URL(request.url).pathname;
    assetRequests.push(pathname);
    if (['/', '/changelog', '/icon.png'].includes(pathname)) {
      return new Response(`asset:${pathname}`, { status: 200 });
    }
    return new Response('not found', { status: 404 });
  },
};
const env = { ASSETS: assets };

const apkResponse = await workerModule.default.fetch(new Request('https://maimate.example/MaiMate-latest.apk?source=landing'), env);
assert.equal(apkResponse.status, 302);
assert.equal(apkResponse.headers.get('location'), 'https://github.com/FengLingYaaa/maimate-app/releases/latest/download/MaiMate-latest.apk');
assert.equal(apkResponse.headers.get('cache-control'), 'no-store');
assert.equal(assetRequests.length, 0, 'APK redirect must not fetch or proxy the APK asset');

for (const pathname of ['/', '/changelog.html', '/icon.png']) {
  const response = await workerModule.default.fetch(new Request(`https://maimate.example${pathname}`), env);
  assert.equal(response.status, 200, `Pages serves ${pathname}`);
  const served = pathname === '/changelog.html' ? '/changelog' : pathname;
  assert.equal(await response.text(), `asset:${served}`);
}

const fallback = await workerModule.default.fetch(new Request('https://maimate.example/unknown-route'), env);
assert.equal(fallback.status, 200, 'unknown routes fall back to the landing home');
assert.equal(await fallback.text(), 'asset:/');
assert.deepEqual(assetRequests, ['/', '/changelog', '/icon.png', '/unknown-route', '/']);

console.log('Landing worker checks passed (static assets, changelog route, APK redirect, unknown-route fallback)');
