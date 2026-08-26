import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Colors } from '../../../src/constants';
import type { DetailBoardConfig, DetailBoardId } from '../../../src/data/types';
import { DETAIL_BOARD_LABELS, useSettingsStore } from '../../../src/store';

export default function DetailBoardsSettings() {
  const detailBoards = useSettingsStore(s => s.settings.detailBoards);
  const updateSettings = useSettingsStore(s => s.updateSettings);

  const orderedIds = useMemo(
    () => (Object.keys(detailBoards) as DetailBoardId[]).sort((a, b) => detailBoards[a].order - detailBoards[b].order),
    [detailBoards],
  );

  const move = (id: DetailBoardId, direction: -1 | 1) => {
    const ids = [...orderedIds];
    const index = ids.indexOf(id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    const next = {} as Record<DetailBoardId, DetailBoardConfig>;
    ids.forEach((boardId, orderIndex) => {
      next[boardId] = { ...detailBoards[boardId], order: orderIndex };
    });
    void updateSettings({ detailBoards: next });
  };

  const toggleCollapsed = (id: DetailBoardId) => {
    const next = { ...detailBoards, [id]: { ...detailBoards[id], collapsed: !detailBoards[id].collapsed } };
    void updateSettings({ detailBoards: next });
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: '详情页板块', headerStyle: { backgroundColor: Colors.bg.primary }, headerTintColor: Colors.text.primary }} />
      <Text style={styles.hint}>控制歌曲详情页各板块的上下顺序与默认展开/折叠。折叠只影响打开详情页时的初始状态，点标题仍可随时展开。</Text>

      <View style={styles.card}>
        {orderedIds.map((id, index) => (
          <View key={id} style={[styles.row, index === orderedIds.length - 1 && styles.rowLast]}>
            <View style={styles.orderButtons}>
              <Pressable style={[styles.arrowBtn, index === 0 && styles.arrowBtnDisabled]} disabled={index === 0} onPress={() => move(id, -1)}>
                <Text style={styles.arrowText}>↑</Text>
              </Pressable>
              <Pressable style={[styles.arrowBtn, index === orderedIds.length - 1 && styles.arrowBtnDisabled]} disabled={index === orderedIds.length - 1} onPress={() => move(id, 1)}>
                <Text style={styles.arrowText}>↓</Text>
              </Pressable>
            </View>
            <View style={styles.labelBox}>
              <Text style={styles.label}>{DETAIL_BOARD_LABELS[id]}</Text>
              <Text style={styles.subLabel}>{detailBoards[id].collapsed ? '默认折叠' : '默认展开'}</Text>
            </View>
            <Switch
              value={!detailBoards[id].collapsed}
              onValueChange={() => toggleCollapsed(id)}
              trackColor={{ true: `${Colors.accent.primary}88`, false: Colors.bg.tertiary }}
              thumbColor={!detailBoards[id].collapsed ? Colors.accent.primary : Colors.text.muted}
            />
          </View>
        ))}
      </View>

      <Text style={styles.footNote}>默认折叠的两个板块（Rating 预估、完成率损失）在收起时仍会显示一行关键摘要。</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 22, backgroundColor: Colors.bg.primary, gap: 12 },
  hint: { fontSize: 12, lineHeight: 18, color: Colors.text.muted },
  card: { borderRadius: 14, overflow: 'hidden', backgroundColor: Colors.bg.secondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  rowLast: { borderBottomWidth: 0 },
  orderButtons: { flexDirection: 'row', gap: 6 },
  arrowBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: Colors.bg.tertiary },
  arrowBtnDisabled: { opacity: 0.3 },
  arrowText: { fontSize: 16, fontWeight: '800', color: Colors.accent.secondary },
  labelBox: { flex: 1, gap: 2 },
  label: { fontSize: 14, fontWeight: '700', color: Colors.text.primary },
  subLabel: { fontSize: 11, color: Colors.text.muted },
  footNote: { fontSize: 10, lineHeight: 15, color: Colors.text.muted },
});
