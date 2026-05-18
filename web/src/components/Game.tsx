import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameTile } from "../lib/mahjong";
import {
  createGame,
  findValidPairs,
  isTileFree,
  shuffleRemaining,
  TILE_TYPES,
} from "../lib/mahjong";

interface GameProps {
  onScore: (score: number) => void;
  onGameOver: () => void;
}

// Tile dimensions (CSS pixels in the un-scaled layout).
const TILE_W = 52;
const TILE_H = 68;
// Per-layer pixel offset that gives the stack its 3D look.
const LAYER_DX = 4;
const LAYER_DY = 5;

const ACCENT_COLOR: Record<string, string> = {
  red: "#dc2626",
  green: "#16a34a",
  blue: "#2563eb",
  dark: "#1a1a1a",
};

export function Game({ onScore, onGameOver }: GameProps) {
  const [tiles, setTiles] = useState<GameTile[]>(() => createGame().tiles);
  const [selected, setSelected] = useState<number | null>(null);
  const [hintPair, setHintPair] = useState<[number, number] | null>(null);
  const [stuck, setStuck] = useState(false);
  const [startTime] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const onScoreRef = useRef(onScore);
  const onGameOverRef = useRef(onGameOver);
  onScoreRef.current = onScore;
  onGameOverRef.current = onGameOver;
  const wrapRef = useRef<HTMLDivElement>(null);

  // ── Timer ──
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 250);
    return () => clearInterval(timerRef.current);
  }, [startTime]);

  // ── Win / stuck detection (no auto-shuffle to avoid loops) ──
  useEffect(() => {
    const remaining = tiles.filter((t) => !t.removed);
    if (remaining.length === 0) {
      clearInterval(timerRef.current);
      const seconds = Math.floor((Date.now() - startTime) / 1000);
      const score = Math.max(0, 10000 - seconds * 5);
      onScoreRef.current(score);
      onGameOverRef.current();
      return;
    }
    setStuck(findValidPairs(tiles).length === 0);
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
        setTiles((prev) =>
          prev.map((t) => (t.id === first.id || t.id === tile.id ? { ...t, removed: true } : t)),
        );
        setSelected(null);
      } else {
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

  // ── Geometry: bounding box + free set ──
  const { freeSet, minX, minY, boardW, boardH } = useMemo(() => {
    const fs = new Set<number>();
    for (const t of tiles) {
      if (!t.removed && isTileFree(t, tiles)) fs.add(t.id);
    }
    let mnX = Infinity,
      mxX = -Infinity,
      mnY = Infinity,
      mxY = -Infinity;
    for (const t of tiles) {
      if (t.removed) continue;
      const x = t.pos.col * TILE_W + t.pos.layer * LAYER_DX;
      const y = t.pos.row * TILE_H - t.pos.layer * LAYER_DY;
      if (x < mnX) mnX = x;
      if (x + TILE_W > mxX) mxX = x + TILE_W;
      if (y < mnY) mnY = y;
      if (y + TILE_H > mxY) mxY = y + TILE_H;
    }
    return { freeSet: fs, minX: mnX, minY: mnY, boardW: mxX - mnX, boardH: mxY - mnY };
  }, [tiles]);

  // ── Auto-scale to fit viewport ──
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const recalc = () => {
      const el = wrapRef.current;
      if (!el) return;
      const padding = 16;
      const w = el.clientWidth - padding;
      const h = el.clientHeight - padding;
      if (w <= 0 || h <= 0 || boardW <= 0 || boardH <= 0) return;
      setScale(Math.min(w / boardW, h / boardH, 1.2));
    };
    recalc();
    const ro = new ResizeObserver(recalc);
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener("resize", recalc);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recalc);
    };
  }, [boardW, boardH]);

  const remainingCount = tiles.filter((t) => !t.removed).length;
  const pairCount = findValidPairs(tiles).length;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Status bar */}
      <div
        className="flex items-center justify-between px-4 py-2 shrink-0 border-b"
        style={{ borderColor: "var(--line)", background: "var(--panel)" }}
      >
        <div className="flex items-center gap-4 text-sm">
          <span>
            Tiles: <strong>{remainingCount}</strong>
          </span>
          <span>
            Pairs: <strong>{pairCount}</strong>
          </span>
          <span>
            Time: <strong>{formatTime(elapsed)}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleHint}
            disabled={pairCount === 0}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold min-h-[2.75rem]"
            style={{
              background: pairCount === 0 ? "var(--line-strong)" : "var(--accent)",
              color: "#fff",
              opacity: pairCount === 0 ? 0.6 : 1,
            }}
          >
            Hint
          </button>
          <button
            type="button"
            onClick={handleShuffle}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold min-h-[2.75rem]"
            style={{ background: "var(--line-strong)", color: "var(--ink)" }}
          >
            Shuffle
          </button>
        </div>
      </div>

      {/* Stuck banner */}
      {stuck && remainingCount > 0 && (
        <div
          className="px-4 py-2 text-sm text-center shrink-0"
          style={{ background: "var(--warning)", color: "#fff" }}
        >
          No matches available — tap <strong>Shuffle</strong> to keep playing.
        </div>
      )}

      {/* Board */}
      <div ref={wrapRef} className="flex-1 overflow-hidden flex items-center justify-center">
        <div
          style={{
            position: "relative",
            width: boardW,
            height: boardH,
            transform: `scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          {tiles
            .filter((t) => !t.removed)
            .sort(
              (a, b) => a.pos.layer - b.pos.layer || a.pos.row - b.pos.row || a.pos.col - b.pos.col,
            )
            .map((tile) => {
              const tt = TILE_TYPES[tile.typeIndex]!;
              const free = freeSet.has(tile.id);
              const isSel = selected === tile.id;
              const isHinted =
                hintPair !== null && (hintPair[0] === tile.id || hintPair[1] === tile.id);

              const x = tile.pos.col * TILE_W + tile.pos.layer * LAYER_DX - minX;
              const y = tile.pos.row * TILE_H - tile.pos.layer * LAYER_DY - minY;

              let outline = "rgba(0,0,0,0.18)";
              if (isSel) outline = "var(--accent)";
              else if (isHinted) outline = "var(--warning)";

              return (
                <button
                  type="button"
                  key={tile.id}
                  onClick={() => handleTileClick(tile)}
                  disabled={!free}
                  aria-label={`${tt.group} tile`}
                  style={{
                    position: "absolute",
                    left: x,
                    top: y,
                    width: TILE_W,
                    height: TILE_H,
                    zIndex: tile.pos.layer * 1000 + tile.pos.row * 20 + tile.pos.col,
                    background: free
                      ? "linear-gradient(180deg, #fefdf8 0%, #f1ead8 100%)"
                      : "linear-gradient(180deg, #ece6d4 0%, #d8d0bb 100%)",
                    color: ACCENT_COLOR[tt.accent],
                    border: `2px solid ${outline}`,
                    borderRadius: 8,
                    boxShadow: isSel
                      ? "0 0 0 3px var(--accent), 0 2px 4px rgba(0,0,0,0.2)"
                      : isHinted
                        ? "0 0 0 3px var(--warning), 0 2px 4px rgba(0,0,0,0.2)"
                        : "inset -2px -2px 0 rgba(0,0,0,0.08), inset 2px 2px 0 rgba(255,255,255,0.6), 1px 2px 3px rgba(0,0,0,0.25)",
                    opacity: free ? 1 : 0.85,
                    cursor: free ? "pointer" : "default",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                    fontFamily:
                      '"Noto Sans Mahjong", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", system-ui, sans-serif',
                    fontWeight: 500,
                    fontSize: 38,
                    lineHeight: 1,
                    transition: "transform 0.1s, box-shadow 0.15s, border-color 0.15s",
                    transform: isSel ? "translateY(-2px)" : "none",
                  }}
                >
                  <span style={{ pointerEvents: "none" }}>{tt.glyph}</span>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
