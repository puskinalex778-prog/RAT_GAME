import { create } from 'zustand';
import type {
  Appearance,
  GameState,
  OriginId,
  PersonalityId,
  QuestProgress,
  RatData,
  Settings,
  Sex,
  TrickId,
} from './types';
import { loadState, saveState, wipeSave, clearPhotos, deletePhoto as dbDeletePhoto } from './persistence';
import { ACHIEVEMENTS, DAILY_POOL, STORY_QUESTS, type GameEvent } from './data/quests';
import {
  BOTTLES,
  CAGES,
  CONSUMABLES,
  FOODS,
  PLACEABLES,
  SECOND_FLOOR_PRICE,
  THEMES,
  cageDef,
  foodDef,
  placeableDef,
} from './data/items';
import { personalityDef, trickDef } from './data/personalities';
import { bus } from './bus';
import { buildLayout } from '../cage/layout';
import { describeAppearanceFull } from './data/coats';
import { inherit, lifeExpectancy, monthsPerMs, randomPersonality } from './life';
import { randomName } from './data/personalities';

const SAVE_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  breeding: false,
  aging: true,
  naturalDeath: false,
  comfortMode: true,
  lifespan: '1m',
  music: 0.5,
  sfx: 0.8,
  haptics: true,
  hints: true,
  quality: 'medium',
  shellFur: true,
};

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function rollDaily(): QuestProgress[] {
  const pool = [...DAILY_POOL];
  const out: QuestProgress[] = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const j = Math.floor(Math.random() * pool.length);
    const q = pool.splice(j, 1)[0];
    out.push({ id: q.id, progress: 0, done: false, claimed: false });
  }
  return out;
}

export function newGameState(): GameState {
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    started: false,
    introSeen: false,
    coins: 150,
    rats: [],
    family: [],
    inventory: {
      food_mix: 6,
      treat_veg: 4,
      treat_yogurt: 3,
      treat_seed: 8,
      treat_nut: 2,
      care_bedding: 3,
      care_tissues: 3,
      care_vitamins: 1,
      hammock_fabric: 1,
    },
    ownedCages: ['cage_basic'],
    ownedThemes: ['theme_scandi'],
    theme: 'theme_scandi',
    cage: {
      cageId: 'cage_basic',
      secondFloor: false,
      bottle: 'bottle_basic',
      placed: [
        { slotId: 'f0', itemId: 'house_wood' },
        { slotId: 'f4', itemId: 'bowl_plastic' },
      ],
      bowlFood: 40,
      water: 100,
      bedding: 100,
      nestPapers: 0,
      nestBuilt: 0,
    },
    settings: { ...DEFAULT_SETTINGS },
    storyQuests: STORY_QUESTS.map((q) => ({ id: q.id, progress: 0, done: false, claimed: false })),
    storyIndex: 0,
    daily: { day: todayKey(), quests: rollDaily() },
    achievements: {},
    counters: {},
    photos: [],
    lastTick: now,
    lastSave: now,
    totalPlayMs: 0,
    earnCooldowns: {},
  };
}

function migrate(s: GameState): GameState {
  const base = newGameState();
  const merged: GameState = { ...base, ...s };
  merged.settings = { ...DEFAULT_SETTINGS, ...(s.settings ?? {}) };
  merged.cage = { ...base.cage, ...(s.cage ?? {}) };
  merged.inventory = { ...(s.inventory ?? {}) };
  merged.counters = { ...(s.counters ?? {}) };
  merged.version = SAVE_VERSION;
  // новые сюжетные задания, если добавились
  for (const q of STORY_QUESTS) {
    if (!merged.storyQuests.find((p) => p.id === q.id)) merged.storyQuests.push({ id: q.id, progress: 0, done: false, claimed: false });
  }
  for (const r of merged.rats) {
    r.toyLove = r.toyLove ?? {};
    r.tricks = r.tricks ?? {};
    r.petsToday = r.petsToday ?? 0;
  }
  return merged;
}

export interface AdoptInput {
  name: string;
  sex: Sex;
  appearance: Appearance;
  personality: PersonalityId;
  origin: OriginId;
  ageMonths: number;
}

export interface ReturnSummary {
  minutes: number;
  lines: string[];
}

export const ADOPT_COST: Record<OriginId, number> = { shelter: 60, breeder: 300, petshop: 150, born: 0 };

interface Actions {
  set: (fn: (s: GameState) => void) => void;
  save: () => void;
  markIntroSeen: () => void;
  adopt: (a: AdoptInput, free?: boolean) => RatData | null;
  emit: (e: GameEvent, n?: number) => void;
  addCoins: (n: number, reason?: string) => void;
  earn: (key: string, amount: number, cooldownMs: number) => boolean;
  fillBowl: () => boolean;
  refreshWater: () => void;
  refreshBedding: () => boolean;
  giveTissues: () => boolean;
  treat: (ratId: string, foodId: string) => boolean;
  petStroke: (ratId: string) => void;
  call: (ratId: string) => void;
  trainAttempt: (ratId: string, trick: TrickId, success: boolean) => { learned: boolean; progress: number };
  trickPerformed: (ratId: string, trick: TrickId) => void;
  playFinished: (ratId: string, catches: number, toy: string) => void;
  buy: (id: string) => boolean;
  buyCage: (id: string) => boolean;
  buyTheme: (id: string) => boolean;
  buySecondFloor: () => boolean;
  setCage: (id: string) => void;
  setTheme: (id: string) => void;
  setBottle: (id: string) => void;
  placeItem: (slotId: string, itemId: string) => boolean;
  removeItem: (slotId: string) => void;
  rename: (ratId: string, name: string) => void;
  rehome: (ratId: string) => void;
  vitamins: (ratId: string) => boolean;
  vet: (ratId: string) => boolean;
  ratUsedToy: (ratId: string, toy: string) => void;
  ratAte: (ratId: string) => void;
  ratDrank: (ratId: string) => void;
  nestPaperCarried: () => void;
  updateSettings: (p: Partial<Settings>) => void;
  claimQuest: (kind: 'story' | 'daily', id: string) => void;
  addPhoto: (id: string, ratNames: string[]) => void;
  removePhoto: (id: string) => void;
  tick: (dtMs: number, offline?: boolean) => void;
  applyOffline: () => ReturnSummary | null;
  resetAll: () => Promise<void>;
}

export type Store = GameState & Actions;

function aliveRats(s: GameState): RatData[] {
  return s.rats.filter((r) => r.alive);
}

function clamp(v: number, a = 0, b = 100): number {
  return v < a ? a : v > b ? b : v;
}

/** Суммарный «уют» клетки: предметы, подстилка, вода, гнездо */
export function cageComfortScore(s: GameState): number {
  let score = 30;
  for (const p of s.cage.placed) score += placeableDef(p.itemId)?.comfort ?? 0;
  score += s.cage.secondFloor ? 8 : 0;
  score += (s.cage.bedding / 100) * 15;
  score += Math.min(10, s.cage.nestBuilt);
  if (s.cage.water < 10) score -= 15;
  return clamp(score, 0, 100);
}

function hasCompanion(s: GameState): boolean {
  return aliveRats(s).length >= 2;
}

function storyDef(id: string) {
  return STORY_QUESTS.find((q) => q.id === id);
}
function dailyDef(id: string) {
  return DAILY_POOL.find((q) => q.id === id);
}

const saved = loadState();
const initial: GameState = saved ? migrate(saved) : newGameState();

export const useGame = create<Store>((set, get) => {
  const mutate = (fn: (s: GameState) => void) => {
    set((st) => {
      const draft = structuredClone(pickState(st));
      fn(draft);
      return draft;
    });
  };

  const checkAchievements = (s: GameState) => {
    for (const a of ACHIEVEMENTS) {
      if (s.achievements[a.id]) continue;
      if (a.check(s.counters)) {
        s.achievements[a.id] = Date.now();
        s.coins += a.reward;
        bus.emit('toast', { text: `🏆 Достижение: «${a.title}» +${a.reward}`, kind: 'achievement' });
        bus.emit('sound', { name: 'achievement' });
      }
    }
  };

  const emitInto = (s: GameState, e: GameEvent, n = 1) => {
    s.counters[e] = (s.counters[e] ?? 0) + n;
    // сюжетная цепочка: активно текущее задание
    const cur = s.storyQuests[s.storyIndex];
    if (cur && !cur.done) {
      const def = storyDef(cur.id);
      if (def && def.event === e) {
        cur.progress = Math.min(def.target, cur.progress + n);
        if (cur.progress >= def.target) {
          cur.done = true;
          bus.emit('toast', { text: `✅ Задание выполнено: «${def.title}»`, kind: 'quest' });
          bus.emit('sound', { name: 'quest' });
        }
      }
    }
    // ежедневные
    if (s.daily.day !== todayKey()) s.daily = { day: todayKey(), quests: rollDaily() };
    for (const q of s.daily.quests) {
      if (q.done) continue;
      const def = dailyDef(q.id);
      if (def && def.event === e) {
        q.progress = Math.min(def.target, q.progress + n);
        if (q.progress >= def.target) {
          q.done = true;
          bus.emit('toast', { text: `✅ Ежедневное: «${def.title}»`, kind: 'quest' });
          bus.emit('sound', { name: 'quest' });
        }
      }
    }
    checkAchievements(s);
  };

  const earnInto = (s: GameState, key: string, amount: number, cooldownMs: number): boolean => {
    const now = Date.now();
    if ((s.earnCooldowns[key] ?? 0) > now) return false;
    s.earnCooldowns[key] = now + cooldownMs;
    s.coins += amount;
    s.counters.coins_earned = (s.counters.coins_earned ?? 0) + amount;
    bus.emit('toast', { text: `+${amount} 🪙`, kind: 'coin' });
    bus.emit('sound', { name: 'coin' });
    return true;
  };

  const ratIn = (s: GameState, id: string) => s.rats.find((r) => r.id === id && r.alive);

  const changeTrust = (s: GameState, r: RatData, d: number) => {
    const p = personalityDef(r.personality);
    r.stats.trust = clamp(r.stats.trust + (d > 0 ? d * p.trustGain : d));
    s.counters.max_trust = Math.max(s.counters.max_trust ?? 0, Math.round(r.stats.trust));
  };

  const makeRat = (a: AdoptInput): RatData => {
    const now = Date.now();
    return {
      id: uid(),
      name: a.name.trim() || randomName(a.sex),
      sex: a.sex,
      appearance: a.appearance,
      personality: a.personality,
      ageMonths: a.ageMonths,
      stats: { satiety: 80, health: 100, comfort: 70, trust: a.origin === 'breeder' ? 30 : a.origin === 'shelter' ? 20 : 12 },
      toyLove: {},
      tricks: {},
      origin: a.origin,
      parents: null,
      generation: 1,
      bornAt: now,
      adoptedAt: now,
      alive: true,
      diedAt: null,
      pregnantUntil: null,
      pregnantBy: null,
      lastLitterAt: 0,
      sick: false,
      petsToday: 0,
    };
  };

  const recordFamily = (s: GameState, r: RatData) => {
    const ex = s.family.find((f) => f.id === r.id);
    const rec = {
      id: r.id,
      name: r.name,
      sex: r.sex,
      appearanceText: describeAppearanceFull(r.appearance),
      parents: r.parents,
      generation: r.generation,
      bornAt: r.bornAt,
      diedAt: r.diedAt,
    };
    if (ex) Object.assign(ex, rec);
    else s.family.push(rec);
  };

  // --- симуляция ---
  const simulate = (s: GameState, dtMs: number, offline: boolean, log?: string[]) => {
    const hours = dtMs / 3600_000;
    const comfortMode = s.settings.comfortMode;
    const decay = comfortMode ? 0.3 : 1;
    const rats = aliveRats(s);
    const glass = s.cage.bottle === 'bottle_glass';

    s.cage.water = clamp(s.cage.water - hours * (glass ? 5 : 8) * decay * Math.max(1, rats.length * 0.5));
    s.cage.bedding = clamp(s.cage.bedding - hours * 1.6 * decay * Math.max(1, rats.length * 0.4));

    const comfortTarget = cageComfortScore(s);
    const mpm = monthsPerMs(s.settings);

    for (const r of rats) {
      const st = r.stats;
      st.satiety = clamp(st.satiety - hours * 11 * decay);
      // Офлайн: крыски сами едят из миски
      if (offline && st.satiety < 60 && s.cage.bowlFood > 0) {
        const eat = Math.min(s.cage.bowlFood, (70 - st.satiety) * 0.5);
        s.cage.bowlFood -= eat;
        st.satiety = clamp(st.satiety + eat * 2);
      }
      let target = comfortTarget + (hasCompanion(s) ? 12 : 0) + (st.satiety > 50 ? 5 : -10);
      target = clamp(target);
      st.comfort += (target - st.comfort) * Math.min(1, hours * 0.8);
      st.comfort = clamp(st.comfort);

      if (comfortMode) {
        st.health = clamp(st.health + hours * 20);
        r.sick = false;
      } else {
        let dh = hours * 4;
        if (st.satiety < 15) dh -= hours * 6;
        if (s.cage.water < 5) dh -= hours * 6;
        if (r.sick) dh -= hours * 3;
        st.health = clamp(st.health + dh);
        if (!r.sick && st.comfort < 35 && s.cage.bedding < 25 && Math.random() < hours * 0.15) {
          r.sick = true;
          bus.emit('toast', { text: `🤧 ${r.name} немного ${r.sex === 'm' ? 'простыл' : 'простыла'}. Витаминные капли помогут.`, kind: 'warn' });
        }
        if (r.sick && st.health > 90 && st.comfort > 60 && Math.random() < hours * 0.5) r.sick = false;
      }
      if (offline) {
        // мягкий расчёт без наказания
        st.satiety = Math.max(st.satiety, comfortMode ? 50 : 30);
        st.health = Math.max(st.health, 60);
        st.comfort = Math.max(st.comfort, 45);
      }

      // старение
      if (s.settings.aging) {
        r.ageMonths += dtMs * mpm;
        const deathAllowed = s.settings.naturalDeath && !comfortMode;
        if (deathAllowed && r.ageMonths >= lifeExpectancy(r)) {
          r.alive = false;
          r.diedAt = Date.now();
          recordFamily(s, r);
          const msg = `🌈 ${r.name} ${r.sex === 'm' ? 'ушёл' : 'ушла'} на радугу в почтенном возрасте. Спасибо за тёплую жизнь.`;
          if (log) log.push(msg);
          bus.emit('toast', { text: msg, kind: 'warn' });
          bus.emit('ratsChanged', {});
        }
      }
    }

    // размножение
    if (s.settings.breeding) {
      const now = Date.now();
      const all = aliveRats(s);
      const cap = Math.min(10, cageDef(s.cage.cageId).capacity + 2);
      for (const f of all.filter((r) => r.sex === 'f')) {
        if (f.pregnantUntil && now >= f.pregnantUntil) {
          const father = s.rats.find((r) => r.id === f.pregnantBy) ?? f;
          const room = Math.max(0, cap - aliveRats(s).length);
          const litter = Math.min(room, 2 + Math.floor(Math.random() * 3));
          const babies: string[] = [];
          for (let i = 0; i < litter; i++) {
            const sex: Sex = Math.random() < 0.5 ? 'm' : 'f';
            const baby = makeRat({
              name: randomName(sex, s.rats.map((r) => r.name)),
              sex,
              appearance: inherit(f.appearance, father.appearance),
              personality: randomPersonality(),
              origin: 'born',
              ageMonths: 0.05,
            });
            baby.parents = [f.id, father.id];
            baby.generation = Math.max(f.generation, father.generation) + 1;
            baby.stats.trust = 35;
            s.rats.push(baby);
            recordFamily(s, baby);
            babies.push(baby.name);
          }
          f.pregnantUntil = null;
          f.pregnantBy = null;
          f.lastLitterAt = now;
          if (babies.length) {
            emitInto(s, 'litter', 1);
            const msg = `🍼 У ${f.name} родились крысята: ${babies.join(', ')}!`;
            if (log) log.push(msg);
            bus.emit('toast', { text: msg, kind: 'quest' });
            bus.emit('ratsChanged', {});
          }
        }
      }
      if (aliveRats(s).length < cap) {
        const lifeMs = 30 / mpm; // мс на всю жизнь
        for (const f of all.filter((r) => r.sex === 'f' && !r.pregnantUntil && r.ageMonths >= 3 && r.ageMonths < 18)) {
          if (f.stats.comfort < 65) continue;
          if (now - f.lastLitterAt < lifeMs * (2 / 30)) continue;
          const male = all.find((m) => m.sex === 'm' && m.ageMonths >= 3 && m.stats.comfort >= 55);
          if (!male) continue;
          // вероятность за реальный час, масштабируется скоростью жизни
          const pPerMonth = 0.5;
          if (Math.random() < dtMs * mpm * pPerMonth) {
            f.pregnantUntil = now + Math.max(3 * 60_000, lifeMs * (0.7 / 30));
            f.pregnantBy = male.id;
            bus.emit('toast', { text: `💞 Кажется, ${f.name} ждёт малышей!`, kind: 'info' });
          }
        }
      }
    }
  };

  return {
    ...initial,

    set: (fn) => mutate(fn),

    save: () => {
      const s = pickState(get());
      s.lastSave = Date.now();
      saveState(s);
    },

    markIntroSeen: () => mutate((s) => void (s.introSeen = true)),

    adopt: (a, free) => {
      let created: RatData | null = null;
      mutate((s) => {
        const cost = free ? 0 : ADOPT_COST[a.origin];
        if (s.coins < cost) return;
        const cap = cageDef(s.cage.cageId).capacity;
        if (aliveRats(s).length >= cap) return;
        s.coins -= cost;
        const r = makeRat(a);
        s.rats.push(r);
        recordFamily(s, r);
        s.started = true;
        s.counters.rats_owned = (s.counters.rats_owned ?? 0) + 1;
        emitInto(s, 'adopt', 1);
        created = r;
      });
      if (created) bus.emit('ratsChanged', {});
      get().save();
      return created;
    },

    emit: (e, n = 1) => mutate((s) => emitInto(s, e, n)),

    addCoins: (n, reason) =>
      mutate((s) => {
        s.coins += n;
        if (n > 0) s.counters.coins_earned = (s.counters.coins_earned ?? 0) + n;
        if (reason) bus.emit('toast', { text: `${reason} +${n} 🪙`, kind: 'coin' });
      }),

    earn: (key, amount, cd) => {
      let ok = false;
      mutate((s) => {
        ok = earnInto(s, key, amount, cd);
      });
      return ok;
    },

    fillBowl: () => {
      let ok = false;
      mutate((s) => {
        if (!s.cage.placed.some((p) => placeableDef(p.itemId)?.kind === 'bowl')) {
          bus.emit('toast', { text: 'Сначала поставь миску в режиме обустройства.', kind: 'warn' });
          return;
        }
        if ((s.inventory.food_mix ?? 0) <= 0) {
          bus.emit('toast', { text: 'Зерновая смесь закончилась — загляни в магазин.', kind: 'warn' });
          return;
        }
        if (s.cage.bowlFood >= 95) {
          bus.emit('toast', { text: 'Миска и так полная.', kind: 'info' });
          return;
        }
        s.inventory.food_mix -= 1;
        const ceramic = s.cage.placed.some((p) => p.itemId === 'bowl_ceramic');
        s.cage.bowlFood = 100;
        if (ceramic) s.cage.bowlFood = 100;
        emitInto(s, 'fill_bowl');
        earnInto(s, 'fill_bowl', 10, 2 * 3600_000);
        ok = true;
      });
      if (ok) bus.emit('worldFillBowl', {});
      return ok;
    },

    refreshWater: () => {
      mutate((s) => {
        s.cage.water = 100;
        emitInto(s, 'refresh_water');
        earnInto(s, 'water', 8, 3 * 3600_000);
      });
      bus.emit('worldWater', {});
    },

    refreshBedding: () => {
      let ok = false;
      mutate((s) => {
        if ((s.inventory.care_bedding ?? 0) <= 0) {
          bus.emit('toast', { text: 'Наполнитель закончился — он есть в магазине в разделе «Уход».', kind: 'warn' });
          return;
        }
        if (s.cage.bedding > 85) {
          bus.emit('toast', { text: 'Подстилка ещё свежая.', kind: 'info' });
          return;
        }
        s.inventory.care_bedding -= 1;
        s.cage.bedding = 100;
        emitInto(s, 'refresh_bedding');
        earnInto(s, 'bedding', 15, 6 * 3600_000);
        ok = true;
      });
      if (ok) bus.emit('worldBedding', {});
      return ok;
    },

    giveTissues: () => {
      let ok = false;
      mutate((s) => {
        if ((s.inventory.care_tissues ?? 0) <= 0) {
          bus.emit('toast', { text: 'Салфетки закончились — купи в разделе «Уход».', kind: 'warn' });
          return;
        }
        s.inventory.care_tissues -= 1;
        s.cage.nestPapers += 5;
        emitInto(s, 'give_tissues');
        ok = true;
      });
      if (ok) bus.emit('worldTissues', {});
      return ok;
    },

    treat: (ratId, foodId) => {
      let ok = false;
      mutate((s) => {
        const r = ratIn(s, ratId);
        const f = foodDef(foodId);
        if (!r || !f || (s.inventory[foodId] ?? 0) <= 0) return;
        s.inventory[foodId] -= 1;
        r.stats.satiety = clamp(r.stats.satiety + f.satiety);
        r.stats.comfort = clamp(r.stats.comfort + f.comfort);
        const gourmet = r.personality === 'gourmet' ? 1.3 : 1;
        changeTrust(s, r, f.trust * gourmet);
        emitInto(s, 'treat');
        earnInto(s, `treat_${ratId}`, 5, 20 * 60_000);
        ok = true;
      });
      if (ok) bus.emit('worldTreat', { ratId, foodId });
      return ok;
    },

    petStroke: (ratId) =>
      mutate((s) => {
        const r = ratIn(s, ratId);
        if (!r) return;
        changeTrust(s, r, 1.2);
        r.stats.comfort = clamp(r.stats.comfort + 1);
        r.petsToday += 1;
        if (r.petsToday % 6 === 0) {
          emitInto(s, 'pet');
          earnInto(s, `pet_${ratId}`, 6, 10 * 60_000);
        }
      }),

    call: (ratId) =>
      mutate((s) => {
        const r = ratIn(s, ratId);
        if (!r) return;
        changeTrust(s, r, 0.8);
        emitInto(s, 'call');
        earnInto(s, `call_${ratId}`, 3, 15 * 60_000);
      }),

    trainAttempt: (ratId, trick, success) => {
      const res = { learned: false, progress: 0 };
      mutate((s) => {
        const r = ratIn(s, ratId);
        if (!r) return;
        const def = trickDef(trick);
        const p = personalityDef(r.personality);
        const before = r.tricks[trick] ?? 0;
        if (success) {
          const gain = (1 / def.difficulty) * p.learn * (0.7 + r.stats.trust / 200);
          r.tricks[trick] = Math.min(1, before + gain);
          changeTrust(s, r, 1);
        }
        emitInto(s, 'train');
        res.progress = r.tricks[trick] ?? 0;
        if (before < 1 && (r.tricks[trick] ?? 0) >= 1) {
          res.learned = true;
          emitInto(s, 'trick_learned');
          s.coins += 40;
          bus.emit('toast', { text: `🎉 ${r.name} ${r.sex === 'm' ? 'выучил' : 'выучила'} трюк «${def.name}»! +40 🪙`, kind: 'quest' });
        } else if (success) {
          earnInto(s, `train_${ratId}`, 4, 3 * 60_000);
        }
      });
      return res;
    },

    trickPerformed: (ratId, trick) =>
      mutate((s) => {
        const r = ratIn(s, ratId);
        if (!r) return;
        emitInto(s, 'trick_perform');
        earnInto(s, `perform_${ratId}_${trick}`, 5, 10 * 60_000);
      }),

    playFinished: (ratId, catches, toy) =>
      mutate((s) => {
        const r = ratIn(s, ratId);
        if (!r) return;
        changeTrust(s, r, 2 + catches * 0.5);
        r.stats.comfort = clamp(r.stats.comfort + 5);
        r.toyLove[toy] = (r.toyLove[toy] ?? 0) + 2 + catches;
        emitInto(s, 'play');
        earnInto(s, `play_${ratId}`, 10 + Math.min(15, catches * 2), 5 * 60_000);
      }),

    buy: (id) => {
      let ok = false;
      mutate((s) => {
        const f = FOODS.find((x) => x.id === id);
        const c = CONSUMABLES.find((x) => x.id === id);
        const p = PLACEABLES.find((x) => x.id === id);
        const b = BOTTLES.find((x) => x.id === id);
        const price = f?.price ?? c?.price ?? p?.price ?? b?.price;
        if (price === undefined) return;
        if (s.coins < price) {
          bus.emit('toast', { text: 'Не хватает монеток 🪙', kind: 'warn' });
          return;
        }
        if (b) {
          if (s.inventory[id]) return;
          s.coins -= price;
          s.inventory[id] = 1;
          s.cage.bottle = id;
          bus.emit('cageChanged', {});
        } else {
          s.coins -= price;
          const pack = f?.pack ?? c?.pack ?? 1;
          s.inventory[id] = (s.inventory[id] ?? 0) + pack;
        }
        emitInto(s, 'buy');
        bus.emit('sound', { name: 'buy' });
        ok = true;
      });
      return ok;
    },

    buyCage: (id) => {
      let ok = false;
      mutate((s) => {
        const c = CAGES.find((x) => x.id === id);
        if (!c || s.ownedCages.includes(id)) return;
        if (s.coins < c.price) {
          bus.emit('toast', { text: 'Не хватает монеток 🪙', kind: 'warn' });
          return;
        }
        s.coins -= c.price;
        s.ownedCages.push(id);
        emitInto(s, 'buy');
        ok = true;
      });
      if (ok) get().setCage(id);
      return ok;
    },

    buyTheme: (id) => {
      let ok = false;
      mutate((s) => {
        const t = THEMES.find((x) => x.id === id);
        if (!t || s.ownedThemes.includes(id)) return;
        if (s.coins < t.price) {
          bus.emit('toast', { text: 'Не хватает монеток 🪙', kind: 'warn' });
          return;
        }
        s.coins -= t.price;
        s.ownedThemes.push(id);
        emitInto(s, 'buy');
        ok = true;
      });
      if (ok) get().setTheme(id);
      return ok;
    },

    buySecondFloor: () => {
      let ok = false;
      mutate((s) => {
        if (s.cage.secondFloor || !cageDef(s.cage.cageId).canSecondFloor) return;
        if (s.coins < SECOND_FLOOR_PRICE) {
          bus.emit('toast', { text: 'Не хватает монеток 🪙', kind: 'warn' });
          return;
        }
        s.coins -= SECOND_FLOOR_PRICE;
        s.cage.secondFloor = true;
        s.counters.second_floor = 1;
        s.inventory.upgrade_floor2 = 1;
        emitInto(s, 'buy');
        emitInto(s, 'second_floor');
        ok = true;
      });
      if (ok) bus.emit('cageChanged', {});
      return ok;
    },

    setCage: (id) => {
      mutate((s) => {
        if (!s.ownedCages.includes(id)) return;
        const def = cageDef(id);
        if (aliveRats(s).length > def.capacity) {
          bus.emit('toast', { text: `В «${def.name}» помещается до ${def.capacity} крысок.`, kind: 'warn' });
          return;
        }
        s.cage.cageId = id;
        // второй этаж сохраняется как покупка, но доступен только в клетках, где он возможен
        s.cage.secondFloor = !!s.inventory.upgrade_floor2 && def.canSecondFloor;
        const layout = buildLayout(id, s.cage.secondFloor);
        const valid = new Set(layout.slots.map((sl) => sl.id));
        const keep = [];
        for (const p of s.cage.placed) {
          if (valid.has(p.slotId)) keep.push(p);
          else s.inventory[p.itemId] = (s.inventory[p.itemId] ?? 0) + 1;
        }
        s.cage.placed = keep;
      });
      bus.emit('cageChanged', {});
    },

    setTheme: (id) => {
      mutate((s) => {
        if (!s.ownedThemes.includes(id)) return;
        if (s.theme !== id) {
          s.theme = id;
          emitInto(s, 'theme');
        }
      });
      bus.emit('themeChanged', {});
    },

    setBottle: (id) => {
      mutate((s) => {
        if (id !== 'bottle_basic' && !s.inventory[id]) return;
        s.cage.bottle = id;
      });
      bus.emit('cageChanged', {});
    },

    placeItem: (slotId, itemId) => {
      let ok = false;
      mutate((s) => {
        const def = placeableDef(itemId);
        if (!def || (s.inventory[itemId] ?? 0) <= 0) return;
        const layout = buildLayout(s.cage.cageId, s.cage.secondFloor);
        const slot = layout.slots.find((x) => x.id === slotId);
        if (!slot || slot.kind !== def.slot) {
          bus.emit('toast', { text: def.slot === 'hang' ? 'Этот предмет вешается под крышу.' : 'Этот предмет ставится на пол или полку.', kind: 'warn' });
          return;
        }
        const existing = s.cage.placed.find((p) => p.slotId === slotId);
        if (existing) s.inventory[existing.itemId] = (s.inventory[existing.itemId] ?? 0) + 1;
        s.cage.placed = s.cage.placed.filter((p) => p.slotId !== slotId);
        s.cage.placed.push({ slotId, itemId });
        s.inventory[itemId] -= 1;
        emitInto(s, 'place_item');
        if (def.kind === 'hammock' || def.kind === 'hammock2') emitInto(s, 'place_hammock');
        ok = true;
      });
      if (ok) bus.emit('cageChanged', {});
      return ok;
    },

    removeItem: (slotId) => {
      mutate((s) => {
        const ex = s.cage.placed.find((p) => p.slotId === slotId);
        if (!ex) return;
        s.inventory[ex.itemId] = (s.inventory[ex.itemId] ?? 0) + 1;
        s.cage.placed = s.cage.placed.filter((p) => p.slotId !== slotId);
      });
      bus.emit('cageChanged', {});
    },

    rename: (ratId, name) => {
      mutate((s) => {
        const r = ratIn(s, ratId);
        if (!r || !name.trim()) return;
        r.name = name.trim().slice(0, 20);
        recordFamily(s, r);
        emitInto(s, 'rename');
      });
      bus.emit('ratsChanged', {});
    },

    rehome: (ratId) => {
      mutate((s) => {
        const r = ratIn(s, ratId);
        if (!r) return;
        r.alive = false;
        r.diedAt = null;
        s.rats = s.rats.filter((x) => x.id !== ratId);
        recordFamily(s, r);
        s.coins += 30;
        bus.emit('toast', { text: `🏡 ${r.name} ${r.sex === 'm' ? 'переехал' : 'переехала'} в заботливую семью. Тебе пришлют фото! +30 🪙`, kind: 'info' });
      });
      bus.emit('ratsChanged', {});
    },

    vitamins: (ratId) => {
      let ok = false;
      mutate((s) => {
        const r = ratIn(s, ratId);
        if (!r || (s.inventory.care_vitamins ?? 0) <= 0) {
          bus.emit('toast', { text: 'Витаминных капель нет — они в магазине в разделе «Уход».', kind: 'warn' });
          return;
        }
        s.inventory.care_vitamins -= 1;
        r.stats.health = clamp(r.stats.health + 30);
        r.sick = false;
        emitInto(s, 'vitamins');
        ok = true;
      });
      return ok;
    },

    vet: (ratId) => {
      let ok = false;
      mutate((s) => {
        const r = ratIn(s, ratId);
        if (!r) return;
        if (s.coins < 80) {
          bus.emit('toast', { text: 'Визит к ветеринару стоит 80 🪙', kind: 'warn' });
          return;
        }
        s.coins -= 80;
        r.stats.health = 100;
        r.sick = false;
        bus.emit('toast', { text: `🩺 ${r.name}: ветеринар говорит, что всё хорошо!`, kind: 'info' });
        ok = true;
      });
      return ok;
    },

    ratUsedToy: (ratId, toy) =>
      mutate((s) => {
        const r = ratIn(s, ratId);
        if (!r) return;
        const p = personalityDef(r.personality);
        r.toyLove[toy] = (r.toyLove[toy] ?? 0) + (p.favToys.includes(toy) ? 1.5 : 1);
        r.stats.comfort = clamp(r.stats.comfort + 0.5);
      }),

    ratAte: (ratId) =>
      mutate((s) => {
        const r = ratIn(s, ratId);
        if (!r || s.cage.bowlFood <= 0) return;
        const need = 100 - r.stats.satiety;
        const eat = Math.min(s.cage.bowlFood, need * 0.35 + 4);
        s.cage.bowlFood = clamp(s.cage.bowlFood - eat);
        r.stats.satiety = clamp(r.stats.satiety + eat * 1.6);
      }),

    ratDrank: (ratId) =>
      mutate((s) => {
        const r = ratIn(s, ratId);
        if (!r) return;
        s.cage.water = clamp(s.cage.water - 0.6);
        r.stats.health = clamp(r.stats.health + 0.5);
      }),

    nestPaperCarried: () =>
      mutate((s) => {
        if (s.cage.nestPapers <= 0) return;
        s.cage.nestPapers -= 1;
        s.cage.nestBuilt = Math.min(20, s.cage.nestBuilt + 1);
        emitInto(s, 'nest_paper');
      }),

    updateSettings: (p) =>
      mutate((s) => {
        s.settings = { ...s.settings, ...p };
        if (s.settings.comfortMode) s.settings.naturalDeath = false;
      }),

    claimQuest: (kind, id) =>
      mutate((s) => {
        if (kind === 'story') {
          const q = s.storyQuests.find((x) => x.id === id);
          const def = storyDef(id);
          if (!q || !def || !q.done || q.claimed) return;
          q.claimed = true;
          s.coins += def.reward;
          s.counters.coins_earned = (s.counters.coins_earned ?? 0) + def.reward;
          // переход к следующему
          while (s.storyIndex < s.storyQuests.length && s.storyQuests[s.storyIndex].claimed) s.storyIndex++;
        } else {
          const q = s.daily.quests.find((x) => x.id === id);
          const def = dailyDef(id);
          if (!q || !def || !q.done || q.claimed) return;
          q.claimed = true;
          s.coins += def.reward;
          s.counters.coins_earned = (s.counters.coins_earned ?? 0) + def.reward;
        }
        bus.emit('sound', { name: 'coin' });
      }),

    addPhoto: (id, ratNames) =>
      mutate((s) => {
        s.photos.unshift({ id, createdAt: Date.now(), ratNames });
        emitInto(s, 'photo');
        earnInto(s, 'photo', 6, 5 * 60_000);
      }),

    removePhoto: (id) => {
      mutate((s) => {
        s.photos = s.photos.filter((p) => p.id !== id);
      });
      void dbDeletePhoto(id);
    },

    tick: (dtMs, offline = false) =>
      mutate((s) => {
        simulate(s, dtMs, offline);
        s.lastTick = Date.now();
        s.totalPlayMs += offline ? 0 : dtMs;
        if (s.daily.day !== todayKey()) {
          s.daily = { day: todayKey(), quests: rollDaily() };
          s.counters.days_played = (s.counters.days_played ?? 0) + 1;
          for (const r of s.rats) r.petsToday = 0;
          checkAchievements(s);
        }
      }),

    applyOffline: () => {
      const st = get();
      if (!st.started) return null;
      const elapsed = Date.now() - st.lastTick;
      if (elapsed < 60_000) return null;
      const lines: string[] = [];
      const capped = Math.min(elapsed, 30 * 86400_000);
      mutate((s) => {
        const before = s.cage.bowlFood;
        // несколько шагов, чтобы роды/взросление шли корректно
        const steps = Math.min(48, Math.max(1, Math.ceil(capped / 3600_000)));
        for (let i = 0; i < steps; i++) simulate(s, capped / steps, true, lines);
        s.lastTick = Date.now();
        if (before - s.cage.bowlFood > 1) lines.unshift('Крыски перекусили из миски, пока тебя не было.');
        if (s.cage.water < 30) lines.push('В поилке мало воды — освежи её.');
        if (s.cage.bowlFood < 15) lines.push('Миска почти пустая.');
        if (s.daily.day !== todayKey()) {
          s.daily = { day: todayKey(), quests: rollDaily() };
          s.counters.days_played = (s.counters.days_played ?? 0) + 1;
          for (const r of s.rats) r.petsToday = 0;
          lines.push('Появились новые ежедневные задания!');
        }
        checkAchievements(s);
      });
      if (!lines.length) lines.push('Крыски сладко поспали и ждут тебя.');
      return { minutes: Math.round(elapsed / 60_000), lines };
    },

    resetAll: async () => {
      wipeSave();
      await clearPhotos();
      set({ ...newGameState() });
      bus.emit('ratsChanged', {});
      bus.emit('cageChanged', {});
      bus.emit('themeChanged', {});
    },
  };
});

/** Убираем функции, оставляем сериализуемое состояние */
export function pickState(st: Store | GameState): GameState {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(st)) {
    if (typeof v !== 'function') out[k] = v;
  }
  return out as unknown as GameState;
}

export function getGame(): Store {
  return useGame.getState();
}

// автосохранение
let saveTimer: number | undefined;
useGame.subscribe(() => {
  if (saveTimer) return;
  saveTimer = window.setTimeout(() => {
    saveTimer = undefined;
    useGame.getState().save();
  }, 2500);
});
