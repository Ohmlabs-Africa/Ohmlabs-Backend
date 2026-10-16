import { validationResult } from 'express-validator';
import { removeUploadedFiles } from './uploadedFiles.js';

export function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    try {
      removeUploadedFiles(req);
    } catch (error) {
      return next(error);
    }
    return res.status(422).json({ success: false, error: 'Validation failed', details: errors.array() });
  }
  next();
}
