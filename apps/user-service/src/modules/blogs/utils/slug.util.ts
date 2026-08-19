export function generateSlug(title: string): string {
  const baseSlug = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const uniqueSuffix = Math.random().toString(36).substring(2, 7);
  return `${baseSlug}-${uniqueSuffix}`;
}

export function calculateReadingTime(content: string): number {
  if (!content) return 1;
  const wordsPerMinute = 200;
  const wordCount = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
}
