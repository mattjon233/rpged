# RPGed landing page

Static site served at <https://rpged.com.br>. There is no build step: everything under `public/` goes online as it is.

## Deploy

The site is the Cloudflare Worker `rpged`, which serves `public/` as static assets (see `wrangler.jsonc`). The Worker is connected to this repository, so a push to `main` publishes the site.

## Preview

```bash
npx wrangler dev   # http://localhost:8787, same routing as production
```

## Editing the text

The page is bilingual. English is the content of each element, and Portuguese sits on the same element:

- `data-pt` for plain text;
- `data-pt-html` when the text has markup inside;
- `data-pt-<attribute>` (with the attribute listed in `data-i18n-attr`) for things like `aria-label`.

Sentences used by the animations are in the hidden `#lines` block at the end of `public/index.html`.

The page opens in Portuguese for browsers set to Portuguese and in English for everyone else. `?lang=pt` and `?lang=en` force a language.

## Where things are

| Path | What it is |
| --- | --- |
| `public/index.html`, `privacy.html`, `404.html` | The pages |
| `public/assets/css/site.css` | All styles |
| `public/assets/js/site.js` | Page behaviour and the small demos |
| `public/assets/js/hero.js`, `world.js` | The 3D scene at the top |
| `public/assets/js/dice.js` | The 3D dice |
| `public/assets/js/room.js` | The magic room |
| `public/assets/vendor/` | three.js and cannon-es bundles |
| `public/_headers` | Cache and security headers |
| `tools/` | Script and entry files that rebuild the vendor bundles |

After changing `tools/vendor/*.entry.js`, run `tools/build-vendor.sh`.

## Credits

Open-source licenses are in `public/credits.txt` and `public/assets/fonts/LICENSE.txt`.
