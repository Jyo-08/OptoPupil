import React from 'react';
import { Shield, Cpu, Sparkles, ArrowRight, Video, Target, Gauge } from 'lucide-react';

interface LandingPageProps {
  onStart: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-[calc(100vh-130px)] px-4 py-12 sm:px-6">
      {/* Background Clinical Glow */}
      <div className="pointer-events-none absolute inset-0 clinical-grid-bg opacity-30" />
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        {/* Hackathon Project Tag */}
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-3.5 py-1 text-xs font-mono font-medium text-cyan-300 backdrop-blur-md mb-6 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
          <Sparkles className="h-3.5 w-3.5" />
          <span>VMEDITHON 3.0 &bull; Computer Vision Milestone 1</span>
        </div>

        {/* Title & Tagline */}
        <h1 className="font-mono text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-100 uppercase">
          Opto<span className="text-cyan-400">Pupil</span>
        </h1>

        <p className="mt-4 font-mono text-base sm:text-lg text-cyan-200/90 font-medium">
          Zero-Hardware Quantitative Pupillary Light Reflex Screening
        </p>

        <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base text-slate-400 leading-relaxed">
          Quantitative pupillary response screening using a standard camera and display. Contactless, bilateral ocular tracking powered by in-browser WebAssembly computer vision.
        </p>

        {/* Primary CTA */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onStart}
            className="group relative inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 px-8 py-4 font-mono text-sm font-bold text-slate-950 shadow-xl shadow-cyan-500/25 transition-all duration-200 hover:from-cyan-400 hover:to-cyan-300 hover:shadow-cyan-400/35 hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>START SCREENING</span>
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </button>
        </div>

        {/* Core Pillars Grid */}
        <div className="mt-16 grid grid-cols-2 gap-3 sm:grid-cols-5 text-left font-mono">
          <div className="rounded-xl border border-slate-800 bg-[#0d1322]/80 p-4 backdrop-blur-sm">
            <Video className="h-5 w-5 text-cyan-400 mb-2" />
            <div className="text-xs font-bold text-slate-200">Camera-Based</div>
            <div className="mt-1 text-[11px] text-slate-400 font-sans">Uses standard built-in webcam or mobile camera.</div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0d1322]/80 p-4 backdrop-blur-sm">
            <Shield className="h-5 w-5 text-cyan-400 mb-2" />
            <div className="text-xs font-bold text-slate-200">Contactless</div>
            <div className="mt-1 text-[11px] text-slate-400 font-sans">Zero physical ocular contact or specialized hardware.</div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0d1322]/80 p-4 backdrop-blur-sm">
            <Target className="h-5 w-5 text-cyan-400 mb-2" />
            <div className="text-xs font-bold text-slate-200">Bilateral</div>
            <div className="mt-1 text-[11px] text-slate-400 font-sans">Simultaneous dual iris and ocular tracking.</div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0d1322]/80 p-4 backdrop-blur-sm">
            <Gauge className="h-5 w-5 text-cyan-400 mb-2" />
            <div className="text-xs font-bold text-slate-200">Quantitative</div>
            <div className="mt-1 text-[11px] text-slate-400 font-sans">Sub-pixel landmark extraction engine.</div>
          </div>

          <div className="col-span-2 sm:col-span-1 rounded-xl border border-slate-800 bg-[#0d1322]/80 p-4 backdrop-blur-sm">
            <Cpu className="h-5 w-5 text-cyan-400 mb-2" />
            <div className="text-xs font-bold text-slate-200">Browser-Based</div>
            <div className="mt-1 text-[11px] text-slate-400 font-sans">Runs locally via WebAssembly and GPU acceleration.</div>
          </div>
        </div>

        {/* Clinical Disclaimer Callout */}
        <div className="mx-auto mt-12 max-w-xl rounded-lg border border-slate-800/80 bg-slate-900/40 px-4 py-2.5 text-xs text-slate-400">
          <p className="font-mono text-[11px]">
            <span className="text-amber-400 font-semibold">NOTICE:</span> Screening assistance only. Not a medical diagnosis or clinical diagnostic device.
          </p>
        </div>
      </div>
    </div>
  );
};
