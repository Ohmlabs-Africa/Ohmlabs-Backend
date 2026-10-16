import { timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { Submission } from '../models/Submission.js';
import { createPublicSubmission, sendBookingNotification } from './submissionController.js';

const normalizedKey = (key) => key.replace(/[^a-z0-9]/gi, '').toLowerCase();

function findValue(objects, aliases) {
  const normalizedAliases = new Set(aliases.map(normalizedKey));
  for (const object of objects) {
    if (!object || typeof object !== 'object' || Array.isArray(object)) continue;
    for (const [key, value] of Object.entries(object)) {
      if (normalizedAliases.has(normalizedKey(key)) && (typeof value === 'string' || typeof value === 'number')) {
        return String(value).trim();
      }
    }
  }
  return '';
}

function hasValidSecret(req) {
  if (!env.zohoWebhookSecret) return false;
  const provided = req.get('x-zoho-webhook-secret') || req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!provided) return false;
  const expectedBytes = Buffer.from(env.zohoWebhookSecret);
  const providedBytes = Buffer.from(provided);
  return expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes);
}

export async function receiveZohoBooking(req, res, next) {
  if (!env.zohoWebhookSecret) {
    return res.status(503).json({ success: false, error: 'Zoho webhook integration is not configured' });
  }
  if (!hasValidSecret(req)) {
    return res.status(401).json({ success: false, error: 'Invalid webhook credentials' });
  }
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(422).json({ success: false, error: 'Expected a booking object' });
  }

  const payload = req.body;
  const nestedPayloads = [payload, payload.booking, payload.data, payload.event, payload.payload];
  const name = findValue(nestedPayloads, ['name', 'customer_name', 'customerName', 'clientName', 'invitee_name', 'attendeeName']);
  const email = findValue(nestedPayloads, ['email', 'customer_email', 'customerEmail', 'clientEmail', 'invitee_email', 'attendeeEmail']).toLowerCase();
  const start = findValue(nestedPayloads, [
    'bookingDate', 'appointmentDate', 'startTime', 'start_time', 'fromTime', 'from_time',
    'appointmentStartTime', 'startDateTime', 'startsAt', 'scheduledTime', 'date',
  ]);
  const separateTime = findValue(nestedPayloads, ['bookingTime', 'appointmentTime', 'time', 'fromTime']);
  const service = findValue(nestedPayloads, ['service', 'serviceName', 'appointmentType', 'eventName', 'eventTitle']);
  const timezone = findValue(nestedPayloads, ['timezone', 'timeZone', 'customerTimeZone']);
  const externalId = findValue(nestedPayloads, ['bookingId', 'booking_id', 'appointmentId', 'eventId', 'event_id']);

  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(422).json({ success: false, error: 'Booking payload must include a valid customer name and email' });
  }

  if (!externalId) {
    return res.status(422).json({ success: false, error: 'Booking payload must include a booking ID for duplicate protection' });
  }

  const existingSubmission = await Submission.findOne({ externalId });
  if (existingSubmission) {
    if (!existingSubmission.notificationSent) {
      try {
        await sendBookingNotification(existingSubmission);
      } catch (error) {
        console.error(`Booking notification retry failed for submission ${existingSubmission._id}:`, error);
        return res.status(503).json({ success: false, error: 'Booking was saved, but its email notification could not be sent.' });
      }
    }
    return res.status(200).json({ success: true, message: 'Booking already received' });
  }

  const bookingDate = start && !Number.isNaN(Date.parse(start)) ? new Date(start).toISOString() : undefined;
  req.body = {
    type: 'calendar_booking',
    name,
    email,
    bookingDate,
    bookingTime: separateTime || (bookingDate ? new Date(bookingDate).toISOString() : undefined),
    timezone: timezone || undefined,
    service: service || undefined,
    externalId: externalId || undefined,
  };
  req.isZohoWebhook = true;

  try {
    await createPublicSubmission(req, res);
  } catch (error) {
    next(error);
  }
}
