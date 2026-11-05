import { fireEvent, render } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { GameTile } from "../lib/mahjong";

let fixedTiles: GameTile[] | null = null;
vi.mock("../lib/mahjong", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../lib/mahjong")>();
  return {
    ...mod,
    createGame: () => (fixedTiles ? { tiles: fixedTiles, solution: [] } : mod.createGame()),
  };
});

const { BOARD_BOUNDS, Game } = await import("../components/Game");

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const boardEl = (c: HTMLElement) =>
  c.querySelector<HTMLElement>("button[aria-label$='tile']")!.parentElement!;

describe("Game", () => {
  it("keeps the board size fixed as pairs are removed", () => {
    fixedTiles = null;
    const { container } = render(<Game onScore={() => {}} onGameOver={() => {}} />);
    const board = boardEl(container);
    expect(board.style.width).toBe(`${BOARD_BOUNDS.boardW}px`);

    const free = [
      ...container.querySelectorAll<HTMLButtonElement>("button[aria-label$='tile']:not(:disabled)"),
    ];
    const a = free.find((t, i) => free.some((u, j) => j !== i && u.textContent === t.textContent))!;
    const b = free.find((u) => u !== a && u.textContent === a.textContent)!;
    fireEvent.click(a);
    fireEvent.click(b);

    expect(container.querySelectorAll("button[aria-label$='tile']").length).toBe(142);
    expect(board.style.width).toBe(`${BOARD_BOUNDS.boardW}px`);
    expect(board.style.height).toBe(`${BOARD_BOUNDS.boardH}px`);
  });

  it("ends the game when the board is stuck and shuffling cannot help", () => {
    // Last pair stacked on itself: only the top tile is free.
    fixedTiles = [
      { id: 0, typeIndex: 0, pos: { row: 0, col: 0, layer: 0 }, removed: false },
      { id: 1, typeIndex: 0, pos: { row: 0, col: 0, layer: 1 }, removed: false },
    ];
    const onGameOver = vi.fn();
    render(<Game onScore={() => {}} onGameOver={onGameOver} />);
    expect(onGameOver).toHaveBeenCalledExactlyOnceWith(null);
  });
});
