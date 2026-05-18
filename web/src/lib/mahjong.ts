// ── Tile types ──
// 36 distinct face types × 4 copies = 144 tiles.
// Faces use Unicode mahjong tile codepoints (U+1F000..U+1F02B).

export interface TileType {
  glyph: string;
  group: "wind" | "dragon" | "character" | "bamboo" | "circle" | "flower";
  accent: "red" | "green" | "blue" | "dark";
}

function range(start: number, count: number): string[] {
  return Array.from({ length: count }, (_, i) => String.fromCodePoint(start + i));
}

export const TILE_TYPES: TileType[] = [
  // Winds 🀀🀁🀂🀃
  ...range(0x1f000, 4).map((g) => ({ glyph: g, group: "wind" as const, accent: "dark" as const })),
  // Dragons: 🀄 red, 🀅 green, 🀆 white
  { glyph: "🀄", group: "dragon", accent: "red" },
  { glyph: "🀅", group: "dragon", accent: "green" },
  { glyph: "🀆", group: "dragon", accent: "dark" },
  // Characters (man) 🀇..🀏
  ...range(0x1f007, 9).map((g) => ({
    glyph: g,
    group: "character" as const,
    accent: "red" as const,
  })),
  // Bamboo 🀐..🀘
  ...range(0x1f010, 9).map((g) => ({
    glyph: g,
    group: "bamboo" as const,
    accent: "green" as const,
  })),
  // Circles 🀙..🀡
  ...range(0x1f019, 9).map((g) => ({
    glyph: g,
    group: "circle" as const,
    accent: "blue" as const,
  })),
  // Flowers (only 2 needed to reach 36): 🀢 plum, 🀤 chrysanthemum
  { glyph: "🀢", group: "flower", accent: "red" },
  { glyph: "🀤", group: "flower", accent: "green" },
];

if (TILE_TYPES.length !== 36) {
  throw new Error(`TILE_TYPES must have 36 entries, got ${TILE_TYPES.length}`);
}

// ── Layout ──
// Coordinates are integer tile-grid units. A tile at (row, col, layer)
// occupies one cell. A higher-layer tile at the same (row, col) is stacked
// directly on top. Left/right neighbors are at col±1 on the same layer.

export interface LayoutPos {
  row: number;
  col: number;
  layer: number;
}

/**
 * Builds a 144-tile pyramid: 88 + 36 + 16 + 4.
 * Symmetric, mobile-friendly, four-layer stack.
 */
function buildLayout(): LayoutPos[] {
  const positions: LayoutPos[] = [];

  // Layer 0 — 88 tiles, diamond-tapered footprint (9 rows × up to 12 cols)
  const layer0Cols: [number, number][] = [
    [3, 8], // row 0: 6 tiles
    [2, 9], // row 1: 8 tiles
    [0, 11], // row 2: 12 tiles
    [0, 11], // row 3: 12 tiles
    [0, 11], // row 4: 12 tiles
    [0, 11], // row 5: 12 tiles
    [0, 11], // row 6: 12 tiles
    [2, 9], // row 7: 8 tiles
    [3, 8], // row 8: 6 tiles
  ];
  for (let r = 0; r < layer0Cols.length; r++) {
    const [s, e] = layer0Cols[r]!;
    for (let c = s; c <= e; c++) positions.push({ row: r, col: c, layer: 0 });
  }

  // Layer 1 — 36 tiles (6 rows × 6 cols, centered)
  for (let r = 2; r <= 7; r++)
    for (let c = 3; c <= 8; c++) positions.push({ row: r, col: c, layer: 1 });

  // Layer 2 — 16 tiles (4 rows × 4 cols, centered)
  for (let r = 3; r <= 6; r++)
    for (let c = 4; c <= 7; c++) positions.push({ row: r, col: c, layer: 2 });

  // Layer 3 — 4 tiles (2 rows × 2 cols, top cap)
  for (let r = 4; r <= 5; r++)
    for (let c = 5; c <= 6; c++) positions.push({ row: r, col: c, layer: 3 });

  return positions;
}

export const LAYOUT: LayoutPos[] = buildLayout();

if (LAYOUT.length !== 144) {
  throw new Error(`LAYOUT must have 144 positions, got ${LAYOUT.length}`);
}

// ── Game tile ──

export interface GameTile {
  id: number;
  typeIndex: number;
  pos: LayoutPos;
  removed: boolean;
}

// ── Helpers ──

function shuffleInPlace<T>(a: T[]): void {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
}

function key(r: number, c: number, l: number): string {
  return `${r},${c},${l}`;
}

// "Free for removal" predicate given a set of present positions.
function freeWith(p: LayoutPos, present: Set<string>): boolean {
  if (present.has(key(p.row, p.col, p.layer + 1))) return false;
  const left = present.has(key(p.row, p.col - 1, p.layer));
  const right = present.has(key(p.row, p.col + 1, p.layer));
  return !(left && right);
}

// ── Solvable removal order via greedy forward simulation ──
//
// We start with the full layout populated, repeatedly pick any two free tiles,
// and remove them — recording the pairing. The recorded sequence IS the forward
// removal order; once we assign matching types to each recorded pair, every
// recorded removal becomes a valid Mahjong move.

function buildRemovalOrder(): [number, number][] | null {
  const active = new Set<number>(LAYOUT.map((_, i) => i));
  const present = new Set<string>();
  for (const p of LAYOUT) present.add(key(p.row, p.col, p.layer));

  const pairs: [number, number][] = [];
  while (active.size > 0) {
    const free: number[] = [];
    for (const i of active) {
      if (freeWith(LAYOUT[i]!, present)) free.push(i);
    }
    if (free.length < 2) return null;

    shuffleInPlace(free);
    const a = free[0]!;
    const b = free[1]!;
    pairs.push([a, b]);
    active.delete(a);
    active.delete(b);
    const pa = LAYOUT[a]!;
    const pb = LAYOUT[b]!;
    present.delete(key(pa.row, pa.col, pa.layer));
    present.delete(key(pb.row, pb.col, pb.layer));
  }
  return pairs;
}

// ── Public: create a new solvable game ──

export interface NewGame {
  tiles: GameTile[];
  /**
   * Pair-removal sequence (tile-id pairs) guaranteed to clear the board when
   * applied in order. This is the reverse of the construction order — the
   * last pair built in reverse-construction is the first pair removable from
   * the full board.
   */
  solution: [number, number][];
}

export function createGame(): NewGame {
  let solution: [number, number][] | null = null;
  for (let attempt = 0; attempt < 50 && solution === null; attempt++) {
    solution = buildRemovalOrder();
  }
  if (solution === null) {
    // The greedy forward simulation should never fail on this layout, but if
    // it ever does we surface a hard error rather than silently shipping an
    // unsolvable board.
    throw new Error("Mahjong: failed to build a solvable removal order");
  }

  // 36 types × 2 pairs each = 72 pair slots, shuffled so two distant pairs
  // can share a type.
  const typeForPair: number[] = [];
  for (let t = 0; t < TILE_TYPES.length; t++) typeForPair.push(t, t);
  shuffleInPlace(typeForPair);

  const tiles: GameTile[] = LAYOUT.map((pos, i) => ({
    id: i,
    typeIndex: -1,
    pos,
    removed: false,
  }));
  for (let i = 0; i < solution.length; i++) {
    const [a, b] = solution[i]!;
    const t = typeForPair[i]!;
    tiles[a]!.typeIndex = t;
    tiles[b]!.typeIndex = t;
  }
  return { tiles, solution };
}

// ── Forward-play helpers ──

export function isTileFree(tile: GameTile, all: GameTile[]): boolean {
  if (tile.removed) return false;
  const present = new Set<string>();
  for (const t of all) {
    if (!t.removed && t.id !== tile.id) present.add(key(t.pos.row, t.pos.col, t.pos.layer));
  }
  return freeWith(tile.pos, present);
}

export function findValidPairs(tiles: GameTile[]): [GameTile, GameTile][] {
  const free = tiles.filter((t) => isTileFree(t, tiles));
  const pairs: [GameTile, GameTile][] = [];
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      if (free[i]!.typeIndex === free[j]!.typeIndex) pairs.push([free[i]!, free[j]!]);
    }
  }
  return pairs;
}

export function shuffleRemaining(tiles: GameTile[]): GameTile[] {
  const remaining = tiles.filter((t) => !t.removed);
  const removed = tiles.filter((t) => t.removed);
  const types = remaining.map((t) => t.typeIndex);
  shuffleInPlace(types);
  const reshuffled = remaining.map((t, i) => ({ ...t, typeIndex: types[i]! }));
  return [...reshuffled, ...removed];
}
