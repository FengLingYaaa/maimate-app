/**
 * 列表底部留白常量。
 *
 * 底部 Tab 栏高 60 + 安全区 + 卡片阴影/呼吸余量；有安全区时再叠加 insets.bottom。
 * 推分计划与牌子查询两个长列表共用，避免再次出现最后一首被下边栏遮挡。
 * v1.14.0：由 160 提升到 200；且 DraggableFlatList 的 ListFooterComponent
 * 会被吞掉，改用 contentContainerStyle paddingBottom（见 PlanDragList）。
 */
export const LIST_BOTTOM_INSET = 200;
