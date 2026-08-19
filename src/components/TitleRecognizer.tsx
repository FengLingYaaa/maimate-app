import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { CameraType } from 'expo-image-picker';
import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import { Colors, DifficultyLabels } from '../constants';
import { matchSongTitles, type TitleMatch } from '../data/title-search';
import { usePlanStore } from '../store';
import type { MusicData } from '../data/types';

interface Props {
  visible: boolean;
  rawData: MusicData[];
  onClose: () => void;
  onOpenSong: (music: MusicData) => void;
}

interface ImageTextResult {
  uri: string;
  text: string;
}

const MAX_IMAGES = 10;

function getQuickAddDifficulty(music: MusicData): number | null {
  const count = Math.min(music.charts.length, music.level.length);
  return count > 0 ? count - 1 : null;
}

export function TitleRecognizer({ visible, rawData, onClose, onOpenSong }: Props) {
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [imageTexts, setImageTexts] = useState<ImageTextResult[]>([]);
  const [recognizedText, setRecognizedText] = useState('');
  const [matches, setMatches] = useState<TitleMatch[]>([]);
  const [status, setStatus] = useState('可连续拍摄，或从相册选择多张图片');
  const [working, setWorking] = useState(false);
  const [planFeedback, setPlanFeedback] = useState<string | null>(null);
  const preserveResultsOnClose = useRef(false);
  const addEntry = usePlanStore(s => s.addEntry);
  const isInPlan = usePlanStore(s => s.isInPlan);
  const planLoaded = usePlanStore(s => s.loaded);

  const updateMatches = useCallback((nextImageTexts: ImageTextResult[]) => {
    const combined = nextImageTexts.map(item => item.text).filter(Boolean).join('\n');
    setRecognizedText(combined);
    const nextMatches = matchSongTitles(rawData, combined);
    setMatches(nextMatches);
    setStatus(nextMatches.length > 0 ? `已识别 ${nextImageTexts.length} 张图片，找到 ${nextMatches.length} 个可能的歌曲` : nextImageTexts.length > 0 ? '已完成识别，没有匹配到歌曲名' : '可连续拍摄，或从相册选择多张图片');
  }, [rawData]);

  const recognizeUris = useCallback(async (uris: string[]) => {
    const existingUris = new Set(imageTexts.map(item => item.uri));
    const newUris = uris.filter(uri => uri && !existingUris.has(uri)).slice(0, Math.max(0, MAX_IMAGES - imageTexts.length));
    if (newUris.length === 0) {
      if (uris.length > 0) setStatus(`最多保留 ${MAX_IMAGES} 张图片，或图片已经添加过`);
      return;
    }

    setWorking(true);
    const nextResults = [...imageTexts];
    try {
      for (let index = 0; index < newUris.length; index += 1) {
        const uri = newUris[index];
        setStatus(`正在识别第 ${imageTexts.length + index + 1} / ${imageTexts.length + newUris.length} 张图片…`);
        const recognizedParts: string[] = [];
        for (const script of [TextRecognitionScript.JAPANESE, TextRecognitionScript.CHINESE, TextRecognitionScript.LATIN]) {
          try {
            const ocr = await TextRecognition.recognize(uri, script);
            if (ocr.text.trim()) recognizedParts.push(ocr.text.trim());
          } catch {
            // Optional language models may be unavailable on a device.
          }
        }
        nextResults.push({ uri, text: [...new Set(recognizedParts)].join('\n') });
      }
      setImageUris(current => [...new Set([...current, ...newUris])].slice(0, MAX_IMAGES));
      setImageTexts(nextResults);
      updateMatches(nextResults);
    } catch (error: any) {
      setStatus(`识别失败：${error?.message || '未知错误'}`);
    } finally {
      setWorking(false);
    }
  }, [imageTexts, updateMatches]);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    void ImagePicker.getPendingResultAsync().then(result => {
      if (!active || !result || !('canceled' in result) || result.canceled || !result.assets) return;
      void recognizeUris(result.assets.map(asset => asset.uri));
    }).catch(() => {
      // No pending result is normal on iOS and after a normal Android return.
    });
    return () => {
      active = false;
    };
  }, [visible, recognizeUris]);

  useEffect(() => {
    if (!visible) {
      if (preserveResultsOnClose.current) {
        preserveResultsOnClose.current = false;
        return;
      }
      setImageUris([]);
      setImageTexts([]);
      setRecognizedText('');
      setMatches([]);
      setStatus('可连续拍摄，或从相册选择多张图片');
      setPlanFeedback(null);
      setWorking(false);
    }
  }, [visible]);

  const captureAndRecognize = async () => {
    if (working || imageUris.length >= MAX_IMAGES) return;
    setStatus('正在请求相机权限…');
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setStatus('没有相机权限，无法拍摄曲名');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: false,
        quality: 0.9,
        cameraType: CameraType.back,
      });
      if (result.canceled || !result.assets?.[0]?.uri) {
        setStatus(imageUris.length > 0 ? '已取消拍摄，可继续添加图片' : '已取消拍摄');
        return;
      }
      await recognizeUris([result.assets[0].uri]);
    } catch (error: any) {
      setStatus(`拍摄失败：${error?.message || '未知错误'}`);
    }
  };

  const pickMultipleImages = async () => {
    if (working || imageUris.length >= MAX_IMAGES) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setStatus('没有相册权限，无法导入图片');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: false,
        allowsMultipleSelection: true,
        selectionLimit: MAX_IMAGES - imageUris.length,
        quality: 0.9,
      });
      if (result.canceled || !result.assets) {
        setStatus(imageUris.length > 0 ? '已取消导入，可继续添加图片' : '已取消导入');
        return;
      }
      await recognizeUris(result.assets.map(asset => asset.uri));
    } catch (error: any) {
      setStatus(`导入失败：${error?.message || '未知错误'}`);
    }
  };

  const removeImage = (uri: string) => {
    const nextUris = imageUris.filter(item => item !== uri);
    const nextResults = imageTexts.filter(item => item.uri !== uri);
    setImageUris(nextUris);
    setImageTexts(nextResults);
    updateMatches(nextResults);
  };

  const clearImages = () => {
    setImageUris([]);
    setImageTexts([]);
    setRecognizedText('');
    setMatches([]);
    setPlanFeedback(null);
    setStatus('可连续拍摄，或从相册选择多张图片');
  };

  const handleOpenSong = (music: MusicData) => {
    preserveResultsOnClose.current = true;
    onOpenSong(music);
  };

  const handleQuickAdd = (music: MusicData) => {
    if (!planLoaded) {
      setPlanFeedback('推分计划正在加载，请稍后再试');
      return;
    }
    const difficultyIndex = getQuickAddDifficulty(music);
    if (difficultyIndex === null) {
      setPlanFeedback(`「${music.title}」没有可加入的谱面`);
      return;
    }
    const difficultyLabel = DifficultyLabels[difficultyIndex];
    if (isInPlan(music.id, difficultyIndex, music.type)) {
      setPlanFeedback(`已在推分计划：${music.title} · ${difficultyLabel}`);
      return;
    }
    addEntry({ songId: music.id, musicType: music.type, difficultyIndex });
    setPlanFeedback(`已加入推分计划：${music.title} · ${difficultyLabel}`);
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>拍照识别曲名</Text>
              <Text style={styles.subtitle}>支持连续拍摄和相册多选；只识别照片文字，不识别曲绘</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}><Text style={styles.close}>关闭</Text></Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {imageUris.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailRow}>
                {imageUris.map((uri, index) => (
                  <View key={uri} style={styles.thumbnailWrap}>
                    <Image source={{ uri }} style={styles.thumbnail} />
                    <Pressable style={styles.removeImage} onPress={() => removeImage(uri)}><Text style={styles.removeImageText}>×</Text></Pressable>
                    <Text style={styles.thumbnailIndex}>{index + 1}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
            <Text style={styles.status}>{working ? '⏳ ' : ''}{status}</Text>
            <View style={styles.captureRow}>
              <Pressable style={[styles.captureButton, styles.captureHalf, working && styles.disabled]} onPress={() => void captureAndRecognize()} disabled={working || imageUris.length >= MAX_IMAGES}>
                <Text style={styles.captureText}>{imageUris.length > 0 ? '继续拍摄' : '打开相机'}</Text>
              </Pressable>
              <Pressable style={[styles.galleryButton, styles.captureHalf, working && styles.disabled]} onPress={() => void pickMultipleImages()} disabled={working || imageUris.length >= MAX_IMAGES}>
                <Text style={styles.galleryText}>相册多选</Text>
              </Pressable>
            </View>
            {imageUris.length > 0 && <Pressable style={styles.clearButton} onPress={clearImages} disabled={working}><Text style={styles.clearText}>清空图片并重新识别</Text></Pressable>}

            {matches.length > 0 && (
              <View style={styles.results}>
                <Text style={styles.sectionTitle}>合并后的可能歌曲（已去重）</Text>
                {matches.map(match => {
                  const difficultyIndex = getQuickAddDifficulty(match.music);
                  const difficultyLabel = difficultyIndex === null ? null : DifficultyLabels[difficultyIndex];
                  const alreadyInPlan = difficultyIndex !== null && planLoaded && isInPlan(match.music.id, difficultyIndex, match.music.type);
                  return (
                    <View key={`${match.music.id}-${match.music.type}`} style={styles.resultRow}>
                      <Pressable style={styles.resultMain} onPress={() => handleOpenSong(match.music)} accessibilityRole="button" accessibilityLabel={`查看歌曲 ${match.music.title}`}>
                        <View style={styles.resultInfo}>
                          <Text style={styles.resultTitle} numberOfLines={2}>{match.music.title}</Text>
                          <Text style={styles.resultMeta}>{match.music.basic_info.artist} · {match.music.type}</Text>
                          <Text style={styles.resultSource}>识别文字：{match.recognizedText}</Text>
                        </View>
                      </Pressable>
                      <View style={styles.resultActions}>
                        <Text style={styles.score}>{Math.round(match.score * 100)}%</Text>
                        <Pressable style={[styles.quickAddButton, (!planLoaded || difficultyIndex === null) && styles.quickAddButtonDisabled]} onPress={() => handleQuickAdd(match.music)} disabled={!planLoaded || difficultyIndex === null}>
                          <Text style={styles.quickAddText}>{!planLoaded ? '计划加载中' : alreadyInPlan ? '已在计划' : difficultyLabel ? `+ ${difficultyLabel}` : '不可加入'}</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {recognizedText && (
              <View style={styles.ocrBox}>
                <Text style={styles.sectionTitle}>各图片识别到的原始文字</Text>
                {imageTexts.map((item, index) => <Text key={item.uri} style={styles.ocrText}>#{index + 1} {item.text || '（没有识别到文字）'}</Text>)}
              </View>
            )}
            {planFeedback && <Text style={styles.planFeedback}>{planFeedback}</Text>}
            <Text style={styles.note}>提示：请尽量让曲名完整、清晰地出现在照片中。多张图片会逐张识别并按歌曲谱面去重。</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.64)' },
  card: { maxHeight: '92%', backgroundColor: Colors.bg.primary, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  title: { fontSize: 18, fontWeight: '800', color: Colors.text.primary },
  subtitle: { marginTop: 4, maxWidth: 270, fontSize: 10, color: Colors.text.muted },
  close: { fontSize: 12, fontWeight: '700', color: Colors.accent.primary },
  body: { padding: 20, paddingBottom: 42, gap: 12 },
  thumbnailRow: { gap: 8 },
  thumbnailWrap: { width: 76, height: 76, borderRadius: 10, overflow: 'visible' },
  thumbnail: { width: 76, height: 76, borderRadius: 10, backgroundColor: Colors.bg.secondary },
  removeImage: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.functional.danger },
  removeImageText: { color: '#fff', fontSize: 16, lineHeight: 18, fontWeight: '800' },
  thumbnailIndex: { position: 'absolute', bottom: 3, left: 5, color: '#fff', fontSize: 10, fontWeight: '800' },
  status: { fontSize: 12, lineHeight: 18, color: Colors.text.secondary },
  captureRow: { flexDirection: 'row', gap: 8 },
  captureHalf: { flex: 1 },
  captureButton: { alignItems: 'center', paddingVertical: 13, borderRadius: 12, backgroundColor: Colors.accent.primary },
  captureText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  galleryButton: { alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 12, backgroundColor: `${Colors.accent.secondary}22`, borderWidth: 1, borderColor: Colors.accent.secondary },
  galleryText: { fontSize: 13, fontWeight: '800', color: Colors.accent.secondary },
  disabled: { opacity: 0.5 },
  clearButton: { alignItems: 'center', paddingVertical: 7 },
  clearText: { fontSize: 11, color: Colors.functional.danger },
  ocrBox: { padding: 12, borderRadius: 10, backgroundColor: Colors.bg.secondary, gap: 6 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: Colors.text.primary },
  ocrText: { fontSize: 11, lineHeight: 17, color: Colors.text.secondary },
  results: { gap: 8 },
  resultRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8, padding: 11, borderRadius: 10, backgroundColor: Colors.bg.tertiary, borderWidth: 1, borderColor: Colors.border.light },
  resultMain: { flex: 1, justifyContent: 'center' },
  resultInfo: { gap: 3 },
  resultTitle: { fontSize: 13, fontWeight: '800', color: Colors.text.primary },
  resultMeta: { fontSize: 10, color: Colors.text.secondary },
  resultSource: { fontSize: 9, color: Colors.text.muted },
  resultActions: { alignItems: 'flex-end', justifyContent: 'space-between', gap: 6 },
  score: { fontSize: 12, fontWeight: '800', color: Colors.accent.primary },
  quickAddButton: { paddingHorizontal: 7, paddingVertical: 5, borderRadius: 7, backgroundColor: `${Colors.accent.secondary}22`, borderWidth: 1, borderColor: Colors.accent.secondary },
  quickAddButtonDisabled: { opacity: 0.5 },
  quickAddText: { fontSize: 9, fontWeight: '800', color: Colors.accent.secondary },
  planFeedback: { fontSize: 11, lineHeight: 16, color: Colors.accent.secondary },
  note: { fontSize: 10, lineHeight: 15, color: Colors.text.muted },
});
