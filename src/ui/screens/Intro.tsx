import { useEffect, useState } from 'react';
import { INTRO_DURATION } from '../../engine/Engine';
import { click, engine } from '../components/common';

const CAPTIONS: { from: number; to: number; text: string }[] = [
  { from: 0.5, to: 5.8, text: 'Тихое утро. Солнце заглядывает в окно…' },
  { from: 6.2, to: 11.8, text: 'Здесь всё уже готово к новоселью.' },
  { from: 12.2, to: 17.8, text: 'Домик, миска, мягкая подстилка — и много места для игр.' },
  { from: 18.2, to: 23.6, text: 'Не хватает только самого главного — маленьких хозяев.' },
];

/** Вступительная кат-сцена с кнопкой «Пропустить» */
export function Intro({ onDone }: { onDone: () => void }) {
  const [t, setT] = useState(0);
  const [card, setCard] = useState(false);

  useEffect(() => {
    const e = engine();
    e.playIntro(() => setCard(true));
    const off = e.onFrame(() => setT(e.introTime));
    return () => {
      off();
    };
  }, []);

  useEffect(() => {
    if (t > 24.5 && !card) setCard(true);
  }, [t, card]);

  const cap = CAPTIONS.find((c) => t >= c.from && t <= c.to);
  const finish = () => {
    click();
    const e = engine();
    if (e.introTime >= 0) e.skipIntro();
    onDone();
  };

  return (
    <div className="absolute inset-0 z-30 safe-top safe-bottom safe-left safe-right pointer-events-none">
      {/* кинематографичные полосы */}
      <div className="absolute inset-x-0 top-0 h-[9%] bg-black/80" />
      <div className="absolute inset-x-0 bottom-0 h-[9%] bg-black/80" />
      {cap && !card && (
        <div key={cap.text} className="absolute inset-x-0 bottom-[13%] flex justify-center px-6">
          <div className="animate-fade rounded-2xl bg-black/45 text-cream-50 px-5 py-2.5 text-[17px] sm:text-xl font-bold text-center max-w-2xl">{cap.text}</div>
        </div>
      )}
      {card && (
        <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-auto bg-cocoa-800/40">
          <div className="animate-fade flex flex-col items-center gap-3 max-h-full">
            <img src="./dedication.jpg" alt="Посвящается: Тимме, Жоржу, Васе, Элвину" className="rounded-3xl shadow-soft max-h-[68vh] w-auto object-contain border-4 border-cream-50" />
            <button className="btn-primary text-lg px-6" onClick={finish}>
              Начать 💕
            </button>
          </div>
        </div>
      )}
      {!card && (
        <div className="absolute top-[10%] right-3 pointer-events-auto">
          <button
            className="btn-soft bg-cream-50/80"
            onClick={() => {
              click();
              const e = engine();
              if (e.introTime >= 0) e.skipIntro();
              setCard(true);
            }}
          >
            Пропустить ⏭
          </button>
        </div>
      )}
      {!card && (
        <div className="absolute bottom-[10%] left-1/2 -translate-x-1/2 w-40 h-1 rounded-full bg-white/30 overflow-hidden">
          <div className="h-full bg-white/80" style={{ width: `${Math.min(100, (t / INTRO_DURATION) * 100)}%` }} />
        </div>
      )}
    </div>
  );
}
