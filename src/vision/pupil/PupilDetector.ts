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
   * Uses connected-component region growing, specular glint inpainting,
   * seed-relative adaptive thresholding, and sub-pixel moment fitting.
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

    // Step 1: Extract grayscale luminance & collect smoothed array
    const gray = new Float32Array(roiSize * roiSize);
    const smoothed = new Float32Array(roiSize * roiSize);
    const irisRadiusSq = irisRadiusPx * irisRadiusPx;
    const coreRadiusSq = (irisRadiusPx * 0.38) * (irisRadiusPx * 0.38);
    const stromaInnerRadiusSq = (irisRadiusPx * 0.48) * (irisRadiusPx * 0.48);
    const stromaOuterRadiusSq = (irisRadiusPx * 0.88) * (irisRadiusPx * 0.88);

    for (let y = 0; y < roiSize; y++) {
      const rowOffset = y * roiSize;
      for (let x = 0; x < roiSize; x++) {
        const idx = (rowOffset + x) * 4;
        // Standard perceptual luminance: 0.299R + 0.587G + 0.114B
        gray[rowOffset + x] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      }
    }

    // 3x3 local Gaussian-like smoothing to suppress sensor grain
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

    // Step 2: Find the dark pupil core seed within central iris zone
    let minCoreLum = 255;
    let seedX = Math.round(localIrisCenterX);
    let seedY = Math.round(localIrisCenterY);
    const stromaIntensities: number[] = [];

    for (let y = 1; y < roiSize - 1; y++) {
      const rowOffset = y * roiSize;
      const dy = y - localIrisCenterY;
      const dySq = dy * dy;

      for (let x = 1; x < roiSize - 1; x++) {
        const dx = x - localIrisCenterX;
        const distSq = dx * dx + dySq;
        const lum = smoothed[rowOffset + x];

        // Central core for pupil seed
        if (distSq <= coreRadiusSq) {
          if (lum < minCoreLum) {
            minCoreLum = lum;
            seedX = x;
            seedY = y;
          }
        }

        // Surrounding iris ring for stroma baseline
        if (distSq >= stromaInnerRadiusSq && distSq <= stromaOuterRadiusSq) {
          stromaIntensities.push(lum);
        }
      }
    }

    if (stromaIntensities.length < 15 || minCoreLum > 180) {
      return {
        ...defaultLost,
        status: 'UNCERTAIN',
      };
    }

    // Step 3: Compute robust stroma contrast and adaptive threshold
    stromaIntensities.sort((a, b) => a - b);
    const medianStroma = stromaIntensities[Math.floor(stromaIntensities.length * 0.5)];
    const contrastRatio = (medianStroma - minCoreLum) / 255;

    // If pupil core is not significantly darker than iris stroma, return uncertain
    if (contrastRatio < 0.05) {
      return {
        ...defaultLost,
        status: 'UNCERTAIN',
      };
    }

    // Dynamic adaptive threshold relative to core seed and stroma baseline
    const adaptiveThreshold = minCoreLum + (medianStroma - minCoreLum) * 0.44 + 4;

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

    const maxPupilRadius = irisRadiusPx * 0.72;
    const maxPupilRadiusSq = maxPupilRadius * maxPupilRadius;

    while (head < tail) {
      const qx = queueX[head];
      const qy = queueY[head];
      head++;

      // 8-neighborhood expansion
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

          // Connect pixel if dark or if near seed (glint inpainting check)
          const lum = smoothed[nOffset];
          const isDark = lum <= adaptiveThreshold;
          // Glint inpainting: small bright reflection inside the inner core
          const isGlint = !isDark && distSq <= (irisRadiusPx * 0.3) * (irisRadiusPx * 0.3) && lum > 160;

          if (isDark || isGlint) {
            inPupil[nOffset] = 1;
            queueX[tail] = nx;
            queueY[tail] = ny;
            tail++;
          }
        }
      }
    }

    const countDark = tail;
    if (countDark < 6) {
      return {
        ...defaultLost,
        status: 'UNCERTAIN',
      };
    }

    // Step 5: Sub-Pixel Centroid & Central Moments on Connected Pupil Component
    let sumW = 0;
    let sumX = 0;
    let sumY = 0;

    for (let i = 0; i < countDark; i++) {
      const px = queueX[i];
      const py = queueY[i];
      const offset = py * roiSize + px;
      const lum = smoothed[offset];
      // Intensity weighting: darker pixels exert higher pull on the centroid
      const w = Math.max(1, adaptiveThreshold - lum + 10);
      sumW += w;
      sumX += px * w;
      sumY += py * w;
    }

    const candidateLocalX = sumX / sumW;
    const candidateLocalY = sumY / sumW;

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

    // Continuous equivalent circular radius: A = countDark => r = sqrt(A / pi)
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

    // Step 6: Candidate Validation Heuristics
    // Criterion A: Distance from Iris Center
    const offsetFromIrisX = candidateVideoX - irisCenterPx.x;
    const offsetFromIrisY = candidateVideoY - irisCenterPx.y;
    const distFromIrisCenter = Math.sqrt(offsetFromIrisX * offsetFromIrisX + offsetFromIrisY * offsetFromIrisY);
    const maxAllowedOffset = irisRadiusPx * 0.40;

    // Criterion B: Physiological size ratio (pupil radius 14% - 72% of iris radius)
    const radiusRatio = equivalentRadiusPx / irisRadiusPx;
    const isSizePlausible = radiusRatio >= 0.14 && radiusRatio <= 0.72;

    // Criterion C: Elliptical shape regularity (minor / major axis ratio >= 0.45)
    const axisRatio = minorAxisPx / majorAxisPx;
    const circularityScore = Math.min(1, Math.max(0, axisRatio));
    const isShapePlausible = axisRatio >= 0.45;

    // Determine Detection Status
    let status: PupilGeometry['status'] = 'DETECTED';
    let detected = true;

    if (distFromIrisCenter > maxAllowedOffset || !isSizePlausible) {
      if (distFromIrisCenter > maxAllowedOffset * 1.3 || radiusRatio < 0.10 || radiusRatio > 0.85) {
        status = 'LOST';
        detected = false;
      } else {
        status = 'UNCERTAIN';
        detected = false;
      }
    } else if (!isShapePlausible || contrastRatio < 0.08) {
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
      contrastScore: contrastRatio,
      circularityScore,
    };
  }
}
