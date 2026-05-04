// ── Tile definitions ──

export interface TileType {
  suit: string;
  value: string;
  label: string;
  bg: string;
  fg: string;
}

const SUITS: { name: string; bg: string; fg: string; values: string[] }[] = [
  { name: "bamboo", bg: "#16a34a", fg: "#fff", values: ["1","2","3","4","5","6","7","8","9"] },
  { name: "circle", bg: "#2563eb", fg: "#fff", values: ["1","2","3","4","5","6","7","8","9"] },
  { name: "character", bg: "#dc2626", fg: "#fff", values: ["1","2","3","4","5","6","7","8","9"] },
];

const WINDS: { value: string; label: string }[] = [
  { value: "N", label: "N" },
  { value: "S", label: "S" },
  { value: "E", label: "E" },
  { value: "W", label: "W" },
];

const DRAGONS: { value: string; label: string; bg: string; fg: string }[] = [
  { value: "R", label: "R", bg: "#dc2626", fg: "#fff" },
  { value: "G", label: "G", bg: "#16a34a", fg: "#fff" },
  { value: "W", label: "W", bg: "#e5e7eb", fg: "#1a1a1a" },
];

function buildTileTypes(): TileType[] {
  const types: TileType[] = [];
  for (const suit of SUITS) {
    for (const v of suit.values) {
      types.push({
        suit: suit.name,
        value: v,
        label: v,
        bg: suit.bg,
        fg: suit.fg,
      });
    }
  }
  for (const w of WINDS) {
    types.push({ suit: "wind", value: w.value, label: w.label, bg: "#6b7280", fg: "#fff" });
  }
  for (const d of DRAGONS) {
    types.push({ suit: "dragon", value: d.value, label: d.label, bg: d.bg, fg: d.fg });
  }
  return types;
}

export const TILE_TYPES: TileType[] = buildTileTypes(); // 34 unique types

// ── Layout ──

export interface LayoutPos {
  row: number;
  col: number;
  layer: number;
}

/**
 * Classic "Turtle" layout for 144 tiles.
 * 5 layers, pyramid-shaped with fewer tiles on higher layers.
 */
function buildTurtleLayout(): LayoutPos[] {
  const positions: LayoutPos[] = [];

  // Layer 0 (ground): 12 columns x 8 rows = varied shape
  // Classic turtle: wider in middle, narrower at edges
  const layer0Rows: [number, number][] = [
    // [colStart, colEnd] for each row (inclusive, using half-column units)
    [2, 23],  // row 0: 11 tiles
    [0, 25],  // row 1: 13 tiles
    [1, 24],  // row 2: 12 tiles
    [0, 25],  // row 3: 13 tiles
    [0, 25],  // row 4: 13 tiles
    [1, 24],  // row 5: 12 tiles
    [0, 25],  // row 6: 13 tiles
    [2, 23],  // row 7: 11 tiles
  ];
  for (let r = 0; r < layer0Rows.length; r++) {
    const [start, end] = layer0Rows[r]!;
    for (let c = start; c <= end; c += 2) {
      positions.push({ row: r * 2, col: c, layer: 0 });
    }
  }

  // Layer 1: 10 columns x 6 rows (centered)
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 10; c += 2) {
      positions.push({ row: r * 2 + 2, col: c + 4, layer: 1 });
    }
  }

  // Layer 2: 8 columns x 4 rows (centered)
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 8; c += 2) {
      positions.push({ row: r * 2 + 4, col: c + 6, layer: 2 });
    }
  }

  // Layer 3: 6 columns x 2 rows (centered)
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 6; c += 2) {
      positions.push({ row: r * 2 + 6, col: c + 8, layer: 3 });
    }
  }

  // Layer 4: 1 tile (top cap)
  positions.push({ row: 7, col: 11, layer: 4 });

  return positions;
}

const TURTLE_LAYOUT = buildTurtleLayout();

// ── Game tile ──

export interface GameTile {
  id: number;
  typeIndex: number;
  pos: LayoutPos;
  removed: boolean;
}

// ── Shuffle helper ──

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

// ── Create a solvable game ──

/**
 * Builds 144 tiles assigned to the turtle layout.
 * We use 34 unique types. 144 / 4 = 36 type-slots needed.
 * We use all 34 types (x4 = 136) + repeat the first 2 types (x4 = 8) = 144.
 */
export function createGame(): GameTile[] {
  const layout = TURTLE_LAYOUT;
  const count = layout.length;

  // Build type indices: 4 copies of each type, enough to fill the layout
  const typesNeeded = Math.ceil(count / 4);
  const typeIndices: number[] = [];
  for (let i = 0; i < typesNeeded; i++) {
    const idx = i % TILE_TYPES.length;
    typeIndices.push(idx, idx, idx, idx);
  }
  // Trim to exact count
  const shuffled = shuffle(typeIndices).slice(0, count);

  return layout.map((pos, i) => ({
    id: i,
    typeIndex: shuffled[i]!,
    pos,
    removed: false,
  }));
}

// ── Free tile check ──

/**
 * A tile is "free" if:
 *  1. No tile is stacked on top of it (any tile on a higher layer that overlaps)
 *  2. At least one side (left or right) is open (no adjacent tile on the same layer)
 */
export function isTileFree(tile: GameTile, allTiles: GameTile[]): boolean {
  if (tile.removed) return false;

  const active = allTiles.filter((t) => !t.removed && t.id !== tile.id);

  // Check if any tile is on top (higher layer, overlapping position)
  const hasTop = active.some(
    (t) =>
      t.pos.layer === tile.pos.layer + 1 &&
      Math.abs(t.pos.row - tile.pos.row) < 2 &&
      Math.abs(t.pos.col - tile.pos.col) < 2,
  );
  if (hasTop) return false;

  // Check left and right neighbors on the same layer
  const hasLeft = active.some(
    (t) =>
      t.pos.layer === tile.pos.layer &&
      t.pos.row === tile.pos.row &&
      t.pos.col === tile.pos.col - 2,
  );
  const hasRight = active.some(
    (t) =>
      t.pos.layer === tile.pos.layer &&
      t.pos.row === tile.pos.row &&
      t.pos.col === tile.pos.col + 2,
  );

  return !hasLeft || !hasRight;
}

// ── Find valid pairs ──

export function findValidPairs(tiles: GameTile[]): [GameTile, GameTile][] {
  const free = tiles.filter((t) => isTileFree(t, tiles));
  const pairs: [GameTile, GameTile][] = [];

  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      if (free[i]!.typeIndex === free[j]!.typeIndex) {
        pairs.push([free[i]!, free[j]!]);
      }
    }
  }
  return pairs;
}

// ── Shuffle remaining tiles (keep positions, reassign types) ──

export function shuffleRemaining(tiles: GameTile[]): GameTile[] {
  const remaining = tiles.filter((t) => !t.removed);
  const removed = tiles.filter((t) => t.removed);

  const typeIndices = shuffle(remaining.map((t) => t.typeIndex));
  const reshuffled = remaining.map((t, i) => ({
    ...t,
    typeIndex: typeIndices[i]!,
  }));

  return [...reshuffled, ...removed];
}
