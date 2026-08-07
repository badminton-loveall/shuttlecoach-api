import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { UserRole } from '../types';

const SALT_ROUNDS = 10;

/**
 * Hash a password using bcrypt
 */
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compare a plain text password with a hashed password
 */
export const comparePassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

/**
 * Generate a JWT token
 */
export const generateToken = (payload: {
  id: string;
  username: string;
  role: UserRole;
  centerId?: string;
}): string => {
  // Build token payload - omit centerId for ADMIN users
  const tokenPayload: Record<string, any> = {
    id: payload.id,
    username: payload.username,
    role: payload.role,
  };
  if (payload.role !== UserRole.ADMIN && payload.centerId) {
    tokenPayload.centerId = payload.centerId;
  }
  return jwt.sign(tokenPayload, config.jwtSecret, {
    expiresIn: '24h',
  });
};

/**
 * Verify and decode a JWT token
 */
export const verifyToken = (
  token: string
): { id: string; username: string; role: UserRole; centerId?: string } | null => {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as {
      id: string;
      username: string;
      role: UserRole;
      centerId?: string;
    };
    return decoded;
  } catch (error) {
    return null;
  }
};
