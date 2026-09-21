import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../store/AppContext';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';

const SIZE = 4;

type Grid = number[][];

function createEmpty(): Grid {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function addRandom(grid: Grid): Grid {
  const empty: [number, number][] = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    if (grid[r][c] === 0) empty.push([r, c]);
  }
  if (empty.length === 0) return grid;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  const newGrid = grid.map(row => [...row]);
  newGrid[r][c] = Math.random() < 0.9 ? 2 : 4;
  return newGrid;
}

function slide(row: number[]): [number[], number] {
  let score = 0;
  const filtered = row.filter(v => v !== 0);
  const merged: number[] = [];
  for (let i = 0; i < filtered.length; i++) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      merged.push(filtered[i] * 2);
      score += filtered[i] * 2;
      i++;
    } else {
      merged.push(filtered[i]);
    }
  }
  while (merged.length < SIZE) merged.push(0);
  return [merged, score];
}

function move(grid: Grid, direction: 'left' | 'right' | 'up' | 'down'): [Grid, number] {
  let totalScore = 0;
  let newGrid = grid.map(r => [...r]);

  if (direction === 'left') {
    for (let r = 0; r < SIZE; r++) {
      const [row, s] = slide(newGrid[r]);
      newGrid[r] = row;
      totalScore += s;
    }
  } else if (direction === 'right') {
    for (let r = 0; r < SIZE; r++) {
      const [row, s] = slide([...newGrid[r]].reverse());
      newGrid[r] = row.reverse();
      totalScore += s;
    }
  } else if (direction === 'up') {
    for (let c = 0; c < SIZE; c++) {
      const col = newGrid.map(r => r[c]);
      const [merged, s] = slide(col);
      for (let r = 0; r < SIZE; r++) newGrid[r][c] = merged[r];
      totalScore += s;
    }
  } else if (direction === 'down') {
    for (let c = 0; c < SIZE; c++) {
      const col = newGrid.map(r => r[c]).reverse();
      const [merged, s] = slide(col);
      const final = merged.reverse();
      for (let r = 0; r < SIZE; r++) newGrid[r][c] = final[r];
      totalScore += s;
    }
  }

  return [newGrid, totalScore];
}

function isGameOver(grid: Grid): boolean {
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    if (grid[r][c] === 0) return false;
    if (c + 1 < SIZE && grid[r][c] === grid[r][c + 1]) return false;
    if (r + 1 < SIZE && grid[r][c] === grid[r + 1][c]) return false;
  }
  return true;
}

const colors: Record<number, string> = {
  0: 'bg-tg-input',
  2: 'bg-tg-incoming text-tg-text',
  4: 'bg-tg-incoming text-tg-text',
  8: 'bg-orange-600 text-white',
  16: 'bg-orange-500 text-white',
  32: 'bg-red-500 text-white',
  64: 'bg-red-600 text-white',
  128: 'bg-yellow-500 text-white',
  256: 'bg-yellow-400 text-white',
  512: 'bg-yellow-300 text-gray-900',
  1024: 'bg-yellow-200 text-gray-900',
  2048: 'bg-yellow-100 text-gray-900 font-bold',
};

export function MiniApp2048() {
  const { dispatch } = useApp();
  const [grid, setGrid] = useState<Grid>(() => addRandom(addRandom(createEmpty())));
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [bestScore, setBestScore] = useState(0);

  const moveGrid = useCallback((dir: 'left' | 'right' | 'up' | 'down') => {
    if (gameOver) return;
    setGrid(prev => {
      const [newGrid, s] = move(prev, dir);
      if (JSON.stringify(newGrid) === JSON.stringify(prev)) return prev;
      const withNew = addRandom(newGrid);
      setScore(sc => {
        const newScore = sc + s;
        if (newScore > bestScore) setBestScore(newScore);
        return newScore;
      });
      if (isGameOver(withNew)) setGameOver(true);
      return withNew;
    });
  }, [gameOver, bestScore]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft': case 'a': moveGrid('left'); break;
        case 'ArrowRight': case 'd': moveGrid('right'); break;
        case 'ArrowUp': case 'w': moveGrid('up'); break;
        case 'ArrowDown': case 's': moveGrid('down'); break;
        case 'Escape': dispatch({ type: 'SET_MINI_APP', app: null }); break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [moveGrid, dispatch]);

  // Touch support
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  const reset = () => {
    setGrid(addRandom(addRandom(createEmpty())));
    setScore(0);
    setGameOver(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card p-4"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          if (!touchStart) return;
          const dx = e.changedTouches[0].clientX - touchStart.x;
          const dy = e.changedTouches[0].clientY - touchStart.y;
          if (Math.abs(dx) > Math.abs(dy)) {
            moveGrid(dx > 0 ? 'right' : 'left');
          } else {
            moveGrid(dy > 0 ? 'down' : 'up');
          }
          setTouchStart(null);
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-tg-text">2048</h3>
          <div className="flex gap-3">
            <div className="text-xs text-tg-text-secondary">Score: <span className="text-tg-accent font-medium">{score}</span></div>
            <div className="text-xs text-tg-text-secondary">Best: <span className="text-tg-accent font-medium">{bestScore}</span></div>
          </div>
          <button onClick={() => dispatch({ type: 'SET_MINI_APP', app: null })}>
            <X size={18} className="text-tg-text-secondary" />
          </button>
        </div>

        <div className="bg-tg-bg rounded-lg p-2 mx-auto" style={{ width: SIZE * 64 + 16 }}>
          {grid.map((row, r) => (
            <div key={r} className="flex gap-1.5 mb-1.5">
              {row.map((cell, c) => (
                <div
                  key={c}
                  className={`w-[60px] h-[60px] rounded-md flex items-center justify-center text-lg font-semibold ${colors[cell] || colors[2048]}`}
                >
                  {cell || ''}
                </div>
              ))}
            </div>
          ))}
        </div>

        {gameOver && (
          <div className="mt-3 text-center">
            <div className="text-tg-red text-sm font-medium mb-2">Game Over! Score: {score}</div>
            <button onClick={reset} className="px-4 py-1.5 bg-tg-accent text-white text-sm rounded-lg">Play Again</button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
