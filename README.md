# YONG ARCHIVE

A minimal, responsive resale storefront with Apple-inspired styling and original sample illustrations. Working brand and sample inventory: checkout and email signup are demonstrations only.

## Preview

Open `index.html`, or serve this folder using a static web server. There is no build step and no external dependency.

## Files

- `index.html`: storefront layout and accessible dialogs.
- `styles.css`: responsive visual design.
- `motion.css`: optional animations and reduced-motion support.
- `app.js`: search, filters, sorting, product gallery, bag and demo checkout.
- `catalog.js`: editable inventory and store settings.
- `sample-assets.js`: 16 original sample illustrations, embedded so no image downloads are required.

## Real products and photos

Edit `catalog.js`. Each product has an ID, name, category, color, hex color, price in DKK, size, condition, description and sample asset name. To use real photographs, add a `photos` array to a product, with the front photo first and detail photo second, for example `photos: ["photos/hoodie-front.jpg", "photos/hoodie-detail.jpg"]`. Add those files to the repository at the matching paths.

Replace sample wording and the working brand when real inventory arrives. Resale stock is capped at one unit per product. The bag and filters persist only in the visitor's browser.

## Animations

Staggered product and section reveals, hover zoom, gallery crossfades, animated drawers and dialogs, button feedback, a bag-count pulse, a compact header on scroll, a progress indicator, and a gently floating archive mark. All effects respect `prefers-reduced-motion`.

## Launch checklist

Connect real checkout, inventory, shipping, contact details, returns terms and email signup before accepting customers. No customer email is stored or transmitted in this demo. No order or payment is created.

Deploy the repository root to a static web host. If using GitHub Pages, select the `main` branch and root folder in the repository's Pages settings when that option is available.
