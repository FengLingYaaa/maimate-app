import React, { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
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
        const orderedIds = data.map(row => row.entry.entryId);
        const currentIds = rows.map(row => row.entry.entryId);
        if (orderedIds.every((id, index) => id === currentIds[index])) return;
        onReorder(orderedIds);
      }}
      contentContainerStyle={styles.content}
      ListFooterComponent={<View style={{ height: LIST_BOTTOM_INSET + insets.bottom }} />}
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
  content: { paddingTop: 2 },
  row: { backgroundColor: Colors.bg.primary },
  activeRow: { opacity: 0.96, backgroundColor: Colors.bg.tertiary },
});
