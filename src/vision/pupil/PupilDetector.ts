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

    // Convert normalized iris center and radius to pixel space
    const irisCenterPx = {
      x: iris.center.x * videoW,
      y: iris.center.y * videoH,
    };
    const irisRadiusPx = iris.estimatedRadiusNorm * Math.min(videoW, videoH);

    // If iris radius is too small (< 4px), camera is too far or eye is closed
    if (irisRadiusPx < 4) {
      return {
        ...defaultLost,
        status: 'LOST',
      };
    }

    // Dynamic Iris ROI bounding box (2.6x iris radius to ensure pupil is fully contained)
    const roiSize = Math.min(
      Math.max(Math.ceil(irisRadiusPx * 2.6), 28),
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

    // Step 1: Extract grayscale luminance & collect iris pixel intensities
    const gray = new Float32Array(roiSize * roiSize);
    const smoothed = new Float32Array(roiSize * roiSize);
    const irisRadiusSq = irisRadiusPx * irisRadiusPx;
    const searchRadiusSq = (irisRadiusPx * 0.55) * (irisRadiusPx * 0.55);

    let minCoreLum = 255;
    let seedX = Math.round(localIrisCenterX);
    let seedY = Math.round(localIrisCenterY);

    for (let y = 0; y < roiSize; y++) {
      const rowOffset = y * roiSize;
      for (let x = 0; x < roiSize; x++) {
        const idx = (rowOffset + x) * 4;
        // Standard perceptual luminance: 0.299R + 0.587G + 0.114B
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        gray[rowOffset + x] = lum;
      }
    }

    // 3x3 local smoothing
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
    const stromaInnerSq = (irisRadiusPx * 0.40) * (irisRadiusPx * 0.40);
    const stromaOuterSq = (irisRadiusPx * 0.95) * (irisRadiusPx * 0.95);

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

        // Dark seed search within central 55% of iris
        if (distSq <= searchRadiusSq) {
          if (lum < minCoreLum) {
            minCoreLum = lum;
            seedX = x;
            seedY = y;
          }
        }

        // Stroma ring sample
        if (distSq >= stromaInnerSq && distSq <= stromaOuterSq) {
          stromaIntensities.push(lum);
        }
      }
    }

    if (irisIntensities.length < 15) {
      return defaultLost;
    }

    // Step 3: Robust Adaptive Threshold
    stromaIntensities.sort((a, b) => a - b);
    irisIntensities.sort((a, b) => a - b);

    const medianStroma = stromaIntensities.length > 0
      ? stromaIntensities[Math.floor(stromaIntensities.length * 0.5)]
      : irisIntensities[Math.floor(irisIntensities.length * 0.75)];

    const minIrisLum = irisIntensities[0];
    const lumDelta = medianStroma - minIrisLum;
    const contrastRatio = Math.max(0, lumDelta / 255);

    // Adaptive threshold calculation
    let adaptiveThreshold: number;
    if (lumDelta > 10) {
      adaptiveThreshold = minIrisLum + lumDelta * 0.48 + 3;
    } else {
      // Low contrast fallback
      adaptiveThreshold = minIrisLum + 6;
    }

    // Step 4: 8-Connected Component Region Growing from Seed + Glint Inpainting
    const visited = new Uint8Array(roiSize * roiSize);
    const inPupil = new Uint8Array(roiSize * roiSize);
    const queueX = new Int16Array(roiSize * roiSize);
    const queueY = new Int16Array(roiSize * roiSize);
    let head = 0;
    let tail = 0;

    const seedIdx = seedY * roiSize + seedX;
    visited[seedIdx] = 1;
    inPupil[seedIdx] = 1;
    queueX[tail] = seedX;
    queueY[tail] = seedY;
    tail++;

    const maxPupilRadius = irisRadiusPx * 0.78;
    const maxPupilRadiusSq = maxPupilRadius * maxPupilRadius;

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
          // Glint inpainting: include enclosed reflection pixels inside central zone
          const isGlint = !isDark && distSq <= (irisRadiusPx * 0.35) * (irisRadiusPx * 0.35) && lum > 140;

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

    // Fallback: If flood fill got fewer than 4 pixels, use simple radius search around seed
    if (countDark < 4) {
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

    if (countDark < 3) {
      return {
        ...defaultLost,
        status: 'UNCERTAIN',
      };
    }

    // Step 5: Sub-Pixel Intensity-Weighted Centroid
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

    // Convert candidate centroid to native video pixel space
    const candidateVideoX = roiX + candidateLocalX;
    const candidateVideoY = roiY + candidateLocalY;

    // Compute central moments for ellipse axes
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

    // Equivalent circular radius: A = countDark => r = sqrt(A / pi)
    const equivalentRadiusPx = Math.max(1.5, Math.sqrt(countDark / Math.PI));
    const equivalentDiameterPx = equivalentRadiusPx * 2;

    // Major / minor axes from moments
    const u20 = m20 / countDark;
    const u02 = m02 / countDark;
    const u11 = m11 / countDark;
    const common = Math.sqrt(Math.max(0, (u20 - u02) * (u20 - u02) + 4 * u11 * u11));
    const majorAxisPx = Math.max(2 * Math.sqrt(Math.max(1, (u20 + u02 + common) / 2)), equivalentRadiusPx * 0.9);
    const minorAxisPx = Math.max(2 * Math.sqrt(Math.max(1, (u20 + u02 - common) / 2)), equivalentRadiusPx * 0.7);
    const angleRad = 0.5 * Math.atan2(2 * u11, u20 - u02);

    // Step 6: Candidate Validation Heuristics
    const offsetFromIrisX = candidateVideoX - irisCenterPx.x;
    const offsetFromIrisY = candidateVideoY - irisCenterPx.y;
    const distFromIrisCenter = Math.sqrt(offsetFromIrisX * offsetFromIrisX + offsetFromIrisY * offsetFromIrisY);
    const maxAllowedOffset = irisRadiusPx * 0.55;

    const radiusRatio = equivalentRadiusPx / irisRadiusPx;
    const isSizePlausible = radiusRatio >= 0.10 && radiusRatio <= 0.80;

    const axisRatio = minorAxisPx / majorAxisPx;
    const circularityScore = Math.min(1, Math.max(0, axisRatio));

    // Determine Detection Status
    let status: PupilGeometry['status'] = 'DETECTED';
    let detected = true;

    if (distFromIrisCenter > maxAllowedOffset || !isSizePlausible) {
      if (distFromIrisCenter > irisRadiusPx * 0.9 || radiusRatio < 0.06 || radiusRatio > 0.95) {
        status = 'LOST';
        detected = false;
      } else {
        status = 'UNCERTAIN';
        detected = true; // Still provide the measurement even if uncertain
      }
    } else if (contrastRatio < 0.03 || circularityScore < 0.30) {
      status = 'UNCERTAIN';
      detected = true;
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
      contrastScore: contrastRatio,
      circularityScore,
    };
  }
}
