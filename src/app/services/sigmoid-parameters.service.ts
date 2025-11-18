import { Injectable, signal } from '@angular/core';
import { SigmoidParameters } from './sigmoid-math.service';

export interface DataPoints {
  t0: number;
  Y0: number;
  t1: number;
  Y1: number;
}

@Injectable({
  providedIn: 'root'
})
export class SigmoidParametersService {
  private parameters = signal<SigmoidParameters | null>(null);
  private dataPoints = signal<DataPoints | null>(null);

  getParameters() {
    return this.parameters.asReadonly();
  }

  getDataPoints() {
    return this.dataPoints.asReadonly();
  }

  setParameters(params: SigmoidParameters): void {
    this.parameters.set(params);
  }

  setDataPoints(points: DataPoints): void {
    this.dataPoints.set(points);
  }

  clearParameters(): void {
    this.parameters.set(null);
  }

  clearDataPoints(): void {
    this.dataPoints.set(null);
  }
}
