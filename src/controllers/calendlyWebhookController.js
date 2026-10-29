import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { Submission } from '../models/Submission.js';
import { sendBookingNotification } from './submissionController.js';

const signatureToleranceSeconds = 5 * 60;

function isValidSignature(req) {
  const header = req.get('calendly-webhook-signature');
  if (!header || !req.rawBody || !env.calendlyWebhookSigningKey) return false;

  const values = new Map(
    header.split(',').map((part) => {
      const separator = part.indexOf('=');
      return separator < 0 ? ['', ''] : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
    }),
  );
  const timestamp = values.get('t');
  const timestampSeconds = Number(timestamp);
  const signatures = header.split(',')
    .map((part) => part.trim())
    .filter((part) => part.startsWith('v1='))
    .map((part) => part.slice(3))
    .filter((signature) => /^[a-f0-9]{64}$/i.test(signature));

  if (!timestamp || !Number.isInteger(timestampSeconds) ||
    Math.abs(Date.now() / 1000 - timestampSeconds) > signatureToleranceSeconds ||
    signatures.length === 0) {
    return false;
  }

  const expected = createHmac('sha256', env.calendlyWebhookSigningKey)
    .update(`${timestamp}.`)
    .update(req.rawBody)
    .digest();

  return signatures.some((signature) => timingSafeEqual(expected, Buffer.from(signature, 'hex')));
}

function bookingFields(payload) {
  const event = payload.scheduled_event;
  const startTime = event?.start_time;
  const bookingDate = startTime && !Number.isNaN(Date.parse(startTime))
    ? new Date(startTime)
    : null;

  if (!payload.uri || !payload.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email || '') ||
    !bookingDate) {
    return null;
  }

  return {
    externalId: `calendly:${payload.uri}`,
    name: payload.name.trim(),
    email: payload.email.trim().toLowerCase(),
    bookingDate,
    timezone: typeof payload.timezone === 'string' ? payload.timezone.trim() : undefined,
    service: typeof event.name === 'string' ? event.name.trim() : undefined,
  };
}

export async function receiveCalendlyWebhook(req, res) {
  if (!env.calendlyWebhookSigningKey) {
    return res.status(503).json({ success: false, error: 'Calendly webhook is not configured' });
  }
  if (!isValidSignature(req)) {
    return res.status(401).json({ success: false, error: 'Invalid Calendly webhook signature' });
  }

  const { event, payload } = req.body || {};
  if (typeof event !== 'string' || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return res.status(422).json({ success: false, error: 'Expected a Calendly event payload' });
  }

  if (event === 'invitee.created') {
    const fields = bookingFields(payload);
    if (!fields) {
      return res.status(422).json({ success: false, error: 'Booking event is missing valid invitee or event details' });
    }

    let submission = await Submission.findOne({ externalId: fields.externalId });
    if (!submission) {
      try {
        submission = await Submission.create({
          ...fields,
          type: 'calendar_booking',
          bookingStatus: 'scheduled',
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
        submission = await Submission.findOne({ externalId: fields.externalId });
        if (!submission) throw error;
      }
    }

    if (!submission.notificationSent) {
      try {
        await sendBookingNotification(submission);
      } catch (error) {
        console.error(`Calendly booking notification failed for submission ${submission._id}:`, error);
        return res.status(503).json({ success: false, error: 'Booking was saved, but its email notification could not be sent.' });
      }
    }

    return res.status(200).json({ success: true, message: 'Booking received' });
  }

  if (event === 'invitee.canceled') {
    if (!payload.uri || typeof payload.uri !== 'string') {
      return res.status(422).json({ success: false, error: 'Cancellation event is missing its invitee URI' });
    }

    const submission = await Submission.findOneAndUpdate(
      { externalId: `calendly:${payload.uri}`, type: 'calendar_booking' },
      {
        bookingStatus: 'canceled',
        cancellationReason: typeof payload.cancellation?.reason === 'string'
          ? payload.cancellation.reason.trim().slice(0, 1000)
          : undefined,
      },
      { new: true, runValidators: true },
    );
    if (!submission) {
      return res.status(404).json({ success: false, error: 'Booking to cancel was not found' });
    }
    return res.status(200).json({ success: true, message: 'Booking cancellation received' });
  }

  return res.status(200).json({ success: true, message: 'Calendly event ignored' });
}
