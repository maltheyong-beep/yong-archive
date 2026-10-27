# YONG ARCHIVE

A Danish storefront for new and secondhand clothing. Current inventory: Supreme Box Logo Hooded Sweatshirt (FW25), Grey and Black, both size M, brand new, 3,000 DKK each, with receipt and dispatch within 24 hours, as supplied by the store owner.

## Run

Serve this repository root with a static web server. No build step or external dependencies.

## Inventory and original photos

`catalog.js` is the editable inventory. Every product has its own `conditionType` (`new` or `preowned`), displayed condition, size, price, receipt flag, dispatch information, and five original photos. Store the paths in `photos`, accessible labels in `photoLabels`, and optional display rotations in `rotations`. Source photos are preserved. The black front photo is rotated by CSS in the layout; no product appearance has been altered.

The gallery shows every photo and supports a large-image viewer, keyboard navigation and color links between the two listings. Images use containment so item details are not cropped away. Prices and description escape user-supplied text in the interface. Resale stock is capped at one per item.

## Features

Condition, size, color and price filters; search and sorting; persistent local bag; product gallery; demo checkout; and an email signup preview that does not store or send email addresses. Motion includes scroll reveals, hover zoom, animated dialogs and drawers, gallery fades and button feedback. Effects respect reduced-motion preferences.

## Before accepting orders

Checkout and signup remain explicitly labelled as demos. Connect actual checkout, shipping prices, returns terms, contact information and email delivery. Dispatch within 24 hours is separate from transit time; no delivery guarantee or shipping price is invented.

## GitHub

The GitHub version lives at https://github.com/maltheyong-beep/yong-archive and contains the website files at its root. Upload all referenced photos with the matching filenames. Keep the GitHub copy and hosted version in sync after inventory updates.
