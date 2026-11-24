import React from 'react';
import { Check, Trash2, X } from 'lucide-react';
import { ITEM_MAP, SHOP_ITEMS } from '../cage/catalog';
import { useGameStore } from '../store/gameStore';

interface DecorateOverlayProps {
  onClose: () => void;
}

export const DecorateOverlay: React.FC<DecorateOverlayProps> = ({ onClose }) => {
  const inventory = useGameStore((s) => s.inventory);
  const placedItems = useGameStore((s) => s.placedItems);
  const selectedItemId = useGameStore((s) => s.decorateSelectedItemId);
  const setSelectedItem = useGameStore((s) => s.setDecorateSelectedItem);
  const removeItemFromSlot = useGameStore((s) => s.removeItemFromSlot);

  const ownedPlaceables = SHOP_ITEMS.filter(
    (item) => item.slotTypes && item.slotTypes.length > 0 && (inventory[item.id] ?? 0) > 0
  );

  return (
    <div className="fixed inset-0 z-30 pointer-events-none flex flex-col justify-between safe-pt safe-pb safe-px">
      {/* Top Banner */}
      <div className="flex items-center justify-between gap-2 pointer-events-auto">
        <div className="bg-[#FAF5EB]/94 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-[#DFD3BD] shadow-md">
          <div className="text-xs sm:text-sm font-extrabold text-[#3B332B]">
            Режим обустройства клетки
          </div>
          <div className="text-[11px] text-[#6E6254]">
            {selectedItemId
              ? `Нажми на зелёную точку в клетке, чтобы поставить «${ITEM_MAP[selectedItemId]?.name}»`
              : 'Выбери предмет внизу, затем нажми на подсвеченный слот в 3D-клетке'}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 bg-[#6E8572] hover:bg-[#5E7462] text-white text-xs font-extrabold px-4 py-2.5 rounded-2xl shadow-md active:scale-95 transition"
        >
          <Check className="w-4 h-4" />
          Готово
        </button>
      </div>

      {/* Bottom Owned Placeable Tray */}
      <div className="pointer-events-auto max-w-2xl mx-auto w-full bg-[#FAF5EB]/94 backdrop-blur-md rounded-3xl p-3 border border-[#DFD3BD] shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-extrabold text-[#564A3E]">
            Твои предметы для клетки ({ownedPlaceables.length})
          </span>
          {placedItems.length > 0 && (
            <div className="flex items-center gap-1 overflow-x-auto max-w-[55%]">
              {placedItems.slice(0, 4).map((p) => (
                <button
                  key={p.slotId}
                  type="button"
                  onClick={() => removeItemFromSlot(p.slotId)}
                  title={`Убрать ${ITEM_MAP[p.itemId]?.name}`}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#F5E4DE] text-[#9A473A] text-[10px] font-bold shrink-0"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                  {ITEM_MAP[p.itemId]?.name.split(' ')[0]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {ownedPlaceables.map((item) => {
            const active = selectedItemId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedItem(active ? null : item.id)}
                className={`flex flex-col items-center p-2 rounded-2xl border min-w-[78px] shrink-0 transition active:scale-95 ${
                  active
                    ? 'bg-[#EAF1EB] border-[#5E7A63] ring-2 ring-[#6E8572]/40'
                    : 'bg-white border-[#E4D9C5]'
                }`}
              >
                <img src={item.icon} alt={item.name} className="w-10 h-10 object-contain" />
                <span className="text-[10px] font-bold text-[#3B332B] mt-1 leading-tight text-center line-clamp-2">
                  {item.name}
                </span>
              </button>
            );
          })}
          {selectedItemId && (
            <button
              type="button"
              onClick={() => setSelectedItem(null)}
              className="flex flex-col items-center justify-center p-2 rounded-2xl border border-[#E4D9C5] bg-[#F2E9DA] min-w-[66px] text-[#6B5D4E] shrink-0"
            >
              <X className="w-5 h-5" />
              <span className="text-[10px] font-bold mt-1">Снять выбор</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
