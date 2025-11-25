import { Component, OnInit, signal, effect } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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

  constructor(
    private fb: FormBuilder,
    private mathService: SigmoidMathService,
    private parametersService: SigmoidParametersService
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
    this.form = this.fb.group({
      A: [0, [Validators.required]],
      K: [1, [Validators.required]],
      Y0: [0.1, [Validators.required]],
      Y1: [0.2, [Validators.required]],
      t0: [0, [Validators.required]],
      t1: [12, [Validators.required]],
      nu: [1, [Validators.required, Validators.min(0.01)]],
    });

    // Auto-calculate on value changes
    this.form.valueChanges.subscribe(() => {
      this.calculate();
    });

    // Initial calculation
    this.calculate();
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
  }

  protected onK2Change(): void {
    this.calculate();
  }

  protected onXAxisTickIntervalChange(value: string): void {
    const parsed = parseFloat(value);
    const interval = isNaN(parsed) || parsed <= 0 ? null : parsed;
    this.xAxisTickInterval.set(interval);
    this.parametersService.setXAxisTickInterval(interval);
  }

  protected clearXAxisTickInterval(): void {
    this.xAxisTickInterval.set(null);
    this.parametersService.setXAxisTickInterval(null);
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
  }
}
