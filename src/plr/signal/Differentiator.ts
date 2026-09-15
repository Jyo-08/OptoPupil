/**
 * OptoPupil - Numerical Differentiator Engine
 * Computes the first derivative of pupil diameter with respect to time (dD/dt in mm/s).
 * Implements non-uniform time step central finite differences and boundary approximations.
 */

export class Differentiator {
  /**
   * Computes velocity dD/dt (in mm/s) from time array (in milliseconds) and diameter values (in mm).
   */
  public static computeVelocity(timeMs: number[], diameterMm: number[]): number[] {
    const n = diameterMm.length;
    if (n === 0) return [];
    if (n === 1) return [0];

    const velocity: number[] = new Array(n).fill(0);

    // Forward difference for the initial sample: (D[1] - D[0]) / dt
    const dt0 = (timeMs[1] - timeMs[0]) / 1000.0;
    velocity[0] = dt0 > 0.0001 ? (diameterMm[1] - diameterMm[0]) / dt0 : 0;

    // Central differences for interior samples: (D[i+1] - D[i-1]) / (t[i+1] - t[i-1])
    for (let i = 1; i < n - 1; i++) {
      const dt = (timeMs[i + 1] - timeMs[i - 1]) / 1000.0;
      if (dt > 0.0001) {
        velocity[i] = (diameterMm[i + 1] - diameterMm[i - 1]) / dt;
      } else {
        velocity[i] = velocity[i - 1];
      }
    }

    // Backward difference for the final sample: (D[n-1] - D[n-2]) / dt
    const dtn = (timeMs[n - 1] - timeMs[n - 2]) / 1000.0;
    velocity[n - 1] = dtn > 0.0001 ? (diameterMm[n - 1] - diameterMm[n - 2]) / dtn : 0;

    return velocity;
  }

  /**
   * Computes acceleration d2D/dt2 (in mm/s^2) from velocity array.
   */
  public static computeAcceleration(timeMs: number[], velocityMmS: number[]): number[] {
    return this.computeVelocity(timeMs, velocityMmS);
  }
}
