/**
 * Utility functions for fetching cover images from public APIs.
 * These APIs do not require API keys for public usage.
 */

/**
 * Fetch a cover image URL for a movie or music album using the iTunes Search API.
 * @param query The title of the movie or album.
 * @param type Either 'movie' or 'album'.
 * @returns A promise that resolves to the high-resolution image URL, or null if not found.
 */
interface ItunesSearchResponse {
  results?: Array<{ artworkUrl100?: string }>;
}

interface GoogleBooksResponse {
  items?: Array<{ volumeInfo?: { imageLinks?: { thumbnail?: string } } }>;
}

export async function getMediaCover(query: string, type: 'movie' | 'album'): Promise<string | null> {
  try {
    const url = new URL('https://itunes.apple.com/search');
    url.searchParams.set('term', query);
    url.searchParams.set('entity', type);
    url.searchParams.set('limit', '1');
    url.searchParams.set('country', 'US');

    const res = await fetch(url.toString());
    if (!res.ok) return null;

    const data = await res.json() as ItunesSearchResponse;
    if (data.results && data.results.length > 0) {
      // The API typically returns a 100x100 image. We can ask for a much larger one by string replacement.
      const artwork = data.results[0].artworkUrl100;
      if (artwork) {
        return artwork.replace('100x100bb', '600x600bb');
      }
    }
    return null;
  } catch (error) {
    console.error('Error fetching media cover:', error);
    return null;
  }
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
