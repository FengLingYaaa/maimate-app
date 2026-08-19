import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Colors, DifficultyColorMap, DifficultyLabels } from '../src/constants';
import { useMusicStore, useScoreStore } from '../src/store';
import { buildPlateEntries, filterPlateEntries, getPlateChinaVersionOptions, getPlateVersionOptions, PLATE_BITS, summarizePlates, type PlateBit, type PlateEntry } from '../src/data/plates';

const PLATE_LABELS: Array<{ name: PlateBit; label: string; color: string }> = [
  { name: 'FC', label: 'FC', color: Colors.functional.success },
  { name: 'SSS', label: 'SSS', color: Colors.accent.secondary },
  { name: 'FSD', label: 'FS DX', color: '#c084fc' },
  { name: 'AP', label: 'AP', color: '#fb923c' },
];

export default function PlatesPage() {
  const router = useRouter();
  const rawData = useMusicStore(s => s.rawData);
  const scores = useScoreStore(s => s.scores);
  const [version, setVersion] = useState('全部');
  const [chinaVersion, setChinaVersion] = useState<string | undefined>();
  const [difficultyIndex, setDifficultyIndex] = useState<number | undefined>(3);
  const entries = useMemo(() => buildPlateEntries(rawData, scores), [rawData, scores]);
  const versionOptions = useMemo(() => getPlateVersionOptions(entries), [entries]);
  const chinaOptions = useMemo(() => getPlateChinaVersionOptions(entries), [entries]);
  const filtered = useMemo(() => filterPlateEntries(entries, version, difficultyIndex, chinaVersion), [entries, version, difficultyIndex, chinaVersion]);
  const summary = useMemo(() => summarizePlates(filtered), [filtered]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: '牌子查询', headerStyle: { backgroundColor: Colors.bg.primary }, headerTintColor: Colors.text.primary }} />
      <View style={styles.header}>
        <Text style={styles.title}>🏅 本地牌子查询</Text>
        <Text style={styles.subtitle}>根据本机已导入成绩计算，不会上传成绩，也不是逐局游玩历史。</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {versionOptions.map(option => <FilterChip key={option} label={option} active={version === option} onPress={() => setVersion(option)} />)}
      </ScrollView>
      {chinaOptions.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <FilterChip label="全部国区" active={!chinaVersion} onPress={() => setChinaVersion(undefined)} />
          {chinaOptions.map(option => <FilterChip key={option} label={option} active={chinaVersion === option} onPress={() => setChinaVersion(option)} />)}
        </ScrollView>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <FilterChip label="全部难度" active={difficultyIndex === undefined} onPress={() => setDifficultyIndex(undefined)} />
        {DifficultyLabels.map((label, index) => <FilterChip key={label} label={label} active={difficultyIndex === index} onPress={() => setDifficultyIndex(index)} color={DifficultyColorMap[index]} />)}
      </ScrollView>
      <View style={styles.summaryCard}>
        {PLATE_LABELS.map(item => <View key={item.name} style={styles.summaryItem}><Text style={[styles.summaryLabel, { color: item.color }]}>{item.label}</Text><Text style={styles.summaryValue}>{summary.counts[item.name]} / {summary.total}</Text></View>)}
      </View>
      {scores.length === 0 ? (
        <View style={styles.empty}><Text style={styles.emptyTitle}>暂无本地成绩</Text><Text style={styles.emptyText}>请先在设置中导入成绩，再查询 FC、SSS、FS DX 和 AP 牌子。</Text></View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}><Text style={styles.emptyTitle}>没有可查询的谱面</Text><Text style={styles.emptyText}>当前筛选条件没有匹配曲目。</Text></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.key}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <PlateRow entry={item} onPress={() => router.push({ pathname: '/song/[id]' as any, params: { id: item.music.id, type: item.music.type, difficultyIndex: String(item.difficultyIndex), source: 'plates' } })} />}
        />
      )}
    </View>
  );
}

function FilterChip({ label, active, onPress, color }: { label: string; active: boolean; onPress: () => void; color?: string }) {
  return <Pressable style={[styles.chip, active && { borderColor: color || Colors.accent.primary, backgroundColor: `${color || Colors.accent.primary}22` }]} onPress={onPress}><Text style={[styles.chipText, active && { color: color || Colors.accent.primary }]}>{label}</Text></Pressable>;
}

function PlateRow({ entry, onPress }: { entry: PlateEntry; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={onPress}>
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle} numberOfLines={1}>{entry.music.title}</Text>
        <Text style={styles.rowMeta}>{DifficultyLabels[entry.difficultyIndex]} · {entry.music.type} · {entry.rawVersion}</Text>
      </View>
      <View style={styles.plateIcons}>
        {PLATE_LABELS.map(item => <Text key={item.name} style={[styles.plateIcon, { color: (entry.mask & PLATE_BITS[item.name]) !== 0 ? item.color : Colors.text.muted }]}>{(entry.mask & PLATE_BITS[item.name]) !== 0 ? '✓' : '○'}</Text>)}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  header: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8, gap: 4 },
  title: { fontSize: 23, fontWeight: '800', color: Colors.text.primary },
  subtitle: { fontSize: 11, lineHeight: 16, color: Colors.text.muted },
  chips: { gap: 7, paddingHorizontal: 12, paddingVertical: 5 },
  chip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, borderWidth: 1, borderColor: Colors.border.light, backgroundColor: Colors.bg.secondary },
  chipText: { fontSize: 10, color: Colors.text.secondary, fontWeight: '700' },
  summaryCard: { flexDirection: 'row', justifyContent: 'space-around', margin: 12, padding: 12, borderRadius: 12, backgroundColor: Colors.bg.secondary, borderWidth: 1, borderColor: Colors.border.light },
  summaryItem: { alignItems: 'center', gap: 3 },
  summaryLabel: { fontSize: 11, fontWeight: '800' },
  summaryValue: { fontSize: 12, color: Colors.text.primary, fontWeight: '700' },
  list: { paddingHorizontal: 12, paddingBottom: 80, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 11, borderRadius: 11, backgroundColor: Colors.bg.secondary, borderWidth: 1, borderColor: Colors.border.light, gap: 8 },
  rowPressed: { backgroundColor: Colors.bg.tertiary, borderColor: Colors.border.accent },
  rowInfo: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 13, fontWeight: '700', color: Colors.text.primary },
  rowMeta: { fontSize: 10, color: Colors.text.muted },
  plateIcons: { flexDirection: 'row', gap: 6 },
  plateIcon: { fontSize: 17, fontWeight: '900' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 7, paddingBottom: 80 },
  emptyTitle: { fontSize: 16, color: Colors.text.primary, fontWeight: '700' },
  emptyText: { fontSize: 12, color: Colors.text.muted },
});
