import { Component } from '@angular/core';

@Component({
  selector: 'app-fit-growth-page',
  imports: [],
  template: `
    <h2>Fit Sigmoid Growth</h2>
    <p>Multi-point least squares fitting (coming soon)</p>
  `,
  styles: `
    h2 {
      text-align: center;
    }
    p {
      text-align: center;
      color: #999;
      font-style: italic;
    }
  `
})
export class FitGrowthPage {}
