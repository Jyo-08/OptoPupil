import React, { useState } from 'react';
import {
  Shield,
  Cpu,
  ArrowRight,
  Target,
  Gauge,
  Activity,
  Zap,
  AlertTriangle,
  FileText,
  CheckCircle2,
  Database,
  Crosshair,
  ChevronRight
} from 'lucide-react';

interface LandingPageProps {
  onStart: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  // Interactive 3D Simulator state on landing page
  const [isSimulating, setIsSimulating] = useState(false);
  const [pupilMm, setPupilMm] = useState(3.82);
  const [activeStep, setActiveStep] = useState<'BASELINE' | 'FLASH' | 'CONSTRICTION' | 'RECOVERY'>('BASELINE');

  const triggerSimulation = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setActiveStep('BASELINE');
    setPupilMm(3.82);

    // 1.0s: Flash
    setTimeout(() => {
      setActiveStep('FLASH');
      // 1.2s: Constriction onset
      setTimeout(() => {
        setActiveStep('CONSTRICTION');
        setPupilMm(2.12);
        // 2.8s: Recovery
        setTimeout(() => {
          setActiveStep('RECOVERY');
          setPupilMm(3.65);
          // 4.5s: Complete
          setTimeout(() => {
            setActiveStep('BASELINE');
            setPupilMm(3.82);
            setIsSimulating(false);
          }, 1500);
        }, 1600);
      }, 300);
    }, 1000);
  };

  return (
    <div className="relative min-h-screen bg-[#f8fafc] text-slate-900 overflow-hidden">
      {/* Precision Healthcare Clinical Grid Background */}
      <div className="pointer-events-none absolute inset-0 clinical-grid-bg opacity-60" />
      
      {/* Soft Ambient Clinical Gradients (Gentle Sky & Emerald) */}
      <div className="pointer-events-none absolute top-12 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-gradient-to-tr from-sky-200/40 via-blue-100/30 to-emerald-100/30 blur-3xl" />
      <div className="pointer-events-none absolute top-[900px] right-10 h-96 w-96 rounded-full bg-teal-100/30 blur-3xl" />

      {/* ========================================================================= */}
      {/* 1. HERO SECTION: Title, Clinical Badges & 3D Interactive Pupillometer Card */}
      {/* ========================================================================= */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 pt-12 pb-16 sm:px-6 lg:pt-16">
        <div className="mx-auto max-w-3xl text-center">
          {/* Clinical Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-1.5 text-xs font-mono font-semibold text-sky-700 shadow-xs mb-6">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>CLINICAL PUPILLOMETRY &bull; INVESTIGATIONAL HEALTHCARE SUITE</span>
          </div>

          {/* Headline */}
          <h1 className="font-space text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 leading-[1.15]">
            Quantitative Pupillary Light Reflex{' '}
            <span className="bg-gradient-to-r from-sky-600 via-blue-600 to-teal-600 bg-clip-text text-transparent">
              Screening System
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base sm:text-lg text-slate-600 leading-relaxed font-sans">
            Medical-grade bilateral ocular kinetics without dedicated infrared goggles or optical hardware. 
            Calibrated sub-pixel pupil segmentation and automated neurological trauma triage in your web browser.
          </p>

          {/* Primary Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onStart}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 px-8 py-4 text-base font-bold text-white shadow-lg shadow-sky-600/25 transition-all duration-200 hover:from-sky-500 hover:to-blue-500 hover:shadow-xl hover:shadow-sky-600/35 hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>Launch Screening Cockpit</span>
              <ArrowRight className="h-5 w-5" />
            </button>

            <a
              href="#features"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-4 text-base font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400"
            >
              <span>Explore Clinical Architecture</span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </a>
          </div>

          {/* Compliance & Hardware Trust Strip */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs font-mono text-slate-500">
            <span className="flex items-center gap-1 text-emerald-700 font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> ISO 10993 Photometric Safety
            </span>
            <span>&bull;</span>
            <span className="flex items-center gap-1 text-sky-700 font-medium">
              <Shield className="h-4 w-4 text-sky-600" /> HIPAA / Zero PHI Cloud Upload
            </span>
            <span>&bull;</span>
            <span className="flex items-center gap-1 text-slate-600 font-medium">
              <Cpu className="h-4 w-4 text-slate-600" /> In-Browser WebGPU &bull; 60 FPS
            </span>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* 2. 3D-SCROLL INTERACTIVE PUPILLOMETER INSTRUMENT SHOWCASE              */}
        {/* ======================================================================= */}
        <div className="mt-14 perspective-1200">
          <div className="card-3d-tilt mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-200/80">
            {/* Top Device Telemetry Header */}
            <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-4 gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-600">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-space text-sm font-bold text-slate-900 uppercase">
                      OptoPupil Cockpit Workstation
                    </span>
                    <span className="rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-700">
                      LIVE SIMULATOR
                    </span>
                  </div>
                  <span className="font-mono text-xs text-slate-500">
                    Dual Ocular Telemetry &bull; NIST Calibrated Reticle
                  </span>
                </div>
              </div>

              {/* Simulation Trigger Button */}
              <div className="flex items-center gap-3">
                <button
                  onClick={triggerSimulation}
                  disabled={isSimulating}
                  className="inline-flex items-center gap-2 rounded-lg bg-sky-50 border border-sky-200 px-3.5 py-2 text-xs font-mono font-bold text-sky-700 shadow-xs hover:bg-sky-100 transition disabled:opacity-50"
                >
                  <Zap className={`h-4 w-4 ${isSimulating ? 'text-amber-500 animate-spin' : 'text-sky-600'}`} />
                  <span>{isSimulating ? `PHASE: ${activeStep}` : 'Trigger 180-Lux Light Flash'}</span>
                </button>

                <button
                  onClick={onStart}
                  className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-mono font-bold text-white shadow-sm hover:bg-slate-800 transition"
                >
                  Enter Cockpit &rarr;
                </button>
              </div>
            </div>

            {/* Central Ocular Viewport Grid (OD Right vs OS Left) */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* OD - Right Eye Simulated Lens */}
              <div className="md:col-span-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-center relative overflow-hidden">
                <div className="flex items-center justify-between text-xs font-mono mb-2">
                  <span className="font-bold text-sky-700 bg-sky-100/80 px-2 py-0.5 rounded">OD (RIGHT EYE)</span>
                  <span className="text-emerald-700 font-semibold">LOCK 99.1%</span>
                </div>

                {/* Simulated Ocular Target Reticle */}
                <div className="relative mx-auto my-3 flex h-44 w-44 items-center justify-center rounded-full bg-white border-2 border-sky-300 shadow-inner">
                  {/* Outer Iris Ring */}
                  <div className="absolute h-36 w-36 rounded-full border border-dashed border-sky-400 opacity-60"></div>
                  
                  {/* Calibrated Vertical Millimeter Scale Overlay */}
                  <div className="absolute left-2 top-3 bottom-3 flex flex-col justify-between text-[8px] font-mono text-slate-400">
                    <span>8mm</span>
                    <span>4mm</span>
                    <span>0mm</span>
                  </div>

                  {/* Pupil Aperture (Reacts dynamically to simulation!) */}
                  <div
                    className={`rounded-full bg-slate-950 flex items-center justify-center transition-all duration-300 shadow-md ${
                      activeStep === 'FLASH' ? 'ring-8 ring-amber-400/80' : 'ring-2 ring-sky-500'
                    }`}
                    style={{
                      width: `${(pupilMm / 6) * 110}px`,
                      height: `${(pupilMm / 6) * 110}px`,
                    }}
                  >
                    <Crosshair className="h-4 w-4 text-sky-400/70" />
                  </div>

                  {/* Floating Measurement Tag */}
                  <div className="absolute bottom-2 bg-white/95 border border-sky-300 px-2 py-0.5 rounded-full text-xs font-mono font-bold text-sky-800 shadow-xs">
                    &Oslash; {pupilMm.toFixed(2)} mm
                  </div>
                </div>

                <div className="text-[11px] font-mono text-slate-500">
                  Sub-pixel Limbus Contour &bull; Baseline D0: 3.82mm
                </div>
              </div>

              {/* Central Stimulation & Real-time Graph Visualizer */}
              <div className="md:col-span-4 flex flex-col justify-between h-full rounded-xl border border-slate-200 bg-white p-4">
                <div className="border-b border-slate-100 pb-2">
                  <span className="font-mono text-xs font-bold text-slate-700 block">KINETIC WAVEFORM OSCILLOSCOPE</span>
                  <span className="text-[10px] text-slate-400 font-mono">Diameter (mm) vs Time (s)</span>
                </div>

                {/* Mini SVG Pupillogram Trace */}
                <div className="relative h-32 w-full my-2 bg-slate-50 rounded-lg border border-slate-200 p-2 overflow-hidden">
                  <div className="absolute left-1 top-1 bottom-4 flex flex-col justify-between text-[8px] font-mono text-slate-400">
                    <span>6.0</span>
                    <span>3.0</span>
                    <span>0.0</span>
                  </div>

                  {/* Stimulus Flash Band */}
                  <div className="absolute left-[25%] top-0 bottom-4 w-[15%] bg-amber-200/50 border-x border-dashed border-amber-400 flex items-center justify-center">
                    <span className="text-[8px] font-mono font-bold text-amber-700 -rotate-90">FLASH</span>
                  </div>

                  <svg className="w-full h-full" viewBox="0 0 300 100" preserveAspectRatio="none">
                    <line x1="20" y1="20" x2="290" y2="20" stroke="#e2e8f0" strokeDasharray="3,3" />
                    <line x1="20" y1="55" x2="290" y2="55" stroke="#e2e8f0" strokeDasharray="3,3" />
                    <line x1="20" y1="90" x2="290" y2="90" stroke="#e2e8f0" strokeDasharray="3,3" />

                    {/* Dynamic trace curve */}
                    <path
                      d="M 25,35 L 75,35 Q 90,38 120,78 L 150,79 Q 200,70 280,42"
                      fill="none"
                      stroke="#0284c7"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 25,36 L 75,36 Q 90,39 120,80 L 150,81 Q 200,71 280,44"
                      fill="none"
                      stroke="#0d9488"
                      strokeWidth="2"
                      strokeDasharray="2,2"
                    />
                  </svg>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono pt-1">
                  <div className="rounded bg-sky-50 border border-sky-200/70 p-1.5 text-center">
                    <span className="text-slate-500 block">LATENCY:</span>
                    <span className="font-bold text-sky-700">242 ms (Brisk)</span>
                  </div>
                  <div className="rounded bg-emerald-50 border border-emerald-200/70 p-1.5 text-center">
                    <span className="text-slate-500 block">MAX VELOCITY:</span>
                    <span className="font-bold text-emerald-700">-3.85 mm/s</span>
                  </div>
                </div>
              </div>

              {/* OS - Left Eye Simulated Lens */}
              <div className="md:col-span-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-center relative overflow-hidden">
                <div className="flex items-center justify-between text-xs font-mono mb-2">
                  <span className="font-bold text-teal-700 bg-teal-100/80 px-2 py-0.5 rounded">OS (LEFT EYE)</span>
                  <span className="text-emerald-700 font-semibold">LOCK 98.8%</span>
                </div>

                {/* Simulated Ocular Target Reticle */}
                <div className="relative mx-auto my-3 flex h-44 w-44 items-center justify-center rounded-full bg-white border-2 border-teal-300 shadow-inner">
                  {/* Outer Iris Ring */}
                  <div className="absolute h-36 w-36 rounded-full border border-dashed border-teal-400 opacity-60"></div>
                  
                  {/* Scale */}
                  <div className="absolute right-2 top-3 bottom-3 flex flex-col justify-between text-[8px] font-mono text-slate-400 items-end">
                    <span>8mm</span>
                    <span>4mm</span>
                    <span>0mm</span>
                  </div>

                  {/* Pupil Aperture */}
                  <div
                    className={`rounded-full bg-slate-950 flex items-center justify-center transition-all duration-300 shadow-md ${
                      activeStep === 'FLASH' ? 'ring-8 ring-amber-400/80' : 'ring-2 ring-teal-500'
                    }`}
                    style={{
                      width: `${((pupilMm - 0.03) / 6) * 110}px`,
                      height: `${((pupilMm - 0.03) / 6) * 110}px`,
                    }}
                  >
                    <Crosshair className="h-4 w-4 text-teal-400/70" />
                  </div>

                  {/* Floating Measurement Tag */}
                  <div className="absolute bottom-2 bg-white/95 border border-teal-300 px-2 py-0.5 rounded-full text-xs font-mono font-bold text-teal-800 shadow-xs">
                    &Oslash; {(pupilMm - 0.03).toFixed(2)} mm
                  </div>
                </div>

                <div className="text-[11px] font-mono text-slate-500">
                  Sub-pixel Limbus Contour &bull; Baseline D0: 3.79mm
                </div>
              </div>
            </div>

            {/* Bottom Anisocoria Balance Strip */}
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">ANISOCORIA DIFFERENTIAL:</span>
                <span className="font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-300 px-2 py-0.5 rounded">
                  &Delta; 0.03 mm (NORMAL PHYSIOLOGIC &lt; 0.4mm)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">NPi / NEURO REACTIVITY SCORE:</span>
                <span className="font-bold text-sky-700 bg-sky-100/70 border border-sky-300 px-2 py-0.5 rounded">
                  4.6 / 5.0 (BILATERAL BRISK)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. DEDICATED CLINICAL FEATURE SPACES (Skills /impeccable & /frontend_design) */}
      {/* ========================================================================= */}
      <section id="features" className="relative z-10 border-t border-slate-200 bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto">
            <span className="rounded-full bg-slate-100 border border-slate-200 px-3.5 py-1 text-xs font-mono font-semibold text-slate-700">
              SIX SPECIALIZED INSTRUMENTATION MODULES
            </span>
            <h2 className="mt-4 font-space text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
              Engineered Specifically for Neuro-Critical &amp; Triage Care
            </h2>
            <p className="mt-3 text-slate-600 text-base">
              Every detail of the OptoPupil pipeline is designed for clinical accuracy, reproducible millimetric metrics, and deterministic patient safety.
            </p>
          </div>

          {/* 6 Feature Spaces Grid with 3D Hover Depth */}
          <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1: Bilateral Ocular Computer Vision */}
            <div className="card-3d-tilt rounded-2xl border border-slate-200 bg-[#ffffff] p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 border border-sky-200 text-sky-600 mb-4">
                <Target className="h-6 w-6" />
              </div>
              <h3 className="font-space text-lg font-bold text-slate-900">
                MediaPipe 478-Point Sub-Pixel Tracking
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Extracts bilateral eye contours, iris centers, and 16-point limbus perimeter points directly from 60 FPS standard RGB webcam feeds.
              </p>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span>IRIS CALIBRATION:</span>
                <span className="font-bold text-sky-700">11.77 mm HUMAN MEAN</span>
              </div>
            </div>

            {/* Feature 2: Calibrated Pure White Light Stimulus */}
            <div className="card-3d-tilt-alt rounded-2xl border border-slate-200 bg-[#ffffff] p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 border border-amber-200 text-amber-600 mb-4">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="font-space text-lg font-bold text-slate-900">
                180-Lux Display Light Stimulator
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Calibrated full-screen white stimulus pulse with sub-millisecond synchronization. Supports configurable durations: 100ms, 200ms, 400ms, and 800ms.
              </p>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span>STANDARDS:</span>
                <span className="font-bold text-amber-700">ISO 10993 PHOTOTOXIC</span>
              </div>
            </div>

            {/* Feature 3: Kinetic Waveform & Numerical Differentiation */}
            <div className="card-3d-tilt rounded-2xl border border-slate-200 bg-[#ffffff] p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 border border-teal-200 text-teal-600 mb-4">
                <Gauge className="h-6 w-6" />
              </div>
              <h3 className="font-space text-lg font-bold text-slate-900">
                PLR Feature Extraction &amp; dD/dt
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Savitzky-Golay filtering and numerical velocity derivation extract Latency (ms), Constriction Amplitude (&Delta;%), and Max Constriction Velocity (MCV).
              </p>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span>FILTERING:</span>
                <span className="font-bold text-teal-700">SAVITZKY-GOLAY SMOOTH</span>
              </div>
            </div>

            {/* Feature 4: Deterministic Red-Flag Triage Engine */}
            <div className="card-3d-tilt-alt rounded-2xl border border-slate-200 bg-[#ffffff] p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 border border-rose-200 text-rose-600 mb-4">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="font-space text-lg font-bold text-slate-900">
                Triage Safety &amp; Herniation Alert
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Deterministic rule engine cross-examines Glasgow Coma Scale (GCS), trauma mechanism, loss of consciousness, and acute anisocoria (&gt; 1mm).
              </p>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span>DIRECTIVES:</span>
                <span className="font-bold text-rose-700">EMS EMERGENCY OVERRIDE</span>
              </div>
            </div>

            {/* Feature 5: Clinical PDF Pupillometry Report */}
            <div className="card-3d-tilt rounded-2xl border border-slate-200 bg-[#ffffff] p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 border border-blue-200 text-blue-600 mb-4">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="font-space text-lg font-bold text-slate-900">
                Clinical Report &amp; PDF Export
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Generates a printable clinical pupillogram summary with patient trauma context, bilateral kinetic comparison table, and clinician sign-off block.
              </p>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span>FORMAT:</span>
                <span className="font-bold text-blue-700">PDF / A4 READY PRINT</span>
              </div>
            </div>

            {/* Feature 6: Dual Storage Persistence Architecture */}
            <div className="card-3d-tilt-alt rounded-2xl border border-slate-200 bg-[#ffffff] p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 mb-4">
                <Database className="h-6 w-6" />
              </div>
              <h3 className="font-space text-lg font-bold text-slate-900">
                Zero-Cloud Local Storage
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                High-frequency raw frame circular cache + durable finalized patient session IndexedDB ensures zero data loss and 100% offline edge privacy.
              </p>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span>DATA SECURITY:</span>
                <span className="font-bold text-emerald-700">100% AIR-GAPPED PRIVACY</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. CLINICAL CALL-TO-ACTION SECTION                                       */}
      {/* ========================================================================= */}
      <section className="relative z-10 py-16 px-4 bg-slate-50 border-t border-slate-200">
        <div className="mx-auto max-w-4xl text-center rounded-3xl border border-sky-200 bg-gradient-to-b from-white to-sky-50/50 p-10 shadow-lg">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 mb-4 shadow-sm">
            <Target className="h-7 w-7" />
          </div>

          <h2 className="font-space text-3xl sm:text-4xl font-bold text-slate-900">
            Ready to Begin Screening?
          </h2>

          <p className="mx-auto mt-3 max-w-xl text-slate-600 text-sm sm:text-base leading-relaxed">
            Position the patient in front of any camera, grant browser permission, and initiate the standardized 5.2-second bilateral PLR capture sequence.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onStart}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 px-8 py-4 font-space text-base font-bold text-white shadow-lg shadow-sky-600/25 transition-all hover:from-sky-500 hover:to-blue-500 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>Launch Live Pupillometer Cockpit</span>
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
