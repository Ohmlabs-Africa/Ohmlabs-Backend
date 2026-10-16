import { Submission } from '../models/Submission.js';
import { ok } from '../utils/response.js';
import { env } from '../config/env.js';
import { sendEmail } from '../utils/email.js';
import path from 'node:path';
import { unlinkSync } from 'node:fs';

export async function createSubmission(req, res) {
  const { name, email, company, message, details } = req.body;
  const submission = await createWithFileCleanup({
    name,
    email,
    company,
    message,
    details,
    attachments: req.file ? [attachmentMetadata(req.file)] : [],
    owner: req.user?.id || null,
  }, req.file);
  return ok(res, submission, 'Submission received', 201);
}

export async function createPublicSubmission(req, res) {
  const { type, name, email, company, message, fontName, fontFileUrl, bookingDate, bookingTime, timezone, service, details, externalId } = req.body;
  const fontFile = req.files?.fontFile?.[0];
  const attachment = req.files?.attachment?.[0];
  if ((type === 'font_submission' && attachment) || (type !== 'font_submission' && fontFile)) {
    removeRequestUploads(req);
    return res.status(422).json({ success: false, error: 'Uploaded file field does not match the submission type' });
  }

  const uploadedFile = type === 'font_submission' ? fontFile : attachment;
  if (type === 'font_submission' && !uploadedFile && !fontFileUrl) {
    return res.status(422).json({ success: false, error: 'A font file or font file URL is required' });
  }

  const submission = await createWithFileCleanup({
    type,
    name,
    email,
    company,
    message,
    fontName,
    fontFileUrl,
    externalId: req.isZohoWebhook ? externalId : undefined,
    attachments: uploadedFile ? [attachmentMetadata(uploadedFile)] : [],
    bookingDate,
    bookingTime,
    timezone,
    service,
    details,
  }, uploadedFile);

  if (type === 'calendar_booking') {
    try {
      await sendBookingNotification(submission);
    } catch (error) {
      console.error(`Booking notification failed for submission ${submission._id}:`, error);
      return res.status(503).json({
        success: false,
        error: 'Booking was saved, but its email notification could not be sent.',
        data: { submissionId: submission._id },
      });
    }
  }

  return ok(res, submission, 'Submission received', 201);
}

export async function sendBookingNotification(submission) {
  const bookingSummary = [
    `Name: ${submission.name}`,
    `Email: ${submission.email}`,
    submission.company ? `Company: ${submission.company}` : null,
    submission.service ? `Service: ${submission.service}` : null,
    submission.bookingDate ? `Date: ${new Date(submission.bookingDate).toISOString()}` : null,
    submission.bookingTime ? `Time: ${submission.bookingTime}` : null,
    submission.timezone ? `Timezone: ${submission.timezone}` : null,
    submission.message ? `Message: ${submission.message}` : null,
    submission.details ? `Additional details: ${JSON.stringify(submission.details)}` : null,
    `Submission ID: ${submission._id}`,
  ].filter(Boolean).join('\n');

  await sendEmail({
    to: env.bookingNotificationEmail,
    subject: 'New OHM Labs calendar booking',
    text: bookingSummary,
  });
  submission.notificationSent = true;
  await submission.save();
}

function attachmentMetadata(file) {
  return {
    storageKey: file.filename,
    originalName: file.originalname,
    contentType: file.mimetype,
    size: file.size,
  };
}

async function createWithFileCleanup(data, file) {
  try {
    return await Submission.create(data);
  } catch (error) {
    if (file) {
      try {
        unlinkSync(file.path);
      } catch (cleanupError) {
        console.error(`Uploaded file cleanup failed for ${file.filename}:`, cleanupError);
      }
    }
    throw error;
  }
}

function removeRequestUploads(req) {
  const files = req.file ? [req.file] : Object.values(req.files || {}).flat();
  for (const file of files) unlinkSync(file.path);
}

export async function downloadSubmissionAttachment(req, res) {
  const { id, storageKey } = req.params;
  if (path.basename(storageKey) !== storageKey) {
    return res.status(400).json({ success: false, error: 'Invalid attachment key' });
  }

  const submission = await Submission.findById(id);
  const attachment = submission?.attachments.find((file) => file.storageKey === storageKey);
  if (!attachment) return res.status(404).json({ success: false, error: 'Attachment not found' });

  return res.download(path.join(env.uploadDirectory, attachment.storageKey), attachment.originalName);
}

export async function listSubmissions(req, res) {
  const filter = req.user.role === 'admin' ? {} : { owner: req.user.id };
  return ok(res, await Submission.find(filter).sort({ createdAt: -1 }), 'Submissions fetched');
}
export async function updateSubmission(req, res) {
  const filter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, owner: req.user.id };
  const submission = await Submission.findOneAndUpdate(filter, req.body, { new: true, runValidators: true });
  if (!submission) return res.status(404).json({ success: false, error: 'Submission not found' });
  return ok(res, submission, 'Submission updated');
}
