import { createHmac, timingSafeEqual } from 'node:crypto';

import { config } from '../config.js';

const WINDOW_SECONDS = 24 * 60 * 60;

const sign = (photoId, expires) =>
  createHmac('sha256', config.jwtSecret).update(`${photoId}.${expires}`).digest('hex');

/** Photo links are stable for a day (so browsers can cache them) and valid for one to two days. */
export function photoLink(photoId) {
  const now = Math.floor(Date.now() / 1000);
  const expires = (Math.floor(now / WINDOW_SECONDS) + 2) * WINDOW_SECONDS;
  return `/photos/${photoId}?expires=${expires}&sig=${sign(photoId, expires)}`;
}

export function isValidPhotoLink(photoId, expires, signature) {
  if (expires < Date.now() / 1000) return false;
  const expected = Buffer.from(sign(photoId, expires));
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
