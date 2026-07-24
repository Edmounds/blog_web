/**
 * Utility functions for fetching cover images from public APIs.
 * These APIs do not require API keys for public usage.
 */

interface GoogleBooksResponse {
  items?: Array<{ volumeInfo?: { imageLinks?: { thumbnail?: string } } }>;
}

/**
 * Fetch a cover image URL for a book using the Google Books API.
 * @param query The title of the book.
 * @returns A promise that resolves to the thumbnail image URL, or null if not found.
 */
export async function getBookCover(query: string): Promise<string | null> {
  try {
    const url = new URL('https://www.googleapis.com/books/v1/volumes');
    url.searchParams.set('q', query);
    url.searchParams.set('maxResults', '1');

    const res = await fetch(url.toString());
    if (!res.ok) return null;

    const data = await res.json() as GoogleBooksResponse;
    if (data.items && data.items.length > 0) {
      const volumeInfo = data.items[0].volumeInfo;
      // Use the thumbnail, which is generally provided if any image exists.
      // Use HTTPS to prevent mixed content warnings.
      const thumbnail = volumeInfo?.imageLinks?.thumbnail;
      if (thumbnail) {
        return thumbnail.replace('http:', 'https:');
      }
    }
    return null;
  } catch (error) {
    console.error('Error fetching book cover:', error);
    return null;
  }
}
