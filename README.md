# First Class Styles – Salon & Hair Spa

A luxury dark-and-gold salon website and appointment-request system for First Class Styles in Suitland, Maryland.

## Business information

- **Address:** 3813 Old Silver Hill Rd, Suitland, MD 20746, USA
- **Phone / WhatsApp:** +1 (240) 370-1128
- **Email:** firstclass.styles1@gmail.com
- **Hours:** Saturday–Tuesday, 9:00 AM–4:00 PM; Wednesday–Friday closed
- **Instagram:** https://www.instagram.com/firstclass.styles
- **TikTok:** https://www.tiktok.com/@islandgyaal128

## Site features

- Responsive, single-page public salon site with services, gallery, booking request, contact/location, and customer-help/FAQ sections.
- Real salon gallery images are stored in `public/`; the gallery uses these assets, not generated placeholders.
- Embedded map and external directions link for the salon address.
- Appointment requests require at least 24 hours' advance notice.
- A $25 non-refundable deposit is manually verified; remaining balance is paid at the salon.
- Salon schedule is Saturday through Tuesday, 9 AM–4 PM. Service duration must fit within closing time.
- Booking capacity is intended to be limited to four active appointments per day. Database migrations in the repo must be confirmed applied before relying on this safeguard in production.
- Appointment admin and calendar pages are available separately from the public page. Preview-mode sample data must not be mistaken for live customer or booking records.

## Important safety / release rules

- Do **not** test with real bookings, customer emails, reminder delivery, deposits, or production data unless the salon owner explicitly authorizes the test.
- Do **not** apply database migrations or deploy/merge preview changes to production without explicit approval.
- Verify migration state in Supabase before claiming overlap prevention, daily capacity, reminder tracking, or closure-date protections are active.
- Never put Supabase secret/service-role keys or admin session secrets in client code or commits.
- Admin credentials should be strong and private. The application currently needs a persistent/provider-level login rate limit review; do not assume the admin login is rate-limited.
- Preview admin sample data is for demonstration only and does not write to live booking records.

## Gallery assets

Current intended gallery files:

- `gallery-straight-and-curls.jpg`
- `gallery-twist-style.jpg`
- `gallery-blonde-waves.jpg`
- `gallery-curly-style.jpg`
- `gallery-long-layers.jpg`

The salon owner can add more real salon photos later to expand the gallery. Keep image authenticity and client permission in mind.

## Development

This project uses Next.js tooling for its administrative/API components and includes a static public HTML page under `public/index.html`.

```bash
npm install
npm run dev
```

Open `http://localhost:3000` for the local development server.

## Deployment

Preview work should remain on `preview/luxury-admin-dashboard`. The production branch is `main`. Do not merge preview into production without owner approval and a separate release review.

## External systems

- **Vercel:** hosting/deployment
- **Supabase:** booking data/API backend
- **GitHub:** source control

Configuration is managed through environment variables in the hosting dashboard. Do not commit environment values.
