import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Eye,
  Heart,
  Image as ImageIcon,
  Layers,
  Paintbrush,
  Settings,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import type {
  CameraMode,
  FloatingFeedback,
  ProjectedRatLabel,
  RatAppearance,
  ShopCategory,
  TrickId,
} from './types/game';
import { GameScene } from './engine/GameScene';
import {
  getDefaultAppearance,
  useGameStore,
  type QuestProgressCounters,
} from './store/gameStore';
import { QUESTS } from './cage/catalog';
import { IntroCutsceneUI } from './ui/IntroCutsceneUI';
import { RatActionBar } from './ui/RatActionBar';
import { DecorateOverlay } from './ui/DecorateOverlay';
import { PetCardModal } from './ui/PetCardModal';
import { TrainingModal } from './ui/TrainingModal';
import { ShopModal } from './ui/ShopModal';
import { QuestsModal } from './ui/QuestsModal';
import { GalleryModal } from './ui/GalleryModal';
import { SettingsModal } from './ui/SettingsModal';
import { PetsListModal } from './ui/PetsListModal';
import { DedicationModal } from './ui/DedicationModal';

const CAMERA_MODES: { id: CameraMode; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Клетка', icon: <Layers className="w-3.5 h-3.5" /> },
  { id: 'pet_level', label: 'Вблизи', icon: <Eye className="w-3.5 h-3.5" /> },
  { id: 'follow', label: 'Следить', icon: <Target className="w-3.5 h-3.5" /> },
  { id: 'photo', label: 'Фото', icon: <Camera className="w-3.5 h-3.5" /> },
];

export function App() {
  const store = useGameStore();
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<GameScene | null>(null);

  const [introPreviewAppearance, setIntroPreviewAppearance] = useState<RatAppearance>(() =>
    getDefaultAppearance()
  );
  const [ratLabels, setRatLabels] = useState<ProjectedRatLabel[]>([]);
  const [recentBadgeRatId, setRecentBadgeRatId] = useState<string | null>(null);
  const [floatingFeedbacks, setFloatingFeedbacks] = useState<FloatingFeedback[]>([]);
  const [shutterFlash, setShutterFlash] = useState(false);

  // Modals
  const [petCardRatId, setPetCardRatId] = useState<string | null>(null);
  const [showTraining, setShowTraining] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [shopTab, setShopTab] = useState<ShopCategory | 'adopt'>('food');
  const [showQuests, setShowQuests] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPetsList, setShowPetsList] = useState(false);

  const badgeTimerRef = useRef<number | null>(null);
  const feedbackIdRef = useRef(1);

  const spawnFeedback = useCallback((text: string, screenX: number, screenY: number) => {
    const id = feedbackIdRef.current++;
    setFloatingFeedbacks((prev) => [...prev.slice(-8), { id, text, screenX, screenY }]);
    window.setTimeout(() => {
      setFloatingFeedbacks((prev) => prev.filter((item) => item.id !== id));
    }, 1350);
  }, []);

  // Hydrate persisted save + configure native Android status bar
  useEffect(() => {
    store.hydrate();
    if (Capacitor.isNativePlatform()) {
      StatusBar.setStyle({ style: Style.Light }).catch(() => {});
      StatusBar.setBackgroundColor({ color: '#EADCC8' }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Simulation heartbeat (every 2 seconds)
  useEffect(() => {
    const interval = window.setInterval(() => {
      useGameStore.getState().tickSimulation(2);
    }, 2000);
    return () => window.clearInterval(interval);
  }, []);

  // Mount Three.js WebGL2 Scene once
  useEffect(() => {
    if (!canvasHostRef.current) return;

    const scene = new GameScene(canvasHostRef.current, {
      onRatTapped: (ratId, alreadySelected) => {
        const st = useGameStore.getState();
        st.selectRat(ratId);
        setRecentBadgeRatId(ratId);
        if (badgeTimerRef.current) window.clearTimeout(badgeTimerRef.current);
        badgeTimerRef.current = window.setTimeout(() => setRecentBadgeRatId(null), 4200);
        if (alreadySelected) {
          setPetCardRatId(ratId);
        }
      },
      onSlotTapped: (slotId) => {
        const st = useGameStore.getState();
        if (st.decorateSelectedItemId) {
          st.placeItemInSlot(slotId, st.decorateSelectedItemId);
        } else {
          st.setToast('Сначала выбери предмет в нижней панели!');
        }
      },
      onPlaqueTapped: () => {
        useGameStore.getState().setShowDedicationModal(true);
      },
      onPetProgress: (ratId, sx, sy) => {
        useGameStore.getState().petRatTick(ratId);
        spawnFeedback('❤ +Доверие', sx, sy);
      },
      onPlayProgress: (ratId, sx, sy) => {
        useGameStore.getState().playWithRatTick(ratId);
        spawnFeedback('✨ Весело! +5', sx, sy);
      },
      onLabelsUpdate: (labels) => {
        setRatLabels(labels);
      },
    });

    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, [spawnFeedback]);

  // Sync store state into Three.js Scene
  useEffect(() => {
    sceneRef.current?.syncState({
      introMode: !store.introCompleted,
      introPreviewAppearance,
      rats: store.rats,
      selectedRatId: store.selectedRatId,
      habitat: store.activeHabitat,
      theme: store.activeTheme,
      hasSecondFloor: store.hasSecondFloor,
      placedItems: store.placedItems,
      cameraMode: store.cameraMode,
      interactionMode: store.interactionMode,
      decorateSelectedItemId: store.decorateSelectedItemId,
    });
  }, [
    store.introCompleted,
    introPreviewAppearance,
    store.rats,
    store.selectedRatId,
    store.activeHabitat,
    store.activeTheme,
    store.hasSecondFloor,
    store.placedItems,
    store.cameraMode,
    store.interactionMode,
    store.decorateSelectedItemId,
  ]);

  const aliveRats = useMemo(() => store.rats.filter((r) => r.alive), [store.rats]);
  const selectedRat = useMemo(
    () => aliveRats.find((r) => r.id === store.selectedRatId) ?? null,
    [aliveRats, store.selectedRatId]
  );
  const cardRat = useMemo(
    () => store.rats.find((r) => r.id === petCardRatId) ?? null,
    [store.rats, petCardRatId]
  );

  // Active next starter quest hint & claimable count badge
  const { activeStarterQuest, claimableQuestCount } = useMemo(() => {
    let claimable = 0;
    let nextStarter = null;
    for (const q of QUESTS) {
      const val = store.counters[q.trackKey as keyof QuestProgressCounters] ?? 0;
      const done = val >= q.target;
      const claimed = store.claimedQuests.includes(q.id);
      if (done && !claimed) claimable++;
      if (!nextStarter && q.kind === 'starter' && !claimed) {
        nextStarter = { def: q, val, done };
      }
    }
    return { activeStarterQuest: nextStarter, claimableQuestCount: claimable };
  }, [store.counters, store.claimedQuests]);

  const handleFeedSelected = (foodItemId: string) => {
    if (!selectedRat) return;
    if (store.feedRat(selectedRat.id, foodItemId)) {
      sceneRef.current?.commandFeedRat(selectedRat.id);
    }
  };

  const handleCallSelected = () => {
    if (!selectedRat) return;
    store.callRat(selectedRat.id);
    sceneRef.current?.commandCallRat(selectedRat.id, selectedRat.stats.trust);
  };

  const handleTriggerTrick = (ratId: string, trickId: TrickId) => {
    sceneRef.current?.commandRatTrick(ratId, trickId);
  };

  const handleTakePhoto = () => {
    if (!sceneRef.current) return;
    setShutterFlash(true);
    window.setTimeout(() => setShutterFlash(false), 180);
    const dataUrl = sceneRef.current.capturePhotoDataUrl();
    store.addPhoto(
      dataUrl,
      aliveRats.map((r) => r.name)
    );
  };

  const isPhotoMode = store.cameraMode === 'photo' && store.introCompleted;
  const isDecorateMode = store.interactionMode === 'decorate' && store.introCompleted;

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#EAE0D0]">
      {/* 3D WebGL2 Canvas */}
      <div ref={canvasHostRef} className="absolute inset-0 w-full h-full" />

      {/* Camera shutter white flash */}
      {shutterFlash && (
        <div className="fixed inset-0 z-50 bg-white/85 pointer-events-none transition-opacity" />
      )}

      {/* Floating 3D-projected rat nameplates (hidden during intro & photo mode!) */}
      {store.introCompleted && !isPhotoMode && !isDecorateMode && (
        <div className="fixed inset-0 z-10 pointer-events-none overflow-hidden">
          {ratLabels.map((lbl) => {
            if (!lbl.visible) return null;
            const isHighlighted =
              lbl.ratId === store.selectedRatId || lbl.ratId === recentBadgeRatId;
            if (!isHighlighted) return null;
            return (
              <button
                key={lbl.ratId}
                type="button"
                onClick={() => setPetCardRatId(lbl.ratId)}
                style={{ left: lbl.x, top: lbl.y }}
                className="pointer-events-auto absolute -translate-x-1/2 -translate-y-full px-2.5 py-1 rounded-full bg-[#FAF5EB]/92 backdrop-blur-xs border border-[#D8CBB3] shadow-md flex items-center gap-1.5 text-[11px] font-extrabold text-[#3B332B] active:scale-95 transition"
              >
                <span>{lbl.name}</span>
                <span className="text-[10px] font-semibold text-[#6E8572]">
                  • {lbl.activityLabel}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Floating feedback sparkles / hearts */}
      <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden">
        {floatingFeedbacks.map((fb) => (
          <div
            key={fb.id}
            style={{ left: fb.screenX, top: fb.screenY }}
            className="absolute animate-float-up text-xs font-extrabold text-[#C95C4E] bg-[#FAF5EB]/90 px-2.5 py-1 rounded-full shadow border border-[#E6C9BF]"
          >
            {fb.text}
          </div>
        ))}
      </div>

      {/* Intro 3D Cutscene & First Rat Customizer */}
      {store.hydrated && !store.introCompleted && (
        <IntroCutsceneUI
          appearance={introPreviewAppearance}
          onChangeAppearance={setIntroPreviewAppearance}
          onComplete={store.completeIntro}
        />
      )}

      {/* ZERO-CLUTTER PHOTO MODE OVERLAY */}
      {isPhotoMode && (
        <div className="fixed inset-0 z-30 pointer-events-none flex flex-col justify-between safe-pt safe-pb safe-px">
          <div className="flex justify-end pointer-events-auto">
            <button
              type="button"
              onClick={() => store.setCameraMode('overview')}
              className="flex items-center gap-1.5 bg-black/45 hover:bg-black/60 text-white backdrop-blur-md px-3.5 py-2 rounded-full text-xs font-bold"
            >
              <X className="w-4 h-4" />
              Выйти из фоторежима
            </button>
          </div>

          <div className="flex items-center justify-center gap-4 pb-2 pointer-events-auto">
            <button
              type="button"
              onClick={() => setShowGallery(true)}
              className="p-3 rounded-full bg-black/45 text-white backdrop-blur-md active:scale-95 transition"
              title="Альбом"
            >
              <ImageIcon className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={handleTakePhoto}
              className="w-16 h-16 rounded-full bg-white border-4 border-[#6E8572] shadow-xl flex items-center justify-center active:scale-90 transition"
              aria-label="Сделать снимок"
            >
              <div className="w-12 h-12 rounded-full bg-[#FAF5EB] border border-[#D8CEBC] flex items-center justify-center">
                <Camera className="w-6 h-6 text-[#5B7360]" />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* DECORATE MODE OVERLAY */}
      {isDecorateMode && (
        <DecorateOverlay onClose={() => store.setInteractionMode('none')} />
      )}

      {/* MAIN GAME HUD */}
      {store.hydrated && store.introCompleted && !isPhotoMode && !isDecorateMode && (
        <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between safe-pt safe-pb safe-px">
          {/* Top Bar */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 pointer-events-auto">
              {/* Left: Coins + Active Rats count */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setShopTab('food');
                    setShopOpen(true);
                  }}
                  className="flex items-center gap-1.5 bg-[#FAF5EB]/92 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-[#DFD3BD] shadow-sm active:scale-95 transition"
                >
                  <img src="./assets/icons/coin.png" alt="Монеты" className="w-5 h-5 object-contain" />
                  <span className="text-sm font-extrabold text-[#7A5922]">{store.coins}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPetsList(true)}
                  className="flex items-center gap-1.5 bg-[#FAF5EB]/92 backdrop-blur-md px-2.5 py-1.5 rounded-2xl border border-[#DFD3BD] shadow-sm active:scale-95 transition"
                >
                  <img src="./assets/icons/pets.png" alt="" className="w-5 h-5 object-contain" />
                  <span className="text-xs font-extrabold text-[#3B332B]">{aliveRats.length}</span>
                </button>
              </div>

              {/* Center: Camera Mode Switcher */}
              <div className="hidden sm:flex items-center gap-1 bg-[#FAF5EB]/90 backdrop-blur-md p-1 rounded-2xl border border-[#DFD3BD] shadow-sm">
                {CAMERA_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => store.setCameraMode(m.id)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold transition ${
                      store.cameraMode === m.id
                        ? 'bg-[#6E8572] text-white shadow-xs'
                        : 'text-[#5C4F42] hover:bg-white/70'
                    }`}
                  >
                    {m.icon}
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Right: Decorate, Dedication Plaque Heart, Settings */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => store.setInteractionMode('decorate')}
                  title="Обустроить клетку"
                  className="flex items-center gap-1 bg-[#FAF5EB]/92 backdrop-blur-md px-2.5 py-2 rounded-2xl border border-[#DFD3BD] text-[#4E6852] shadow-sm active:scale-95 transition"
                >
                  <Paintbrush className="w-4 h-4" />
                  <span className="hidden md:inline text-xs font-bold">Клетка</span>
                </button>

                <button
                  type="button"
                  onClick={() => store.setShowDedicationModal(true)}
                  title="Памятная табличка"
                  className="p-2 rounded-2xl bg-[#FAF5EB]/92 backdrop-blur-md border border-[#DFD3BD] text-[#CE5F52] shadow-sm active:scale-95 transition"
                >
                  <Heart className="w-4 h-4 fill-[#CE5F52]" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  title="Настройки"
                  className="p-2 rounded-2xl bg-[#FAF5EB]/92 backdrop-blur-md border border-[#DFD3BD] text-[#5B4F42] shadow-sm active:scale-95 transition"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Mobile compact camera strip */}
            <div className="flex sm:hidden items-center justify-center pointer-events-auto">
              <div className="flex items-center gap-1 bg-[#FAF5EB]/88 backdrop-blur-md p-1 rounded-2xl border border-[#DFD3BD] shadow-xs">
                {CAMERA_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => store.setCameraMode(m.id)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold transition ${
                      store.cameraMode === m.id
                        ? 'bg-[#6E8572] text-white'
                        : 'text-[#5C4F42]'
                    }`}
                  >
                    {m.icon}
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Soft dismissible starter quest hint pill */}
            {store.settings.showHints && activeStarterQuest && (
              <div className="flex justify-center pointer-events-auto">
                <div
                  onClick={() =>
                    activeStarterQuest.done
                      ? store.claimQuest(activeStarterQuest.def.id)
                      : setShowQuests(true)
                  }
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border shadow-sm cursor-pointer text-xs transition ${
                    activeStarterQuest.done
                      ? 'bg-[#E5F2E7] border-[#78A67F] text-[#2F5736]'
                      : 'bg-[#FAF5EB]/90 backdrop-blur-md border-[#DFD3BD] text-[#4C4136]'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#D29B35] shrink-0" />
                  <span className="font-bold">
                    {activeStarterQuest.done
                      ? `Забрать награду: ${activeStarterQuest.def.title} (+${activeStarterQuest.def.rewardCoins})`
                      : `Совет: ${activeStarterQuest.def.description}`}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      store.updateSettings({ showHints: false });
                    }}
                    title="Скрыть подсказки"
                    className="p-0.5 text-[#8A7B6A] hover:text-[#3B332B]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Area: Selected Rat Action Bar + Main Dock */}
          <div className="flex flex-col items-center w-full">
            {selectedRat && (
              <RatActionBar
                rat={selectedRat}
                onFeed={handleFeedSelected}
                onCall={handleCallSelected}
                onOpenTraining={() => setShowTraining(true)}
                onOpenCard={() => setPetCardRatId(selectedRat.id)}
                onQuickPhoto={() => {
                  sceneRef.current?.focusOnRat(selectedRat.id);
                  store.setCameraMode('photo');
                }}
                onDismiss={() => {
                  store.setInteractionMode('none');
                  store.selectRat(null);
                }}
              />
            )}

            {/* Main Bottom Navigation Dock */}
            <div className="pointer-events-auto flex items-center justify-around gap-1.5 w-full max-w-md bg-[#FAF5EB]/93 backdrop-blur-md px-2 py-1.5 rounded-3xl border border-[#DFD3BD] shadow-xl">
              <button
                type="button"
                onClick={() => setShowPetsList(true)}
                className="flex flex-col items-center py-1 px-2.5 rounded-2xl hover:bg-[#EFE6D6] active:scale-95 transition"
              >
                <img src="./assets/icons/pets.png" alt="" className="w-7 h-7 object-contain" />
                <span className="text-[10px] font-extrabold text-[#4B4035]">Питомцы</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShopTab('food');
                  setShopOpen(true);
                }}
                className="flex flex-col items-center py-1 px-2.5 rounded-2xl hover:bg-[#EFE6D6] active:scale-95 transition"
              >
                <img src="./assets/icons/shop.png" alt="" className="w-7 h-7 object-contain" />
                <span className="text-[10px] font-extrabold text-[#4B4035]">Магазин</span>
              </button>

              <button
                type="button"
                onClick={() => setShowQuests(true)}
                className="relative flex flex-col items-center py-1 px-2.5 rounded-2xl hover:bg-[#EFE6D6] active:scale-95 transition"
              >
                <img src="./assets/icons/quests.png" alt="" className="w-7 h-7 object-contain" />
                <span className="text-[10px] font-extrabold text-[#4B4035]">Задания</span>
                {claimableQuestCount > 0 && (
                  <span className="absolute top-0.5 right-1.5 w-4 h-4 rounded-full bg-[#CE5F52] text-white text-[9px] font-extrabold flex items-center justify-center">
                    {claimableQuestCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowGallery(true)}
                className="flex flex-col items-center py-1 px-2.5 rounded-2xl hover:bg-[#EFE6D6] active:scale-95 transition"
              >
                <img src="./assets/icons/camera.png" alt="" className="w-7 h-7 object-contain" />
                <span className="text-[10px] font-extrabold text-[#4B4035]">Альбом</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notifications */}
      {store.toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-[90vw] bg-[#3B332B]/92 text-[#FAF5EB] text-xs font-bold px-4 py-2 rounded-2xl shadow-lg text-center pointer-events-none">
          {store.toastMessage}
        </div>
      )}

      {/* Gentle Offline Welcome Back Modal */}
      {store.offlineWelcomeMessage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4"
          onClick={store.dismissOfflineWelcome}
        >
          <div
            className="max-w-sm w-full bg-[#FAF5EB] rounded-3xl p-5 border border-[#DFD3BD] shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src="./assets/icons/pets.png"
              alt=""
              className="w-16 h-16 mx-auto mb-2 object-contain"
            />
            <h3 className="text-base font-extrabold text-[#3B332B] mb-1">Крыски соскучились!</h3>
            <p className="text-xs text-[#695C4E] leading-relaxed mb-4">
              {store.offlineWelcomeMessage}
            </p>
            <button
              type="button"
              onClick={store.dismissOfflineWelcome}
              className="w-full bg-[#6E8572] text-white font-extrabold text-sm py-2.5 rounded-2xl shadow"
            >
              Поздороваться
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <PetCardModal
        rat={cardRat}
        onClose={() => setPetCardRatId(null)}
        onPerformTrick={handleTriggerTrick}
        onOpenTraining={() => {
          if (cardRat) store.selectRat(cardRat.id);
          setShowTraining(true);
        }}
      />

      <TrainingModal
        rat={selectedRat}
        open={showTraining}
        onClose={() => setShowTraining(false)}
        onTriggerTrickAnim={handleTriggerTrick}
      />

      <ShopModal
        open={shopOpen}
        initialTab={shopTab}
        onClose={() => setShopOpen(false)}
        onStartDecorate={(itemId) => {
          store.setDecorateSelectedItem(itemId);
          store.setInteractionMode('decorate');
        }}
      />

      <QuestsModal open={showQuests} onClose={() => setShowQuests(false)} />

      <GalleryModal
        open={showGallery}
        onClose={() => setShowGallery(false)}
        onOpenPhotoMode={() => store.setCameraMode('photo')}
      />

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onOpenDedication={() => store.setShowDedicationModal(true)}
      />

      <PetsListModal
        open={showPetsList}
        onClose={() => setShowPetsList(false)}
        onFocusRat={(id) => sceneRef.current?.focusOnRat(id)}
        onOpenPetCard={(id) => setPetCardRatId(id)}
        onOpenAdopt={() => {
          setShopTab('adopt');
          setShopOpen(true);
        }}
      />

      <DedicationModal
        open={store.showDedicationModal}
        onClose={() => store.setShowDedicationModal(false)}
      />
    </div>
  );
}

export default App;
