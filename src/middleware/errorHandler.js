export function errorHandler(error, req, res, next) {
  console.error(error);
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ success: false, error: 'Uploaded file exceeds the 10 MB limit' });
  if (error.name === 'MulterError') return res.status(422).json({ success: false, error: 'Invalid file upload' });
  if (error.code === 11000) return res.status(409).json({ success: false, error: 'A record with that value already exists' });
  return res.status(error.statusCode || 500).json({ success: false, error: error.statusCode ? error.message : 'Internal server error' });
}
