import { Component, OnInit, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-sigmoid-chart',
  imports: [],
  templateUrl: './sigmoid-chart.html',
  styleUrl: './sigmoid-chart.css',
})
export class SigmoidChart implements AfterViewInit {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;

  ngAfterViewInit(): void {
    this.createChart();
  }

  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  private generateSigmoidData(): { x: number; y: number }[] {
    const data: { x: number; y: number }[] = [];
    for (let x = -10; x <= 10; x += 0.1) {
      data.push({ x, y: this.sigmoid(x) });
    }
    return data;
  }

  private createChart(): void {
    const data = this.generateSigmoidData();

    this.chart = new Chart(this.chartCanvas.nativeElement, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Sigmoid Function',
            data: data,
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
              text: 'x',
            },
          },
          y: {
            title: {
              display: true,
              text: 'σ(x)',
            },
            min: 0,
            max: 1,
          },
        },
        plugins: {
          title: {
            display: true,
            text: 'Sigmoid Function: σ(x) = 1 / (1 + e^(-x))',
          },
        },
      },
    });
  }
}
