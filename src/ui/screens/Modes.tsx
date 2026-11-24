import { useEffect, useRef, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { useUi } from '../uiStore';
import { Modal, RatAvatar, click, engine } from '../components/common';
import { Engine } from '../../engine/Engine';
import { getPhoto, putPhoto } from '../../store/persistence';
import { exportPhoto } from '../../platform/native';
import { bus } from '../../store/bus';
import { buildLayout } from '../../cage/layout';
import { PLACEABLES, placeableDef } from '../../store/data/items';
import { trickDef } from '../../store/data/personalities';
import { haptic } from '../../platform/native';

// ---------------------------------------------------------------- Фоторежим

export function PhotoMode() {
  const set = useUi((s) => s.set);
  const selected = useUi((s) => s.selected);
  const addPhoto = useGame((s) => s.addPhoto);
  const [flash, setFlash] = useState(0);
  const [controls, setControls] = useState(true);
  const [last, setLast] = useState<string | null>(null);

  const exit = () => {
    click();
    engine().setCamMode(selected ? 'follow' : 'overview', selected);
    set({ mode: 'normal' });
  };

  const shoot = async () => {
    const e = engine();
    const data = e.capture();
    bus.emit('sound', { name: 'shutter' });
    haptic('medium');
    setFlash((f) => f + 1);
    const id = `p${Date.now()}`;
    const thumb = await Engine.thumb(data);
    await putPhoto(id, data);
    await putPhoto(`${id}_t`, thumb);
    const g = useGame.getState();
    const names = selected ? [g.rats.find((r) => r.id === selected)?.name ?? ''] : g.rats.filter((r) => r.alive).map((r) => r.name);
    addPhoto(id, names.filter(Boolean));
    setLast(thumb);
  };

  return (
    <div className="absolute inset-0 z-30 pointer-events-none">
      {flash > 0 && <div key={flash} className="absolute inset-0 bg-white animate-flash" />}
      {controls && (
        <>
          <div className="absolute top-0 left-0 safe-top safe-left p-2 flex gap-2 pointer-events-auto">
            <button className="rounded-full bg-black/35 text-white w-11 h-11 text-xl active:scale-95" onClick={exit} aria-label="Выйти из фоторежима">
              ✕
            </button>
            <button className="rounded-full bg-black/35 text-white px-3 h-11 text-[13px] font-bold active:scale-95" onClick={() => setControls(false)}>
              Скрыть кнопки
            </button>
          </div>
          <div className="absolute bottom-0 inset-x-0 safe-bottom flex items-center justify-center gap-6 pb-3 pointer-events-auto">
            {last ? (
              <button className="w-14 h-14 rounded-xl overflow-hidden border-2 border-white shadow-soft active:scale-95" onClick={() => { click(); set({ mode: 'normal', panel: 'album' }); engine().setCamMode('overview'); }}>
                <img src={last} className="w-full h-full object-cover" alt="Последнее фото" />
              </button>
            ) : (
              <div className="w-14" />
            )}
            <button className="w-20 h-20 rounded-full bg-white/90 border-[6px] border-white/50 shadow-soft active:scale-90 transition" onClick={shoot} aria-label="Сделать снимок" />
            <div className="w-14 text-center text-white/80 text-[11px] font-bold leading-tight drop-shadow">1 палец — вращать, 2 — приблизить</div>
          </div>
        </>
      )}
      {!controls && <button className="absolute inset-0 pointer-events-auto" style={{ background: 'transparent' }} onClick={() => setControls(true)} aria-label="Показать кнопки" />}
    </div>
  );
}

// ---------------------------------------------------------------- Альбом

export function Album() {
  const photos = useGame((s) => s.photos);
  const remove = useGame((s) => s.removePhoto);
  const set = useUi((s) => s.set);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [full, setFull] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const out: Record<string, string> = {};
      for (const p of photos.slice(0, 120)) {
        const t = await getPhoto(`${p.id}_t`);
        if (t) out[p.id] = t;
      }
      if (alive) setThumbs(out);
    })();
    return () => {
      alive = false;
    };
  }, [photos]);
  useEffect(() => {
    if (!open) return;
    setFull(null);
    void getPhoto(open).then(setFull);
  }, [open]);

  if (open) {
    const meta = photos.find((p) => p.id === open);
    return (
      <Modal title="📷 Фото" onClose={() => setOpen(null)} wide>
        {full ? <img src={full} className="w-full rounded-2xl" alt="Фото крысок" /> : <div className="h-48 flex items-center justify-center text-cocoa-500">Загрузка…</div>}
        <div className="text-[13px] text-cocoa-500 mt-2">
          {meta && new Date(meta.createdAt).toLocaleString('ru-RU')} {meta?.ratNames.length ? `· ${meta.ratNames.join(', ')}` : ''}
        </div>
        <div className="flex gap-2 mt-3">
          <button
            className="btn-primary flex-1"
            disabled={!full}
            onClick={async () => {
              click();
              if (!full) return;
              const msg = await exportPhoto(full, `krysky_${open}`);
              bus.emit('toast', { text: msg, kind: 'info' });
            }}
          >
            ⬇️ Сохранить на устройство
          </button>
          <button
            className="btn-soft text-rose-700"
            onClick={() => {
              click();
              remove(open);
              setOpen(null);
            }}
          >
            🗑️ Удалить
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="🖼️ Фотоальбом" onClose={() => set({ panel: null })} wide>
      {photos.length === 0 ? (
        <div className="text-center text-cocoa-500 py-8">
          Пока нет фотографий. Нажми 📷 и поймай милый момент!
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map((p) => (
            <button key={p.id} className="aspect-[4/3] rounded-xl overflow-hidden bg-cream-200 active:scale-95 transition" onClick={() => { click(); setOpen(p.id); }}>
              {thumbs[p.id] ? <img src={thumbs[p.id]} className="w-full h-full object-cover" alt="" /> : null}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- Обустройство

export function DecorMode() {
  const set = useUi((s) => s.set);
  const slotId = useUi((s) => s.decorSlot);
  const g = useGame();
  useEffect(() => {
    const e = engine();
    e.setDecorMode(true);
    e.setCamMode('overview');
    return () => {
      e.setDecorMode(false);
      e.world.cage.highlightSlot(null);
    };
  }, []);
  useEffect(() => {
    engine().world.cage.highlightSlot(slotId);
  }, [slotId, g.cage]);

  const layout = buildLayout(g.cage.cageId, g.cage.secondFloor);
  const slot = layout.slots.find((s) => s.id === slotId);
  const placed = g.cage.placed.find((p) => p.slotId === slotId);
  const fits = slot ? PLACEABLES.filter((p) => p.slot === slot.kind && (g.inventory[p.id] ?? 0) > 0) : [];

  return (
    <>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 safe-top pointer-events-auto">
        <div className="glass rounded-2xl px-4 py-2 flex items-center gap-3 animate-pop">
          <div>
            <div className="font-extrabold text-cocoa-800">🪑 Обустройство клетки</div>
            <div className="text-[12px] text-cocoa-500">Нажми на кружок на полу или крючок под крышей</div>
          </div>
          <button className="btn-primary" onClick={() => { click(); set({ mode: 'normal', decorSlot: null }); }}>
            Готово
          </button>
        </div>
      </div>
      {slot && (
        <div className="absolute right-0 top-[70px] bottom-0 z-20 safe-right safe-bottom px-2 pointer-events-auto w-[300px] max-w-[46vw]">
          <div className="glass rounded-3xl h-full flex flex-col animate-pop">
            <div className="px-3 pt-3 pb-2 border-b border-cream-200 flex items-center">
              <div className="flex-1">
                <div className="font-extrabold text-cocoa-800">{slot.name}</div>
                <div className="text-[12px] text-cocoa-500">{slot.kind === 'hang' ? 'Подвесной слот' : slot.level === 1 ? 'Полка второго этажа' : 'Место на полу'}</div>
              </div>
              <button className="btn-ghost !p-1 text-xl" onClick={() => set({ decorSlot: null })}>
                ✕
              </button>
            </div>
            <div className="scroll-y flex-1 p-3 space-y-2">
              {placed && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-2.5 flex items-center gap-2">
                  <div className="flex-1 text-[14px] font-bold text-cocoa-800">Сейчас: {placeableDef(placed.itemId)?.name}</div>
                  <button className="btn-soft !py-1 text-[13px]" onClick={() => { click(); g.removeItem(slot.id); bus.emit('sound', { name: 'place' }); }}>
                    Убрать
                  </button>
                </div>
              )}
              <div className="text-[12px] font-extrabold text-cocoa-600 uppercase">Со склада</div>
              {fits.length === 0 && <div className="text-[13px] text-cocoa-500">Подходящих предметов нет — загляни в магазин 🛒</div>}
              {fits.map((p) => (
                <button
                  key={p.id}
                  className="w-full rounded-2xl bg-cream-100 border border-cream-200 p-2.5 text-left active:scale-[0.98] transition"
                  onClick={() => {
                    click();
                    if (g.placeItem(slot.id, p.id)) bus.emit('sound', { name: 'place' });
                  }}
                >
                  <div className="font-extrabold text-cocoa-800 text-[14px]">{p.name}</div>
                  <div className="text-[12px] text-cocoa-500">На складе: {g.inventory[p.id]}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------- Поглаживание

export function PetOverlay() {
  const set = useUi((s) => s.set);
  const selected = useUi((s) => s.selected);
  const rat = useGame((s) => s.rats.find((r) => r.id === selected));
  const done = () => {
    click();
    engine().world.endMode();
    useGame.getState().emit('pet');
    set({ mode: 'normal' });
  };
  if (!rat) return null;
  return (
    <ModeBanner
      title={`🤚 Поглаживание: ${rat.name}`}
      sub="Медленно проведи пальцем по спинке — крыска зажмурится и заскрипит зубками от удовольствия"
      right={
        <button className="btn-primary" onClick={done}>
          Готово
        </button>
      }
    >
      <TrustMeter v={rat.stats.trust} />
    </ModeBanner>
  );
}

function TrustMeter({ v }: { v: number }) {
  return (
    <div className="flex items-center gap-2 mt-1">
      <span>💗</span>
      <div className="w-40 h-2 rounded-full bg-cream-200 overflow-hidden">
        <div className="h-full bg-berry-400 transition-all" style={{ width: `${v}%` }} />
      </div>
      <span className="text-[12px] font-bold text-cocoa-600">{Math.round(v)}</span>
    </div>
  );
}

function ModeBanner({ title, sub, right, children }: { title: string; sub: string; right: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 safe-top pointer-events-auto w-[min(96vw,620px)]">
      <div className="glass rounded-2xl px-4 py-2 flex items-center gap-3 animate-pop">
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-cocoa-800">{title}</div>
          <div className="text-[12px] text-cocoa-500 leading-snug">{sub}</div>
          {children}
        </div>
        {right}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Игра

export function PlayOverlay() {
  const set = useUi((s) => s.set);
  const selected = useUi((s) => s.selected);
  const rat = useGame((s) => s.rats.find((r) => r.id === selected));
  const [left, setLeft] = useState(30);
  const [catches, setCatches] = useState(0);
  const [toy, setToy] = useState<'feather' | 'ball'>('feather');
  const ended = useRef(false);

  const finish = () => {
    if (ended.current) return;
    ended.current = true;
    const e = engine();
    const c = e.world.catches;
    e.world.endMode();
    if (selected) useGame.getState().playFinished(selected, c, toy === 'feather' ? 'feather' : 'ball');
    bus.emit('toast', { text: `Поймано: ${c}! Крыска довольна 🎉`, kind: 'quest' });
    set({ mode: 'normal' });
  };

  useEffect(() => {
    const t = setInterval(() => setLeft((l) => l - 1), 1000);
    const off = bus.on('playScore', ({ catches: c }) => setCatches(c));
    return () => {
      clearInterval(t);
      off();
    };
  }, []);
  useEffect(() => {
    if (left <= 0) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  if (!rat) return null;
  return (
    <ModeBanner
      title={`🪶 Игра: ${rat.name} · ${Math.max(0, left)} с`}
      sub="Води пальцем по полу клетки — крыска охотится за игрушкой"
      right={
        <div className="flex flex-col gap-1 items-end">
          <div className="font-extrabold text-cocoa-800 text-lg">🎯 {catches}</div>
          <button className="btn-soft !py-1 text-[13px]" onClick={() => { click(); finish(); }}>
            Закончить
          </button>
        </div>
      }
    >
      <div className="flex gap-1.5 mt-1">
        {(
          [
            ['feather', '🪶 Пёрышко'],
            ['ball', '⚾ Мячик'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className={`chip ${toy === id ? 'bg-berry-500 text-white border-berry-500' : 'bg-cream-100 border-cream-300 text-cocoa-700'}`}
            onClick={() => {
              click();
              setToy(id);
              const w = engine().world;
              const c = w.catches;
              w.startMode('play', rat.id, id);
              w.catches = c;
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </ModeBanner>
  );
}

// ---------------------------------------------------------------- Дрессировка

export function TrainOverlay() {
  const set = useUi((s) => s.set);
  const selected = useUi((s) => s.selected);
  const trick = useUi((s) => s.trainTrick);
  const rat = useGame((s) => s.rats.find((r) => r.id === selected));
  const [pos, setPos] = useState(0);
  const [busyUntil, setBusyUntil] = useState(0);
  const [msg, setMsg] = useState('Дождись, когда метка окажется в зелёной зоне, и дай лакомство!');
  const tRef = useRef(0);
  useEffect(() => {
    let raf = 0;
    const loop = (t: number) => {
      tRef.current = t;
      setPos((Math.sin(t / 420) + 1) / 2);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  if (!rat || !trick) return null;
  const def = trickDef(trick);
  const progress = rat.tricks[trick] ?? 0;
  const zone = 0.16 + (1 - Math.min(1, rat.stats.trust / 100)) * -0.04;
  const busy = Date.now() < busyUntil;

  const attempt = () => {
    if (busy) return;
    click();
    const success = Math.abs(pos - 0.5) < zone;
    const res = useGame.getState().trainAttempt(rat.id, trick, success);
    engine().world.trainAttempt(trick, success);
    haptic(success ? 'medium' : 'light');
    setBusyUntil(Date.now() + (success ? 3600 : 1600));
    if (res.learned) setMsg(`Ура! «${def.name}» выучен! Теперь его можно показать в любой момент.`);
    else setMsg(success ? `Отлично! ${rat.name} понимает, чего от ${rat.sex === "m" ? "него" : "неё"} ждут. Прогресс: ${Math.round(res.progress * 100)}%` : 'Чуть мимо — крыска не поняла. Попробуй ещё раз!');
  };

  const done = () => {
    click();
    engine().world.endMode();
    set({ mode: 'normal', trainTrick: null });
  };

  return (
    <>
      <ModeBanner
        title={`🎓 «${def.name}»: ${rat.name}`}
        sub={msg}
        right={
          <button className="btn-soft" onClick={done}>
            Закончить
          </button>
        }
      >
        <div className="flex items-center gap-2 mt-1">
          <RatAvatar a={rat.appearance} size={22} />
          <div className="w-40 h-2 rounded-full bg-cream-200 overflow-hidden">
            <div className="h-full bg-berry-400 transition-all" style={{ width: `${progress * 100}%` }} />
          </div>
          <span className="text-[12px] font-bold text-cocoa-600">{Math.round(progress * 100)}%</span>
        </div>
      </ModeBanner>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-20 safe-bottom pointer-events-auto w-[min(92vw,460px)]">
        <div className="glass rounded-2xl p-3 flex items-center gap-3">
          <div className="relative flex-1 h-8 rounded-full bg-cream-200 overflow-hidden">
            <div className="absolute top-0 bottom-0 bg-sage-400/70" style={{ left: `${(0.5 - zone) * 100}%`, width: `${zone * 200}%` }} />
            <div className="absolute top-1 bottom-1 w-3 rounded-full bg-berry-500 shadow" style={{ left: `calc(${pos * 100}% - 6px)` }} />
          </div>
          <button className="btn-primary !py-3 text-[15px] disabled:opacity-50" disabled={busy || progress >= 1} onClick={attempt}>
            🌻 Лакомство!
          </button>
        </div>
      </div>
    </>
  );
}
