import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import multer from 'multer';
import type { AppConfig } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/**
 * Accepts one optional image in the multipart field "image".
 *
 * - Only JPEG, PNG and WebP, up to the configured size.
 * - Files get a random name; the name sent by the browser is never used,
 *   which rules out path tricks such as "../../server.js".
 * - The service also checks the file's real content (utils/imageType.ts),
 *   because the browser-reported type can be faked.
 */
export function imageUpload(uploads: AppConfig['uploads']): RequestHandler {
  return multer({
    storage: multer.diskStorage({
      destination: uploads.dir,
      filename: (_req, file, callback) => {
        callback(null, `${randomUUID()}${EXTENSIONS[file.mimetype] ?? ''}`);
      },
    }),
    limits: { fileSize: uploads.maxSizeBytes, files: 1, fields: 20 },
    fileFilter: (_req, file, callback) => {
      if (file.mimetype in EXTENSIONS) {
        callback(null, true);
      } else {
        callback(AppError.badRequest('INVALID_FILE_TYPE', 'Only JPEG, PNG and WebP images are allowed'));
      }
    },
  }).single('image');
}
