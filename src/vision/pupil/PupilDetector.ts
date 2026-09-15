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
   * Operates strictly on the real camera frame using adaptive luminance segmentation.
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

    // Convert normalized iris center and radius to pixel space
    const irisCenterPx = {
      x: iris.center.x * videoW,
      y: iris.center.y * videoH,
    };
    const irisRadiusPx = iris.estimatedRadiusNorm * Math.min(videoW, videoH);

    // If iris radius is too small (< 6px), detection is unreliable
    if (irisRadiusPx < 6) {
      return {
        ...defaultLost,
        status: 'UNCERTAIN',
      };
    }

    // Dynamic Iris ROI bounding box (2.4x iris radius)
    const roiSize = Math.min(
      Math.max(Math.ceil(irisRadiusPx * 2.4), 24),
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

    // Step 1: Extract grayscale luminance & collect iris-masked intensity distribution
    const gray = new Float32Array(roiSize * roiSize);
    const irisMask = new Uint8Array(roiSize * roiSize);
    const irisPixelIntensities: number[] = [];

    const irisRadiusSq = irisRadiusPx * irisRadiusPx;
    let minIntensity = 255;
    let maxIntensity = 0;

    for (let y = 0; y < roiSize; y++) {
      const rowOffset = y * roiSize;
      const dy = y - localIrisCenterY;
      const dySq = dy * dy;

      for (let x = 0; x < roiSize; x++) {
        const idx = (rowOffset + x) * 4;
        // Standard perceptual luminance: 0.299R + 0.587G + 0.114B
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        gray[rowOffset + x] = lum;

        const dx = x - localIrisCenterX;
        const distSq = dx * dx + dySq;

        // Mask pixels inside iris circular boundary
        if (distSq <= irisRadiusSq) {
          irisMask[rowOffset + x] = 1;
          irisPixelIntensities.push(lum);
          if (lum < minIntensity) minIntensity = lum;
          if (lum > maxIntensity) maxIntensity = lum;
        }
      }
    }

    if (irisPixelIntensities.length < 20) {
      return defaultLost;
    }

    // Step 2: Adaptive dark pupil threshold calculation
    // Sort iris intensities to find lower dark percentile
    irisPixelIntensities.sort((a, b) => a - b);
    const p15Index = Math.floor(irisPixelIntensities.length * 0.18);
    const p15Intensity = irisPixelIntensities[p15Index];
    const p75Index = Math.floor(irisPixelIntensities.length * 0.75);
    const irisStromaIntensity = irisPixelIntensities[p75Index];

    // Adaptive threshold: isolate darkest cluster while rejecting stroma
    const adaptiveThreshold = Math.min(
      minIntensity + (p15Intensity - minIntensity) * 0.7 + 6,
      (minIntensity + irisStromaIntensity) * 0.48
    );

    // Step 3: Candidate Segmentation & Intensity-Weighted Centroid
    let sumWeight = 0;
    let sumX = 0;
    let sumY = 0;
    let countDark = 0;
    let pupilIntensitySum = 0;

    for (let y = 1; y < roiSize - 1; y++) {
      const rowOffset = y * roiSize;
      for (let x = 1; x < roiSize - 1; x++) {
        const offset = rowOffset + x;
        if (!irisMask[offset]) continue;

        // 3x3 local smoothing to reduce camera noise
        const smoothLum =
          (gray[offset - roiSize - 1] + gray[offset - roiSize] + gray[offset - roiSize + 1] +
           gray[offset - 1] + gray[offset] * 2 + gray[offset + 1] +
           gray[offset + roiSize - 1] + gray[offset + roiSize] + gray[offset + roiSize + 1]) / 10;

        if (smoothLum <= adaptiveThreshold) {
          // Weight inversely proportional to brightness (darker = higher confidence)
          const weight = adaptiveThreshold - smoothLum + 1;
          sumWeight += weight;
          sumX += x * weight;
          sumY += y * weight;
          countDark++;
          pupilIntensitySum += smoothLum;
        }
      }
    }

    if (countDark < 4 || sumWeight <= 0) {
      return {
        ...defaultLost,
        status: 'UNCERTAIN',
      };
    }

    // Centroid in ROI space
    const candidateLocalX = sumX / sumWeight;
    const candidateLocalY = sumY / sumWeight;

    // Convert candidate to native video pixel space
    const candidateVideoX = roiX + candidateLocalX;
    const candidateVideoY = roiY + candidateLocalY;

    // Step 4: Second Central Moments for Ellipse Fit & Area
    let m20 = 0;
    let m02 = 0;
    let m11 = 0;

    for (let y = 1; y < roiSize - 1; y++) {
      const rowOffset = y * roiSize;
      const dy = y - candidateLocalY;
      for (let x = 1; x < roiSize - 1; x++) {
        const offset = rowOffset + x;
        if (!irisMask[offset]) continue;
        if (gray[offset] <= adaptiveThreshold) {
          const dx = x - candidateLocalX;
          m20 += dx * dx;
          m02 += dy * dy;
          m11 += dx * dy;
        }
      }
    }

    // Equivalent circular radius from dark pixel area: A = countDark => r = sqrt(A / pi)
    const equivalentRadiusPx = Math.sqrt(countDark / Math.PI);
    const equivalentDiameterPx = equivalentRadiusPx * 2;

    // Major / minor axes from moments
    const u20 = m20 / countDark;
    const u02 = m02 / countDark;
    const u11 = m11 / countDark;
    const common = Math.sqrt(Math.max(0, (u20 - u02) * (u20 - u02) + 4 * u11 * u11));
    const majorAxisPx = Math.max(2 * Math.sqrt(Math.max(1, (u20 + u02 + common) / 2)), equivalentRadiusPx * 0.9);
    const minorAxisPx = Math.max(2 * Math.sqrt(Math.max(1, (u20 + u02 - common) / 2)), equivalentRadiusPx * 0.7);
    const angleRad = 0.5 * Math.atan2(2 * u11, u20 - u02);

    // Step 5: Candidate Validation Heuristics
    // Criterion A: Distance from Iris Center (physiological pupil is centered within iris)
    const offsetFromIrisX = candidateVideoX - irisCenterPx.x;
    const offsetFromIrisY = candidateVideoY - irisCenterPx.y;
    const distFromIrisCenter = Math.sqrt(offsetFromIrisX * offsetFromIrisX + offsetFromIrisY * offsetFromIrisY);
    const maxAllowedOffset = irisRadiusPx * 0.42;

    // Criterion B: Physiological size ratio (pupil radius is typically 15% - 70% of iris radius)
    const radiusRatio = equivalentRadiusPx / irisRadiusPx;
    const isSizePlausible = radiusRatio >= 0.14 && radiusRatio <= 0.72;

    // Criterion C: Darkness contrast relative to surrounding iris stroma
    const meanPupilLum = pupilIntensitySum / countDark;
    const contrastScore = (irisStromaIntensity - meanPupilLum) / 255;
    const isContrastPlausible = contrastScore >= 0.06;

    // Criterion D: Elliptical shape regularity (ratio of minor to major axis)
    const axisRatio = minorAxisPx / majorAxisPx;
    const circularityScore = Math.min(1, Math.max(0, axisRatio));
    const isShapePlausible = axisRatio >= 0.42;

    // Determine Detection Status
    let status: PupilGeometry['status'] = 'DETECTED';
    let detected = true;

    if (distFromIrisCenter > maxAllowedOffset || !isSizePlausible || !isContrastPlausible) {
      if (distFromIrisCenter > maxAllowedOffset * 1.4 || radiusRatio < 0.10 || radiusRatio > 0.85) {
        status = 'LOST';
        detected = false;
      } else {
        status = 'UNCERTAIN';
        detected = false;
      }
    } else if (!isShapePlausible) {
      status = 'UNCERTAIN';
    }

    if (!detected && status === 'LOST') {
      return defaultLost;
    }

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
      majorAxisPx,
      minorAxisPx,
      angleRad,
      contrastScore,
      circularityScore,
    };
  }
}
