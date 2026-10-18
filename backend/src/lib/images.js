export const MAX_IMAGE_BYTES = 1_500_000;

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** True when the string is base64 of a JPEG that is small enough. */
export function isJpeg(data) {
  if (!BASE64.test(data)) return false;
  const bytes = Buffer.from(data, 'base64');
  return bytes.length <= MAX_IMAGE_BYTES && bytes[0] === 0xff && bytes[1] === 0xd8;
}
