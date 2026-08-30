/**
 * 导出成绩 CSV（v1.16.7）：独立次级页面，与数据备份页同款骨架。
 * 「仅保存」走 SAF 目录选择器；「保存并分享」走系统分享面板。
 */

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Colors } from '../../../src/constants';
import { exportScoresCsv } from '../../../src/data/scores-csv';
import { useScoreStore } from '../../../src/store';

export default function ExportCsvScreen() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<'info' | 'success' | 'error'>('info');
  const scores = useScoreStore(s => s.scores);

  const show = (kind: 'info' | 'success' | 'error', text: string) => {
    setMessageKind(kind);
    setMessage(text);
  };

  const handleExport = async (mode: 'share' | 'save') => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const { rowCount } = await exportScoresCsv(mode);
      if (rowCount === 0) {
        show('info', '没有已导入的成绩可导出');
      } else if (mode === 'save') {
        show('success', `已保存 ${rowCount} 条成绩到所选目录`);
      } else {
        show('success', `已导出 ${rowCount} 条成绩，可在分享面板选择保存位置`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CSV 导出失败';
      show('error', message === 'SAF_SAVE_CANCELLED' ? '已取消保存' : message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: '导出成绩 CSV', headerStyle: { backgroundColor: Colors.bg.primary }, headerTintColor: Colors.text.primary }} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>导出</Text>
          <Text style={styles.note}>
            把已导入的成绩导出为 CSV 文件（songId、曲名、难度、定数、达成率、DX 分、RA 等列），方便在电脑上用表格软件分析。
            当前已导入 {scores.length} 条成绩。
          </Text>
          <View style={styles.buttonRow}>
            <Pressable style={[styles.primaryButton, busy && styles.disabled]} disabled={busy} onPress={() => void handleExport('save')}>
              <Text style={styles.primaryButtonText}>仅保存</Text>
            </Pressable>
            <Pressable style={[styles.primaryButton, busy && styles.disabled]} disabled={busy} onPress={() => void handleExport('share')}>
              <Text style={styles.primaryButtonText}>保存并分享</Text>
            </Pressable>
          </View>
          {message && (
            <Text style={[styles.message, messageKind === 'success' && styles.messageSuccess, messageKind === 'error' && styles.messageError]}>
              {message}
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>说明</Text>
          <Text style={styles.note}>
            · 「仅保存」会打开系统目录选择器，选择后文件直接写入该目录，每次都需要重新选择。
            {'\n'}· 「保存并分享」生成临时文件并拉起系统分享面板，可发送或另存。
            {'\n'}· 导出只读取本机成绩，不会修改 Diving-Fish 账户数据。
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.primary },
  body: { padding: 14, gap: 12 },
  card: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.text.primary },
  note: { fontSize: 11.5, lineHeight: 18, color: Colors.text.muted },
  buttonRow: { flexDirection: 'row', gap: 8 },
  primaryButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: Colors.accent.primary,
  },
  primaryButtonText: { fontSize: 13, fontWeight: '900', color: '#fff' },
  message: { fontSize: 11.5, lineHeight: 17 },
  messageSuccess: { color: Colors.functional.success },
  messageError: { color: Colors.functional.danger },
  disabled: { opacity: 0.5 },
});
