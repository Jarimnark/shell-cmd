# How a shell finds and runs a program

An interactive learning site about what happens when you type a command in **zsh on macOS**: terminals and shells, paths, `PATH`, lookup order, permissions, symlinks, installers, auto-updaters, three real debugging case studies and a printable checklist.

Plain HTML, CSS and vanilla JavaScript. No framework, no build step, no network requests. It works offline.

## Run it locally

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Opening `index.html` directly in a browser also works.

## Publish on GitHub Pages

The workflow in `.github/workflows/pages.yml` deploys the site every time `main` is pushed.

1. Merge this work into the `main` branch and push it.
2. On GitHub, open **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **GitHub Actions**.
4. Open the **Actions** tab. Run "Deploy to GitHub Pages" by hand (**Run workflow**) or push to `main` again.
5. When the run is green, the site address is shown on the run page and under **Settings → Pages**. It looks like `https://<your-user>.github.io/shell-cmd/`.

If the first run fails with a Pages error, step 3 has not been done yet. Do it and re-run the workflow.

## Layout

| Path | What it is |
|---|---|
| `index.html` | All ten chapters |
| `css/style.css` | Styles, light and dark themes, print rules |
| `js/core.js` | DOM helpers, quiz engine, progress (localStorage), theme, glossary |
| `js/vfs.js` | The fake filesystem and the fake zsh (lookup order, hash cache, `which`, `ls`, `chmod`, `ln`…) |
| `js/term.js` | The fake terminal widget with the animated lookup |
| `js/ch1.js` … `js/ch10.js` | Each chapter's interactive piece and quiz |

## Accuracy

The lookup rules in `js/vfs.js` were checked against real zsh 5.9 (the version macOS ships). The simulators are simplified on purpose; the page says so where it matters.
