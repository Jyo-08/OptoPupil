import { useState, useEffect, useRef, useCallback } from 'react';
import { FaceLandmarkerService } from '../vision/face/FaceLandmarkerService';
import type { FaceLandmarkerStatus } from '../vision/face/types';
import { EyeExtractor } from '../vision/eyes/EyeExtractor';
import { PupilDetector } from '../vision/pupil/PupilDetector';
import { BilateralPupilStabilizer } from '../vision/pupil/PupilStabilizer';
import { TrackingEvaluator } from '../vision/tracking/TrackingEvaluator';
import { ONNXRuntimeService } from '../vision/ml/ONNXRuntimeService';
import { NeuralPupilSegmenter } from '../vision/ml/NeuralPupilSegmenter';
import type {
  ONNXModelStatus,
  ExecutionProvider,
  BilateralNeuralPupilResult,
  NeuralComparisonTelemetry,
} from '../vision/ml/types';
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

  // Neural Shadow ML Pipeline State
  const [neuralModelStatus, setNeuralModelStatus] = useState<ONNXModelStatus>('uninitialized');
  const [neuralProvider, setNeuralProvider] = useState<ExecutionProvider>('wasm');
  const [neuralTelemetry, setNeuralTelemetry] = useState<NeuralComparisonTelemetry>({
    leftDiameterDeltaPx: null,
    rightDiameterDeltaPx: null,
    leftCentroidDistancePx: null,
    rightCentroidDistancePx: null,
    mlFps: 0,
    averageInferenceMs: 0,
    executionProvider: 'wasm',
    modelStatus: 'uninitialized',
  });

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

  // Stable references to callbacks and telemetry
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  const neuralTelemetryRef = useRef(neuralTelemetry);
  neuralTelemetryRef.current = neuralTelemetry;

  const lastVideoTimeRef = useRef<number>(-1);
  const lastUiUpdateRef = useRef<number>(0);
  const lastDiagLogRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsTimerRef = useRef<number>(performance.now());
  const currentFpsRef = useRef<number>(0);
  const stabilizerRef = useRef<BilateralPupilStabilizer>(new BilateralPupilStabilizer());

  // ML Shadow Pipeline Refs
  const isMlInferringRef = useRef<boolean>(false);
  const lastMlTimeRef = useRef<number>(0);
  const mlFrameCountRef = useRef<number>(0);
  const mlFpsTimerRef = useRef<number>(performance.now());
  const currentMlFpsRef = useRef<number>(0);
  const mlLatenciesRef = useRef<number[]>([]);
  const latestNeuralResultRef = useRef<BilateralNeuralPupilResult | null>(null);

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

  // Check if neural shadow inference is explicitly disabled via env flag
  const isNeuralShadowDisabled =
    typeof import.meta !== 'undefined' &&
    import.meta.env?.VITE_DISABLE_NEURAL_SHADOW === 'true';

  // Initialize ONNX Runtime Web Model for Neural Shadow Pipeline
  useEffect(() => {
    if (isNeuralShadowDisabled) {
      setNeuralModelStatus('uninitialized');
      return;
    }

    let isMounted = true;
    const ortService = ONNXRuntimeService.getInstance();

    setNeuralModelStatus('loading');
    ortService
      .initialize('/models/pupil_segmentation.onnx')
      .then((success) => {
        if (isMounted) {
          const status = ortService.getStatus();
          const provider = ortService.getExecutionProvider();
          setNeuralModelStatus(status);
          setNeuralProvider(provider);
          if (!success) {
            console.warn('[useVisionPipeline] ONNX Runtime initialization status:', status);
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          setNeuralModelStatus('error');
          console.warn('[useVisionPipeline] Non-fatal ONNX initialization error:', err);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isNeuralShadowDisabled]);

  // Single Frame Processing Core
  const processFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const service = FaceLandmarkerService.getInstance();

    if (
      !video ||
      video.readyState < 2 ||
      !service.isReady()
    ) {
      return;
    }

    const now = performance.now();

    // Calculate camera FPS
    frameCountRef.current++;
    if (now - fpsTimerRef.current >= 1000) {
      currentFpsRef.current = Math.round(
        (frameCountRef.current * 1000) / (now - fpsTimerRef.current)
      );
      frameCountRef.current = 0;
      fpsTimerRef.current = now;
    }

    // Calculate ML FPS
    if (now - mlFpsTimerRef.current >= 1000) {
      currentMlFpsRef.current = Math.round(
        (mlFrameCountRef.current * 1000) / (now - mlFpsTimerRef.current)
      );
      mlFrameCountRef.current = 0;
      mlFpsTimerRef.current = now;
    }

    // Process only new video frames
    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;

      // 1. MediaPipe Face Landmarks
      const landmarks: NormalizedLandmark[] | null = service.detectFrame(video, now);

      // 2. Eye & Iris Extraction
      const ocularData: ExtractedOcularData = EyeExtractor.extractOcularData(landmarks);

      // 3. Bilateral Deterministic Pupil Image Processing Detection
      const rawLeftPupil = PupilDetector.detectPupil(video, ocularData.leftIris, ocularData.leftEye);
      const rawRightPupil = PupilDetector.detectPupil(video, ocularData.rightIris, ocularData.rightEye);

      // 4. Temporal Stabilization (Deterministic live pipeline)
      const pupilData: BilateralPupilData = stabilizerRef.current.process(rawLeftPupil, rawRightPupil);

      // 5. Tracking Quality Evaluation
      const trackingQuality: TrackingQuality = TrackingEvaluator.evaluate(
        landmarks,
        ocularData,
        currentFpsRef.current
      );

      // 6. Asynchronous Non-Blocking Neural Shadow Pipeline Execution (Throttled ~4 Hz / 250ms)
      const ortService = ONNXRuntimeService.getInstance();
      if (
        !isNeuralShadowDisabled &&
        ortService.isReady() &&
        !isMlInferringRef.current &&
        now - lastMlTimeRef.current >= 250 && // 4 Hz ML throttle to ensure ZERO main-thread starvation
        ocularData.leftEye &&
        ocularData.rightEye &&
        ocularData.leftIris &&
        ocularData.rightIris
      ) {
        isMlInferringRef.current = true;
        lastMlTimeRef.current = now;

        const mlStart = performance.now();
        const captureVideo = video;
        const leftIris = ocularData.leftIris;
        const leftEye = ocularData.leftEye;
        const rightIris = ocularData.rightIris;
        const rightEye = ocularData.rightEye;

        // Run sequentially to guarantee WebAssembly single-session safety
        (async () => {
          const leftResult = await NeuralPupilSegmenter.segmentOcularRegion(captureVideo, leftIris, leftEye);
          const rightResult = await NeuralPupilSegmenter.segmentOcularRegion(captureVideo, rightIris, rightEye);
          return [leftResult, rightResult] as const;
        })()
          .then(([leftResult, rightResult]) => {
            const mlEnd = performance.now();
            const latencyMs = Number((mlEnd - mlStart).toFixed(1));

            mlFrameCountRef.current++;
            mlLatenciesRef.current.push(latencyMs);
            if (mlLatenciesRef.current.length > 20) {
              mlLatenciesRef.current.shift();
            }

            const sumLat = mlLatenciesRef.current.reduce((a, b) => a + b, 0);
            const avgLat = Number((sumLat / mlLatenciesRef.current.length).toFixed(1));

            const shadowResult: BilateralNeuralPupilResult = {
              timestamp: mlEnd,
              left: leftResult.geometry,
              right: rightResult.geometry,
              inferenceLatencyMs: latencyMs,
              executionProvider: ortService.getExecutionProvider(),
              isShadowMode: true,
            };
            latestNeuralResultRef.current = shadowResult;

            // Compute engineering comparison deltas vs deterministic baseline
            let leftDeltaPx: number | null = null;
            let rightDeltaPx: number | null = null;
            let leftCentroidDist: number | null = null;
            let rightCentroidDist: number | null = null;

            if (leftResult.geometry.diameterPx && rawLeftPupil.diameterPx) {
              leftDeltaPx = Number((leftResult.geometry.diameterPx - rawLeftPupil.diameterPx).toFixed(2));
            }
            if (rightResult.geometry.diameterPx && rawRightPupil.diameterPx) {
              rightDeltaPx = Number((rightResult.geometry.diameterPx - rawRightPupil.diameterPx).toFixed(2));
            }
            if (leftResult.geometry.centroidVideo && rawLeftPupil.centerPx) {
              const dx = leftResult.geometry.centroidVideo.x - rawLeftPupil.centerPx.x;
              const dy = leftResult.geometry.centroidVideo.y - rawLeftPupil.centerPx.y;
              leftCentroidDist = Number(Math.sqrt(dx * dx + dy * dy).toFixed(2));
            }
            if (rightResult.geometry.centroidVideo && rawRightPupil.centerPx) {
              const dx = rightResult.geometry.centroidVideo.x - rawRightPupil.centerPx.x;
              const dy = rightResult.geometry.centroidVideo.y - rawRightPupil.centerPx.y;
              rightCentroidDist = Number(Math.sqrt(dx * dx + dy * dy).toFixed(2));
            }

            const updatedTelemetry: NeuralComparisonTelemetry = {
              leftDiameterDeltaPx: leftDeltaPx,
              rightDiameterDeltaPx: rightDeltaPx,
              leftCentroidDistancePx: leftCentroidDist,
              rightCentroidDistancePx: rightCentroidDist,
              mlFps: currentMlFpsRef.current,
              averageInferenceMs: avgLat,
              executionProvider: ortService.getExecutionProvider(),
              modelStatus: ortService.getStatus(),
            };

            neuralTelemetryRef.current = updatedTelemetry;
          })
          .catch((err) => {
            console.warn('[useVisionPipeline] Non-fatal neural shadow execution error:', err);
          })
          .finally(() => {
            isMlInferringRef.current = false;
          });
      }

      // 7. Direct Canvas Rendering (Zero React State Overhead)
      if (canvas) {
        renderCanvasOverlay(
          canvas,
          video,
          landmarks,
          ocularData,
          pupilData,
          trackingQuality,
          latestNeuralResultRef.current
        );
      }

      // Notify parent callback synchronously on every frame
      onFrameRef.current?.({
        timestamp: now,
        allLandmarks: landmarks,
        ocularData,
        pupilData,
        tracking: trackingQuality,
        neuralShadowData: latestNeuralResultRef.current,
        neuralTelemetry: neuralTelemetryRef.current,
      });

      // 8. Throttled UI State Update (~5 Hz / 200ms)
      if (now - lastUiUpdateRef.current >= 200) {
        lastUiUpdateRef.current = now;
        setTrackingUiState(trackingQuality);
        setPupilUiState(pupilData);
        if (neuralTelemetryRef.current) {
          setNeuralTelemetry(neuralTelemetryRef.current);
        }
      }

      // 9. Throttled Diagnostic Logging (~1 Hz)
      if (now - lastDiagLogRef.current >= 1000) {
        lastDiagLogRef.current = now;
        const leftEyeValid = ocularData.leftEye !== null && ocularData.leftIris !== null;
        const rightEyeValid = ocularData.rightEye !== null && ocularData.rightIris !== null;
        const bothEyesValid = leftEyeValid && rightEyeValid;

        console.log(
          `[OPTOPUPIL VISION DIAGNOSTICS]\n` +
          `FACE:\n` +
          `- face detected: ${trackingQuality.faceDetected ? 'yes' : 'no'}\n` +
          `- landmark count: ${landmarks ? landmarks.length : 0}\n\n` +
          `LEFT EYE:\n` +
          `- landmark count: ${ocularData.leftEye ? ocularData.leftEye.contour.length : 0}\n` +
          `- bounding box: ${ocularData.leftEye ? `[minX: ${ocularData.leftEye.boundingBox.minX.toFixed(3)}, minY: ${ocularData.leftEye.boundingBox.minY.toFixed(3)}, maxX: ${ocularData.leftEye.boundingBox.maxX.toFixed(3)}, maxY: ${ocularData.leftEye.boundingBox.maxY.toFixed(3)}]` : 'none'}\n` +
          `- iris detected: ${ocularData.leftIris ? 'yes' : 'no'}\n\n` +
          `RIGHT EYE:\n` +
          `- landmark count: ${ocularData.rightEye ? ocularData.rightEye.contour.length : 0}\n` +
          `- bounding box: ${ocularData.rightEye ? `[minX: ${ocularData.rightEye.boundingBox.minX.toFixed(3)}, minY: ${ocularData.rightEye.boundingBox.minY.toFixed(3)}, maxX: ${ocularData.rightEye.boundingBox.maxX.toFixed(3)}, maxY: ${ocularData.rightEye.boundingBox.maxY.toFixed(3)}]` : 'none'}\n` +
          `- iris detected: ${ocularData.rightIris ? 'yes' : 'no'}\n\n` +
          `TRACKING:\n` +
          `- left eye valid: ${leftEyeValid ? 'yes' : 'no'}\n` +
          `- right eye valid: ${rightEyeValid ? 'yes' : 'no'}\n` +
          `- both eyes valid: ${bothEyesValid ? 'yes' : 'no'}`
        );
      }
    }
  }, [videoRef, canvasRef, isNeuralShadowDisabled]);

  // Robust, Non-Tearing Animation Loop Lifecycle with Controlled 30 FPS Main-Thread Yielding
  useEffect(() => {
    let animId: number | null = null;
    let isRunning = true;
    let lastProcessTime = 0;

    const loop = (timestamp: number) => {
      if (!isRunning) return;

      // Throttle heavy vision processing to ~30 FPS (33ms interval) to guarantee UI responsiveness
      if (timestamp - lastProcessTime >= 33) {
        lastProcessTime = timestamp;
        processFrame();
      }

      animId = requestAnimationFrame(loop);
    };

    if (isActive && modelStatus === 'ready') {
      animId = requestAnimationFrame(loop);
    } else {
      stabilizerRef.current.reset();
    }

    return () => {
      isRunning = false;
      if (animId !== null) {
        cancelAnimationFrame(animId);
      }
    };
  }, [isActive, modelStatus, processFrame]);

  return {
    modelStatus,
    modelError,
    neuralModelStatus,
    neuralProvider,
    neuralTelemetry,
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
  tracking: TrackingQuality,
  neuralData?: BilateralNeuralPupilResult | null
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

  // Draw Left Pupil (Primary Deterministic Stabilized Boundary & Center)
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

  // Draw Right Pupil (Primary Deterministic Stabilized Boundary & Center)
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

  // Draw Neural Shadow Left Pupil (Secondary Intelligent Alignment Indicator)
  if (neuralData?.left.detected && neuralData.left.centroidNorm && neuralData.left.radiusPx) {
    drawNeuralPupilOverlay(
      ctx,
      neuralData.left,
      width,
      height,
      '#10b981',
      'ML (L)'
    );
  }

  // Draw Neural Shadow Right Pupil (Secondary Intelligent Alignment Indicator)
  if (neuralData?.right.detected && neuralData.right.centroidNorm && neuralData.right.radiusPx) {
    drawNeuralPupilOverlay(
      ctx,
      neuralData.right,
      width,
      height,
      '#10b981',
      'ML (R)'
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

function drawMirroredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  fillStyle: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(-1, 1); // Invert text so it displays forward on -scale-x-100 mirrored canvas
  ctx.font = font;
  ctx.fillStyle = fillStyle;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0);
  ctx.restore();
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

  // Tag with unmirrored text
  drawMirroredText(
    ctx,
    `IRIS (${label})`,
    cx,
    cy - radiusPx - 8,
    '10px "JetBrains Mono", monospace',
    '#94a3b8'
  );
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

  // Draw Pupil Diameter Tag with unmirrored physical and pixel readings
  if (pupil.diameterPx) {
    const text = pupil.diameterMm
      ? `${label}: ${pupil.diameterMm.toFixed(1)}mm (${pupil.diameterPx.toFixed(1)}px)`
      : `${label}: ${pupil.diameterPx.toFixed(1)}px`;
    drawMirroredText(
      ctx,
      text,
      cx,
      cy + radiusPx + 14,
      'bold 10px "JetBrains Mono", monospace',
      '#f1f5f9'
    );
  }
}

function drawNeuralPupilOverlay(
  ctx: CanvasRenderingContext2D,
  neuralPupil: import('../vision/ml/types').NeuralPupilGeometry,
  w: number,
  h: number,
  color: string,
  label: string
) {
  if (!neuralPupil.centroidNorm || !neuralPupil.radiusPx) return;

  const cx = neuralPupil.centroidNorm.x * w;
  const cy = neuralPupil.centroidNorm.y * h;
  const radiusPx = neuralPupil.radiusPx;

  // Draw Neural Center Cross Dot
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // Draw Neural Boundary Ring (Dashed Emerald)
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(radiusPx, 3), 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.setLineDash([3, 3]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Tag
  if (neuralPupil.diameterPx) {
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillStyle = '#6ee7b7';
    ctx.fillText(`${label}: ${neuralPupil.diameterPx.toFixed(1)}px`, cx - 28, cy - radiusPx - 6);
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
