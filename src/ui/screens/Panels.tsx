import { useEffect, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { useUi } from '../uiStore';
import { Modal, RatAvatar, StatBar, click, engine } from '../components/common';
import { describeAppearanceFull, describeCoat } from '../../store/data/coats';
import { personalityDef, personalityName, TRICKS } from '../../store/data/personalities';
import { formatAge, stageName } from '../../store/life';
import { FOODS } from '../../store/data/items';
import type { RatData, TrickId } from '../../store/types';
import { ORIGINS } from './Adoption';
import { bus } from '../../store/bus';
import { ACHIEVEMENTS, DAILY_POOL, STORY_QUESTS } from '../../store/data/quests';

const TOY_NAMES: Record<string, string> = {
  house: 'Домики',
  hammock: 'Гамаки',
  tunnel: 'Туннели',
  ball: 'Мячики',
  forage: 'Фуражилка',
  wheel: 'Беговое колесо',
  ladder: 'Канаты и лесенки',
  feather: 'Пёрышко',
  food: 'Миска',
};

function originName(r: RatData): string {
  if (r.origin === 'born') return r.sex === 'm' ? 'Родился дома' : 'Родилась дома';
  return ORIGINS.find((o) => o.id === r.origin)?.title ?? '';
}

export function PetCard() {
  const selected = useUi((s) => s.selected);
  const set = useUi((s) => s.set);
  const g = useGame();
  const r = g.rats.find((x) => x.id === selected && x.alive);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(r?.name ?? '');
  const [confirmRehome, setConfirmRehome] = useState(false);
  if (!r) return null;
  const p = personalityDef(r.personality);
  const fav = Object.entries(r.toyLove)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);
  const favList = fav.length ? fav : p.favToys;
  const family = g.family;
  const parentNames = r.parents?.map((id) => family.find((f) => f.id === id)?.name ?? '—');
  const children = family.filter((f) => f.parents?.includes(r.id));
  const showFamily = g.settings.breeding || r.parents || children.length > 0;
  const close = () => set({ panel: null });

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <RatAvatar a={r.appearance} size={34} />
          {renaming ? (
            <form
              className="flex gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                g.rename(r.id, name);
                setRenaming(false);
              }}
            >
              <input autoFocus value={name} onChange={(e) => setName(e.target.value.slice(0, 20))} className="w-36 text-lg font-extrabold bg-cream-100 rounded-xl px-2 py-0.5 border border-cream-300 outline-none" />
              <button className="btn-primary !py-1 !px-2 text-sm">OK</button>
            </form>
          ) : (
            <>
              <span>{r.name}</span>
              <button className="text-base" onClick={() => { click(); setName(r.name); setRenaming(true); }} title="Переименовать">
                ✏️
              </button>
            </>
          )}
        </div>
      }
      onClose={close}
      wide
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2 text-[14px]">
          <Row k="Пол" v={r.sex === 'm' ? '♂ Самец' : '♀ Самочка'} />
          <Row k="Возраст" v={`${formatAge(r.ageMonths)} · ${stageName(r.ageMonths, r.sex)}`} />
          <Row k="Окрас" v={describeCoat(r.appearance)} />
          <Row k="Внешность" v={describeAppearanceFull(r.appearance).split(', ').slice(1).join(', ')} />
          <Row k="Откуда" v={originName(r)} />
          <div className="rounded-2xl bg-cream-100 p-3">
            <div className="font-extrabold text-cocoa-800">Характер: {personalityName(r.personality, r.sex)}</div>
            <div className="text-[13px] text-cocoa-500 leading-snug mt-0.5">{p.desc}</div>
          </div>
          <div>
            <div className="font-extrabold text-cocoa-700 mb-1">Любимые игрушки</div>
            <div className="flex flex-wrap gap-1.5">
              {favList.map((t) => (
                <span key={t} className="chip bg-sage-400/20 border-sage-400 text-sage-600">
                  {TOY_NAMES[t] ?? t}
                </span>
              ))}
            </div>
          </div>
          {r.pregnantUntil && <div className="rounded-2xl bg-pink-50 p-2 text-[13px] font-bold text-berry-600">💞 Скоро появятся крысята</div>}
          {r.sick && <div className="rounded-2xl bg-amber-50 p-2 text-[13px] font-bold text-amber-800">🤧 Лёгкая простуда — дай витаминные капли и освежи подстилку</div>}
        </div>
        <div className="space-y-2.5">
          <StatBar label="Сытость" value={r.stats.satiety} color="#e0a458" icon="🍎" />
          <StatBar label="Здоровье" value={r.stats.health} color="#6f9a6a" icon="🩺" />
          <StatBar label="Комфорт" value={r.stats.comfort} color="#8fa9d6" icon="🛏️" />
          <StatBar label="Доверие к тебе" value={r.stats.trust} color="#c85676" icon="💗" />
          <div className="pt-1">
            <div className="font-extrabold text-cocoa-700 mb-1">Трюки</div>
            <div className="space-y-1">
              {TRICKS.map((t) => {
                const v = r.tricks[t.id] ?? 0;
                return (
                  <div key={t.id} className="flex items-center gap-2 text-[13px]">
                    <span className="w-28 font-bold text-cocoa-700">{v >= 1 ? '⭐' : '▫️'} {t.name}</span>
                    <div className="flex-1 h-2 rounded-full bg-cream-200 overflow-hidden">
                      <div className="h-full bg-berry-400" style={{ width: `${Math.round(v * 100)}%` }} />
                    </div>
                    <span className="w-14 text-right text-cocoa-500 font-bold">{v >= 1 ? 'изучен' : `${Math.round(v * 100)}%`}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <button className="btn-soft !py-1.5 text-[13px]" onClick={() => { click(); g.vitamins(r.id); }}>
              💧 Витамины ({g.inventory.care_vitamins ?? 0})
            </button>
            {!g.settings.comfortMode && (
              <button className="btn-soft !py-1.5 text-[13px]" onClick={() => { click(); g.vet(r.id); }}>
                🩺 Ветеринар · 80 🪙
              </button>
            )}
            {g.rats.filter((x) => x.alive).length > 1 &&
              (confirmRehome ? (
                <button className="btn !py-1.5 text-[13px] bg-rose-100 text-rose-800" onClick={() => { click(); g.rehome(r.id); set({ panel: null, selected: null }); }}>
                  Точно отдать в добрые руки?
                </button>
              ) : (
                <button className="btn-ghost !py-1.5 text-[13px]" onClick={() => { click(); setConfirmRehome(true); }}>
                  🏡 Пристроить
                </button>
              ))}
          </div>
        </div>
      </div>
      {showFamily && (
        <div className="mt-4 rounded-2xl bg-cream-100 p-3">
          <div className="font-extrabold text-cocoa-800 mb-1">🌳 Семейная история</div>
          <div className="text-[13px] text-cocoa-600 space-y-0.5">
            <div>Поколение: {r.generation}</div>
            <div>Родители: {parentNames ? parentNames.join(' и ') : 'неизвестны (основатель семьи)'}</div>
            <div>Дети: {children.length ? children.map((c) => c.name + (c.diedAt ? ' 🌈' : '')).join(', ') : 'пока нет'}</div>
          </div>
          <button className="btn-ghost !px-0 text-[13px] mt-1" onClick={() => { click(); set({ panel: 'family' }); }}>
            Вся родословная →
          </button>
        </div>
      )}
    </Modal>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-cocoa-500 w-24 shrink-0">{k}</span>
      <span className="font-bold text-cocoa-800">{v}</span>
    </div>
  );
}

export function FamilyPanel() {
  const family = useGame((s) => s.family);
  const rats = useGame((s) => s.rats);
  const set = useUi((s) => s.set);
  const byGen = new Map<number, typeof family>();
  for (const f of family) {
    const arr = byGen.get(f.generation) ?? [];
    arr.push(f);
    byGen.set(f.generation, arr);
  }
  const gens = [...byGen.keys()].sort((a, b) => a - b);
  return (
    <Modal title="🌳 Родословная" onClose={() => set({ panel: 'card' })} wide>
      {gens.map((g) => (
        <div key={g} className="mb-3">
          <div className="font-extrabold text-cocoa-700 mb-1">Поколение {g}</div>
          <div className="flex flex-wrap gap-2">
            {byGen.get(g)!.map((f) => {
              const live = rats.find((r) => r.id === f.id && r.alive);
              const parents = f.parents?.map((id) => family.find((x) => x.id === id)?.name ?? '?').join(' + ');
              return (
                <div key={f.id} className="rounded-2xl bg-cream-100 border border-cream-200 px-3 py-2 text-[13px] min-w-[150px]">
                  <div className="font-extrabold text-cocoa-800">
                    {f.sex === 'm' ? '♂' : '♀'} {f.name} {f.diedAt ? '🌈' : live ? '' : '🏡'}
                  </div>
                  <div className="text-cocoa-500 leading-snug">{f.appearanceText.split(',')[0]}</div>
                  {parents && <div className="text-cocoa-400">от {parents}</div>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </Modal>
  );
}

export function TreatPicker() {
  const selected = useUi((s) => s.selected);
  const set = useUi((s) => s.set);
  const g = useGame();
  const r = g.rats.find((x) => x.id === selected && x.alive);
  if (!r) return null;
  const treats = FOODS.filter((f) => !f.bowl);
  return (
    <Modal title={`Угостить: ${r.name}`} onClose={() => set({ panel: null })}>
      <div className="grid grid-cols-2 gap-2">
        {treats.map((f) => {
          const n = g.inventory[f.id] ?? 0;
          return (
            <button
              key={f.id}
              disabled={n <= 0}
              className="rounded-2xl bg-cream-100 border border-cream-200 p-3 text-left disabled:opacity-45 active:scale-95 transition"
              onClick={() => {
                click();
                if (g.treat(r.id, f.id)) {
                  set({ panel: null });
                  engine().setCamMode('pet');
                }
              }}
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full border border-cream-300" style={{ background: f.color }} />
                <span className="font-extrabold text-cocoa-800 text-[14px]">{f.name}</span>
              </div>
              <div className="text-[12px] text-cocoa-500 mt-1">В запасе: {n}</div>
            </button>
          );
        })}
      </div>
      <p className="text-[12px] text-cocoa-500 mt-3">Крыска подбежит к передней стенке, возьмёт угощение лапками и съест — доверие вырастет.</p>
    </Modal>
  );
}

export function TricksPanel() {
  const selected = useUi((s) => s.selected);
  const set = useUi((s) => s.set);
  const g = useGame();
  const r = g.rats.find((x) => x.id === selected && x.alive);
  if (!r) return null;
  const startTrain = (t: TrickId) => {
    click();
    engine().world.startMode('train', r.id);
    engine().setCamMode('pet');
    set({ panel: null, mode: 'train', trainTrick: t });
  };
  return (
    <Modal title={`Трюки: ${r.name}`} onClose={() => set({ panel: null })}>
      <div className="space-y-2">
        {TRICKS.map((t) => {
          const v = r.tricks[t.id] ?? 0;
          const learned = v >= 1;
          const locked = r.stats.trust < t.minTrust;
          return (
            <div key={t.id} className="rounded-2xl bg-cream-100 border border-cream-200 p-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="font-extrabold text-cocoa-800">
                  {learned ? '⭐ ' : ''}
                  {t.name}
                </div>
                <div className="text-[12px] text-cocoa-500">{t.desc}</div>
                {!learned && (
                  <div className="h-1.5 mt-1.5 rounded-full bg-cream-200 overflow-hidden">
                    <div className="h-full bg-berry-400" style={{ width: `${v * 100}%` }} />
                  </div>
                )}
                {locked && <div className="text-[12px] font-bold text-amber-700 mt-1">Нужно доверие {t.minTrust}+ (сейчас {Math.round(r.stats.trust)})</div>}
              </div>
              {learned ? (
                <button
                  className="btn-primary !py-1.5"
                  onClick={() => {
                    click();
                    bus.emit('worldTrick', { ratId: r.id, trick: t.id });
                    engine().setCamMode('pet');
                    set({ panel: null });
                  }}
                >
                  Показать
                </button>
              ) : (
                <button className="btn-soft !py-1.5" disabled={locked} onClick={() => startTrain(t.id)}>
                  Учить
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[12px] text-cocoa-500 mt-3">Совет: учить трюки удобнее с ласковыми крысками и лакомками. Занятия укрепляют доверие.</p>
    </Modal>
  );
}

export function QuestsPanel() {
  const set = useUi((s) => s.set);
  const [tab, setTab] = useState<'story' | 'daily' | 'ach'>('daily');
  return (
    <Modal title="📜 Задания" onClose={() => set({ panel: null })}>
      <div className="flex gap-1.5 mb-3">
        {(
          [
            ['daily', 'Сегодня'],
            ['story', 'История'],
            ['ach', 'Достижения'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className={`chip flex-1 ${tab === id ? 'bg-cocoa-600 text-white border-cocoa-600' : 'bg-cream-100 border-cream-300 text-cocoa-700'}`} onClick={() => { click(); setTab(id); }}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'daily' && <QuestList kind="daily" />}
      {tab === 'story' && <QuestList kind="story" />}
      {tab === 'ach' && <Achievements />}
    </Modal>
  );
}


function QuestList({ kind }: { kind: 'story' | 'daily' }) {
  const g = useGame();
  const list = kind === 'story' ? g.storyQuests : g.daily.quests;
  const defs = kind === 'story' ? STORY_QUESTS : DAILY_POOL;
  return (
    <div className="space-y-2">
      {list.map((q, i) => {
        const d = defs.find((x) => x.id === q.id);
        if (!d) return null;
        const locked = kind === 'story' && i > g.storyIndex;
        return (
          <div key={q.id} className={`rounded-2xl border p-3 flex items-center gap-3 ${q.claimed ? 'bg-cream-100/60 border-cream-200 opacity-70' : 'bg-cream-100 border-cream-200'}`}>
            <div className="text-xl">{q.claimed ? '✅' : q.done ? '🎁' : locked ? '🔒' : '🐾'}</div>
            <div className="flex-1 min-w-0">
              <div className="font-extrabold text-cocoa-800 text-[14px]">{d.title}</div>
              {!locked && !q.claimed && <div className="text-[12px] text-cocoa-500 leading-snug">{d.hint}</div>}
              <div className="text-[12px] font-bold text-cocoa-600 mt-0.5">
                {Math.min(q.progress, d.target)}/{d.target} · +{d.reward} 🪙
              </div>
            </div>
            {q.done && !q.claimed && (
              <button className="btn-primary !py-1.5" onClick={() => { click(); g.claimQuest(kind, q.id); }}>
                Забрать
              </button>
            )}
          </div>
        );
      })}
      {kind === 'daily' && <p className="text-[12px] text-cocoa-500">Новые ежедневные задания появляются каждый день.</p>}
    </div>
  );
}

function Achievements() {
  const got = useGame((s) => s.achievements);
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      {ACHIEVEMENTS.map((a) => (
        <div key={a.id} className={`rounded-2xl border p-3 ${got[a.id] ? 'bg-violet-50 border-violet-200' : 'bg-cream-100 border-cream-200 opacity-75'}`}>
          <div className="font-extrabold text-cocoa-800 text-[14px]">
            {got[a.id] ? '🏆' : '🔸'} {a.title}
          </div>
          <div className="text-[12px] text-cocoa-500">{a.desc}</div>
          <div className="text-[12px] font-bold text-cocoa-600 mt-0.5">+{a.reward} 🪙</div>
        </div>
      ))}
    </div>
  );
}

export function DedicationPanel() {
  const set = useUi((s) => s.set);
  return (
    <Modal title="Посвящение" onClose={() => set({ panel: null })} wide>
      <img src="./dedication.jpg" alt="Посвящается: Тимме, Жоржу, Васе, Элвину" className="w-full rounded-2xl" />
      <p className="text-center text-cocoa-600 text-[14px] mt-3">Эта игра посвящается Тимме, Жоржу, Васе и Элвину 💕</p>
    </Modal>
  );
}

export function WelcomeBack({ minutes, lines, onClose }: { minutes: number; lines: string[]; onClose: () => void }) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const away = h > 24 ? `${Math.floor(h / 24)} дн.` : h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
  useEffect(() => {
    bus.emit('sound', { name: 'squeak' });
  }, []);
  return (
    <Modal title="С возвращением! 🐀" onClose={onClose} footer={<button className="btn-primary w-full" onClick={() => { click(); onClose(); }}>К крыскам!</button>}>
      <p className="text-cocoa-600 mb-2">Тебя не было {away}. Вот что произошло:</p>
      <ul className="space-y-1.5">
        {lines.map((l, i) => (
          <li key={i} className="rounded-xl bg-cream-100 px-3 py-2 text-[14px] text-cocoa-700">
            {l}
          </li>
        ))}
      </ul>
    </Modal>
  );
}

