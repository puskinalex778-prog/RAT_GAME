import { useEffect, useRef, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { STORY_QUESTS } from '../../store/data/quests';
import { useUi } from '../uiStore';
import { RatAvatar, click, engine } from '../components/common';
import { bus } from '../../store/bus';
import type { CamMode } from '../../engine/Engine';

export function TopBar() {
  const coins = useGame((s) => s.coins);
  const story = useGame((s) => s.storyQuests);
  const daily = useGame((s) => s.daily);
  const set = useUi((s) => s.set);
  const claimable = story.some((q) => q.done && !q.claimed) || daily.quests.some((q) => q.done && !q.claimed);
  const [bump, setBump] = useState(false);
  const prev = useRef(coins);
  useEffect(() => {
    if (coins > prev.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 400);
      prev.current = coins;
      return () => clearTimeout(t);
    }
    prev.current = coins;
  }, [coins]);

  const open = (p: Parameters<typeof set>[0]) => {
    click();
    set(p);
  };
  return (
    <div className="absolute top-0 inset-x-0 z-20 flex items-start justify-between gap-2 safe-top safe-left safe-right px-2 pointer-events-none">
      <div className="flex flex-col gap-2 pointer-events-auto">
        <div className={`glass rounded-2xl px-3 h-11 flex items-center gap-1.5 font-extrabold text-lg text-cocoa-800 transition ${bump ? 'scale-110' : ''}`}>
          <span>🪙</span>
          <span>{coins}</span>
        </div>
      </div>
      <div className="flex gap-1.5 pointer-events-auto">
        <button className="icon-btn" onClick={() => open({ panel: 'quests' })}>
          📜<small>Задания</small>
          {claimable && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-berry-500 border-2 border-white" />}
        </button>
        <button className="icon-btn" onClick={() => open({ panel: 'shop' })}>
          🛒<small>Магазин</small>
        </button>
        <button className="icon-btn" onClick={() => open({ mode: 'decor', selected: null, panel: null, decorSlot: null })}>
          🪑<small>Обустр.</small>
        </button>
        <button className="icon-btn" onClick={() => open({ panel: 'album' })}>
          🖼️<small>Альбом</small>
        </button>
        <button className="icon-btn" onClick={() => open({ panel: 'settings' })}>
          ⚙️<small>Настр.</small>
        </button>
      </div>
    </div>
  );
}

export function QuestHint() {
  const story = useGame((s) => s.storyQuests);
  const idx = useGame((s) => s.storyIndex);
  const hints = useGame((s) => s.settings.hints);
  const hide = useUi((s) => s.hideHints);
  const set = useUi((s) => s.set);
  const claim = useGame((s) => s.claimQuest);
  const q = story[idx];
  if (!hints || hide || !q) return null;
  const def = STORY_QUESTS.find((d) => d.id === q.id);
  if (!def) return null;
  return (
    <div className="absolute z-10 top-[64px] left-2 safe-left max-w-[300px] pointer-events-auto">
      <div className="glass rounded-2xl px-3 py-2 animate-pop">
        <div className="flex items-start gap-2">
          <div className="text-lg">{q.done ? '✅' : '💡'}</div>
          <div className="flex-1 min-w-0">
            <div className="font-extrabold text-[14px] text-cocoa-800 leading-tight">{def.title}</div>
            {!q.done && <div className="text-[12px] text-cocoa-500 leading-snug mt-0.5">{def.hint}</div>}
            {q.done && (
              <button className="btn-primary !py-1 !px-3 mt-1.5 text-[13px]" onClick={() => { click(); claim('story', q.id); }}>
                Забрать +{def.reward} 🪙
              </button>
            )}
          </div>
          <button className="text-cocoa-400 text-sm px-1" onClick={() => { click(); set({ hideHints: true }); }} aria-label="Скрыть подсказку">
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

export function Roster() {
  const rats = useGame((s) => s.rats);
  const selected = useUi((s) => s.selected);
  const set = useUi((s) => s.set);
  const alive = rats.filter((r) => r.alive);
  return (
    <div className="absolute z-20 bottom-0 left-0 safe-bottom safe-left px-2 pointer-events-auto">
      <div className="glass rounded-2xl p-1.5 flex flex-col gap-1.5 max-h-[60vh] scroll-y">
        {alive.map((r) => (
          <button
            key={r.id}
            className="relative active:scale-95 transition"
            onClick={() => {
              click();
              const same = selected === r.id;
              set({ selected: same ? null : r.id, nameFlash: { id: r.id, until: Date.now() + 2500 } });
              if (!same) engine().setCamMode('follow', r.id);
            }}
            title={r.name}
          >
            <RatAvatar a={r.appearance} size={40} ring={selected === r.id} />
            {r.pregnantUntil && <span className="absolute -top-1 -right-1 text-[12px]">💞</span>}
          </button>
        ))}
        <button className="w-10 h-10 rounded-full bg-cream-100 border-2 border-dashed border-cream-300 text-cocoa-500 text-xl font-bold active:scale-95" onClick={() => { click(); set({ panel: 'adoptMore' }); }} title="Новый питомец">
          +
        </button>
      </div>
    </div>
  );
}

export function CameraBar() {
  const selected = useUi((s) => s.selected);
  const set = useUi((s) => s.set);
  const [mode, setMode] = useState<CamMode>('overview');
  useEffect(() => {
    const e = engine();
    const off = e.onFrame(() => {
      if (e.camMode !== mode) setMode(e.camMode);
    });
    return () => {
      off();
    };
  }, [mode]);
  const go = (m: CamMode) => {
    click();
    const e = engine();
    if (m === 'follow') {
      const id = selected ?? useGame.getState().rats.find((r) => r.alive)?.id ?? null;
      if (!id) return;
      if (!selected) set({ selected: id });
      e.setCamMode('follow', id);
    } else e.setCamMode(m, selected);
  };
  const btn = (m: CamMode, icon: string, label: string) => (
    <button className={`icon-btn ${mode === m ? '!bg-berry-400/25 !border-berry-400' : ''}`} onClick={() => go(m)}>
      {icon}
      <small>{label}</small>
    </button>
  );
  return (
    <div className="absolute z-20 bottom-0 right-0 safe-bottom safe-right px-2 pointer-events-auto flex flex-col gap-1.5 items-end">
      <button
        className="icon-btn !w-14 !h-14 !bg-berry-500 !border-berry-500 text-white"
        onClick={() => {
          click();
          engine().setCamMode('photo', selected);
          set({ mode: 'photo', panel: null });
        }}
      >
        📷<small className="!text-white">Фото</small>
      </button>
      <div className="flex gap-1.5">
        {btn('overview', '🏠', 'Обзор')}
        {btn('pet', '🐾', 'Низко')}
        {btn('follow', '🎯', 'Следить')}
      </div>
    </div>
  );
}

export function CareBar() {
  const inv = useGame((s) => s.inventory);
  const cage = useGame((s) => s.cage);
  const g = useGame.getState;
  const pct = (v: number) => `${Math.round(v)}%`;
  return (
    <div className="absolute z-20 bottom-0 left-1/2 -translate-x-1/2 safe-bottom pointer-events-auto">
      <div className="glass rounded-2xl p-1.5 flex gap-1.5">
        <CareBtn icon="🥣" label="Миска" sub={`${pct(cage.bowlFood)} · ${inv.food_mix ?? 0}`} warn={cage.bowlFood < 20} onClick={() => g().fillBowl()} />
        <CareBtn icon="💧" label="Вода" sub={pct(cage.water)} warn={cage.water < 25} onClick={() => g().refreshWater()} />
        <CareBtn icon="🧻" label="Подстилка" sub={`${pct(cage.bedding)} · ${inv.care_bedding ?? 0}`} warn={cage.bedding < 25} onClick={() => g().refreshBedding()} />
        <CareBtn icon="📄" label="Салфетки" sub={`${inv.care_tissues ?? 0} шт.`} onClick={() => g().giveTissues()} />
      </div>
    </div>
  );
}

function CareBtn({ icon, label, sub, onClick, warn }: { icon: string; label: string; sub: string; onClick: () => void; warn?: boolean }) {
  return (
    <button
      className={`rounded-xl px-2 py-1 min-w-[62px] flex flex-col items-center active:scale-95 transition ${warn ? 'bg-amber-100' : 'bg-cream-100'}`}
      onClick={() => {
        click();
        onClick();
      }}
    >
      <span className="text-xl leading-none">{icon}</span>
      <span className="text-[11px] font-extrabold text-cocoa-700 leading-tight mt-0.5">{label}</span>
      <span className="text-[10px] font-bold text-cocoa-500 leading-tight">{sub}</span>
    </button>
  );
}

export function ActionBar() {
  const selected = useUi((s) => s.selected);
  const set = useUi((s) => s.set);
  const rat = useGame((s) => s.rats.find((r) => r.id === selected && r.alive));
  if (!rat) return null;
  const act = (fn: () => void) => () => {
    click();
    fn();
  };
  return (
    <div className="absolute z-20 bottom-0 left-1/2 -translate-x-1/2 safe-bottom pointer-events-auto max-w-[calc(100vw-250px)] min-w-[300px]">
      <div className="glass rounded-2xl p-1.5 animate-pop">
        <div className="flex items-center gap-2 px-1 pb-1">
          <RatAvatar a={rat.appearance} size={26} />
          <div className="font-extrabold text-cocoa-800 truncate flex-1">{rat.name}</div>
          <MiniStat icon="🍎" v={rat.stats.satiety} />
          <MiniStat icon="💗" v={rat.stats.trust} />
          <button className="text-cocoa-400 px-1" onClick={act(() => set({ selected: null }))} aria-label="Снять выбор">
            ✕
          </button>
        </div>
        <div className="flex gap-1 overflow-x-auto">
          <ActBtn icon="🍓" label="Лакомство" onClick={act(() => set({ panel: 'treat' }))} />
          <ActBtn
            icon="🤚"
            label="Погладить"
            onClick={act(() => {
              engine().world.startMode('pet', rat.id);
              engine().setCamMode('pet');
              set({ mode: 'pet', panel: null });
            })}
          />
          <ActBtn
            icon="📣"
            label="Позвать"
            onClick={act(() => {
              useGame.getState().call(rat.id);
              bus.emit('worldCall', { ratId: rat.id });
              bus.emit('toast', { text: `«${rat.name}!»`, kind: 'info' });
            })}
          />
          <ActBtn
            icon="🪶"
            label="Играть"
            onClick={act(() => {
              engine().world.startMode('play', rat.id, 'feather');
              engine().setCamMode('play');
              set({ mode: 'play', panel: null });
            })}
          />
          <ActBtn icon="🎓" label="Трюки" onClick={act(() => set({ panel: 'tricks' }))} />
          <ActBtn
            icon="📷"
            label="Фото"
            onClick={act(() => {
              engine().setCamMode('photo', rat.id);
              set({ mode: 'photo', panel: null });
            })}
          />
          <ActBtn
            icon="📋"
            label="Карточка"
            onClick={act(() => {
              set({ panel: 'card' });
              useGame.getState().emit('open_card');
            })}
          />
        </div>
      </div>
    </div>
  );
}

function MiniStat({ icon, v }: { icon: string; v: number }) {
  return (
    <div className="flex items-center gap-0.5 text-[12px] font-bold text-cocoa-600">
      <span>{icon}</span>
      <span>{Math.round(v)}</span>
    </div>
  );
}

function ActBtn({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button className="rounded-xl bg-cream-100 px-2 py-1 min-w-[64px] flex flex-col items-center active:scale-95 transition shrink-0" onClick={onClick}>
      <span className="text-xl leading-none">{icon}</span>
      <span className="text-[11px] font-extrabold text-cocoa-700 leading-tight mt-0.5">{label}</span>
    </button>
  );
}

/** Имена над крысами (обновляются каждый кадр без перерисовки React) */
export function NameLabels() {
  const rats = useGame((s) => s.rats);
  const selected = useUi((s) => s.selected);
  const flash = useUi((s) => s.nameFlash);
  const mode = useUi((s) => s.mode);
  const refs = useRef(new Map<string, HTMLDivElement>());
  const [, force] = useState(0);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => force((x) => x + 1), Math.max(0, flash.until - Date.now()) + 50);
    return () => clearTimeout(t);
  }, [flash]);
  useEffect(() => {
    const e = engine();
    const tmp = { x: 0, y: 0, visible: false };
    return e.onFrame(() => {
      for (const [id, el] of refs.current) {
        e.ratScreenPos(id, tmp);
        if (!tmp.visible) {
          el.style.opacity = '0';
          continue;
        }
        el.style.opacity = '1';
        el.style.transform = `translate(${tmp.x}px, ${tmp.y}px) translate(-50%, -100%)`;
      }
    });
  }, []);
  if (mode === 'photo') return null;
  const shown = rats.filter((r) => r.alive && (r.id === selected || (flash && flash.id === r.id && flash.until > Date.now())));
  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      {shown.map((r) => (
        <div
          key={r.id}
          ref={(el) => {
            if (el) refs.current.set(r.id, el);
            else refs.current.delete(r.id);
          }}
          className="absolute left-0 top-0 transition-opacity"
          style={{ opacity: 0 }}
        >
          <div className={`rounded-full px-2.5 py-0.5 text-[13px] font-extrabold shadow-soft whitespace-nowrap ${r.id === selected ? 'bg-berry-500 text-white' : 'bg-cream-50/95 text-cocoa-800'}`}>
            {r.sex === 'm' ? '♂' : '♀'} {r.name}
          </div>
        </div>
      ))}
    </div>
  );
}
