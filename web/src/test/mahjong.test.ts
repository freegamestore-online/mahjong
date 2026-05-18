import { describe, expect, it } from "vitest";
import {
  createGame,
  type GameTile,
  isTileFree,
  LAYOUT,
  shuffleRemaining,
  TILE_TYPES,
} from "../lib/mahjong";

describe("mahjong layout", () => {
  it("has exactly 144 positions", () => {
    expect(LAYOUT.length).toBe(144);
  });

  it("has 36 distinct tile types", () => {
    expect(TILE_TYPES.length).toBe(36);
    const glyphs = new Set(TILE_TYPES.map((t) => t.glyph));
    expect(glyphs.size).toBe(36);
  });

  it("has no two positions at the same (row, col, layer)", () => {
    const seen = new Set<string>();
    for (const p of LAYOUT) {
      const k = `${p.row},${p.col},${p.layer}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
  });
});

describe("createGame", () => {
  it("returns 144 tiles", () => {
    const { tiles } = createGame();
    expect(tiles.length).toBe(144);
  });

  it("has 4 copies of every type", () => {
    const { tiles } = createGame();
    const counts = new Map<number, number>();
    for (const t of tiles) counts.set(t.typeIndex, (counts.get(t.typeIndex) ?? 0) + 1);
    expect(counts.size).toBe(36);
    for (const c of counts.values()) expect(c).toBe(4);
  });

  // Run multiple seeds to catch any rare construction failure.
  it("produces a solvable game (play the recorded solution)", () => {
    for (let seed = 0; seed < 25; seed++) {
      const { tiles, solution } = createGame();
      expect(solution.length).toBe(72);
      let board: GameTile[] = tiles.map((t) => ({ ...t }));
      for (const [aId, bId] of solution) {
        const a = board[aId]!;
        const b = board[bId]!;
        expect(a.removed).toBe(false);
        expect(b.removed).toBe(false);
        expect(a.typeIndex).toBe(b.typeIndex);
        expect(isTileFree(a, board)).toBe(true);
        expect(isTileFree(b, board)).toBe(true);
        board = board.map((t) => (t.id === aId || t.id === bId ? { ...t, removed: true } : t));
      }
      expect(board.every((t) => t.removed)).toBe(true);
    }
  });

  it("initial state always has at least one playable pair", () => {
    for (let seed = 0; seed < 25; seed++) {
      const { tiles, solution } = createGame();
      const [aId, bId] = solution[0]!;
      expect(isTileFree(tiles[aId]!, tiles)).toBe(true);
      expect(isTileFree(tiles[bId]!, tiles)).toBe(true);
    }
  });
});

describe("isTileFree", () => {
  it("returns false if anything is stacked on top", () => {
    const { tiles } = createGame();
    const bottom = tiles.find((t) => t.pos.layer === 0)!;
    const above = tiles.find(
      (t) =>
        t.pos.layer === bottom.pos.layer + 1 &&
        t.pos.row === bottom.pos.row &&
        t.pos.col === bottom.pos.col,
    );
    if (above) {
      expect(isTileFree(bottom, tiles)).toBe(false);
    }
  });
});

describe("shuffleRemaining", () => {
  it("keeps the same set of active positions", () => {
    const { tiles } = createGame();
    const reshuffled = shuffleRemaining(tiles);
    expect(reshuffled.length).toBe(tiles.length);
    const activeBefore = tiles
      .filter((t) => !t.removed)
      .map((t) => t.id)
      .sort();
    const activeAfter = reshuffled
      .filter((t) => !t.removed)
      .map((t) => t.id)
      .sort();
    expect(activeAfter).toEqual(activeBefore);
  });
});
