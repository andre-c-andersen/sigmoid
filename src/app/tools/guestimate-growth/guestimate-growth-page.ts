import { Component } from '@angular/core';
import { GuestimateForm } from './guestimate-form';
import { GuestimateChart } from './guestimate-chart';

@Component({
  selector: 'app-guestimate-growth-page',
  imports: [GuestimateForm, GuestimateChart],
  templateUrl: './guestimate-growth-page.html',
  styleUrl: './guestimate-growth-page.css',
})
export class GuestimateGrowthPage {}
