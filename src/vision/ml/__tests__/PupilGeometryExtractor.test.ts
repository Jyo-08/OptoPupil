import { describe, it, expect } from 'vitest';
import { PupilGeometryExtractor } from '../PupilGeometryExtractor';

describe('PupilGeometryExtractor', () => {
    const extractor = new PupilGeometryExtractor();
    const WIDTH = 256;
    const HEIGHT = 192;

    const createMask = (fillFn: (x: number, y: number) => boolean): Uint8Array => {
        const mask = new Uint8Array(WIDTH * HEIGHT);
        for (let y = 0; y < HEIGHT; y++) {
            for (let x = 0; x < WIDTH; x++) {
                if (fillFn(x, y)) mask[y * WIDTH + x] = 1;
            }
        }
        return mask;
    };

    it('should process a perfect circle correctly', () => {
        const cx = 128;
        const cy = 96;
        const r = 20;
        const mask = createMask((x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2);

        const result = extractor.extract(mask, WIDTH, HEIGHT);
        expect(result.valid).toBe(true);

        // Area of circle radius 20 is approx PI * 400 ~ 1256
        expect(result.areaPx).toBeGreaterThan(1200);
        expect(result.areaPx).toBeLessThan(1300);

        // Centroid should be very close to (128, 96)
        expect(result.centroidX).toBeCloseTo(cx, 1);
        expect(result.centroidY).toBeCloseTo(cy, 1);

        // Bbox should be roughly 40x40
        expect(result.bboxWidth).toBeGreaterThanOrEqual(39);
        expect(result.bboxWidth).toBeLessThanOrEqual(41);
        expect(result.bboxHeight).toBeGreaterThanOrEqual(39);
        expect(result.bboxHeight).toBeLessThanOrEqual(41);

        // Equivalent diameter should be roughly 40
        expect(result.equivalentDiameterPx).toBeCloseTo(40, 1);

        // Circularity should be high (closer to 1, or around 0.8+ for raster)
        expect(result.circularity).toBeGreaterThan(0.7);
    });

    it('should process a known rectangle mask', () => {
        // Rectangle from x=100 to 149 (width=50), y=80 to 119 (height=40)
        const mask = createMask((x, y) => x >= 100 && x < 150 && y >= 80 && y < 120);
        
        const result = extractor.extract(mask, WIDTH, HEIGHT);
        expect(result.valid).toBe(true);
        expect(result.areaPx).toBe(50 * 40); // 2000
        
        // Centroid of [100, 149] is exactly 124.5. 
        expect(result.centroidX).toBeCloseTo(124.5, 3);
        expect(result.centroidY).toBeCloseTo(99.5, 3);
        
        expect(result.bboxX).toBe(100);
        expect(result.bboxY).toBe(80);
        expect(result.bboxWidth).toBe(50);
        expect(result.bboxHeight).toBe(40);
        
        expect(result.equivalentDiameterPx).toBeCloseTo(2 * Math.sqrt(2000 / Math.PI), 3);
    });

    it('should select largest component when disconnected components exist', () => {
        const mask = createMask((x, y) => {
            // Large component: 20x20 at x=100
            const inLarge = x >= 100 && x < 120 && y >= 100 && y < 120;
            // Small component: 10x10 at x=10
            const inSmall = x >= 10 && x < 20 && y >= 10 && y < 20;
            return inLarge || inSmall;
        });

        const result = extractor.extract(mask, WIDTH, HEIGHT);
        expect(result.valid).toBe(true);
        expect(result.areaPx).toBe(400); // Only large component area
        expect(result.bboxX).toBe(100);
    });

    it('should safely handle empty mask', () => {
        const mask = new Uint8Array(WIDTH * HEIGHT);
        const result = extractor.extract(mask, WIDTH, HEIGHT);
        expect(result.valid).toBe(false);
        expect(result.areaPx).toBe(0);
        expect(Number.isNaN(result.centroidX)).toBe(false);
    });

    it('should safely handle malformed mask lengths', () => {
        const mask = new Uint8Array(100);
        const result = extractor.extract(mask, WIDTH, HEIGHT);
        expect(result.valid).toBe(false);
    });

    it('should show lower circularity for irregular/fragmented shapes', () => {
        // Create circle
        const cx = 128, cy = 96, r = 20;
        const circleMask = createMask((x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2);
        
        // Create irregular shape (L-shape)
        const lMask = createMask((x, y) => 
            (x >= 100 && x < 200 && y >= 100 && y < 110) || 
            (x >= 100 && x < 110 && y >= 100 && y < 200)
        );

        const resCircle = extractor.extract(circleMask, WIDTH, HEIGHT);
        const resIrregular = extractor.extract(lMask, WIDTH, HEIGHT);

        expect(resCircle.valid).toBe(true);
        expect(resIrregular.valid).toBe(true);
        expect(resIrregular.circularity).toBeLessThan(resCircle.circularity);
    });

    it('should preserve fractional centroid precision', () => {
        // Create a 10x11 component
        // x from 0 to 9 (10 pixels), y from 0 to 10 (11 pixels)
        const mask = createMask((x, y) => x < 10 && y < 11);
        const res = extractor.extract(mask, WIDTH, HEIGHT);
        expect(res.valid).toBe(true);
        
        // x coords: 0..9 -> sum=45, n=10, avg=4.5
        // y coords: 0..10 -> sum=55, n=11, avg=5.0
        expect(res.centroidX).toBe(4.5);
        expect(res.centroidY).toBe(5.0);
    });
});
