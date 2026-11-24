import { useEffect, useMemo, useState } from 'react';
import type { Appearance, ColorId, EarType, CoatType, EyeId, OriginId, PatternId, PersonalityId, Sex } from '../../store/types';
import { COLORS, PATTERNS, PRESETS, EYES, DEFAULT_PRESET, allowedEyes, appearanceFromPreset, describeCoat, matchPreset } from '../../store/data/coats';
import { PERSONALITIES, personalityName, randomName } from '../../store/data/personalities';
import { bodyScale, randomPersonality } from '../../store/life';
import { ADOPT_COST, useGame } from '../../store/gameStore';
import { cageDef } from '../../store/data/items';
import { RatAvatar, Segmented, click, engine } from '../components/common';

interface OriginDef {
  id: Exclude<OriginId, 'born'>;
  title: string;
  icon: string;
  desc: string;
  age: number;
  meet: string;
}

export const ORIGINS: OriginDef[] = [
  { id: 'shelter', title: 'Центр пристройства домашних крыс', icon: '🏡', desc: 'Взрослые крыски, которые ждут свою семью. Уже знакомы с людьми и очень благодарны.', age: 6, meet: 'Волонтёр центра аккуратно приносит переноску:' },
  { id: 'breeder', title: 'Ответственный заводчик', icon: '🎀', desc: 'Здоровые, социализированные малыши с известной родословной.', age: 2, meet: 'Заводчица показывает малыша из нового помёта:' },
  { id: 'petshop', title: 'Зоомагазин', icon: '🛍️', desc: 'Молодые крыски, которым особенно нужны забота и терпение.', age: 2, meet: 'Продавец достаёт из витрины любопытную мордочку:' },
];

export function Adoption({ onDone, more }: { onDone: () => void; more?: boolean }) {
  const g = useGame();
  const [origin, setOrigin] = useState<OriginDef | null>(null);
  const [app, setApp] = useState<Appearance>(() => appearanceFromPreset(DEFAULT_PRESET));
  const [sex, setSex] = useState<Sex>('f');
  const [name, setName] = useState(() => randomName('f', g.rats.map((r) => r.name)));
  const [pers, setPers] = useState<PersonalityId>(() => randomPersonality());
  const [tab, setTab] = useState<'presets' | 'custom' | 'about'>('presets');

  const age = origin?.age ?? 2;
  const scale = bodyScale({ ageMonths: age, sex });

  useEffect(() => {
    if (!origin) return;
    const e = engine();
    e.showPreview(app, scale);
    e.setCamMode('showcase', null, false);
  }, [origin, app, scale]);

  useEffect(() => {
    return () => {
      const e = engine();
      e.hidePreview();
      e.setCamMode('overview');
    };
  }, []);

  const eyes = useMemo(() => allowedEyes(app.color, app.pattern), [app.color, app.pattern]);
  const update = (p: Partial<Appearance>) => {
    setApp((a) => {
      const n = { ...a, ...p };
      const al = allowedEyes(n.color, n.pattern);
      if (!al.includes(n.eyes)) n.eyes = al[0];
      n.preset = matchPreset(n)?.id ?? null;
      return n;
    });
  };

  const cost = more ? ADOPT_COST[origin?.id ?? 'shelter'] : 0;
  const cap = cageDef(g.cage.cageId).capacity;
  const full = g.rats.filter((r) => r.alive).length >= cap;

  const confirm = () => {
    if (!origin) return;
    click();
    const r = g.adopt({ name, sex, appearance: app, personality: pers, origin: origin.id, ageMonths: origin.age }, !more);
    if (r) onDone();
  };

  if (!origin) {
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center bg-cocoa-800/20 safe-top safe-bottom safe-left safe-right">
        <div className="glass animate-pop rounded-3xl max-w-3xl w-full p-5 max-h-full scroll-y">
          <div className="panel-title text-center mb-1">{more ? 'Новый питомец' : 'Откуда ты заберёшь первую крыску?'}</div>
          <p className="text-center text-cocoa-500 text-[14px] mb-4">Каждая крыска — особенная. Выбери, где вы познакомитесь.</p>
          {more && full && <p className="text-center text-rose-700 font-bold mb-3">В клетке уже {cap} крысок — для новых нужна клетка побольше.</p>}
          <div className="grid gap-3 sm:grid-cols-3">
            {ORIGINS.map((o) => (
              <button
                key={o.id}
                disabled={more && full}
                className="rounded-3xl bg-cream-100 border border-cream-300 p-4 text-left active:scale-[0.98] transition disabled:opacity-50"
                onClick={() => {
                  click();
                  setOrigin(o);
                }}
              >
                <div className="text-4xl mb-2">{o.icon}</div>
                <div className="font-extrabold text-cocoa-800 leading-tight mb-1">{o.title}</div>
                <div className="text-[13px] text-cocoa-500 leading-snug">{o.desc}</div>
                <div className="mt-2 text-[12px] font-bold text-cocoa-600">Возраст: ~{o.age} мес.{more ? ` · ${ADOPT_COST[o.id]} 🪙` : ''}</div>
              </button>
            ))}
          </div>
          {more && (
            <div className="text-center mt-4">
              <button className="btn-soft" onClick={onDone}>
                Отмена
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-30 pointer-events-none flex justify-end items-stretch safe-top safe-bottom safe-right">
      <div className="pointer-events-auto glass animate-pop rounded-3xl w-full max-w-[430px] sm:mr-2 flex flex-col max-h-full self-end sm:self-stretch">
        <div className="px-4 pt-3">
          <div className="text-[13px] text-cocoa-500">{origin.meet}</div>
          <div className="flex items-center gap-2 mt-1">
            <RatAvatar a={app} size={40} />
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 20))}
              className="flex-1 min-w-0 text-xl font-extrabold text-cocoa-800 bg-cream-100 rounded-xl px-3 py-1.5 border border-cream-300 outline-none focus:border-berry-400"
              placeholder="Имя"
            />
            <button className="btn-soft !px-2.5" title="Случайное имя" onClick={() => { click(); setName(randomName(sex, g.rats.map((r) => r.name))); }}>
              🎲
            </button>
          </div>
          <div className="text-[13px] text-cocoa-600 mt-1 font-bold">{describeCoat(app)}</div>
          <div className="flex gap-1.5 mt-2">
            {(['presets', 'custom', 'about'] as const).map((t) => (
              <button key={t} className={`chip flex-1 ${tab === t ? 'bg-cocoa-600 text-white border-cocoa-600' : 'bg-cream-100 border-cream-300 text-cocoa-700'}`} onClick={() => { click(); setTab(t); }}>
                {t === 'presets' ? 'Окрасы' : t === 'custom' ? 'Конструктор' : 'Характер'}
              </button>
            ))}
          </div>
        </div>
        <div className="scroll-y px-4 py-3 flex-1 min-h-0">
          {tab === 'presets' && (
            <div className="grid grid-cols-3 gap-2">
              {PRESETS.map((p) => {
                const a = appearanceFromPreset(p.id, { ears: app.ears, coat: app.coat, seed: app.seed });
                const sel = app.preset === p.id;
                return (
                  <button
                    key={p.id}
                    className={`rounded-2xl p-1.5 flex flex-col items-center text-center border transition active:scale-95 ${sel ? 'bg-berry-400/15 border-berry-400' : 'bg-cream-100 border-cream-200'}`}
                    onClick={() => {
                      click();
                      setApp(a);
                    }}
                  >
                    <RatAvatar a={a} size={46} ring={sel} />
                    <div className="text-[11px] leading-tight font-bold text-cocoa-700 mt-1">
                      <span className="text-cocoa-400">{p.num}. </span>
                      {p.name}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {tab === 'custom' && (
            <div className="space-y-3">
              <Field label="Цвет шерсти">
                <div className="flex flex-wrap gap-1.5">
                  {COLORS.map((c) => (
                    <button
                      key={c.id}
                      title={c.name}
                      onClick={() => { click(); update({ color: c.id as ColorId }); }}
                      className={`w-9 h-9 rounded-full border-2 ${app.color === c.id ? 'border-berry-500 scale-110' : 'border-cream-300'}`}
                      style={{ background: c.hex }}
                    />
                  ))}
                </div>
                <div className="text-[12px] text-cocoa-500 mt-1">{COLORS.find((c) => c.id === app.color)?.name}</div>
              </Field>
              <Field label="Рисунок (маркировка)">
                <Segmented value={app.pattern} options={PATTERNS.map((p) => ({ id: p.id, label: p.name }))} onChange={(v) => update({ pattern: v as PatternId })} />
                <div className="text-[12px] text-cocoa-500 mt-1">{PATTERNS.find((p) => p.id === app.pattern)?.desc}</div>
              </Field>
              <Field label="Глаза">
                <Segmented value={app.eyes} options={(Object.keys(EYES) as EyeId[]).filter((e) => eyes.includes(e)).map((e) => ({ id: e, label: EYES[e].name }))} onChange={(v) => update({ eyes: v as EyeId })} />
              </Field>
              <Field label="Ушки">
                <Segmented value={app.ears} options={[{ id: 'standard', label: 'Стандартные' }, { id: 'dumbo', label: 'Дамбо' }]} onChange={(v) => update({ ears: v as EarType })} />
              </Field>
              <Field label="Шерсть">
                <Segmented value={app.coat} options={[{ id: 'smooth', label: 'Гладкая' }, { id: 'rex', label: 'Рекс (волнистая)' }]} onChange={(v) => update({ coat: v as CoatType })} />
              </Field>
              <button className="btn-soft w-full" onClick={() => { click(); update({ seed: Math.floor(Math.random() * 1e9) }); }}>
                ✨ Другой узор пятнышек
              </button>
            </div>
          )}
          {tab === 'about' && (
            <div className="space-y-3">
              <Field label="Пол">
                <Segmented
                  value={sex}
                  options={[{ id: 'f', label: '♀ Самочка' }, { id: 'm', label: '♂ Самец' }]}
                  onChange={(v) => setSex(v as Sex)}
                />
              </Field>
              <Field label="Характер">
                <div className="grid gap-1.5">
                  {PERSONALITIES.map((p) => (
                    <button
                      key={p.id}
                      className={`rounded-2xl px-3 py-2 text-left border ${pers === p.id ? 'bg-berry-400/15 border-berry-400' : 'bg-cream-100 border-cream-200'}`}
                      onClick={() => { click(); setPers(p.id); }}
                    >
                      <div className="font-extrabold text-cocoa-800 text-[14px]">{personalityName(p.id, sex)}</div>
                      <div className="text-[12px] text-cocoa-500 leading-snug">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          )}
        </div>
        <div className="px-4 py-3 border-t border-cream-200 flex gap-2">
          <button className="btn-soft" onClick={() => { click(); setOrigin(null); }}>
            ← Назад
          </button>
          <button className="btn-primary flex-1" disabled={!name.trim() || (more && g.coins < cost)} onClick={confirm}>
            {more ? `Забрать домой · ${cost} 🪙` : 'Забрать домой 💕'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[13px] font-extrabold text-cocoa-600 mb-1.5 uppercase tracking-wide">{label}</div>
      {children}
    </div>
  );
}
