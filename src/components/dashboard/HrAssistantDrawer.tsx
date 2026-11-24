import React, { useMemo, useState } from 'react';
import { Bot, Send, X } from 'lucide-react';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { apiRequest } from '../../lib/api';
import { localizeApiMessage } from '../../lib/localizeData';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export const HrAssistantDrawer: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const { lang, t } = useAppPreferences();
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const greetingText = t(
    'Halo! Saya Asisten HR Development PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory. Tanyakan kondisi absensi hari ini, masa berlaku PKS kampus, pelamar pending, atau ringkasan talent.',
    'Hello! I am the HR Development Assistant for PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory. Ask about today’s attendance, campus MoA expiration, pending applicants, or talent summaries.'
  );

  const suggestions = useMemo(
    () =>
      lang === 'en'
        ? [
            'Who has not checked in today?',
            'Which university MoAs expire within the next 45 days?',
            'Who are the Top 3 candidates with the highest evaluation scores?',
          ]
        : [
            'Siapa saja peserta yang belum absen hari ini?',
            'PKS universitas mana yang akan berakhir dalam 45 hari ke depan?',
            'Siapa kandidat Top 3 dengan skor evaluasi tertinggi?',
          ],
    [lang]
  );

  if (!open) return null;

  const displayedMessages: ChatMessage[] = [{ role: 'model', text: greetingText }, ...conversation];

  const sendQuestion = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    const historyToSend = [...conversation];
    setConversation((prev) => [...prev, { role: 'user', text: trimmed }]);
    setInput('');
    setLoading(true);
    try {
      const res = await apiRequest<{ answer: string }>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ question: trimmed, history: historyToSend, lang }),
      });
      setConversation((prev) => [...prev, { role: 'model', text: res.answer }]);
    } catch (err) {
      setConversation((prev) => [
        ...prev,
        {
          role: 'model',
          text:
            err instanceof Error
              ? localizeApiMessage(err.message, lang)
              : t('Gagal terhubung ke Asisten HR AI.', 'Failed to connect to HR AI Assistant.'),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end modal-backdrop">
      <div className="flex h-full w-full max-w-md flex-col border-l border-slate-200/80 bg-theme-sidebar backdrop-blur-md shadow-2xl dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl icon-theme-plinth shrink-0">
              <Bot className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                {t('Asisten HR (AI Assistant)', 'HR Assistant (AI Assistant)')}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-200 truncate">
                {t('Tanya jawab operasional magang real-time', 'Real-time internship operations Q&A')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          {displayedMessages.map((m, idx) => (
            <div
              key={idx}
              className={`rounded-xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'ml-8 bg-theme-accent text-white'
                  : 'mr-6 border border-slate-200 bg-neutral-50 text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200'
              }`}
            >
              {m.text}
            </div>
          ))}
          {loading && (
            <div className="mr-6 rounded-xl border border-slate-200 bg-neutral-50 px-3.5 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950">
              {t('Menyusun jawaban dari data terkini...', 'Synthesizing answer from live data...')}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 p-3 dark:border-slate-800 space-y-2.5 shrink-0 max-h-[42dvh] overflow-y-auto">
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => sendQuestion(s)}
                className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700 hover:border-theme-accent hover:text-theme-accent dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 text-left transition-colors"
              >
                {s}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendQuestion(input);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('Tulis pertanyaan HR...', 'Ask an HR question...')}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs input-theme-focus dark:border-slate-700 dark:bg-slate-950"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-lg btn-theme-primary p-2 disabled:opacity-40 shrink-0"
              aria-label={t('Kirim pertanyaan', 'Send question')}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
