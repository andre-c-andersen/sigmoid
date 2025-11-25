import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService, ThemePreference } from '../services/theme.service';

@Component({
  selector: 'app-navigation',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navigation.html',
  styleUrl: './navigation.css',
})
export class Navigation {
  constructor(protected themeService: ThemeService) {}

  setTheme(pref: ThemePreference): void {
    this.themeService.setPreference(pref);
  }
}
