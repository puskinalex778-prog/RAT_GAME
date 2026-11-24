import React, { useState } from 'react';
import { Check, Edit3, Heart, Sparkles, X } from 'lucide-react';
import type { RatEntity, TrickId } from '../types/game';
import {
  COAT_LABELS,
  EAR_LABELS,
  EYE_LABELS,
  PERSONALITIES,
  TRICKS,
  TRICK_IDS,
  describeAppearance,
  formatRatAge,
  getLifeStage,
  getLifeStageLabel,
  getPresetIconForAppearance,
} from '../rats/coatPresets';
import { ITEM_MAP } from '../cage/catalog';
import { useGameStore } from '../store/gameStore';

interface PetCardModalProps {
  rat: RatEntity | null;
  onClose: () => void;
  onPerformTrick: (ratId: string, trick: TrickId) => void;
  onOpenTraining: () => void;
}

const ORIGIN_LABELS: Record<string, string> = {
  rescue: 'Центр пристройства домашних крыс',
  breeder: 'Ответственный заводчик',
  petshop: 'Зоомагазин',
  bred: 'Родилась в домашней стае',
};

const StatBar: React.FC<{ label: string; value: number; color: string }> = ({
  label,
  value,
  color,
}) => (
  <div>
    <div className="flex justify-between text-xs font-bold mb-0.5">
      <span className="text-[#564A3E]">{label}</span>
      <span className="text-[#3B332B]">{Math.round(value)}%</span>
    </div>
    <div className="h-2.5 rounded-full bg-[#EAE0CE] overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${Math.max(4, Math.min(100, value))}%`, backgroundColor: color }}
      />
    </div>
  </div>
);

export const PetCardModal: React.FC<PetCardModalProps> = ({
  rat,
  onClose,
  onPerformTrick,
  onOpenTraining,
}) => {
  const renameRat = useGameStore((s) => s.renameRat);
  const breedingEnabled = useGameStore((s) => s.settings.lifecycle.breedingEnabled);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');

  if (!rat) return null;

  const pInfo = PERSONALITIES[rat.personality];
  const stage = getLifeStage(rat.ageDays);
  const icon = getPresetIconForAppearance(rat.appearance);

  const startEdit = () => {
    setDraftName(rat.name);
    setEditing(true);
  };

  const commitEdit = () => {
    if (draftName.trim()) {
      renameRat(rat.id, draftName);
    }
    setEditing(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[88vh] overflow-y-auto cozy-scroll bg-[#FAF5EB] rounded-3xl p-4 sm:p-5 border border-[#DFD3BD] shadow-2xl text-[#3B332B]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1.5 rounded-full bg-[#EFE6D6] text-[#5B4F42] hover:bg-[#E5D8C2]"
          aria-label="Закрыть"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header with avatar & quick rename */}
        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-20 h-20 rounded-2xl bg-[#F0E7D6] border border-[#DDD0B8] flex items-center justify-center shrink-0">
            <img src={icon} alt={rat.name} className="w-18 h-18 object-contain" />
          </div>

          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={draftName}
                  maxLength={18}
                  autoFocus
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && commitEdit()}
                  className="w-full bg-white border border-[#6E8572] rounded-xl px-2.5 py-1 text-base font-extrabold outline-none"
                />
                <button
                  type="button"
                  onClick={commitEdit}
                  className="p-1.5 rounded-xl bg-[#6E8572] text-white"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <h2 className="text-xl font-extrabold truncate">{rat.name}</h2>
                <button
                  type="button"
                  onClick={startEdit}
                  title="Переименовать"
                  className="p-1 rounded-lg bg-[#EFE7D8] hover:bg-[#E4D9C4] text-[#5F5244]"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5 mt-1 text-[11px] font-bold">
              <span className="px-2 py-0.5 rounded-full bg-[#E8F0E9] text-[#4C6851]">
                {rat.sex === 'female' ? '♀ Самка' : '♂ Самец'}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#F1E6D4] text-[#6A5741]">
                {formatRatAge(rat.ageDays)} • {getLifeStageLabel(stage)}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#F6E6E0] text-[#9E5240]">
                {pInfo.name}
              </span>
            </div>
          </div>
        </div>

        {/* 4 Core State Bars */}
        <div className="grid grid-cols-2 gap-3 bg-white/80 rounded-2xl p-3 border border-[#E5DAC6] mb-3.5">
          <StatBar label="Сытость" value={rat.stats.hunger} color="#D49547" />
          <StatBar label="Здоровье" value={rat.stats.health} color="#649E6E" />
          <StatBar label="Комфорт" value={rat.stats.comfort} color="#6E92B5" />
          <StatBar label="Доверие" value={rat.stats.trust} color="#D46F68" />
        </div>

        {/* Appearance & Personality */}
        <div className="bg-white/75 rounded-2xl p-3 border border-[#E5DAC6] space-y-2 mb-3.5 text-xs">
          <div>
            <span className="font-bold text-[#7A6C5D]">Окрас и рисунок: </span>
            <span className="font-semibold">{describeAppearance(rat.appearance)}</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <div>
              <span className="font-bold text-[#7A6C5D]">Ушки: </span>
              <span className="font-semibold">{EAR_LABELS[rat.appearance.ears]}</span>
            </div>
            <div>
              <span className="font-bold text-[#7A6C5D]">Шерсть: </span>
              <span className="font-semibold">{COAT_LABELS[rat.appearance.coat]}</span>
            </div>
            <div>
              <span className="font-bold text-[#7A6C5D]">Глаза: </span>
              <span className="font-semibold">{EYE_LABELS[rat.appearance.eyeColor].name}</span>
            </div>
          </div>
          <div className="pt-1 border-t border-[#ECE2D1] text-[#5B4F42] leading-snug">
            <span className="font-bold text-[#3B332B]">Характер «{pInfo.name}»: </span>
            {pInfo.description}
          </div>
        </div>

        {/* Favorite toys */}
        <div className="bg-white/75 rounded-2xl p-3 border border-[#E5DAC6] mb-3.5">
          <div className="text-xs font-extrabold text-[#564A3E] mb-1.5 flex items-center gap-1.5">
            <Heart className="w-3.5 h-3.5 text-[#D2735B]" />
            Любимые игрушки и места
          </div>
          <div className="flex flex-wrap gap-1.5">
            {rat.favoriteToys.map((toyId) => {
              const def = ITEM_MAP[toyId];
              return (
                <span
                  key={toyId}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#F4ECE0] border border-[#E2D6C1] text-[11px] font-semibold"
                >
                  {def?.icon && <img src={def.icon} alt="" className="w-4 h-4 object-contain" />}
                  {def?.name ?? toyId}
                </span>
              );
            })}
          </div>
        </div>

        {/* Learned Tricks */}
        <div className="bg-white/75 rounded-2xl p-3 border border-[#E5DAC6] mb-3.5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-extrabold text-[#564A3E] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#D4A039]" />
              Изученные трюки
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenTraining();
              }}
              className="text-[11px] font-bold text-[#527058] bg-[#E6EFE7] hover:bg-[#D8E7DA] px-2.5 py-1 rounded-lg transition"
            >
              Тренировать
            </button>
          </div>

          <div className="space-y-1.5">
            {TRICK_IDS.map((tid) => {
              const info = TRICKS[tid];
              const prog = rat.tricks[tid];
              return (
                <div
                  key={tid}
                  className="flex items-center justify-between gap-2 bg-[#FAF6EE] rounded-xl px-2.5 py-1.5 border border-[#EAE0CF]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>{info.name}</span>
                      <span className={prog.learned ? 'text-[#4F7D56]' : 'text-[#8B7D6D]'}>
                        {prog.learned ? 'Освоен ✓' : `${prog.progress}%`}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#E8DEC9] mt-1 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#6E8572]"
                        style={{ width: `${prog.progress}%` }}
                      />
                    </div>
                  </div>
                  {prog.learned && (
                    <button
                      type="button"
                      onClick={() => {
                        onPerformTrick(rat.id, tid);
                        onClose();
                      }}
                      className="shrink-0 px-2.5 py-1 rounded-lg bg-[#6E8572] text-white text-[11px] font-bold active:scale-95 transition"
                    >
                      Команда
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Pedigree / Family History (shown when breeding mode enabled or bred in-game) */}
        {(breedingEnabled || rat.pedigree.origin === 'bred') && (
          <div className="bg-[#F4ECE0] rounded-2xl p-3 border border-[#DFD2BA] text-xs space-y-1">
            <div className="font-extrabold text-[#564A3E]">Семейная история и родословная</div>
            <div>
              <span className="text-[#786A5B]">Происхождение: </span>
              <span className="font-semibold">{ORIGIN_LABELS[rat.pedigree.origin]}</span>
            </div>
            <div>
              <span className="text-[#786A5B]">Поколение: </span>
              <span className="font-semibold">{rat.pedigree.generation}-е</span>
            </div>
            {(rat.pedigree.motherName || rat.pedigree.fatherName) && (
              <div>
                <span className="text-[#786A5B]">Родители: </span>
                <span className="font-semibold">
                  {rat.pedigree.motherName ?? '—'} и {rat.pedigree.fatherName ?? '—'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
