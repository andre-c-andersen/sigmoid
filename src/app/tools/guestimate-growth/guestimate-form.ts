import { Component, OnInit, signal, effect } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SigmoidMathService, SigmoidParameters } from '../../services/sigmoid-math.service';
import { SigmoidParametersService } from '../../services/sigmoid-parameters.service';

@Component({
  selector: 'app-guestimate-form',
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './guestimate-form.html',
  styleUrl: './guestimate-form.css',
})
export class GuestimateForm implements OnInit {
  protected form!: FormGroup;
  protected calculatedB = signal<number | null>(null);
  protected calculatedT = signal<number | null>(null);
  protected error = signal<string | null>(null);

  constructor(
    private fb: FormBuilder,
    private mathService: SigmoidMathService,
    private parametersService: SigmoidParametersService
  ) {}

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
      return;
    }

    const values = this.form.value;
    const result = this.mathService.calculateBandT({
      A: values.A,
      K: values.K,
      t0: values.t0,
      Y0: values.Y0,
      t1: values.t1,
      Y1: values.Y1,
      nu: values.nu,
    });

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
    } else {
      this.calculatedB.set(null);
      this.calculatedT.set(null);
      this.error.set(result.error || 'Calculation failed');
      this.parametersService.clearParameters();
      this.parametersService.clearDataPoints();
    }
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
  }
}
