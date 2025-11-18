import { Component, OnInit, ElementRef, ViewChild, AfterViewInit, effect } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { SigmoidDataService } from '../../services/sigmoid-data.service';
import { SigmoidParametersService } from '../../services/sigmoid-parameters.service';

Chart.register(...registerables);

@Component({
  selector: 'app-guestimate-chart',
  imports: [],
  templateUrl: './guestimate-chart.html',
  styleUrl: './guestimate-chart.css',
})
export class GuestimateChart implements AfterViewInit {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;

  // Store the two input data points for display
  private dataPoints: { t0: number; Y0: number; t1: number; Y1: number } | null = null;

  constructor(
    private dataService: SigmoidDataService,
    private parametersService: SigmoidParametersService
  ) {
    // Watch for parameter changes
    effect(() => {
      const params = this.parametersService.getParameters()();
      const points = this.parametersService.getDataPoints()();
      if (params && this.chart) {
        this.updateChart(params, points);
      }
    });
  }

  ngAfterViewInit(): void {
    this.createChart();
  }

  private createChart(): void {
    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Fitted Sigmoid',
            data: [],
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.1)',
            tension: 0.4,
            pointRadius: 0,
            borderWidth: 2,
          },
          {
            label: 'Early-Phase Exponential',
            data: [],
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            tension: 0,
            pointRadius: 0,
            borderWidth: 2,
            borderDash: [5, 5],
          },
          {
            label: 'Input Data Points',
            data: [],
            borderColor: 'rgb(255, 159, 64)',
            backgroundColor: 'rgb(255, 159, 64)',
            pointRadius: 8,
            pointHoverRadius: 10,
            showLine: false,
            type: 'scatter',
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
          },
        },
        plugins: {
          title: {
            display: true,
            text: 'Fitted Sigmoid from Two Data Points',
          },
          legend: {
            display: true,
          },
        },
      },
    });
  }

  private updateChart(params: any, points: any): void {
    if (!this.chart) return;

    // Generate sigmoid and exponential data
    const { sigmoid, exponential } = this.dataService.generateSigmoidSeries(params, 200);

    // Update datasets
    this.chart.data.datasets[0].data = sigmoid;
    this.chart.data.datasets[1].data = exponential;

    // Update data points markers
    if (points) {
      this.chart.data.datasets[2].data = [
        { x: points.t0, y: points.Y0 },
        { x: points.t1, y: points.Y1 },
      ];
    } else {
      this.chart.data.datasets[2].data = [];
    }

    // Update Y-axis bounds
    const yBounds = this.dataService.calculateYAxisBounds(params.A, params.K);
    (this.chart.options.scales as any).y.min = yBounds.min;
    (this.chart.options.scales as any).y.max = yBounds.max;

    this.chart.update();
  }
}
