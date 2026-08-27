import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Colors } from '../../../src/constants';
import { exportBackupToShare, pickAndValidateBackup, restoreBackup } from '../../../src/data/backup-io';
import type { BackupSummary } from '../../../src/data/backup';

type PendingRestore = { backup: Parameters<typeof restoreBackup>[0]; summary: BackupSummary; fileName: string };

export default function DataBackupScreen() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<'info' | 'success' | 'error'>('info');
  const [pending, setPending] = useState<PendingRestore | null>(null);

  const show = (kind: 'info' | 'success' | 'error', text: string) => {
    setMessageKind(kind);
    setMessage(text);
  };

  const handleExport = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const { fileName, summary } = await exportBackupToShare();
      show('success', `已导出 ${fileName}\n计划 ${summary.planEntries} 条 · 成绩 ${summary.scores} 条 · 快照 ${summary.snapshots} 次 · 链接 ${summary.bilibiliLinks} 条`);
    } catch (error) {
      show('error', error instanceof Error ? error.message : '导出失败');
    } finally {
      setBusy(false);
    }
  };

  const handlePick = async () => {
    setBusy(true);
    setMessage(null);
    setPending(null);
    try {
      const result = await pickAndValidateBackup();
      setPending({ backup: result.backup, summary: result.summary, fileName: result.fileName });
      show('info', `已读取 ${result.fileName}\n计划 ${result.summary.planEntries} 条 · 成绩 ${result.summary.scores} 条 · 快照 ${result.summary.snapshots} 次 · 链接 ${result.summary.bilibiliLinks} 条\n确认后现有本地数据将被完整替换。`);
    } catch (error) {
      show('error', error instanceof Error ? error.message : '读取备份失败');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmRestore = () => {
    if (!pending) return;
    Alert.alert(
      '恢复备份',
      `将用「${pending.fileName}」完整替换本机数据（计划、成绩、快照、B 站链接、设置与运势种子）。\nDiving-Fish Token 不会被覆盖或删除。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认恢复',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await restoreBackup(pending.backup);
              setPending(null);
              show('success', '恢复完成，本机数据已更新');
            } catch (error) {
              show('error', error instanceof Error ? error.message : '恢复失败');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: '数据备份', headerStyle: { backgroundColor: Colors.bg.primary }, headerTintColor: Colors.text.primary }} />
      <Text style={styles.title}>📦 数据备份与恢复</Text>
      <Text style={styles.hint}>备份包含推分计划、已导入成绩与快照、B 站收藏链接、偏好设置和运势种子，导出为明文 JSON 文件。请妥善保管，成绩与备注属于个人隐私。</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>导出</Text>
        <Pressable style={[styles.primaryButton, busy && styles.disabled]} disabled={busy} onPress={() => void handleExport()}>
          <Text style={styles.primaryButtonText}>{busy ? '处理中…' : '导出完整备份'}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>恢复</Text>
        <Pressable style={[styles.secondaryButton, busy && styles.disabled]} disabled={busy} onPress={() => void handlePick()}>
          <Text style={styles.secondaryButtonText}>选择备份文件</Text>
        </Pressable>
        {pending && (
          <Pressable style={[styles.dangerButton, busy && styles.disabled]} disabled={busy} onPress={handleConfirmRestore}>
            <Text style={styles.dangerButtonText}>确认恢复（替换本机数据）</Text>
          </Pressable>
        )}
      </View>

      {message && <Text style={[styles.message, messageKind === 'error' && styles.messageError, messageKind === 'success' && styles.messageSuccess]}>{message}</Text>}

      <Text style={styles.securityNote}>🔒 Diving-Fish 成绩 Token 保存在系统安全存储中，不会写入备份，恢复后保留本机现有 Token；曲库与封面缓存可联网重建，也不包含在备份内。</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: 16, paddingTop: 22, paddingBottom: 90, gap: 12 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text.primary },
  hint: { fontSize: 12, lineHeight: 18, color: Colors.text.muted },
  card: { padding: 14, borderRadius: 14, backgroundColor: Colors.bg.secondary, gap: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: Colors.text.primary },
  primaryButton: { alignItems: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.accent.primary },
  primaryButtonText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  secondaryButton: { alignItems: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.bg.tertiary, borderWidth: 1, borderColor: Colors.border.medium },
  secondaryButtonText: { fontSize: 13, fontWeight: '700', color: Colors.accent.secondary },
  dangerButton: { alignItems: 'center', paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: `${Colors.functional.danger}66` },
  dangerButtonText: { fontSize: 13, fontWeight: '800', color: Colors.functional.danger },
  disabled: { opacity: 0.5 },
  message: { fontSize: 12, lineHeight: 18, color: Colors.text.secondary, padding: 10, borderRadius: 10, backgroundColor: Colors.bg.secondary },
  messageError: { color: Colors.functional.danger },
  messageSuccess: { color: Colors.functional.success },
  securityNote: { fontSize: 11, lineHeight: 17, color: Colors.text.muted },
});
