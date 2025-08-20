# xbar-apps (Templates)

Purpose
- Host prebuilt interactive applets for XBAR at `https://<user>.github.io/xbar-apps/<applet>/`.
- Keep this repo static-only; embed from the main site via iframe.

Structure
- `apps/<name>/`: One folder per applet (must contain an `index.html`).
- `shared/`: Shared JS/CSS used by applets (copied from XBAR repo `public/shared/`).
- Optional: a root `index.html` to list available apps.

Local Preview
- From repo root: `python3 -m http.server 8000`
- Open `http://localhost:8000/apps/central-limit-theorem/`

Deployment
- Uses GitHub Actions to publish the repo root to `gh-pages`.
- Trigger: push to `main` or manual run.
- Published URL: `https://<user>.github.io/xbar-apps/` → app paths under `/apps/...`.

Add a New Applet
- Create `apps/<applet-name>/` and add `index.html` + assets.
- Reference shared assets with relative paths, e.g. `../../shared/xbar-applets.css`.
- Commit and push to `main` to deploy.

Embed from Main Site
- Iframe URL pattern: `https://<user>.github.io/xbar-apps/<applet-name>/`
- Example (Hugo/blogdown shortcode):
  - `{{< iframe src="https://<user>.github.io/xbar-apps/central-limit-theorem/" height="640" >}}`

Build Pipelines (optional)
- If an applet needs a build step, output to `dist/apps/<name>/` and set `publish_dir: dist` in the workflow, adding a build step before deploy.

Notes
- Keep this repo lightweight; do not commit secrets.
- Prefer absolute iframe URLs when embedding from other repos/sites.
