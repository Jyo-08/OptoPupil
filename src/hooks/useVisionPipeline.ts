import { useState, useEffect, useRef, useCallback } from 'react';
import { FaceLandmarkerService } from '../vision/face/FaceLandmarkerService';
import type { FaceLandmarkerStatus } from '../vision/face/types';
import { EyeExtractor } from '../vision/eyes/EyeExtractor';
import { TrackingEvaluator } from '../vision/tracking/TrackingEvaluator';
import type {
  NormalizedLandmark,
  ExtractedOcularData,
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

  // Throttled tracking state for UI display
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

  const animFrameIdRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const lastUiUpdateRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsTimerRef = useRef<number>(performance.now());
  const currentFpsRef = useRef<number>(0);

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

        const landmarks: NormalizedLandmark[] | null = service.detectFrame(video, now);
        const ocularData: ExtractedOcularData = EyeExtractor.extractOcularData(landmarks);
        const trackingQuality: TrackingQuality = TrackingEvaluator.evaluate(
          landmarks,
          ocularData,
          currentFpsRef.current
        );

        // Render overlay directly to canvas without React render overhead
        if (canvas) {
          renderCanvasOverlay(canvas, video, landmarks, ocularData, trackingQuality);
        }

        // Notify parent callback if provided
        onFrame?.({
          timestamp: now,
          allLandmarks: landmarks,
          ocularData,
          tracking: trackingQuality,
        });

        // Throttle React UI state updates to 5-10 Hz to prevent layout thrashing
        if (now - lastUiUpdateRef.current > 150) {
          lastUiUpdateRef.current = now;
          setTrackingUiState(trackingQuality);
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
  };
}

/**
 * High-performance canvas drawing function for live landmarks & ocular overlays.
 */
function renderCanvasOverlay(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  landmarks: NormalizedLandmark[] | null,
  ocularData: ExtractedOcularData,
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
    drawIrisOverlay(ctx, ocularData.leftIris, width, height, '#06b6d4', 'L');
  }

  // Draw Right Iris (Center Crosshair + Perimeter Ring)
  if (ocularData.rightIris) {
    drawIrisOverlay(ctx, ocularData.rightIris, width, height, '#06b6d4', 'R');
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
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
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
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
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

  // Draw Center Point & Micro Crosshair
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  const cross = 6;
  ctx.beginPath();
  ctx.moveTo(cx - cross, cy);
  ctx.lineTo(cx + cross, cy);
  ctx.moveTo(cx, cy - cross);
  ctx.lineTo(cx, cy + cross);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Draw Iris Perimeter Circle
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(radiusPx, 8), 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Draw Tag (L / R)
  ctx.font = '10px "JetBrains Mono", monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, cx - 3, cy - radiusPx - 4);
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
