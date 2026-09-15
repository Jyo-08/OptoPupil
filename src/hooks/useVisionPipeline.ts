import { useState, useEffect, useRef, useCallback } from 'react';
import { FaceLandmarkerService } from '../vision/face/FaceLandmarkerService';
import type { FaceLandmarkerStatus } from '../vision/face/types';
import { EyeExtractor } from '../vision/eyes/EyeExtractor';
import { PupilDetector } from '../vision/pupil/PupilDetector';
import { BilateralPupilStabilizer } from '../vision/pupil/PupilStabilizer';
import { TrackingEvaluator } from '../vision/tracking/TrackingEvaluator';
import type {
  NormalizedLandmark,
  ExtractedOcularData,
  BilateralPupilData,
  PupilGeometry,
  TrackingQuality,
  VisionFrameOutput,
} from '../types/vision';

interface UseVisionPipelineProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isActive: boolean;
  onFrame?: (output: VisionFrameOutput) => void;
}

export function useVisionPipeline({
  videoRef,
  canvasRef,
  isActive,
  onFrame,
}: UseVisionPipelineProps) {
  const [modelStatus, setModelStatus] = useState<FaceLandmarkerStatus>('uninitialized');
  const [modelError, setModelError] = useState<string | null>(null);

  // Throttled tracking & pupil state for UI display
  const [trackingUiState, setTrackingUiState] = useState<TrackingQuality>({
    status: 'LOST',
    faceDetected: false,
    leftEyeDetected: false,
    rightEyeDetected: false,
    leftIrisDetected: false,
    rightIrisDetected: false,
    guidanceMessage: 'Initializing camera and vision pipeline...',
    fps: 0,
  });

  const [pupilUiState, setPupilUiState] = useState<BilateralPupilData>({
    leftPupil: { detected: false, status: 'LOST', centerNorm: null, centerPx: null, radiusPx: null, diameterPx: null },
    rightPupil: { detected: false, status: 'LOST', centerNorm: null, centerPx: null, radiusPx: null, diameterPx: null },
    rawLeftPupil: { detected: false, status: 'LOST', centerNorm: null, centerPx: null, radiusPx: null, diameterPx: null },
    rawRightPupil: { detected: false, status: 'LOST', centerNorm: null, centerPx: null, radiusPx: null, diameterPx: null },
  });

  const animFrameIdRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const lastUiUpdateRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsTimerRef = useRef<number>(performance.now());
  const currentFpsRef = useRef<number>(0);
  const stabilizerRef = useRef<BilateralPupilStabilizer>(new BilateralPupilStabilizer());

  // Initialize FaceLandmarker
  useEffect(() => {
    let isMounted = true;
    const service = FaceLandmarkerService.getInstance();

    service
      .initialize((status, error) => {
        if (isMounted) {
          setModelStatus(status);
          if (error) setModelError(error);
        }
      })
      .then(() => {
        if (isMounted) {
          setModelStatus('ready');
        }
      })
      .catch((err) => {
        if (isMounted) {
          setModelStatus('error');
          setModelError(err?.message || 'Failed to initialize Face Landmarker');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Frame processing and canvas rendering loop
  const processLoop = useCallback(() => {
    if (!isActive) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const service = FaceLandmarkerService.getInstance();

    if (
      video &&
      video.readyState >= 2 &&
      service.isReady()
    ) {
      const now = performance.now();

      // Calculate FPS
      frameCountRef.current++;
      if (now - fpsTimerRef.current >= 1000) {
        currentFpsRef.current = Math.round(
          (frameCountRef.current * 1000) / (now - fpsTimerRef.current)
        );
        frameCountRef.current = 0;
        fpsTimerRef.current = now;
      }

      // Process only new frames
      if (video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;

        // 1. MediaPipe Face Landmarks
        const landmarks: NormalizedLandmark[] | null = service.detectFrame(video, now);

        // 2. Eye & Iris Extraction
        const ocularData: ExtractedOcularData = EyeExtractor.extractOcularData(landmarks);

        // 3. Bilateral Pupil Image Processing Detection
        const rawLeftPupil = PupilDetector.detectPupil(video, ocularData.leftIris, ocularData.leftEye);
        const rawRightPupil = PupilDetector.detectPupil(video, ocularData.rightIris, ocularData.rightEye);

        // 4. Temporal Stabilization
        const pupilData: BilateralPupilData = stabilizerRef.current.process(rawLeftPupil, rawRightPupil);

        // 5. Tracking Quality Evaluation
        const trackingQuality: TrackingQuality = TrackingEvaluator.evaluate(
          landmarks,
          ocularData,
          currentFpsRef.current
        );

        // 6. Direct Canvas Rendering (Zero React State Overhead)
        if (canvas) {
          renderCanvasOverlay(canvas, video, landmarks, ocularData, pupilData, trackingQuality);
        }

        // Notify parent callback if provided
        onFrame?.({
          timestamp: now,
          allLandmarks: landmarks,
          ocularData,
          pupilData,
          tracking: trackingQuality,
        });

        // 7. Throttled UI State Update (5-10 Hz)
        if (now - lastUiUpdateRef.current > 120) {
          lastUiUpdateRef.current = now;
          setTrackingUiState(trackingQuality);
          setPupilUiState(pupilData);
        }
      }
    }

    animFrameIdRef.current = requestAnimationFrame(processLoop);
  }, [isActive, videoRef, canvasRef, onFrame]);

  // Start / stop loop
  useEffect(() => {
    if (isActive && modelStatus === 'ready') {
      animFrameIdRef.current = requestAnimationFrame(processLoop);
    } else {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      stabilizerRef.current.reset();
    }

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };
  }, [isActive, modelStatus, processLoop]);

  return {
    modelStatus,
    modelError,
    tracking: trackingUiState,
    pupilData: pupilUiState,
  };
}

/**
 * High-performance canvas drawing function for live landmarks, irises, and detected pupils.
 */
function renderCanvasOverlay(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  landmarks: NormalizedLandmark[] | null,
  ocularData: ExtractedOcularData,
  pupilData: BilateralPupilData,
  tracking: TrackingQuality
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = video.videoWidth || canvas.clientWidth || 1280;
  const height = video.videoHeight || canvas.clientHeight || 720;

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  ctx.clearRect(0, 0, width, height);

  // If no landmarks detected, draw subtle target reticle
  if (!landmarks || tracking.status === 'LOST') {
    drawGuidanceReticle(ctx, width, height, '#64748b');
    return;
  }

  // Draw face contour outline (subtle cyan/slate)
  const isDegraded = tracking.status === 'DEGRADED';
  const faceColor = isDegraded ? 'rgba(245, 158, 11, 0.4)' : 'rgba(6, 182, 212, 0.35)';

  // Draw Face Bounding Guide
  if (tracking.faceBoundingBox) {
    const { minX, minY, maxX, maxY } = tracking.faceBoundingBox;
    const pad = 0.03;
    const rx = Math.max(0, (minX - pad) * width);
    const ry = Math.max(0, (minY - pad) * height);
    const rw = Math.min(width, (maxX - minX + pad * 2) * width);
    const rh = Math.min(height, (maxY - minY + pad * 2) * height);

    ctx.strokeStyle = faceColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.setLineDash([]);
  }

  // Draw Left & Right Eye Contours
  if (ocularData.leftEye) {
    drawEyeContour(ctx, ocularData.leftEye.contour, width, height, '#38bdf8');
  }
  if (ocularData.rightEye) {
    drawEyeContour(ctx, ocularData.rightEye.contour, width, height, '#38bdf8');
  }

  // Draw Left Iris (Center Crosshair + Perimeter Ring)
  if (ocularData.leftIris) {
    drawIrisOverlay(ctx, ocularData.leftIris, width, height, 'rgba(6, 182, 212, 0.75)', 'L');
  }

  // Draw Right Iris (Center Crosshair + Perimeter Ring)
  if (ocularData.rightIris) {
    drawIrisOverlay(ctx, ocularData.rightIris, width, height, 'rgba(6, 182, 212, 0.75)', 'R');
  }

  // Draw Left Pupil (Stabilized Boundary & Center)
  if (pupilData.leftPupil.detected && pupilData.leftPupil.centerNorm && pupilData.leftPupil.radiusPx) {
    drawPupilOverlay(
      ctx,
      pupilData.leftPupil,
      width,
      height,
      '#a855f7',
      'PUPIL (L)'
    );
  }

  // Draw Right Pupil (Stabilized Boundary & Center)
  if (pupilData.rightPupil.detected && pupilData.rightPupil.centerNorm && pupilData.rightPupil.radiusPx) {
    drawPupilOverlay(
      ctx,
      pupilData.rightPupil,
      width,
      height,
      '#a855f7',
      'PUPIL (R)'
    );
  }

  // Draw Interpupillary Connection Line
  if (ocularData.leftIris && ocularData.rightIris) {
    const lx = ocularData.leftIris.center.x * width;
    const ly = ocularData.leftIris.center.y * height;
    const rx = ocularData.rightIris.center.x * width;
    const ry = ocularData.rightIris.center.y * height;

    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(rx, ry);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawEyeContour(
  ctx: CanvasRenderingContext2D,
  contour: NormalizedLandmark[],
  w: number,
  h: number,
  color: string
) {
  if (contour.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(contour[0].x * w, contour[0].y * h);
  for (let i = 1; i < contour.length; i++) {
    ctx.lineTo(contour[i].x * w, contour[i].y * h);
  }
  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(56, 189, 248, 0.05)';
  ctx.fill();
}

function drawIrisOverlay(
  ctx: CanvasRenderingContext2D,
  iris: { center: NormalizedLandmark; perimeter: readonly NormalizedLandmark[] | NormalizedLandmark[]; estimatedRadiusNorm: number },
  w: number,
  h: number,
  color: string,
  label: string
) {
  const cx = iris.center.x * w;
  const cy = iris.center.y * h;
  const radiusPx = iris.estimatedRadiusNorm * Math.min(w, h);

  // Draw Iris Perimeter Circle
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(radiusPx, 6), 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.setLineDash([3, 3]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Tag
  ctx.font = '9px "JetBrains Mono", monospace';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`IRIS (${label})`, cx - 18, cy - radiusPx - 5);
}

function drawPupilOverlay(
  ctx: CanvasRenderingContext2D,
  pupil: PupilGeometry,
  w: number,
  h: number,
  color: string,
  label: string
) {
  if (!pupil.centerNorm || !pupil.radiusPx) return;

  const cx = pupil.centerNorm.x * w;
  const cy = pupil.centerNorm.y * h;
  const radiusPx = pupil.radiusPx;

  // Draw Pupil Center Dot & Reticle Crosshair
  ctx.beginPath();
  ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  const cross = 5;
  ctx.beginPath();
  ctx.moveTo(cx - cross, cy);
  ctx.lineTo(cx + cross, cy);
  ctx.moveTo(cx, cy - cross);
  ctx.lineTo(cx, cy + cross);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Draw Pupil Boundary Circle/Ellipse
  ctx.beginPath();
  if (pupil.majorAxisPx && pupil.minorAxisPx && pupil.angleRad !== undefined) {
    ctx.ellipse(cx, cy, pupil.majorAxisPx / 2, pupil.minorAxisPx / 2, pupil.angleRad, 0, Math.PI * 2);
  } else {
    ctx.arc(cx, cy, Math.max(radiusPx, 3), 0, Math.PI * 2);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(168, 85, 247, 0.15)';
  ctx.fill();

  // Draw Pupil Diameter Tag (in pixels)
  if (pupil.diameterPx) {
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#f1f5f9';
    const text = `${label}: ${pupil.diameterPx.toFixed(1)}px`;
    ctx.fillText(text, cx - 30, cy + radiusPx + 14);
  }
}

function drawGuidanceReticle(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string
) {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w * 0.22;
  const ry = h * 0.32;

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 8]);
  ctx.stroke();
  ctx.restore();
}
