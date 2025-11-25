import { Injectable, signal, computed, effect } from '@angular/core';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export interface ChartColorPalette {
  primary: { border: string; background: string };
  exponential: { border: string; background: string };
  low: { border: string; background: string };
  dataPoints: string;
  bounds: string;
  boundsHigh: string;
  boundsLow: string;
  grid: string;
  text: string;
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'sigmoid-theme';
  private readonly DARK_MODE_QUERY = '(prefers-color-scheme: dark)';

  private systemPrefersDark = signal(this.getSystemPreference());
  private preference = signal<ThemePreference>(this.getInitialPreference());

  readonly currentPreference = this.preference.asReadonly();

  readonly resolvedTheme = computed<ResolvedTheme>(() => {
    const pref = this.preference();
    if (pref === 'system') {
      return this.systemPrefersDark() ? 'dark' : 'light';
    }
    return pref;
  });

  readonly isDark = computed(() => this.resolvedTheme() === 'dark');

  readonly chartColors = computed<ChartColorPalette>(() => {
    const dark = this.isDark();
    return {
      primary: {
        border: 'rgb(75, 192, 192)',
        background: dark ? 'rgba(75, 192, 192, 0.2)' : 'rgba(75, 192, 192, 0.1)',
      },
      exponential: {
        border: 'rgb(255, 99, 132)',
        background: dark ? 'rgba(255, 99, 132, 0.2)' : 'rgba(255, 99, 132, 0.1)',
      },
      low: {
        border: 'rgb(255, 159, 64)',
        background: dark ? 'rgba(255, 159, 64, 0.2)' : 'rgba(255, 159, 64, 0.1)',
      },
      dataPoints: dark ? 'rgb(180, 180, 180)' : 'rgb(100, 100, 100)',
      bounds: dark ? 'rgba(200, 200, 200, 0.5)' : 'rgba(150, 150, 150, 0.5)',
      boundsHigh: dark ? 'rgba(75, 192, 192, 0.6)' : 'rgba(75, 192, 192, 0.5)',
      boundsLow: dark ? 'rgba(255, 159, 64, 0.6)' : 'rgba(255, 159, 64, 0.5)',
      grid: dark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      text: dark ? '#b8b8b8' : '#666666',
    };
  });

  constructor() {
    // Apply theme whenever it changes
    effect(() => {
      this.applyTheme(this.resolvedTheme());
    });

    // Watch for system preference changes
    this.watchSystemPreference();
  }

  setPreference(pref: ThemePreference): void {
    this.preference.set(pref);
    localStorage.setItem(this.STORAGE_KEY, pref);
  }

  private getInitialPreference(): ThemePreference {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
    return 'system';
  }

  private getSystemPreference(): boolean {
    return window.matchMedia?.(this.DARK_MODE_QUERY).matches ?? false;
  }

  private applyTheme(theme: ResolvedTheme): void {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }

  private watchSystemPreference(): void {
    const mediaQuery = window.matchMedia?.(this.DARK_MODE_QUERY);
    if (!mediaQuery) return;

    mediaQuery.addEventListener('change', (e) => {
      this.systemPrefersDark.set(e.matches);
    });
  }
}
