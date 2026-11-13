// UTF-8 helpers for byte offsets, ported from PE apps/server/src/evaluation/utf8.ts with
// TextEncoder, TextDecoder and Uint8Array in place of Node's Buffer, so they run anywhere.

const encoder = new TextEncoder();
// Keeps a leading byte order mark, as Buffer does; a default TextDecoder strips it.
const decoder = new TextDecoder(undefined, { ignoreBOM: true });

export const encodeUtf8 = (value: string): Uint8Array => encoder.encode(value);

export const decodeUtf8 = (bytes: Uint8Array): string => decoder.decode(bytes);

export const concatBytes = (parts: readonly Uint8Array[]): Uint8Array => {
  let length = 0;
  for (const part of parts) {
    length += part.byteLength;
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
};

export const isWellFormedUtf8String = (value: string): boolean =>
  decodeUtf8(encodeUtf8(value)) === value;

export const isUtf8ByteBoundary = (
  source: Uint8Array,
  offset: number
): boolean => {
  if (offset === 0 || offset === source.byteLength) {
    return true;
  }

  const byte = source[offset];
  return byte !== undefined && (byte < 0x80 || byte > 0xbf);
};
