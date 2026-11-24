import { useEffect, useRef, useState } from 'react';
import { Engine } from './engine/Engine';
import { AudioEngine } from './audio/AudioEngine';
import { useGame, type ReturnSummary } from './store/gameStore';
import { useUi } from './ui/uiStore';
import { Toasts, setEngine, click, maybeEngine } from './ui/components/common';
import { Intro } from './ui/screens/Intro';
import { Adoption } from './ui/screens/Adoption';
import { ActionBar, CameraBar, CareBar, NameLabels, QuestHint, Roster, TopBar } from './ui/screens/HUD';
import { DedicationPanel, FamilyPanel, PetCard, QuestsPanel, TreatPicker, TricksPanel, WelcomeBack } from './ui/screens/Panels';
import { Shop } from './ui/screens/Shop';
import { SettingsPanel } from './ui/screens/Settings';
import { Album, DecorMode, PetOverlay, PhotoMode, PlayOverlay, TrainOverlay } from './ui/screens/Modes';

type Phase = 'loading' | 'intro' | 'adopt' | 'game';

export default function App() {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>('loading');
  const [welcome, setWelcome] = useState<ReturnSummary | null>(null);
  const [glError, setGlError] = useState(false);
  const ui = useUi();

  // --- запуск движка ---
  useEffect(() => {
    if (!host.current) return;
    let e: Engine;
    try {
      e = new Engine(host.current);
    } catch (err) {
      console.error(err);
      setGlError(true);
      return;
    }
    setEngine(e);
    const audio = new AudioEngine();
    e.start();
    const g = useGame.getState();
    if (!g.introSeen) setPhase('intro');
    else if (!g.started) setPhase('adopt');
    else {
      const sum = g.applyOffline();
      if (sum) setWelcome(sum);
      setPhase('game');
    }
    setReady(true);

    const onVis = () => {
      const st = useGame.getState();
      if (document.hidden) {
        st.save();
        e.stop();
      } else {
        const sum = st.applyOffline();
        if (sum && sum.minutes >= 5) setWelcome(sum);
        e.start();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', () => useGame.getState().save());
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      audio.dispose();
      e.dispose();
      setEngine(null);
    };
  }, []);

  // --- касания по 3D-сцене ---
  useEffect(() => {
    const el = host.current;
    if (!el || !ready) return;
    let down: { x: number; y: number; t: number } | null = null;
    const e: Engine | null = maybeEngine();
    const onDown = (ev: PointerEvent) => {
      down = { x: ev.clientX, y: ev.clientY, t: performance.now() };
      handleMove(ev);
    };
    const handleMove = (ev: PointerEvent) => {
      if (!e) return;
      const mode = useUi.getState().mode;
      const sel = useUi.getState().selected;
      if (mode === 'pet' && sel && (ev.buttons || ev.pointerType === 'touch')) {
        const p = e.pickOnRat(ev.clientX, ev.clientY, sel);
        e.world.petPointer(p);
      } else if (mode === 'play' && (ev.buttons || ev.pointerType === 'touch')) {
        const p = e.pickFloor(ev.clientX, ev.clientY);
        e.world.playPointer(p);
      }
    };
    const onUp = (ev: PointerEvent) => {
      if (!e) return;
      const mode = useUi.getState().mode;
      if (mode === 'pet') e.world.petPointer(null);
      if (!down) return;
      const dist = Math.hypot(ev.clientX - down.x, ev.clientY - down.y);
      const dt = performance.now() - down.t;
      down = null;
      if (dist > 10 || dt > 450) return;
      if (mode === 'photo' || mode === 'pet' || mode === 'play' || mode === 'train') return;
      const hit = e.pick(ev.clientX, ev.clientY);
      const st = useUi.getState();
      if (!hit) {
        if (mode === 'decor') st.set({ decorSlot: null });
        return;
      }
      if (hit.type === 'slot' && mode === 'decor') {
        click();
        st.set({ decorSlot: hit.id });
      } else if (hit.type === 'rat' && mode === 'normal') {
        click();
        if (st.selected === hit.id && st.nameFlash && st.nameFlash.id === hit.id && st.nameFlash.until > Date.now()) {
          st.set({ panel: 'card' });
          useGame.getState().emit('open_card');
        } else {
          st.set({ selected: hit.id, nameFlash: { id: hit.id, until: Date.now() + 2500 } });
        }
      } else if (hit.type === 'plaque' && mode === 'normal') {
        click();
        st.set({ panel: 'dedication' });
      }
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [ready]);

  // в спец-режимах вращение камеры одним пальцем отключаем
  useEffect(() => {
    if (!ready) return;
    const e = maybeEngine();
    if (!e) return;
    const locked = ui.mode === 'pet' || ui.mode === 'play';
    e.controls.enableRotate = !locked;
  }, [ui.mode, ready]);

  const g = useGame();
  const inGame = phase === 'game' && g.started;
  const normal = ui.mode === 'normal';

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div ref={host} className="absolute inset-0" />
      {glError && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <div className="glass rounded-3xl p-6 max-w-md">
            <div className="text-4xl mb-2">🐀</div>
            <div className="panel-title mb-2">Не удалось запустить 3D</div>
            <p className="text-cocoa-600">Похоже, на этом устройстве недоступен WebGL. Обнови Android System WebView в Google Play и перезапусти игру.</p>
          </div>
        </div>
      )}
      {ready && phase === 'intro' && (
        <Intro
          onDone={() => {
            useGame.getState().markIntroSeen();
            setPhase(useGame.getState().started ? 'game' : 'adopt');
          }}
        />
      )}
      {ready && phase === 'adopt' && <Adoption onDone={() => setPhase('game')} />}
      {ready && inGame && (
        <>
          {ui.mode !== 'photo' && <NameLabels />}
          {normal && (
            <>
              <TopBar />
              <QuestHint />
              <Roster />
              <CameraBar />
              {ui.selected ? <ActionBar /> : <CareBar />}
            </>
          )}
          {ui.mode === 'photo' && <PhotoMode />}
          {ui.mode === 'decor' && <DecorMode />}
          {ui.mode === 'pet' && <PetOverlay />}
          {ui.mode === 'play' && <PlayOverlay />}
          {ui.mode === 'train' && <TrainOverlay />}
          {ui.panel === 'card' && <PetCard />}
          {ui.panel === 'family' && <FamilyPanel />}
          {ui.panel === 'treat' && <TreatPicker />}
          {ui.panel === 'tricks' && <TricksPanel />}
          {ui.panel === 'shop' && <Shop />}
          {ui.panel === 'quests' && <QuestsPanel />}
          {ui.panel === 'settings' && <SettingsPanel />}
          {ui.panel === 'album' && <Album />}
          {ui.panel === 'dedication' && <DedicationPanel />}
          {ui.panel === 'adoptMore' && <Adoption more onDone={() => ui.set({ panel: null })} />}
          {welcome && <WelcomeBack minutes={welcome.minutes} lines={welcome.lines} onClose={() => setWelcome(null)} />}
        </>
      )}
      <Toasts />
    </div>
  );
}
