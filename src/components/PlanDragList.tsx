import React, { useCallback, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants';
import type { MusicData, PlanEntry, PlayerScore } from '../data/types';
import { PlanEntryCard } from './PlanEntryCard';

export interface PlanDragRow {
  music: MusicData;
  entry: PlanEntry;
}

interface Props {
  rows: PlanDragRow[];
  canDrag: boolean;
  showChinaVersion: boolean;
  showProjectedRating: boolean;
  allSongs: MusicData[];
  getScore: (music: MusicData, entry: PlanEntry) => PlayerScore | undefined;
  onOpen: (row: PlanDragRow) => void;
  onRemove: (entryId: string) => void;
  onTarget: (entryId: string, value: number | null) => void;
  onPin: (entryId: string, pin: PlanEntry['pin'] | undefined) => void;
  onReorder: (orderedIds: string[]) => boolean;
}

/**
 * 推分计划唯一的可排序视图。业务页面不接触拖拽 index，也不缓存 Row 对象；
 * 所有更新只通过持久 entryId 寻址，拖拽结束一次性提交完整 ID 顺序。
 */
export function PlanDragList({
  rows,
  canDrag,
  showChinaVersion,
  showProjectedRating,
  allSongs,
  getScore,
  onOpen,
  onRemove,
  onTarget,
  onPin,
  onReorder,
}: Props) {
  const insets = useSafeAreaInsets();
  const draggingRef = useRef(false);

  const renderItem = useCallback((params: RenderItemParams<PlanDragRow>) => (
    <PlanDragRowView
      {...params}
      canDrag={canDrag}
      showChinaVersion={showChinaVersion}
      showProjectedRating={showProjectedRating}
      allSongs={allSongs}
      getScore={getScore}
      onOpen={onOpen}
      onRemove={onRemove}
      onTarget={onTarget}
      onPin={onPin}
    />
  ), [allSongs, canDrag, getScore, onOpen, onPin, onRemove, onTarget, showChinaVersion, showProjectedRating]);

  return (
    <DraggableFlatList
      data={rows}
      keyExtractor={item => item.entry.entryId}
      renderItem={renderItem}
      activationDistance={12}
      autoscrollThreshold={72}
      autoscrollSpeed={120}
      dragItemOverflow={false}
      onDragBegin={() => { draggingRef.current = true; }}
      onRelease={() => { draggingRef.current = false; }}
      onDragEnd={({ data }) => {
        draggingRef.current = false;
        if (!canDrag || data.length !== rows.length) return;
        onReorder(data.map(row => row.entry.entryId));
      }}
      contentContainerStyle={styles.content}
      ListFooterComponent={<View style={{ height: 96 + insets.bottom }} />}
      showsVerticalScrollIndicator
      keyboardShouldPersistTaps="handled"
      removeClippedSubviews={false}
    />
  );
}

function PlanDragRowView({
  item,
  getIndex,
  drag,
  isActive,
  canDrag,
  showChinaVersion,
  showProjectedRating,
  allSongs,
  getScore,
  onOpen,
  onRemove,
  onTarget,
  onPin,
}: RenderItemParams<PlanDragRow> & Omit<Props, 'rows' | 'onReorder'>) {
  const entryId = item.entry.entryId;
  return (
    <ScaleDecorator activeScale={1.025}>
      <View style={[styles.row, isActive && styles.activeRow]}>
        <PlanEntryCard
          music={item.music}
          entry={item.entry}
          index={getIndex() ?? item.entry.order}
          allSongs={allSongs}
          importedScore={getScore(item.music, item.entry)}
          showChinaVersion={showChinaVersion}
          showProjectedRating={showProjectedRating}
          onPress={() => onOpen(item)}
          onLongPress={canDrag ? drag : () => undefined}
          onRemove={() => onRemove(entryId)}
          onTarget={value => onTarget(entryId, value)}
        />
        <View style={styles.rowActions}>
          <Text style={styles.dragHint}>{canDrag ? '长按曲目信息拖拽排序' : '清除筛选/排序后可拖拽'}</Text>
          <Pressable
            style={[styles.pinButton, item.entry.pin === 'top' && styles.pinButtonActive]}
            onPress={() => onPin(entryId, item.entry.pin === 'top' ? undefined : 'top')}
            accessibilityLabel={item.entry.pin === 'top' ? '取消置顶' : '置顶'}
          >
            <Text style={[styles.pinText, item.entry.pin === 'top' && styles.pinTextActive]}>{item.entry.pin === 'top' ? '取消置顶' : '📌 置顶'}</Text>
          </Pressable>
          <Pressable
            style={[styles.pinButton, item.entry.pin === 'bottom' && styles.pinButtonActive]}
            onPress={() => onPin(entryId, item.entry.pin === 'bottom' ? undefined : 'bottom')}
            accessibilityLabel={item.entry.pin === 'bottom' ? '取消置底' : '置底'}
          >
            <Text style={[styles.pinText, item.entry.pin === 'bottom' && styles.pinTextActive]}>{item.entry.pin === 'bottom' ? '取消置底' : '🔻 置底'}</Text>
          </Pressable>
        </View>
      </View>
    </ScaleDecorator>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 2 },
  row: { backgroundColor: Colors.bg.primary },
  activeRow: { opacity: 0.96, backgroundColor: Colors.bg.tertiary },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 7,
    marginHorizontal: 14,
    marginTop: -2,
    marginBottom: 5,
  },
  dragHint: { flex: 1, fontSize: 9, color: Colors.text.muted },
  pinButton: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: Colors.border.light,
    backgroundColor: Colors.bg.secondary,
  },
  pinButtonActive: { borderColor: Colors.accent.secondary, backgroundColor: `${Colors.accent.secondary}22` },
  pinText: { fontSize: 9.5, color: Colors.text.secondary, fontWeight: '700' },
  pinTextActive: { color: Colors.accent.secondary },
});
