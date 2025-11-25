import { Injectable } from '@angular/core';
import { SigmoidMathService, SigmoidParameters } from './sigmoid-math.service';

export interface DataPoint {
  x: number;
  y: number;
}

export interface SigmoidDataSeries {
  sigmoid: DataPoint[];
  exponential: DataPoint[];
}

export interface AxisRange {
  min: number;
  max: number;
}

@Injectable({
  providedIn: 'root'
})
export class SigmoidDataService {

  constructor(private mathService: SigmoidMathService) {}

  /**
   * Generate sigmoid and exponential data series
   * @param params Sigmoid parameters
   * @param pointCount Number of points to generate
   * @param xRange Optional custom x-axis range (if not provided, calculated from params)
   */
  generateSigmoidSeries(params: SigmoidParameters, pointCount: number = 200, xRange?: AxisRange): SigmoidDataSeries {
    const { min, max } = xRange ?? this.calculateXAxisBounds(params);
    const sigmoid: DataPoint[] = [];
    const exponential: DataPoint[] = [];
    const step = (max - min) / pointCount;

    for (let t = min; t <= max; t += step) {
      sigmoid.push({
        x: t,
        y: this.mathService.evaluateSigmoid(t, params)
      });
      exponential.push({
        x: t,
        y: this.mathService.evaluateEarlyPhaseExponential(t, params)
      });
    }

    return { sigmoid, exponential };
  }

  /**
   * Calculate X-axis bounds to show 1% to 99% of sigmoid transition
   * Solves for t where Y(t) reaches 1% and 99% of the range from A to K
   */
  calculateXAxisBounds(params: SigmoidParameters): AxisRange {
    const { A, K, B, T, nu } = params;

    try {
      const p01 = 0.01;
      const p99 = 0.99;

      // Solve: (1 + ν·e^(-B·(t - T)))^(-1/ν) = p
      // Therefore: ν·e^(-B·(t - T)) = p^(-ν) - 1
      // t = T - ln((p^(-ν) - 1) / ν) / B

      const term01 = (Math.pow(1 / p01, nu) - 1) / nu;
      const term99 = (Math.pow(1 / p99, nu) - 1) / nu;

      if (term01 <= 0 || term99 <= 0 || B === 0) {
        return { min: -10, max: 10 };
      }

      const t01 = T - Math.log(term01) / B;
      const t99 = T - Math.log(term99) / B;

      const tMin = Math.min(t01, t99);
      const tMax = Math.max(t01, t99);

      // Add 10% padding
      const range = tMax - tMin;
      const padding = Math.max(range * 0.1, 1);

      return {
        min: tMin - padding,
        max: tMax + padding,
      };
    } catch (error) {
      return { min: -10, max: 10 };
    }
  }

  /**
   * Calculate discrete Y-axis range using 1-2-5 sequence
   * Returns the bounds that should contain dataMin and dataMax with buffer
   */
  calculateYAxisBounds(dataMin: number, dataMax: number): AxisRange {
    // First calculate nice bounds using 1-2-5 sequence
    let desiredMax = this.upperBound(dataMax);
    let desiredMin = this.lowerBound(dataMin);

    // Handle flat case
    if (desiredMax === desiredMin) {
      if (desiredMax === 0) {
        desiredMin = -1;
        desiredMax = 1;
      } else {
        desiredMax = this.stepUp(desiredMax);
      }
    }

    // Add 10% buffer relative to the data range AFTER calculating nice bounds
    const dataRange = Math.abs(dataMax - dataMin);
    const buffer = dataRange * 0.1;

    return { min: desiredMin - buffer, max: desiredMax + buffer };
  }

  // 1-2-5 sequence helper functions

  private almostEqual(a: number, b: number, eps = 1e-12): boolean {
    return Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
  }

  private splitToMantissaDecade(a: number): { m: number; e: number; k: number } {
    const e = Math.floor(Math.log10(a));
    const k = Math.pow(10, e);
    const m = a / k;
    return { m, e, k };
  }

  private niceCeil(x: number): number {
    if (x <= 0) return 0;
    const { m, e, k } = this.splitToMantissaDecade(x);

    if (m <= 1 || this.almostEqual(m, 1)) return 1 * k;
    if (m <= 2 || this.almostEqual(m, 2)) return 2 * k;
    if (m <= 5 || this.almostEqual(m, 5)) return 5 * k;
    return 1 * Math.pow(10, e + 1);
  }

  private niceFloor(x: number): number {
    if (x <= 0) return 0;
    const { m, e, k } = this.splitToMantissaDecade(x);

    if (m >= 5 || this.almostEqual(m, 5)) return 5 * k;
    if (m >= 2 || this.almostEqual(m, 2)) return 2 * k;
    return 1 * k;
  }

  private upperBound(value: number): number {
    if (value > 0) return this.niceCeil(value);
    if (value < 0) return -this.niceFloor(-value);
    return 0;
  }

  private lowerBound(value: number): number {
    if (value < 0) return -this.niceCeil(-value);
    if (value > 0) return this.niceFloor(value);
    return 0;
  }

  private stepUp(value: number): number {
    if (value === 0) return 1;
    const s = Math.sign(value);
    const a = Math.abs(value);
    const { m, e, k } = this.splitToMantissaDecade(a);

    if (!(this.almostEqual(m, 1) || this.almostEqual(m, 2) || this.almostEqual(m, 5))) {
      return s * this.niceCeil(a);
    }

    if (this.almostEqual(m, 1)) return s * (2 * k);
    if (this.almostEqual(m, 2)) return s * (5 * k);
    return s * (1 * Math.pow(10, e + 1));
  }

  stepDown(value: number): number {
    if (value === 0) return 0;
    const s = Math.sign(value);
    const a = Math.abs(value);
    const { m, e, k } = this.splitToMantissaDecade(a);

    if (!(this.almostEqual(m, 1) || this.almostEqual(m, 2) || this.almostEqual(m, 5))) {
      return s * this.niceFloor(a);
    }

    if (this.almostEqual(m, 5)) return s * (2 * k);
    if (this.almostEqual(m, 2)) return s * (1 * k);
    return s * (5 * Math.pow(10, e - 1));
  }
}
