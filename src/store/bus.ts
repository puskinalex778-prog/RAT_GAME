import type { TrickId } from './types';

/** Одноразовые команды/события между UI, стором и 3D-миром */
export type BusEvents = {
  toast: { text: string; kind?: 'info' | 'coin' | 'quest' | 'achievement' | 'warn' };
  ratSelected: { id: string | null };
  ratTapped: { id: string };
  worldTreat: { ratId: string; foodId: string };
  worldCall: { ratId: string };
  worldPetStart: { ratId: string };
  worldPetEnd: { ratId: string };
  worldPlayStart: { ratId: string; toy: 'feather' | 'ball' };
  worldPlayEnd: { ratId: string };
  worldTrainStart: { ratId: string; trick: TrickId };
  worldTrainAttempt: { ratId: string; trick: TrickId; success: boolean };
  worldTrainEnd: { ratId: string };
  worldTrick: { ratId: string; trick: TrickId };
  worldFillBowl: Record<string, never>;
  worldWater: Record<string, never>;
  worldBedding: Record<string, never>;
  worldTissues: Record<string, never>;
  cageChanged: Record<string, never>;
  ratsChanged: Record<string, never>;
  themeChanged: Record<string, never>;
  playScore: { ratId: string; catches: number };
  sound: { name: string };
};

type Handler<T> = (payload: T) => void;

class Bus {
  private map = new Map<keyof BusEvents, Set<Handler<unknown>>>();

  on<K extends keyof BusEvents>(k: K, h: Handler<BusEvents[K]>): () => void {
    let set = this.map.get(k);
    if (!set) {
      set = new Set();
      this.map.set(k, set);
    }
    set.add(h as Handler<unknown>);
    return () => set!.delete(h as Handler<unknown>);
  }

  emit<K extends keyof BusEvents>(k: K, payload: BusEvents[K]): void {
    const set = this.map.get(k);
    if (!set) return;
    for (const h of Array.from(set)) {
      try {
        h(payload);
      } catch (e) {
        console.error('bus handler error', k, e);
      }
    }
  }
}

export const bus = new Bus();
