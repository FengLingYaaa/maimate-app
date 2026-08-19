import assert from 'node:assert/strict';
import {
  getMusicPlatformSearchUrl,
  MUSIC_PLATFORM_LABELS,
} from '../src/data/music-platforms.ts';
import {
  BILIBILI_QUICK_TAGS,
  getChartKey,
  normalizeBilibiliVideoUrl,
} from '../src/data/bilibili-links.ts';
import {
  CURATED_SONG_ALIASES,
  getSearchTitles,
} from '../src/data/song-aliases.ts';

const encoded = '%E6%99%B4%E5%A4%A9%20%E5%91%A8%E6%9D%B0%E4%BC%A6';
// Keep the expected query generated from the same Unicode input; this catches accidental
// native/private scheme changes and verifies spaces are URL encoded.
const query = encodeURIComponent('晴天 周杰伦');
assert.equal(encoded, query);
assert.deepEqual(Object.keys(MUSIC_PLATFORM_LABELS), ['netease', 'qq', 'kugou']);
assert.equal(
  getMusicPlatformSearchUrl('netease', '晴天', '周杰伦'),
  `https://music.163.com/#/search/m/?s=${query}&type=1`,
);
assert.equal(
  getMusicPlatformSearchUrl('qq', '晴天', '周杰伦'),
  `https://y.qq.com/n/ryqq_v2/search?w=${query}&t=song`,
);
assert.equal(
  getMusicPlatformSearchUrl('kugou', '晴天', '周杰伦'),
  `https://www.kugou.com/yy/html/search.html#searchType=song&searchKeyWord=${query}`,
);

assert.equal(getChartKey('12345', 'DX', 3), 'DX:12345:3');
assert.equal(normalizeBilibiliVideoUrl('https://www.bilibili.com/video/BV1xx411c7mD'), 'https://www.bilibili.com/video/BV1xx411c7mD');
assert.equal(normalizeBilibiliVideoUrl('http://www.bilibili.com/video/BV1xx411c7mD'), null);
assert.equal(normalizeBilibiliVideoUrl('https://example.com/video/BV1xx411c7mD'), null);
assert.deepEqual(BILIBILI_QUICK_TAGS, ['手元', '邪道', '研究', 'AP', 'FC']);

const music = {
  id: '1',
  type: 'SD',
  title: '晴天',
  basic_info: { title: '晴天', artist: '周杰伦' },
};
assert.deepEqual(getSearchTitles(music), ['晴天']);
assert.deepEqual(CURATED_SONG_ALIASES, []);

console.log('Phase A-F pure checks passed (music URLs, Bilibili keys, empty aliases)');
