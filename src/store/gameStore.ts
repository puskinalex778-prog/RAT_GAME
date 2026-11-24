import { create } from 'zustand';
import type {
  AdoptionOrigin,
  AppSettings,
  CameraMode,
  HabitatId,
  InteractionMode,
  LifecycleSettings,
  PhotoRecord,
  PlacedItem,
  RatAppearance,
  RatEntity,
  RatPersonalityId,
  RatSex,
  RoomThemeId,
  TrickId,
} from '../types/game';
import {
  LIFESPAN_OPTIONS,
  PERSONALITIES,
  PERSONALITY_IDS,
  RANDOM_RAT_NAMES_FEMALE,
  RANDOM_RAT_NAMES_MALE,
  TRICKS,
  getDefaultAppearance,
  getLifeStage,
  inheritAppearance,
} from '../rats/coatPresets';
import { ACHIEVEMENTS, CAGE_SLOTS, ITEM_MAP, QUESTS } from '../cage/catalog';
import {
  clearPersistedData,
  loadPersistedData,
  savePersistedData,
  triggerHaptic,
} from './persistence';
import { soundEngine } from '../audio/SoundEngine';

export interface QuestProgressCounters {
  feedCount: number;
  petCount: number;
  callCount: number;
  hammockPlaced: number;
  photoCount: number;
  playCount: number;
  tricksLearned: number;
  ratCount: number;
  secondFloorUnlocked: number;
  maxTrust: number;
}

export interface PersistedSlice {
  introCompleted: boolean;
  adoptionOrigin: AdoptionOrigin;
  coins: number;
  rats: RatEntity[];
  inventory: Record<string, number>;
  ownedHabitats: HabitatId[];
  activeHabitat: HabitatId;
  ownedThemes: RoomThemeId[];
  activeTheme: RoomThemeId;
  hasSecondFloor: boolean;
  placedItems: PlacedItem[];
  counters: QuestProgressCounters;
  claimedQuests: string[];
  claimedAchievements: string[];
  settings: AppSettings;
  photos: PhotoRecord[];
  lastSavedAt: number;
}

export interface GameStoreState extends PersistedSlice {
  hydrated: boolean;
  selectedRatId: string | null;
  cameraMode: CameraMode;
  interactionMode: InteractionMode;
  decorateSelectedItemId: string | null;
  toastMessage: string | null;
  offlineWelcomeMessage: string | null;
  showDedicationModal: boolean;

  // Actions
  hydrate: () => Promise<void>;
  persistNow: () => void;
  setToast: (msg: string | null) => void;
  dismissOfflineWelcome: () => void;
  setShowDedicationModal: (show: boolean) => void;

  completeIntro: (
    origin: AdoptionOrigin,
    name: string,
    sex: RatSex,
    appearance: RatAppearance
  ) => void;
  adoptNewRat: (
    name: string,
    sex: RatSex,
    appearance: RatAppearance,
    origin?: AdoptionOrigin
  ) => boolean;
  renameRat: (ratId: string, newName: string) => void;
  selectRat: (ratId: string | null) => void;
  setCameraMode: (mode: CameraMode) => void;
  setInteractionMode: (mode: InteractionMode) => void;
  setDecorateSelectedItem: (itemId: string | null) => void;

  feedRat: (ratId: string, foodItemId: string) => boolean;
  petRatTick: (ratId: string) => void;
  callRat: (ratId: string) => void;
  playWithRatTick: (ratId: string) => void;
  trainRatStep: (ratId: string, trickId: TrickId, treatId: string | null) => {
    progressed: boolean;
    learnedNow: boolean;
    progress: number;
  };
  useBeddingRefresh: () => boolean;

  buyShopItem: (itemId: string) => boolean;
  placeItemInSlot: (slotId: string, itemId: string) => void;
  removeItemFromSlot: (slotId: string) => void;
  equipHabitat: (habitatId: HabitatId) => void;
  equipTheme: (themeId: RoomThemeId) => void;

  claimQuest: (questId: string) => void;
  claimAchievement: (achId: string) => void;

  addPhoto: (dataUrl: string, ratNames: string[]) => void;
  deletePhoto: (photoId: string) => void;

  updateSettings: (partial: Partial<AppSettings>) => void;
  updateLifecycle: (partial: Partial<LifecycleSettings>) => void;

  tickSimulation: (realDeltaSeconds: number) => void;
  resetAllProgress: () => Promise<void>;
}

function createEmptyTricks(): RatEntity['tricks'] {
  return {
    spin: { progress: 0, learned: false },
    paw: { progress: 0, learned: false },
    stand: { progress: 0, learned: false },
    hoop: { progress: 0, learned: false },
    fetch: { progress: 0, learned: false },
  };
}

function makeRatEntity(
  name: string,
  sex: RatSex,
  appearance: RatAppearance,
  origin: AdoptionOrigin | 'bred',
  extra?: Partial<RatEntity>
): RatEntity {
  const personality: RatPersonalityId =
    PERSONALITY_IDS[Math.floor(Math.random() * PERSONALITY_IDS.length)];
  const pInfo = PERSONALITIES[personality];
  return {
    id: `rat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || 'Бусинка',
    sex,
    appearance: { ...appearance },
    personality,
    ageDays: origin === 'bred' ? 10 : 90, // 3 months young adult on adoption
    bornAt: Date.now(),
    stats: {
      hunger: 82,
      health: 100,
      comfort: 85,
      trust: origin === 'bred' ? 45 : 28,
    },
    favoriteToys: [...pInfo.defaultFavToys],
    tricks: createEmptyTricks(),
    pedigree: {
      origin,
      generation: 1,
    },
    alive: true,
    ...extra,
  };
}

function createInitialPersistedState(): PersistedSlice {
  return {
    introCompleted: false,
    adoptionOrigin: 'rescue',
    coins: 160,
    rats: [],
    inventory: {
      food_grain: 5,
      food_veggies: 3,
      food_yogurt_drops: 3,
      food_seeds: 3,
      house_wood: 1,
      bowl_ceramic: 1,
      water_bottle: 1,
      care_paper: 1,
    },
    ownedHabitats: ['basic_cage'],
    activeHabitat: 'basic_cage',
    ownedThemes: ['scandi'],
    activeTheme: 'scandi',
    hasSecondFloor: false,
    placedItems: [
      { slotId: 'floor_left_back', itemId: 'house_wood' },
      { slotId: 'floor_right_front', itemId: 'bowl_ceramic' },
      { slotId: 'wall_bottle', itemId: 'water_bottle' },
      { slotId: 'floor_center_back', itemId: 'care_paper' },
    ],
    counters: {
      feedCount: 0,
      petCount: 0,
      callCount: 0,
      hammockPlaced: 0,
      photoCount: 0,
      playCount: 0,
      tricksLearned: 0,
      ratCount: 0,
      secondFloorUnlocked: 0,
      maxTrust: 28,
    },
    claimedQuests: [],
    claimedAchievements: [],
    settings: {
      soundEnabled: true,
      ambientEnabled: true,
      hapticsEnabled: true,
      showHints: true,
      lifecycle: {
        breedingEnabled: false, // OFF by default
        agingEnabled: true,
        naturalDeathEnabled: false, // OFF by default in comfort preset
        comfortMode: true, // ON by default
        lifespanOption: '30d',
      },
    },
    photos: [],
    lastSavedAt: Date.now(),
  };
}

let persistTimer: number | null = null;
let toastTimer: number | null = null;

function extractPersisted(state: GameStoreState): PersistedSlice {
  return {
    introCompleted: state.introCompleted,
    adoptionOrigin: state.adoptionOrigin,
    coins: state.coins,
    rats: state.rats,
    inventory: state.inventory,
    ownedHabitats: state.ownedHabitats,
    activeHabitat: state.activeHabitat,
    ownedThemes: state.ownedThemes,
    activeTheme: state.activeTheme,
    hasSecondFloor: state.hasSecondFloor,
    placedItems: state.placedItems,
    counters: state.counters,
    claimedQuests: state.claimedQuests,
    claimedAchievements: state.claimedAchievements,
    settings: state.settings,
    photos: state.photos,
    lastSavedAt: Date.now(),
  };
}

function getComfortBonusFromPlaced(placed: PlacedItem[]): number {
  let bonus = 0;
  for (const p of placed) {
    const def = ITEM_MAP[p.itemId];
    if (def?.comfortBonus) bonus += def.comfortBonus;
  }
  return Math.min(35, bonus * 0.45);
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  ...createInitialPersistedState(),
  hydrated: false,
  selectedRatId: null,
  cameraMode: 'overview',
  interactionMode: 'none',
  decorateSelectedItemId: null,
  toastMessage: null,
  offlineWelcomeMessage: null,
  showDedicationModal: false,

  setToast: (msg) => {
    if (toastTimer) window.clearTimeout(toastTimer);
    set({ toastMessage: msg });
    if (msg) {
      toastTimer = window.setTimeout(() => {
        set({ toastMessage: null });
      }, 3000);
    }
  },

  dismissOfflineWelcome: () => set({ offlineWelcomeMessage: null }),
  setShowDedicationModal: (show) => set({ showDedicationModal: show }),

  persistNow: () => {
    if (persistTimer) window.clearTimeout(persistTimer);
    persistTimer = window.setTimeout(() => {
      const snap = extractPersisted(get());
      savePersistedData(snap).catch(() => {});
    }, 350);
  },

  hydrate: async () => {
    const saved = await loadPersistedData<Partial<PersistedSlice>>();
    if (saved && saved.introCompleted && Array.isArray(saved.rats) && saved.rats.length > 0) {
      const base = createInitialPersistedState();
      const merged: PersistedSlice = {
        ...base,
        ...saved,
        settings: {
          ...base.settings,
          ...(saved.settings ?? {}),
          lifecycle: {
            ...base.settings.lifecycle,
            ...(saved.settings?.lifecycle ?? {}),
          },
        },
        counters: {
          ...base.counters,
          ...(saved.counters ?? {}),
        },
      };

      // Gentle non-punishing offline progress calculation
      const now = Date.now();
      const elapsedSec = Math.max(0, (now - (merged.lastSavedAt || now)) / 1000);
      let welcomeMsg: string | null = null;

      if (elapsedSec > 180) {
        const hours = elapsedSec / 3600;
        const lc = merged.settings.lifecycle;
        const decayScale = lc.comfortMode ? 0.25 : 0.7;
        const hungerDrop = Math.min(38, hours * 3.2 * decayScale);
        const comfortDrop = Math.min(26, hours * 2.0 * decayScale);

        merged.rats = merged.rats.map((r) => {
          if (!r.alive) return r;
          const nextAge = lc.agingEnabled ? r.ageDays + hours * 0.45 : r.ageDays;
          return {
            ...r,
            ageDays: nextAge,
            stats: {
              ...r.stats,
              hunger: Math.max(lc.comfortMode ? 55 : 28, r.stats.hunger - hungerDrop),
              comfort: Math.max(lc.comfortMode ? 62 : 38, r.stats.comfort - comfortDrop),
            },
          };
        });

        const hrsRounded = Math.max(1, Math.round(hours));
        welcomeMsg =
          hours >= 1
            ? `С возвращением! Пока тебя не было (~${hrsRounded} ч.), крыски сладко дремали и ждали тебя.`
            : 'С возвращением! Твои крыски рады снова тебя видеть.';
      }

      soundEngine.configure(merged.settings.soundEnabled, merged.settings.ambientEnabled);
      set({
        ...merged,
        hydrated: true,
        offlineWelcomeMessage: welcomeMsg,
      });
    } else {
      const s = get().settings;
      soundEngine.configure(s.soundEnabled, s.ambientEnabled);
      set({ hydrated: true });
    }
  },

  completeIntro: (origin, name, sex, appearance) => {
    const rat = makeRatEntity(name, sex, appearance, origin);
    const counters = {
      ...get().counters,
      ratCount: 1,
      maxTrust: rat.stats.trust,
    };
    set({
      introCompleted: true,
      adoptionOrigin: origin,
      rats: [rat],
      selectedRatId: rat.id,
      counters,
    });
    soundEngine.playSuccess();
    get().setToast(`${rat.name} переехал${sex === 'female' ? 'а' : ''} в уютную клетку!`);
    get().persistNow();
  },

  adoptNewRat: (name, sex, appearance, origin = 'rescue') => {
    const state = get();
    const aliveCount = state.rats.filter((r) => r.alive).length;
    if (aliveCount >= 6) {
      state.setToast('В клетке уже 6 крысок — им нужно просторно!');
      return false;
    }
    const adoptionFee = 85;
    if (state.coins < adoptionFee) {
      state.setToast(`Нужно ${adoptionFee} монет для обустройства нового питомца.`);
      return false;
    }
    const rat = makeRatEntity(name, sex, appearance, origin);
    const nextRats = [...state.rats, rat];
    set({
      coins: state.coins - adoptionFee,
      rats: nextRats,
      selectedRatId: rat.id,
      counters: {
        ...state.counters,
        ratCount: nextRats.filter((r) => r.alive).length,
      },
    });
    soundEngine.playSuccess();
    triggerHaptic(state.settings.hapticsEnabled, 'medium');
    state.setToast(`В семье пополнение — знакомься, ${rat.name}!`);
    state.persistNow();
    return true;
  },

  renameRat: (ratId, newName) => {
    const cleaned = newName.trim().slice(0, 18);
    if (!cleaned) return;
    set((s) => ({
      rats: s.rats.map((r) => (r.id === ratId ? { ...r, name: cleaned } : r)),
    }));
    get().persistNow();
  },

  selectRat: (ratId) => {
    set({ selectedRatId: ratId });
    if (ratId) {
      soundEngine.playClick();
    }
  },

  setCameraMode: (mode) => {
    set({ cameraMode: mode });
    if (mode === 'photo') {
      set({ interactionMode: 'none' });
    }
    soundEngine.playClick();
  },

  setInteractionMode: (mode) => {
    set({
      interactionMode: mode,
      decorateSelectedItemId: mode === 'decorate' ? get().decorateSelectedItemId : null,
    });
    soundEngine.playClick();
  },

  setDecorateSelectedItem: (itemId) => set({ decorateSelectedItemId: itemId }),

  feedRat: (ratId, foodItemId) => {
    const state = get();
    const qty = state.inventory[foodItemId] ?? 0;
    const def = ITEM_MAP[foodItemId];
    if (!def || qty <= 0) {
      state.setToast('Это лакомство закончилось — загляни в магазин!');
      return false;
    }

    const nextInv = { ...state.inventory, [foodItemId]: qty - 1 };
    let newMaxTrust = state.counters.maxTrust;
    const nextRats = state.rats.map((r) => {
      if (r.id !== ratId) return r;
      const foodieBonus = r.personality === 'foodie' ? 1.25 : 1.0;
      const nextTrust = Math.min(100, r.stats.trust + (def.trustGain ?? 5) * foodieBonus);
      newMaxTrust = Math.max(newMaxTrust, Math.round(nextTrust));
      return {
        ...r,
        stats: {
          hunger: Math.min(100, r.stats.hunger + (def.hungerRestore ?? 25)),
          health: Math.min(100, r.stats.health + (def.healthBonus ?? 3)),
          comfort: Math.min(100, r.stats.comfort + 4),
          trust: nextTrust,
        },
      };
    });

    set({
      inventory: nextInv,
      rats: nextRats,
      coins: state.coins + 6,
      counters: {
        ...state.counters,
        feedCount: state.counters.feedCount + 1,
        maxTrust: newMaxTrust,
      },
    });
    soundEngine.playCoin();
    triggerHaptic(state.settings.hapticsEnabled, 'light');
    state.persistNow();
    return true;
  },

  petRatTick: (ratId) => {
    const state = get();
    let newMaxTrust = state.counters.maxTrust;
    const nextRats = state.rats.map((r) => {
      if (r.id !== ratId) return r;
      const affBonus = r.personality === 'affectionate' ? 1.35 : 1.0;
      const nextTrust = Math.min(100, r.stats.trust + 2.2 * affBonus);
      newMaxTrust = Math.max(newMaxTrust, Math.round(nextTrust));
      return {
        ...r,
        stats: {
          ...r.stats,
          comfort: Math.min(100, r.stats.comfort + 2.5),
          trust: nextTrust,
        },
      };
    });

    set({
      rats: nextRats,
      coins: state.coins + 2,
      counters: {
        ...state.counters,
        petCount: state.counters.petCount + 1,
        maxTrust: newMaxTrust,
      },
    });
    triggerHaptic(state.settings.hapticsEnabled, 'light');
    state.persistNow();
  },

  callRat: (ratId) => {
    const state = get();
    let newMaxTrust = state.counters.maxTrust;
    const nextRats = state.rats.map((r) => {
      if (r.id !== ratId) return r;
      const nextTrust = Math.min(100, r.stats.trust + 2);
      newMaxTrust = Math.max(newMaxTrust, Math.round(nextTrust));
      return {
        ...r,
        stats: { ...r.stats, trust: nextTrust, comfort: Math.min(100, r.stats.comfort + 2) },
      };
    });
    set({
      rats: nextRats,
      coins: state.coins + 3,
      counters: {
        ...state.counters,
        callCount: state.counters.callCount + 1,
        maxTrust: newMaxTrust,
      },
    });
    triggerHaptic(state.settings.hapticsEnabled, 'light');
    state.persistNow();
  },

  playWithRatTick: (ratId) => {
    const state = get();
    let newMaxTrust = state.counters.maxTrust;
    const nextRats = state.rats.map((r) => {
      if (r.id !== ratId) return r;
      const nextTrust = Math.min(100, r.stats.trust + 3.5);
      newMaxTrust = Math.max(newMaxTrust, Math.round(nextTrust));
      return {
        ...r,
        stats: {
          ...r.stats,
          comfort: Math.min(100, r.stats.comfort + 5),
          trust: nextTrust,
        },
      };
    });
    set({
      rats: nextRats,
      coins: state.coins + 5,
      counters: {
        ...state.counters,
        playCount: state.counters.playCount + 1,
        maxTrust: newMaxTrust,
      },
    });
    state.persistNow();
  },

  trainRatStep: (ratId, trickId, treatId) => {
    const state = get();
    const rat = state.rats.find((r) => r.id === ratId);
    if (!rat) return { progressed: false, learnedNow: false, progress: 0 };

    const inv = { ...state.inventory };
    let treatBoost = 1.0;
    if (treatId && (inv[treatId] ?? 0) > 0) {
      inv[treatId] -= 1;
      treatBoost = treatId === 'food_yogurt_drops' ? 1.55 : 1.25;
    }

    const trickDef = TRICKS[trickId];
    const current = rat.tricks[trickId];
    const trustFactor = 0.8 + (rat.stats.trust / 100) * 0.6;
    const personalityFactor = rat.personality === 'foodie' || rat.personality === 'curious' ? 1.2 : 1.0;
    const gain = Math.round((24 / trickDef.difficulty) * treatBoost * trustFactor * personalityFactor);
    const nextProgress = Math.min(100, current.progress + gain);
    const learnedNow = !current.learned && nextProgress >= 100;

    let totalLearned = 0;
    const nextRats = state.rats.map((r) => {
      if (r.id !== ratId) {
        totalLearned += Object.values(r.tricks).filter((t) => t.learned).length;
        return r;
      }
      const updatedTricks = {
        ...r.tricks,
        [trickId]: {
          progress: nextProgress,
          learned: current.learned || nextProgress >= 100,
        },
      };
      totalLearned += Object.values(updatedTricks).filter((t) => t.learned).length;
      return {
        ...r,
        tricks: updatedTricks,
        stats: {
          ...r.stats,
          trust: Math.min(100, r.stats.trust + (learnedNow ? 10 : 4)),
          hunger: Math.min(100, r.stats.hunger + (treatId ? 8 : 0)),
        },
      };
    });

    const bonusCoins = learnedNow ? trickDef.rewardCoins : 6;
    set({
      inventory: inv,
      rats: nextRats,
      coins: state.coins + bonusCoins,
      counters: {
        ...state.counters,
        tricksLearned: Math.max(state.counters.tricksLearned, totalLearned),
        maxTrust: Math.max(
          state.counters.maxTrust,
          ...nextRats.map((r) => Math.round(r.stats.trust))
        ),
      },
    });

    if (learnedNow) {
      soundEngine.playSuccess();
      triggerHaptic(state.settings.hapticsEnabled, 'medium');
      state.setToast(`${rat.name} выучил${rat.sex === 'female' ? 'а' : ''} трюк «${trickDef.name}»! +${bonusCoins} монет`);
    } else {
      soundEngine.playCoin();
      triggerHaptic(state.settings.hapticsEnabled, 'light');
    }
    state.persistNow();
    return { progressed: true, learnedNow, progress: nextProgress };
  },

  useBeddingRefresh: () => {
    const state = get();
    const qty = state.inventory['care_bedding'] ?? 0;
    if (qty <= 0) {
      state.setToast('Купи свежий мягкий наполнитель в магазине!');
      return false;
    }
    set({
      inventory: { ...state.inventory, care_bedding: qty - 1 },
      rats: state.rats.map((r) =>
        r.alive
          ? {
              ...r,
              stats: {
                ...r.stats,
                comfort: Math.min(100, r.stats.comfort + 25),
                health: Math.min(100, r.stats.health + 12),
              },
            }
          : r
      ),
      coins: state.coins + 10,
    });
    soundEngine.playRustle();
    soundEngine.playCoin();
    state.setToast('Свежий мягкий наполнитель постелен! Крыски в восторге.');
    state.persistNow();
    return true;
  },

  buyShopItem: (itemId) => {
    const state = get();
    const def = ITEM_MAP[itemId];
    if (!def) return false;

    if (state.coins < def.price) {
      state.setToast('Не хватает монет — позаботься о крысках или выполни задание!');
      return false;
    }

    // Special: 2nd floor upgrade
    if (def.isSecondFloorUpgrade) {
      if (state.hasSecondFloor) {
        state.setToast('2-й этаж уже установлен!');
        return false;
      }
      set({
        coins: state.coins - def.price,
        hasSecondFloor: true,
        counters: { ...state.counters, secondFloorUnlocked: 1 },
      });
      soundEngine.playSuccess();
      triggerHaptic(state.settings.hapticsEnabled, 'medium');
      state.setToast('2-й этаж и лесенка установлены в клетку!');
      state.persistNow();
      return true;
    }

    // Special: Habitat
    if (def.habitatId) {
      if (state.ownedHabitats.includes(def.habitatId)) {
        state.equipHabitat(def.habitatId);
        return true;
      }
      set({
        coins: state.coins - def.price,
        ownedHabitats: [...state.ownedHabitats, def.habitatId],
        activeHabitat: def.habitatId,
      });
      soundEngine.playSuccess();
      state.setToast(`Новое жилище «${def.name}» установлено!`);
      state.persistNow();
      return true;
    }

    // Special: Room Theme
    if (def.themeId) {
      if (state.ownedThemes.includes(def.themeId)) {
        state.equipTheme(def.themeId);
        return true;
      }
      set({
        coins: state.coins - def.price,
        ownedThemes: [...state.ownedThemes, def.themeId],
        activeTheme: def.themeId,
      });
      soundEngine.playSuccess();
      state.setToast(`Оформление «${def.name}» применено!`);
      state.persistNow();
      return true;
    }

    // Regular food / care consumable / furniture
    const nextInv = {
      ...state.inventory,
      [itemId]: (state.inventory[itemId] ?? 0) + (def.isConsumable ? 3 : 1),
    };

    // If it's a placeable furniture item and there is an empty compatible slot, auto-place it conveniently!
    let nextPlaced = state.placedItems;
    let hammockCounter = state.counters.hammockPlaced;
    let autoPlacedText = '';

    if (def.slotTypes && def.slotTypes.length > 0) {
      const occupiedIds = new Set(state.placedItems.map((p) => p.slotId));
      const freeSlot = CAGE_SLOTS.find(
        (slot) =>
          (!slot.requiresSecondFloor || state.hasSecondFloor) &&
          def.slotTypes!.includes(slot.type) &&
          !occupiedIds.has(slot.id)
      );
      if (freeSlot) {
        nextPlaced = [...state.placedItems, { slotId: freeSlot.id, itemId }];
        autoPlacedText = ' и сразу установлен в клетку!';
        if (def.category === 'hammocks') {
          hammockCounter = Math.max(1, hammockCounter + 1);
        }
      }
    }

    set({
      coins: state.coins - def.price,
      inventory: nextInv,
      placedItems: nextPlaced,
      counters: {
        ...state.counters,
        hammockPlaced: hammockCounter,
      },
    });
    soundEngine.playCoin();
    triggerHaptic(state.settings.hapticsEnabled, 'light');
    state.setToast(
      def.isConsumable
        ? `Куплено: ${def.name} (×3)`
        : `Куплено: ${def.name}${autoPlacedText}`
    );
    state.persistNow();
    return true;
  },

  placeItemInSlot: (slotId, itemId) => {
    const state = get();
    const def = ITEM_MAP[itemId];
    const slot = CAGE_SLOTS.find((s) => s.id === slotId);
    if (!def || !slot || !def.slotTypes?.includes(slot.type)) return;

    const filtered = state.placedItems.filter((p) => p.slotId !== slotId);
    const nextPlaced = [...filtered, { slotId, itemId }];
    const hammockCounter =
      def.category === 'hammocks'
        ? Math.max(1, state.counters.hammockPlaced + 1)
        : state.counters.hammockPlaced;

    set({
      placedItems: nextPlaced,
      counters: { ...state.counters, hammockPlaced: hammockCounter },
    });
    soundEngine.playClick();
    triggerHaptic(state.settings.hapticsEnabled, 'light');
    state.setToast(`${def.name} установлен в слот «${slot.label}»`);
    state.persistNow();
  },

  removeItemFromSlot: (slotId) => {
    set((s) => ({
      placedItems: s.placedItems.filter((p) => p.slotId !== slotId),
    }));
    soundEngine.playClick();
    get().persistNow();
  },

  equipHabitat: (habitatId) => {
    set({ activeHabitat: habitatId });
    soundEngine.playClick();
    get().persistNow();
  },

  equipTheme: (themeId) => {
    set({ activeTheme: themeId });
    soundEngine.playClick();
    get().persistNow();
  },

  claimQuest: (questId) => {
    const state = get();
    if (state.claimedQuests.includes(questId)) return;
    const q = QUESTS.find((item) => item.id === questId);
    if (!q) return;
    const currentVal = state.counters[q.trackKey as keyof QuestProgressCounters] ?? 0;
    if (currentVal < q.target) return;

    set({
      coins: state.coins + q.rewardCoins,
      claimedQuests: [...state.claimedQuests, questId],
    });
    soundEngine.playSuccess();
    triggerHaptic(state.settings.hapticsEnabled, 'medium');
    state.setToast(`Задание «${q.title}» выполнено! +${q.rewardCoins} монет`);
    state.persistNow();
  },

  claimAchievement: (achId) => {
    const state = get();
    if (state.claimedAchievements.includes(achId)) return;
    const a = ACHIEVEMENTS.find((item) => item.id === achId);
    if (!a) return;

    set({
      coins: state.coins + a.rewardCoins,
      claimedAchievements: [...state.claimedAchievements, achId],
    });
    soundEngine.playSuccess();
    triggerHaptic(state.settings.hapticsEnabled, 'medium');
    state.setToast(`Достижение «${a.title}»! +${a.rewardCoins} монет`);
    state.persistNow();
  },

  addPhoto: (dataUrl, ratNames) => {
    const state = get();
    const record: PhotoRecord = {
      id: `photo_${Date.now()}`,
      dataUrl,
      takenAt: Date.now(),
      caption: ratNames.length > 0 ? ratNames.join(', ') : 'Уютный дом',
      ratNames,
    };
    // Keep up to 24 recent photos to keep IndexedDB nimble
    const nextPhotos = [record, ...state.photos].slice(0, 24);
    set({
      photos: nextPhotos,
      coins: state.coins + 8,
      counters: {
        ...state.counters,
        photoCount: state.counters.photoCount + 1,
      },
    });
    soundEngine.playShutter();
    triggerHaptic(state.settings.hapticsEnabled, 'medium');
    state.setToast('Снимок сохранён в альбом! +8 монет');
    state.persistNow();
  },

  deletePhoto: (photoId) => {
    set((s) => ({ photos: s.photos.filter((p) => p.id !== photoId) }));
    get().persistNow();
  },

  updateSettings: (partial) => {
    set((s) => {
      const next = { ...s.settings, ...partial };
      soundEngine.configure(next.soundEnabled, next.ambientEnabled);
      return { settings: next };
    });
    get().persistNow();
  },

  updateLifecycle: (partial) => {
    set((s) => {
      const nextLc: LifecycleSettings = { ...s.settings.lifecycle, ...partial };
      // If comfort mode is turned ON, gently disable natural death automatically
      if (partial.comfortMode === true) {
        nextLc.naturalDeathEnabled = false;
      }
      // If natural death is turned ON, disable comfort mode
      if (partial.naturalDeathEnabled === true) {
        nextLc.comfortMode = false;
      }
      return {
        settings: {
          ...s.settings,
          lifecycle: nextLc,
        },
      };
    });
    get().persistNow();
  },

  tickSimulation: (realDeltaSeconds) => {
    const state = get();
    if (!state.introCompleted || state.rats.length === 0) return;

    const lc = state.settings.lifecycle;
    const comfortFloorBonus = getComfortBonusFromPlaced(state.placedItems);
    const decayRate = lc.comfortMode ? 0.015 : 0.055;
    const minHunger = lc.comfortMode ? 45 : 15;
    const minComfort = Math.min(82, (lc.comfortMode ? 55 : 22) + comfortFloorBonus);

    const lifespanMs = LIFESPAN_OPTIONS[lc.lifespanOption].realHours * 3600 * 1000;
    const now = Date.now();
    let changed = false;
    let passedNotice: string | null = null;

    const updatedRats = state.rats.map((r) => {
      if (!r.alive) return r;
      changed = true;

      // Age rate: ~1 game day per 3 real minutes when aging enabled
      const ageGain = lc.agingEnabled ? realDeltaSeconds / 180 : 0;
      const nextAge = r.ageDays + ageGain;

      const nextHunger = Math.max(minHunger, r.stats.hunger - decayRate * realDeltaSeconds * 0.9);
      const nextComfort = Math.max(minComfort, r.stats.comfort - decayRate * realDeltaSeconds * 0.55);
      const nextHealth = lc.comfortMode
        ? Math.min(100, r.stats.health + 0.05 * realDeltaSeconds)
        : nextHunger < 25
        ? Math.max(30, r.stats.health - 0.04 * realDeltaSeconds)
        : Math.min(100, r.stats.health + 0.03 * realDeltaSeconds);

      let alive: boolean = r.alive;
      let passedAwayAt = r.passedAwayAt;
      if (lc.naturalDeathEnabled && !lc.comfortMode && now - r.bornAt >= lifespanMs) {
        alive = false;
        passedAwayAt = now;
        passedNotice = `${r.name} прожил${r.sex === 'female' ? 'а' : ''} счастливую жизнь и тихо уш${r.sex === 'female' ? 'ла' : 'ёл'} на радугу...`;
      }

      return {
        ...r,
        ageDays: nextAge,
        alive,
        passedAwayAt,
        stats: {
          ...r.stats,
          hunger: nextHunger,
          comfort: nextComfort,
          health: nextHealth,
        },
      };
    });

    // Optional Breeding check (OFF by default!)
    let babyRat: RatEntity | null = null;
    const aliveRats = updatedRats.filter((r) => r.alive);
    if (lc.breedingEnabled && aliveRats.length >= 2 && aliveRats.length < 6) {
      const adultMales = aliveRats.filter(
        (r) =>
          r.sex === 'male' &&
          getLifeStage(r.ageDays) === 'adult' &&
          r.stats.comfort >= 75 &&
          (!r.lastBredAt || now - r.lastBredAt > 180_000)
      );
      const adultFemales = aliveRats.filter(
        (r) =>
          r.sex === 'female' &&
          getLifeStage(r.ageDays) === 'adult' &&
          r.stats.comfort >= 75 &&
          (!r.lastBredAt || now - r.lastBredAt > 180_000)
      );
      if (adultMales.length > 0 && adultFemales.length > 0 && Math.random() < 0.015 * realDeltaSeconds) {
        const dad = adultMales[0];
        const mom = adultFemales[0];
        dad.lastBredAt = now;
        mom.lastBredAt = now;
        const babySex: RatSex = Math.random() < 0.5 ? 'male' : 'female';
        const pool = babySex === 'male' ? RANDOM_RAT_NAMES_MALE : RANDOM_RAT_NAMES_FEMALE;
        const used = new Set(updatedRats.map((x) => x.name));
        const babyName = pool.find((n) => !used.has(n)) ?? `Малыш ${updatedRats.length + 1}`;
        const babyApp = inheritAppearance(mom.appearance, dad.appearance);
        babyRat = makeRatEntity(babyName, babySex, babyApp, 'bred', {
          pedigree: {
            origin: 'bred',
            motherId: mom.id,
            motherName: mom.name,
            fatherId: dad.id,
            fatherName: dad.name,
            generation: Math.max(mom.pedigree.generation, dad.pedigree.generation) + 1,
          },
        });
      }
    }

    if (changed) {
      const finalRats = babyRat ? [...updatedRats, babyRat] : updatedRats;
      set({
        rats: finalRats,
        counters: {
          ...state.counters,
          ratCount: finalRats.filter((r) => r.alive).length,
        },
      });
      if (babyRat) {
        soundEngine.playSuccess();
        state.setToast(`У пары родился очаровательный крысёнок — ${babyRat.name}!`);
      } else if (passedNotice) {
        state.setToast(passedNotice);
      }
      state.persistNow();
    }
  },

  resetAllProgress: async () => {
    await clearPersistedData();
    const fresh = createInitialPersistedState();
    set({
      ...fresh,
      selectedRatId: null,
      cameraMode: 'overview',
      interactionMode: 'none',
      decorateSelectedItemId: null,
      offlineWelcomeMessage: null,
    });
    soundEngine.playClick();
  },
}));

export function getAchievementProgress(
  achId: string,
  state: GameStoreState
): { unlocked: boolean; progressText: string } {
  switch (achId) {
    case 'ach_first_friend':
      return {
        unlocked: state.rats.length >= 1,
        progressText: `${Math.min(1, state.rats.length)}/1`,
      };
    case 'ach_gourmet':
      return {
        unlocked: state.counters.feedCount >= 10,
        progressText: `${Math.min(10, state.counters.feedCount)}/10`,
      };
    case 'ach_trainer':
      return {
        unlocked: state.counters.tricksLearned >= 3,
        progressText: `${Math.min(3, state.counters.tricksLearned)}/3`,
      };
    case 'ach_designer':
      return {
        unlocked: state.placedItems.length >= 5,
        progressText: `${Math.min(5, state.placedItems.length)}/5`,
      };
    case 'ach_photographer':
      return {
        unlocked: state.photos.length >= 5,
        progressText: `${Math.min(5, state.photos.length)}/5`,
      };
    case 'ach_best_friends':
      return {
        unlocked: state.counters.maxTrust >= 100,
        progressText: `${Math.min(100, state.counters.maxTrust)}/100`,
      };
    default:
      return { unlocked: false, progressText: '0/1' };
  }
}

export { getDefaultAppearance };
