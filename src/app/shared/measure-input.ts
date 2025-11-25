import { Component, Input, Output, EventEmitter, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';

@Component({
  selector: 'app-measure-input',
  imports: [CommonModule, FormsModule],
  templateUrl: './measure-input.html',
  styleUrl: './measure-input.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MeasureInput),
      multi: true,
    },
  ],
})
export class MeasureInput implements ControlValueAccessor {
  @Input() label = '';
  @Input() helperText = '';
  @Input() step = 0.1;
  @Input() defaultValue?: number;

  // Slider bounds (visual range)
  @Input() sliderMin = 0;
  @Input() sliderMax = 100;

  // Legal value bounds (validation)
  @Input() valueMin?: number;
  @Input() valueMax?: number;

  // External invalid state (e.g., cross-field validation)
  @Input() invalid = false;
  @Input() invalidMessage = '';

  protected internalValue = 0;
  protected inputValue = '0';
  private initialValue?: number;
  protected hasError = false;
  protected errorMessage = '';

  private onChange: (value: number) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: number): void {
    if (value !== undefined && value !== null) {
      this.internalValue = value;
      this.inputValue = String(value);
      // Store the first value written as initial value (for reset)
      if (this.initialValue === undefined) {
        this.initialValue = value;
      }
      this.validate();
    }
  }

  registerOnChange(fn: (value: number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  protected onSliderChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = Number(target.value);
    this.updateValue(value);
  }

  protected onInputChange(): void {
    const parsed = parseFloat(this.inputValue);
    if (!isNaN(parsed)) {
      this.updateValue(parsed);
    } else {
      this.hasError = true;
      this.errorMessage = 'Enter a valid number';
    }
  }

  protected onInputBlur(): void {
    this.onTouched();
    // Restore valid value if input is invalid
    if (isNaN(parseFloat(this.inputValue))) {
      this.inputValue = String(this.internalValue);
      this.validate();
    }
  }

  private updateValue(value: number): void {
    this.internalValue = value;
    this.inputValue = String(value);
    this.validate();

    if (!this.hasError) {
      this.onChange(value);
    }
  }

  private validate(): void {
    this.hasError = false;
    this.errorMessage = '';

    if (this.valueMin !== undefined && this.internalValue < this.valueMin) {
      this.hasError = true;
      this.errorMessage = `Must be at least ${this.valueMin}`;
    } else if (this.valueMax !== undefined && this.internalValue > this.valueMax) {
      this.hasError = true;
      this.errorMessage = `Must be at most ${this.valueMax}`;
    }
  }

  // Clamp slider position to slider bounds, but allow input to exceed
  protected get clampedSliderValue(): number {
    return Math.max(this.sliderMin, Math.min(this.sliderMax, this.internalValue));
  }

  protected get canReset(): boolean {
    const resetValue = this.defaultValue ?? this.initialValue;
    if (resetValue === undefined) return false;
    // Use tolerance for floating point comparison
    return Math.abs(this.internalValue - resetValue) > 0.0001;
  }

  protected resetToDefault(): void {
    const resetValue = this.defaultValue ?? this.initialValue;
    if (resetValue !== undefined) {
      this.updateValue(resetValue);
    }
  }
}
