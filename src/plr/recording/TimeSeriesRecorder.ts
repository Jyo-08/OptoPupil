/**
 * OptoPupil - High-Precision PLR Time-Series Recorder
 * Buffers video/vision frame outputs, performs dynamic iris-ratio physical scale calibration,
 * and tracks high-resolution stimulus synchronizations.
 */

import type { VisionFrameOutput } from '../../types/vision';
import type { PLRSample } from '../types';
import { STANDARD_HUMAN_IRIS_DIAMETER_MM } from '../types';

export class TimeSeriesRecorder {
  private samples: PLRSample[] = [];
  private isRecording: boolean = false;
  private sessionStartTime: number = 0;

  /**
   * Starts a new recording buffer.
   */
  public start(): void {
    this.samples = [];
    this.isRecording = true;
    this.sessionStartTime = performance.now();
  }

  /**
   * Stops recording and returns the collected samples.
   */
  public stop(): PLRSample[] {
    this.isRecording = false;
    return [...this.samples];
  }

  /**
   * Resets and clears the buffer.
   */
  public reset(): void {
    this.samples = [];
    this.isRecording = false;
    this.sessionStartTime = 0;
  }

  /**
   * Ingests a frame from the real-time vision loop if recording is active.
   */
  public recordFrame(
    frame: VisionFrameOutput,
    stimulusActive: boolean,
    stimulusOnsetTime?: number
  ): PLRSample | null {
    if (!this.isRecording) return null;

    const now = frame.timestamp || performance.now();
    const tStim = stimulusOnsetTime ?? this.sessionStartTime;
    const relTimeMs = now - tStim;

    const leftPupil = frame.pupilData.leftPupil;
    const rightPupil = frame.pupilData.rightPupil;
    const leftIris = frame.ocularData.leftIris;
    const rightIris = frame.ocularData.rightIris;

    // Iris Radii in pixels (estimate scale from average human horizontal iris diameter of 11.7mm)
    const leftIrisRadiusPx = leftIris ? leftIris.estimatedRadiusNorm * 1280 : null;
    const rightIrisRadiusPx = rightIris ? rightIris.estimatedRadiusNorm * 1280 : null;

    // Millimeter physical scale calibration (prefer already calibrated diameterMm from PupilDetector)
    let leftDiameterMm: number | null = leftPupil.diameterMm ?? null;
    let rightDiameterMm: number | null = rightPupil.diameterMm ?? null;

    if (leftDiameterMm === null && leftPupil.detected && leftPupil.diameterPx) {
      if (leftIrisRadiusPx && leftIrisRadiusPx > 5) {
        leftDiameterMm = (leftPupil.diameterPx / (2 * leftIrisRadiusPx)) * STANDARD_HUMAN_IRIS_DIAMETER_MM;
      } else {
        leftDiameterMm = leftPupil.diameterPx * 0.1;
      }
    }

    if (rightDiameterMm === null && rightPupil.detected && rightPupil.diameterPx) {
      if (rightIrisRadiusPx && rightIrisRadiusPx > 5) {
        rightDiameterMm = (rightPupil.diameterPx / (2 * rightIrisRadiusPx)) * STANDARD_HUMAN_IRIS_DIAMETER_MM;
      } else {
        rightDiameterMm = rightPupil.diameterPx * 0.1;
      }
    }

    // Blink or tracking dropout check
    const isBlink =
      !leftPupil.detected &&
      !rightPupil.detected &&
      (!frame.ocularData.leftEye || !frame.ocularData.rightEye);

    // Derive frame tracking confidence
    const trackingConf =
      frame.tracking.status === 'GOOD'
        ? 95
        : frame.tracking.status === 'DEGRADED'
        ? 65
        : 20;

    const sample: PLRSample = {
      timestamp: now,
      relativeTimeMs: Math.round(relTimeMs),
      leftDiameterPx: leftPupil.detected ? leftPupil.diameterPx : null,
      rightDiameterPx: rightPupil.detected ? rightPupil.diameterPx : null,
      leftIrisRadiusPx,
      rightIrisRadiusPx,
      leftDiameterMm: leftDiameterMm ? Number(leftDiameterMm.toFixed(3)) : null,
      rightDiameterMm: rightDiameterMm ? Number(rightDiameterMm.toFixed(3)) : null,
      stimulusActive,
      trackingStatus: leftPupil.status,
      trackingConfidence: trackingConf,
      isBlinkOrDropout: isBlink,
    };

    this.samples.push(sample);
    return sample;
  }

  /**
   * Returns current buffer sample count.
   */
  public getSampleCount(): number {
    return this.samples.length;
  }

  /**
   * Returns copy of collected samples.
   */
  public getSamples(): PLRSample[] {
    return [...this.samples];
  }

  /**
   * Whether the recorder is currently capturing.
   */
  public isActive(): boolean {
    return this.isRecording;
  }
}
