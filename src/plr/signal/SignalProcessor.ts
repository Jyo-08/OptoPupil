/**
 * OptoPupil - Bilateral PLR Signal Processing Pipeline
 * Ingests raw bilateral PLRSample array, executes blink filtering,
 * gap interpolation, Savitzky-Golay smoothing, and velocity derivation.
 */

import { BlinkFilter, type RawDataPoint } from './BlinkFilter';
import { SignalSmoother } from './SignalSmoother';
import { Differentiator } from './Differentiator';
import type { PLRSample, ProcessedPLRSeries, CleanedEyeSeries } from '../types';
import type { StimulusTiming } from '../../stimulus/types';

export class SignalProcessor {
  /**
   * Processes a raw recorded PLR session into cleaned, smoothed, and differentiated time-series.
   */
  public static processSession(
    samples: PLRSample[],
    stimulusTiming: StimulusTiming
  ): ProcessedPLRSeries {
    if (!samples || samples.length === 0) {
      return this.createEmptySeries(stimulusTiming);
    }

    // Sort chronologically by timestamp
    const sorted = [...samples].sort((a, b) => a.timestamp - b.timestamp);

    // Compute relative timestamps (ms) where t = 0 at stimulus onset
    const tStim = stimulusTiming.stimulusOnsetTime;

    // Prepare Left & Right raw data vectors
    const leftRaw: RawDataPoint[] = [];
    const rightRaw: RawDataPoint[] = [];

    for (const s of sorted) {
      const relTime = s.timestamp - tStim;

      leftRaw.push({
        timeMs: relTime,
        value: s.leftDiameterMm,
        confidence: s.trackingConfidence,
      });

      rightRaw.push({
        timeMs: relTime,
        value: s.rightDiameterMm,
        confidence: s.trackingConfidence,
      });
    }

    // Step 1 & 2: Blink Filtering & Gap Interpolation
    const leftFiltered = BlinkFilter.filterBlinks(leftRaw);
    const rightFiltered = BlinkFilter.filterBlinks(rightRaw);

    // Step 3: Savitzky-Golay Polynomial Smoothing
    const leftClean = this.processSingleEye(leftFiltered);
    const rightClean = this.processSingleEye(rightFiltered);

    // Overall duration & sampling rate
    const tStart = sorted[0].timestamp;
    const tEnd = sorted[sorted.length - 1].timestamp;
    const totalDurationMs = Math.max(0, tEnd - tStart);
    const avgFps = totalDurationMs > 0 ? Math.round((sorted.length * 1000) / totalDurationMs) : 0;

    // Quality Score calculation based on valid frame ratio and mean confidence
    const validRatio =
      (leftClean.cleanMm.length + rightClean.cleanMm.length) / (sorted.length * 2 || 1);
    const meanConf =
      sorted.reduce((acc, s) => acc + s.trackingConfidence, 0) / (sorted.length || 1);
    const recordingQualityScore = Math.round(Math.min(100, Math.max(0, validRatio * 50 + meanConf * 0.5)));

    return {
      stimulusTiming,
      leftEye: leftClean,
      rightEye: rightClean,
      totalDurationMs,
      averageFps: avgFps,
      recordingQualityScore,
    };
  }

  /**
   * Helper to smooth and differentiate a single eye's filtered points.
   */
  private static processSingleEye(
    points: { timeMs: number; value: number; confidence: number; isInterpolated: boolean }[]
  ): CleanedEyeSeries {
    if (points.length === 0) {
      return {
        timeMs: [],
        rawMm: [],
        cleanMm: [],
        velocityMmS: [],
        confidence: [],
        isInterpolated: [],
      };
    }

    const timeMs = points.map((p) => p.timeMs);
    const rawMm = points.map((p) => p.value);
    const confidence = points.map((p) => p.confidence);
    const isInterpolated = points.map((p) => p.isInterpolated);

    // Apply Savitzky-Golay Smoothing
    const cleanMm = SignalSmoother.smooth(rawMm, 5);

    // Compute Velocity (dD/dt in mm/s)
    const velocityMmS = Differentiator.computeVelocity(timeMs, cleanMm);

    return {
      timeMs,
      rawMm,
      cleanMm,
      velocityMmS,
      confidence,
      isInterpolated,
    };
  }

  private static createEmptySeries(stimulusTiming: StimulusTiming): ProcessedPLRSeries {
    const emptyEye: CleanedEyeSeries = {
      timeMs: [],
      rawMm: [],
      cleanMm: [],
      velocityMmS: [],
      confidence: [],
      isInterpolated: [],
    };

    return {
      stimulusTiming,
      leftEye: emptyEye,
      rightEye: emptyEye,
      totalDurationMs: 0,
      averageFps: 0,
      recordingQualityScore: 0,
    };
  }
}
