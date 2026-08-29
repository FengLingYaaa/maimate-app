import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants';
import { LIST_BOTTOM_INSET } from '../constants/layout';
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
  allScores: PlayerScore[];
  getScore: (music: MusicData, entry: PlanEntry) => PlayerScore | undefined;
  onOpen: (row: PlanDragRow) => void;
  onRemove: (entryId: string) => void;
  onTarget: (entryId: string, value: number | null) => void;
  onReorder: (orderedIds: string[]) => boolean;
}

/**
 * 推分计划唯一的可排序视图。业务页面不接触拖拽 index，也不缓存 Row 对象；
 * 所有更新只通过持久 entryId 寻址，拖拽结束一次性提交完整 ID 顺序。
 * v1.12.0：置顶/置底功能删除，所有曲目一个分组，长按即可拖拽。
 * v1.16.2：右下角悬浮「到底部」按钮——已在底部或拖拽中隐藏。
 */
export function PlanDragList({
  rows,
  canDrag,
  showChinaVersion,
  showProjectedRating,
  allSongs,
  allScores,
  getScore,
  onOpen,
  onRemove,
  onTarget,
  onReorder,
}: Props) {
  const insets = useSafeAreaInsets();
  const draggingRef = useRef(false);
  const listRef = useRef<React.ElementRef<typeof DraggableFlatList<PlanDragRow>>>(null);
  const [atBottom, setAtBottom] = useState(false);

  const handleScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distance = contentSize.height - layoutMeasurement.height - contentOffset.y;
    setAtBottom(distance < 40);
  }, []);

  const scrollToEnd = useCallback(() => {
    // v1.16.5：动画滚动会连续渲染途经卡片造成 JS 线程拥塞（滑动卡顿/闪退诱因），改瞬时跳转。
    listRef.current?.scrollToEnd({ animated: false });
  }, []);

  const renderItem = useCallback((params: RenderItemParams<PlanDragRow>) => (
    <PlanDragRowView
      {...params}
      canDrag={canDrag}
      showChinaVersion={showChinaVersion}
      showProjectedRating={showProjectedRating}
      allSongs={allSongs}
      allScores={allScores}
      getScore={getScore}
      onOpen={onOpen}
      onRemove={onRemove}
      onTarget={onTarget}
    />
  ), [allSongs, allScores, canDrag, getScore, onOpen, onRemove, onTarget, showChinaVersion, showProjectedRating]);

  return (
    <View style={styles.flex}>
      <DraggableFlatList
        ref={listRef}
        data={rows}
        keyExtractor={item => item.entry.entryId}
        renderItem={renderItem}
        activationDistance={12}
        autoscrollThreshold={72}
        autoscrollSpeed={120}
        dragItemOverflow={false}
        onScroll={handleScroll}
        scrollEventThrottle={64}
        onDragBegin={() => { draggingRef.current = true; setAtBottom(false); }}
        onRelease={() => { draggingRef.current = false; }}
        onDragEnd={({ data }) => {
          draggingRef.current = false;
          if (!canDrag || data.length !== rows.length) return;
          const orderedIds = data.map(row => row.entry.entryId);
          const currentIds = rows.map(row => row.entry.entryId);
          if (orderedIds.every((id, index) => id === currentIds[index])) return;
          onReorder(orderedIds);
        }}
        contentContainerStyle={[styles.content, { paddingBottom: LIST_BOTTOM_INSET + insets.bottom }]}
        ListFooterComponent={<View style={{ height: LIST_BOTTOM_INSET + insets.bottom }} />}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
      />
      {!atBottom && rows.length > 0 && (
        <Pressable
          style={[styles.jumpButton, { bottom: 12 }]}
          onPress={scrollToEnd}
          accessibilityLabel="滑动到计划最底部"
        >
          <Text style={styles.jumpButtonText}>↓ 底部</Text>
        </Pressable>
      )}
    </View>
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
  allScores,
  getScore,
  onOpen,
  onRemove,
  onTarget,
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
          allScores={allScores}
          importedScore={getScore(item.music, item.entry)}
          showChinaVersion={showChinaVersion}
          showProjectedRating={showProjectedRating}
          onPress={() => onOpen(item)}
          onLongPress={canDrag ? drag : () => undefined}
          onRemove={() => onRemove(entryId)}
          onTarget={value => onTarget(entryId, value)}
        />
      </View>
    </ScaleDecorator>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingTop: 2 },
  row: { backgroundColor: Colors.bg.primary },
  activeRow: { opacity: 0.96, backgroundColor: Colors.bg.tertiary },
  jumpButton: {
    position: 'absolute', right: 14,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22,
    backgroundColor: Colors.accent.primary, elevation: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 4,
  },
  jumpButtonText: { fontSize: 12, fontWeight: '900', color: '#fff' },
});
