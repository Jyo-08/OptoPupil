import React from 'react';
import { ShieldCheck, Info } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-slate-800/80 bg-[#05080f] py-4 text-slate-400">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs">
          <div className="flex items-start gap-2 max-w-xl">
            <Info className="h-4 w-4 text-amber-500/80 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-slate-400">
              <strong className="text-slate-300">Screening Assistance Only:</strong> OptoPupil is a decision-support prototype created for VMEDITHON 3.0. Not a medical diagnosis or clinical diagnostic device.
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
            <ShieldCheck className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            <span>Local WebAssembly &bull; Zero Server Frame Upload</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
