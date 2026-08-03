// Reads pixel width/height directly from a PNG or JPEG buffer's header, without a full
// image-decoding library — this app has no native image-processing dependency (no
// `sharp`/`imagemagick`, nothing that would need a native rebuild inside Docker) and
// intentionally doesn't add one just for a dimension check. Returns null for any
// format/buffer this can't parse; callers should treat that as "skip the exact-size
// check" rather than a hard failure, since format is still validated separately.
function getImageDimensions(buffer, mimeType) {
    try {
        if (mimeType === 'image/png') return readPngDimensions(buffer);
        if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return readJpegDimensions(buffer);
    } catch (_err) {
        return null;
    }
    return null;
}

function readPngDimensions(buffer) {
    // PNG signature (8 bytes) + IHDR chunk length (4 bytes) + chunk type "IHDR" (4
    // bytes) -> width/height are the next 8 bytes as two big-endian uint32s.
    if (buffer.length < 24) return null;
    const isPng = buffer.readUInt32BE(0) === 0x89504e47 && buffer.readUInt32BE(4) === 0x0d0a1a0a;
    if (!isPng) return null;
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function readJpegDimensions(buffer) {
    if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
    let offset = 2;
    while (offset + 3 < buffer.length) {
        if (buffer[offset] !== 0xff) {
            offset += 1;
            continue;
        }
        const marker = buffer[offset + 1];
        // SOF0-SOF15 (excluding DHT/JPG/DAC at 0xC4/0xC8/0xCC) all carry height/width at
        // the same offset within their segment.
        const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
        const length = buffer.readUInt16BE(offset + 2);
        if (isSOF) {
            return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
        }
        offset += 2 + length;
    }
    return null;
}

module.exports = { getImageDimensions };
