# Rural Haat Ordering V3

## Customer
- Add button shows `Added (quantity)` and cart count updates immediately.
- Checkout shows exact cart total and uploaded UPI QR image.
- Customer enters name and branch, uploads payment screenshot, and submits.
- Order gets a unique ID and starts as Pending.
- Latest order status refreshes every 7 seconds while the customer page is open.

## Admin
- Visit `/admin`, sign in with admin account created manually in Supabase Authentication.
- Dashboard shows total, Pending, Confirmed, Delivered counts.
- Filter orders and review name, branch, items, total and payment screenshot.
- Dropdown statuses: Pending → Confirmed → Delivered.
- Customer's page displays the new status when it refreshes.

## Configure
1. Create Supabase project.
2. Run `supabase-schema.sql` in SQL Editor.
3. Disable public sign-ups in Authentication settings.
4. Create one admin user manually in Authentication > Users.
5. Copy Project URL and anon key into `.env` (copy `.env.example` to `.env`).
6. Replace `public/images/payment-qr.svg` with your actual QR image. For PNG, rename it `payment-qr.png` and update `const QR` in `src/main.jsx`.
7. Run `npm install` then `npm run dev`.
8. Push to GitHub and import into Vercel. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel environment variables.

## Payment
This version stores a customer-uploaded payment screenshot. Admin must independently verify the payment in the UPI/bank app before changing status to Confirmed. A screenshot alone is not proof of settled funds.

## Privacy and operations
Admin order data and screenshot reading require an authenticated Supabase user. Customer status lookup uses an unguessable tracking token stored in that customer's browser. Keep admin credentials private. For a high-traffic public launch, add server-side file validation, rate limiting, and payment gateway verification.
