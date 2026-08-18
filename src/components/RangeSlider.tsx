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

function roundToStep(value: number, step: number): number {
  const decimals = step.toString().split('.')[1]?.length ?? 0;
  return Number(value.toFixed(decimals));
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
          minimumValue={min}
          maximumValue={max}
          step={step}
          value={lower}
          minimumTrackTintColor={Colors.accent.primary}
          maximumTrackTintColor={Colors.bg.tertiary}
          thumbTintColor={Colors.accent.primary}
          onValueChange={next => {
            const nextLower = Math.min(roundToStep(next, step), upper);
            onChange([nextLower, upper]);
          }}
        />
        <Text style={styles.edge}>{max.toFixed(1)}</Text>
      </View>
      <View style={styles.sliderRow}>
        <Text style={styles.edge}>{min.toFixed(1)}</Text>
        <Slider
          style={styles.slider}
          minimumValue={min}
          maximumValue={max}
          step={step}
          value={upper}
          minimumTrackTintColor={Colors.accent.secondary}
          maximumTrackTintColor={Colors.bg.tertiary}
          thumbTintColor={Colors.accent.secondary}
          onValueChange={next => {
            const nextUpper = Math.max(roundToStep(next, step), lower);
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