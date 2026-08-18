import React, { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { CameraType } from 'expo-image-picker';
import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import { Colors } from '../constants';
import { matchSongTitles, type TitleMatch } from '../data/title-search';
import type { MusicData } from '../data/types';

interface Props {
  visible: boolean;
  rawData: MusicData[];
  onClose: () => void;
  onOpenSong: (music: MusicData) => void;
}

export function TitleRecognizer({ visible, rawData, onClose, onOpenSong }: Props) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [recognizedText, setRecognizedText] = useState('');
  const [matches, setMatches] = useState<TitleMatch[]>([]);
  const [status, setStatus] = useState('点击下方按钮拍摄曲名');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!visible) {
      setImageUri(null);
      setRecognizedText('');
      setMatches([]);
      setStatus('点击下方按钮拍摄曲名');
      setWorking(false);
    }
  }, [visible]);

  const captureAndRecognize = async () => {
    if (working) return;
    setWorking(true);
    setMatches([]);
    setRecognizedText('');
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
        quality: 1,
        cameraType: CameraType.back,
      });
      if (result.canceled || !result.assets?.[0]?.uri) {
        setStatus('已取消拍摄');
        return;
      }

      const uri = result.assets[0].uri;
      setImageUri(uri);
      setStatus('正在识别图片中的文字…');

      // Run the language models separately because the song library contains
      // Japanese, Chinese, and Latin titles. We only use the returned text.
      const recognizedParts: string[] = [];
      for (const script of [
        TextRecognitionScript.JAPANESE,
        TextRecognitionScript.CHINESE,
        TextRecognitionScript.LATIN,
      ]) {
        try {
          const ocr = await TextRecognition.recognize(uri, script);
          if (ocr.text.trim()) recognizedParts.push(ocr.text.trim());
        } catch {
          // A device may not have every optional script model. Keep trying.
        }
      }

      const text = [...new Set(recognizedParts)].join('\n');
      setRecognizedText(text);
      const nextMatches = matchSongTitles(rawData, text);
      setMatches(nextMatches);
      setStatus(nextMatches.length > 0 ? `找到 ${nextMatches.length} 个可能的歌曲` : '没有匹配到歌曲名，可重新拍摄');
    } catch (error: any) {
      const message = error?.message || '识别失败';
      setStatus(`识别失败：${message}`);
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>拍照识别曲名</Text>
              <Text style={styles.subtitle}>只识别照片中的文字，不识别曲绘</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.close}>关闭</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {imageUri && <Image source={{ uri: imageUri }} style={styles.preview} />}
            <Text style={styles.status}>{working ? '⏳ ' : ''}{status}</Text>
            <Pressable style={[styles.captureButton, working && styles.disabled]} onPress={() => void captureAndRecognize()} disabled={working}>
              <Text style={styles.captureText}>{working ? '识别中…' : imageUri ? '重新拍摄' : '打开相机拍摄'}</Text>
            </Pressable>

            {recognizedText && (
              <View style={styles.ocrBox}>
                <Text style={styles.sectionTitle}>识别到的文字</Text>
                <Text style={styles.ocrText}>{recognizedText}</Text>
              </View>
            )}

            {matches.length > 0 && (
              <View style={styles.results}>
                <Text style={styles.sectionTitle}>可能的歌曲</Text>
                {matches.map(match => (
                  <Pressable key={match.music.id} style={styles.resultRow} onPress={() => onOpenSong(match.music)}>
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultTitle} numberOfLines={2}>{match.music.title}</Text>
                      <Text style={styles.resultMeta}>{match.music.basic_info.artist} · {match.music.type}</Text>
                      <Text style={styles.resultSource}>匹配文字：{match.recognizedText}</Text>
                    </View>
                    <Text style={styles.score}>{Math.round(match.score * 100)}%</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <Text style={styles.note}>提示：请尽量让曲名完整、清晰地出现在照片中。当前不会根据曲绘识别歌曲。</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.64)',
  },
  card: {
    maxHeight: '92%',
    backgroundColor: Colors.bg.primary,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 10,
    color: Colors.text.muted,
  },
  close: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accent.primary,
  },
  body: {
    padding: 20,
    paddingBottom: 42,
    gap: 12,
  },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: Colors.bg.secondary,
    resizeMode: 'contain',
  },
  status: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.text.secondary,
  },
  captureButton: {
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: Colors.accent.primary,
  },
  disabled: {
    opacity: 0.5,
  },
  captureText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
  ocrBox: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: Colors.bg.secondary,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  ocrText: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.text.secondary,
  },
  results: {
    gap: 8,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 11,
    borderRadius: 10,
    backgroundColor: Colors.bg.tertiary,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  resultInfo: {
    flex: 1,
    gap: 3,
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  resultMeta: {
    fontSize: 10,
    color: Colors.text.secondary,
  },
  resultSource: {
    fontSize: 9,
    color: Colors.text.muted,
  },
  score: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.accent.primary,
  },
  note: {
    fontSize: 10,
    lineHeight: 15,
    color: Colors.text.muted,
  },
});
