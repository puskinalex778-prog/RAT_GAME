import React, { useState } from 'react';
import { Award, Sparkles, X } from 'lucide-react';
import type { RatEntity, TrickId } from '../types/game';
import { TRICKS, TRICK_IDS } from '../rats/coatPresets';
import { SHOP_ITEMS } from '../cage/catalog';
import { useGameStore } from '../store/gameStore';

interface TrainingModalProps {
  rat: RatEntity | null;
  open: boolean;
  onClose: () => void;
  onTriggerTrickAnim: (ratId: string, trickId: TrickId) => void;
}

export const TrainingModal: React.FC<TrainingModalProps> = ({
  rat,
  open,
  onClose,
  onTriggerTrickAnim,
}) => {
  const inventory = useGameStore((s) => s.inventory);
  const trainRatStep = useGameStore((s) => s.trainRatStep);
  const [selectedTrick, setSelectedTrick] = useState<TrickId>('spin');
  const [selectedTreat, setSelectedTreat] = useState<string>('food_yogurt_drops');
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!open || !rat) return null;

  const treats = SHOP_ITEMS.filter((i) => i.category === 'food');
  const currentTrickProg = rat.tricks[selectedTrick];
  const treatQty = inventory[selectedTreat] ?? 0;

  const handlePractice = () => {
    const useTreat = treatQty > 0 ? selectedTreat : null;
    const res = trainRatStep(rat.id, selectedTrick, useTreat);
    onTriggerTrickAnim(rat.id, selectedTrick);
    if (res.learnedNow) {
      setFeedback(`Ура! ${rat.name} полностью освоил${rat.sex === 'female' ? 'а' : ''} «${TRICKS[selectedTrick].name}»!`);
    } else if (res.progressed) {
      setFeedback(
        useTreat
          ? `Отлично! Вкусное поощрение ускорило обучение (${res.progress}%).`
          : `Молодец! Прогресс трюка: ${res.progress}%.`
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-3"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-[#FAF5EB] rounded-3xl p-4 border border-[#DFD3BD] shadow-2xl text-[#3B332B]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-[#EFE6D6] text-[#5B4F42]"
          aria-label="Закрыть"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-3">
          <img
            src="./assets/icons/training_target.png"
            alt="Трюки"
            className="w-10 h-10 object-contain"
          />
          <div>
            <h3 className="text-base font-extrabold leading-tight">Дрессировка: {rat.name}</h3>
            <p className="text-[11px] text-[#756758]">
              Выбери трюк и поощряй крыску лакомством для быстрого освоения!
            </p>
          </div>
        </div>

        {/* Trick selector */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-3">
          {TRICK_IDS.map((tid) => {
            const info = TRICKS[tid];
            const prog = rat.tricks[tid];
            const active = selectedTrick === tid;
            return (
              <button
                key={tid}
                type="button"
                onClick={() => {
                  setSelectedTrick(tid);
                  setFeedback(null);
                }}
                className={`p-2 rounded-xl border text-left transition ${
                  active
                    ? 'bg-[#EAF1EB] border-[#5E7A63] ring-2 ring-[#6E8572]/35'
                    : 'bg-white/85 border-[#E2D8C5]'
                }`}
              >
                <div className="text-xs font-extrabold flex items-center justify-between">
                  <span className="truncate">{info.name}</span>
                  {prog.learned && <Award className="w-3.5 h-3.5 text-[#D29B35] shrink-0" />}
                </div>
                <div className="h-1.5 rounded-full bg-[#E6DCCB] mt-1.5 overflow-hidden">
                  <div
                    className="h-full bg-[#6E8572]"
                    style={{ width: `${prog.progress}%` }}
                  />
                </div>
                <div className="text-[10px] font-semibold text-[#7A6C5C] mt-0.5">
                  {prog.learned ? 'Изучен!' : `${prog.progress}%`}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected trick details */}
        <div className="bg-white/80 rounded-2xl p-3 border border-[#E5DAC6] mb-3">
          <div className="text-xs font-extrabold text-[#3B332B]">
            {TRICKS[selectedTrick].name}
          </div>
          <p className="text-[11px] text-[#6F6254] mt-0.5">{TRICKS[selectedTrick].description}</p>

          {/* Treat booster picker */}
          <div className="mt-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wide text-[#7E7061] mb-1">
              Лакомство для поощрения (ускоряет обучение):
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {treats.map((t) => {
                const qty = inventory[t.id] ?? 0;
                const active = selectedTreat === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTreat(t.id)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-xl border text-[11px] font-semibold shrink-0 transition ${
                      active
                        ? 'bg-[#F5EBDC] border-[#C99B58]'
                        : 'bg-white border-[#E4DAC7] opacity-80'
                    }`}
                  >
                    <img src={t.icon} alt="" className="w-5 h-5 object-contain" />
                    <span>{t.name.split(' ')[0]}</span>
                    <span className="px-1.5 py-0.2 bg-[#EFE6D6] rounded-md text-[10px] font-bold">
                      {qty}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {feedback && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-[#E8F1E9] border border-[#BFD4C2] text-xs font-bold text-[#3F6346]">
            {feedback}
          </div>
        )}

        <div className="flex gap-2">
          {currentTrickProg.learned ? (
            <button
              type="button"
              onClick={() => {
                onTriggerTrickAnim(rat.id, selectedTrick);
                onClose();
              }}
              className="flex-1 flex items-center justify-center gap-2 bg-[#6E8572] hover:bg-[#5E7462] text-white font-extrabold text-sm py-3 rounded-2xl shadow active:scale-95 transition"
            >
              <Sparkles className="w-4 h-4" />
              Выполнить трюк в клетке!
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePractice}
              className="flex-1 flex items-center justify-center gap-2 bg-[#6E8572] hover:bg-[#5E7462] text-white font-extrabold text-sm py-3 rounded-2xl shadow active:scale-95 transition"
            >
              <Sparkles className="w-4 h-4" />
              {treatQty > 0 ? 'Дать команду + угостить!' : 'Отработать команду (без лакомства)'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
