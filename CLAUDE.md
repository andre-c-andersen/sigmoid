# Sigmoid Tools

Angular app for visualizing and fitting sigmoid/logistic growth curves. Hosted on GitHub Pages at sigmoid.tools.

## Development

- Use schematics to create new Angular components: `npx ng generate component path/to/component`
- Dev server: `npm start`

## Building & Deployment

The app is deployed via GitHub Pages from the `docs/` folder.

**To prepare a release:**
```
npm run build:docs
```

This command:
1. Builds production bundle with correct base-href
2. Clears and recreates the `docs/` folder
3. Copies build output to `docs/`
4. Creates `404.html` (copy of index.html for SPA routing)
5. Adds `CNAME` file for custom domain (sigmoid.tools)

After running, commit and push - GitHub Pages will automatically deploy.