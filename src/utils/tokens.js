import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const accessToken = (user) => jwt.sign({ id: user._id.toString(), role: user.role }, env.jwtSecret, { expiresIn: env.accessExpiresIn });
export const refreshToken = (user) => jwt.sign({ id: user._id.toString(), role: user.role }, env.refreshSecret, { expiresIn: env.refreshExpiresIn });
export const verifyAccess = (token) => jwt.verify(token, env.jwtSecret);
export const verifyRefresh = (token) => jwt.verify(token, env.refreshSecret);
