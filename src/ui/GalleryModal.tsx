import React, { useState } from 'react';
import { Camera, Download, Trash2, X } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { exportPhotoToDevice } from '../store/persistence';
import type { PhotoRecord } from '../types/game';

interface GalleryModalProps {
  open: boolean;
  onClose: () => void;
  onOpenPhotoMode: () => void;
}

export const GalleryModal: React.FC<GalleryModalProps> = ({
  open,
  onClose,
  onOpenPhotoMode,
}) => {
  const photos = useGameStore((s) => s.photos);
  const deletePhoto = useGameStore((s) => s.deletePhoto);
  const setToast = useGameStore((s) => s.setToast);
  const [activePhoto, setActivePhoto] = useState<PhotoRecord | null>(null);

  if (!open) return null;

  const handleExport = async (photo: PhotoRecord) => {
    const msg = await exportPhotoToDevice(photo.dataUrl, `rat_home_${photo.takenAt}.png`);
    setToast(msg);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl max-h-[86vh] flex flex-col bg-[#FAF5EB] rounded-3xl border border-[#DFD3BD] shadow-2xl text-[#3B332B] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E6DAC6] bg-[#F4ECDC]">
          <div className="flex items-center gap-2">
            <img src="./assets/icons/camera.png" alt="" className="w-7 h-7 object-contain" />
            <h2 className="text-base font-extrabold">Фотоальбом ({photos.length})</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenPhotoMode();
              }}
              className="flex items-center gap-1 bg-[#6E8572] text-white text-xs font-bold px-3 py-1.5 rounded-xl"
            >
              <Camera className="w-3.5 h-3.5" />
              Снять фото
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full bg-[#E8DEC9] text-[#5B4F42]"
              aria-label="Закрыть"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto cozy-scroll p-4">
          {photos.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <img
                src="./assets/icons/camera.png"
                alt=""
                className="w-16 h-16 mx-auto opacity-65"
              />
              <div className="text-sm font-bold text-[#5E5245]">В альбоме пока нет снимков</div>
              <p className="text-xs text-[#837566]">
                Открой фоторежим, выбери уютный ракурс и запечатлей своих крысок!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {photos.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setActivePhoto(p)}
                  className="group relative rounded-2xl overflow-hidden bg-white border border-[#DFD2BA] shadow-xs cursor-pointer"
                >
                  <img
                    src={p.dataUrl}
                    alt={p.caption}
                    className="w-full aspect-[4/3] object-cover"
                  />
                  <div className="p-2 flex items-center justify-between gap-1">
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold truncate">{p.caption}</div>
                      <div className="text-[10px] text-[#8A7C6C]">
                        {new Date(p.takenAt).toLocaleDateString('ru-RU')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExport(p);
                      }}
                      title="Экспортировать"
                      className="p-1.5 rounded-lg bg-[#EAF1EB] text-[#4C6851]"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox preview */}
      {activePhoto && (
        <div
          className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setActivePhoto(null)}
        >
          <div
            className="max-w-2xl w-full bg-[#FAF5EB] rounded-3xl p-3 border border-[#DFD3BD] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={activePhoto.dataUrl}
              alt={activePhoto.caption}
              className="w-full max-h-[65vh] object-contain rounded-2xl bg-black/10"
            />
            <div className="flex items-center justify-between mt-3 px-1">
              <div>
                <div className="text-sm font-extrabold">{activePhoto.caption}</div>
                <div className="text-xs text-[#7B6E5F]">
                  {new Date(activePhoto.takenAt).toLocaleString('ru-RU')}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleExport(activePhoto)}
                  className="flex items-center gap-1.5 bg-[#6E8572] text-white text-xs font-bold px-3.5 py-2 rounded-xl"
                >
                  <Download className="w-3.5 h-3.5" />
                  Сохранить / Поделиться
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deletePhoto(activePhoto.id);
                    setActivePhoto(null);
                  }}
                  className="p-2 rounded-xl bg-[#F4E1DC] text-[#A2463A]"
                  aria-label="Удалить"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
