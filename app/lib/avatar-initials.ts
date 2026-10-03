export function avatarInitials(displayName: string): string {
  const words = displayName.trim().split(/\s+/u);
  return (
    [words[0], ...(words.length > 1 ? words.slice(-1) : [])]
      .map((word) => Array.from(word ?? '')[0] ?? '')
      .join('')
      .toUpperCase()
      .replace(/[^\p{L}\p{N}]/gu, '') || '?'
  );
}
