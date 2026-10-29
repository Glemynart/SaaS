export type ContentDispositionType = 'attachment' | 'inline';

export function buildContentDispositionHeader(
  disposition: ContentDispositionType,
  filename: string,
): string {
  const safeFilename =
    Array.from(filename, (character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return character === '\\' ||
        character === '/' ||
        codePoint < 0x20 ||
        (codePoint >= 0x7f && codePoint <= 0x9f)
        ? '_'
        : character;
    })
      .join('')
      .trim() || 'documento';

  const asciiFilename = safeFilename
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_');
  const encodedFilename = encodeURIComponent(safeFilename).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return `${disposition}; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`;
}
