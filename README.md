# Mahjong

Classic Mahjong Solitaire — 144 tiles, four layers, a guaranteed-solvable shuffle every game. Free forever, MIT-licensed, no tracking. Part of [FreeGameStore](https://freegamestore.online).

**Play:** [mahjong.freegamestore.online](https://mahjong.freegamestore.online)

## How to play

Match pairs of identical free tiles to remove them; clear the board to win.

- A tile is **free** when nothing sits on top of it **and** at least one of its left/right neighbours is missing.
- Tap a free tile to select it, then tap its match. Mismatches just change the selection.
- **Hint** highlights an available pair. **Shuffle** re-randomises the remaining tiles in place — use it when no pairs are left.
- Score = `max(0, 10000 − 5·seconds)` on clear. Best score is kept locally; global leaderboard via FreeGameStore identity.

The deck is built by reverse-construction: tiles are placed onto an empty board only when they would be removable, so every game is provably winnable from the starting layout. If a shuffle leaves you with no matches, just hit Shuffle again — the layout never becomes terminally stuck.

## Develop

Requires Node ≥22 and pnpm 10.

```bash
pnpm install
pnpm dev          # vite dev server
pnpm build        # tsc + vite build
pnpm typecheck    # tsc -b (no emit)
pnpm test         # vitest run
```

The single workspace package lives at [`web/`](./web/). Game logic is in [`web/src/lib/mahjong.ts`](./web/src/lib/mahjong.ts); the React UI is in [`web/src/components/Game.tsx`](./web/src/components/Game.tsx). Shared store chrome (top bar, auth, leaderboard) comes from [`@freegamestore/games`](https://www.npmjs.com/package/@freegamestore/games).

## Deploy

`git push origin main` — Cloudflare Pages auto-deploys to `mahjong.freegamestore.online`.

## License

MIT — see [LICENSE](./LICENSE).
