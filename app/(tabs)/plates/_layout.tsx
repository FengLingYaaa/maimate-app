import React from 'react';
import { Stack } from 'expo-router';
import { Colors } from '../../../src/constants';

export default function PlatesStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: Colors.bg.primary },
        headerTintColor: Colors.text.primary,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: Colors.bg.primary },
      }}
    />
  );
}
