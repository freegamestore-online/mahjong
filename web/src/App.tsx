import { useState, useCallback, useEffect } from "react";
import { GameShell, GameTopbar, GameAuth } from "@freegamestore/games";
import { Game } from "./components/Game";
import { useLeaderboard } from "./hooks/useLeaderboard";
import type { GamePhase } from "./types";

const BEST_SCORE_KEY = "freemahjong-best";

function getBestScore(): number {
  const v = localStorage.getItem(BEST_SCORE_KEY);
  return v ? parseInt(v, 10) : 0;
}

export default function App() {
  const [phase, setPhase] = useState<GamePhase>("menu");
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(getBestScore);
  const [gameKey, setGameKey] = useState(0);
  const { submitScore } = useLeaderboard("mahjong");

  const handleScore = useCallback((s: number) => {
    setScore(s);
  }, []);

  const handleGameOver = useCallback(() => {
    // Score is already set via handleScore before this fires
    setTimeout(() => {
      const best = getBestScore();
      setScore((current) => {
        if (current > best) {
          localStorage.setItem(BEST_SCORE_KEY, String(current));
          setBestScore(current);
        }
        submitScore(current);
        return current;
      });
      setPhase("over");
    }, 0);
  }, [submitScore]);

  const start = useCallback(() => {
    setScore(0);
    setGameKey((k) => k + 1);
    setPhase("playing");
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (phase !== "playing" && (e.key === " " || e.key === "Enter")) {
        start();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [phase, start]);

  return (
    <GameShell
      topbar={
        <GameTopbar
          title="Mahjong"
          stats={[
            { label: "Score", value: score, accent: true },
            { label: "Best", value: bestScore },
          ]}
          actions={<GameAuth />}
          rules={
            <div>
              <h3 style={{ fontWeight: 700 }}>Mahjong Solitaire</h3>
              <h4 style={{ fontWeight: 600 }}>Rules</h4>
              <ul><li>Match pairs of identical free tiles to remove them</li><li>A tile is free if not blocked on both left and right, and nothing is on top</li><li>Clear all tiles to win</li></ul>
              <h4 style={{ fontWeight: 600 }}>Controls</h4>
              <ul><li>Tap a free tile to select, tap its match to remove the pair</li><li>Hint button available if stuck</li></ul>
            </div>
          }
        />
      }
    >
      <div className="relative w-full h-full">
        {phase === "playing" ? (
          <Game key={gameKey} onScore={handleScore} onGameOver={handleGameOver} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <h1
              className="text-4xl font-bold"
              style={{ fontFamily: "Fraunces, serif" }}
            >
              Mahjong
            </h1>
            {phase === "over" && (
              <p
                className="text-xl font-bold"
                style={{ color: "var(--success)", fontFamily: "Fraunces, serif" }}
              >
                Complete! Score: {score}
              </p>
            )}
            <p style={{ color: "var(--muted)" }}>
              Match pairs of free tiles to clear the board.
            </p>
            <button
              onClick={start}
              className="px-6 py-3 rounded-xl font-semibold min-h-[2.75rem]"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              {phase === "menu" ? "Start Game" : "Play Again"}
            </button>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              Press Space or Enter to start
            </p>
          </div>
        )}
      </div>
    </GameShell>
  );
}
