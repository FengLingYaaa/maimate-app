import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../../src/constants';
import { useScoreStore, useSettingsStore } from '../../../src/store';
import { MUSIC_PLATFORM_OPTIONS, getSortLabel } from '../../../src/data/settings-options';
import { exportScoresCsv } from '../../../src/data/scores-csv';
import { measureStorageBreakdown, clearCovers, clearOtherCache, formatBytes, type StorageBreakdown } from '../../../src/data/storage-usage';

export default function SettingsPage() {
  const router = useRouter();
  const settings = useSettingsStore(s => s.settings);
  const updateSettings = useSettingsStore(s => s.updateSettings);
  const resetSettings = useSettingsStore(s => s.resetSettings);
  const tokenConfigured = useScoreStore(s => s.tokenConfigured);
  const sync = useScoreStore(s => s.sync);
  const verifyAndSaveToken = useScoreStore(s => s.verifyAndSaveToken);
  const clearToken = useScoreStore(s => s.clearToken);
  const syncScores = useScoreStore(s => s.syncScores);
  const clearScores = useScoreStore(s => s.clearScores);
  const snapshots = useScoreStore(s => s.snapshots);
  const changes = useScoreStore(s => s.changes);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenMessage, setTokenMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  // v1.15.0：快照保留数量设置（1–1000，默认 20），修改时警告存储占用。
  const [snapshotLimitInput, setSnapshotLimitInput] = useState(String(settings.snapshotLimit));
  // v1.16.5：存储占用分析。
  const [storageUsage, setStorageUsage] = useState<StorageBreakdown | null>(null);

  useEffect(() => {
    let cancelled = false;
    measureStorageBreakdown()
      .then(usage => {
        if (!cancelled) setStorageUsage(usage);
      })
      .catch(() => {
        if (!cancelled) setStorageUsage({ dataBytes: 0, coverBytes: 0, coverCount: 0, otherBytes: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** v1.16.5：清理曲绘缓存并刷新占用显示。 */
  const handleClearCovers = async () => {
    await clearCovers();
    try {
      setStorageUsage(await measureStorageBreakdown());
    } catch {
      // 刷新失败保持旧值。
    }
  };

  /** v1.16.6：清理其它缓存（旧版残留等）并刷新占用显示。 */
  const handleClearOtherCache = async () => {
    await clearOtherCache();
    try {
      setStorageUsage(await measureStorageBreakdown());
    } catch {
      // 刷新失败保持旧值。
    }
  };

  useEffect(() => {
    setSnapshotLimitInput(String(settings.snapshotLimit));
  }, [settings.snapshotLimit]);

  const commitSnapshotLimit = () => {
    const parsed = Number.parseInt(snapshotLimitInput, 10);
    if (!Number.isFinite(parsed)) {
      setSnapshotLimitInput(String(settings.snapshotLimit));
      return;
    }
    const next = Math.max(1, Math.min(1000, Math.round(parsed)));
    setSnapshotLimitInput(String(next));
    if (next === settings.snapshotLimit) return;
    if (next > settings.snapshotLimit) {
      Alert.alert(
        '提高快照保留数量',
        `将保留最近 ${next} 次快照（当前 ${settings.snapshotLimit} 次）。快照只保存在本机，数量越多占用的存储空间越大，确定继续？`,
        [
          { text: '取消', style: 'cancel' },
          { text: '确定', onPress: () => void updateSettings({ snapshotLimit: next }) },
        ],
      );
    } else {
      Alert.alert(
        '降低快照保留数量',
        `将只保留最近 ${next} 次快照，超出的旧快照会在下次同步成绩时自动裁剪。`,
        [
          { text: '取消', style: 'cancel' },
          { text: '确定', onPress: () => void updateSettings({ snapshotLimit: next }) },
        ],
      );
    }
  };

  const exportCsv = async (mode: 'share' | 'save') => {
    if (working) return;
    setWorking(true);
    try {
      const { rowCount, savedTo } = await exportScoresCsv(mode);
      if (rowCount === 0) {
        setTokenMessage('没有已导入的成绩可导出');
      } else if (mode === 'save') {
        setTokenMessage(`已保存 ${rowCount} 条成绩到所选目录`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CSV 导出失败';
      setTokenMessage(message === 'SAF_SAVE_CANCELLED' ? '已取消保存' : message);
    } finally {
      setWorking(false);
    }
  };

  useEffect(() => {
    if (tokenConfigured) setTokenInput('');
  }, [tokenConfigured]);

  const handleVerify = async () => {
    if (!tokenInput.trim()) {
      setTokenMessage('请粘贴 Token 或完整 Shadowrocket 链接');
      return;
    }
    setWorking(true);
    setTokenMessage(null);
    try {
      await verifyAndSaveToken(tokenInput);
      setTokenInput('');
      setTokenMessage('Token 验证成功，已安全保存到设备');
    } catch (error) {
      setTokenMessage(error instanceof Error ? error.message : 'Token 验证失败');
    } finally {
      setWorking(false);
    }
  };

  const handleClearToken = () => {
    Alert.alert('删除成绩 Token', '删除后不会影响 Diving-Fish 账户，只会停止 MaiMate 的成绩读取。', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: async () => {
        await clearToken();
        setTokenMessage('Token 已从本机删除');
      } },
    ]);
  };

  const handleClearScores = () => {
    Alert.alert('清除本地成绩', '只删除 MaiMate 本机保存的成绩，不会修改 Diving-Fish 账户。', [
      { text: '取消', style: 'cancel' },
      { text: '清除', style: 'destructive', onPress: async () => {
        await clearScores();
        setTokenMessage('本地成绩已清除');
      } },
    ]);
  };

  const handleReset = () => {
    Alert.alert('恢复默认设置', '显示偏好会恢复为默认值，计划和成绩不会受到影响。', [
      { text: '取消', style: 'cancel' },
      { text: '恢复', style: 'destructive', onPress: () => void resetSettings() },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>⚙️ 个人设置</Text>
      <Text style={styles.subtitle}>偏好设置只保存在本机；成绩 Token 使用系统安全存储。</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>显示偏好</Text>
        <SettingRow title="显示国区版本名" description="同时保留并显示 Diving-Fish 原始版本名" value={settings.showChinaVersion} onChange={value => void updateSettings({ showChinaVersion: value })} />
        <SettingRow title="显示目标 Rating" description="在推分计划中显示按官方定数计算的目标值" value={settings.showProjectedRating} onChange={value => void updateSettings({ showProjectedRating: value })} />
        <Pressable style={styles.preferenceRow} onPress={() => router.push('/settings/music-platform' as any)}>
          <View style={styles.preferenceText}>
            <Text style={styles.preferenceTitle}>默认音乐平台</Text>
            <Text style={styles.preferenceDescription}>歌曲详情页的音乐搜索默认打开平台</Text>
          </View>
          <Text style={styles.valueButtonText}>{MUSIC_PLATFORM_OPTIONS.find(option => option.value === settings.defaultMusicPlatform)?.label || '网易云音乐'}　›</Text>
        </Pressable>
        <Pressable style={styles.preferenceRow} onPress={() => router.push('/settings/sort' as any)}>
          <View style={styles.preferenceText}>
            <Text style={styles.preferenceTitle}>默认排序</Text>
            <Text style={styles.preferenceDescription}>曲库打开后可在筛选栏中临时切换</Text>
          </View>
          <Text style={styles.valueButtonText}>{getSortLabel(settings.defaultSort.mode)}　›</Text>
        </Pressable>
        <Pressable style={styles.preferenceRow} onPress={() => router.push('/settings/detail-boards' as any)}>
          <View style={styles.preferenceText}>
            <Text style={styles.preferenceTitle}>详情页板块</Text>
            <Text style={styles.preferenceDescription}>调整歌曲详情页板块顺序与默认折叠状态</Text>
          </View>
          <Text style={styles.valueButtonText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Diving-Fish 成绩导入</Text>
        <TextInput
          style={styles.tokenInput}
          value={tokenInput}
          onChangeText={setTokenInput}
          placeholder={tokenConfigured ? '已配置 Token；粘贴新 Token 可替换' : '粘贴 Token 或 Shadowrocket 链接'}
          placeholderTextColor={Colors.text.muted}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
        <Pressable style={[styles.primaryButton, working && styles.disabled]} disabled={working} onPress={() => void handleVerify()}>
          <Text style={styles.primaryButtonText}>{working ? '验证中…' : tokenConfigured ? '验证并替换 Token' : '验证并保存 Token'}</Text>
        </Pressable>
        {tokenConfigured && <Text style={styles.configuredText}>状态：已配置（Token 内容已隐藏）</Text>}
        {!!tokenMessage && <Text style={styles.messageText}>{tokenMessage}</Text>}
        <View style={styles.buttonRow}>
          <Pressable style={styles.secondaryButton} onPress={() => void syncScores()}>
            <Text style={styles.secondaryButtonText}>立即同步成绩</Text>
          </Pressable>
          <Pressable style={styles.dangerButton} onPress={handleClearToken}>
            <Text style={styles.dangerButtonText}>删除 Token</Text>
          </Pressable>
        </View>
        <View style={styles.snapshotLimitRow}>
          <View style={styles.preferenceText}>
            <Text style={styles.preferenceTitle}>快照保留数量</Text>
            <Text style={styles.preferenceDescription}>1–1000 次；数量越多占用本机存储越多</Text>
          </View>
          <TextInput
            style={styles.snapshotLimitInput}
            value={snapshotLimitInput}
            onChangeText={setSnapshotLimitInput}
            onBlur={commitSnapshotLimit}
            onSubmitEditing={commitSnapshotLimit}
            keyboardType="number-pad"
            maxLength={4}
          />
        </View>
        <Pressable style={styles.snapshotLimitRow} onPress={() => void updateSettings({ autoSinkAchieved: !settings.autoSinkAchieved })}>
          <View style={styles.preferenceText}>
            <Text style={styles.preferenceTitle}>新达标自动沉底</Text>
            <Text style={styles.preferenceDescription}>同步成绩后自动把新达标的曲目移到推分计划最下侧</Text>
          </View>
          <Text style={[styles.valueButtonText, { color: settings.autoSinkAchieved ? Colors.functional.success : Colors.text.muted }]}>
            {settings.autoSinkAchieved ? '开' : '关'}
            </Text>
        </Pressable>
        <View style={styles.syncCard}>
          <Text style={styles.syncTitle}>同步状态：{getSyncLabel(sync.status)}</Text>
          <Text style={styles.syncText}>本地记录：{sync.recordCount} 条</Text>
          <Text style={styles.syncText}>Diving-Fish Rating：{sync.serverRating ?? '—'}</Text>
           <Text style={styles.syncText}>本次变化：{sync.changedCount} 条（不是游玩次数）</Text>
           <Text style={styles.syncText}>本地快照：{snapshots.length} 次（最多保留最近 {settings.snapshotLimit} 次）</Text>
          <Text style={styles.syncText}>上次同步：{sync.lastSyncedAt ? new Date(sync.lastSyncedAt).toLocaleString() : '尚未同步'}</Text>
          {!!sync.message && <Text style={styles.messageText}>{sync.message}</Text>}
        </View>
        {changes.length > 0 && (
           <View style={styles.syncCard}>
             <Text style={styles.syncTitle}>最近成绩变化</Text>
             {changes.slice(0, 5).map(change => (
               <Text key={`${change.chartKey}-${change.changedAt}`} style={styles.syncText}>
                 {change.chartKey}：{change.current ? `${change.current.achievement.toFixed(4)}%` : '当前记录已消失'}
               </Text>
             ))}
           </View>
         )}
         <Pressable style={styles.secondaryButton} onPress={handleClearScores}>
          <Text style={styles.secondaryButtonText}>清除本地成绩</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>数据与隐私</Text>
        <Text style={styles.securityNote}>曲库、推分计划和已导入成绩默认保存在本机。删除 Token 不会删除成绩；清除本地成绩不会影响服务器。</Text>
        {/* v1.16.6：存储占用分析（曲绘 size 用新 File API 统计）。 */}
        <View style={styles.storageCard}>
          <Text style={styles.storageTitle}>存储占用</Text>
          {storageUsage === null ? (
            <Text style={styles.storageValue}>正在计算…</Text>
          ) : (
            <>
              <View style={styles.storageRow}>
                <View style={styles.storageText}>
                  <Text style={styles.storageName}>应用本体</Text>
                  <Text style={styles.storageValue}>APK 约 59.4 MB；系统显示 ~120 MB 为安装后解压体积，不可清理</Text>
                </View>
              </View>
              <View style={styles.storageRow}>
                <View style={styles.storageText}>
                  <Text style={styles.storageName}>成绩与计划数据</Text>
                  <Text style={styles.storageValue}>{formatBytes(storageUsage.dataBytes)}</Text>
                </View>
                <Pressable style={styles.storageClearBtn} onPress={handleClearScores}>
                  <Text style={styles.storageClearText}>清理</Text>
                </Pressable>
              </View>
              <View style={styles.storageRow}>
                <View style={styles.storageText}>
                  <Text style={styles.storageName}>曲绘缓存</Text>
                  <Text style={styles.storageValue}>{formatBytes(storageUsage.coverBytes)} · {storageUsage.coverCount} 张</Text>
                </View>
                <Pressable style={styles.storageClearBtn} onPress={() => void handleClearCovers()}>
                  <Text style={styles.storageClearText}>清理</Text>
                </Pressable>
              </View>
              <View style={styles.storageRow}>
                <View style={styles.storageText}>
                  <Text style={styles.storageName}>其它缓存（旧版残留等）</Text>
                  <Text style={styles.storageValue}>{formatBytes(storageUsage.otherBytes)}</Text>
                </View>
                <Pressable style={styles.storageClearBtn} onPress={() => void handleClearOtherCache()}>
                  <Text style={styles.storageClearText}>清理</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
        <Pressable style={styles.preferenceRow} onPress={() => router.push('/settings/data-backup' as any)}>
          <View style={styles.preferenceText}>
            <Text style={styles.preferenceTitle}>数据备份与恢复</Text>
            <Text style={styles.preferenceDescription}>导出完整备份或从 JSON 文件恢复本机数据</Text>
          </View>
          <Text style={styles.valueButtonText}>›</Text>
        </Pressable>
        <View style={styles.preferenceRow}>
          <View style={styles.preferenceText}>
            <Text style={styles.preferenceTitle}>导出成绩 CSV</Text>
            <Text style={styles.preferenceDescription}>把已导入的成绩导出为 CSV 文件，方便在电脑上分析</Text>
            <View style={styles.exportButtonRow}>
              <Pressable style={[styles.exportButton, working && styles.disabled]} disabled={working} onPress={() => void exportCsv('save')}>
                <Text style={styles.exportButtonText}>仅保存…</Text>
              </Pressable>
              <Pressable style={[styles.exportButton, working && styles.disabled]} disabled={working} onPress={() => void exportCsv('share')}>
                <Text style={styles.exportButtonText}>保存并分享</Text>
              </Pressable>
            </View>
          </View>
        </View>
        <Pressable style={styles.preferenceRow} onPress={() => router.push('/settings/update' as any)}>
          <View style={styles.preferenceText}>
            <Text style={styles.preferenceTitle}>检查更新</Text>
            <Text style={styles.preferenceDescription}>检查并下载最新版本 MaiMate APK</Text>
          </View>
          <Text style={styles.valueButtonText}>›</Text>
        </Pressable>
        <Pressable style={styles.resetButton} onPress={handleReset}>
          <Text style={styles.resetButtonText}>恢复默认显示设置</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function SettingRow({ title, description, value, onChange }: { title: string; description: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.preferenceRow}>
      <View style={styles.preferenceText}>
        <Text style={styles.preferenceTitle}>{title}</Text>
        <Text style={styles.preferenceDescription}>{description}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: Colors.bg.tertiary, true: Colors.accent.primary }} thumbColor={Colors.text.primary} />
    </View>
  );
}

function getSyncLabel(status: 'idle' | 'syncing' | 'success' | 'invalid' | 'error'): string {
  return ({ idle: '未同步', syncing: '同步中', success: '成功', invalid: 'Token 无效', error: '失败' })[status];
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: 16, paddingTop: 48, paddingBottom: 90, gap: 12 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text.primary },
  subtitle: { fontSize: 12, color: Colors.text.muted },
  section: { padding: 14, borderRadius: 16, backgroundColor: Colors.bg.secondary, gap: 10 },
  exportButtonRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  exportButton: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    backgroundColor: Colors.bg.tertiary, borderWidth: 1, borderColor: Colors.border.medium,
  },
  exportButtonText: { fontSize: 11.5, fontWeight: '800', color: Colors.accent.secondary },
  storageCard: {
    marginTop: 10, borderRadius: 12, borderWidth: 1, borderColor: Colors.border.light,
    backgroundColor: Colors.bg.secondary, padding: 12, gap: 10,
  },
  storageTitle: { fontSize: 13, fontWeight: '900', color: Colors.text.primary },
  storageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  storageText: { flex: 1 },
  storageName: { fontSize: 12.5, fontWeight: '800', color: Colors.text.primary },
  storageValue: { fontSize: 11, color: Colors.text.muted, marginTop: 1 },
  storageClearBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: Colors.bg.tertiary, borderWidth: 1, borderColor: Colors.border.medium,
  },
  storageClearText: { fontSize: 11.5, fontWeight: '800', color: Colors.functional.danger },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.text.primary },
  preferenceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 4 },
  toolButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 10, borderRadius: 10, backgroundColor: Colors.bg.tertiary },
  preferenceText: { flex: 1, gap: 2 },
  preferenceTitle: { fontSize: 13, fontWeight: '700', color: Colors.text.primary },
  preferenceDescription: { fontSize: 11, lineHeight: 16, color: Colors.text.muted },
  valueButton: { maxWidth: 150, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.bg.tertiary },
  valueButtonText: { fontSize: 11, color: Colors.accent.secondary, fontWeight: '700' },
  securityNote: { fontSize: 11, lineHeight: 17, color: Colors.text.muted },
  tokenInput: { minHeight: 46, paddingHorizontal: 12, borderRadius: 10, backgroundColor: Colors.bg.tertiary, color: Colors.text.primary, borderWidth: 1, borderColor: Colors.border.light },
  primaryButton: { alignItems: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.accent.primary },
  primaryButtonText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  configuredText: { fontSize: 11, color: Colors.functional.success },
  messageText: { fontSize: 11, lineHeight: 16, color: Colors.functional.warning },
  buttonRow: { flexDirection: 'row', gap: 8 },
  snapshotLimitRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  snapshotLimitInput: {
    width: 72, minHeight: 40, paddingHorizontal: 10, borderRadius: 9,
    backgroundColor: Colors.bg.tertiary, color: Colors.text.primary,
    borderWidth: 1, borderColor: Colors.border.light, textAlign: 'center', fontSize: 13, fontWeight: '800',
  },
  secondaryButton: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 10, backgroundColor: Colors.bg.tertiary, borderWidth: 1, borderColor: Colors.border.medium },
  secondaryButtonText: { fontSize: 12, fontWeight: '700', color: Colors.accent.secondary },
  dangerButton: { alignItems: 'center', paddingHorizontal: 14, justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: `${Colors.functional.danger}66` },
  dangerButtonText: { fontSize: 12, fontWeight: '700', color: Colors.functional.danger },
  syncCard: { padding: 10, borderRadius: 10, backgroundColor: Colors.bg.tertiary, gap: 3 },
  syncTitle: { fontSize: 12, fontWeight: '800', color: Colors.text.primary },
  syncText: { fontSize: 11, color: Colors.text.secondary },
  resetButton: { alignItems: 'center', paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: Colors.border.medium },
  resetButtonText: { fontSize: 12, color: Colors.text.secondary, fontWeight: '700' },
});
