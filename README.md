# OHM Labs Backend

Express.js + MongoDB API for OHM Labs authentication, client form submissions, and role-based dashboards.

## Setup

1. Install Node.js 20+ and MongoDB.
2. Copy `.env.example` to `.env` and replace every secret.
3. Run `npm install`.
4. Seed an admin with `npm run seed:admin`.
5. Start with `npm run dev` or `npm start`.

The API runs on `http://localhost:4000`. The API supports frontend auth flows and public form submissions; this repository provides API endpoints, not frontend pages.

## Configuration

Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` to enable password-reset messages and booking notifications. The sender must be verified with Resend. Booking notifications go to `BOOKING_NOTIFICATION_EMAIL`, which defaults to `keith@ohmlabs.africa`. Set `ZOHO_WEBHOOK_SECRET` to enable the Zoho booking webhook.

## API

- `POST /api/auth/register` creates a client account.
- `POST /api/auth/login` returns a short-lived access JWT and sets an HTTP-only refresh-token cookie.
- `POST /api/auth/refresh` rotates the refresh token; `POST /api/auth/logout` clears it.
- `POST /api/auth/forgot-password` sends a one-time reset link; `POST /api/auth/reset-password` accepts `{ "token": "...", "password": "..." }`. Reset links expire after 30 minutes.
- Authentication and password-reset endpoints have per-IP rate limits; public form endpoints are limited to 20 requests per IP per hour.
- `POST /api/contact` accepts contact/proposal forms as JSON or multipart form data; an optional `attachment` field is accepted. `POST /api/submissions` accepts `font_submission` or `calendar_booking`; font submissions can provide a `fontFile` upload (TTF, OTF, WOFF, WOFF2) or `fontFileUrl`.
- Example booking request:

  ```json
  {
    "type": "calendar_booking",
    "name": "Client name",
    "email": "client@example.com",
    "bookingDate": "2026-10-12T09:00:00.000Z",
    "timezone": "Africa/Nairobi",
    "service": "Consultation"
  }
  ```

- Supporting document uploads accept PDF, Office documents, PNG, and JPEG. Uploads are limited to 10 MB. Local development files are stored under `UPLOAD_DIRECTORY` (default `uploads/`, ignored by Git) and are not served publicly; administrators download them through `GET /api/admin/submissions/:id/attachments/:storageKey`.
- Proposal submissions validate names, email, optional phone and text fields, dates, and allowlisted select values. The API rejects unexpected proposal-detail keys, unsafe control/markup characters, invalid file signatures, and non-empty honeypot values; public requests remain rate-limited.
- `POST /api/integrations/zoho/bookings` receives Zoho/Zoho Flow JSON with `X-Zoho-Webhook-Secret` and a booking ID, customer name/email, and start time. It accepts common field aliases such as `bookingId`, `customerName`, `customerEmail`, `startTime`, `serviceName`, and `timeZone`; use Zoho Flow to map fields if your Zoho payload differs. Duplicate booking IDs are ignored, and a failed notification can be retried by Zoho.
- Local disk storage is only for development. Configure private object storage before deploying the API to production or ephemeral hosting.
- Client-authenticated submissions remain available at `POST /api/client/submissions`.
- Admins can read `/api/admin/dashboard/stats`, `/api/admin/submissions`, and `/api/admin/users` using an access JWT with the admin role.

Dashboard statistics include total and active users, successful sign-ins (all time, today, and the last 30 days), and submissions grouped by contact, font submission, and calendar booking.
