import React, { useEffect, useState } from 'react';
import { ArrowRight, FastForward, Heart, Home, Sparkles } from 'lucide-react';
import type { AdoptionOrigin, RatAppearance, RatSex } from '../types/game';
import { RatCustomizer } from './RatCustomizer';
import { soundEngine } from '../audio/SoundEngine';

interface IntroCutsceneUIProps {
  appearance: RatAppearance;
  onChangeAppearance: (a: RatAppearance) => void;
  onComplete: (origin: AdoptionOrigin, name: string, sex: RatSex, appearance: RatAppearance) => void;
}

const ORIGIN_CARDS: {
  id: AdoptionOrigin;
  title: string;
  subtitle: string;
  story: string;
  icon: string;
}[] = [
  {
    id: 'rescue',
    title: 'Центр пристройства домашних крыс',
    subtitle: 'Подарить тёплый дом спасённому малышу',
    story:
      'В уютном волонтёрском центре пахнет свежими опилками и яблоками. Из мягкого гамака на тебя с любопытством выглядывает белая крыска с серой полоской вдоль спинки...',
    icon: './assets/icons/pets.png',
  },
  {
    id: 'breeder',
    title: 'Ответственный заводчик',
    subtitle: 'Ручные малыши, выросшие в любви',
    story:
      'В светлой комнате заводчика крысята смело тянутся к ладони и смешно шевелят усиками. Самый любознательный малыш первым подбегает познакомиться с тобой!',
    icon: './assets/icons/carrier.png',
  },
  {
    id: 'petshop',
    title: 'Уютный зоомагазин',
    subtitle: 'Неожиданная встреча с первого взгляда',
    story:
      'Проходя мимо витрины с тёплым светом, ты замечаешь пару живых глазок-бусинок. Крыска встаёт на задние лапки — кажется, она уже выбрала именно тебя.',
    icon: './assets/icons/shop.png',
  },
];

const CUTSCENE_LINES = [
  'В твоей комнате уже готова просторная светлая клетка с мягким наполнителем, деревянным домиком и свежей водичкой.',
  'На стене висит тёплая памятная табличка — в знак любви к маленьким пушистым друзьям.',
  'Осталось лишь выбрать, откуда ты заберёшь своего первого питомца, и познакомиться с ним поближе!',
];

export const IntroCutsceneUI: React.FC<IntroCutsceneUIProps> = ({
  appearance,
  onChangeAppearance,
  onComplete,
}) => {
  const [step, setStep] = useState<'story' | 'origin' | 'customize'>('story');
  const [storyIdx, setStoryIdx] = useState(0);
  const [origin, setOrigin] = useState<AdoptionOrigin>('rescue');
  const [name, setName] = useState('Тимма');
  const [sex, setSex] = useState<RatSex>('male');

  // Auto-advance cozy intro cutscene (~24 seconds total if watched, skippable anytime!)
  useEffect(() => {
    if (step !== 'story') return;
    const timer = window.setTimeout(() => {
      if (storyIdx < CUTSCENE_LINES.length - 1) {
        setStoryIdx((i) => i + 1);
      } else {
        setStep('origin');
      }
    }, 6500);
    return () => window.clearTimeout(timer);
  }, [step, storyIdx]);

  const handleSkip = () => {
    soundEngine.unlock();
    soundEngine.playClick();
    setStep('customize');
  };

  const handleConfirm = () => {
    soundEngine.unlock();
    onComplete(origin, name.trim() || 'Бусинка', sex, appearance);
  };

  const selectedOriginInfo = ORIGIN_CARDS.find((o) => o.id === origin)!;

  return (
    <div className="fixed inset-0 z-30 pointer-events-none flex flex-col justify-between safe-pt safe-pb safe-px">
      {/* Top header with title & Skip button */}
      <div className="flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-2 bg-[#FAF5EB]/90 backdrop-blur-md px-3.5 py-1.5 rounded-2xl border border-[#DFD3BD] shadow-sm">
          <img src="./assets/app_icon.png" alt="RAT HOME" className="w-7 h-7 rounded-lg" />
          <div>
            <div className="text-sm font-extrabold tracking-tight text-[#3A3128] leading-none">
              RAT HOME
            </div>
            <div className="text-[10px] font-semibold text-[#6E8572]">Крыски дома</div>
          </div>
        </div>

        {step !== 'customize' && (
          <button
            type="button"
            onClick={handleSkip}
            className="flex items-center gap-1.5 bg-[#FAF5EB]/90 hover:bg-white backdrop-blur-md px-3.5 py-2 rounded-xl border border-[#DFD3BD] text-xs font-bold text-[#5A4E41] shadow-sm active:scale-95 transition"
          >
            <FastForward className="w-3.5 h-3.5" />
            Пропустить
          </button>
        )}
      </div>

      {/* Step 1: Cozy Cutscene Narration */}
      {step === 'story' && (
        <div className="mt-auto mb-2 max-w-xl mx-auto w-full pointer-events-auto">
          <div className="bg-[#FAF5EB]/92 backdrop-blur-md rounded-3xl p-4 sm:p-5 border border-[#DFD3BD] shadow-xl">
            <div className="flex items-center gap-3 mb-2">
              {storyIdx === 1 && (
                <img
                  src="./assets/dedication_plaque.png"
                  alt="Посвящение"
                  className="w-20 h-16 object-contain rounded-lg shadow-sm shrink-0"
                />
              )}
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#6E8572] mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Добро пожаловать домой • {storyIdx + 1}/{CUTSCENE_LINES.length}
                </div>
                <p className="text-sm sm:text-base font-semibold text-[#3B332B] leading-snug">
                  {CUTSCENE_LINES[storyIdx]}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between mt-3">
              <div className="flex gap-1.5">
                {CUTSCENE_LINES.map((_, idx) => (
                  <span
                    key={idx}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === storyIdx ? 'w-6 bg-[#6E8572]' : 'w-2 bg-[#D6CAB6]'
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  soundEngine.unlock();
                  soundEngine.playClick();
                  if (storyIdx < CUTSCENE_LINES.length - 1) {
                    setStoryIdx((i) => i + 1);
                  } else {
                    setStep('origin');
                  }
                }}
                className="flex items-center gap-1.5 bg-[#6E8572] hover:bg-[#5E7462] text-white text-xs font-bold px-4 py-2 rounded-xl shadow active:scale-95 transition"
              >
                Далее
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Choose Adoption Origin */}
      {step === 'origin' && (
        <div className="mt-auto mb-2 max-w-2xl mx-auto w-full pointer-events-auto">
          <div className="bg-[#FAF5EB]/94 backdrop-blur-md rounded-3xl p-4 border border-[#DFD3BD] shadow-xl">
            <h2 className="text-base sm:text-lg font-extrabold text-[#3B332B] mb-1">
              Откуда ты заберёшь первую крыску?
            </h2>
            <p className="text-xs text-[#6F6254] mb-3">
              Выбери историю знакомства — в любом месте тебя уже ждёт ручной и ласковый друг.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
              {ORIGIN_CARDS.map((card) => {
                const active = origin === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => {
                      soundEngine.unlock();
                      soundEngine.playClick();
                      setOrigin(card.id);
                    }}
                    className={`flex sm:flex-col items-center gap-2.5 sm:gap-1.5 p-2.5 rounded-2xl border text-left sm:text-center transition active:scale-[0.98] ${
                      active
                        ? 'bg-[#EAF1EB] border-[#5E7A63] ring-2 ring-[#6E8572]/35'
                        : 'bg-white/85 border-[#E2D8C5] hover:bg-white'
                    }`}
                  >
                    <img
                      src={card.icon}
                      alt={card.title}
                      className="w-12 h-12 object-contain shrink-0"
                    />
                    <div>
                      <div className="text-xs font-extrabold text-[#3B332B] leading-tight">
                        {card.title}
                      </div>
                      <div className="text-[11px] text-[#786A5C] mt-0.5 leading-tight">
                        {card.subtitle}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="bg-[#F2E9DA] rounded-2xl p-2.5 text-xs text-[#4F4438] italic mb-3">
              «{selectedOriginInfo.story}»
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setStep('customize');
                }}
                className="flex items-center gap-1.5 bg-[#6E8572] hover:bg-[#5E7462] text-white text-sm font-bold px-5 py-2.5 rounded-2xl shadow-md active:scale-95 transition"
              >
                Познакомиться с крыской
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Live 3D First Rat Customizer (default: white with grey back stripe!) */}
      {step === 'customize' && (
        <div className="mt-auto mb-1 max-w-2xl mx-auto w-full pointer-events-auto">
          <div className="bg-[#FAF5EB]/93 backdrop-blur-md rounded-3xl p-3.5 sm:p-4 border border-[#DFD3BD] shadow-xl max-h-[60vh] overflow-y-auto cozy-scroll">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-[#3B332B] flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-[#D2735B] fill-[#D2735B]" />
                  Твоя первая крыска
                </h2>
                <p className="text-[11px] text-[#756758]">
                  По умолчанию — белая с серой полоской. Выбери любой из 20 окрасов или создай свой!
                </p>
              </div>
              <button
                type="button"
                onClick={handleConfirm}
                className="shrink-0 flex items-center gap-1.5 bg-[#6E8572] hover:bg-[#5B725F] text-white text-xs sm:text-sm font-extrabold px-4 py-2.5 rounded-2xl shadow-md active:scale-95 transition animate-gentle-pulse"
              >
                <Home className="w-4 h-4" />
                Забрать домой!
              </button>
            </div>

            <RatCustomizer
              name={name}
              sex={sex}
              appearance={appearance}
              onChangeName={setName}
              onChangeSex={setSex}
              onChangeAppearance={onChangeAppearance}
              compact
            />
          </div>
        </div>
      )}
    </div>
  );
};
