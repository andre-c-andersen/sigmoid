import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, effect } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import 'chartjs-plugin-dragdata';
import { SigmoidDataService } from '../../services/sigmoid-data.service';
import { SigmoidParametersService } from '../../services/sigmoid-parameters.service';
import { ThemeService, ChartColorPalette } from '../../services/theme.service';

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
    private parametersService: SigmoidParametersService,
    private themeService: ThemeService
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

    // Watch for theme changes
    effect(() => {
      const colors = this.themeService.chartColors();
      if (this.chart) {
        this.updateChartColors(colors);
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

    const colors = this.themeService.chartColors();

    this.chart = new Chart(ctx, {
      type: 'line' as const,
      data: {
        datasets: [
          // Dataset 0: Fitted Sigmoid (high scenario)
          {
            label: 'High Scenario',
            data: [],
            borderColor: colors.primary.border,
            backgroundColor: colors.primary.background,
            tension: 0.4,
            pointRadius: 0,
            borderWidth: 2,
            dragData: false,
          },
          // Dataset 1: Fitted Sigmoid (low scenario)
          {
            label: 'Low Scenario',
            data: [],
            borderColor: colors.low.border,
            backgroundColor: colors.low.background,
            tension: 0.4,
            pointRadius: 0,
            borderWidth: 2,
            dragData: false,
          },
          // Dataset 2: Fitted Exponential
          {
            label: 'Fitted Exponential',
            data: [],
            borderColor: colors.exponential.border,
            backgroundColor: colors.exponential.background,
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
            borderColor: colors.dataPoints,
            backgroundColor: colors.dataPoints,
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
            borderColor: colors.bounds,
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
            borderColor: colors.boundsHigh,
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
            borderColor: colors.boundsLow,
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
              color: colors.text,
            },
            grid: {
              color: colors.grid,
            },
            ticks: {
              color: colors.text,
            },
          },
          y: {
            title: {
              display: true,
              text: 'Value',
              color: colors.text,
            },
            grid: {
              color: colors.grid,
            },
            ticks: {
              color: colors.text,
            },
          },
        },
        plugins: {
          title: {
            display: true,
            text: 'Fitted Sigmoid from Two Data Points',
            color: colors.text,
          },
          legend: {
            display: true,
            labels: {
              color: colors.text,
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

  private updateChartColors(colors: ChartColorPalette): void {
    if (!this.chart) return;

    const datasets = this.chart.data.datasets;

    // Dataset 0: High scenario
    datasets[0].borderColor = colors.primary.border;
    datasets[0].backgroundColor = colors.primary.background;

    // Dataset 1: Low scenario
    datasets[1].borderColor = colors.low.border;
    datasets[1].backgroundColor = colors.low.background;

    // Dataset 2: Exponential
    datasets[2].borderColor = colors.exponential.border;
    datasets[2].backgroundColor = colors.exponential.background;

    // Dataset 3: Data points
    datasets[3].borderColor = colors.dataPoints;
    datasets[3].backgroundColor = colors.dataPoints;

    // Dataset 4: Lower bound
    datasets[4].borderColor = colors.bounds;

    // Dataset 5: Upper bound (high)
    datasets[5].borderColor = colors.boundsHigh;

    // Dataset 6: Upper bound (low)
    datasets[6].borderColor = colors.boundsLow;

    // Update scales
    const scales = this.chart.options.scales as any;
    if (scales.x) {
      scales.x.grid = { color: colors.grid };
      scales.x.ticks = { ...scales.x.ticks, color: colors.text };
      if (scales.x.title) scales.x.title.color = colors.text;
    }
    if (scales.y) {
      scales.y.grid = { color: colors.grid };
      scales.y.ticks = { ...scales.y.ticks, color: colors.text };
      if (scales.y.title) scales.y.title.color = colors.text;
    }

    // Update plugins
    const plugins = this.chart.options.plugins as any;
    if (plugins.legend?.labels) {
      plugins.legend.labels.color = colors.text;
    }
    if (plugins.title) {
      plugins.title.color = colors.text;
    }

    this.chart.update();
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
      const colors = this.themeService.chartColors();
      (this.chart.data.datasets[5] as any).borderColor = scenario
        ? colors.boundsHigh
        : colors.bounds;

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
