# RASCAL ARCHIVE

A Danish storefront for new and secondhand clothing. Current inventory:

- Supreme Box Logo Hooded Sweatshirt (FW25), Grey and Black: brand new, size M, 2,500 DKK each.
- C.P. Company Button Overshirt: preowned, very good condition, size L, 900 DKK.
- Sauna L/S Tee, Navy / White: preowned, good condition, size M, price pending.
- Supreme Capital S/S Top, Pink: preowned, very good condition, size M, 900 DKK.

## Run

Serve the repository root with a static web server. No build step or external dependencies.

## Inventory and original photos

Edit `catalog.js`. Each listing has a condition, condition type (`new` or `preowned`), price, size, description, and its own photo gallery. All 23 original product photos are included. Rotations happen in the page layout only: the black hoodie front rotates 90 degrees counterclockwise and the Sauna back photo rotates 180 degrees. Source photos are preserved.

A missing price must be `null`. The interface shows “Pris kommer”, excludes that item from cart additions, and keeps it last when sorting by price. Do not guess a price.

## Features

Category, condition, size, color and editable minimum/maximum price filters; search and sorting; persistent local bag; full photo viewer; color switching for the Supreme hoodies; and optional animations that respect reduced-motion preferences. Prices update from the current catalog, including items already in a visitor's local bag.

## Theme and newsletter wheel

Visitors can choose light or dark mode; the choice persists in their browser. The newsletter demonstration opens a proportional SVG wheel with weighted outcomes: 5% discount (65% chance), no discount (25%), 10% discount (8%), and 15% discount (2%). Odds are visible. A result is selected with the Web Crypto API and stored locally for one spin per browser. Displayed codes are explicitly inactive demo codes. A production signup provider and server-issued coupons must be connected before this is a real promotion.

## Store status

Checkout is explicitly a demo and does not create orders or take payments. Newsletter signup is also a demo and does not save or send email addresses. Shipping prices, delivery estimates, returns terms, contact information and production payments still need to be connected before launch.

## GitHub

The repository is https://github.com/maltheyong-beep/yong-archive and uses the same website files at its root instead of `dist/`. Keep both copies in sync after catalog updates.

## FAQ and return-policy draft

The FAQ and footer open a rewritten return-policy draft. Contact email and return address are not supplied and are visibly marked as pending. No account portal, fixed return-label price, delivery promise, authenticity verification team or monthly drop schedule is invented. The draft uses a 14-day cancellation period and was checked against Forbrug.dk and Forbrugerombudsmanden guidance. Seller identity, contact details and the final return process must be supplied before accepting orders.

## Denmark: explicit prelaunch state

No real orders, email subscriptions, cancellation requests or active discount prizes are accepted. Legal seller name, address, contact email/phone, business status and applicable CVR details have not been supplied. Return and privacy texts remain visibly marked as drafts. The UI exposes a prepared “Fortryd aftale” flow, but this cannot receive a real withdrawal or send the required durable confirmation until its backend is connected. Newsletter consent identifies brand, email channel and product categories; the current checkbox is explicitly a demo. Competition odds and the lack of real prizes are disclosed. No made-up authentication team or delivery time is claimed.

Local filtering is in-memory only. Cart and user-requested settings remain local; no analytics or ad scripts are included. The eventual hosting, identity provider, email provider and payment system must be assessed and documented when configured. No claim of a completed legal certification is made.

Primary references checked 28 October 2026:
- https://www.retsinformation.dk/api/pdf/250338 (section 20 a, online withdrawal function)
- https://forbrugerombudsmanden.dk/alle-emner/forbrugeraftaler/fortrydelse
- https://forbrugerombudsmanden.dk/alle-emner/anden-lovgivning/e-handelsloven
- https://forbrugerombudsmanden.dk/alle-emner/uanmodede-henvendelser/indhentelse-af-samtykke
- https://forbrugerombudsmanden.dk/alle-emner/uanmodede-henvendelser/brug-af-konkurrencer
