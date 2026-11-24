import React, { useState } from 'react';
import {
  Camera,
  Hand,
  IdCard,
  Megaphone,
  Sparkles,
  Utensils,
  Wand2,
  X,
} from 'lucide-react';
import type { RatEntity } from '../types/game';
import { SHOP_ITEMS } from '../cage/catalog';
import { useGameStore } from '../store/gameStore';

interface RatActionBarProps {
  rat: RatEntity;
  onFeed: (foodItemId: string) => void;
  onCall: () => void;
  onOpenTraining: () => void;
  onOpenCard: () => void;
  onQuickPhoto: () => void;
  onDismiss: () => void;
}

export const RatActionBar: React.FC<RatActionBarProps> = ({
  rat,
  onFeed,
  onCall,
  onOpenTraining,
  onOpenCard,
  onQuickPhoto,
  onDismiss,
}) => {
  const inventory = useGameStore((s) => s.inventory);
  const interactionMode = useGameStore((s) => s.interactionMode);
  const setInteractionMode = useGameStore((s) => s.setInteractionMode);
  const [showTreats, setShowTreats] = useState(false);

  const foods = SHOP_ITEMS.filter((i) => i.category === 'food');

  const isPetting = interactionMode === 'petting';
  const isPlaying = interactionMode === 'playing';

  return (
    <div className="pointer-events-auto flex flex-col items-center gap-1.5 mb-1.5 w-full max-w-xl mx-auto">
      {/* Mode helper pill when petting or playing */}
      {(isPetting || isPlaying) && (
        <div className="flex items-center gap-2 bg-[#6E8572] text-white px-3.5 py-1.5 rounded-full text-xs font-bold shadow-md">
          <span>
            {isPetting
              ? `Проведи пальцем по ${rat.name}, чтобы нежно погладить!`
              : `Води пальцем по полу клетки — ${rat.name} будет охотиться за пёрышком!`}
          </span>
          <button
            type="button"
            onClick={() => setInteractionMode('none')}
            className="p-0.5 rounded-full bg-white/20 hover:bg-white/30"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Treat Drawer */}
      {showTreats && (
        <div className="w-full bg-[#FAF5EB]/95 backdrop-blur-md rounded-2xl p-2 border border-[#DFD3BD] shadow-lg">
          <div className="flex items-center justify-between px-1 mb-1.5">
            <span className="text-[11px] font-extrabold text-[#5B4F42]">
              Чем угостим {rat.name}?
            </span>
            <button
              type="button"
              onClick={() => setShowTreats(false)}
              className="text-[#857666]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {foods.map((food) => {
              const qty = inventory[food.id] ?? 0;
              return (
                <button
                  key={food.id}
                  type="button"
                  disabled={qty <= 0}
                  onClick={() => {
                    onFeed(food.id);
                    setShowTreats(false);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-left shrink-0 transition active:scale-95 ${
                    qty > 0
                      ? 'bg-white border-[#E2D6C1] hover:bg-[#F5EFE2]'
                      : 'bg-[#F1EAE0] border-[#E5DAC8] opacity-45'
                  }`}
                >
                  <img src={food.icon} alt="" className="w-6 h-6 object-contain" />
                  <div>
                    <div className="text-[11px] font-extrabold text-[#3B332B] leading-tight">
                      {food.name.split(' ')[0]}
                    </div>
                    <div className="text-[10px] font-bold text-[#6E8572]">×{qty}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Action Pills */}
      <div className="w-full bg-[#FAF5EB]/93 backdrop-blur-md rounded-2xl p-1.5 border border-[#DFD3BD] shadow-lg flex items-center gap-1 overflow-x-auto">
        <button
          type="button"
          onClick={onOpenCard}
          className="flex flex-col items-center justify-center px-2.5 py-1.5 rounded-xl bg-[#F2E9DA] hover:bg-[#E7DAC4] text-[#3B332B] shrink-0 active:scale-95 transition"
        >
          <IdCard className="w-4 h-4 text-[#6E8572]" />
          <span className="text-[10px] font-extrabold mt-0.5 max-w-[60px] truncate">{rat.name}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setInteractionMode('none');
            setShowTreats((v) => !v);
          }}
          className={`flex-1 min-w-[62px] flex flex-col items-center justify-center py-1.5 px-1.5 rounded-xl transition active:scale-95 ${
            showTreats ? 'bg-[#6E8572] text-white' : 'bg-white/85 text-[#493E33]'
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span className="text-[10px] font-bold mt-0.5">Угостить</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setShowTreats(false);
            setInteractionMode(isPetting ? 'none' : 'petting');
          }}
          className={`flex-1 min-w-[62px] flex flex-col items-center justify-center py-1.5 px-1.5 rounded-xl transition active:scale-95 ${
            isPetting ? 'bg-[#D2735B] text-white' : 'bg-white/85 text-[#493E33]'
          }`}
        >
          <Hand className="w-4 h-4" />
          <span className="text-[10px] font-bold mt-0.5">Погладить</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setShowTreats(false);
            setInteractionMode('none');
            onCall();
          }}
          className="flex-1 min-w-[58px] flex flex-col items-center justify-center py-1.5 px-1.5 rounded-xl bg-white/85 text-[#493E33] active:scale-95 transition"
        >
          <Megaphone className="w-4 h-4" />
          <span className="text-[10px] font-bold mt-0.5">Позвать</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setShowTreats(false);
            setInteractionMode(isPlaying ? 'none' : 'playing');
          }}
          className={`flex-1 min-w-[60px] flex flex-col items-center justify-center py-1.5 px-1.5 rounded-xl transition active:scale-95 ${
            isPlaying ? 'bg-[#6E8572] text-white' : 'bg-white/85 text-[#493E33]'
          }`}
        >
          <Wand2 className="w-4 h-4" />
          <span className="text-[10px] font-bold mt-0.5">Поиграть</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setShowTreats(false);
            setInteractionMode('none');
            onOpenTraining();
          }}
          className="flex-1 min-w-[54px] flex flex-col items-center justify-center py-1.5 px-1.5 rounded-xl bg-white/85 text-[#493E33] active:scale-95 transition"
        >
          <Sparkles className="w-4 h-4" />
          <span className="text-[10px] font-bold mt-0.5">Трюк</span>
        </button>

        <button
          type="button"
          onClick={onQuickPhoto}
          className="flex flex-col items-center justify-center px-2 py-1.5 rounded-xl bg-white/85 text-[#493E33] shrink-0 active:scale-95 transition"
          title="Сфотографировать"
        >
          <Camera className="w-4 h-4" />
          <span className="text-[10px] font-bold mt-0.5">Фото</span>
        </button>

        <button
          type="button"
          onClick={onDismiss}
          className="p-1.5 rounded-xl text-[#8A7B6B] hover:bg-[#EFE6D6] shrink-0"
          aria-label="Скрыть панель"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
