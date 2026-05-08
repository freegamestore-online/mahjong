import { useState, useCallback, useEffect, useRef } from "react";
import {
  TILE_TYPES,
  createGame,
  isTileFree,
  findValidPairs,
  shuffleRemaining,
} from "../lib/mahjong";
import type { GameTile } from "../lib/mahjong";

interface GameProps {
  onScore: (score: number) => void;
  onGameOver: () => void;
}

const TILE_W = 50;
const TILE_H = 65;
const LAYER_OFFSET_X = 4;
const LAYER_OFFSET_Y = 4;

export function Game({ onScore, onGameOver }: GameProps) {
  const [tiles, setTiles] = useState<GameTile[]>(() => createGame());
  const [selected, setSelected] = useState<number | null>(null);
  const [hintPair, setHintPair] = useState<[number, number] | null>(null);
  const [startTime] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const onScoreRef = useRef(onScore);
  const onGameOverRef = useRef(onGameOver);
  onScoreRef.current = onScore;
  onGameOverRef.current = onGameOver;

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 200);
    return () => clearInterval(timerRef.current);
  }, [startTime]);

  // Check win / stuck after each tile change
  useEffect(() => {
    const remaining = tiles.filter((t) => !t.removed);
    if (remaining.length === 0) {
      // Win!
      clearInterval(timerRef.current);
      const seconds = Math.floor((Date.now() - startTime) / 1000);
      const score = Math.max(0, 10000 - seconds);
      onScoreRef.current(score);
      onGameOverRef.current();
      return;
    }
    const pairs = findValidPairs(tiles);
    if (pairs.length === 0 && remaining.length > 0) {
      // Stuck — auto-shuffle
      setTiles(shuffleRemaining(tiles));
    }
  }, [tiles, startTime]);

  const handleTileClick = useCallback(
    (tile: GameTile) => {
      if (tile.removed) return;
      if (!isTileFree(tile, tiles)) return;

      setHintPair(null);

      if (selected === null) {
        setSelected(tile.id);
        return;
      }

      if (selected === tile.id) {
        setSelected(null);
        return;
      }

      const first = tiles.find((t) => t.id === selected);
      if (!first || first.removed) {
        setSelected(tile.id);
        return;
      }

      if (first.typeIndex === tile.typeIndex) {
        // Match! Remove both.
        setTiles((prev) =>
          prev.map((t) =>
            t.id === first.id || t.id === tile.id ? { ...t, removed: true } : t,
          ),
        );
        setSelected(null);
      } else {
        // No match — select the new tile
        setSelected(tile.id);
      }
    },
    [tiles, selected],
  );

  const handleHint = useCallback(() => {
    const pairs = findValidPairs(tiles);
    if (pairs.length > 0) {
      const pair = pairs[0]!;
      setHintPair([pair[0].id, pair[1].id]);
      setSelected(null);
    }
  }, [tiles]);

  const handleShuffle = useCallback(() => {
    setTiles(shuffleRemaining(tiles));
    setSelected(null);
    setHintPair(null);
  }, [tiles]);

  // Compute free set for highlighting
  const freeSet = new Set<number>();
  for (const t of tiles) {
    if (!t.removed && isTileFree(t, tiles)) {
      freeSet.add(t.id);
    }
  }

  // Compute board bounding box to center
  const activeTiles = tiles.filter((t) => !t.removed);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const t of activeTiles) {
    const x = t.pos.col * (TILE_W / 2) + t.pos.layer * LAYER_OFFSET_X;
    const y = t.pos.row * (TILE_H / 2) - t.pos.layer * LAYER_OFFSET_Y;
    if (x < minX) minX = x;
    if (x + TILE_W > maxX) maxX = x + TILE_W;
    if (y < minY) minY = y;
    if (y + TILE_H > maxY) maxY = y + TILE_H;
  }
  const boardW = maxX - minX;
  const boardH = maxY - minY;

  const remaining = tiles.filter((t) => !t.removed).length;
  const pairs = findValidPairs(tiles).length;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-2 shrink-0 border-b"
        style={{ borderColor: "var(--line)", background: "var(--panel)" }}
      >
        <div className="flex items-center gap-4 text-sm">
          <span>
            Tiles: <strong>{remaining}</strong>
          </span>
          <span>
            Pairs: <strong>{pairs}</strong>
          </span>
          <span>
            Time: <strong>{formatTime(elapsed)}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleHint}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold min-h-[2.75rem]"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            Hint
          </button>
          <button
            onClick={handleShuffle}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold min-h-[2.75rem]"
            style={{ background: "var(--line-strong)", color: "var(--ink)" }}
          >
            Shuffle
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        <div
          style={{
            position: "relative",
            width: boardW,
            height: boardH,
          }}
        >
          {/* Render tiles sorted by layer (back to front), then row, then col */}
          {tiles
            .filter((t) => !t.removed)
            .sort(
              (a, b) =>
                a.pos.layer - b.pos.layer ||
                a.pos.row - b.pos.row ||
                a.pos.col - b.pos.col,
            )
            .map((tile) => {
              const tileType = TILE_TYPES[tile.typeIndex % TILE_TYPES.length]!;
              const free = freeSet.has(tile.id);
              const isSelected = selected === tile.id;
              const isHinted =
                hintPair !== null &&
                (hintPair[0] === tile.id || hintPair[1] === tile.id);

              const x =
                tile.pos.col * (TILE_W / 2) +
                tile.pos.layer * LAYER_OFFSET_X -
                minX;
              const y =
                tile.pos.row * (TILE_H / 2) -
                tile.pos.layer * LAYER_OFFSET_Y -
                minY;

              let borderColor = "var(--line-strong)";
              if (isSelected) borderColor = "var(--accent)";
              else if (isHinted) borderColor = "var(--warning)";

              const suitLabel =
                tileType.suit === "bamboo"
                  ? "B"
                  : tileType.suit === "circle"
                    ? "C"
                    : tileType.suit === "character"
                      ? "K"
                      : "";

              return (
                <button
                  key={tile.id}
                  onClick={() => handleTileClick(tile)}
                  disabled={!free}
                  style={{
                    position: "absolute",
                    left: x,
                    top: y,
                    width: TILE_W,
                    height: TILE_H,
                    zIndex: tile.pos.layer * 100 + tile.pos.row,
                    background: tileType.bg,
                    color: tileType.fg,
                    border: `2px solid ${borderColor}`,
                    borderRadius: 6,
                    boxShadow: isSelected
                      ? "0 0 0 2px var(--accent)"
                      : isHinted
                        ? "0 0 0 2px var(--warning)"
                        : `${tile.pos.layer * 2}px ${tile.pos.layer * 2}px ${tile.pos.layer * 3}px rgba(0,0,0,0.35)`,
                    opacity: free ? 1 : 0.7,
                    cursor: free ? "pointer" : "default",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                    fontFamily: "Manrope, system-ui, sans-serif",
                    fontWeight: 700,
                    fontSize: 18,
                    lineHeight: 1,
                    transition: "box-shadow 0.15s, border-color 0.15s",
                  }}
                >
                  <span>{tileType.label}</span>
                  {suitLabel && (
                    <span style={{ fontSize: 9, opacity: 0.8, marginTop: 2 }}>
                      {suitLabel}
                    </span>
                  )}
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
