import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import { useUi } from '../uiStore';
import { Modal, click } from '../components/common';
import { BOTTLES, CAGES, CATEGORY_NAMES, CONSUMABLES, FOODS, PLACEABLES, SECOND_FLOOR_PRICE, THEMES, cageDef, type ShopCategory } from '../../store/data/items';

const CATS: ShopCategory[] = ['food', 'houses', 'hammocks', 'tunnels', 'toys', 'care', 'cages', 'themes', 'upgrades'];
const CAT_ICON: Record<ShopCategory, string> = {
  food: '🥕',
  houses: '🏠',
  hammocks: '🛏️',
  tunnels: '🌀',
  toys: '🧶',
  care: '🧴',
  cages: '🏗️',
  themes: '🎨',
  upgrades: '⬆️',
};

const ICONS: Record<string, string> = {
  food_mix: '🌾',
  treat_veg: '🥦',
  treat_yogurt: '🍦',
  treat_nut: '🌰',
  treat_seed: '🌻',
  care_bedding: '🧻',
  care_tissues: '📄',
  care_vitamins: '💧',
  house_wood: '🏠',
  house_wigwam: '⛺',
  house_pumpkin: '🎃',
  house_nest: '🧺',
  hammock_fabric: '🛏️',
  hammock_double: '🛌',
  hammock_corner: '🔺',
  tunnel_clear: '🫙',
  tunnel_fabric: '🌀',
  tunnel_bridge: '🌉',
  toy_ball: '⚾',
  toy_forage: '🧩',
  toy_wheel: '🎡',
  toy_rope: '🪢',
  toy_ladder: '🪜',
  bowl_plastic: '🥣',
  bowl_ceramic: '🍵',
  bottle_basic: '🍼',
  bottle_glass: '🧪',
  cage_basic: '🏠',
  cage_panorama: '🏰',
  cage_playpen: '🧺',
  upgrade_floor2: '🪜',
};

export function Shop() {
  const g = useGame();
  const set = useUi((s) => s.set);
  const [cat, setCat] = useState<ShopCategory>('food');
  const placedCount = (id: string) => g.cage.placed.filter((p) => p.itemId === id).length;

  const card = (id: string, name: string, desc: string, price: number, action: React.ReactNode, extra?: string) => (
    <div key={id} className="rounded-2xl bg-cream-100 border border-cream-200 p-3 flex gap-3 items-center">
      <div className="text-3xl w-10 text-center">{ICONS[id] ?? '🎁'}</div>
      <div className="flex-1 min-w-0">
        <div className="font-extrabold text-cocoa-800 text-[14px] leading-tight">{name}</div>
        <div className="text-[12px] text-cocoa-500 leading-snug">{desc}</div>
        {extra && <div className="text-[12px] font-bold text-cocoa-600 mt-0.5">{extra}</div>}
      </div>
      <div className="flex flex-col items-end gap-1">
        {price > 0 && <div className="font-extrabold text-cocoa-700 text-[14px]">{price} 🪙</div>}
        {action}
      </div>
    </div>
  );

  const buyBtn = (id: string, price: number) => (
    <button className="btn-primary !py-1.5 !px-3 text-[13px]" disabled={g.coins < price} onClick={() => { click(); g.buy(id); }}>
      Купить
    </button>
  );

  let content: React.ReactNode = null;
  if (cat === 'food') {
    content = FOODS.map((f) => card(f.id, `${f.name} ×${f.pack}`, f.desc, f.price, buyBtn(f.id, f.price), `В запасе: ${g.inventory[f.id] ?? 0}`));
  } else if (['houses', 'hammocks', 'tunnels', 'toys'].includes(cat)) {
    content = PLACEABLES.filter((p) => p.category === cat).map((p) =>
      card(p.id, p.name, p.desc, p.price, p.price > 0 ? buyBtn(p.id, p.price) : <span className="text-[12px] font-bold text-sage-600">Есть</span>, `На складе: ${g.inventory[p.id] ?? 0} · В клетке: ${placedCount(p.id)}`),
    );
  } else if (cat === 'care') {
    content = (
      <>
        {CONSUMABLES.map((c) => card(c.id, `${c.name} ×${c.pack}`, c.desc, c.price, buyBtn(c.id, c.price), `В запасе: ${g.inventory[c.id] ?? 0}`))}
        {PLACEABLES.filter((p) => p.category === 'care').map((p) =>
          card(p.id, p.name, p.desc, p.price, p.price > 0 ? buyBtn(p.id, p.price) : <span className="text-[12px] font-bold text-sage-600">Есть</span>, `На складе: ${g.inventory[p.id] ?? 0} · В клетке: ${placedCount(p.id)}`),
        )}
        {BOTTLES.map((b) => {
          const owned = b.price === 0 || !!g.inventory[b.id];
          const active = g.cage.bottle === b.id;
          return card(
            b.id,
            b.name,
            b.desc,
            owned ? 0 : b.price,
            active ? (
              <span className="text-[12px] font-bold text-sage-600">Установлена</span>
            ) : owned ? (
              <button className="btn-soft !py-1.5 !px-3 text-[13px]" onClick={() => { click(); g.setBottle(b.id); }}>
                Поставить
              </button>
            ) : (
              buyBtn(b.id, b.price)
            ),
          );
        })}
      </>
    );
  } else if (cat === 'cages') {
    content = CAGES.map((c) => {
      const owned = g.ownedCages.includes(c.id);
      const active = g.cage.cageId === c.id;
      return card(
        c.id,
        c.name,
        `${c.desc} Вмещает до ${c.capacity} крысок.${c.canSecondFloor ? ' Можно достроить 2 этаж.' : ''}`,
        owned ? 0 : c.price,
        active ? (
          <span className="text-[12px] font-bold text-sage-600">Сейчас</span>
        ) : owned ? (
          <button className="btn-soft !py-1.5 !px-3 text-[13px]" onClick={() => { click(); g.setCage(c.id); }}>
            Выбрать
          </button>
        ) : (
          <button className="btn-primary !py-1.5 !px-3 text-[13px]" disabled={g.coins < c.price} onClick={() => { click(); g.buyCage(c.id); }}>
            Купить
          </button>
        ),
      );
    });
  } else if (cat === 'themes') {
    content = THEMES.map((t) => {
      const owned = g.ownedThemes.includes(t.id);
      const active = g.theme === t.id;
      return (
        <div key={t.id} className="rounded-2xl bg-cream-100 border border-cream-200 p-3 flex gap-3 items-center">
          <div className="w-12 h-12 rounded-xl overflow-hidden grid grid-cols-2 shrink-0 border border-cream-300">
            <div style={{ background: t.wall }} />
            <div style={{ background: t.floor }} />
            <div style={{ background: t.rug }} />
            <div style={{ background: t.accent }} />
          </div>
          <div className="flex-1">
            <div className="font-extrabold text-cocoa-800 text-[14px]">{t.name}</div>
            <div className="text-[12px] text-cocoa-500">{t.desc}</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {!owned && <div className="font-extrabold text-cocoa-700 text-[14px]">{t.price} 🪙</div>}
            {active ? (
              <span className="text-[12px] font-bold text-sage-600">Сейчас</span>
            ) : owned ? (
              <button className="btn-soft !py-1.5 !px-3 text-[13px]" onClick={() => { click(); g.setTheme(t.id); }}>
                Выбрать
              </button>
            ) : (
              <button className="btn-primary !py-1.5 !px-3 text-[13px]" disabled={g.coins < t.price} onClick={() => { click(); g.buyTheme(t.id); }}>
                Купить
              </button>
            )}
          </div>
        </div>
      );
    });
  } else if (cat === 'upgrades') {
    const can = cageDef(g.cage.cageId).canSecondFloor;
    const owned = !!g.inventory.upgrade_floor2;
    content = card(
      'upgrade_floor2',
      'Расширение до 2 этажа',
      'Полноценный второй ярус с полкой и лесенкой-пандусом, новые слоты для домиков; гамаки над полкой — прямо у крысок под носом.',
      owned ? 0 : SECOND_FLOOR_PRICE,
      owned ? (
        <span className="text-[12px] font-bold text-sage-600">{g.cage.secondFloor ? 'Построен' : 'Куплен'}</span>
      ) : (
        <button className="btn-primary !py-1.5 !px-3 text-[13px]" disabled={!can || g.coins < SECOND_FLOOR_PRICE} onClick={() => { click(); g.buySecondFloor(); }}>
          Построить
        </button>
      ),
      can ? undefined : 'Недоступно в выгульном манеже',
    );
  }

  return (
    <Modal
      title={
        <span>
          🛒 Магазин <span className="text-base text-cocoa-500 font-bold ml-1">🪙 {g.coins}</span>
        </span>
      }
      onClose={() => set({ panel: null })}
      wide
    >
      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
        {CATS.map((c) => (
          <button key={c} className={`chip shrink-0 ${cat === c ? 'bg-cocoa-600 text-white border-cocoa-600' : 'bg-cream-100 border-cream-300 text-cocoa-700'}`} onClick={() => { click(); setCat(c); }}>
            {CAT_ICON[c]} {CATEGORY_NAMES[c]}
          </button>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-2 mt-1">{content}</div>
      {['houses', 'hammocks', 'tunnels', 'toys', 'care'].includes(cat) && (
        <p className="text-[12px] text-cocoa-500 mt-3">Купленные предметы появляются на складе. Поставь их в клетку через «Обустройство» 🪑.</p>
      )}
    </Modal>
  );
}
