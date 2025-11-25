import { Injectable, signal } from '@angular/core';
import { SigmoidParameters } from './sigmoid-math.service';

export interface DataPoints {
  t0: number;
  Y0: number;
  t1: number;
  Y1: number;
}

export interface ScenarioParameters {
  K2: number;  // Low upper bound
  B2: number;  // Growth rate for low scenario
  T2: number;  // Midpoint for low scenario
}

@Injectable({
  providedIn: 'root'
})
export class SigmoidParametersService {
  private parameters = signal<SigmoidParameters | null>(null);
  private dataPoints = signal<DataPoints | null>(null);
  private scenarioParameters = signal<ScenarioParameters | null>(null);
  private xAxisTickInterval = signal<number | null>(null);

  // Signal for chart-initiated data point changes (drag)
  private dataPointsFromChart = signal<DataPoints | null>(null);

  getParameters() {
    return this.parameters.asReadonly();
  }

  getDataPoints() {
    return this.dataPoints.asReadonly();
  }

  getScenarioParameters() {
    return this.scenarioParameters.asReadonly();
  }

  getXAxisTickInterval() {
    return this.xAxisTickInterval.asReadonly();
  }

  getDataPointsFromChart() {
    return this.dataPointsFromChart.asReadonly();
  }

  setParameters(params: SigmoidParameters): void {
    this.parameters.set(params);
  }

  setDataPoints(points: DataPoints): void {
    this.dataPoints.set(points);
  }

  setScenarioParameters(params: ScenarioParameters): void {
    this.scenarioParameters.set(params);
  }

  setXAxisTickInterval(interval: number | null): void {
    this.xAxisTickInterval.set(interval);
  }

  setDataPointsFromChart(points: DataPoints): void {
    this.dataPointsFromChart.set(points);
    this.dataPoints.set(points);
  }

  clearDataPointsFromChart(): void {
    this.dataPointsFromChart.set(null);
  }

  clearParameters(): void {
    this.parameters.set(null);
  }

  clearDataPoints(): void {
    this.dataPoints.set(null);
  }

  clearScenarioParameters(): void {
    this.scenarioParameters.set(null);
  }
}
