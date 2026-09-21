import { useApp } from '../../store/AppContext';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';

export function QRCodeModal() {
  const { state, dispatch, t } = useApp();

  // Generate a visual QR-like pattern based on user ID
  const generatePattern = (id: string) => {
    const size = 21;
    const pattern: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

    // Fixed corner patterns (QR code style)
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        if (i < 7 && j < 7) pattern[i][j] = i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4);
        if (i < 7 && j >= size - 7) pattern[i][size - 7 + j - j + (size - 7)] = pattern[i][j];
        if (i >= size - 7 && j < 7) pattern[size - 7 + i - i + (size - 7)][j] = pattern[i][j];
      }
    }
    // Bottom-right corner
    for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
      pattern[size - 7 + i][size - 7 + j] = i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4);
    }

    // Fill data area with hash
    let hash = 0;
    for (const c of id) hash = ((hash << 5) - hash + c.charCodeAt(0)) | 0;
    for (let i = 8; i < size - 8; i++) {
      for (let j = 8; j < size - 8; j++) {
        hash = ((hash << 5) - hash + i * 31 + j) | 0;
        pattern[i][j] = (hash & 3) < 2;
      }
    }
    return pattern;
  };

  const pattern = generatePattern(state.currentUser.id);
  const cellSize = 8;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => dispatch({ type: 'TOGGLE_QR_CODE' })}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-tg-sidebar rounded-2xl shadow-2xl p-6 text-center max-w-xs"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium text-tg-text">{t('qrCode')}</h3>
          <button onClick={() => dispatch({ type: 'TOGGLE_QR_CODE' })}>
            <X size={20} className="text-tg-text-secondary" />
          </button>
        </div>

        <div className="bg-white p-3 rounded-xl inline-block mb-4">
          <svg width={pattern.length * cellSize} height={pattern.length * cellSize}>
            {pattern.map((row, i) =>
              row.map((cell, j) =>
                cell ? <rect key={`${i}-${j}`} x={j * cellSize} y={i * cellSize} width={cellSize} height={cellSize} fill="#0e1621" /> : null
              )
            )}
          </svg>
        </div>

        <div className="text-sm font-medium text-tg-text">{state.currentUser.name}</div>
        <div className="text-xs text-tg-text-secondary">@{state.currentUser.username}</div>
      </motion.div>
    </div>
  );
}
