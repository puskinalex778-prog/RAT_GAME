import React, { useState } from 'react';
import { Dices } from 'lucide-react';
import type {
  BaseColorId,
  CoatType,
  EarType,
  EyeColor,
  HeadCapVariant,
  MarkingId,
  RatAppearance,
  RatSex,
} from '../types/game';
import {
  BASE_COLORS,
  COAT_LABELS,
  COAT_PRESETS,
  EAR_LABELS,
  EYE_LABELS,
  HEAD_CAP_LABELS,
  MARKINGS,
  RANDOM_RAT_NAMES_FEMALE,
  RANDOM_RAT_NAMES_MALE,
  getAllowedEyeColors,
} from '../rats/coatPresets';

interface RatCustomizerProps {
  name: string;
  sex: RatSex;
  appearance: RatAppearance;
  onChangeName: (v: string) => void;
  onChangeSex: (v: RatSex) => void;
  onChangeAppearance: (a: RatAppearance) => void;
  compact?: boolean;
}

const BASE_COLOR_KEYS = Object.keys(BASE_COLORS) as BaseColorId[];
const MARKING_KEYS = Object.keys(MARKINGS) as MarkingId[];

export const RatCustomizer: React.FC<RatCustomizerProps> = ({
  name,
  sex,
  appearance,
  onChangeName,
  onChangeSex,
  onChangeAppearance,
  compact = false,
}) => {
  const [tab, setTab] = useState<'presets' | 'custom'>('presets');
  const allowedEyes = getAllowedEyeColors(appearance);

  const pickRandomName = () => {
    const pool = sex === 'male' ? RANDOM_RAT_NAMES_MALE : RANDOM_RAT_NAMES_FEMALE;
    const next = pool[Math.floor(Math.random() * pool.length)];
    onChangeName(next);
  };

  const applyPreset = (presetId: string) => {
    const p = COAT_PRESETS.find((item) => item.id === presetId);
    if (!p) return;
    onChangeAppearance({
      ...appearance,
      presetId: p.id,
      ...p.appearance,
    });
  };

  const patchCustom = (patch: Partial<RatAppearance>) => {
    const next: RatAppearance = {
      ...appearance,
      ...patch,
      presetId: null,
    };
    const nextAllowed = getAllowedEyeColors(next);
    if (!nextAllowed.includes(next.eyeColor)) {
      next.eyeColor = nextAllowed[0];
    }
    onChangeAppearance(next);
  };

  const showHeadCapChoice =
    appearance.marking === 'back_stripe' || appearance.presetId === 'white_gray_back_stripe';

  return (
    <div className="space-y-3 text-[#3B332B]">
      {/* Name & Sex row */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex-1 min-w-[160px] flex items-center gap-1.5 bg-white/90 border border-[#D8CEBC] rounded-xl px-2.5 py-1.5">
          <input
            type="text"
            value={name}
            maxLength={18}
            onChange={(e) => onChangeName(e.target.value)}
            placeholder="Имя крыски..."
            className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-[#A39686]"
          />
          <button
            type="button"
            onClick={pickRandomName}
            title="Случайное имя"
            className="p-1 rounded-lg bg-[#EFE7D8] hover:bg-[#E4D9C4] text-[#5C4F42] active:scale-95 transition"
          >
            <Dices className="w-4 h-4" />
          </button>
        </div>

        <div className="flex bg-[#EFE7D8] p-1 rounded-xl border border-[#DDD2BE]">
          {(['female', 'male'] as RatSex[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChangeSex(s)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                sex === s
                  ? 'bg-[#6E8572] text-white shadow-sm'
                  : 'text-[#6B5F52] hover:text-[#3B332B]'
              }`}
            >
              {s === 'female' ? '♀ Самка' : '♂ Самец'}
            </button>
          ))}
        </div>
      </div>

      {/* Mode toggle: 20 Presets vs Custom Base+Marking */}
      <div className="flex gap-1.5 bg-[#EFE7D8] p-1 rounded-xl border border-[#DDD2BE]">
        <button
          type="button"
          onClick={() => setTab('presets')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
            tab === 'presets' ? 'bg-white text-[#3B332B] shadow-sm' : 'text-[#6E6254]'
          }`}
        >
          20 готовых окрасов
        </button>
        <button
          type="button"
          onClick={() => setTab('custom')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
            tab === 'custom' ? 'bg-white text-[#3B332B] shadow-sm' : 'text-[#6E6254]'
          }`}
        >
          Своя комбинация
        </button>
      </div>

      {tab === 'presets' ? (
        <div
          className={`grid ${
            compact ? 'grid-cols-4 sm:grid-cols-5 max-h-44' : 'grid-cols-3 sm:grid-cols-4 max-h-56'
          } gap-2 overflow-y-auto cozy-scroll pr-1`}
        >
          {COAT_PRESETS.map((preset) => {
            const active = appearance.presetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.id)}
                className={`flex flex-col items-center p-1.5 rounded-xl border text-center transition active:scale-95 ${
                  active
                    ? 'bg-[#EAF1EB] border-[#5E7A63] ring-2 ring-[#6E8572]/40'
                    : 'bg-white/85 border-[#E2D8C5] hover:bg-white'
                }`}
              >
                <img
                  src={preset.icon}
                  alt={preset.name}
                  className="w-12 h-12 object-contain pointer-events-none"
                  loading="lazy"
                />
                <span className="text-[10px] leading-tight font-semibold mt-0.5 line-clamp-2 text-[#3D342B]">
                  {preset.index}. {preset.name}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2.5 bg-white/75 rounded-xl p-2.5 border border-[#E2D8C5]">
          <div>
            <div className="text-[11px] font-bold text-[#6E6254] mb-1">Базовый цвет шерсти</div>
            <div className="flex flex-wrap gap-1.5">
              {BASE_COLOR_KEYS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => patchCustom({ baseColor: c })}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold border transition ${
                    appearance.baseColor === c
                      ? 'bg-[#EAF1EB] border-[#5E7A63]'
                      : 'bg-white border-[#E2D8C5]'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full border border-black/15"
                    style={{ backgroundColor: BASE_COLORS[c].primary }}
                  />
                  {BASE_COLORS[c].name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold text-[#6E6254] mb-1">Рисунок (маркировка)</div>
            <div className="flex flex-wrap gap-1.5">
              {MARKING_KEYS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => patchCustom({ marking: m })}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition ${
                    appearance.marking === m
                      ? 'bg-[#EAF1EB] border-[#5E7A63]'
                      : 'bg-white border-[#E2D8C5]'
                  }`}
                >
                  {MARKINGS[m].short}
                </button>
              ))}
            </div>
          </div>

          {appearance.marking !== 'solid' && appearance.marking !== 'berkshire' && (
            <div>
              <div className="text-[11px] font-bold text-[#6E6254] mb-1">Цвет рисунка / полосы</div>
              <div className="flex flex-wrap gap-1.5">
                {BASE_COLOR_KEYS.filter((k) => k !== 'white').map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => patchCustom({ markingColor: c })}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition ${
                      appearance.markingColor === c
                        ? 'bg-[#EAF1EB] border-[#5E7A63]'
                        : 'bg-white border-[#E2D8C5]'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-black/15"
                      style={{ backgroundColor: BASE_COLORS[c].primary }}
                    />
                    {BASE_COLORS[c].name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Special sub-variant selector for #1 white with grey back stripe */}
      {showHeadCapChoice && (
        <div className="bg-[#F6EFE2] border border-[#DFD2BA] rounded-xl p-2">
          <div className="text-[11px] font-bold text-[#5E5245] mb-1">Вариант окраса головы:</div>
          <div className="grid grid-cols-2 gap-1.5">
            {(['white_head', 'gray_cap'] as HeadCapVariant[]).map((variant) => (
              <button
                key={variant}
                type="button"
                onClick={() =>
                  onChangeAppearance({
                    ...appearance,
                    headCapVariant: variant,
                  })
                }
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition ${
                  appearance.headCapVariant === variant
                    ? 'bg-[#6E8572] text-white border-[#5A705E]'
                    : 'bg-white text-[#4A4036] border-[#DDD1BC]'
                }`}
              >
                {HEAD_CAP_LABELS[variant]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ears, Coat type, Eyes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {/* Ears */}
        <div className="bg-white/75 rounded-xl p-2 border border-[#E2D8C5]">
          <div className="text-[11px] font-bold text-[#6E6254] mb-1">Ушки</div>
          <div className="flex gap-1">
            {(['standard', 'dumbo'] as EarType[]).map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => onChangeAppearance({ ...appearance, ears: e })}
                className={`flex-1 py-1 px-1.5 rounded-lg text-[11px] font-semibold transition ${
                  appearance.ears === e
                    ? 'bg-[#6E8572] text-white'
                    : 'bg-[#F3ECE0] text-[#55493D]'
                }`}
              >
                {e === 'standard' ? 'Стандарт' : 'Дамбо'}
              </button>
            ))}
          </div>
          <div className="text-[10px] text-[#837566] mt-1">{EAR_LABELS[appearance.ears]}</div>
        </div>

        {/* Coat */}
        <div className="bg-white/75 rounded-xl p-2 border border-[#E2D8C5]">
          <div className="text-[11px] font-bold text-[#6E6254] mb-1">Тип шерсти</div>
          <div className="flex gap-1">
            {(['smooth', 'rex'] as CoatType[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChangeAppearance({ ...appearance, coat: c })}
                className={`flex-1 py-1 px-1.5 rounded-lg text-[11px] font-semibold transition ${
                  appearance.coat === c
                    ? 'bg-[#6E8572] text-white'
                    : 'bg-[#F3ECE0] text-[#55493D]'
                }`}
              >
                {c === 'smooth' ? 'Гладкая' : 'Рекс'}
              </button>
            ))}
          </div>
          <div className="text-[10px] text-[#837566] mt-1">{COAT_LABELS[appearance.coat]}</div>
        </div>

        {/* Eyes */}
        <div className="bg-white/75 rounded-xl p-2 border border-[#E2D8C5]">
          <div className="text-[11px] font-bold text-[#6E6254] mb-1">Цвет глаз</div>
          <div className="flex flex-wrap gap-1">
            {allowedEyes.map((eye: EyeColor) => (
              <button
                key={eye}
                type="button"
                onClick={() => onChangeAppearance({ ...appearance, eyeColor: eye })}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border transition ${
                  appearance.eyeColor === eye
                    ? 'bg-[#EAF1EB] border-[#5E7A63]'
                    : 'bg-[#F8F4EC] border-[#E0D6C4]'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full border border-black/20"
                  style={{ backgroundColor: EYE_LABELS[eye].hex }}
                />
                {EYE_LABELS[eye].name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
