import type { PupilGeometry, BilateralPupilData, StabilityStats } from '../../types/vision';

export interface StabilizerConfig {
  /**
   * Exponential moving average factor between 0.1 (heavy smoothing) and 1.0 (no smoothing).
   * Default: 0.65 provides responsive tracking while eliminating high-frequency sensor jitter.
   */
  alpha: number;
  /**
   * Number of consecutive lost frames before transitioning to LOST.
   * Default: 4 frames.
   */
  lossFrameThreshold: number;
  /**
   * Maximum allowed frame-to-frame position jump in normalized space before flagging as jump artifact.
   */
  maxNormalizedJump: number;
  /**
   * Rolling window size for quantitative stability statistics.
   */
  statsWindowSize: number;
}

const DEFAULT_CONFIG: StabilizerConfig = {
  alpha: 0.65,
  lossFrameThreshold: 4,
  maxNormalizedJump: 0.12,
  statsWindowSize: 60,
};

export class SinglePupilStabilizer {
  private config: StabilizerConfig;
  private prevStabilized: PupilGeometry | null = null;
  private consecutiveLostFrames = 0;
  private consecutiveValidFrames = 0;
  private recentDiameters: number[] = [];

  constructor(config: Partial<StabilizerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public process(raw: PupilGeometry): PupilGeometry {
    // Case 1: Valid numeric pupil diameter is present
    if (raw.diameterPx !== null && raw.diameterPx > 0 && raw.centerPx && raw.radiusPx && raw.centerNorm) {
      this.consecutiveLostFrames = 0;
      this.consecutiveValidFrames++;

      // First valid frame or recovering from loss: adopt raw measurement directly
      if (!this.prevStabilized || !this.prevStabilized.diameterPx || this.consecutiveValidFrames === 1) {
        this.addStatSample(raw.diameterPx);
        const initialStabilized: PupilGeometry = {
          ...raw,
          stability: this.calculateStats(),
        };
        this.prevStabilized = initialStabilized;
        return initialStabilized;
      }

      // Check for spatial jump
      const prevNorm = this.prevStabilized.centerNorm;
      let isJump = false;

      if (prevNorm) {
        const dx = raw.centerNorm.x - prevNorm.x;
        const dy = raw.centerNorm.y - prevNorm.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > this.config.maxNormalizedJump) {
          isJump = true;
        }
      }

      // Adaptive smoothing: faster response on large transitions, smoother on stationary gaze
      const a = isJump ? 0.85 : this.config.alpha;
      const smoothedRadiusPx =
        this.prevStabilized.radiusPx !== null
          ? a * raw.radiusPx + (1 - a) * this.prevStabilized.radiusPx
          : raw.radiusPx;

      const smoothedDiameterPx = smoothedRadiusPx * 2;

      const smoothedPxX =
        this.prevStabilized.centerPx !== null
          ? a * raw.centerPx.x + (1 - a) * this.prevStabilized.centerPx.x
          : raw.centerPx.x;

      const smoothedPxY =
        this.prevStabilized.centerPx !== null
          ? a * raw.centerPx.y + (1 - a) * this.prevStabilized.centerPx.y
          : raw.centerPx.y;

      const smoothedNormX =
        this.prevStabilized.centerNorm !== null
          ? a * raw.centerNorm.x + (1 - a) * this.prevStabilized.centerNorm.x
          : raw.centerNorm.x;

      const smoothedNormY =
        this.prevStabilized.centerNorm !== null
          ? a * raw.centerNorm.y + (1 - a) * this.prevStabilized.centerNorm.y
          : raw.centerNorm.y;

      this.addStatSample(smoothedDiameterPx);

      const stabilized: PupilGeometry = {
        detected: raw.detected,
        status: raw.status,
        centerPx: { x: smoothedPxX, y: smoothedPxY },
        centerNorm: { x: smoothedNormX, y: smoothedNormY, z: 0 },
        radiusPx: smoothedRadiusPx,
        diameterPx: smoothedDiameterPx,
        majorAxisPx: raw.majorAxisPx,
        minorAxisPx: raw.minorAxisPx,
        angleRad: raw.angleRad,
        contrastScore: raw.contrastScore,
        circularityScore: raw.circularityScore,
        stability: this.calculateStats(),
      };

      this.prevStabilized = stabilized;
      return stabilized;
    }

    // Case 2: No valid measurement in raw frame (Blink, eye closed, or tracking lost)
    this.consecutiveLostFrames++;
    this.consecutiveValidFrames = 0;

    const status: PupilGeometry['status'] =
      this.consecutiveLostFrames <= this.config.lossFrameThreshold ? 'UNCERTAIN' : 'LOST';

    // When detection is genuinely lost, diameter is null (no fake values!)
    const lostStabilized: PupilGeometry = {
      detected: false,
      status,
      centerNorm: null,
      centerPx: null,
      radiusPx: null,
      diameterPx: null,
      stability: this.calculateStats(),
    };

    this.prevStabilized = lostStabilized;
    return lostStabilized;
  }

  private addStatSample(diameter: number): void {
    if (isNaN(diameter) || diameter <= 0) return;
    this.recentDiameters.push(diameter);
    if (this.recentDiameters.length > this.config.statsWindowSize) {
      this.recentDiameters.shift();
    }
  }

  public calculateStats(): StabilityStats | undefined {
    if (this.recentDiameters.length < 5) {
      return undefined;
    }

    const n = this.recentDiameters.length;
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;

    for (let i = 0; i < n; i++) {
      const v = this.recentDiameters[i];
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
    }

    const mean = sum / n;
    let sumSqDiff = 0;

    for (let i = 0; i < n; i++) {
      const diff = this.recentDiameters[i] - mean;
      sumSqDiff += diff * diff;
    }

    const stdDev = Math.sqrt(sumSqDiff / n);
    const cvPercent = mean > 0 ? (stdDev / mean) * 100 : 0;

    // Calculate median
    const sorted = [...this.recentDiameters].sort((a, b) => a - b);
    const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

    return {
      sampleCount: n,
      minDiameterPx: min,
      maxDiameterPx: max,
      meanDiameterPx: mean,
      medianDiameterPx: median,
      rangePx: max - min,
      stdDevPx: stdDev,
      cvPercent,
    };
  }

  public reset(): void {
    this.prevStabilized = null;
    this.consecutiveLostFrames = 0;
    this.consecutiveValidFrames = 0;
    this.recentDiameters = [];
  }
}

export class BilateralPupilStabilizer {
  private leftStabilizer = new SinglePupilStabilizer();
  private rightStabilizer = new SinglePupilStabilizer();

  public process(rawLeft: PupilGeometry, rawRight: PupilGeometry): BilateralPupilData {
    const leftPupil = this.leftStabilizer.process(rawLeft);
    const rightPupil = this.rightStabilizer.process(rawRight);

    return {
      leftPupil,
      rightPupil,
      rawLeftPupil: rawLeft,
      rawRightPupil: rawRight,
    };
  }

  public reset(): void {
    this.leftStabilizer.reset();
    this.rightStabilizer.reset();
  }
}
