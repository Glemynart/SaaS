import { BadRequestException } from '@nestjs/common';
import { extname } from 'node:path';

export const MAX_MANUAL_DOCUMENT_SIZE = 5 * 1024 * 1024;

type ManualDocumentFormat = {
  mimeType: string;
  extensions: readonly string[];
  matches: (buffer: Buffer) => boolean;
};

const FORMATS: readonly ManualDocumentFormat[] = [
  {
    mimeType: 'application/pdf',
    extensions: ['pdf'],
    matches: (buffer) => buffer.subarray(0, 5).toString('ascii') === '%PDF-',
  },
  {
    mimeType: 'image/jpeg',
    extensions: ['jpg', 'jpeg'],
    matches: (buffer) =>
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff,
  },
  {
    mimeType: 'image/png',
    extensions: ['png'],
    matches: (buffer) =>
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mimeType: 'image/webp',
    extensions: ['webp'],
    matches: (buffer) =>
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

export interface ValidatedManualDocument {
  extension: string;
  mimeType: string;
  originalName: string;
  size: number;
}

export function validateManualDocument(file: {
  originalname?: string;
  buffer?: Buffer;
}): ValidatedManualDocument {
  const buffer = file?.buffer;
  if (!buffer || buffer.length === 0) {
    throw new BadRequestException(
      'El archivo está vacío o no fue proporcionado.',
    );
  }

  if (buffer.length > MAX_MANUAL_DOCUMENT_SIZE) {
    throw new BadRequestException('El archivo no puede superar 5 MB.');
  }

  const originalName = file.originalname?.trim() ?? '';
  const extension = extname(originalName).slice(1).toLowerCase();
  const format = FORMATS.find((candidate) => candidate.matches(buffer));

  if (!format || !format.extensions.includes(extension)) {
    throw new BadRequestException(
      'El archivo no coincide con una extensión permitida: PDF, JPG, PNG o WebP.',
    );
  }

  return {
    extension,
    mimeType: format.mimeType,
    originalName,
    size: buffer.length,
  };
}
