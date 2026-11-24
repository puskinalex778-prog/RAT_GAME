import React from 'react';
import { PlusCircle, X } from 'lucide-react';
import {
  PERSONALITIES,
  formatRatAge,
  getPresetIconForAppearance,
} from '../rats/coatPresets';
import { useGameStore } from '../store/gameStore';

interface PetsListModalProps {
  open: boolean;
  onClose: () => void;
  onFocusRat: (ratId: string) => void;
  onOpenPetCard: (ratId: string) => void;
  onOpenAdopt: () => void;
}

export const PetsListModal: React.FC<PetsListModalProps> = ({
  open,
  onClose,
  onFocusRat,
  onOpenPetCard,
  onOpenAdopt,
}) => {
  const rats = useGameStore((s) => s.rats);
  const selectedRatId = useGameStore((s) => s.selectedRatId);
  const selectRat = useGameStore((s) => s.selectRat);

  if (!open) return null;

  const aliveRats = rats.filter((r) => r.alive);
  const rainbowRats = rats.filter((r) => !r.alive);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-3"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md max-h-[82vh] flex flex-col bg-[#FAF5EB] rounded-3xl border border-[#DFD3BD] shadow-2xl text-[#3B332B] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E6DAC6] bg-[#F4ECDC]">
          <div className="flex items-center gap-2">
            <img src="./assets/icons/pets.png" alt="" className="w-7 h-7 object-contain" />
            <h2 className="text-base font-extrabold">Мои крыски ({aliveRats.length}/6)</h2>
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

        <div className="flex-1 overflow-y-auto cozy-scroll p-3.5 space-y-2.5">
          {aliveRats.map((rat) => {
            const selected = rat.id === selectedRatId;
            return (
              <div
                key={rat.id}
                onClick={() => {
                  selectRat(rat.id);
                  onFocusRat(rat.id);
                  onClose();
                }}
                className={`flex items-center gap-3 p-2.5 rounded-2xl border cursor-pointer transition ${
                  selected
                    ? 'bg-[#EAF1EB] border-[#5E7A63]'
                    : 'bg-white/90 border-[#E4D9C5] hover:bg-white'
                }`}
              >
                <img
                  src={getPresetIconForAppearance(rat.appearance)}
                  alt={rat.name}
                  className="w-14 h-14 object-contain shrink-0 bg-[#F4ECE0] rounded-xl p-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-extrabold truncate">{rat.name}</span>
                    <span className="text-[11px] text-[#7A6C5D]">
                      {rat.sex === 'female' ? '♀' : '♂'} • {formatRatAge(rat.ageDays)}
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-[#6E8572]">
                    {PERSONALITIES[rat.personality].name}
                  </div>
                  <div className="flex gap-2 mt-1 text-[10px] font-bold text-[#6F6254]">
                    <span>Сытость {Math.round(rat.stats.hunger)}%</span>
                    <span>Доверие {Math.round(rat.stats.trust)}%</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    selectRat(rat.id);
                    onClose();
                    onOpenPetCard(rat.id);
                  }}
                  className="shrink-0 px-3 py-1.5 rounded-xl bg-[#6E8572] text-white text-xs font-bold"
                >
                  Карточка
                </button>
              </div>
            );
          })}

          {aliveRats.length < 6 && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAdopt();
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-[#CBBFA8] hover:border-[#6E8572] text-xs font-extrabold text-[#5F5346] hover:text-[#4E6B53] transition"
            >
              <PlusCircle className="w-4 h-4" />
              Завести ещё одну крыску (85 монет)
            </button>
          )}

          {rainbowRats.length > 0 && (
            <div className="pt-2 border-t border-[#E6DAC6]">
              <div className="text-[11px] font-bold text-[#8A7B6A] mb-1.5">В светлой памяти</div>
              {rainbowRats.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#F3ECE0] text-xs text-[#786A5B] mb-1"
                >
                  <span>🌈 {r.name}</span>
                  <span className="ml-auto">{formatRatAge(r.ageDays)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
