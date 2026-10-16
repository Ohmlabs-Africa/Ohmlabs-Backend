import { removeUploadedFiles } from '../utils/uploadedFiles.js';

export function parseDetails(req, res, next) {
  if (typeof req.body.details !== 'string') return next();

  let details;
  try {
    details = JSON.parse(req.body.details);
  } catch {
    try {
      removeUploadedFiles(req);
    } catch (error) {
      return next(error);
    }
    return res.status(422).json({ success: false, error: 'Submission details must be valid JSON' });
  }

  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    try {
      removeUploadedFiles(req);
    } catch (error) {
      return next(error);
    }
    return res.status(422).json({ success: false, error: 'Submission details must be an object' });
  }

  req.body.details = details;
  return next();
}
