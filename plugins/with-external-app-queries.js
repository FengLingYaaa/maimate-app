const { withAndroidManifest } = require('@expo/config-plugins');

const SCHEMES = ['bilibili', 'orpheus', 'qqmusic', 'kugou'];

function intentForScheme(scheme) {
  return {
    action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
    category: [{ $: { 'android:name': 'android.intent.category.BROWSABLE' } }],
    data: [{ $: { 'android:scheme': scheme } }],
  };
}

module.exports = function withExternalAppQueries(config) {
  return withAndroidManifest(config, configWithManifest => {
    const manifest = configWithManifest.modResults.manifest;
    const queries = manifest.queries || [{ intent: [] }];
    const query = queries[0] || { intent: [] };
    query.intent = query.intent || [];
    const existingSchemes = new Set(
      query.intent.flatMap(intent => (intent.data || []).map(data => data.$?.['android:scheme']).filter(Boolean)),
    );

    for (const scheme of SCHEMES) {
      if (!existingSchemes.has(scheme)) query.intent.push(intentForScheme(scheme));
    }
    manifest.queries = [query];
    return configWithManifest;
  });
};

module.exports.SCHEMES = SCHEMES;
