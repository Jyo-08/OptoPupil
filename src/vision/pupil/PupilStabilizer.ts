import type { PupilGeometry, BilateralPupilData } from '../../types/vision';

export interface StabilizerConfig {
  /**
   * Exponential moving average factor between 0.1 (heavy smoothing) and 1.0 (no smoothing).
   * Default: 0.65 provides responsive tracking while eliminating high-frequency sensor jitter.
   */
  alpha: number;
  /**
   * Number of consecutive lost frames before transitioning from UNCERTAIN to LOST.
   * Default: 3 frames.
   */
  lossFrameThreshold: number;
  /**
   * Maximum allowed frame-to-frame position jump in normalized space before flagging as jump artifact.
   */
  maxNormalizedJump: number;
}

const DEFAULT_CONFIG: StabilizerConfig = {
  alpha: 0.65,
  lossFrameThreshold: 3,
  maxNormalizedJump: 0.08,
};

export class SinglePupilStabilizer {
  private config: StabilizerConfig;
  private prevStabilized: PupilGeometry | null = null;
  private consecutiveLostFrames = 0;
  private consecutiveValidFrames = 0;

  constructor(config: Partial<StabilizerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public process(raw: PupilGeometry): PupilGeometry {
    // Case 1: Raw pupil is validly DETECTED
    if (raw.detected && raw.centerPx && raw.radiusPx && raw.centerNorm) {
      this.consecutiveLostFrames = 0;
      this.consecutiveValidFrames++;

      // If we just recovered from loss or this is the first frame, reset to raw directly
      if (!this.prevStabilized || !this.prevStabilized.detected || this.consecutiveValidFrames === 1) {
        const initialStabilized: PupilGeometry = {
          ...raw,
          status: 'DETECTED',
        };
        this.prevStabilized = initialStabilized;
        return initialStabilized;
      }

      // Check for sudden spatial jumps
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

      // Apply Exponential Moving Average (EMA) smoothing
      const a = isJump ? 0.9 : this.config.alpha;
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

      const stabilized: PupilGeometry = {
        detected: true,
        status: 'DETECTED',
        centerPx: { x: smoothedPxX, y: smoothedPxY },
        centerNorm: { x: smoothedNormX, y: smoothedNormY, z: 0 },
        radiusPx: smoothedRadiusPx,
        diameterPx: smoothedDiameterPx,
        majorAxisPx: raw.majorAxisPx,
        minorAxisPx: raw.minorAxisPx,
        angleRad: raw.angleRad,
        contrastScore: raw.contrastScore,
        circularityScore: raw.circularityScore,
      };

      this.prevStabilized = stabilized;
      return stabilized;
    }

    // Case 2: Detection failed (Blink, eye closed, or loss)
    this.consecutiveLostFrames++;
    this.consecutiveValidFrames = 0;

    const status: PupilGeometry['status'] =
      this.consecutiveLostFrames <= this.config.lossFrameThreshold ? 'UNCERTAIN' : 'LOST';

    // Do NOT freeze old measurements as if they were current measurements!
    const lostStabilized: PupilGeometry = {
      detected: false,
      status,
      centerNorm: null,
      centerPx: null,
      radiusPx: null,
      diameterPx: null,
    };

    this.prevStabilized = lostStabilized;
    return lostStabilized;
  }

  public reset(): void {
    this.prevStabilized = null;
    this.consecutiveLostFrames = 0;
    this.consecutiveValidFrames = 0;
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
