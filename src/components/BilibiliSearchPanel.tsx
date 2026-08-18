import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { Colors, DifficultyColorMap, DifficultyLabels } from '../constants';
import {
  getBilibiliAppSearchUrl,
  getBilibiliSearchUrl,
  isBilibiliSearchDifficulty,
} from '../data/bilibili-search';

interface Props {
  songTitle: string;
  difficultyIndex: number;
}

export function BilibiliSearchPanel({ songTitle, difficultyIndex }: Props) {
  if (!isBilibiliSearchDifficulty(difficultyIndex)) return null;

  const difficultyLabel = DifficultyLabels[difficultyIndex];
  const difficultyColor = DifficultyColorMap[difficultyIndex];
  const searchUrl = getBilibiliSearchUrl(songTitle, difficultyLabel);
  const appSearchUrl = getBilibiliAppSearchUrl(songTitle, difficultyLabel);

  const openSearch = async () => {
    try {
      await Linking.openURL(appSearchUrl);
      return;
    } catch {
      // Bilibili is not installed or does not accept this deep link.
    }

    try {
      await Linking.openURL(searchUrl);
    } catch {
      // Keep the detail page usable even if the external handler is unavailable.
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Bilibili 搜索</Text>
        <Text style={[styles.difficulty, { color: difficultyColor }]}>{difficultyLabel}</Text>
      </View>
      <Pressable
        style={({ pressed }) => [styles.searchButton, pressed && styles.searchButtonPressed]}
        onPress={() => void openSearch()}
        accessibilityRole="button"
        accessibilityLabel={`在 Bilibili 搜索 ${songTitle} ${difficultyLabel}`}
      >
        <Text style={styles.searchButtonText}>去 Bilibili 搜索该谱面</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.bg.tertiary,
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  difficulty: {
    fontSize: 11,
    fontWeight: '800',
  },
  searchButton: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: `${Colors.accent.secondary}22`,
    borderWidth: 1,
    borderColor: Colors.accent.secondary,
  },
  searchButtonPressed: {
    opacity: 0.72,
  },
  searchButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.accent.secondary,
  },
});
