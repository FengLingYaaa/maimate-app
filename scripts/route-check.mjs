import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getExactRoutes } = require('expo-router/build/getRoutes');
const routeExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);

function collectRouteKeys(directory, prefix = '.') {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectRouteKeys(path, `${prefix}/${entry.name}`);
    if (!routeExtensions.has(extname(entry.name))) return [];
    return [`${prefix}/${entry.name}`];
  });
}

// fileURLToPath 兼容 Windows（URL pathname 会产生 /D:/... 形式）。
const appDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');
const contextKeys = collectRouteKeys(appDirectory);
const context = () => ({ default: function Route() {} });
context.keys = () => contextKeys;

const tree = getExactRoutes(context, {
  ignoreEntryPoints: true,
  ignoreRequireErrors: true,
  internal_stripLoadRoute: true,
});

assert.ok(tree, 'Expo Router route tree should be generated');
const rootRoutes = new Map(tree.children.map(route => [route.route, route]));
assert.equal(rootRoutes.get('(tabs)')?.type, 'layout', '(tabs) must be the root tab group layout');
assert.equal(rootRoutes.get('song')?.type, 'layout', 'song must be a root-level Stack sibling of (tabs)');
assert.equal(rootRoutes.get('b50')?.type, 'route', 'b50 must be a root-level Stack screen sibling of (tabs)');
const tabsChildren = new Map(rootRoutes.get('(tabs)')?.children.map(route => [route.route, route]));
for (const name of ['index', 'random', 'plan', 'fortune', 'explore']) {
  assert.equal(tabsChildren.get(name)?.type, 'route', `${name} must live inside (tabs) as a leaf screen`);
}
for (const name of ['plates', 'settings']) {
  assert.equal(tabsChildren.get(name)?.type, 'layout', `${name} must live inside (tabs) as a nested Stack`);
}
assert.equal(rootRoutes.has('index'), false, 'tab screens must not leak to root');
assert.equal(rootRoutes.has('plan'), false, 'tab screens must not leak to root');
assert.equal(rootRoutes.has('settings/music-platform'), false, 'settings child must not be a root route');
assert.equal(rootRoutes.has('settings/sort'), false, 'settings child must not be a root route');
assert.equal(rootRoutes.has('settings/detail-boards'), false, 'settings child must not be a root route');
assert.equal(rootRoutes.has('settings/data-backup'), false, 'settings child must not be a root route');
assert.equal(rootRoutes.has('settings/update'), false, 'settings child must not be a root route');
assert.equal(rootRoutes.has('song/[id]'), false, 'song detail must not be a root route');
assert.equal(rootRoutes.has('index'), false, 'b50 must not shadow tab screens');
const settingsNode = tabsChildren.get('settings');
assert.deepEqual(
  settingsNode?.children.map(route => route.route).sort(),
  ['data-backup', 'detail-boards', 'index', 'music-platform', 'snapshots', 'sort', 'update'],
);
assert.deepEqual(rootRoutes.get('song')?.children.map(route => route.route), ['[id]']);
const platesNode = tabsChildren.get('plates');
assert.deepEqual(platesNode?.children.map(route => route.route), ['index']);

console.log('Route checks passed ((tabs) group + root-level song/b50 screens with nested Stack layouts)');
