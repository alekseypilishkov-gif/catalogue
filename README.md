# LD catalogue

Nuxt 4 + Vue 3 + TypeScript foundation of the LD catalogue landing page.

## Development

Requires Node.js 22.19+, 24.11+, or 26+ (CI uses Node.js 24), matching Nuxt's engine range.

```sh
npm install
npm run dev
```

Local URL: http://localhost:3000. No environment variables or API keys required.

```sh
npm run typecheck
npm run build
npm run generate
```

`build` produces the Nitro server build; `generate` prerenders the static site to
`.output/public`. For GitHub Pages use `NUXT_APP_BASE_URL=/catalogue/` when generating.
The included Actions workflow type-checks, builds, generates, and publishes that directory.
Repository Settings → Pages → Source must be **GitHub Actions**.

## Architecture

```text
app/
  app.vue
  error.vue
  pages/index.vue
  components/
    layout/{Header,Footer}.vue
    catalog/{MainCategoryCard,IndustryCard}.vue
    particles/ParticleCanvas.vue
    ui/{AppDialog,BrandIcon}.vue
  composables/useAssetUrl.ts
  data/catalogue.ts
  types/particles.ts
  assets/{css,fonts}/
public/images/
.github/workflows/deploy-pages.yml
```

Nuxt 4's `app/` directory owns pages and components. Tokens and shared base styles live
in `app/assets/css/main.css`; component styles are scoped. Catalogue content and external
navigation are typed data. `useAssetUrl` handles root and repository-subpath hosting.
Montserrat Cyrillic and Latin WOFF2 subsets are bundled locally with their OFL license.

## Layout and references

- [Figma page 5097:12339](https://www.figma.com/design/PFoRhmJB9BJN94sIYyjBkD/?node-id=5097-12339)
- Main card: `5101:13090`; industry card: `5101:24227`.
- 1920 px target, 12 columns, 92 px margins, 24 px gutters.
- Header + catalogue occupy the first desktop viewport; footer follows by scrolling,
  as confirmed by the designer. At small heights content can scroll instead of being clipped.
- Desktop card dimensions: approximately 709×152 and 563×76 px. At widths below
  1000 px sections stack; tablet cards use two columns and phone cards use one column.
- Original logos, icons, hero source image and header-wave export come from the Figma file.
  The particle visual is an independent image, not a screenshot of the interface.
- Header/footer contents follow the supplied design; navigable destinations were sourced
  from [the existing LD website](https://xn--d1an.xn--p1ai/).

## Current interaction scope

- Header catalogue/menu open accessible native dialogs; Escape, outside click and close
  dismiss them, with native focus trapping/return. Search filters catalogue and industry names.
- Main catalogue cards link to the existing commercial catalogue and documentation centre.
- Industry cards open a clearly labelled interim dialog with a link to the full catalogue.
  **No industry filtering backend is implemented.**
- Region and cart dialogs explicitly describe the upcoming integration. Account links to
  the existing site. No login, checkout, user tracking or persistence is added.
- `Объекты монтажа` and `Вакансии` retain their reference labels and open interim dialogs
  because their destinations were not supplied or present in the current reference navigation.
- Footer contacts, social profiles, existing navigation and legal links use real destinations.
  External services and content are outside this repository.

## Deferred motion / renderer contract

`<ParticlesParticleCanvas mode="logo" />` accepts `logo | engineering | exploded-product`.
Every mode currently displays the same approved static logo. The isolated host is decorative,
pointer-transparent and sized by Grid. A future client-only renderer should mount its canvas
inside this host, handle container resize and reduced-motion preferences, and dispose of
listeners, animation frames and GPU resources on unmount. No Three.js dependency is installed.

Cards expose an `idle | hover | active` state prop and CSS variables
`--card-background`, `--card-border`, `--card-glow`, `--card-title-color`, plus reserved
hover tokens. State-specific visual changes, glow ellipses, hover animation, morphing,
3D objects and exploded views are deliberately deferred. Keyboard focus is implemented now.

This is a frontend foundation, not a connected shop. Final designer approval and future
commerce/particle integrations remain separate stages.
