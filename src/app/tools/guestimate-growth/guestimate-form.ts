import { Component, OnInit, signal, effect } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SigmoidMathService } from '../../services/sigmoid-math.service';
import { SigmoidParametersService } from '../../services/sigmoid-parameters.service';
import { MeasureInput } from '../../shared/measure-input';

@Component({
  selector: 'app-guestimate-form',
  imports: [ReactiveFormsModule, CommonModule, FormsModule, MeasureInput],
  templateUrl: './guestimate-form.html',
  styleUrl: './guestimate-form.css',
})
export class GuestimateForm implements OnInit {
  protected form!: FormGroup;
  protected calculatedB = signal<number | null>(null);
  protected calculatedT = signal<number | null>(null);
  protected exponentialRate = signal<number | null>(null);
  protected error = signal<string | null>(null);

  // Scenario mode (second upper bound)
  protected enableScenario = signal(false);
  protected K2 = signal<number>(0.8);
  protected calculatedB2 = signal<number | null>(null);
  protected calculatedT2 = signal<number | null>(null);
  protected k2Invalid = signal(false);
  protected k2InvalidMessage = 'Must be between A and K';

  // X-axis tick interval (null = auto)
  protected xAxisTickInterval = signal<number | null>(null);

  // Validation state for observation values
  protected y0Invalid = signal(false);
  protected y1Invalid = signal(false);
  protected boundsInvalidMessage = 'Must be between bounds';

  // Dynamic slider bounds for observation values
  protected valueSliderMin = signal(0);
  protected valueSliderMax = signal(1);

  // Dynamic slider bounds for K2
  protected k2SliderMin = signal(0);
  protected k2SliderMax = signal(1);

  // Flag to prevent URL updates during initial load
  private initializing = true;

  constructor(
    private fb: FormBuilder,
    private mathService: SigmoidMathService,
    private parametersService: SigmoidParametersService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    // Watch for drag updates from chart
    effect(() => {
      const draggedPoints = this.parametersService.getDataPointsFromChart()();
      if (draggedPoints) {
        this.form.patchValue({
          t0: draggedPoints.t0,
          Y0: draggedPoints.Y0,
          t1: draggedPoints.t1,
          Y1: draggedPoints.Y1,
        }, { emitEvent: true });
        this.parametersService.clearDataPointsFromChart();
      }
    });
  }

  ngOnInit(): void {
    // Read query params to get initial values
    const params = this.route.snapshot.queryParams;

    const defaults = {
      A: 0,
      K: 1,
      Y0: 0.1,
      Y1: 0.2,
      t0: 0,
      t1: 12,
      nu: 1,
    };

    this.form = this.fb.group({
      A: [this.parseParam(params['A'], defaults.A), [Validators.required]],
      K: [this.parseParam(params['K'], defaults.K), [Validators.required]],
      Y0: [this.parseParam(params['Y0'], defaults.Y0), [Validators.required]],
      Y1: [this.parseParam(params['Y1'], defaults.Y1), [Validators.required]],
      t0: [this.parseParam(params['t0'], defaults.t0), [Validators.required]],
      t1: [this.parseParam(params['t1'], defaults.t1), [Validators.required]],
      nu: [this.parseParam(params['nu'], defaults.nu), [Validators.required, Validators.min(0.01)]],
    });

    // Initialize scenario mode from query params
    if (params['scenario'] === 'true' || params['scenario'] === '1') {
      this.enableScenario.set(true);
      if (params['K2'] !== undefined) {
        this.K2.set(this.parseParam(params['K2'], this.form.get('K')!.value * 0.8));
      } else {
        this.K2.set(this.form.get('K')!.value * 0.8);
      }
    }

    // Initialize x-axis tick interval from query params
    if (params['xTick'] !== undefined) {
      const xTick = this.parseParam(params['xTick'], null);
      if (xTick !== null && xTick > 0) {
        this.xAxisTickInterval.set(xTick);
        this.parametersService.setXAxisTickInterval(xTick);
      }
    }

    // Auto-calculate on value changes
    this.form.valueChanges.subscribe(() => {
      this.calculate();
      this.updateQueryParams();
    });

    // Initial calculation
    this.calculate();

    // Mark initialization complete after a tick to allow initial calculation
    setTimeout(() => {
      this.initializing = false;
    }, 0);
  }

  private parseParam(value: string | undefined, defaultValue: number): number;
  private parseParam(value: string | undefined, defaultValue: null): number | null;
  private parseParam(value: string | undefined, defaultValue: number | null): number | null {
    if (value === undefined || value === '') return defaultValue;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  private updateQueryParams(): void {
    if (this.initializing) return;

    const values = this.form.value;
    const queryParams: Record<string, string | null> = {
      A: values.A?.toString() ?? null,
      K: values.K?.toString() ?? null,
      Y0: values.Y0?.toString() ?? null,
      Y1: values.Y1?.toString() ?? null,
      t0: values.t0?.toString() ?? null,
      t1: values.t1?.toString() ?? null,
      nu: values.nu?.toString() ?? null,
    };

    // Add scenario params if enabled
    if (this.enableScenario()) {
      queryParams['scenario'] = '1';
      queryParams['K2'] = this.K2().toString();
    } else {
      queryParams['scenario'] = null;
      queryParams['K2'] = null;
    }

    // Add x-axis tick interval if set
    const xTick = this.xAxisTickInterval();
    queryParams['xTick'] = xTick !== null ? xTick.toString() : null;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private calculate(): void {
    if (!this.form.valid) {
      this.error.set('Please fill in all fields correctly');
      this.calculatedB.set(null);
      this.calculatedT.set(null);
      this.calculatedB2.set(null);
      this.calculatedT2.set(null);
      return;
    }

    const values = this.form.value;
    const K2 = this.K2();
    const scenarioEnabled = this.enableScenario();

    // Update dynamic slider bounds for observation values
    // Observations must fit within the full range (A to K), regardless of scenario mode
    const minBound = Math.min(values.A, values.K);
    const maxBound = Math.max(values.A, values.K);
    this.valueSliderMin.set(minBound);
    this.valueSliderMax.set(maxBound);

    // Update K2 slider bounds (between A and K, but K2 must be less than K)
    this.k2SliderMin.set(Math.min(values.A, values.K));
    this.k2SliderMax.set(values.K);

    // Check if observations are within bounds
    this.y0Invalid.set(values.Y0 <= minBound || values.Y0 >= maxBound);
    this.y1Invalid.set(values.Y1 <= minBound || values.Y1 >= maxBound);

    // Validate K2 if scenario is enabled
    if (scenarioEnabled) {
      const k2Valid = K2 > values.A && K2 < values.K;
      this.k2Invalid.set(!k2Valid);
    } else {
      this.k2Invalid.set(false);
    }

    // Calculate high scenario (using K)
    const result = this.mathService.calculateBandT({
      A: values.A,
      K: values.K,
      t0: values.t0,
      Y0: values.Y0,
      t1: values.t1,
      Y1: values.Y1,
      nu: values.nu,
    });

    // Calculate low scenario (using K2) if enabled
    let result2: { B: number; T: number; isValid: boolean; error?: string } = { B: 0, T: 0, isValid: false };
    if (scenarioEnabled && !this.k2Invalid()) {
      result2 = this.mathService.calculateBandT({
        A: values.A,
        K: K2,
        t0: values.t0,
        Y0: values.Y0,
        t1: values.t1,
        Y1: values.Y1,
        nu: values.nu,
      });
    }

    if (result.isValid) {
      this.calculatedB.set(result.B);
      this.calculatedT.set(result.T);
      this.error.set(null);

      // Calculate exponential growth rate: b = ln(Y1/Y0) / (t1 - t0)
      if (values.Y0 > 0 && values.Y1 > 0 && values.t1 !== values.t0) {
        const expRate = Math.log(values.Y1 / values.Y0) / (values.t1 - values.t0);
        this.exponentialRate.set(expRate);
      } else {
        this.exponentialRate.set(null);
      }

      // Update parameters service for the chart
      this.parametersService.setParameters({
        A: values.A,
        K: values.K,
        B: result.B,
        T: result.T,
        nu: values.nu,
      });

      // Also store the data points
      this.parametersService.setDataPoints({
        t0: values.t0,
        Y0: values.Y0,
        t1: values.t1,
        Y1: values.Y1,
      });

      // Update scenario parameters if enabled and valid
      if (scenarioEnabled && result2.isValid) {
        this.calculatedB2.set(result2.B);
        this.calculatedT2.set(result2.T);
        this.parametersService.setScenarioParameters({
          K2: K2,
          B2: result2.B,
          T2: result2.T,
        });
      } else {
        this.calculatedB2.set(null);
        this.calculatedT2.set(null);
        this.parametersService.clearScenarioParameters();
      }
    } else {
      this.calculatedB.set(null);
      this.calculatedT.set(null);
      this.exponentialRate.set(null);
      this.calculatedB2.set(null);
      this.calculatedT2.set(null);
      this.error.set(result.error || 'Calculation failed');
      this.parametersService.clearParameters();
      this.parametersService.clearDataPoints();
      this.parametersService.clearScenarioParameters();
    }
  }

  protected onScenarioToggle(): void {
    // When enabling scenario, default K2 to 80% of K
    if (this.enableScenario()) {
      const K = this.form.get('K')?.value ?? 1;
      this.K2.set(K * 0.8);
    }
    this.calculate();
    this.updateQueryParams();
  }

  protected onK2Change(): void {
    this.calculate();
    this.updateQueryParams();
  }

  protected onXAxisTickIntervalChange(value: string): void {
    const parsed = parseFloat(value);
    const interval = isNaN(parsed) || parsed <= 0 ? null : parsed;
    this.xAxisTickInterval.set(interval);
    this.parametersService.setXAxisTickInterval(interval);
    this.updateQueryParams();
  }

  protected clearXAxisTickInterval(): void {
    this.xAxisTickInterval.set(null);
    this.parametersService.setXAxisTickInterval(null);
    this.updateQueryParams();
  }

  protected resetForm(): void {
    this.form.reset({
      A: 0,
      K: 1,
      Y0: 0.1,
      Y1: 0.2,
      t0: 0,
      t1: 12,
      nu: 1,
    });
    this.enableScenario.set(false);
    this.K2.set(0.8);
    this.xAxisTickInterval.set(null);
    this.parametersService.setXAxisTickInterval(null);

    // Clear all query params
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true,
    });
  }
}
