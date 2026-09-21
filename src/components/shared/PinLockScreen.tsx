import { useState, useCallback } from 'react';
import { useApp } from '../../store/AppContext';
import { Lock } from 'lucide-react';
import { motion } from 'framer-motion';

export function PinLockScreen() {
  const { state, dispatch } = useApp();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleDigit = useCallback((digit: string) => {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);

    if (next.length === 4) {
      if (next === state.passcode) {
        dispatch({ type: 'SET_LOCKED', locked: false });
      } else {
        setError(true);
        setTimeout(() => { setError(false); setPin(''); }, 600);
      }
    }
  }, [pin, state.passcode, dispatch]);

  return (
    <div className="h-full flex flex-col items-center justify-center bg-tg-bg tg-doodle">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="w-20 h-20 rounded-full bg-tg-sidebar flex items-center justify-center mx-auto mb-6">
          <Lock size={32} className="text-tg-accent" />
        </div>

        <h2 className="text-xl font-medium text-tg-text mb-2">Enter Passcode</h2>
        <p className="text-sm text-tg-text-secondary mb-8">Enter your 4-digit passcode to unlock</p>

        {/* PIN dots */}
        <motion.div
          animate={error ? { x: [-10, 10, -10, 10, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="flex justify-center gap-4 mb-10"
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-all duration-200 ${
                i < pin.length
                  ? error ? 'bg-tg-red' : 'bg-tg-accent scale-125'
                  : 'bg-tg-text-secondary/30'
              }`}
            />
          ))}
        </motion.div>

        {/* Number pad */}
        <div className="grid grid-cols-3 gap-3 max-w-[220px] mx-auto">
          {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((num, i) => (
            <button
              key={i}
              onClick={() => {
                if (num === '⌫') {
                  setPin(prev => prev.slice(0, -1));
                } else if (num !== '') {
                  handleDigit(String(num));
                }
              }}
              className={`h-14 rounded-xl text-xl font-medium transition-all active:scale-95 ${
                num === '' ? 'invisible' : 'bg-tg-sidebar hover:bg-tg-hover text-tg-text'
              }`}
            >
              {num}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
