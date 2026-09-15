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
    // Minimum number of pixels to be considered a valid pupil candidate.
    // Extremely tiny components are treated as noise/artefacts.
    private readonly MIN_COMPONENT_AREA = 10;

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
        // Deterministic geometric-quality heuristic mapping circularity to [0,1]
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
            geometryConfidence
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
            geometryConfidence: 0
        };
    }

    /**
     * Finds the largest connected component (8-connectivity).
     * Returns a new Uint8Array mask containing only the largest component,
     * or null if no component meets the threshold.
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
     * A pixel is on the boundary if it is 1 and has at least one 4-neighbor that is 0 (or out of bounds).
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
