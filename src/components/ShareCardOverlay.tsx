/**
 * 分享卡片预览层（v1.14.0）：按需渲染的卡片 + 全屏遮罩预览 + 分享/存相册。
 * 不使用 RN Modal（避免 Android 捕获独立窗口内容的风险），
 * 直接在页面内以绝对定位覆盖层渲染，捕获的是同一窗口里的真实视图。
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactElement, RefObject } from 'react';
import type { View as RNView } from 'react-native';
import { Colors } from '../constants';
import { captureCardToTempFile, savePngToMediaLibrary, sharePngFile } from '../data/share-card';

interface Props {
  visible: boolean;
  /** 要展示并捕获的卡片元素（B50ShareCard / SongShareCard 等）。 */
  card: ReactElement;
  fileName: string;
  onClose: () => void;
  /** 捕获前等待曲绘等异步资源就绪的时间（毫秒）。 */
  readinessDelayMs?: number;
}

type BusyKind = 'share' | 'save' | null;

export function ShareCardOverlay({ visible, card, fileName, onClose, readinessDelayMs = 700 }: Props) {
  const holderRef = useRef<RNView>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<BusyKind>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // 最近生成的临时文件，卸载/重新捕获前清理。
  const tempFileRef = useRef<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setReady(false);
      setBusy(null);
      setError(null);
      setNotice(null);
      return;
    }
    const timer = setTimeout(() => setReady(true), readinessDelayMs);
    return () => clearTimeout(timer);
  }, [visible, readinessDelayMs]);

  const cleanupTempFile = useCallback(() => {
    if (!tempFileRef.current) return;
    void import('expo-file-system/legacy').then(FileSystem => {
      FileSystem.deleteAsync(tempFileRef.current!, { idempotent: true }).catch(() => undefined);
    });
    tempFileRef.current = null;
  }, []);

  useEffect(() => cleanupTempFile, [cleanupTempFile]);

  const capture = useCallback(async (): Promise<string> => {
    cleanupTempFile();
    const uri = await captureCardToTempFile(holderRef as RefObject<View | null>, fileName);
    tempFileRef.current = uri;
    return uri;
  }, [cleanupTempFile, fileName]);

  const handleShare = useCallback(async () => {
    if (busy) return;
    setBusy('share');
    setError(null);
    setNotice(null);
    try {
      const uri = await capture();
      await sharePngFile(uri);
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : '分享失败，请重试');
    } finally {
      setBusy(null);
    }
  }, [busy, capture]);

  const handleSave = useCallback(async () => {
    if (busy) return;
    setBusy('save');
    setError(null);
    setNotice(null);
    try {
      const uri = await capture();
      await savePngToMediaLibrary(uri);
      setNotice('已保存到相册「MaiMate」');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败，请重试');
    } finally {
      setBusy(null);
    }
  }, [busy, capture]);

  if (!visible) return null;

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onClose} accessibilityLabel="关闭卡片预览" />
      <View collapsable={false} ref={holderRef} style={styles.cardHolder}>
        {card}
      </View>
      {!ready && (
        <View style={styles.preparingRow}>
          <ActivityIndicator size="small" color={Colors.accent.secondary} />
          <Text style={styles.preparingText}>正在生成卡片…</Text>
        </View>
      )}
      {ready && (
        <View style={styles.actions}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          {notice && <Text style={styles.noticeText}>{notice}</Text>}
          <View style={styles.buttonRow}>
            <Pressable style={[styles.button, styles.buttonClose]} onPress={onClose} disabled={busy !== null}>
              <Text style={styles.buttonCloseText}>关闭</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.buttonSave, busy === 'save' && styles.buttonDisabled]} onPress={() => void handleSave()}>
              {busy === 'save'
                ? <ActivityIndicator size="small" color="#04140c" />
                : <Text style={styles.buttonSaveText}>存相册</Text>}
            </Pressable>
            <Pressable style={[styles.button, styles.buttonShare, busy === 'share' && styles.buttonDisabled]} onPress={() => void handleShare()}>
              {busy === 'share'
                ? <ActivityIndicator size="small" color="#1a0a14" />
                : <Text style={styles.buttonShareText}>分享</Text>}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(6, 6, 14, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    // 覆盖页面内其他绝对定位元素。
    elevation: 24,
    zIndex: 24,
  },
  cardHolder: { alignItems: 'center', justifyContent: 'center', maxHeight: '72%' },
  preparingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  preparingText: { fontSize: 12, color: Colors.text.secondary },
  actions: { alignItems: 'center', marginTop: 16, gap: 8 },
  buttonRow: { flexDirection: 'row', gap: 10 },
  button: {
    minWidth: 92,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  buttonClose: { backgroundColor: Colors.bg.tertiary, borderWidth: 1, borderColor: Colors.border.light },
  buttonCloseText: { fontSize: 13, fontWeight: '800', color: Colors.text.secondary },
  buttonSave: { backgroundColor: '#3dd68c' },
  buttonSaveText: { fontSize: 13, fontWeight: '900', color: '#04140c' },
  buttonShare: { backgroundColor: Colors.accent.primary },
  buttonShareText: { fontSize: 13, fontWeight: '900', color: '#1a0a14' },
  buttonDisabled: { opacity: 0.6 },
  errorText: { fontSize: 11, color: Colors.functional.danger, textAlign: 'center' },
  noticeText: { fontSize: 11, color: Colors.functional.success, textAlign: 'center' },
});
