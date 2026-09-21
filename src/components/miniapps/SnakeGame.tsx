import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../store/AppContext';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';

const GRID_SIZE = 15;
const CELL_SIZE = 22;

type Point = { x: number; y: number };

export function MiniAppSnake() {
  const { dispatch } = useApp();
  const [snake, setSnake] = useState<Point[]>([{ x: 7, y: 7 }]);
  const [food, setFood] = useState<Point>({ x: 5, y: 5 });
  const [dir, setDir] = useState<Point>({ x: 1, y: 0 });
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const spawnFood = useCallback((currentSnake: Point[]) => {
    let pos: Point;
    do {
      pos = { x: Math.floor(Math.random() * GRID_SIZE), y: Math.floor(Math.random() * GRID_SIZE) };
    } while (currentSnake.some(s => s.x === pos.x && s.y === pos.y));
    return pos;
  }, []);

  useEffect(() => {
    if (gameOver || isPaused) return;
    const timer = setInterval(() => {
      setSnake(prev => {
        const head = prev[0];
        const newHead = { x: head.x + dir.x, y: head.y + dir.y };

        // Wall wrap
        if (newHead.x < 0) newHead.x = GRID_SIZE - 1;
        if (newHead.x >= GRID_SIZE) newHead.x = 0;
        if (newHead.y < 0) newHead.y = GRID_SIZE - 1;
        if (newHead.y >= GRID_SIZE) newHead.y = 0;

        // Self collision
        if (prev.some(s => s.x === newHead.x && s.y === newHead.y)) {
          setGameOver(true);
          return prev;
        }

        const newSnake = [newHead, ...prev];

        // Eat food
        if (newHead.x === food.x && newHead.y === food.y) {
          setScore(s => s + 10);
          setFood(spawnFood(newSnake));
        } else {
          newSnake.pop();
        }

        return newSnake;
      });
    }, 150);
    return () => clearInterval(timer);
  }, [dir, food, gameOver, isPaused, spawnFood]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp': case 'w': setDir(d => d.y === 0 ? { x: 0, y: -1 } : d); break;
        case 'ArrowDown': case 's': setDir(d => d.y === 0 ? { x: 0, y: 1 } : d); break;
        case 'ArrowLeft': case 'a': setDir(d => d.x === 0 ? { x: -1, y: 0 } : d); break;
        case 'ArrowRight': case 'd': setDir(d => d.x === 0 ? { x: 1, y: 0 } : d); break;
        case ' ': setIsPaused(p => !p); break;
        case 'Escape': dispatch({ type: 'SET_MINI_APP', app: null }); break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [dispatch]);

  const reset = () => {
    setSnake([{ x: 7, y: 7 }]);
    setDir({ x: 1, y: 0 });
    setFood(spawnFood([{ x: 7, y: 7 }]));
    setScore(0);
    setGameOver(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card p-4 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-tg-text">🐍 Snake</h3>
          <div className="text-sm text-tg-accent font-medium">Score: {score}</div>
          <button onClick={() => dispatch({ type: 'SET_MINI_APP', app: null })}>
            <X size={18} className="text-tg-text-secondary" />
          </button>
        </div>

        <div
          className="bg-tg-bg rounded-lg overflow-hidden mx-auto"
          style={{ width: GRID_SIZE * CELL_SIZE, height: GRID_SIZE * CELL_SIZE }}
        >
          {snake.map((s, i) => (
            <div
              key={i}
              className={`absolute rounded-sm ${i === 0 ? 'bg-tg-accent' : 'bg-tg-accent/70'}`}
              style={{ left: s.x * CELL_SIZE, top: s.y * CELL_SIZE, width: CELL_SIZE - 1, height: CELL_SIZE - 1 }}
            />
          ))}
          <div
            className="absolute bg-tg-red rounded-full"
            style={{ left: food.x * CELL_SIZE + 2, top: food.y * CELL_SIZE + 2, width: CELL_SIZE - 5, height: CELL_SIZE - 5 }}
          />
        </div>

        {gameOver && (
          <div className="mt-3">
            <div className="text-tg-red text-sm font-medium mb-2">Game Over! Score: {score}</div>
            <button onClick={reset} className="px-4 py-1.5 bg-tg-accent text-white text-sm rounded-lg">Play Again</button>
          </div>
        )}

        {isPaused && !gameOver && (
          <div className="mt-3 text-tg-text-secondary text-sm">Paused - Press Space to resume</div>
        )}

        {/* Mobile controls */}
        <div className="grid grid-cols-3 gap-1 mt-3 max-w-[150px] mx-auto md:hidden">
          <div />
          <button onClick={() => setDir(d => d.y === 0 ? { x: 0, y: -1 } : d)} className="h-10 bg-tg-input rounded text-tg-text">▲</button>
          <div />
          <button onClick={() => setDir(d => d.x === 0 ? { x: -1, y: 0 } : d)} className="h-10 bg-tg-input rounded text-tg-text">◀</button>
          <button onClick={() => setIsPaused(p => !p)} className="h-10 bg-tg-input rounded text-tg-text text-xs">⏸</button>
          <button onClick={() => setDir(d => d.x === 0 ? { x: 1, y: 0 } : d)} className="h-10 bg-tg-input rounded text-tg-text">▶</button>
          <div />
          <button onClick={() => setDir(d => d.y === 0 ? { x: 0, y: 1 } : d)} className="h-10 bg-tg-input rounded text-tg-text">▼</button>
          <div />
        </div>
      </motion.div>
    </div>
  );
}
