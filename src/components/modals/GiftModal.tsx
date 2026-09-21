import { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Message } from '../../types';

const gifts = [
  { emoji: '🎂', name: 'Cake' },
  { emoji: '⭐', name: 'Star' },
  { emoji: '❤️', name: 'Heart' },
  { emoji: '🌹', name: 'Rose' },
  { emoji: '💎', name: 'Diamond' },
  { emoji: '🏆', name: 'Trophy' },
  { emoji: '🎁', name: 'Gift Box' },
  { emoji: '🎆', name: 'Fireworks' },
  { emoji: '🦄', name: 'Unicorn' },
  { emoji: '🐱', name: 'Cat' },
  { emoji: '🐶', name: 'Dog' },
  { emoji: '🍕', name: 'Pizza' },
];

export function GiftModal() {
  const { state, dispatch, t } = useApp();
  const [sent, setSent] = useState(false);
  const [confetti, setConfetti] = useState<{x: number; y: number; emoji: string}[]>([]);

  const sendGift = (gift: typeof gifts[0]) => {
    const msg: Message = {
      id: `msg_gift_${Date.now()}`,
      chatId: state.activeChatId || '',
      senderId: 'user_me',
      text: '',
      timestamp: Date.now(),
      type: 'gift',
      gift,
      readBy: ['user_me'],
    };
    dispatch({ type: 'SEND_MESSAGE', message: msg });

    // Confetti
    const pieces = Array.from({ length: 30 }, () => ({
      x: Math.random() * 300 - 150,
      y: -(Math.random() * 300),
      emoji: ['🎉', '✨', '💫', '⭐', '🎊'][Math.floor(Math.random() * 5)],
    }));
    setConfetti(pieces);
    setSent(true);
    setTimeout(() => { setSent(false); dispatch({ type: 'TOGGLE_GIFT_MODAL' }); }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => dispatch({ type: 'TOGGLE_GIFT_MODAL' })}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-tg-sidebar rounded-2xl shadow-2xl p-4 max-w-xs w-full relative overflow-hidden"
      >
        {sent && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            {confetti.map((c, i) => (
              <motion.span
                key={i}
                initial={{ x: 0, y: 0, opacity: 1 }}
                animate={{ x: c.x, y: c.y, opacity: 0 }}
                transition={{ duration: 1.5 }}
                className="absolute text-2xl"
              >
                {c.emoji}
              </motion.span>
            ))}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-6xl"
            >
              🎁
            </motion.div>
          </div>
        )}

        <div className="flex justify-between items-center mb-3">
          <h3 className="text-base font-medium text-tg-text">{t('sendGift')}</h3>
          <button onClick={() => dispatch({ type: 'TOGGLE_GIFT_MODAL' })}><X size={20} className="text-tg-text-secondary" /></button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {gifts.map((gift, i) => (
            <motion.button
              key={i}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => sendGift(gift)}
              className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-tg-hover transition-colors"
            >
              <span className="text-3xl">{gift.emoji}</span>
              <span className="text-[10px] text-tg-text-secondary">{gift.name}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
