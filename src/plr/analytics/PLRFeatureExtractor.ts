/**
 * OptoPupil - Quantitative PLR Feature Extraction Engine
 * Extracts physiological kinetic parameters: Baseline, Nadir, Amplitude, Latency,
 * Maximum Constriction Velocity (MCV), Recovery, and Bilateral Asymmetry Indices.
 */

import type {
  ProcessedPLRSeries,
  CleanedEyeSeries,
  EyePLRMetrics,
  BilateralAsymmetryMetrics,
  BilateralPLRReport,
} from '../types';

export class PLRFeatureExtractor {
  /**
   * Generates a complete bilateral PLR kinetic report from processed time-series.
   */
  public static extractReport(
    series: ProcessedPLRSeries,
    rawBaselineLeftPx?: number,
    rawBaselineRightPx?: number
  ): BilateralPLRReport {
    const leftMetrics = this.extractEyeMetrics(series.leftEye, rawBaselineLeftPx);
    const rightMetrics = this.extractEyeMetrics(series.rightEye, rawBaselineRightPx);
    const asymmetry = this.computeAsymmetry(leftMetrics, rightMetrics);

    const overallQuality = Math.round(
      (leftMetrics.qualityScore + rightMetrics.qualityScore + series.recordingQualityScore) / 3
    );

    const isReliable =
      overallQuality >= 60 &&
      leftMetrics.responsePattern !== 'INCONCLUSIVE' &&
      rightMetrics.responsePattern !== 'INCONCLUSIVE';

    const notes: string[] = [];

    if (!isReliable) {
      notes.push('Recording quality below physiological threshold; result marked INCONCLUSIVE.');
    }
    if (asymmetry.isSignificantAsymmetry) {
      notes.push(
        `Significant bilateral asymmetry detected (${asymmetry.asymmetrySeverity.replace('_', ' ')}): ΔConstriction = ${asymmetry.constrictionPercentageDiff.toFixed(1)}%, Anisocoria = ${asymmetry.baselineAnisocoriaMm.toFixed(2)} mm.`
      );
    }
    if (leftMetrics.responsePattern === 'NON_REACTIVE_FIXED') {
      notes.push('Left pupil non-reactive / fixed under light stimulus.');
    }
    if (rightMetrics.responsePattern === 'NON_REACTIVE_FIXED') {
      notes.push('Right pupil non-reactive / fixed under light stimulus.');
    }
    if (leftMetrics.responsePattern === 'SLUGGISH_REDUCED') {
      notes.push('Left pupil exhibited sluggish / reduced constriction velocity.');
    }
    if (rightMetrics.responsePattern === 'SLUGGISH_REDUCED') {
      notes.push('Right pupil exhibited sluggish / reduced constriction velocity.');
    }

    return {
      sessionId: `PLR-${Date.now()}`,
      timestamp: new Date().toISOString(),
      leftEye: leftMetrics,
      rightEye: rightMetrics,
      bilateralAsymmetry: asymmetry,
      timeSeries: series,
      isReliable,
      overallQualityScore: overallQuality,
      notes,
    };
  }

  /**
   * Extracts single-eye quantitative PLR kinetics.
   */
  public static extractEyeMetrics(
    eye: CleanedEyeSeries,
    rawBaselinePx?: number
  ): EyePLRMetrics {
    const { timeMs, cleanMm, velocityMmS, confidence } = eye;

    if (timeMs.length < 5 || cleanMm.length < 5) {
      return this.createInconclusiveMetrics(rawBaselinePx);
    }

    // 1. Baseline Phase Analysis (t <= 0 ms)
    const baselineIndices: number[] = [];
    for (let i = 0; i < timeMs.length; i++) {
      if (timeMs[i] <= 0) {
        baselineIndices.push(i);
      }
    }

    let baselineDiameterMm = 4.0;
    let baselineNoiseSigma = 0.05;

    if (baselineIndices.length > 0) {
      const baselineValues = baselineIndices.map((idx) => cleanMm[idx]);
      const sum = baselineValues.reduce((a, b) => a + b, 0);
      baselineDiameterMm = sum / baselineValues.length;

      // Noise variance
      const variance =
        baselineValues.reduce((acc, v) => acc + Math.pow(v - baselineDiameterMm, 2), 0) /
        baselineValues.length;
      baselineNoiseSigma = Math.sqrt(variance);
    } else {
      // Fallback if pre-stimulus window was short
      baselineDiameterMm = cleanMm[0];
    }

    // 2. Physiological Constriction Window (100ms <= t <= 2500ms)
    let minDiameterMm = baselineDiameterMm;
    let minIdx = -1;

    for (let i = 0; i < timeMs.length; i++) {
      const t = timeMs[i];
      if (t >= 100 && t <= 2500) {
        if (cleanMm[i] < minDiameterMm) {
          minDiameterMm = cleanMm[i];
          minIdx = i;
        }
      }
    }

    // If no nadir found in window, search all post-stimulus
    if (minIdx === -1) {
      for (let i = 0; i < timeMs.length; i++) {
        if (timeMs[i] > 0 && cleanMm[i] < minDiameterMm) {
          minDiameterMm = cleanMm[i];
          minIdx = i;
        }
      }
    }

    // Constriction Amplitude & Percentage
    const constrictionAmplitudeMm = Math.max(0, baselineDiameterMm - minDiameterMm);
    const constrictionPercentage =
      baselineDiameterMm > 0 ? (constrictionAmplitudeMm / baselineDiameterMm) * 100 : 0;
    const timeToMinDiameterMs = minIdx >= 0 ? Math.max(0, timeMs[minIdx]) : 0;

    // 3. Response Latency Detection (Physiological window [140ms, 650ms])
    let latencyMs = 220; // Physiological default if prompt reaction occurs
    let latencyFound = false;
    const velocityThreshold = Math.min(-0.18, -2.0 * Math.max(0.04, baselineNoiseSigma * 5)); // mm/s
    const ampThreshold = Math.max(0.04, baselineNoiseSigma * 1.5);

    for (let i = 0; i < timeMs.length; i++) {
      const t = timeMs[i];
      if (t >= 140 && t <= 750) {
        const v = velocityMmS[i] || 0;
        // Significant negative velocity and departure from baseline
        if (v <= velocityThreshold && cleanMm[i] <= baselineDiameterMm - ampThreshold) {
          latencyMs = Math.round(t);
          latencyFound = true;
          break;
        }
      }
    }

    // 4. Maximum Constriction Velocity (MCV = peak |dD/dt| during constriction)
    let maxVelMagnitude = 0;
    let mcvIdx = -1;
    for (let i = 0; i < timeMs.length; i++) {
      const t = timeMs[i];
      if (t >= 100 && (minIdx === -1 || i <= minIdx + 2)) {
        const v = velocityMmS[i] || 0;
        if (v < 0 && Math.abs(v) > maxVelMagnitude) {
          maxVelMagnitude = Math.abs(v);
          mcvIdx = i;
        }
      }
    }
    const mcvMmS = Number(maxVelMagnitude.toFixed(2));

    // If threshold latency was delayed or not found, use backward tangent projection from MCV point
    if (mcvIdx >= 0 && maxVelMagnitude >= 1.0 && constrictionAmplitudeMm >= 0.3) {
      const tMCV = timeMs[mcvIdx];
      const dMCV = cleanMm[mcvIdx];
      // Intersection of tangent with baseline: t_intercept = t_MCV - (d_MCV - baseline) / v_MCV
      const tangentInterceptT = tMCV - (dMCV - baselineDiameterMm) / (-maxVelMagnitude);
      if (tangentInterceptT >= 150 && tangentInterceptT <= 600) {
        // Average with threshold detection for smooth robust onset
        latencyMs = latencyFound
          ? Math.round(Math.min(latencyMs, tangentInterceptT))
          : Math.round(tangentInterceptT);
        latencyFound = true;
      }
    }

    // 5. Average Constriction Velocity
    const constrictionDurationS = Math.max(0.05, (timeToMinDiameterMs - latencyMs) / 1000);
    const averageConstrictionVelocityMmS = Number(
      (constrictionAmplitudeMm / constrictionDurationS).toFixed(2)
    );

    // 6. 75% Recovery Time (post-nadir)
    let recoveryTime75Ms: number | null = null;
    const recoveryTargetMm = minDiameterMm + constrictionAmplitudeMm * 0.75;
    if (minIdx >= 0 && constrictionAmplitudeMm >= 0.3) {
      for (let i = minIdx; i < timeMs.length; i++) {
        if (cleanMm[i] >= recoveryTargetMm) {
          recoveryTime75Ms = Math.round(timeMs[i] - timeMs[minIdx]);
          break;
        }
      }
    }

    // 7. Quality Score for this eye
    const meanConfidence =
      confidence.reduce((a, b) => a + b, 0) / (confidence.length || 1);
    const snrScore = Math.max(0, Math.min(100, Math.round(100 - baselineNoiseSigma * 200)));
    const qualityScore = Math.round(meanConfidence * 0.6 + snrScore * 0.4);

    // 8. Response Pattern Classification
    let responsePattern: EyePLRMetrics['responsePattern'] = 'NORMAL_REACTIVE';
    if (qualityScore < 40) {
      responsePattern = 'INCONCLUSIVE';
    } else if (constrictionAmplitudeMm < 0.20 || constrictionPercentage < 5.0) {
      responsePattern = 'NON_REACTIVE_FIXED';
    } else if (constrictionPercentage < 14.0 || mcvMmS < 1.4 || latencyMs > 380) {
      responsePattern = 'SLUGGISH_REDUCED';
    } else {
      responsePattern = 'NORMAL_REACTIVE';
    }

    const baselineDiameterPx = rawBaselinePx || baselineDiameterMm * 20;
    const minDiameterPx = baselineDiameterPx * (1 - constrictionPercentage / 100);

    return {
      baselineDiameterMm: Number(baselineDiameterMm.toFixed(2)),
      baselineDiameterPx: Number(baselineDiameterPx.toFixed(1)),
      minDiameterMm: Number(minDiameterMm.toFixed(2)),
      minDiameterPx: Number(minDiameterPx.toFixed(1)),
      constrictionAmplitudeMm: Number(constrictionAmplitudeMm.toFixed(2)),
      constrictionPercentage: Number(constrictionPercentage.toFixed(1)),
      latencyMs,
      mcvMmS,
      timeToMinDiameterMs: Math.round(timeToMinDiameterMs),
      averageConstrictionVelocityMmS,
      recoveryTime75Ms,
      qualityScore,
      responsePattern,
    };
  }

  /**
   * Computes bilateral difference and asymmetry indices.
   */
  public static computeAsymmetry(
    left: EyePLRMetrics,
    right: EyePLRMetrics
  ): BilateralAsymmetryMetrics {
    const baselineAnisocoriaMm = Number(
      Math.abs(left.baselineDiameterMm - right.baselineDiameterMm).toFixed(2)
    );
    const minAnisocoriaMm = Number(
      Math.abs(left.minDiameterMm - right.minDiameterMm).toFixed(2)
    );
    const constrictionPercentageDiff = Number(
      Math.abs(left.constrictionPercentage - right.constrictionPercentage).toFixed(1)
    );
    const amplitudeDifferenceMm = Number(
      Math.abs(left.constrictionAmplitudeMm - right.constrictionAmplitudeMm).toFixed(2)
    );
    const latencyDifferenceMs = Math.abs(left.latencyMs - right.latencyMs);
    const mcvDifferenceMmS = Number(Math.abs(left.mcvMmS - right.mcvMmS).toFixed(2));

    let asymmetrySeverity: BilateralAsymmetryMetrics['asymmetrySeverity'] = 'SYMMETRIC';
    if (baselineAnisocoriaMm >= 1.0 || constrictionPercentageDiff >= 16.0 || latencyDifferenceMs > 120) {
      asymmetrySeverity = 'MARKED_ASYMMETRY';
    } else if (baselineAnisocoriaMm >= 0.4 || constrictionPercentageDiff >= 8.0 || latencyDifferenceMs > 60) {
      asymmetrySeverity = 'MILD_ASYMMETRY';
    }

    const isSignificantAsymmetry = asymmetrySeverity !== 'SYMMETRIC';

    return {
      baselineAnisocoriaMm,
      minAnisocoriaMm,
      constrictionPercentageDiff,
      amplitudeDifferenceMm,
      latencyDifferenceMs,
      mcvDifferenceMmS,
      isSignificantAsymmetry,
      asymmetrySeverity,
    };
  }

  private static createInconclusiveMetrics(rawBaselinePx?: number): EyePLRMetrics {
    return {
      baselineDiameterMm: 0,
      baselineDiameterPx: rawBaselinePx || 0,
      minDiameterMm: 0,
      minDiameterPx: 0,
      constrictionAmplitudeMm: 0,
      constrictionPercentage: 0,
      latencyMs: 0,
      mcvMmS: 0,
      timeToMinDiameterMs: 0,
      averageConstrictionVelocityMmS: 0,
      recoveryTime75Ms: null,
      qualityScore: 0,
      responsePattern: 'INCONCLUSIVE',
    };
  }
}
