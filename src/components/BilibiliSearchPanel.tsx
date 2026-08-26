import React, { useMemo, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors, DifficultyColorMap, DifficultyLabels } from '../constants';
import { BILIBILI_QUICK_TAGS, getBilibiliLinkChartKey, getChartKey, normalizeBilibiliVideoUrl, parseBilibiliShare } from '../data/bilibili-links';
import { openBilibiliSearch, openBilibiliVideo } from '../data/external-links';
import { getDirectVideoAppUrl } from '../data/bilibili-resolve';
import { isBilibiliShortLink } from '../data/bilibili-search';
import { useBilibiliStore } from '../store';

interface Props {
  songId: string;
  songTitle: string;
  musicType: 'SD' | 'DX';
  difficultyIndex: number;
}

export function BilibiliSearchPanel({ songId, songTitle, musicType, difficultyIndex }: Props) {
  const shouldShow = [2, 3, 4].includes(difficultyIndex);
  const difficultyLabel = DifficultyLabels[difficultyIndex];
  const difficultyColor = DifficultyColorMap[difficultyIndex];
  const allLinks = useBilibiliStore(s => s.links);
  const addLink = useBilibiliStore(s => s.addLink);
  const updateLink = useBilibiliStore(s => s.updateLink);
  const refreshMetadata = useBilibiliStore(s => s.refreshMetadata);
  const removeLink = useBilibiliStore(s => s.removeLink);
  const links = useMemo(
    () => allLinks.filter(link => getBilibiliLinkChartKey(link) === getChartKey(songId, musicType, difficultyIndex)),
    [allLinks, songId, musicType, difficultyIndex],
  );
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [shareTitle, setShareTitle] = useState('');
  const [remark, setRemark] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [diagVisible, setDiagVisible] = useState(false);

  /** 深链诊断：描述每条已存视频当前的跳转策略。 */
  const describeDeepLink = (linkUrl: string): string => {
    if (isBilibiliShortLink(linkUrl)) return 'b23.tv 短链：点击时自动解析成 BV 并拉起客户端（首次需联网，结果会缓存）';
    const appUrl = getDirectVideoAppUrl(linkUrl);
    if (appUrl) return `深链就绪：${appUrl}`;
    return '无法提取视频 ID：将以网页方式打开';
  };

  const openAdd = () => {
    setEditingId(null);
    setUrl('');
    setShareTitle('');
    setRemark('');
    setTags([]);
    setCustomTag('');
    setError(null);
    setModalVisible(true);
  };

  const openEdit = (link: typeof links[number]) => {
    setEditingId(link.id);
    setUrl(link.url);
    setShareTitle(link.shareTitle || link.title || '');
    setRemark(link.remark);
    setTags(link.tags);
    setCustomTag('');
    setError(null);
    setModalVisible(true);
  };

  const handleShareTextChange = (value: string) => {
    setUrl(value);
    const parsed = parseBilibiliShare(value);
    setShareTitle(parsed?.title || '');
  };

  const toggleTag = (tag: string) => {
    setTags(current => current.includes(tag) ? current.filter(value => value !== tag) : [...current, tag]);
  };

  const addCustomTag = () => {
    const tag = customTag.trim();
    if (!tag) return;
    setTags(current => current.includes(tag) ? current : [...current, tag]);
    setCustomTag('');
  };

  const submit = async () => {
    const parsed = parseBilibiliShare(url);
    if (!normalizeBilibiliVideoUrl(url)) {
      setError('请输入 bilibili.com/video 或 b23.tv 视频分享链接');
      return;
    }
    try {
      if (editingId) {
        await updateLink(editingId, { url, shareTitle: shareTitle || parsed?.title, remark, tags });
        void refreshMetadata(editingId);
      } else {
        const link = await addLink({ songId, musicType, difficultyIndex, url, shareTitle: shareTitle || parsed?.title, remark, tags });
        void refreshMetadata(link.id);
      }
      setModalVisible(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '保存失败，请重试');
    }
  };

  if (!shouldShow) return null;

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Bilibili 搜索</Text>
        <Text style={[styles.difficulty, { color: difficultyColor }]}>{difficultyLabel}</Text>
      </View>
      <Pressable style={({ pressed }) => [styles.searchButton, pressed && styles.searchButtonPressed]} onPress={() => void openBilibiliSearch(songTitle, difficultyLabel)}>
        <Text style={styles.searchButtonText}>去 Bilibili 搜索该谱面</Text>
      </Pressable>

      <View style={styles.savedHeader}>
        <Text style={styles.savedTitle}>我的 B 站视频</Text>
        <Pressable onPress={openAdd}>
          <Text style={styles.addText}>＋添加视频</Text>
        </Pressable>
      </View>
      {links.length === 0 ? (
        <Text style={styles.emptyText}>可粘贴 B 站分享文本，自动提取标题、链接并尝试缓存封面。</Text>
      ) : (
        <>
          {links.map(link => (
            <View key={link.id} style={styles.linkRow}>
              {link.coverUri ? <Image source={{ uri: link.coverUri }} style={styles.cover} /> : <View style={styles.coverPlaceholder}><Text style={styles.coverPlaceholderText}>B</Text></View>}
              <Pressable style={styles.linkMain} onPress={() => void openBilibiliVideo(link.url)}>
                <Text style={styles.linkTitle} numberOfLines={2}>{link.title || link.shareTitle || '未命名视频'}</Text>
                <Text style={styles.linkUrl} numberOfLines={1}>{link.url}</Text>
                {!!link.remark && <Text style={styles.remark} numberOfLines={2}>{link.remark}</Text>}
                {link.tags.length > 0 && <Text style={styles.tags}>{link.tags.map(tag => `#${tag}`).join(' ')}</Text>}
                {link.metadataStatus === 'loading' && <Text style={styles.metadataHint}>正在解析视频信息…</Text>}
                {link.metadataStatus === 'error' && <Text style={styles.metadataHint}>解析失败，仍可正常打开视频</Text>}
              </Pressable>
              <View style={styles.linkActions}>
                <Pressable onPress={() => openEdit(link)}><Text style={styles.actionText}>编辑</Text></Pressable>
                <Pressable onPress={() => void refreshMetadata(link.id)}><Text style={styles.actionText}>{link.metadataStatus === 'loading' ? '…' : '解析'}</Text></Pressable>
                <Pressable onPress={() => void removeLink(link.id)}><Text style={styles.deleteText}>删除</Text></Pressable>
              </View>
            </View>
          ))}
          <Pressable onPress={() => setDiagVisible(value => !value)}>
            <Text style={styles.diagToggle}>{diagVisible ? '▲ 深链诊断' : '▼ 深链诊断'}</Text>
          </Pressable>
          {diagVisible && links.map(link => (
            <View key={`diag-${link.id}`} style={styles.diagRow}>
              <Text style={styles.diagTitle} numberOfLines={1}>{link.title || link.url}</Text>
              <Text style={styles.diagStatus}>{describeDeepLink(link.url)}</Text>
              <Pressable onPress={() => void openBilibiliVideo(link.url)}>
                <Text style={styles.diagTest}>▶ 试开（应用优先）</Text>
              </Pressable>
            </View>
          ))}
        </>
      )}

      <Modal transparent visible={modalVisible} animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingId ? '编辑 B 站视频' : '添加 B 站视频'}</Text>
            <TextInput
              style={styles.input}
              value={url}
              onChangeText={handleShareTextChange}
              placeholder="粘贴完整分享文本或 bilibili 视频链接"
              placeholderTextColor={Colors.text.muted}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
            />
            {!!shareTitle && <Text style={styles.parsedTitle}>识别标题：{shareTitle}</Text>}
            <TextInput style={[styles.input, styles.remarkInput]} value={remark} onChangeText={setRemark} placeholder="备注（可选）" placeholderTextColor={Colors.text.muted} multiline />
            <Text style={styles.tagLabel}>快捷关键词</Text>
            <View style={styles.tagRow}>
              {BILIBILI_QUICK_TAGS.map(tag => (
                <Pressable key={tag} style={[styles.tagChip, tags.includes(tag) && styles.tagChipActive]} onPress={() => toggleTag(tag)}>
                  <Text style={[styles.tagChipText, tags.includes(tag) && styles.tagChipTextActive]}>{tag}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.customTagRow}>
              <TextInput style={[styles.input, styles.customTagInput]} value={customTag} onChangeText={setCustomTag} placeholder="自定义关键词" placeholderTextColor={Colors.text.muted} onSubmitEditing={addCustomTag} />
              <Pressable style={styles.addTagButton} onPress={addCustomTag}><Text style={styles.addTagText}>添加</Text></Pressable>
            </View>
            {tags.length > 0 && <Text style={styles.selectedTags}>已选：{tags.join('、')}</Text>}
            <Text style={styles.metadataNote}>保存后仅尝试获取这一条视频的公开标题和封面，不下载视频。</Text>
            {!!error && <Text style={styles.errorText}>{error}</Text>}
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelButton} onPress={() => setModalVisible(false)}><Text style={styles.cancelText}>取消</Text></Pressable>
              <Pressable style={styles.saveButton} onPress={() => void submit()}><Text style={styles.saveText}>保存</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: Colors.bg.tertiary, gap: 8 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 13, fontWeight: '800', color: Colors.text.primary },
  difficulty: { fontSize: 11, fontWeight: '800' },
  searchButton: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8, backgroundColor: `${Colors.accent.secondary}22`, borderWidth: 1, borderColor: Colors.accent.secondary },
  searchButtonPressed: { opacity: 0.72 },
  searchButtonText: { fontSize: 11, fontWeight: '700', color: Colors.accent.secondary },
  savedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  savedTitle: { fontSize: 12, fontWeight: '800', color: Colors.text.primary },
  addText: { fontSize: 11, fontWeight: '800', color: Colors.accent.primary },
  emptyText: { fontSize: 10, lineHeight: 15, color: Colors.text.muted },
  linkRow: { flexDirection: 'row', gap: 8, padding: 9, borderRadius: 9, backgroundColor: Colors.bg.secondary },
  cover: { width: 54, height: 54, borderRadius: 7, backgroundColor: Colors.bg.tertiary },
  coverPlaceholder: { width: 54, height: 54, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: `${Colors.accent.secondary}33` },
  coverPlaceholderText: { fontSize: 22, fontWeight: '900', color: Colors.accent.secondary },
  linkMain: { flex: 1, gap: 3 },
  linkTitle: { fontSize: 11, fontWeight: '700', color: Colors.text.primary },
  linkUrl: { fontSize: 9, color: Colors.accent.secondary },
  remark: { fontSize: 11, color: Colors.text.primary },
  tags: { fontSize: 10, color: Colors.text.muted },
  metadataHint: { fontSize: 9, color: Colors.text.muted },
  diagToggle: { fontSize: 11, fontWeight: '800', color: Colors.accent.secondary, marginTop: 4 },
  diagRow: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border.light,
    backgroundColor: Colors.bg.tertiary,
    paddingVertical: 7,
    paddingHorizontal: 10,
    gap: 3,
  },
  diagTitle: { fontSize: 11, fontWeight: '700', color: Colors.text.primary },
  diagStatus: { fontSize: 10, lineHeight: 14, color: Colors.text.muted },
  diagTest: { fontSize: 11, fontWeight: '700', color: Colors.accent.primary },
  linkActions: { justifyContent: 'space-around', alignItems: 'flex-end' },
  actionText: { fontSize: 10, color: Colors.accent.primary },
  deleteText: { fontSize: 10, color: Colors.functional.danger },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0, 0, 0, 0.68)' },
  modalCard: { maxHeight: '92%', borderRadius: 16, padding: 16, backgroundColor: Colors.bg.primary, gap: 10 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: Colors.text.primary },
  input: { minHeight: 42, maxHeight: 120, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 9, borderWidth: 1, borderColor: Colors.border.light, backgroundColor: Colors.bg.secondary, color: Colors.text.primary, fontSize: 12 },
  parsedTitle: { fontSize: 11, color: Colors.accent.secondary },
  remarkInput: { minHeight: 70, textAlignVertical: 'top' },
  tagLabel: { fontSize: 11, fontWeight: '800', color: Colors.text.secondary },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagChip: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.bg.tertiary, borderWidth: 1, borderColor: Colors.border.light },
  tagChipActive: { backgroundColor: `${Colors.accent.primary}22`, borderColor: Colors.accent.primary },
  tagChipText: { fontSize: 10, color: Colors.text.secondary },
  tagChipTextActive: { color: Colors.accent.primary, fontWeight: '800' },
  customTagRow: { flexDirection: 'row', gap: 6 },
  customTagInput: { flex: 1 },
  addTagButton: { justifyContent: 'center', paddingHorizontal: 10, borderRadius: 9, backgroundColor: `${Colors.accent.secondary}22`, borderWidth: 1, borderColor: Colors.accent.secondary },
  addTagText: { fontSize: 11, color: Colors.accent.secondary, fontWeight: '800' },
  selectedTags: { fontSize: 10, color: Colors.text.muted },
  metadataNote: { fontSize: 10, lineHeight: 14, color: Colors.text.muted },
  errorText: { fontSize: 11, color: Colors.functional.danger },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  cancelButton: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 9, backgroundColor: Colors.bg.tertiary },
  cancelText: { fontSize: 12, color: Colors.text.secondary },
  saveButton: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 9, backgroundColor: Colors.accent.primary },
  saveText: { fontSize: 12, fontWeight: '800', color: '#fff' },
});
