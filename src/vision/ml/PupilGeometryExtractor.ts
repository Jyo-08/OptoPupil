import type { NeuralPupilGeometry, BoundingBox } from './types';

export interface CropInfo {
  videoX: number;
  videoY: number;
  cropWidth: number;
  cropHeight: number;
  videoWidth: number;
  videoHeight: number;
}

export interface PupilGeometryResult {
  valid: boolean;
  areaPx: number;
  centroidX: number;
  centroidY: number;
  bboxX: number;
  bboxY: number;
  bboxWidth: number;
  bboxHeight: number;
  equivalentDiameterPx: number;
  circularity: number;
  geometryConfidence: number; // 0.0 to 1.0
}

export class PupilGeometryExtractor {
  private static readonly MIN_PUPIL_AREA_PX = 10;
  private static readonly MASK_WIDTH = 256;
  private static readonly MASK_HEIGHT = 192;
  private readonly MIN_COMPONENT_AREA = 10;

  /**
   * Extract pupil geometry from a 256x192 binary pupil mask using 8-connected component analysis.
   */
  public static extractGeometry(
    pupilMask: Uint8Array,
    crop: CropInfo
  ): NeuralPupilGeometry {
    const width = this.MASK_WIDTH;
    const height = this.MASK_HEIGHT;
    const totalPixels = width * height;

    const defaultLost: NeuralPupilGeometry = {
      detected: false,
      status: 'LOST',
      areaPx: 0,
      centroidRoi: null,
      centroidVideo: null,
      centroidNorm: null,
      diameterPx: null,
      radiusPx: null,
      circularity: 0,
      boundingBoxRoi: null,
      geometryConfidence: 0,
    };

    if (!pupilMask || pupilMask.length < totalPixels) {
      return defaultLost;
    }

    // 8-connected component labeling using non-recursive queue
    const visited = new Uint8Array(totalPixels);
    const queueX = new Int16Array(totalPixels);
    const queueY = new Int16Array(totalPixels);

    let maxComponentArea = 0;
    let bestSumX = 0;
    let bestSumY = 0;
    let bestMinX = width;
    let bestMinY = height;
    let bestMaxX = 0;
    let bestMaxY = 0;
    let bestPerimeter = 0;

    for (let y = 0; y < height; y++) {
      const rowOffset = y * width;
      for (let x = 0; x < width; x++) {
        const idx = rowOffset + x;
        if (pupilMask[idx] === 1 && visited[idx] === 0) {
          // Start flood-fill for new component
          let head = 0;
          let tail = 0;

          visited[idx] = 1;
          queueX[tail] = x;
          queueY[tail] = y;
          tail++;

          let compArea = 0;
          let compSumX = 0;
          let compSumY = 0;
          let compMinX = x;
          let compMinY = y;
          let compMaxX = x;
          let compMaxY = y;
          let compPerimeter = 0;

          while (head < tail) {
            const qx = queueX[head];
            const qy = queueY[head];
            head++;

            compArea++;
            compSumX += qx;
            compSumY += qy;

            if (qx < compMinX) compMinX = qx;
            if (qx > compMaxX) compMaxX = qx;
            if (qy < compMinY) compMinY = qy;
            if (qy > compMaxY) compMaxY = qy;

            // Check 4-connectivity for perimeter boundary detection
            let isBoundary = false;
            if (qx === 0 || qx === width - 1 || qy === 0 || qy === height - 1) {
              isBoundary = true;
            } else {
              if (
                pupilMask[qy * width + (qx - 1)] === 0 ||
                pupilMask[qy * width + (qx + 1)] === 0 ||
                pupilMask[(qy - 1) * width + qx] === 0 ||
                pupilMask[(qy + 1) * width + qx] === 0
              ) {
                isBoundary = true;
              }
            }
            if (isBoundary) {
              compPerimeter++;
            }

            // 8-neighbors search
            for (let ny = qy - 1; ny <= qy + 1; ny++) {
              if (ny < 0 || ny >= height) continue;
              const nRow = ny * width;
              for (let nx = qx - 1; nx <= qx + 1; nx++) {
                if (nx < 0 || nx >= width) continue;
                const nIdx = nRow + nx;
                if (pupilMask[nIdx] === 1 && visited[nIdx] === 0) {
                  visited[nIdx] = 1;
                  queueX[tail] = nx;
                  queueY[tail] = ny;
                  tail++;
                }
              }
            }
          }

          // Retain largest connected component
          if (compArea > maxComponentArea) {
            maxComponentArea = compArea;
            bestSumX = compSumX;
            bestSumY = compSumY;
            bestMinX = compMinX;
            bestMinY = compMinY;
            bestMaxX = compMaxX;
            bestMaxY = compMaxY;
            bestPerimeter = Math.max(1, compPerimeter);
          }
        }
      }
    }

    // Filter tiny components / noise
    if (maxComponentArea < this.MIN_PUPIL_AREA_PX) {
      return defaultLost;
    }

    // Compute sub-pixel centroid in ROI space
    const centroidRoiX = bestSumX / maxComponentArea;
    const centroidRoiY = bestSumY / maxComponentArea;

    // Bounding box in ROI space
    const boundingBoxRoi: BoundingBox = {
      minX: bestMinX,
      minY: bestMinY,
      maxX: bestMaxX,
      maxY: bestMaxY,
      width: bestMaxX - bestMinX + 1,
      height: bestMaxY - bestMinY + 1,
    };

    // Circularity: 4 * pi * Area / Perimeter^2 (1.0 for perfect circle)
    const rawCircularity = (4 * Math.PI * maxComponentArea) / (bestPerimeter * bestPerimeter);
    const circularity = Math.max(0, Math.min(1.0, isNaN(rawCircularity) ? 0 : rawCircularity));

    // Equivalent circular diameter in 256x192 ROI space: d = 2 * sqrt(Area / pi)
    const equivalentRoiDiameter = 2 * Math.sqrt(maxComponentArea / Math.PI);

    // Map to Native Video Pixel Space
    const scaleX = crop.cropWidth / width;
    const scaleY = crop.cropHeight / height;

    const videoCentroidX = crop.videoX + centroidRoiX * scaleX;
    const videoCentroidY = crop.videoY + centroidRoiY * scaleY;
    const videoDiameterPx = equivalentRoiDiameter * scaleX;
    const videoRadiusPx = videoDiameterPx / 2;

    // Map to Normalized [0, 1] Coordinate Space
    const vW = Math.max(1, crop.videoWidth);
    const vH = Math.max(1, crop.videoHeight);
    const normCentroidX = videoCentroidX / vW;
    const normCentroidY = videoCentroidY / vH;

    // Geometric Quality Heuristic (strictly geometric signal, NOT diagnostic certainty)
    const isPlausibleShape = circularity >= 0.25;
    const isPlausibleSize = videoDiameterPx >= 4 && videoDiameterPx <= crop.cropWidth * 0.85;

    let status: NeuralPupilGeometry['status'] = 'DETECTED';
    let geometryConfidence = circularity;

    if (!isPlausibleShape || !isPlausibleSize) {
      status = 'UNCERTAIN';
      geometryConfidence = Math.max(0.1, circularity * 0.5);
    }

    return {
      detected: true,
      status,
      areaPx: maxComponentArea,
      centroidRoi: {
        x: Number(centroidRoiX.toFixed(2)),
        y: Number(centroidRoiY.toFixed(2)),
      },
      centroidVideo: {
        x: Number(videoCentroidX.toFixed(2)),
        y: Number(videoCentroidY.toFixed(2)),
      },
      centroidNorm: {
        x: Number(normCentroidX.toFixed(4)),
        y: Number(normCentroidY.toFixed(4)),
        z: 0,
      },
      diameterPx: Number(videoDiameterPx.toFixed(2)),
      radiusPx: Number(videoRadiusPx.toFixed(2)),
      circularity: Number(circularity.toFixed(3)),
      boundingBoxRoi,
      geometryConfidence: Number(geometryConfidence.toFixed(3)),
    };
  }

  /**
   * Extracts quantitative pupil geometry from a binary mask.
   * @param pupilMask Binary mask (1 for pupil, 0 otherwise)
   * @param width Image width
   * @param height Image height
   */
  public extract(pupilMask: Uint8Array, width: number, height: number): PupilGeometryResult {
    // 1. Safe handling for malformed input
    if (!pupilMask || pupilMask.length !== width * height || width <= 0 || height <= 0) {
      return this.createInvalidResult();
    }

    // 2. Connected Component Analysis (8-connectivity)
    const largestComponentMask = this.findLargestComponent(pupilMask, width, height);

    if (!largestComponentMask) {
      return this.createInvalidResult();
    }

    // 3. Spatial Moments (Area, Centroid) and Bounding Box
    let m00 = 0; // Area (Σ 1)
    let m10 = 0; // Σ x
    let m01 = 0; // Σ y
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (largestComponentMask[idx] === 1) {
          m00++;
          m10 += x;
          m01 += y;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (m00 < this.MIN_COMPONENT_AREA) {
      return this.createInvalidResult();
    }

    const areaPx = m00;
    const centroidX = m10 / m00;
    const centroidY = m01 / m00;
    const bboxX = minX;
    const bboxY = minY;
    const bboxWidth = maxX - minX + 1; // max coordinates are inclusive
    const bboxHeight = maxY - minY + 1;

    // 4. Equivalent Diameter (Diameter of circle with same area)
    const equivalentDiameterPx = 2 * Math.sqrt(areaPx / Math.PI);

    // 5. Perimeter (4-neighbor boundary count convention)
    const perimeter = this.calculatePerimeter(largestComponentMask, width, height);

    // 6. Circularity (4πA / P²)
    let circularity = 0;
    if (perimeter > 0) {
      circularity = (4 * Math.PI * areaPx) / (perimeter * perimeter);
    }

    // 7. Geometry Confidence
    let geometryConfidence = circularity;
    if (geometryConfidence > 1.0) geometryConfidence = 1.0;
    if (geometryConfidence < 0.0) geometryConfidence = 0.0;

    // Penalize extremely small areas
    if (areaPx < 50) {
      geometryConfidence *= 0.5;
    }

    return {
      valid: true,
      areaPx,
      centroidX,
      centroidY,
      bboxX,
      bboxY,
      bboxWidth,
      bboxHeight,
      equivalentDiameterPx,
      circularity,
      geometryConfidence,
    };
  }

  private createInvalidResult(): PupilGeometryResult {
    return {
      valid: false,
      areaPx: 0,
      centroidX: 0,
      centroidY: 0,
      bboxX: 0,
      bboxY: 0,
      bboxWidth: 0,
      bboxHeight: 0,
      equivalentDiameterPx: 0,
      circularity: 0,
      geometryConfidence: 0,
    };
  }

  /**
   * Finds the largest connected component (8-connectivity).
   */
  private findLargestComponent(mask: Uint8Array, width: number, height: number): Uint8Array | null {
    const visited = new Uint8Array(mask.length);
    let maxArea = 0;
    let bestComponentPixels: number[] = [];

    // 8-neighbor offsets
    const dx = [-1, 0, 1, -1, 1, -1, 0, 1];
    const dy = [-1, -1, -1, 0, 0, 1, 1, 1];

    for (let i = 0; i < mask.length; i++) {
      if (mask[i] === 1 && visited[i] === 0) {
        // BFS for flood fill
        const queue: number[] = [i];
        visited[i] = 1;
        const currentComponent: number[] = [];

        let head = 0;
        while (head < queue.length) {
          const currIdx = queue[head++];
          currentComponent.push(currIdx);

          const cx = currIdx % width;
          const cy = Math.floor(currIdx / width);

          for (let n = 0; n < 8; n++) {
            const nx = cx + dx[n];
            const ny = cy + dy[n];

            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nIdx = ny * width + nx;
              if (mask[nIdx] === 1 && visited[nIdx] === 0) {
                visited[nIdx] = 1;
                queue.push(nIdx);
              }
            }
          }
        }

        if (currentComponent.length > maxArea) {
          maxArea = currentComponent.length;
          bestComponentPixels = currentComponent;
        }
      }
    }

    if (maxArea < this.MIN_COMPONENT_AREA) {
      return null;
    }

    const outMask = new Uint8Array(mask.length);
    for (let i = 0; i < bestComponentPixels.length; i++) {
      outMask[bestComponentPixels[i]] = 1;
    }

    return outMask;
  }

  /**
   * Calculates the perimeter using a 4-neighbor boundary count.
   */
  private calculatePerimeter(mask: Uint8Array, width: number, height: number): number {
    let perimeter = 0;
    const dx = [-1, 1, 0, 0];
    const dy = [0, 0, -1, 1];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (mask[idx] === 1) {
          let isBoundary = false;
          for (let n = 0; n < 4; n++) {
            const nx = x + dx[n];
            const ny = y + dy[n];
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
              isBoundary = true;
              break;
            } else {
              const nIdx = ny * width + nx;
              if (mask[nIdx] === 0) {
                isBoundary = true;
                break;
              }
            }
          }
          if (isBoundary) {
            perimeter++;
          }
        }
      }
    }
    return perimeter;
  }
}
