import { Injectable } from '@angular/core';

export interface SigmoidParameters {
  A: number;  // Lower asymptote
  K: number;  // Upper asymptote
  B: number;  // Growth rate
  T: number;  // Horizontal shift (inflection point)
  nu: number; // Asymmetry parameter
}

export interface TwoPointFitInput {
  A: number;
  K: number;
  t0: number;
  Y0: number;
  t1: number;
  Y1: number;
  nu: number;
}

export interface FitResult {
  B: number;
  T: number;
  isValid: boolean;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SigmoidMathService {

  /**
   * Calculate B and T parameters from two data points
   * Uses generalized logit formula for arbitrary nu
   */
  calculateBandT(input: TwoPointFitInput): FitResult {
    const { A, K, t0, Y0, t1, Y1, nu } = input;

    // Validate inputs
    const validationError = this.validateFitInputs(input);
    if (validationError) {
      return { B: 0, T: 0, isValid: false, error: validationError };
    }

    try {
      // Normalize to [0, 1]
      const z0 = (Y0 - A) / (K - A);
      const z1 = (Y1 - A) / (K - A);

      // Calculate generalized logit values
      const L0 = this.generalizedLogit(z0, nu);
      const L1 = this.generalizedLogit(z1, nu);

      // Calculate B and T
      const B = (L1 - L0) / (t1 - t0);
      const T = t0 - L0 / B;

      return { B, T, isValid: true };

    } catch (error) {
      return {
        B: 0,
        T: 0,
        isValid: false,
        error: 'Calculation error: ' + (error as Error).message
      };
    }
  }

  /**
   * Generalized logit function: Lν(z) = ln(ν·z^ν / (1 - z^ν))
   */
  private generalizedLogit(z: number, nu: number): number {
    if (z <= 0 || z >= 1) {
      throw new Error('z must be strictly between 0 and 1');
    }

    const zPowNu = Math.pow(z, nu);
    const numerator = nu * zPowNu;
    const denominator = 1 - zPowNu;

    if (denominator <= 0) {
      throw new Error('Invalid denominator in logit calculation');
    }

    return Math.log(numerator / denominator);
  }

  /**
   * Evaluate generalized logistic function at time t
   * Y(t) = A + (K - A) / (1 + ν·e^(-B·(t - T)))^(1/ν)
   * With C=1, Q=ν (making T the inflection point)
   */
  evaluateSigmoid(t: number, params: SigmoidParameters): number {
    const { A, K, B, T, nu } = params;

    const exponential = Math.exp(-B * (t - T));
    const denominator = Math.pow(1 + nu * exponential, 1 / nu);

    return A + (K - A) / denominator;
  }

  /**
   * Calculate early-phase exponential (asymptotic form near lower asymptote)
   * E(t) = A + (K - A)·ν^(-1/ν)·e^(B·(t - T)/ν)
   */
  evaluateEarlyPhaseExponential(t: number, params: SigmoidParameters): number {
    const { A, K, B, T, nu } = params;

    const amplitude = (K - A) * Math.pow(nu, -1 / nu);
    const exponentialTerm = Math.exp((B * (t - T)) / nu);

    return A + amplitude * exponentialTerm;
  }

  /**
   * Validate two-point fit inputs
   */
  private validateFitInputs(input: TwoPointFitInput): string | null {
    const { A, K, t0, Y0, t1, Y1, nu } = input;

    if (A >= K) {
      return 'A must be less than K';
    }

    if (Y0 <= A || Y0 >= K) {
      return 'Y(t₀) must be strictly between A and K';
    }

    if (Y1 <= A || Y1 >= K) {
      return 'Y(t₁) must be strictly between A and K';
    }

    if (t0 === t1) {
      return 't₀ and t₁ must be different';
    }

    if (nu <= 0) {
      return 'ν must be positive';
    }

    if (Math.abs(t1 - t0) < 0.001) {
      return 'Time points are too close together';
    }

    return null;
  }

  /**
   * Validate sigmoid parameters
   */
  validateParameters(params: SigmoidParameters): string | null {
    const { A, K, B, nu } = params;

    if (A >= K) {
      return 'A must be less than K';
    }

    if (B <= 0) {
      return 'B must be positive';
    }

    if (nu <= 0) {
      return 'ν must be positive';
    }

    return null;
  }
}
