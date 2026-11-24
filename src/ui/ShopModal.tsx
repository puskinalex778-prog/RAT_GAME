import React, { useState } from 'react';
import { Check, PlusCircle, Sparkles, X } from 'lucide-react';
import type { RatAppearance, RatSex, ShopCategory } from '../types/game';
import { SHOP_CATEGORIES, SHOP_ITEMS } from '../cage/catalog';
import { getDefaultAppearance } from '../rats/coatPresets';
import { useGameStore } from '../store/gameStore';
import { RatCustomizer } from './RatCustomizer';

interface ShopModalProps {
  open: boolean;
  initialTab?: ShopCategory | 'adopt';
  onClose: () => void;
  onStartDecorate: (itemId: string) => void;
}

export const ShopModal: React.FC<ShopModalProps> = ({
  open,
  initialTab = 'food',
  onClose,
  onStartDecorate,
}) => {
  const coins = useGameStore((s) => s.coins);
  const inventory = useGameStore((s) => s.inventory);
  const ownedHabitats = useGameStore((s) => s.ownedHabitats);
  const activeHabitat = useGameStore((s) => s.activeHabitat);
  const ownedThemes = useGameStore((s) => s.ownedThemes);
  const activeTheme = useGameStore((s) => s.activeTheme);
  const hasSecondFloor = useGameStore((s) => s.hasSecondFloor);
  const buyShopItem = useGameStore((s) => s.buyShopItem);
  const equipHabitat = useGameStore((s) => s.equipHabitat);
  const equipTheme = useGameStore((s) => s.equipTheme);
  const useBeddingRefresh = useGameStore((s) => s.useBeddingRefresh);
  const adoptNewRat = useGameStore((s) => s.adoptNewRat);

  const [tab, setTab] = useState<ShopCategory | 'adopt'>(initialTab);
  const [adoptName, setAdoptName] = useState('Жорж');
  const [adoptSex, setAdoptSex] = useState<RatSex>('male');
  const [adoptAppearance, setAdoptAppearance] = useState<RatAppearance>(() =>
    getDefaultAppearance()
  );

  if (!open) return null;

  const itemsInTab = SHOP_ITEMS.filter((i) => i.category === tab);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-2.5 sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[88vh] flex flex-col bg-[#FAF5EB] rounded-3xl border border-[#DFD3BD] shadow-2xl text-[#3B332B] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E6DAC6] bg-[#F4ECDC]">
          <div className="flex items-center gap-2.5">
            <img src="./assets/icons/shop.png" alt="Магазин" className="w-8 h-8 object-contain" />
            <h2 className="text-base sm:text-lg font-extrabold">Магазин уюта</h2>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-full border border-[#DFD2BA] shadow-xs">
              <img src="./assets/icons/coin.png" alt="Монеты" className="w-5 h-5 object-contain" />
              <span className="text-sm font-extrabold text-[#7B5A23]">{coins}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full bg-[#E8DEC9] text-[#5B4F42] hover:bg-[#DDD0B8]"
              aria-label="Закрыть"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex gap-1.5 px-3 py-2 overflow-x-auto border-b border-[#E9DFCD] bg-[#FAF5EB] shrink-0">
          {SHOP_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setTab(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 border transition ${
                tab === cat.id
                  ? 'bg-[#6E8572] text-white border-[#5D7361] shadow-xs'
                  : 'bg-white text-[#564A3E] border-[#E3D8C4]'
              }`}
            >
              <img src={cat.icon} alt="" className="w-4 h-4 object-contain" />
              {cat.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setTab('adopt')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 border transition ${
              tab === 'adopt'
                ? 'bg-[#C97254] text-white border-[#B26044] shadow-xs'
                : 'bg-[#F8EAE4] text-[#9A4E37] border-[#E8C9BD]'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Ещё крыска
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto cozy-scroll p-3.5">
          {tab === 'adopt' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 bg-[#F4EBDC] rounded-2xl p-3 border border-[#DFD2BA]">
                <div>
                  <div className="text-sm font-extrabold">Завести нового друга в стаю</div>
                  <div className="text-[11px] text-[#6F6254]">
                    Крыски — социальные животные: вдвоём они умывают друг друга и весело возятся!
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (adoptNewRat(adoptName, adoptSex, adoptAppearance)) {
                      onClose();
                    }
                  }}
                  className="shrink-0 flex items-center gap-1.5 bg-[#C97254] hover:bg-[#B46145] text-white text-xs font-extrabold px-4 py-2.5 rounded-xl shadow active:scale-95 transition"
                >
                  <img src="./assets/icons/coin.png" alt="" className="w-4 h-4" />
                  85 • Завести
                </button>
              </div>

              <RatCustomizer
                name={adoptName}
                sex={adoptSex}
                appearance={adoptAppearance}
                onChangeName={setAdoptName}
                onChangeSex={setAdoptSex}
                onChangeAppearance={setAdoptAppearance}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {itemsInTab.map((item) => {
                const qty = inventory[item.id] ?? 0;
                const isHabitat = Boolean(item.habitatId);
                const isTheme = Boolean(item.themeId);
                const isUpgrade = Boolean(item.isSecondFloorUpgrade);

                const ownedHabitat = item.habitatId && ownedHabitats.includes(item.habitatId);
                const equippedHabitat = item.habitatId && activeHabitat === item.habitatId;
                const ownedTheme = item.themeId && ownedThemes.includes(item.themeId);
                const equippedTheme = item.themeId && activeTheme === item.themeId;

                return (
                  <div
                    key={item.id}
                    className="flex gap-3 p-3 rounded-2xl bg-white/90 border border-[#E4D9C5] shadow-2xs"
                  >
                    <div className="w-16 h-16 rounded-xl bg-[#F5EFE2] border border-[#E6DAC6] flex items-center justify-center shrink-0">
                      <img
                        src={item.icon}
                        alt={item.name}
                        className="w-14 h-14 object-contain"
                        loading="lazy"
                      />
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-1">
                          <div className="text-xs sm:text-sm font-extrabold leading-tight">
                            {item.name}
                          </div>
                          {qty > 0 && !isHabitat && !isTheme && !isUpgrade && (
                            <span className="shrink-0 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-[#EAF1EB] text-[#4E6E54]">
                              Есть: {qty}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#756758] mt-0.5 leading-snug">
                          {item.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 mt-2">
                        {/* Habitat / Theme / Upgrade buttons */}
                        {isUpgrade ? (
                          hasSecondFloor ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-[#4E7A55]">
                              <Check className="w-4 h-4" /> Установлен
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => buyShopItem(item.id)}
                              className="flex items-center gap-1.5 bg-[#6E8572] hover:bg-[#5E7462] text-white text-xs font-bold px-3 py-1.5 rounded-xl active:scale-95 transition"
                            >
                              <img src="./assets/icons/coin.png" alt="" className="w-3.5 h-3.5" />
                              {item.price} • Построить
                            </button>
                          )
                        ) : isHabitat ? (
                          equippedHabitat ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-[#4E7A55]">
                              <Check className="w-4 h-4" /> Активно
                            </span>
                          ) : ownedHabitat ? (
                            <button
                              type="button"
                              onClick={() => equipHabitat(item.habitatId!)}
                              className="bg-[#E6EFE7] text-[#45664B] text-xs font-bold px-3 py-1.5 rounded-xl"
                            >
                              Выбрать
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => buyShopItem(item.id)}
                              className="flex items-center gap-1.5 bg-[#6E8572] text-white text-xs font-bold px-3 py-1.5 rounded-xl active:scale-95 transition"
                            >
                              <img src="./assets/icons/coin.png" alt="" className="w-3.5 h-3.5" />
                              {item.price} • Купить
                            </button>
                          )
                        ) : isTheme ? (
                          equippedTheme ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-[#4E7A55]">
                              <Check className="w-4 h-4" /> Выбрано
                            </span>
                          ) : ownedTheme ? (
                            <button
                              type="button"
                              onClick={() => equipTheme(item.themeId!)}
                              className="bg-[#E6EFE7] text-[#45664B] text-xs font-bold px-3 py-1.5 rounded-xl"
                            >
                              Применить
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => buyShopItem(item.id)}
                              className="flex items-center gap-1.5 bg-[#6E8572] text-white text-xs font-bold px-3 py-1.5 rounded-xl active:scale-95 transition"
                            >
                              <img src="./assets/icons/coin.png" alt="" className="w-3.5 h-3.5" />
                              {item.price} • Купить
                            </button>
                          )
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => buyShopItem(item.id)}
                              className="flex items-center gap-1.5 bg-[#6E8572] hover:bg-[#5E7462] text-white text-xs font-bold px-3 py-1.5 rounded-xl active:scale-95 transition"
                            >
                              <img src="./assets/icons/coin.png" alt="" className="w-3.5 h-3.5" />
                              {item.price} • {item.isConsumable ? 'Купить ×3' : 'Купить'}
                            </button>

                            {item.slotTypes && qty > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  onStartDecorate(item.id);
                                }}
                                className="flex items-center gap-1 bg-[#F2E9DA] hover:bg-[#E8DBC5] text-[#574A3D] text-xs font-bold px-2.5 py-1.5 rounded-xl transition"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                Поставить
                              </button>
                            )}

                            {item.id === 'care_bedding' && qty > 0 && (
                              <button
                                type="button"
                                onClick={() => useBeddingRefresh()}
                                className="bg-[#E6EFE7] text-[#45664B] text-xs font-bold px-2.5 py-1.5 rounded-xl"
                              >
                                Освежить
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
