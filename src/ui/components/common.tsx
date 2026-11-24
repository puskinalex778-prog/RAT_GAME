import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Engine } from '../../engine/Engine';
import type { Appearance } from '../../store/types';
import { colorDef } from '../../store/data/coats';
import { bus } from '../../store/bus';

// ---------------------------------------------------------------- движок

let engineInstance: Engine | null = null;
export function setEngine(e: Engine | null) {
  engineInstance = e;
}
export function engine(): Engine {
  if (!engineInstance) throw new Error('engine not ready');
  return engineInstance;
}
export function maybeEngine(): Engine | null {
  return engineInstance;
}

export function click() {
  bus.emit('sound', { name: 'click' });
}

// ---------------------------------------------------------------- модальное окно

export function Modal({
  title,
  onClose,
  children,
  wide,
  footer,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  footer?: ReactNode;
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-cocoa-800/25 safe-top safe-bottom safe-left safe-right" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`glass animate-pop rounded-3xl flex flex-col max-h-full w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} overflow-hidden`}>
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-cream-200">
          <div className="panel-title truncate">{title}</div>
          <button className="btn-ghost text-2xl w-10 h-10 !p-0" onClick={() => { click(); onClose(); }} aria-label="Закрыть">
            ✕
          </button>
        </div>
        <div className="scroll-y px-4 py-3 flex-1 min-h-0">{children}</div>
        {footer && <div className="px-4 py-3 border-t border-cream-200">{footer}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- шкала

export function StatBar({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 text-center text-lg">{icon}</span>
      <div className="flex-1">
        <div className="flex justify-between text-[13px] font-bold text-cocoa-600">
          <span>{label}</span>
          <span>{Math.round(v)}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-cream-200 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${v}%`, background: color }} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- аватар крысы (Canvas2D)

const avatarCache = new Map<string, string>();

export function ratAvatarUrl(a: Appearance): string {
  const key = `${a.color}-${a.pattern}-${a.ears}-${a.eyes}`;
  const ex = avatarCache.get(key);
  if (ex) return ex;
  const cv = document.createElement('canvas');
  cv.width = 96;
  cv.height = 96;
  const ctx = cv.getContext('2d')!;
  const pig = colorDef(a.color).hex;
  const white = a.pattern === 'siamese' ? '#e8dcc6' : '#f3efe7';
  const selfLike = a.pattern === 'self' || a.pattern === 'berkshire';
  const bodyCol = selfLike ? pig : white;
  const headCol = ['self', 'berkshire', 'capped', 'hooded', 'hoodonly', 'variegated'].includes(a.pattern) ? pig : white;
  // фон
  ctx.fillStyle = '#fbf1e1';
  ctx.beginPath();
  ctx.arc(48, 48, 48, 0, Math.PI * 2);
  ctx.fill();
  // уши
  const earR = a.ears === 'dumbo' ? 15 : 11;
  const earY = a.ears === 'dumbo' ? 40 : 30;
  for (const sx of [-1, 1]) {
    ctx.fillStyle = '#e9a8a6';
    ctx.beginPath();
    ctx.arc(48 + sx * (a.ears === 'dumbo' ? 25 : 18), earY, earR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f5c4c2';
    ctx.beginPath();
    ctx.arc(48 + sx * (a.ears === 'dumbo' ? 25 : 18), earY + 1, earR * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // тело
  ctx.fillStyle = bodyCol;
  ctx.beginPath();
  ctx.ellipse(48, 74, 30, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  if (a.pattern === 'stripe' || a.pattern === 'capped' || a.pattern === 'hooded') {
    ctx.fillStyle = pig;
    ctx.beginPath();
    ctx.ellipse(48, 76, 8, 20, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (a.pattern === 'spots' || a.pattern === 'variegated') {
    ctx.fillStyle = pig;
    for (const [x, y, r] of [[34, 72, a.pattern === 'spots' ? 4 : 8], [58, 80, a.pattern === 'spots' ? 3 : 7], [52, 66, 3]]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // голова
  const grad = ctx.createLinearGradient(48, 30, 48, 70);
  grad.addColorStop(0, headCol);
  grad.addColorStop(1, a.pattern === 'siamese' || a.pattern === 'himalayan' ? pig : headCol);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(48, 50, 22, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  if (a.pattern === 'capped') {
    ctx.fillStyle = white;
    ctx.beginPath();
    ctx.ellipse(48, 63, 9, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // глаза
  const eye = a.eyes === 'black' ? '#141010' : a.eyes === 'darkruby' ? '#3a0811' : a.eyes === 'ruby' ? '#8a1022' : '#d0283a';
  for (const sx of [-1, 1]) {
    ctx.fillStyle = eye;
    ctx.beginPath();
    ctx.arc(48 + sx * 10, 48, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(48 + sx * 10 + 1.2, 46.8, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  // нос
  ctx.fillStyle = '#e88f95';
  ctx.beginPath();
  ctx.arc(48, 60, 3, 0, Math.PI * 2);
  ctx.fill();
  const url = cv.toDataURL();
  avatarCache.set(key, url);
  return url;
}

export function RatAvatar({ a, size = 44, ring }: { a: Appearance; size?: number; ring?: boolean }) {
  return (
    <img
      src={ratAvatarUrl(a)}
      width={size}
      height={size}
      alt=""
      draggable={false}
      className={`rounded-full ${ring ? 'ring-4 ring-berry-400' : 'ring-2 ring-cream-200'} shadow-soft`}
    />
  );
}

// ---------------------------------------------------------------- тосты

interface ToastItem {
  id: number;
  text: string;
  kind: string;
}

export function Toasts() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  useEffect(() => {
    return bus.on('toast', ({ text, kind }) => {
      const id = ++idRef.current;
      setItems((s) => [...s.slice(-3), { id, text, kind: kind ?? 'info' }]);
      setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), kind === 'coin' ? 1400 : 3600);
    });
  }, []);
  return (
    <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-16 z-50 flex flex-col items-center gap-1.5 w-[min(92vw,460px)]">
      {items.map((t) => (
        <div
          key={t.id}
          className={`animate-pop rounded-2xl px-4 py-2 text-[14px] font-bold shadow-soft text-center ${
            t.kind === 'coin'
              ? 'bg-amber-100/95 text-amber-800'
              : t.kind === 'warn'
                ? 'bg-rose-50/95 text-rose-800'
                : t.kind === 'achievement'
                  ? 'bg-violet-100/95 text-violet-900'
                  : t.kind === 'quest'
                    ? 'bg-emerald-50/95 text-emerald-800'
                    : 'bg-cream-50/95 text-cocoa-700'
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          className={`chip ${value === o.id ? 'bg-berry-500 text-white border-berry-500' : 'bg-cream-100 text-cocoa-700 border-cream-300'}`}
          onClick={() => {
            click();
            onChange(o.id);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, label, desc }: { on: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <button
      className="w-full flex items-start gap-3 text-left py-2"
      onClick={() => {
        click();
        onChange(!on);
      }}
    >
      <div className="flex-1">
        <div className="font-extrabold text-cocoa-800 text-[15px]">{label}</div>
        {desc && <div className="text-[13px] text-cocoa-500 leading-snug mt-0.5">{desc}</div>}
      </div>
      <div className={`mt-1 w-12 h-7 rounded-full p-0.5 transition ${on ? 'bg-sage-500' : 'bg-cream-300'}`}>
        <div className={`w-6 h-6 rounded-full bg-white shadow transition ${on ? 'translate-x-5' : ''}`} />
      </div>
    </button>
  );
}
