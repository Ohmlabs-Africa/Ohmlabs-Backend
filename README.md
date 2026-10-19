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

Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` to enable password-reset messages and submission notifications. The sender must be verified with Resend. Proposal notifications go to `PROPOSAL_NOTIFICATION_EMAIL`, which defaults to `BOOKING_NOTIFICATION_EMAIL` and then `keith@ohmlabs.africa`. Booking notifications go to `BOOKING_NOTIFICATION_EMAIL`. Set `ZOHO_WEBHOOK_SECRET` to enable the Zoho booking webhook.

New client registrations notify `ADMIN_NOTIFICATION_EMAIL` (defaults to `keith@ohmlabs.africa`) through Resend. Set a valid `RESEND_API_KEY` and verified `RESEND_FROM_EMAIL` in the production backend for these notifications and approval emails to be delivered. If the provider is unavailable, the registration remains pending and the API logs the delivery failure.

Set `CLIENT_ORIGIN` to a comma-separated list of exact frontend origins (scheme and hostname, no path), for example `https://ohmlabs.africa,https://www.ohmlabs.africa,http://localhost:3000`. CORS only permits listed origins, supports credentialed refresh-token cookies, and allows requests without an `Origin` header for server-to-server clients. Ensure the deployed frontend uses the same HTTPS origin that is listed here.

## API

- `POST /api/auth/register` creates a pending client account and emails `ADMIN_NOTIFICATION_EMAIL` (defaults to `keith@ohmlabs.africa`). The account cannot sign in until an administrator approves it; approval/rejection sends the user an email.
- `POST /api/auth/login` returns a short-lived access JWT and sets an HTTP-only refresh-token cookie.
- `POST /api/auth/refresh` rotates the refresh token; `POST /api/auth/logout` clears it.
- `POST /api/auth/forgot-password` sends a one-time reset link; `POST /api/auth/reset-password` accepts `{ "token": "...", "password": "..." }`. Reset links expire after 30 minutes.
- Authentication and password-reset endpoints have per-IP rate limits; public form endpoints are limited to 20 requests per IP per hour.
- `POST /api/contact` accepts contact/proposal forms as JSON or multipart form data; an optional `attachment` field is accepted. `POST /api/submissions` accepts `font_submission` or `calendar_booking`; font submissions can provide a `fontFile` upload (TTF, OTF, WOFF, WOFF2) or `fontFileUrl`.
- Proposal requests are saved and emailed via Resend to `PROPOSAL_NOTIFICATION_EMAIL`. If email delivery fails, the proposal remains saved and the API returns `notificationSent: false`; the error is logged for follow-up, so visitors are not prompted to resubmit saved proposals.
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
- Admins review pending client requests through `GET /api/admin/users/pending` and `PATCH /api/admin/users/:id/approval` with `{ "approvalStatus": "approved" | "rejected" }`.
- Admin project management is protected under `/api/admin/projects`; approved clients use the separate `/api/client/projects` routes. Project membership is checked on every project, task, ticket, and chat request. Members can create projects, tasks, support tickets, and project chat messages; project owners and admins can add active, approved client or admin accounts to projects by email.
- Project owners and admins can assign tasks to admin project members. Admins see their assigned project tasks on `/dashboard`; status changes are persisted to the shared project task and visible to the client team in the project workspace. Collaboration refreshes from the API; it is not real-time.
- `GET /api/admin/project-tasks/assigned-to-me` returns tasks assigned to the authenticated admin only.
- Client-only account and project statistics are available through `/api/client/me` and `/api/client/project-stats`. Client queries are limited to projects where the signed-in client is a member.
- The frontend client portal is available at `/client/login`, `/client/register`, and `/client/dashboard`. Admins can review account requests from `/dashboard` and manage projects through `/admin/projects`.

Dashboard statistics include total and active users, successful sign-ins (all time, today, and the last 30 days), and submissions grouped by contact, font submission, and calendar booking.
