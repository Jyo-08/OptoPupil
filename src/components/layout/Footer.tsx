import React from 'react';
import { ShieldCheck, Info } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-slate-200 bg-white py-5 text-slate-500">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs">
          <div className="flex items-start gap-2 max-w-xl">
            <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-slate-600">
              <strong className="text-slate-800 font-semibold">Clinical Decision-Support Assistance:</strong> OptoPupil is an investigational pupillometry research platform. Not an FDA-cleared autonomous diagnostic device.
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-600 font-mono">
            <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <span>Local In-Browser Wasm &bull; Zero Protected Health Information (PHI) Cloud Upload</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
