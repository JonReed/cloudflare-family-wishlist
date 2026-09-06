export function parseAttributes(tag: string): Map<string, string> {
  const attributes = new Map<string, string>();
  const attributePattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  for (const match of tag.matchAll(attributePattern)) {
    const name = match[1]?.toLowerCase();
    if (!name) continue;
    attributes.set(name, match[2] ?? match[3] ?? match[4] ?? '');
  }

  return attributes;
}

export function decodeHtmlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"'
  };

  return value.replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z]+);/gi, (entity, name: string) => {
    if (name.startsWith('#')) {
      const isHex = name[1]?.toLowerCase() === 'x';
      const codePoint = Number.parseInt(name.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (Number.isSafeInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff) {
        return String.fromCodePoint(codePoint);
      }
      return entity;
    }

    return namedEntities[name.toLowerCase()] ?? entity;
  });
}

export function cleanText(value: string): string {
  return decodeHtmlEntities(value).replace(/\s+/g, ' ').trim();
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function valueAsString(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

export function normalisePrice(rawPrice: string, rawCurrency: string): string {
  const price = cleanText(rawPrice);
  const currency = cleanText(rawCurrency).toUpperCase();
  if (!price) return '';
  if (currency && currency !== 'GBP') return '';
  if (!currency && /[$€¥]/.test(price)) return '';

  const markedCurrentPrice =
    /(?:\bnow\b|\bcurrent price\b|\bour price\b|\bsale price\b)\s*:?\s*(?:£|GBP\s*)?(\d[\d,\s]*(?:\.\d{1,2})?)/i.exec(
      price
    );
  const match = markedCurrentPrice ?? /(?:£|GBP\s*)?(\d[\d,\s]*(?:\.\d{1,2})?)/i.exec(price);
  if (!match?.[1]) return '';

  const amount = Number(match[1].replace(/[\s,]/g, ''));
  if (!Number.isFinite(amount) || amount < 0 || amount > 9_999_999.99) return '';
  return amount.toFixed(2);
}
