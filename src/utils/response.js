export const ok = (res, data, message = 'Success', status = 200) => res.status(status).json({ success: true, data, message });
export const fail = (res, error, status = 400) => res.status(status).json({ success: false, error });
