import { unlinkSync } from 'node:fs';

export function uploadedFiles(req) {
  return req.file ? [req.file] : Object.values(req.files || {}).flat();
}

export function removeUploadedFiles(req) {
  for (const file of uploadedFiles(req)) unlinkSync(file.path);
}
