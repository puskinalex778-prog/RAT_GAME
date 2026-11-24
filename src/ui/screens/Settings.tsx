import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import { useUi } from '../uiStore';
import { Modal, Segmented, Toggle, click } from '../components/common';
import { LIFESPANS } from '../../store/life';
import type { LifespanId, Settings as S } from '../../store/types';
import { maybeEngine } from '../components/common';

export function SettingsPanel() {
  const s = useGame((x) => x.settings);
  const upd = useGame((x) => x.updateSettings);
  const reset = useGame((x) => x.resetAll);
  const set = useUi((x) => x.set);
  const [confirm, setConfirm] = useState(false);
  const u = (p: Partial<S>) => upd(p);
  return (
    <Modal title="⚙️ Настройки" onClose={() => set({ panel: null })} wide>
      <div className="grid sm:grid-cols-2 gap-x-6">
        <div>
          <div className="font-extrabold text-cocoa-600 uppercase text-[12px] tracking-wide mt-1">Жизнь крысок</div>
          <Toggle
            on={s.comfortMode}
            onChange={(v) => u({ comfortMode: v })}
            label="Комфортный режим"
            desc="Мягкая игра без стресса: показатели снижаются очень медленно, питомцы не болеют, естественная смерть отключена."
          />
          <Toggle
            on={s.breeding}
            onChange={(v) => u({ breeding: v })}
            label="Разведение"
            desc="Взрослые самец и самочка с высоким комфортом могут завести крысят. Окрас, ушки и шерсть наследуются, всё записывается в родословную."
          />
          <Toggle on={s.aging} onChange={(v) => u({ aging: v })} label="Старение" desc="Крыски плавно взрослеют: крысёнок → подросток → взрослая → пожилая. Если выключить — возраст замрёт." />
          <Toggle
            on={s.naturalDeath && !s.comfortMode}
            onChange={(v) => u({ naturalDeath: v, comfortMode: v ? false : s.comfortMode })}
            label="Естественная смерть"
            desc={s.comfortMode ? 'Недоступно в комфортном режиме (включение выключит комфортный режим).' : 'Пожилые крыски однажды уходят на радугу. Если выключено — живут вечно.'}
          />
          <div className="py-2">
            <div className="font-extrabold text-cocoa-800 text-[15px]">Сколько длится жизнь крыски</div>
            <div className="text-[13px] text-cocoa-500 mb-2">
              {s.naturalDeath && !s.comfortMode ? 'Полная жизнь (~30 игровых месяцев) пройдёт за:' : 'Скорость взросления (полный жизненный цикл займёт):'}
            </div>
            <Segmented value={s.lifespan} options={LIFESPANS.map((l) => ({ id: l.id, label: l.name }))} onChange={(v) => u({ lifespan: v as LifespanId })} />
          </div>
        </div>
        <div>
          <div className="font-extrabold text-cocoa-600 uppercase text-[12px] tracking-wide mt-1">Звук и управление</div>
          <Slider label="🎵 Музыка" value={s.music} onChange={(v) => u({ music: v })} />
          <Slider label="🔊 Звуки" value={s.sfx} onChange={(v) => u({ sfx: v })} />
          <Toggle on={s.haptics} onChange={(v) => u({ haptics: v })} label="Вибрация" desc="Лёгкий отклик при поглаживании и играх." />
          <Toggle on={s.hints} onChange={(v) => u({ hints: v })} label="Подсказки заданий" desc="Мягкие подсказки в углу экрана. Можно выключить в любой момент." />
          <div className="font-extrabold text-cocoa-600 uppercase text-[12px] tracking-wide mt-3">Графика</div>
          <div className="py-2">
            <div className="font-extrabold text-cocoa-800 text-[15px] mb-1.5">Качество</div>
            <Segmented
              value={s.quality}
              options={[
                { id: 'low', label: 'Экономно' },
                { id: 'medium', label: 'Сбалансированно' },
                { id: 'high', label: 'Красиво' },
              ]}
              onChange={(v) => u({ quality: v as S['quality'] })}
            />
          </div>
          <Toggle on={s.shellFur} onChange={(v) => u({ shellFur: v })} label="Объёмная шерсть" desc="Дополнительные слои пушистости (отключается в экономном режиме)." />
          <FpsInfo />
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-cream-200 flex flex-wrap gap-2 items-center">
        <button className="btn-soft" onClick={() => { click(); set({ panel: 'dedication' }); }}>
          💕 Об игре
        </button>
        <div className="flex-1" />
        {confirm ? (
          <>
            <span className="text-[13px] font-bold text-rose-700">Удалить весь прогресс?</span>
            <button className="btn bg-rose-500 text-white" onClick={async () => { click(); await reset(); set({ panel: null, selected: null, mode: 'normal' }); location.reload(); }}>
              Да, начать заново
            </button>
            <button className="btn-soft" onClick={() => setConfirm(false)}>
              Нет
            </button>
          </>
        ) : (
          <button className="btn-ghost text-rose-700" onClick={() => setConfirm(true)}>
            Начать заново
          </button>
        )}
      </div>
    </Modal>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-3 py-2">
      <span className="font-extrabold text-cocoa-800 text-[15px] w-28">{label}</span>
      <input type="range" min={0} max={1} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1" />
    </label>
  );
}

function FpsInfo() {
  const e = maybeEngine();
  return <div className="text-[12px] text-cocoa-400 mt-1">Частота кадров: ~{e ? Math.round(e.fps) : '—'} FPS</div>;
}
