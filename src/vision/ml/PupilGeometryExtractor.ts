import type { NeuralPupilGeometry, BoundingBox } from './types';

export interface CropInfo {
  videoX: number;
  videoY: number;
  cropWidth: number;
  cropHeight: number;
  videoWidth: number;
  videoHeight: number;
}

export class PupilGeometryExtractor {
  private static readonly MIN_PUPIL_AREA_PX = 10;
  private static readonly MASK_WIDTH = 256;
  private static readonly MASK_HEIGHT = 192;

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
}
