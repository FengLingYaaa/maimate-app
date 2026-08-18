import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { Colors } from '../constants';

interface Props {
  value: [number, number];
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: [number, number]) => void;
  label?: string;
}

export function RangeSlider({
  value,
  min = 0,
  max = 15,
  step = 0.1,
  onChange,
  label = '定数范围',
}: Props) {
  const [lower, upper] = value;
  // Android's native Slider can quantize the final decimal steps incorrectly.
  // Store/render the slider in integer step units (0..150 for 0.0..15.0).
  const scale = Math.round(1 / step);
  const minUnit = Math.round(min * scale);
  const maxUnit = Math.round(max * scale);
  const lowerUnit = Math.round(lower * scale);
  const upperUnit = Math.round(upper * scale);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{lower.toFixed(1)} ～ {upper.toFixed(1)}</Text>
      </View>
      <View style={styles.sliderRow}>
        <Text style={styles.edge}>{min.toFixed(1)}</Text>
        <Slider
          style={styles.slider}
          minimumValue={minUnit}
          maximumValue={maxUnit}
          step={1}
          value={lowerUnit}
          minimumTrackTintColor={Colors.accent.primary}
          maximumTrackTintColor={Colors.bg.tertiary}
          thumbTintColor={Colors.accent.primary}
          onValueChange={next => {
            const nextLower = Math.min(Number((next / scale).toFixed(1)), upper);
            onChange([nextLower, upper]);
          }}
        />
        <Text style={styles.edge}>{max.toFixed(1)}</Text>
      </View>
      <View style={styles.sliderRow}>
        <Text style={styles.edge}>{min.toFixed(1)}</Text>
        <Slider
          style={styles.slider}
          minimumValue={minUnit}
          maximumValue={maxUnit}
          step={1}
          value={upperUnit}
          minimumTrackTintColor={Colors.accent.secondary}
          maximumTrackTintColor={Colors.bg.tertiary}
          thumbTintColor={Colors.accent.secondary}
          onValueChange={next => {
            const nextUpper = Math.max(Number((next / scale).toFixed(1)), lower);
            onChange([lower, nextUpper]);
          }}
        />
        <Text style={styles.edge}>{max.toFixed(1)}</Text>
      </View>
      <View style={styles.legendRow}>
        <Text style={styles.legendText}>下限</Text>
        <Text style={styles.legendText}>上限</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
    padding: 10,
    borderRadius: 12,
    backgroundColor: Colors.bg.tertiary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.secondary,
  },
  value: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.accent.primary,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  slider: {
    flex: 1,
    height: 34,
  },
  edge: {
    width: 30,
    fontSize: 9,
    color: Colors.text.muted,
    textAlign: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: -2,
  },
  legendText: {
    fontSize: 10,
    color: Colors.text.muted,
  },
});