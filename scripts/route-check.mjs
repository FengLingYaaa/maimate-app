import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
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

const appDirectory = join(dirname(new URL(import.meta.url).pathname), '..', 'app');
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
assert.equal(rootRoutes.get('settings')?.type, 'layout', 'settings must be a nested layout route');
assert.equal(rootRoutes.get('song')?.type, 'layout', 'song must be a nested layout route');
assert.equal(rootRoutes.get('plates')?.type, 'layout', 'plates must be a nested layout route');
assert.equal(rootRoutes.has('settings/music-platform'), false, 'settings child must not be a root route');
assert.equal(rootRoutes.has('settings/sort'), false, 'settings child must not be a root route');
assert.equal(rootRoutes.has('song/[id]'), false, 'song detail must not be a root route');
assert.deepEqual(
  rootRoutes.get('settings')?.children.map(route => route.route).sort(),
  ['index', 'music-platform', 'sort'],
);
assert.deepEqual(rootRoutes.get('song')?.children.map(route => route.route), ['[id]']);
assert.deepEqual(rootRoutes.get('plates')?.children.map(route => route.route), ['index']);

console.log('Route checks passed (settings, song, and plates routes use nested Stack layouts)');
