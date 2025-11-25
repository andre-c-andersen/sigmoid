import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, effect } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import 'chartjs-plugin-dragdata';
import { SigmoidDataService } from '../../services/sigmoid-data.service';
import { SigmoidParametersService } from '../../services/sigmoid-parameters.service';

Chart.register(...registerables);

@Component({
  selector: 'app-guestimate-chart',
  imports: [],
  templateUrl: './guestimate-chart.html',
  styleUrl: './guestimate-chart.css',
})
export class GuestimateChart implements AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;
  private chart?: Chart<'line'>;
  private resizeObserver?: ResizeObserver;

  constructor(
    private dataService: SigmoidDataService,
    private parametersService: SigmoidParametersService
  ) {
    // Watch for parameter changes
    effect(() => {
      const params = this.parametersService.getParameters()();
      const points = this.parametersService.getDataPoints()();
      const scenario = this.parametersService.getScenarioParameters()();
      const xAxisTickInterval = this.parametersService.getXAxisTickInterval()();
      if (params && this.chart) {
        this.updateChart(params, points, scenario, xAxisTickInterval);
      }
    });
  }

  ngAfterViewInit(): void {
    this.createChart();

    // Render initial chart with current parameters (if available)
    const params = this.parametersService.getParameters()();
    const points = this.parametersService.getDataPoints()();
    const scenario = this.parametersService.getScenarioParameters()();
    const xAxisTickInterval = this.parametersService.getXAxisTickInterval()();
    if (params && this.chart) {
      this.updateChart(params, points, scenario, xAxisTickInterval);
    }

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

  private createChart(): void {
    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    this.chart = new Chart(ctx, {
      type: 'line' as const,
      data: {
        datasets: [
          // Dataset 0: Fitted Sigmoid (high scenario)
          {
            label: 'High Scenario',
            data: [],
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.1)',
            tension: 0.4,
            pointRadius: 0,
            borderWidth: 2,
            dragData: false,
          },
          // Dataset 1: Fitted Sigmoid (low scenario)
          {
            label: 'Low Scenario',
            data: [],
            borderColor: 'rgb(255, 159, 64)',
            backgroundColor: 'rgba(255, 159, 64, 0.1)',
            tension: 0.4,
            pointRadius: 0,
            borderWidth: 2,
            dragData: false,
          },
          // Dataset 2: Fitted Exponential
          {
            label: 'Fitted Exponential',
            data: [],
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            tension: 0,
            pointRadius: 0,
            borderWidth: 2,
            borderDash: [5, 5],
            dragData: false,
          },
          // Dataset 3: Input Data Points (DRAGGABLE)
          {
            label: 'Input Data Points',
            data: [],
            borderColor: 'rgb(100, 100, 100)',
            backgroundColor: 'rgb(100, 100, 100)',
            pointRadius: 8,
            pointHoverRadius: 10,
            pointHitRadius: 25,
            showLine: false,
            dragData: true,
          },
          // Dataset 4: Lower bound
          {
            label: 'Lower bound',
            data: [],
            borderColor: 'rgba(150, 150, 150, 0.5)',
            backgroundColor: 'transparent',
            tension: 0,
            pointRadius: 0,
            borderWidth: 1,
            borderDash: [3, 3],
            dragData: false,
          },
          // Dataset 5: Upper bound (high)
          {
            label: 'Upper bound (high)',
            data: [],
            borderColor: 'rgba(75, 192, 192, 0.5)',
            backgroundColor: 'transparent',
            tension: 0,
            pointRadius: 0,
            borderWidth: 1,
            borderDash: [3, 3],
            dragData: false,
          },
          // Dataset 6: Upper bound (low) - for scenario mode
          {
            label: 'Upper bound (low)',
            data: [],
            borderColor: 'rgba(255, 159, 64, 0.5)',
            backgroundColor: 'transparent',
            tension: 0,
            pointRadius: 0,
            borderWidth: 1,
            borderDash: [3, 3],
            dragData: false,
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
          },
        },
        plugins: {
          title: {
            display: true,
            text: 'Fitted Sigmoid from Two Data Points',
          },
          legend: {
            display: true,
            labels: {
              filter: (item: any, chartData: any) => {
                // Hide legend items with empty data
                const datasetIndex = item.datasetIndex;
                const datasets = chartData?.datasets;
                if (!datasets || !datasets[datasetIndex]) return false;
                const data = datasets[datasetIndex].data;
                return data && data.length > 0;
              }
            }
          },
          dragData: {
            dragX: true,
            dragY: true,
            round: 2,
            showTooltip: true,
            onDragStart: (e: MouseEvent | TouchEvent, datasetIndex: number, index: number, value: any) => {
              // Only allow dragging dataset 3 (observations)
              return datasetIndex === 3;
            },
            onDrag: (e: MouseEvent | TouchEvent, datasetIndex: number, index: number, value: any) => {
              // Enforce Y bounds (between A and K)
              const params = this.parametersService.getParameters()();
              if (!params) return false;

              const minBound = Math.min(params.A, params.K);
              const maxBound = Math.max(params.A, params.K);

              if (value.y <= minBound || value.y >= maxBound) {
                return false;
              }
              return true;
            },
            onDragEnd: (e: MouseEvent | TouchEvent, datasetIndex: number, index: number, value: any) => {
              this.onPointDragged(index, value.x, value.y);
            }
          },
        },
      },
    });
  }

  private updateChart(params: any, points: any, scenario: any, xAxisTickInterval: number | null): void {
    if (!this.chart) return;

    // Calculate x-axis range that covers both scenarios
    let xRange = this.dataService.calculateXAxisBounds(params);

    if (scenario) {
      const lowParams = {
        A: params.A,
        K: scenario.K2,
        B: scenario.B2,
        T: scenario.T2,
        nu: params.nu,
      };
      const lowXRange = this.dataService.calculateXAxisBounds(lowParams);
      // Use the union of both ranges
      xRange = {
        min: Math.min(xRange.min, lowXRange.min),
        max: Math.max(xRange.max, lowXRange.max),
      };
    }

    // Generate sigmoid and exponential data for high scenario
    // Pass data points so exponential goes through both observations
    const dataPointsInput = points ? { t0: points.t0, Y0: points.Y0, t1: points.t1, Y1: points.Y1 } : undefined;
    const { sigmoid, exponential } = this.dataService.generateSigmoidSeries(params, 200, xRange, dataPointsInput);

    // Generate low scenario sigmoid if scenario mode is enabled
    let sigmoidLow: { x: number; y: number }[] = [];
    if (scenario) {
      const lowParams = {
        A: params.A,
        K: scenario.K2,
        B: scenario.B2,
        T: scenario.T2,
        nu: params.nu,
      };
      // Use the same x-range for both curves so they align (no exponential for low scenario)
      const lowResult = this.dataService.generateSigmoidSeries(lowParams, 200, xRange);
      sigmoidLow = lowResult.sigmoid;
    }

    // Dataset 0: High scenario sigmoid
    this.chart.data.datasets[0].data = sigmoid;
    this.chart.data.datasets[0].label = scenario ? 'High Scenario' : 'Fitted Sigmoid';

    // Dataset 1: Low scenario sigmoid
    this.chart.data.datasets[1].data = sigmoidLow;

    // Dataset 2: Fitted Exponential
    this.chart.data.datasets[2].data = exponential;

    // Dataset 3: Input Data Points
    if (points) {
      this.chart.data.datasets[3].data = [
        { x: points.t0, y: points.Y0 },
        { x: points.t1, y: points.Y1 },
      ];
    } else {
      this.chart.data.datasets[3].data = [];
    }

    // Update bound lines
    if (sigmoid.length > 0) {
      const xMin = sigmoid[0].x;
      const xMax = sigmoid[sigmoid.length - 1].x;

      // Dataset 4: Lower bound
      this.chart.data.datasets[4].data = [
        { x: xMin, y: params.A },
        { x: xMax, y: params.A },
      ];

      // Dataset 5: Upper bound (high)
      this.chart.data.datasets[5].data = [
        { x: xMin, y: params.K },
        { x: xMax, y: params.K },
      ];
      this.chart.data.datasets[5].label = scenario ? 'Upper bound (high)' : 'Upper bound';
      // Use gray color when not in scenario mode
      (this.chart.data.datasets[5] as any).borderColor = scenario
        ? 'rgba(75, 192, 192, 0.5)'
        : 'rgba(150, 150, 150, 0.5)';

      // Dataset 6: Upper bound (low) - only when scenario is enabled
      if (scenario) {
        this.chart.data.datasets[6].data = [
          { x: xMin, y: scenario.K2 },
          { x: xMax, y: scenario.K2 },
        ];
      } else {
        this.chart.data.datasets[6].data = [];
      }
    }

    // Update Y-axis bounds (include K2 if scenario mode)
    const yMin = params.A;
    const yMax = scenario ? Math.max(params.K, scenario.K2) : params.K;
    const yBounds = this.dataService.calculateYAxisBounds(yMin, yMax);
    (this.chart.options.scales as any).y.min = yBounds.min;
    (this.chart.options.scales as any).y.max = yBounds.max;

    // Update X-axis tick interval
    const xScale = (this.chart.options.scales as any).x;
    if (xAxisTickInterval !== null && xAxisTickInterval > 0) {
      xScale.ticks = {
        ...xScale.ticks,
        stepSize: xAxisTickInterval,
      };
    } else {
      // Reset to auto
      if (xScale.ticks) {
        delete xScale.ticks.stepSize;
      }
    }

    this.chart.update();
  }

  private onPointDragged(index: number, x: number, y: number): void {
    const currentPoints = this.parametersService.getDataPoints()();
    if (!currentPoints) return;

    const updatedPoints = { ...currentPoints };
    if (index === 0) {
      updatedPoints.t0 = x;
      updatedPoints.Y0 = y;
    } else {
      updatedPoints.t1 = x;
      updatedPoints.Y1 = y;
    }

    this.parametersService.setDataPointsFromChart(updatedPoints);
  }
}
