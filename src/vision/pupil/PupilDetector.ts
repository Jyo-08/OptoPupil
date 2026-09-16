import type {
  IrisLandmarkSet,
  EyeLandmarkSet,
  PupilGeometry,
} from '../../types/vision';

export class PupilDetector {
  private static offscreenCanvas: HTMLCanvasElement | null = null;
  private static offscreenCtx: CanvasRenderingContext2D | null = null;

  private static getOffscreenContext(width: number, height: number): CanvasRenderingContext2D | null {
    if (!this.offscreenCanvas) {
      this.offscreenCanvas = document.createElement('canvas');
    }
    if (this.offscreenCanvas.width !== width || this.offscreenCanvas.height !== height) {
      this.offscreenCanvas.width = width;
      this.offscreenCanvas.height = height;
    }
    if (!this.offscreenCtx) {
      this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
    }
    return this.offscreenCtx;
  }

  /**
   * Detect pupil geometry inside the dynamic eye/iris region of interest (ROI).
   * Operates strictly on real webcam frames using adaptive intensity segmentation,
   * connected-component localization, and sub-pixel moment fitting.
   */
  public static detectPupil(
    video: HTMLVideoElement,
    iris: IrisLandmarkSet | null,
    eye: EyeLandmarkSet | null
  ): PupilGeometry {
    const defaultLost: PupilGeometry = {
      detected: false,
      status: 'LOST',
      centerNorm: null,
      centerPx: null,
      radiusPx: null,
      diameterPx: null,
    };

    if (!iris || !eye || video.readyState < 2) {
      return defaultLost;
    }

    const videoW = video.videoWidth || 1280;
    const videoH = video.videoHeight || 720;

    // Convert normalized iris center to native video pixel space
    const irisCenterPx = {
      x: iris.center.x * videoW,
      y: iris.center.y * videoH,
    };

    // Calculate true pixel-space iris radius using the 4 perimeter landmarks
    let irisRadiusPx = 0;
    if (iris.perimeter && iris.perimeter.length >= 4) {
      let sumDist = 0;
      for (const pt of iris.perimeter) {
        const dx = (pt.x - iris.center.x) * videoW;
        const dy = (pt.y - iris.center.y) * videoH;
        sumDist += Math.sqrt(dx * dx + dy * dy);
      }
      irisRadiusPx = sumDist / iris.perimeter.length;
    } else {
      irisRadiusPx = iris.estimatedRadiusNorm * ((videoW + videoH) / 2);
    }

    // If iris radius is too small (< 4px), camera is too far or eye is closed
    if (irisRadiusPx < 4) {
      return defaultLost;
    }

    // Dynamic Iris ROI bounding box (2.8x iris radius to ensure pupil is fully contained)
    const roiSize = Math.min(
      Math.max(Math.ceil(irisRadiusPx * 2.8), 32),
      Math.min(videoW, videoH)
    );
    const roiX = Math.max(0, Math.min(Math.floor(irisCenterPx.x - roiSize / 2), videoW - roiSize));
    const roiY = Math.max(0, Math.min(Math.floor(irisCenterPx.y - roiSize / 2), videoH - roiSize));

    // Get offscreen context
    const ctx = this.getOffscreenContext(roiSize, roiSize);
    if (!ctx) {
      return defaultLost;
    }

    // Draw video ROI to offscreen canvas
    ctx.drawImage(video, roiX, roiY, roiSize, roiSize, 0, 0, roiSize, roiSize);
    const imgData = ctx.getImageData(0, 0, roiSize, roiSize);
    const data = imgData.data;

    // Relative iris center in ROI coordinates
    const localIrisCenterX = irisCenterPx.x - roiX;
    const localIrisCenterY = irisCenterPx.y - roiY;

    // Step 1: Extract grayscale luminance
    const gray = new Float32Array(roiSize * roiSize);
    const smoothed = new Float32Array(roiSize * roiSize);
    const irisRadiusSq = irisRadiusPx * irisRadiusPx;
    const searchRadiusSq = (irisRadiusPx * 0.45) * (irisRadiusPx * 0.45);

    for (let y = 0; y < roiSize; y++) {
      const rowOffset = y * roiSize;
      for (let x = 0; x < roiSize; x++) {
        const idx = (rowOffset + x) * 4;
        // Standard perceptual luminance: 0.299R + 0.587G + 0.114B
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        gray[rowOffset + x] = lum;
      }
    }

    // 3x3 local smoothing to reduce sensor grain/noise
    for (let y = 1; y < roiSize - 1; y++) {
      const rowOffset = y * roiSize;
      for (let x = 1; x < roiSize - 1; x++) {
        const offset = rowOffset + x;
        smoothed[offset] =
          (gray[offset - roiSize - 1] + gray[offset - roiSize] * 2 + gray[offset - roiSize + 1] +
           gray[offset - 1] * 2 + gray[offset] * 4 + gray[offset + 1] * 2 +
           gray[offset + roiSize - 1] + gray[offset + roiSize] * 2 + gray[offset + roiSize + 1]) / 16;
      }
    }

    // Step 2: Sample intensities inside iris and locate darkest seed
    const irisIntensities: number[] = [];
    const stromaIntensities: number[] = [];
    const stromaInnerSq = (irisRadiusPx * 0.50) * (irisRadiusPx * 0.50);
    const stromaOuterSq = (irisRadiusPx * 0.95) * (irisRadiusPx * 0.95);

    let minCoreLum = 255;
    let seedX = Math.round(localIrisCenterX);
    let seedY = Math.round(localIrisCenterY);

    for (let y = 1; y < roiSize - 1; y++) {
      const rowOffset = y * roiSize;
      const dy = y - localIrisCenterY;
      const dySq = dy * dy;

      for (let x = 1; x < roiSize - 1; x++) {
        const dx = x - localIrisCenterX;
        const distSq = dx * dx + dySq;
        if (distSq > irisRadiusSq) continue;

        const lum = smoothed[rowOffset + x];
        irisIntensities.push(lum);

        // Dark seed search within central 45% of iris
        if (distSq <= searchRadiusSq) {
          if (lum < minCoreLum) {
            minCoreLum = lum;
            seedX = x;
            seedY = y;
          }
        }

        // Stroma ring sample (50% to 95% radius)
        if (distSq >= stromaInnerSq && distSq <= stromaOuterSq) {
          stromaIntensities.push(lum);
        }
      }
    }

    // Step 3: Robust percentile-based adaptive threshold (resistant to camera noise spikes)
    irisIntensities.sort((a, b) => a - b);
    stromaIntensities.sort((a, b) => a - b);

    // Use 5th percentile instead of absolute minimum (index 0) to avoid dead/noise pixels
    const p05Index = Math.max(0, Math.floor(irisIntensities.length * 0.05));
    const minIrisLum = irisIntensities.length > 0 ? irisIntensities[p05Index] : minCoreLum;
    const medianStroma = stromaIntensities.length > 0
      ? stromaIntensities[Math.floor(stromaIntensities.length * 0.5)]
      : (irisIntensities[Math.floor(irisIntensities.length * 0.75)] ?? (minIrisLum + 20));

    const lumDelta = medianStroma - minIrisLum;
    const contrastRatio = Math.max(0, lumDelta / 255);

    // Adaptive threshold calculation
    let adaptiveThreshold: number;
    if (lumDelta > 15) {
      adaptiveThreshold = minIrisLum + lumDelta * 0.45;
    } else if (lumDelta > 5) {
      // Dark brown eyes / lower contrast
      adaptiveThreshold = minIrisLum + lumDelta * 0.55 + 2;
    } else {
      // Very low contrast / dark lighting fallback
      adaptiveThreshold = minIrisLum + 8;
    }

    // Step 4: 8-Connected Component Region Growing with Glint Inpainting
    const visited = new Uint8Array(roiSize * roiSize);
    const inPupil = new Uint8Array(roiSize * roiSize);
    const queueX = new Int16Array(roiSize * roiSize);
    const queueY = new Int16Array(roiSize * roiSize);
    let head = 0;
    let tail = 0;

    // Constrain seed inside bounds
    seedX = Math.max(1, Math.min(roiSize - 2, seedX));
    seedY = Math.max(1, Math.min(roiSize - 2, seedY));

    const seedIdx = seedY * roiSize + seedX;
    visited[seedIdx] = 1;
    inPupil[seedIdx] = 1;
    queueX[tail] = seedX;
    queueY[tail] = seedY;
    tail++;

    const maxPupilRadius = irisRadiusPx * 0.78;
    const maxPupilRadiusSq = maxPupilRadius * maxPupilRadius;
    const glintRadiusSq = (irisRadiusPx * 0.38) * (irisRadiusPx * 0.38);

    while (head < tail) {
      const qx = queueX[head];
      const qy = queueY[head];
      head++;

      for (let ny = qy - 1; ny <= qy + 1; ny++) {
        if (ny < 1 || ny >= roiSize - 1) continue;
        const nRowOffset = ny * roiSize;
        const dy = ny - localIrisCenterY;
        const dySq = dy * dy;

        for (let nx = qx - 1; nx <= qx + 1; nx++) {
          if (nx < 1 || nx >= roiSize - 1) continue;
          const nOffset = nRowOffset + nx;
          if (visited[nOffset]) continue;
          visited[nOffset] = 1;

          const dx = nx - localIrisCenterX;
          const distSq = dx * dx + dySq;
          if (distSq > irisRadiusSq || distSq > maxPupilRadiusSq) continue;

          const lum = smoothed[nOffset];
          const isDark = lum <= adaptiveThreshold;
          // Corneal reflection / glint inpainting: include bright reflections near pupil center
          const isGlint = !isDark && distSq <= glintRadiusSq && lum > 75;

          if (isDark || isGlint) {
            inPupil[nOffset] = 1;
            queueX[tail] = nx;
            queueY[tail] = ny;
            tail++;
          }
        }
      }
    }

    let countDark = tail;

    // Fallback search around seed if flood-fill collected fewer than 5 pixels
    if (countDark < 5) {
      tail = 0;
      for (let y = 1; y < roiSize - 1; y++) {
        const rowOffset = y * roiSize;
        const dy = y - seedY;
        const dySq = dy * dy;
        for (let x = 1; x < roiSize - 1; x++) {
          const dx = x - seedX;
          const distSq = dx * dx + dySq;
          if (distSq <= (irisRadiusPx * 0.35) * (irisRadiusPx * 0.35)) {
            const lum = smoothed[rowOffset + x];
            if (lum <= adaptiveThreshold + 4) {
              queueX[tail] = x;
              queueY[tail] = y;
              tail++;
            }
          }
        }
      }
      countDark = tail;
    }

    // Step 5: Sub-Pixel Intensity-Weighted Centroid & Moments
    let candidateVideoX: number;
    let candidateVideoY: number;
    let equivalentRadiusPx: number;
    let majorAxisPx: number;
    let minorAxisPx: number;
    let angleRad = 0;
    let circularityScore = 0.85;
    let status: PupilGeometry['status'] = 'DETECTED';
    let detected = true;

    if (countDark >= 4) {
      let sumW = 0;
      let sumX = 0;
      let sumY = 0;

      for (let i = 0; i < countDark; i++) {
        const px = queueX[i];
        const py = queueY[i];
        const offset = py * roiSize + px;
        const lum = smoothed[offset];
        const w = Math.max(1, adaptiveThreshold - lum + 10);
        sumW += w;
        sumX += px * w;
        sumY += py * w;
      }

      const candidateLocalX = sumW > 0 ? sumX / sumW : seedX;
      const candidateLocalY = sumW > 0 ? sumY / sumW : seedY;

      candidateVideoX = roiX + candidateLocalX;
      candidateVideoY = roiY + candidateLocalY;

      // Central moments
      let m20 = 0;
      let m02 = 0;
      let m11 = 0;

      for (let i = 0; i < countDark; i++) {
        const dx = queueX[i] - candidateLocalX;
        const dy = queueY[i] - candidateLocalY;
        m20 += dx * dx;
        m02 += dy * dy;
        m11 += dx * dy;
      }

      equivalentRadiusPx = Math.max(1.5, Math.sqrt(countDark / Math.PI));
      const u20 = m20 / countDark;
      const u02 = m02 / countDark;
      const u11 = m11 / countDark;
      const common = Math.sqrt(Math.max(0, (u20 - u02) * (u20 - u02) + 4 * u11 * u11));
      majorAxisPx = Math.max(2 * Math.sqrt(Math.max(1, (u20 + u02 + common) / 2)), equivalentRadiusPx * 0.9);
      minorAxisPx = Math.max(2 * Math.sqrt(Math.max(1, (u20 + u02 - common) / 2)), equivalentRadiusPx * 0.7);
      angleRad = 0.5 * Math.atan2(2 * u11, u20 - u02);

      // Validation Heuristics
      const offsetFromIrisX = candidateVideoX - irisCenterPx.x;
      const offsetFromIrisY = candidateVideoY - irisCenterPx.y;
      const distFromIrisCenter = Math.sqrt(offsetFromIrisX * offsetFromIrisX + offsetFromIrisY * offsetFromIrisY);
      const maxAllowedOffset = irisRadiusPx * 0.55;
      const radiusRatio = equivalentRadiusPx / irisRadiusPx;
      const isSizePlausible = radiusRatio >= 0.12 && radiusRatio <= 0.80;
      const axisRatio = minorAxisPx / majorAxisPx;
      circularityScore = Math.min(1, Math.max(0, axisRatio));

      if (distFromIrisCenter > maxAllowedOffset || !isSizePlausible) {
        if (distFromIrisCenter > irisRadiusPx * 0.85 || radiusRatio < 0.08 || radiusRatio > 0.92) {
          // Fallback to anatomical iris scaling
          candidateVideoX = irisCenterPx.x;
          candidateVideoY = irisCenterPx.y;
          equivalentRadiusPx = Math.max(2.0, irisRadiusPx * 0.35);
          majorAxisPx = equivalentRadiusPx * 2;
          minorAxisPx = equivalentRadiusPx * 2;
          status = 'UNCERTAIN';
        } else {
          status = 'UNCERTAIN';
        }
      } else if (contrastRatio < 0.02 || circularityScore < 0.25) {
        status = 'UNCERTAIN';
      }
    } else {
      // Anatomical iris center fallback: resting human pupil is concentric with iris (~35% iris diameter)
      candidateVideoX = irisCenterPx.x;
      candidateVideoY = irisCenterPx.y;
      equivalentRadiusPx = Math.max(2.0, irisRadiusPx * 0.35);
      majorAxisPx = equivalentRadiusPx * 2;
      minorAxisPx = equivalentRadiusPx * 2;
      status = 'UNCERTAIN';
    }

    const equivalentDiameterPx = equivalentRadiusPx * 2;
    // Calibrated physical diameter: adult human iris diameter = 11.7 mm
    const diameterMm = Number(((equivalentDiameterPx / (2 * irisRadiusPx)) * 11.7).toFixed(2));

    return {
      detected,
      status,
      centerPx: {
        x: candidateVideoX,
        y: candidateVideoY,
      },
      centerNorm: {
        x: candidateVideoX / videoW,
        y: candidateVideoY / videoH,
        z: 0,
      },
      radiusPx: equivalentRadiusPx,
      diameterPx: equivalentDiameterPx,
      diameterMm,
      majorAxisPx,
      minorAxisPx,
      angleRad,
      contrastScore: contrastRatio,
      circularityScore,
    };
  }
}
