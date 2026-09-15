import React, { useRef, useEffect } from 'react';
import { useCamera } from '../camera/useCamera';
import { useVisionPipeline } from '../hooks/useVisionPipeline';
import { useMeasurementPersistence } from '../hooks/useMeasurementPersistence';
import { CameraView } from '../components/vision/CameraView';
import { BilateralPupilMetricsCard } from '../components/vision/BilateralPupilMetricsCard';
import { TrackingPanel } from '../components/vision/TrackingPanel';
import { LatestMeasurementCard } from '../components/dashboard/LatestMeasurementCard';
import {
  useDisplayStimulus,
  DisplayStimulusOverlay,
  StimulusControlCard,
} from '../stimulus';
import { usePLRRecording } from '../plr/hooks/usePLRRecording';
import { RecordingController } from '../components/plr/RecordingController';
import { PLRWaveformChart } from '../components/plr/PLRWaveformChart';
import { PLRMetricsCard } from '../components/plr/PLRMetricsCard';
import { ArrowLeft, Play, Square, RefreshCw, Eye } from 'lucide-react';

interface VisionPageProps {
  onBack: () => void;
}

export const VisionPage: React.FC<VisionPageProps> = ({ onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize Camera Hook (auto-start when entering Vision page)
  const {
    videoRef,
    cameraState,
    startCamera,
    stopCamera,
    handleLoadedMetadata,
  } = useCamera({
    autoStart: true,
    preferredFacingMode: 'user',
    idealWidth: 1280,
    idealHeight: 720,
  });

  // Initialize Controlled Display Light Stimulus Controller
  const stimulusController = useDisplayStimulus();
  const { isStimulusActive, startStimulus, lastTiming, defaultDurationMs } = stimulusController;

  // Initialize PLR Protocol & Time-Series Recording Engine
  const recordingState = usePLRRecording({
    stimulus: stimulusController,
  });

  // Initialize Vision Pipeline (rAF loop with Face Landmarker, Eye Extractor, Pupil Detector & Stabilizer)
  const {
    modelStatus,
    modelError,
    tracking,
    pupilData,
  } = useVisionPipeline({
    videoRef,
    canvasRef,
    isActive: cameraState.status === 'active',
    onFrame: recordingState.handleFrame,
  });

  // Automated stable baseline screening workflow & two-database persistence
  const {
    currentSessionId,
    latestFinalRecord,
    allFinalRecords,
    finalCount,
    rawCount,
    isSaving,
    persistenceError,
    screeningState,
    windowSamplesCount,
    leftDeltaPx,
    rightDeltaPx,
    isBaselineStable,
    deleteFinalRecord,
    clearRawDb,
    clearFinalDb,
    startNewSession,
    refresh,
  } = useMeasurementPersistence({
    pupilData,
    isActive: cameraState.status === 'active',
    startStimulus,
  });

  // Clean up camera on exit
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Full-Screen Pure White Controlled Light Stimulus Overlay (rendered via document.body Portal) */}
      <DisplayStimulusOverlay isActive={isStimulusActive} />

      {/* Top Header / Stage Breadcrumb */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#0d1322] px-3 py-2 text-xs font-mono font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>BACK</span>
          </button>
          <div>
            <h2 className="font-mono text-lg font-bold tracking-tight text-slate-100 flex items-center gap-2">
              <Eye className="h-5 w-5 text-cyan-400" />
              <span>QUANTITATIVE PLR SCREENING COCKPIT</span>
            </h2>
            <p className="text-xs text-slate-400">
              Real-time Sub-pixel Bilateral Pupil Tracking &amp; Kinetic Reflex Analysis
            </p>
          </div>
        </div>

        {/* Camera Hardware Controls */}
        <div className="flex items-center gap-2 font-mono">
          {cameraState.status === 'active' ? (
            <button
              onClick={() => stopCamera()}
              className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-900/40 transition"
            >
              <Square className="h-3.5 w-3.5" />
              <span>Stop Feed</span>
            </button>
          ) : (
            <button
              onClick={() => startCamera(cameraState.deviceId || undefined)}
              className="flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-950/40 px-3 py-1.5 text-xs text-cyan-300 hover:bg-cyan-900/40 transition"
            >
              <Play className="h-3.5 w-3.5" />
              <span>Start Feed</span>
            </button>
          )}

          <button
            onClick={() => startCamera(cameraState.deviceId || undefined)}
            title="Restart Stream"
            className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main Grid: Responsive 2-Column on Desktop, Stacked on Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Live Camera, Protocol Controller & Interactive Waveform Chart (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <CameraView
            videoRef={videoRef}
            canvasRef={canvasRef}
            cameraState={cameraState}
            modelStatus={modelStatus}
            onLoadedMetadata={handleLoadedMetadata}
            onRequestCamera={() => startCamera(cameraState.deviceId || undefined)}
          />

          {/* Viewport Sub-bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800/80 bg-[#0d1322] px-3.5 py-2 text-[11px] font-mono text-slate-400">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-purple-400"></span>
              <span className="text-purple-300">PURPLE: PUPIL BOUNDARY</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan-400"></span>
              <span>CYAN: IRIS BOUNDARY</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-sky-400"></span>
              <span>BLUE: OCULAR CONTOUR</span>
            </div>
          </div>

          {/* Screening Protocol Controller */}
          <RecordingController
            recordingState={recordingState}
            tracking={tracking}
          />

          {/* Interactive Bilateral Waveform Chart */}
          <PLRWaveformChart
            timeSeries={
              recordingState.report?.timeSeries || {
                stimulusTiming: {
                  stimulusOnsetTime: 0,
                  stimulusOffsetTime: 200,
                  configuredDurationMs: 200,
                  actualDurationMs: 200,
                },
                leftEye: { timeMs: [], rawMm: [], cleanMm: [], velocityMmS: [], confidence: [], isInterpolated: [] },
                rightEye: { timeMs: [], rawMm: [], cleanMm: [], velocityMmS: [], confidence: [], isInterpolated: [] },
                totalDurationMs: 0,
                averageFps: 0,
                recordingQualityScore: 0,
              }
            }
            leftLatencyMs={recordingState.report?.leftEye.latencyMs}
            rightLatencyMs={recordingState.report?.rightEye.latencyMs}
          />
        </div>

        {/* Right Column: Quantitative Kinetics, Bilateral Asymmetry, Tracking Telemetry (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Quantitative PLR Kinetics & Asymmetry Report Card */}
          <PLRMetricsCard report={recordingState.report} />

          {/* 1. [ BASELINE PERSISTED DB ] */}
          <LatestMeasurementCard
            currentSessionId={currentSessionId}
            latestFinalRecord={latestFinalRecord}
            allFinalRecords={allFinalRecords}
            finalCount={finalCount}
            rawCount={rawCount}
            isSaving={isSaving}
            persistenceError={persistenceError}
            screeningState={screeningState}
            windowSamplesCount={windowSamplesCount}
            leftDeltaPx={leftDeltaPx}
            rightDeltaPx={rightDeltaPx}
            isBaselineStable={isBaselineStable}
            onRefresh={refresh}
            onClearRawDb={clearRawDb}
            onClearFinalDb={clearFinalDb}
            onDeleteFinalRecord={deleteFinalRecord}
            onStartNewSession={startNewSession}
          />

          {/* 2. [ BILATERAL PUPIL METRICS ] */}
          <BilateralPupilMetricsCard pupilData={pupilData} />

          {/* 3. [ LIGHT STIMULUS CONTROLLER ] */}
          <StimulusControlCard
            isStimulusActive={isStimulusActive}
            onStartStimulus={() => startStimulus()}
            lastTiming={lastTiming}
            defaultDurationMs={defaultDurationMs}
          />

          {/* 4. [ TRACKING STATE & SYSTEM DIAGNOSTICS ] */}
          <TrackingPanel
            tracking={tracking}
            pupilData={pupilData}
            cameraState={cameraState}
            modelStatus={modelStatus}
            modelError={modelError}
            onRetryCamera={() => startCamera(cameraState.deviceId || undefined)}
            onSwitchCamera={(deviceId) => startCamera(deviceId)}
          />
        </div>
      </div>
    </div>
  );
};
