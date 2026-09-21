import { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { X, Plus, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

export function PollModal() {
  const { state, dispatch, t } = useApp();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isAnonymous, setIsAnonymous] = useState(true);

  const addOption = () => {
    if (options.length < 10) setOptions([...options, '']);
  };

  const removeOption = (i: number) => {
    if (options.length > 2) setOptions(options.filter((_, idx) => idx !== i));
  };

  const create = () => {
    if (!question.trim() || options.filter(o => o.trim()).length < 2) return;
    dispatch({
      type: 'CREATE_POLL',
      chatId: state.activeChatId || '',
      poll: {
        question: question.trim(),
        options: options.filter(o => o.trim()).map(text => ({ text: text.trim(), votes: [] })),
        isAnonymous,
        isActive: true,
        createdBy: 'user_me',
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md card overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 h-[56px] border-b border-black/20">
          <button onClick={() => dispatch({ type: 'TOGGLE_POLL_MODAL' })}><X size={20} className="text-tg-text-secondary" /></button>
          <h2 className="text-base font-medium text-tg-text">{t('newPoll')}</h2>
        </div>
        <div className="p-4">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t('question')}
            className="w-full bg-tg-input rounded-lg px-3 py-2 text-sm text-tg-text outline-none mb-3"
            autoFocus
          />
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={opt}
                onChange={(e) => { const next = [...options]; next[i] = e.target.value; setOptions(next); }}
                placeholder={`${t('option')} ${i + 1}`}
                className="flex-1 bg-tg-input rounded-lg px-3 py-2 text-sm text-tg-text outline-none"
              />
              {options.length > 2 && (
                <button onClick={() => removeOption(i)} className="p-1">
                  <Trash2 size={16} className="text-tg-red" />
                </button>
              )}
            </div>
          ))}
          {options.length < 10 && (
            <button onClick={addOption} className="flex items-center gap-2 text-sm text-tg-accent py-2">
              <Plus size={16} /> {t('addOption')}
            </button>
          )}
          <label className="flex items-center gap-2 mt-3 text-sm text-tg-text">
            <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} className="accent-tg-accent" />
            {t('anonymous')}
          </label>
          <button
            onClick={create}
            disabled={!question.trim() || options.filter(o => o.trim()).length < 2}
            className="w-full mt-4 py-2.5 rounded-lg bg-tg-accent text-white text-sm font-medium disabled:opacity-50 hover:bg-tg-accent-hover transition-colors"
          >
            {t('createPoll')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
