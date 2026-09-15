/**
 * OptoPupil - Signal Smoothing Engine
 * Implements Savitzky-Golay quadratic-polynomial and weighted Gaussian kernel filters
 * designed specifically for preserving the sharp constriction wavefront of the PLR.
 */

export class SignalSmoother {
  /**
   * 5-point Savitzky-Golay polynomial smoothing coefficients (Window = 5, Order = 2)
   * Formula: y_smooth[i] = (-3*y[i-2] + 12*y[i-1] + 17*y[i] + 12*y[i+1] - 3*y[i+2]) / 35
   */
  private static readonly SG_WEIGHTS_5 = [-3, 12, 17, 12, -3];
  private static readonly SG_NORM_5 = 35;

  /**
   * 7-point Savitzky-Golay polynomial smoothing coefficients (Window = 7, Order = 2)
   * Formula: (-2*y[i-3] + 3*y[i-2] + 6*y[i-1] + 7*y[i] + 6*y[i+1] + 3*y[i+2] - 2*y[i+3]) / 21
   */
  private static readonly SG_WEIGHTS_7 = [-2, 3, 6, 7, 6, 3, -2];
  private static readonly SG_NORM_7 = 21;

  /**
   * Applies Savitzky-Golay smoothing to a 1D time-series.
   * If length is small (< 5), falls back to adaptive rolling Gaussian window.
   */
  public static smooth(values: number[], windowSize: 5 | 7 = 5): number[] {
    const n = values.length;
    if (n === 0) return [];
    if (n < 3) return [...values];

    const smoothed: number[] = new Array(n);

    if (windowSize === 7 && n >= 7) {
      const weights = this.SG_WEIGHTS_7;
      const norm = this.SG_NORM_7;
      const half = 3;

      // Interior points
      for (let i = half; i < n - half; i++) {
        let acc = 0;
        for (let j = -half; j <= half; j++) {
          acc += values[i + j] * weights[j + half];
        }
        smoothed[i] = acc / norm;
      }

      // Edge points: weighted boundary window
      for (let i = 0; i < half; i++) {
        smoothed[i] = this.smoothEdgePoint(values, i);
      }
      for (let i = n - half; i < n; i++) {
        smoothed[i] = this.smoothEdgePoint(values, i);
      }
    } else if (n >= 5) {
      const weights = this.SG_WEIGHTS_5;
      const norm = this.SG_NORM_5;
      const half = 2;

      // Interior points
      for (let i = half; i < n - half; i++) {
        let acc = 0;
        for (let j = -half; j <= half; j++) {
          acc += values[i + j] * weights[j + half];
        }
        smoothed[i] = acc / norm;
      }

      // Edge points
      for (let i = 0; i < half; i++) {
        smoothed[i] = this.smoothEdgePoint(values, i);
      }
      for (let i = n - half; i < n; i++) {
        smoothed[i] = this.smoothEdgePoint(values, i);
      }
    } else {
      // 3-point weighted rolling average for very short arrays
      smoothed[0] = (values[0] * 2 + values[1]) / 3;
      for (let i = 1; i < n - 1; i++) {
        smoothed[i] = (values[i - 1] + values[i] * 2 + values[i + 1]) / 4;
      }
      smoothed[n - 1] = (values[n - 2] + values[n - 1] * 2) / 3;
    }

    return smoothed;
  }

  /**
   * Adaptive local Gaussian smoothing for boundary samples.
   */
  private static smoothEdgePoint(values: number[], idx: number): number {
    const n = values.length;
    let sumVal = 0;
    let sumWeight = 0;
    const sigma = 1.0;

    for (let k = Math.max(0, idx - 2); k <= Math.min(n - 1, idx + 2); k++) {
      const diff = k - idx;
      const w = Math.exp(-(diff * diff) / (2 * sigma * sigma));
      sumVal += values[k] * w;
      sumWeight += w;
    }

    return sumWeight > 0 ? sumVal / sumWeight : values[idx];
  }
}
