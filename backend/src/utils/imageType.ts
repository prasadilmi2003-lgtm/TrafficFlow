import { open } from 'node:fs/promises';

export type ImageType = 'jpeg' | 'png' | 'webp';

/**
 * Detects the real image format from the first bytes of a file ("magic
 * numbers"). The file name and the Content-Type sent by the browser can be
 * faked, so uploaded files are checked this way before they are accepted.
 */
export async function detectImageType(path: string): Promise<ImageType | undefined> {
  const file = await open(path, 'r');
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await file.read(header, 0, 12, 0);
    return imageTypeOf(header.subarray(0, bytesRead));
  } finally {
    await file.close();
  }
}

export function imageTypeOf(header: Uint8Array): ImageType | undefined {
  const bytes = Buffer.from(header);
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png';
  }
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    return 'webp';
  }
  return undefined;
}
