import React, { useState } from 'react';
import { Check, Gift, X } from 'lucide-react';
import { ACHIEVEMENTS, QUESTS } from '../cage/catalog';
import {
  getAchievementProgress,
  useGameStore,
  type QuestProgressCounters,
} from '../store/gameStore';

interface QuestsModalProps {
  open: boolean;
  onClose: () => void;
}

export const QuestsModal: React.FC<QuestsModalProps> = ({ open, onClose }) => {
  const state = useGameStore();
  const [tab, setTab] = useState<'quests' | 'achievements'>('quests');

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-3"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[85vh] flex flex-col bg-[#FAF5EB] rounded-3xl border border-[#DFD3BD] shadow-2xl text-[#3B332B] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E6DAC6] bg-[#F4ECDC]">
          <div className="flex items-center gap-2">
            <img src="./assets/icons/quests.png" alt="" className="w-7 h-7 object-contain" />
            <h2 className="text-base font-extrabold">Задания и достижения</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-[#E8DEC9] text-[#5B4F42]"
            aria-label="Закрыть"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-1.5 px-4 pt-3">
          <button
            type="button"
            onClick={() => setTab('quests')}
            className={`flex-1 py-2 rounded-xl text-xs font-extrabold border transition ${
              tab === 'quests'
                ? 'bg-[#6E8572] text-white border-[#5D7361]'
                : 'bg-white text-[#5B4F42] border-[#E2D7C3]'
            }`}
          >
            Задания
          </button>
          <button
            type="button"
            onClick={() => setTab('achievements')}
            className={`flex-1 py-2 rounded-xl text-xs font-extrabold border transition ${
              tab === 'achievements'
                ? 'bg-[#6E8572] text-white border-[#5D7361]'
                : 'bg-white text-[#5B4F42] border-[#E2D7C3]'
            }`}
          >
            Достижения
          </button>
        </div>

        <div className="flex-1 overflow-y-auto cozy-scroll p-4 space-y-2.5">
          {tab === 'quests'
            ? QUESTS.map((q) => {
                const val = state.counters[q.trackKey as keyof QuestProgressCounters] ?? 0;
                const done = val >= q.target;
                const claimed = state.claimedQuests.includes(q.id);
                const pct = Math.min(100, Math.round((val / q.target) * 100));

                return (
                  <div
                    key={q.id}
                    className={`flex items-center gap-3 p-3 rounded-2xl border ${
                      claimed
                        ? 'bg-[#F3ECE0]/70 border-[#E5DAC6] opacity-75'
                        : done
                        ? 'bg-[#EAF3EB] border-[#8EB293]'
                        : 'bg-white/90 border-[#E4D9C5]'
                    }`}
                  >
                    <img src={q.icon} alt="" className="w-11 h-11 object-contain shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-extrabold truncate">
                          {q.title}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#EFE7D8] text-[#756656]">
                          {q.kind === 'starter'
                            ? 'Старт'
                            : q.kind === 'daily'
                            ? 'Забота'
                            : 'Цель'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#6F6254] leading-snug">{q.description}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-1.5 bg-[#E6DCCB] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#6E8572] rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-[#6F6254]">
                          {Math.min(val, q.target)}/{q.target}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {claimed ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#4E7A55]">
                          <Check className="w-4 h-4" />
                        </span>
                      ) : done ? (
                        <button
                          type="button"
                          onClick={() => state.claimQuest(q.id)}
                          className="flex items-center gap-1 bg-[#6E8572] hover:bg-[#5B725F] text-white text-xs font-extrabold px-3 py-2 rounded-xl shadow active:scale-95 transition"
                        >
                          <Gift className="w-3.5 h-3.5" />+{q.rewardCoins}
                        </button>
                      ) : (
                        <div className="flex items-center gap-1 text-xs font-bold text-[#8A6D3B] bg-[#F6EFE2] px-2 py-1 rounded-lg">
                          <img src="./assets/icons/coin.png" alt="" className="w-3.5 h-3.5" />
                          {q.rewardCoins}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            : ACHIEVEMENTS.map((a) => {
                const { unlocked, progressText } = getAchievementProgress(a.id, state);
                const claimed = state.claimedAchievements.includes(a.id);

                return (
                  <div
                    key={a.id}
                    className={`flex items-center gap-3 p-3 rounded-2xl border ${
                      claimed
                        ? 'bg-[#F3ECE0]/70 border-[#E5DAC6] opacity-75'
                        : unlocked
                        ? 'bg-[#FDF4E2] border-[#DEB96F]'
                        : 'bg-white/90 border-[#E4D9C5]'
                    }`}
                  >
                    <img src={a.icon} alt="" className="w-11 h-11 object-contain shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs sm:text-sm font-extrabold">{a.title}</div>
                      <p className="text-[11px] text-[#6F6254]">{a.description}</p>
                      <div className="text-[10px] font-bold text-[#837464] mt-0.5">
                        Прогресс: {progressText}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {claimed ? (
                        <Check className="w-4 h-4 text-[#4E7A55]" />
                      ) : unlocked ? (
                        <button
                          type="button"
                          onClick={() => state.claimAchievement(a.id)}
                          className="flex items-center gap-1 bg-[#D29B35] text-white text-xs font-extrabold px-3 py-2 rounded-xl shadow active:scale-95 transition"
                        >
                          <Gift className="w-3.5 h-3.5" />+{a.rewardCoins}
                        </button>
                      ) : (
                        <div className="flex items-center gap-1 text-xs font-bold text-[#8A6D3B] bg-[#F6EFE2] px-2 py-1 rounded-lg">
                          <img src="./assets/icons/coin.png" alt="" className="w-3.5 h-3.5" />
                          {a.rewardCoins}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
        </div>
      </div>
    </div>
  );
};
