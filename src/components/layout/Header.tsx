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
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-[#070a11]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand Logo */}
        <button
          onClick={onNavigateLanding}
          className="flex items-center gap-2.5 text-left transition hover:opacity-90"
        >
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-950/40 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.2)]">
            <Eye className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold tracking-wider text-slate-100 uppercase">
                OptoPupil
              </span>
              <span className="rounded bg-cyan-950/60 border border-cyan-800/40 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-cyan-300">
                SCREENING
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Zero-Hardware Quantitative Pupillary Light Reflex Screening
            </p>
          </div>
        </button>

        {/* Right Nav / Status */}
        <div className="flex items-center gap-3">
          {currentView === 'vision' ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-xs text-slate-300">
                <Activity className="h-3.5 w-3.5 text-cyan-400" />
                <span className="font-mono text-[11px] text-slate-400 hidden xs:inline">SYSTEM:</span>
                <span className="font-mono text-[11px] text-cyan-300 font-medium">ACTIVE CV</span>
              </div>
              <button
                onClick={onNavigateLanding}
                className="rounded-md border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition"
              >
                Exit
              </button>
            </div>
          ) : (
            <button
              onClick={onNavigateVision}
              className="flex items-center gap-2 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-400 transition"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Launch Screening</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
