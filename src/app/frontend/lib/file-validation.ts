const MiB = 1024 * 1024;

function isPng(bytes: Uint8Array) {
  return bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}

function isJpeg(bytes: Uint8Array) {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isWebp(bytes: Uint8Array) {
  return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
}

function isPdf(bytes: Uint8Array) {
  return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-';
}

function pngDimensions(bytes: Uint8Array) {
  if (!isPng(bytes)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function jpegDimensions(bytes: Uint8Array) {
  if (!isJpeg(bytes)) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
    const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
    if (length < 2 || offset + length + 2 > bytes.length) return null;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: (bytes[offset + 5] << 8) + bytes[offset + 6], width: (bytes[offset + 7] << 8) + bytes[offset + 8] };
    }
    offset += length + 2;
  }
  return null;
}

async function readHeader(file: File) {
  return new Uint8Array(await file.slice(0, Math.min(file.size, MiB)).arrayBuffer());
}

export async function validateImageUpload(file: File, options: { maxBytes?: number; maxPixels?: number } = {}) {
  const maxBytes = options.maxBytes ?? 12 * MiB;
  const maxPixels = options.maxPixels ?? 40_000_000;
  if (file.size <= 0 || file.size > maxBytes) throw new Error(`Image must be smaller than ${Math.floor(maxBytes / MiB)} MB.`);
  const bytes = await readHeader(file);
  if (!isPng(bytes) && !isJpeg(bytes) && !isWebp(bytes)) throw new Error('Only verified PNG, JPEG, and WebP images are accepted.');
  const dimensions = pngDimensions(bytes) ?? jpegDimensions(bytes);
  if (dimensions && dimensions.width * dimensions.height > maxPixels) throw new Error('Image dimensions are too large to process safely.');
  return { mimeType: isPng(bytes) ? 'image/png' : isJpeg(bytes) ? 'image/jpeg' : 'image/webp', dimensions };
}

export async function validateReferenceDocument(file: File) {
  const maxBytes = 20 * MiB;
  if (file.size <= 0 || file.size > maxBytes) throw new Error(`Reference documents must be smaller than ${maxBytes / MiB} MB.`);
  const bytes = await readHeader(file);
  if (isPdf(bytes)) return { mimeType: 'application/pdf' };
  const image = await validateImageUpload(file, { maxBytes, maxPixels: 40_000_000 });
  return { mimeType: image.mimeType };
}
