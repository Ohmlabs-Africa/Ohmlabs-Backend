import { openSync, readSync, closeSync } from 'node:fs';
import { removeUploadedFiles, uploadedFiles } from '../utils/uploadedFiles.js';

const signatures = {
  '.pdf': (header) => header.subarray(0, 5).equals(Buffer.from('%PDF-')),
  '.png': (header) => header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  '.jpg': (header) => header.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  '.jpeg': (header) => header.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  '.doc': (header) => header.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
  '.xls': (header) => header.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
  '.ppt': (header) => header.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
  '.docx': (header) => header.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])),
  '.xlsx': (header) => header.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])),
  '.pptx': (header) => header.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])),
  '.ttf': (header) => header.subarray(0, 4).equals(Buffer.from([0x00, 0x01, 0x00, 0x00])) || header.subarray(0, 4).toString() === 'true',
  '.otf': (header) => header.subarray(0, 4).toString() === 'OTTO',
  '.woff': (header) => header.subarray(0, 4).toString() === 'wOFF',
  '.woff2': (header) => header.subarray(0, 4).toString() === 'wOF2',
};

function hasValidSignature(file) {
  const extension = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();
  const verify = signatures[extension];
  if (!verify) return false;

  const descriptor = openSync(file.path, 'r');
  try {
    const header = Buffer.alloc(8);
    const bytesRead = readSync(descriptor, header, 0, header.length, 0);
    return bytesRead >= 4 && verify(header);
  } finally {
    closeSync(descriptor);
  }
}

export function verifyUploadSignature(req, res, next) {
  const files = uploadedFiles(req);
  if (files.every(hasValidSignature)) return next();

  try {
    removeUploadedFiles(req);
  } catch (error) {
    return next(error);
  }
  return res.status(422).json({ success: false, error: 'Uploaded file content does not match an allowed file type' });
}
