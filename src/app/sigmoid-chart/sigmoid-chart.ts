import { Component, OnInit, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-sigmoid-chart',
  imports: [FormsModule],
  templateUrl: './sigmoid-chart.html',
  styleUrl: './sigmoid-chart.css',
})
export class SigmoidChart implements AfterViewInit {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;

  // Y-axis scaling configuration (now using 1-2-5 sequence)
  private readonly SHRINK_GRACE_MS = 200;       // Delay before considering shrink
  private readonly SHRINK_STABLE_THRESHOLD = 3; // Consecutive fits before shrinking

  // Y-axis state for discrete scaling
  private currentYMin?: number;
  private currentYMax?: number;
  private lastScaleChange = 0;
  private shrinkStableCount = 0;

  // Generalized logistic function parameters
  private _A = 0;     // Lower asymptote
  private _K = 1;     // Upper asymptote
  private _B = 1;     // Growth rate
  private _Q = 1;     // Position parameter
  private _C = 1;     // Typically 1
  private _nu = 1;    // Affects near which asymptote growth occurs

  // Getters and setters to ensure numeric types
  get A(): number { return this._A; }
  set A(value: number | string) { this._A = Number(value); }

  get K(): number { return this._K; }
  set K(value: number | string) { this._K = Number(value); }

  get B(): number { return this._B; }
  set B(value: number | string) { this._B = Number(value); }

  get Q(): number { return this._Q; }
  set Q(value: number | string) { this._Q = Number(value); }

  get C(): number { return this._C; }
  set C(value: number | string) { this._C = Number(value); }

  get nu(): number { return this._nu; }
  set nu(value: number | string) { this._nu = Number(value); }

  ngAfterViewInit(): void {
    this.createChart();
  }

  protected onParameterChange(): void {
    this.updateChart();
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
      this.shrinkStableCount = 0;
      return { min: this.currentYMin, max: this.currentYMax };
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
      this.shrinkStableCount = 0;
      return { min: this.currentYMin, max: this.currentYMax };
    }

    // Check for shrinking (deferred with hysteresis)
    if (now - this.lastScaleChange >= this.SHRINK_GRACE_MS) {
      let shrunk = false;

      // Try to shrink max independently
      const candidateMax = this.stepDown(this.currentYMax);
      if (dataMax <= candidateMax) {
        this.shrinkStableCount++;
        if (this.shrinkStableCount >= this.SHRINK_STABLE_THRESHOLD) {
          this.currentYMax = candidateMax;
          shrunk = true;
        }
      }

      // Try to shrink min independently
      const candidateMin = this.stepDown(this.currentYMin);
      if (dataMin >= candidateMin) {
        this.shrinkStableCount++;
        if (this.shrinkStableCount >= this.SHRINK_STABLE_THRESHOLD) {
          this.currentYMin = candidateMin;
          shrunk = true;
        }
      }

      // Reset counter if neither can shrink, or reset after successful shrink
      if (!(dataMax <= candidateMax && dataMin >= candidateMin)) {
        this.shrinkStableCount = 0;
      } else if (shrunk) {
        this.lastScaleChange = now;
        this.shrinkStableCount = 0;
      }
    } else {
      this.shrinkStableCount = 0;
    }

    return { min: this.currentYMin, max: this.currentYMax };
  }

  private updateChart(): void {
    if (!this.chart) return;

    const generalizedLogisticData = this.generateGeneralizedLogisticData();
    this.chart.data.datasets[0].data = generalizedLogisticData;

    // Update Y-axis scale based on asymptotes
    const { min, max } = this.calculateYAxisRange();

    // Update the y-axis min/max
    (this.chart.options.scales as any).y.min = min;
    (this.chart.options.scales as any).y.max = max;

    this.chart.update();
  }

  private generalizedLogistic(t: number): number {
    // Y(t) = A + (K - A) / (C + Q·e^(-B·t))^(1/ν)
    const exponential = Math.exp(-this.B * t);
    const denominator = Math.pow(this.C + this.Q * exponential, 1 / this.nu);
    return this.A + (this.K - this.A) / denominator;
  }

  private generateGeneralizedLogisticData(): { x: number; y: number }[] {
    const data: { x: number; y: number }[] = [];
    for (let t = -10; t <= 10; t += 0.1) {
      data.push({ x: t, y: this.generalizedLogistic(t) });
    }
    return data;
  }

  private createChart(): void {
    const generalizedLogisticData = this.generateGeneralizedLogisticData();

    // Calculate Y-axis range based on asymptotes
    const { min, max } = this.calculateYAxisRange();

    this.chart = new Chart(this.chartCanvas.nativeElement, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Generalized Logistic Function',
            data: generalizedLogisticData,
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.1)',
            tension: 0.4,
            pointRadius: 0,
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
              text: 't',
            },
          },
          y: {
            title: {
              display: true,
              text: 'Y(t)',
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
            display: false,
          },
        },
      },
    });
  }
}
