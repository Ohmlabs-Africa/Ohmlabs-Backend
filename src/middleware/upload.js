import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import multer from 'multer';
import { env } from '../config/env.js';

mkdirSync(env.uploadDirectory, { recursive: true });

const documentTypes = new Map([
  ['.pdf', new Set(['application/pdf'])],
  ['.doc', new Set(['application/msword', 'application/octet-stream'])],
  ['.docx', new Set(['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream'])],
  ['.xls', new Set(['application/vnd.ms-excel', 'application/octet-stream'])],
  ['.xlsx', new Set(['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'])],
  ['.ppt', new Set(['application/vnd.ms-powerpoint', 'application/octet-stream'])],
  ['.pptx', new Set(['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/octet-stream'])],
  ['.png', new Set(['image/png'])],
  ['.jpg', new Set(['image/jpeg'])],
  ['.jpeg', new Set(['image/jpeg'])],
]);

const fontTypes = new Map([
  ['.ttf', new Set(['font/ttf', 'application/x-font-ttf', 'application/octet-stream'])],
  ['.otf', new Set(['font/otf', 'application/x-font-opentype', 'application/octet-stream'])],
  ['.woff', new Set(['font/woff', 'application/font-woff', 'application/octet-stream'])],
  ['.woff2', new Set(['font/woff2', 'application/font-woff2', 'application/octet-stream'])],
]);

const storage = multer.diskStorage({
  destination: env.uploadDirectory,
  filename(req, file, callback) {
    callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
  },
});

function fileFilter(req, file, callback) {
  const extension = path.extname(file.originalname).toLowerCase();
  const allowedTypes = file.fieldname === 'fontFile' ? fontTypes : documentTypes;
  const validMimeTypes = allowedTypes.get(extension);
  if (!validMimeTypes || !validMimeTypes.has(file.mimetype)) {
    const error = new Error('Unsupported file type');
    error.statusCode = 422;
    return callback(error);
  }
  return callback(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

export const contactAttachmentUpload = upload.single('attachment');
export const publicSubmissionUpload = upload.fields([
  { name: 'attachment', maxCount: 1 },
  { name: 'fontFile', maxCount: 1 },
]);
