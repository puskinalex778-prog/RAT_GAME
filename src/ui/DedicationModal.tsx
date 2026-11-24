import React from 'react';
import { Heart, X } from 'lucide-react';

interface DedicationModalProps {
  open: boolean;
  onClose: () => void;
}

export const DedicationModal: React.FC<DedicationModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-[#FAF5EB] rounded-3xl p-4 sm:p-5 border-2 border-[#D8C7A8] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-[#EFE6D6] text-[#5B4F42] hover:bg-[#E5D8C2]"
          aria-label="Закрыть"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-3">
          <Heart className="w-5 h-5 text-[#CE5F52] fill-[#CE5F52]" />
          <h3 className="text-base font-extrabold text-[#3B332B]">Памятная табличка</h3>
        </div>

        <div className="rounded-2xl overflow-hidden bg-[#F1E7D5] p-2 border border-[#DFD2BA] shadow-inner">
          <img
            src="./assets/dedication_plaque.png"
            alt="Посвящается: Тимме, Жоржу, Васе, Элвину"
            className="w-full h-auto object-contain rounded-xl"
          />
        </div>

        <p className="text-center text-xs font-semibold text-[#6F6254] mt-3 leading-relaxed">
          Эта тёплая табличка всегда висит на стене комнаты над клеткой — в честь любимых крысок
          Тиммы, Жоржа, Васи и Элвина.
        </p>
      </div>
    </div>
  );
};
