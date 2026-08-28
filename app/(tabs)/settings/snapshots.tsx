/**
 * 快照管理（v1.13.0）：查看本地保存的最多 6 次成绩快照并支持删除。
 * 快照 = 一次成功同步时的完整成绩副本，用于对照成绩变化。
 */

import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Colors } from '../../../src/constants';
import { useScoreStore } from '../../../src/store';

export default function SnapshotsPage() {
  const snapshots = useScoreStore(state => state.snapshots);
  const deleteSnapshot = useScoreStore(state => state.deleteSnapshot);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const confirmDelete = (snapshotId: string, syncedAt: number) => {
    Alert.alert(
      '删除快照',
      `删除 ${new Date(syncedAt).toLocaleString()} 的快照？只影响本机对照记录，不影响成绩与服务器。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            setDeletingId(snapshotId);
            void deleteSnapshot(snapshotId).finally(() => setDeletingId(null));
          },
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: '快照管理', headerStyle: { backgroundColor: Colors.bg.primary }, headerTintColor: Colors.text.primary }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.note}>
          每次成功同步成绩都会保存一份快照（最多保留最近 6 次），可在删除Token 或误操作后用于对照。删除快照不会影响本机成绩。
        </Text>
        {snapshots.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>还没有快照。去「设置 → Diving-Fish 成绩导入」同步一次成绩即可生成。</Text>
          </View>
        ) : (
          [...snapshots].reverse().map(snapshot => (
            <View key={snapshot.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.syncedAt}>{new Date(snapshot.syncedAt).toLocaleString()}</Text>
                <Pressable
                  hitSlop={8}
                  disabled={deletingId === snapshot.id}
                  onPress={() => confirmDelete(snapshot.id, snapshot.syncedAt)}
                >
                  <Text style={styles.deleteText}>{deletingId === snapshot.id ? '删除中…' : '删除'}</Text>
                </Pressable>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>记录 {snapshot.recordCount} 条</Text>
                <Text style={styles.meta}>服务器 RA {snapshot.serverRating ?? '—'}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: 14, gap: 10 },
  note: { fontSize: 11, lineHeight: 17, color: Colors.text.muted },
  emptyCard: { backgroundColor: Colors.bg.secondary, borderRadius: 12, padding: 16 },
  emptyText: { fontSize: 12, lineHeight: 18, color: Colors.text.secondary },
  card: { backgroundColor: Colors.bg.secondary, borderRadius: 12, padding: 12, gap: 6 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  syncedAt: { fontSize: 13, fontWeight: '800', color: Colors.text.primary },
  deleteText: { fontSize: 11, fontWeight: '700', color: Colors.functional.danger },
  metaRow: { flexDirection: 'row', gap: 14 },
  meta: { fontSize: 11, color: Colors.text.muted },
});
