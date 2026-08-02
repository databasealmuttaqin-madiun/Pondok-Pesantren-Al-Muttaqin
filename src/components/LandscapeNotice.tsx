import React, { useState, useEffect } from "react";
import { RotateCw, Maximize, Smartphone, X } from "lucide-react";

export default function LandscapeNotice() {
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isSupportLock, setIsSupportLock] = useState(false);

  useEffect(() => {
    // Check if device supports orientation lock
    if (typeof window !== "undefined" && window.screen && "orientation" in window.screen) {
      setIsSupportLock(true);
    }

    const checkOrientation = () => {
      const isMobileSize = window.innerWidth <= 820;
      const isPortrait = window.innerHeight > window.innerWidth;
      
      setIsMobilePortrait(isMobileSize && isPortrait);
    };

    checkOrientation();

    // Auto-attempt orientation lock if possible on initial load or touch
    const tryAutoLock = async () => {
      try {
        if (window.screen && window.screen.orientation && "lock" in window.screen.orientation) {
          // @ts-ignore
          await window.screen.orientation.lock("landscape").catch(() => {});
        }
      } catch (e) {
        // Ignored if browser requires user gesture
      }
    };

    tryAutoLock();

    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);

    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, []);

  const handleRequestLandscape = async () => {
    try {
      // 1. Request Fullscreen first (required by many browsers before lock)
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen().catch(() => {});
      } else if ((elem as any).webkitRequestFullscreen) {
        await (elem as any).webkitRequestFullscreen().catch(() => {});
      }

      // 2. Lock orientation to landscape
      if (window.screen && window.screen.orientation && "lock" in window.screen.orientation) {
        // @ts-ignore
        await window.screen.orientation.lock("landscape");
      }
      setDismissed(true);
    } catch (err) {
      console.warn("Screen orientation lock feature error:", err);
      // Fallback message
      alert("Silakan aktifkan 'Auto-Rotate' di pengaturan HP Anda dan miringkan perangkat ke posisi Landscape (Miring).");
    }
  };

  if (!isMobilePortrait || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-3 right-3 z-[9999] md:hidden animate-bounce-subtle">
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-emerald-500/30 backdrop-blur-md flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-400 animate-pulse">
              <RotateCw className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-emerald-300 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4" /> Mode Landscape Direkomendasikan
              </h4>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                Putar HP Anda ke posisi <b>Miring (Landscape)</b> agar tabel & menu data santri lebih luas dan nyaman digunakan.
              </p>
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            title="Tutup Notifikasi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleRequestLandscape}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-slate-950 font-semibold text-xs py-2 px-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Maximize className="w-3.5 h-3.5" />
            Buka Layar Penuh & Landscape
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="bg-white/10 hover:bg-white/20 text-xs text-slate-300 py-2 px-3 rounded-xl transition-all cursor-pointer whitespace-nowrap"
          >
            Tetap Tegak
          </button>
        </div>
      </div>
    </div>
  );
}
