import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Colors, DifficultyColorMap, DifficultyLabels } from '../../../src/constants';
import { SORT_OPTIONS } from '../../../src/data/settings-options';
import { useSettingsStore } from '../../../src/store';

export default function SortSettings() {
  const router = useRouter();
  const current = useSettingsStore(s => s.settings.defaultSort);
  const updateSettings = useSettingsStore(s => s.updateSettings);
  const isConstant = current.mode === 'constantAsc' || current.mode === 'constantDesc';

  const chooseMode = (mode: typeof current.mode) => {
    void updateSettings({
      defaultSort: mode === 'constantAsc' || mode === 'constantDesc'
        ? { mode, difficultyIndex: current.difficultyIndex ?? 3 }
        : { mode },
    });
    if (!((mode === 'constantAsc' || mode === 'constantDesc') && !isConstant)) router.back();
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: '默认排序', headerStyle: { backgroundColor: Colors.bg.primary }, headerTintColor: Colors.text.primary }} />
      <Text style={styles.hint}>曲库首次打开时使用此排序；筛选栏仍可临时切换。</Text>
      <View style={styles.card}>
        {SORT_OPTIONS.map(option => (
          <Pressable key={option.mode} style={styles.row} onPress={() => chooseMode(option.mode)}>
            <Text style={styles.label}>{option.label}</Text>
            <Text style={[styles.radio, current.mode === option.mode && styles.radioActive]}>{current.mode === option.mode ? '●' : '○'}</Text>
          </Pressable>
        ))}
      </View>
      {isConstant && (
        <View style={styles.card}>
          <Text style={styles.subTitle}>定数排序难度</Text>
          <View style={styles.chips}>
            {DifficultyLabels.map((label, index) => (
              <Pressable key={label} style={[styles.chip, current.difficultyIndex === index && { borderColor: DifficultyColorMap[index], backgroundColor: `${DifficultyColorMap[index]}22` }]} onPress={() => void updateSettings({ defaultSort: { ...current, difficultyIndex: index } })}>
                <Text style={[styles.chipText, current.difficultyIndex === index && { color: DifficultyColorMap[index] }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.done} onPress={() => router.back()}><Text style={styles.doneText}>完成</Text></Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 22, backgroundColor: Colors.bg.primary, gap: 12 },
  hint: { fontSize: 12, lineHeight: 18, color: Colors.text.muted },
  card: { borderRadius: 14, overflow: 'hidden', backgroundColor: Colors.bg.secondary, paddingBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  label: { fontSize: 15, color: Colors.text.primary, fontWeight: '700' },
  radio: { fontSize: 20, color: Colors.text.muted },
  radioActive: { color: Colors.accent.primary },
  subTitle: { paddingHorizontal: 16, paddingTop: 14, fontSize: 13, fontWeight: '800', color: Colors.text.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 14 },
  chip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9, borderWidth: 1, borderColor: Colors.border.light },
  chipText: { fontSize: 11, color: Colors.text.secondary },
  done: { marginHorizontal: 14, marginBottom: 12, alignItems: 'center', paddingVertical: 11, borderRadius: 10, backgroundColor: Colors.accent.primary },
  doneText: { fontSize: 13, fontWeight: '800', color: '#fff' },
});
