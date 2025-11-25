import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import { MeasureInput } from '../../../shared/measure-input';

Chart.register(...registerables);

@Component({
  selector: 'app-general-sigmoid-chart',
  imports: [FormsModule, MeasureInput],
  templateUrl: './general-sigmoid-chart.html',
  styleUrl: './general-sigmoid-chart.css',
})
export class GeneralSigmoidChart implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;
  private chart?: Chart<'line'>;
  private resizeObserver?: ResizeObserver;

  // Y-axis scaling configuration (now using 1-2-5 sequence)
  private readonly SHRINK_GRACE_MS = 200;       // Delay before considering shrink
  private readonly SHRINK_STABLE_THRESHOLD = 3; // Consecutive fits before shrinking

  // Y-axis state for discrete scaling
  private currentYMin?: number;
  private currentYMax?: number;
  private lastScaleChange = 0;
  private shrinkStableCountMin = 0;
  private shrinkStableCountMax = 0;

  // Flag to prevent URL updates during initial load
  private initializing = true;

  // Generalized logistic function parameters
  private _A = 0;     // Lower asymptote
  private _K = 1;     // Upper asymptote
  private _B = 1;     // Growth rate
  private _nu = 1;    // Affects near which asymptote growth occurs
  private _T = 0;     // Horizontal shift (inflection point position)

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  // Getters and setters to ensure numeric types
  get A(): number { return this._A; }
  set A(value: number | string) { this._A = Number(value); }

  get K(): number { return this._K; }
  set K(value: number | string) { this._K = Number(value); }

  get B(): number { return this._B; }
  set B(value: number | string) { this._B = Number(value); }

  get nu(): number { return this._nu; }
  set nu(value: number | string) { this._nu = Number(value); }

  get T(): number { return this._T; }
  set T(value: number | string) { this._T = Number(value); }

  // C and Q are now derived (not user-controlled)
  // C = 1 (fixed for clean interpretation of K as upper asymptote)
  // Q = ν (makes T exactly the inflection point time)
  get C(): number { return 1; }
  get Q(): number { return this._nu; }

  ngOnInit(): void {
    // Read query params to get initial values
    const params = this.route.snapshot.queryParams;

    this._A = this.parseParam(params['A'], 0);
    this._K = this.parseParam(params['K'], 1);
    this._B = this.parseParam(params['B'], 1);
    this._nu = this.parseParam(params['nu'], 1);
    this._T = this.parseParam(params['T'], 0);

    // Mark initialization complete after a tick
    setTimeout(() => {
      this.initializing = false;
    }, 0);
  }

  private parseParam(value: string | undefined, defaultValue: number): number {
    if (value === undefined || value === '') return defaultValue;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  private updateQueryParams(): void {
    if (this.initializing) return;

    const queryParams: Record<string, string> = {
      A: this._A.toString(),
      K: this._K.toString(),
      B: this._B.toString(),
      nu: this._nu.toString(),
      T: this._T.toString(),
    };

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  ngAfterViewInit(): void {
    this.createChart();

    // Watch for container resize to fix Chart.js resize issues
    const container = this.chartCanvas.nativeElement.parentElement;
    if (container) {
      this.resizeObserver = new ResizeObserver(() => {
        this.chart?.resize();
      });
      this.resizeObserver.observe(container);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.chart?.destroy();
  }

  protected onParameterChange(): void {
    this.updateChart();
    this.updateQueryParams();
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

  private stepDown(value: number): number {
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

  private calculateYAxisRange(): { min: number; max: number } {
    const dataMin = Math.min(this.A, this.K);
    const dataMax = Math.max(this.A, this.K);
    const now = Date.now();

    // Calculate desired bounds from data using 1-2-5 sequence
    let desiredMax = this.upperBound(dataMax);
    let desiredMin = this.lowerBound(dataMin);

    // Handle flat case (when both equal)
    if (desiredMax === desiredMin) {
      if (desiredMax === 0) {
        desiredMin = -1;
        desiredMax = 1;
      } else {
        desiredMax = this.stepUp(desiredMax);
      }
    }

    // Initialize state on first call
    if (this.currentYMin === undefined || this.currentYMax === undefined) {
      this.currentYMin = desiredMin;
      this.currentYMax = desiredMax;
      this.lastScaleChange = now;
      this.shrinkStableCountMin = 0;
      this.shrinkStableCountMax = 0;
      // Fall through to apply buffer below
    }

    // Check for expansion (immediate)
    let expanded = false;
    if (dataMax > this.currentYMax) {
      this.currentYMax = desiredMax;
      expanded = true;
    }
    if (dataMin < this.currentYMin) {
      this.currentYMin = desiredMin;
      expanded = true;
    }

    if (expanded) {
      this.lastScaleChange = now;
      this.shrinkStableCountMin = 0;
      this.shrinkStableCountMax = 0;
      return { min: this.currentYMin, max: this.currentYMax };
    }

    // Check for shrinking (deferred with hysteresis)
    if (now - this.lastScaleChange >= this.SHRINK_GRACE_MS) {
      let shrunk = false;

      // Try to shrink max independently
      const candidateMax = this.stepDown(this.currentYMax);
      if (dataMax <= candidateMax) {
        this.shrinkStableCountMax++;
        if (this.shrinkStableCountMax >= this.SHRINK_STABLE_THRESHOLD) {
          this.currentYMax = candidateMax;
          shrunk = true;
          this.shrinkStableCountMax = 0;
        }
      } else {
        this.shrinkStableCountMax = 0;
      }

      // Try to shrink min independently
      const candidateMin = this.stepDown(this.currentYMin);
      if (dataMin >= candidateMin) {
        this.shrinkStableCountMin++;
        if (this.shrinkStableCountMin >= this.SHRINK_STABLE_THRESHOLD) {
          this.currentYMin = candidateMin;
          shrunk = true;
          this.shrinkStableCountMin = 0;
        }
      } else {
        this.shrinkStableCountMin = 0;
      }

      // Update last scale change if either axis shrunk
      if (shrunk) {
        this.lastScaleChange = now;
      }
    } else {
      this.shrinkStableCountMin = 0;
      this.shrinkStableCountMax = 0;
    }

    // Add 10% buffer relative to the data range AFTER calculating nice bounds
    const dataRange = Math.abs(dataMax - dataMin);
    const buffer = dataRange * 0.1;

    return { min: this.currentYMin - buffer, max: this.currentYMax + buffer };
  }

  private updateChart(): void {
    if (!this.chart) return;

    const { sigmoid, exponential, lowerBound, upperBound } = this.generateData();
    this.chart.data.datasets[0].data = sigmoid;
    this.chart.data.datasets[1].data = exponential;
    this.chart.data.datasets[2].data = lowerBound;
    this.chart.data.datasets[3].data = upperBound;

    // Update Y-axis scale based on asymptotes
    const { min, max } = this.calculateYAxisRange();

    // Update the y-axis min/max
    (this.chart.options.scales as any).y.min = min;
    (this.chart.options.scales as any).y.max = max;

    this.chart.update();
  }

  private generalizedLogistic(t: number): number {
    // Y(t) = A + (K - A) / (C + Q·e^(-B·(t - T)))^(1/ν)
    const exponential = Math.exp(-this.B * (t - this.T));
    const denominator = Math.pow(this.C + this.Q * exponential, 1 / this.nu);
    return this.A + (this.K - this.A) / denominator;
  }

  private earlyPhaseExponential(t: number): number {
    // Early-phase asymptotic exponential near lower asymptote A
    // E(t) = A + (K - A)·Q^(-1/ν)·e^(B·(t - T)/ν)
    // This is the mathematically correct leading-order term as t → -∞
    const amplitude = (this.K - this.A) * Math.pow(this.Q, -1 / this.nu);
    const exponentialTerm = Math.exp((this.B * (t - this.T)) / this.nu);
    return this.A + amplitude * exponentialTerm;
  }

  private calculateXAxisBounds(): { min: number; max: number } {
    // Solve for t where Y(t) = A + p*(K - A) for p = 0.01 and p = 0.99
    // From: (C + Q·e^(-B·(t - T)))^(1/ν) = 1/p
    // We get: t = T - ln(((1/p)^ν - C) / Q) / B

    try {
      const p01 = 0.01;
      const p99 = 0.99;

      const term01 = (Math.pow(1 / p01, this.nu) - this.C) / this.Q;
      const term99 = (Math.pow(1 / p99, this.nu) - this.C) / this.Q;

      // Check for valid logarithm arguments
      if (term01 <= 0 || term99 <= 0 || this.B === 0) {
        // Fall back to fixed range if parameters create invalid bounds
        return { min: -10, max: 10 };
      }

      const t01 = this.T - Math.log(term01) / this.B;
      const t99 = this.T - Math.log(term99) / this.B;

      const tMin = Math.min(t01, t99);
      const tMax = Math.max(t01, t99);

      // Add some padding (10% on each side)
      const range = tMax - tMin;
      const padding = Math.max(range * 0.1, 1); // At least 1 unit of padding

      return {
        min: tMin - padding,
        max: tMax + padding,
      };
    } catch (error) {
      // Fallback to fixed range on any error
      return { min: -10, max: 10 };
    }
  }

  private generateData(): {
    sigmoid: { x: number; y: number }[];
    exponential: { x: number; y: number }[];
    lowerBound: { x: number; y: number }[];
    upperBound: { x: number; y: number }[];
  } {
    const { min, max } = this.calculateXAxisBounds();
    const sigmoid: { x: number; y: number }[] = [];
    const exponential: { x: number; y: number }[] = [];
    const step = (max - min) / 200; // 200 points for smooth curve

    for (let t = min; t <= max; t += step) {
      sigmoid.push({ x: t, y: this.generalizedLogistic(t) });
      exponential.push({ x: t, y: this.earlyPhaseExponential(t) });
    }

    // Horizontal bound lines (just need start and end points)
    const lowerBound = [
      { x: min, y: this.A },
      { x: max, y: this.A },
    ];
    const upperBound = [
      { x: min, y: this.K },
      { x: max, y: this.K },
    ];

    return { sigmoid, exponential, lowerBound, upperBound };
  }

  private createChart(): void {
    const { sigmoid, exponential, lowerBound, upperBound } = this.generateData();

    // Calculate Y-axis range based on asymptotes
    const { min, max } = this.calculateYAxisRange();

    this.chart = new Chart(this.chartCanvas.nativeElement, {
      type: 'line' as const,
      data: {
        datasets: [
          {
            label: 'Generalized Logistic Function',
            data: sigmoid,
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.1)',
            tension: 0.4,
            pointRadius: 0,
            borderWidth: 2,
          },
          {
            label: 'Fitted Exponential',
            data: exponential,
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            tension: 0,
            pointRadius: 0,
            borderWidth: 2,
            borderDash: [5, 5],
          },
          {
            label: 'Lower bound',
            data: lowerBound,
            borderColor: 'rgba(150, 150, 150, 0.5)',
            backgroundColor: 'transparent',
            tension: 0,
            pointRadius: 0,
            borderWidth: 1,
            borderDash: [3, 3],
          },
          {
            label: 'Upper bound',
            data: upperBound,
            borderColor: 'rgba(150, 150, 150, 0.5)',
            backgroundColor: 'transparent',
            tension: 0,
            pointRadius: 0,
            borderWidth: 1,
            borderDash: [3, 3],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          x: {
            type: 'linear',
            title: {
              display: true,
              text: 'Time',
            },
          },
          y: {
            title: {
              display: true,
              text: 'Value',
            },
            min: min,
            max: max,
          },
        },
        plugins: {
          title: {
            display: true,
            text: 'Generalized Logistic Function',
          },
          legend: {
            display: true,
          },
        },
      },
    });
  }
}
