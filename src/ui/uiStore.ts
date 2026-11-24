import { create } from 'zustand';
import type { TrickId } from '../store/types';

export type Panel = null | 'card' | 'shop' | 'quests' | 'settings' | 'album' | 'treat' | 'tricks' | 'dedication' | 'adoptMore' | 'family';
export type UiMode = 'normal' | 'photo' | 'decor' | 'pet' | 'play' | 'train';

interface UiState {
  selected: string | null;
  panel: Panel;
  mode: UiMode;
  decorSlot: string | null;
  nameFlash: { id: string; until: number } | null;
  hideHints: boolean;
  trainTrick: TrickId | null;
  set: (p: Partial<UiState>) => void;
}

export const useUi = create<UiState>((set) => ({
  selected: null,
  panel: null,
  mode: 'normal',
  decorSlot: null,
  nameFlash: null,
  hideHints: false,
  trainTrick: null,
  set: (p) => set(p),
}));
