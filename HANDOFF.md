# A K ENGINEERING — Website Frontend Handoff (Homepage + Global Header/Footer)

**Project:** aken.firm.in (Industrial EPC / Steel Fabrication / Structural Erection / PEB)  
**Goal:** High-trust, high-converting B2B corporate website (RFQ + drawing uploads)  
**Stack:** Next.js (App Router) + Tailwind CSS + existing tracking components

---

## What was delivered

### 1) Homepage (Heavy‑Duty Minimalist) — `aken-frontend/src/app/page.js`
Implemented the blueprint sections in this order:

1. **Hero**
   - Dark, cinematic industrial hero with background image placeholder (`/hero-steel.jpg`)
   - H1: *Engineering Strength for India’s Industrial Infrastructure.*
   - Subheadline per blueprint
   - CTAs:
     - Primary: **Request Project Quote** → `/contact`
     - Secondary: **View Our Capabilities** → `/services`
   - Lead capture area uses existing `HomeLeadForm` component (kept for current lead flow).
   - Privacy note displayed under the form (“technical drawings kept strictly confidential”).

2. **Trust Statistics Bar (dark background)**
   - 4 KPI cards including animated counters:
     - 15+ Years Experience
     - 500+ Tons Fabricated
     - 100% Safety Compliance
     - Pan‑India Execution
   - Animation triggers on scroll via `IntersectionObserver` in an inline script (client-side).

3. **Corporate Profile Overview (split layout)**
   - Image placeholder: `/engineers-blueprint.jpg`
   - Copy aligned to blueprint:
     - *Delivering Heavy Industrial Solutions with Precision.*

4. **Core Services Grid (4 cards)**
   - PEB, Fabrication, Erection, Maintenance/Retrofitting
   - Hover elevation + subtle accent glow
   - “Learn More” → currently points to `/services` (anchors can be wired once service sections exist).

5. **Lead Capture CTA**
   - *Ready to Discuss Your Next Project?*
   - CTA: **Submit Project Requirement** → `/contact`

Also included:
- Floating WhatsApp button (bottom-right) linked to `CONTACT_WHATSAPP_URL`.
- JSON-LD script injection via existing `getStructuredDataJson()`.

> Note: The homepage uses `<script dangerouslySetInnerHTML>` for counters. If you want stricter Next patterns, migrate this to a small client component later.

---

### 2) Sticky Header (Global Nav) — `aken-frontend/src/components/SiteHeader.tsx`
- Sticky header with top trust line + main navbar.
- Desktop navigation:
  - Home
  - **Services** (dropdown)
  - Projects
  - About Us
  - Insights
- Right-side actions (desktop):
  - Email
  - Phone
  - Orange CTA: **REQUEST PROJECT QUOTE** → `/contact`
- Mobile menu:
  - hamburger toggle
  - services collapsible section
  - quick Privacy/Terms links
- Added minor behavior:
  - shadow on scroll (stuck state)
  - close dropdown on outside click + ESC
- TypeScript typing fixed for events and refs.

---

### 3) Enterprise Footer (Global) — `aken-frontend/src/components/SiteFooter.tsx`
- Dark steel-grey footer with 4 columns:
  1. Company info + trust badges (execution, confidentiality, pan-India)
  2. Quick links
  3. Core services
  4. Contact operations:
     - HQ: Hirakud, Sambalpur, Odisha
     - Phone / Email
     - WhatsApp Business button (opens in new tab)
- Copyright line:
  - Includes Founder/Proprietor: Ashis Mahato
  - “Request a Quote” link

---

## Wiring / Layout changes
- Footer wired globally in: `aken-frontend/src/app/layout.tsx`
  - Added import for `SiteFooter`
  - Rendered beneath `{children}`

---

## Media placeholders added
These are empty placeholder files (replace with real assets, keep filenames):
- `aken-frontend/public/hero-steel.jpg`
- `aken-frontend/public/engineers-blueprint.jpg`

---

## How to run
From repo root:
```bash
cd aken-frontend
npm run dev
```
Open:
- http://localhost:3000

---

## Next recommended steps (not part of this delivery)
1. Replace placeholder images with compressed, real industrial media (WebP/MP4 where applicable).
2. Convert inline homepage counter script into a reusable client component.
3. Build the remaining sitemap pages per blueprint:
   - Service page template (PEB example with sticky sidebar quote form)
   - Projects portfolio page with filters
   - “Smart” project enquiry form with drag-and-drop file upload + privacy note
4. Add Organization/LocalBusiness JSON-LD details (address, geo, opening hours, etc.) in `getStructuredDataJson()`.
