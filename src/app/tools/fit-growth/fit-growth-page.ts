import { Component } from '@angular/core';

@Component({
  selector: 'app-fit-growth-page',
  imports: [],
  template: `
    <div class="tool-page">
      <h2>Fit Sigmoid Growth</h2>
      <p class="subtitle coming-soon">Multi-point least squares fitting (coming soon)</p>
    </div>
  `,
  styles: `
    .coming-soon {
      font-style: italic;
    }
  `
})
export class FitGrowthPage {}
