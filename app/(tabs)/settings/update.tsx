import React, { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import Constants from 'expo-constants';
import { Colors } from '../../../src/constants';
import { manualCheckForUpdate, markUpdateSeen } from '../../../src/api/app-update';
import type { UpdateCheckResult } from '../../../src/api/app-update';

export default function UpdateScreen() {
  const currentVersion = Constants.expoConfig?.version ?? 'unknown';
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UpdateCheckResult | null>(null);

  // 进入页面即视为已知晓已知更新，熄灭设置页红点。
  useEffect(() => {
    markUpdateSeen(currentVersion).catch(() => undefined);
  }, [currentVersion]);

  const handleCheck = async () => {
    setBusy(true);
    setResult(null);
    try {
      setResult(await manualCheckForUpdate(currentVersion));
    } finally {
      setBusy(false);
    }
  };

  const openRelease = () => {
    const url = result?.releaseUrl;
    if (url) void Linking.openURL(url);
  };

  const openDownload = () => {
    const url = result?.apkUrl;
    if (url) void Linking.openURL(url);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: '检查更新', headerStyle: { backgroundColor: Colors.bg.primary }, headerTintColor: Colors.text.primary }} />
      <Text style={styles.title}>🔄 检查更新</Text>
      <View style={styles.versionCard}>
        <Text style={styles.versionLabel}>当前版本</Text>
        <Text style={styles.versionValue}>v{currentVersion}</Text>
      </View>

      <Pressable style={[styles.checkButton, busy && styles.disabled]} disabled={busy} onPress={() => void handleCheck()}>
        <Text style={styles.checkButtonText}>{busy ? '检查中…' : '检查最新版本'}</Text>
      </Pressable>

      {result && (
        <View style={styles.resultCard}>
          {result.status === 'error' ? (
            <Text style={styles.errorText}>{result.error}</Text>
          ) : result.status === 'latest' ? (
            <Text style={styles.latestText}>✓ 已是最新版本</Text>
          ) : (
            <>
              <Text style={styles.updateTitle}>发现新版本 v{result.latestVersion}</Text>
              {result.publishedAt && <Text style={styles.meta}>发布于 {new Date(result.publishedAt).toLocaleDateString()}</Text>}
              {result.notes && <Text style={styles.notes}>{result.notes}</Text>}
              {result.apkUrl && (
                <Pressable style={styles.downloadButton} onPress={openDownload}>
                  <Text style={styles.downloadButtonText}>下载 APK（{result.apkUrl.replace(/^https?:\/\//, '')}）</Text>
                </Pressable>
              )}
              {result.releaseUrl && (
                <Pressable style={styles.linkButton} onPress={openRelease}>
                  <Text style={styles.linkButtonText}>查看发布说明</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: 16, paddingTop: 22, paddingBottom: 90, gap: 12 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text.primary },
  versionCard: { padding: 14, borderRadius: 14, backgroundColor: Colors.bg.secondary, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  versionLabel: { fontSize: 13, color: Colors.text.muted },
  versionValue: { fontSize: 18, fontWeight: '800', color: Colors.text.primary },
  checkButton: { alignItems: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.accent.primary },
  checkButtonText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  resultCard: { padding: 14, borderRadius: 14, backgroundColor: Colors.bg.secondary, gap: 8 },
  errorText: { fontSize: 12, lineHeight: 18, color: Colors.functional.danger },
  latestText: { fontSize: 13, color: Colors.functional.success, fontWeight: '700' },
  updateTitle: { fontSize: 15, fontWeight: '800', color: Colors.accent.primary },
  meta: { fontSize: 11, color: Colors.text.muted },
  notes: { fontSize: 12, lineHeight: 18, color: Colors.text.secondary },
  downloadButton: { alignItems: 'center', paddingVertical: 11, borderRadius: 10, backgroundColor: Colors.accent.primary },
  downloadButtonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  linkButton: { alignItems: 'center', paddingVertical: 11, borderRadius: 10, backgroundColor: Colors.bg.tertiary, borderWidth: 1, borderColor: Colors.border.medium },
  linkButtonText: { fontSize: 12, fontWeight: '700', color: Colors.accent.secondary },
});
