import { Routes } from '@angular/router';
import { GeneralSigmoidPage } from './tools/general-sigmoid/general-sigmoid-page/general-sigmoid-page';
import { GuestimateGrowthPage } from './tools/guestimate-growth/guestimate-growth-page';
import { FitGrowthPage } from './tools/fit-growth/fit-growth-page';

export const routes: Routes = [
  { path: '', redirectTo: '/tools/general', pathMatch: 'full' },
  { path: 'tools/general', component: GeneralSigmoidPage },
  { path: 'tools/guestimate', component: GuestimateGrowthPage },
  { path: 'tools/fit', component: FitGrowthPage },
  { path: '**', redirectTo: '/tools/general' },
];
