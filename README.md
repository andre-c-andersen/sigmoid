# Sigmoid Tools

Interactive tools for working with sigmoid functions. Visualize growth curves and fit them to your data.

🌐 **Live:** [sigmoid.tools](https://sigmoid.tools)

## Tools

**General Sigmoid Function**
Explore sigmoid behavior with interactive sliders for all five parameters (A, K, B, T, ν). Includes an early-phase exponential overlay to see where sigmoid growth diverges from pure exponential.

**Guestimate Sigmoid Growth**
Fit a complete sigmoid curve from just two data points. Enter your observations and get instant B and T parameters.

**Fit Sigmoid Growth** *(Coming Soon)*
Least-squares fitting for multiple data points.

## The Function

Generalized logistic (Richards curve):

```
Y(t) = A + (K - A) / (1 + ν·e^(-B·(t - T)))^(1/ν)
```

Where:
- **A** = lower bound
- **K** = upper bound
- **B** = growth rate
- **T** = inflection point
- **ν** = asymmetry (< 1 front-loaded, > 1 back-loaded)

## Development

```bash
npm install
npm start          # Dev server at localhost:4200
npm run deploy     # Build and copy to /docs for GitHub Pages
```

Built with Angular 20 and Chart.js.

## License

MIT
