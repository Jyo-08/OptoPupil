import React from 'react';
import { Eye, Activity } from 'lucide-react';

interface HeaderProps {
  currentView: 'landing' | 'vision';
  onNavigateLanding: () => void;
  onNavigateVision: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigateLanding,
  onNavigateVision,
}) => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/90 bg-white/95 backdrop-blur-md shadow-xs">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand Logo */}
        <button
          onClick={onNavigateLanding}
          className="flex items-center gap-3 text-left transition hover:opacity-90"
        >
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-sky-600 shadow-sm">
            <Eye className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-space text-lg font-bold tracking-tight text-slate-900">
                Opto<span className="text-sky-600">Pupil</span>
              </span>
              <span className="rounded-full bg-sky-50 border border-sky-200 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-700">
                CLINICAL SUITE
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-sans hidden sm:block">
              Zero-Hardware Quantitative Pupillary Light Reflex Screening
            </p>
          </div>
        </button>

        {/* Right Nav / Status */}
        <div className="flex items-center gap-3">
          {currentView === 'vision' ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 shadow-xs">
                <Activity className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
                <span className="font-mono text-[11px] text-slate-500 hidden xs:inline">SYSTEM:</span>
                <span className="font-mono text-[11px] text-emerald-700 font-bold">ACTIVE CV 60FPS</span>
              </div>
              <button
                onClick={onNavigateLanding}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition shadow-xs"
              >
                Exit Cockpit
              </button>
            </div>
          ) : (
            <button
              onClick={onNavigateVision}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-sky-600/20 hover:from-sky-500 hover:to-blue-500 hover:shadow-lg hover:shadow-sky-600/30 transition-all"
            >
              <Eye className="h-4 w-4" />
              <span>Launch Screening Cockpit</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
