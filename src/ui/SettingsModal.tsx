import React, { useState } from 'react';
import { Heart, RotateCcw, Volume2, VolumeX, X } from 'lucide-react';
import type { LifespanOption } from '../types/game';
import { LIFESPAN_OPTIONS } from '../rats/coatPresets';
import { useGameStore } from '../store/gameStore';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onOpenDedication: () => void;
}

const ToggleRow: React.FC<{
  title: string;
  description: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}> = ({ title, description, checked, onChange }) => (
  <div className="flex items-center justify-between gap-3 bg-white/85 rounded-2xl p-3 border border-[#E4D9C5]">
    <div className="min-w-0">
      <div className="text-xs sm:text-sm font-extrabold text-[#3B332B]">{title}</div>
      <div className="text-[11px] text-[#756758] leading-snug mt-0.5">{description}</div>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`w-12 h-7 rounded-full p-1 transition shrink-0 ${
        checked ? 'bg-[#6E8572]' : 'bg-[#D5C9B4]'
      }`}
    >
      <div
        className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  </div>
);

const LIFESPAN_KEYS = Object.keys(LIFESPAN_OPTIONS) as LifespanOption[];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onClose,
  onOpenDedication,
}) => {
  const settings = useGameStore((s) => s.settings);
  const updateSettings = useGameStore((s) => s.updateSettings);
  const updateLifecycle = useGameStore((s) => s.updateLifecycle);
  const resetAllProgress = useGameStore((s) => s.resetAllProgress);
  const [confirmReset, setConfirmReset] = useState(false);

  if (!open) return null;

  const lc = settings.lifecycle;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-3"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[88vh] flex flex-col bg-[#FAF5EB] rounded-3xl border border-[#DFD3BD] shadow-2xl text-[#3B332B] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E6DAC6] bg-[#F4ECDC]">
          <div className="flex items-center gap-2">
            <img src="./assets/icons/settings.png" alt="" className="w-7 h-7 object-contain" />
            <h2 className="text-base font-extrabold">Настройки</h2>
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

        <div className="flex-1 overflow-y-auto cozy-scroll p-4 space-y-4">
          {/* Lifecycle & Breeding Section (4 independent switches + lifespan picker!) */}
          <div className="space-y-2">
            <div className="text-xs font-extrabold uppercase tracking-wider text-[#6E8572]">
              Жизненный цикл и размножение
            </div>

            <ToggleRow
              title="Разведение"
              description="Выключено по умолчанию. При включении разнополые взрослые крысы с высоким комфортом могут заводить крысят с наследованием окрасов и родословной."
              checked={lc.breedingEnabled}
              onChange={(v) => updateLifecycle({ breedingEnabled: v })}
            />

            <ToggleRow
              title="Старение"
              description="Плавное взросление и смена стадий жизни (крысёнок → подросток → взрослая → пожилая)."
              checked={lc.agingEnabled}
              onChange={(v) => updateLifecycle({ agingEnabled: v })}
            />

            <ToggleRow
              title="Естественная смерть"
              description="Выключено по умолчанию в комфортном режиме. При отключении пожилые крысы остаются жить рядом с тобой вечно."
              checked={lc.naturalDeathEnabled}
              onChange={(v) => updateLifecycle({ naturalDeathEnabled: v })}
            />

            {/* Lifespan duration selector shown whenever natural death is enabled */}
            {lc.naturalDeathEnabled && (
              <div className="bg-[#F6EDE0] rounded-2xl p-3 border border-[#DFCFAF]">
                <div className="text-xs font-extrabold text-[#4E4235] mb-1">
                  Продолжительность жизни крысок в игре:
                </div>
                <p className="text-[11px] text-[#7A6B5A] mb-2">
                  Выбери, сколько реального времени живут крыски при включённой естественной смерти:
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {LIFESPAN_KEYS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => updateLifecycle({ lifespanOption: opt })}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition ${
                        lc.lifespanOption === opt
                          ? 'bg-[#6E8572] text-white border-[#5D7361]'
                          : 'bg-white text-[#52463A] border-[#DFD2BC]'
                      }`}
                    >
                      {LIFESPAN_OPTIONS[opt].label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <ToggleRow
              title="Комфортный режим"
              description="Мягкий режим без стресса: показатели снижаются крайне медленно, питомцы не болеют, естественная смерть отключена."
              checked={lc.comfortMode}
              onChange={(v) => updateLifecycle({ comfortMode: v })}
            />
          </div>

          {/* Sound & Interface */}
          <div className="space-y-2">
            <div className="text-xs font-extrabold uppercase tracking-wider text-[#6E8572]">
              Звук и удобство
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border text-xs font-bold transition ${
                  settings.soundEnabled
                    ? 'bg-[#EAF1EB] border-[#6E8572] text-[#3F5E44]'
                    : 'bg-white border-[#E4D9C5] text-[#7A6C5C]'
                }`}
              >
                {settings.soundEnabled ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <VolumeX className="w-4 h-4" />
                )}
                Звуки: {settings.soundEnabled ? 'Вкл' : 'Выкл'}
              </button>

              <button
                type="button"
                onClick={() => updateSettings({ ambientEnabled: !settings.ambientEnabled })}
                className={`py-2.5 px-3 rounded-2xl border text-xs font-bold transition ${
                  settings.ambientEnabled
                    ? 'bg-[#EAF1EB] border-[#6E8572] text-[#3F5E44]'
                    : 'bg-white border-[#E4D9C5] text-[#7A6C5C]'
                }`}
              >
                Уютный фон: {settings.ambientEnabled ? 'Вкл' : 'Выкл'}
              </button>

              <button
                type="button"
                onClick={() => updateSettings({ hapticsEnabled: !settings.hapticsEnabled })}
                className={`py-2.5 px-3 rounded-2xl border text-xs font-bold transition ${
                  settings.hapticsEnabled
                    ? 'bg-[#EAF1EB] border-[#6E8572] text-[#3F5E44]'
                    : 'bg-white border-[#E4D9C5] text-[#7A6C5C]'
                }`}
              >
                Вибрация: {settings.hapticsEnabled ? 'Вкл' : 'Выкл'}
              </button>

              <button
                type="button"
                onClick={() => updateSettings({ showHints: !settings.showHints })}
                className={`py-2.5 px-3 rounded-2xl border text-xs font-bold transition ${
                  settings.showHints
                    ? 'bg-[#EAF1EB] border-[#6E8572] text-[#3F5E44]'
                    : 'bg-white border-[#E4D9C5] text-[#7A6C5C]'
                }`}
              >
                Подсказки: {settings.showHints ? 'Вкл' : 'Выкл'}
              </button>
            </div>
          </div>

          {/* Dedication plaque & Reset */}
          <div className="pt-2 border-t border-[#E6DAC6] flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenDedication();
              }}
              className="flex items-center gap-1.5 bg-[#F8EAE6] hover:bg-[#F3DFD9] text-[#A24E42] text-xs font-extrabold px-3.5 py-2 rounded-xl border border-[#E8C5BC]"
            >
              <Heart className="w-3.5 h-3.5 fill-[#CE5F52] text-[#CE5F52]" />
              Памятная табличка
            </button>

            {confirmReset ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={async () => {
                    await resetAllProgress();
                    setConfirmReset(false);
                    onClose();
                  }}
                  className="bg-[#C85346] text-white text-xs font-bold px-3 py-2 rounded-xl"
                >
                  Да, начать заново
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="bg-[#E8DEC9] text-[#5B4F42] text-xs font-bold px-3 py-2 rounded-xl"
                >
                  Отмена
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="flex items-center gap-1 text-xs font-bold text-[#8A7967] hover:text-[#B14D42] px-2 py-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Сбросить игру
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
