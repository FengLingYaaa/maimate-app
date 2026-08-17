# MaiMate — 舞萌伴侣

> Read the exact versioned Expo docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Quick Start

```bash
cd /home/agent/dsh-workspace/maimate/app
npm install
npx expo start
```

## Architecture

- **Expo SDK 57** with Expo Router (file-based routing)
- **State**: Zustand stores in `src/store/`
- **Data**: Diving-Fish Prober API → `src/api/prober.ts` → `src/data/music-list.ts` (10-dimension filter engine)
- **UI**: Custom components in `src/components/`, styled with `StyleSheet.create`
- **Theme**: Deep dark (#0f0f1a) with neon pink/purple/cyan accents — "霓虹舞伴"

## Prober API

- Public: `GET https://www.diving-fish.com/api/maimaidxprober/music_data`
- No auth for music data; cache aggressively
- License: MIT — include attribution

## Docs

- Full design: `docs/DESIGN.md`
- Colors: `src/constants/colors.ts`
- Game constants: `src/constants/game.ts`
