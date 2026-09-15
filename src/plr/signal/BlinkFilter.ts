/**
 * OptoPupil - Blink & Dropout Filtering Engine
 * Detects eye blinks, ocular occlusions, and tracking dropouts,
 * and performs physiological gap interpolation for short dropouts.
 */

export interface RawDataPoint {
  timeMs: number;
  value: number | null;
  confidence: number;
}

export interface FilteredDataPoint {
  timeMs: number;
  value: number;
  confidence: number;
  isInterpolated: boolean;
}

export class BlinkFilter {
  /** Maximum duration of an occluded blink/dropout (in milliseconds) eligible for interpolation */
  private static readonly MAX_INTERPOLATION_GAP_MS = 350;
  /** Minimum physiological human pupil diameter (mm) */
  private static readonly MIN_PHYSIOLOGICAL_PUPIL_MM = 1.0;
  /** Maximum physiological human pupil diameter (mm) */
  private static readonly MAX_PHYSIOLOGICAL_PUPIL_MM = 9.5;

  /**
   * Filters and repairs raw time-series data by removing invalid samples and interpolating short blinks.
   */
  public static filterBlinks(samples: RawDataPoint[]): FilteredDataPoint[] {
    if (!samples || samples.length === 0) {
      return [];
    }

    const n = samples.length;
    const filtered: (FilteredDataPoint | null)[] = new Array(n).fill(null);

    // Step 1: Mark valid physiological points
    for (let i = 0; i < n; i++) {
      const s = samples[i];
      const val = s.value;

      const isValid =
        val !== null &&
        Number.isFinite(val) &&
        val >= this.MIN_PHYSIOLOGICAL_PUPIL_MM &&
        val <= this.MAX_PHYSIOLOGICAL_PUPIL_MM &&
        s.confidence >= 20;

      if (isValid && val !== null) {
        filtered[i] = {
          timeMs: s.timeMs,
          value: val,
          confidence: s.confidence,
          isInterpolated: false,
        };
      }
    }

    // Step 2: Identify dropout gaps and interpolate if duration <= MAX_INTERPOLATION_GAP_MS
    let i = 0;
    while (i < n) {
      if (filtered[i] === null) {
        const gapStartIdx = i;
        while (i < n && filtered[i] === null) {
          i++;
        }
        const gapEndIdx = i; // First valid index after gap (or n)

        const prevValidIdx = gapStartIdx - 1;
        const nextValidIdx = gapEndIdx < n ? gapEndIdx : -1;

        if (prevValidIdx >= 0 && nextValidIdx >= 0) {
          const prev = filtered[prevValidIdx]!;
          const next = filtered[nextValidIdx]!;
          const gapDurationMs = next.timeMs - prev.timeMs;

          if (gapDurationMs <= this.MAX_INTERPOLATION_GAP_MS) {
            // Linear / monotonic interpolation across short blink gap
            for (let k = gapStartIdx; k < gapEndIdx; k++) {
              const curTime = samples[k].timeMs;
              const alpha = (curTime - prev.timeMs) / (next.timeMs - prev.timeMs);
              const interpVal = prev.value + alpha * (next.value - prev.value);
              const interpConf = Math.max(10, Math.min(prev.confidence, next.confidence) * 0.7);

              filtered[k] = {
                timeMs: curTime,
                value: interpVal,
                confidence: interpConf,
                isInterpolated: true,
              };
            }
          }
        } else if (prevValidIdx >= 0 && nextValidIdx < 0) {
          // Trailing edge dropout: extrapolate last known value for up to 100ms
          const prev = filtered[prevValidIdx]!;
          for (let k = gapStartIdx; k < gapEndIdx; k++) {
            if (samples[k].timeMs - prev.timeMs <= 100) {
              filtered[k] = {
                timeMs: samples[k].timeMs,
                value: prev.value,
                confidence: prev.confidence * 0.5,
                isInterpolated: true,
              };
            }
          }
        } else if (prevValidIdx < 0 && nextValidIdx >= 0) {
          // Leading edge dropout: back-fill first known value for up to 100ms
          const next = filtered[nextValidIdx]!;
          for (let k = gapStartIdx; k < gapEndIdx; k++) {
            if (next.timeMs - samples[k].timeMs <= 100) {
              filtered[k] = {
                timeMs: samples[k].timeMs,
                value: next.value,
                confidence: next.confidence * 0.5,
                isInterpolated: true,
              };
            }
          }
        }
      } else {
        i++;
      }
    }

    // Return only successfully reconstructed and valid points
    return filtered.filter((p): p is FilteredDataPoint => p !== null);
  }
}
