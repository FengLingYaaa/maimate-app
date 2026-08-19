import React, { useEffect, useMemo, useState } from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';
import { getCoverCandidates } from '../data/cover-resolver';
import type { MusicData } from '../data/types';

interface Props {
  music: MusicData;
  allSongs?: MusicData[];
  style: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
}

const PLACEHOLDER = require('../../assets/icon.png');

export function CoverImage({ music, allSongs = [], style, accessibilityLabel }: Props) {
  const candidates = useMemo(() => getCoverCandidates(music, allSongs), [music, allSongs]);
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [music.type, music.id, candidates.length]);

  const source = candidateIndex < candidates.length
    ? { uri: candidates[candidateIndex] }
    : PLACEHOLDER;

  return (
    <Image
      source={source}
      style={style}
      defaultSource={PLACEHOLDER}
      onError={() => {
        setCandidateIndex(index => Math.min(index + 1, candidates.length));
      }}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
