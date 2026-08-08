# Ghandi Home Electro Showcase

Project: Website for Ghandi Home Electro

Build a modern, animated website for my father's home appliance company.

Company Info

Name: Ghandi Home Electro

Founder: Khaled Douiou

Phone: +212 611 945 25

Address: 41 Boulevard Ghandi, Casablanca-Settat, Morocco

Business: Sells home appliances — TVs, refrigerators, air conditioners, and washing machines

Design & Branding

Color palette: white and blue, matched exactly to the logo colors (logo image attached) — use these two consistently throughout the site

Style: clean, modern, professional, with heavy use of scroll-based animations (fade-ins, slide-ins, staggered reveals, etc.)

Add a scroll progress indicator: a thin line/bar that fills from top to bottom (or left to right) as the user scrolls down each page, resetting per page

Language

Default language: French (entire site content in French)

Add a language switcher in the top navigation (globe icon, standard UX pattern) with these options: English, Français, العربية, Español, Italiano

Note: The switcher UI can be built now; full translations can be added later if needed — but the mechanism should work

Site Content (Phase 1)

For now, this is primarily a design/structure exercise — build the homepage and core layout (header, hero section, footer, navigation) with no real product data yet, since products will be managed dynamically through the admin panel (see below)

Admin Panel

URL: /admin

Access: password-protected with the password Ritali123

Persistence: once the correct password is entered successfully, remember the session using a cookie so the user isn't asked again on future visits to /admin on the same browser

Admin Panel — Inventory Management

Admins can create Categories (e.g., "Refrigerators", "TVs", "Air Conditioners", "Washing Machines")

Within each category, admins can add Items/Products, each with:

Name

Serial number (editable)

Stock quantity (editable) — if stock is 0, the item automatically shows as "Out of Stock" on the site

Product image

Description / characteristics (editable text field)

Clicking on a product opens a detail view (similar to AliExpress/Amazon-style product pages):

Hovering the mouse over the product image and scrolling zooms in on the image following the cursor

Moving the mouse away resets the zoom back to 100%

Admins can delete categories or individual items

Organize this admin interface cleanly and intuitively — if you have a better UX approach that accomplishes the same functionality (categories → items → editable fields), feel free to implement it

Please make sure this section is bug-free and thoroughly tested

Admin Panel — Website Personalization

Admins can change the site's global colors:

Primary color (default: white)

Secondary color (default: blue — matching the logo)

Text color

Any changes made and saved here should apply globally across the entire live site immediately

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://ghandi-electro-showcase.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/88b555a3-a39b-4ef1-af19-d3e4c26b3922).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
