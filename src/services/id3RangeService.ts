/**
 * Binary ID3v2 Partial Range Parser for AudioCar
 * Executes partial HTTP Range requests (Range: bytes=0-20480)
 * Extracts embedded ID3v2 metadata (Title, Artist, Album, Year, APIC Artwork)
 * reducing initial scanning bandwidth consumption by ~99% and avoiding quota limits (403).
 */

import { fetchWithDriveBackoff } from './driveBackoff';

export interface ParsedID3Metadata {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  artworkBlobUrl?: string;
  artworkFormat?: 'JPG' | 'PNG' | 'GIF' | 'WEBP';
}

export class ID3RangeService {
  /**
   * Fetches only the first 20 KB of an audio file using HTTP Range header
   * with Exponential Backoff with Jitter for quota protection.
   */
  public async fetchHeaderRange(driveFileId: string, token: string): Promise<ArrayBuffer | null> {
    const url = `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`;
    try {
      const response = await fetchWithDriveBackoff(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Range: 'bytes=0-20480'
        }
      }, {
        maxRetries: 3,
        baseDelayMs: 800
      });

      if (!response.ok && response.status !== 206) {
        return null;
      }

      return await response.arrayBuffer();
    } catch (e) {
      console.warn('[ID3RangeService] Range request notice for file:', driveFileId, e);
      return null;
    }
  }

  /**
   * Decodes ID3v2 header and tags from binary ArrayBuffer (first 20 KB)
   */
  public parseID3Buffer(buffer: ArrayBuffer): ParsedID3Metadata {
    const result: ParsedID3Metadata = {};
    if (!buffer || buffer.byteLength < 10) return result;

    const data = new DataView(buffer);

    // Check ID3 magic bytes ('ID3' in ASCII = 0x49, 0x44, 0x33)
    if (data.getUint8(0) !== 0x49 || data.getUint8(1) !== 0x44 || data.getUint8(2) !== 0x33) {
      return result;
    }

    const majorVersion = data.getUint8(3); // e.g. 3 for ID3v2.3, 4 for ID3v2.4
    if (majorVersion < 2 || majorVersion > 4) return result;

    // Synchsafe integer decoder for ID3 size
    const totalTagSize =
      ((data.getUint8(6) & 0x7f) << 21) |
      ((data.getUint8(7) & 0x7f) << 14) |
      ((data.getUint8(8) & 0x7f) << 7) |
      (data.getUint8(9) & 0x7f);

    const maxOffset = Math.min(buffer.byteLength, totalTagSize + 10);
    let offset = 10;

    while (offset + 10 <= maxOffset) {
      const frameId = String.fromCharCode(
        data.getUint8(offset),
        data.getUint8(offset + 1),
        data.getUint8(offset + 2),
        data.getUint8(offset + 3)
      );

      if (frameId.charCodeAt(0) === 0) break;

      let frameSize = 0;
      if (majorVersion === 4) {
        frameSize =
          ((data.getUint8(offset + 4) & 0x7f) << 21) |
          ((data.getUint8(offset + 5) & 0x7f) << 14) |
          ((data.getUint8(offset + 6) & 0x7f) << 7) |
          (data.getUint8(offset + 7) & 0x7f);
      } else {
        frameSize = data.getUint32(offset + 4);
      }

      if (frameSize <= 0 || offset + 10 + frameSize > buffer.byteLength) {
        break;
      }

      const frameDataOffset = offset + 10;
      const frameBuffer = new Uint8Array(buffer, frameDataOffset, frameSize);

      try {
        switch (frameId) {
          case 'TIT2':
            result.title = this.decodeTextFrame(frameBuffer);
            break;
          case 'TPE1':
            result.artist = this.decodeTextFrame(frameBuffer);
            break;
          case 'TALB':
            result.album = this.decodeTextFrame(frameBuffer);
            break;
          case 'TYER':
          case 'TDRC':
            result.year = this.decodeTextFrame(frameBuffer).slice(0, 4);
            break;
          case 'APIC':
            const artwork = this.decodeAPICFrame(frameBuffer);
            if (artwork) {
              result.artworkBlobUrl = artwork.url;
              result.artworkFormat = artwork.format;
            }
            break;
        }
      } catch {
        // Next frame
      }

      offset += 10 + frameSize;
    }

    return result;
  }

  private decodeTextFrame(bytes: Uint8Array): string {
    if (bytes.length <= 1) return '';
    const encoding = bytes[0];
    const textBytes = bytes.subarray(1);

    try {
      if (encoding === 0) {
        let str = '';
        for (let i = 0; i < textBytes.length; i++) {
          if (textBytes[i] === 0) break;
          str += String.fromCharCode(textBytes[i]);
        }
        return str.trim();
      } else if (encoding === 1 || encoding === 2) {
        const decoder = new TextDecoder('utf-16');
        return decoder.decode(textBytes).replace(/\0/g, '').trim();
      } else if (encoding === 3) {
        const decoder = new TextDecoder('utf-8');
        return decoder.decode(textBytes).replace(/\0/g, '').trim();
      }
    } catch {
      // Fallback
    }

    return '';
  }

  private decodeAPICFrame(bytes: Uint8Array): { url: string; format: 'JPG' | 'PNG' | 'GIF' | 'WEBP' } | null {
    if (bytes.length < 10) return null;

    let offset = 1;
    let mimeType = '';
    while (offset < bytes.length && bytes[offset] !== 0) {
      mimeType += String.fromCharCode(bytes[offset]);
      offset++;
    }
    offset++;

    if (offset >= bytes.length) return null;
    offset++; // picture type

    while (offset < bytes.length && bytes[offset] !== 0) {
      offset++;
    }
    offset++;
    if (offset < bytes.length && bytes[offset] === 0) offset++;

    if (offset >= bytes.length) return null;

    const imgData = bytes.subarray(offset);
    if (imgData.length === 0) return null;

    let format: 'JPG' | 'PNG' | 'GIF' | 'WEBP' = 'JPG';
    const cleanMime = (mimeType || '').toLowerCase();
    if (cleanMime.includes('png')) format = 'PNG';
    else if (cleanMime.includes('webp')) format = 'WEBP';
    else if (cleanMime.includes('gif')) format = 'GIF';

    try {
      const blob = new Blob([imgData], { type: cleanMime || 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      return { url, format };
    } catch {
      return null;
    }
  }
}

export const id3RangeService = new ID3RangeService();
