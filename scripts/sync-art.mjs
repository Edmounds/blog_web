import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT_DIR, 'src/data/art-source.json');
const OUTPUT_FILE = path.join(ROOT_DIR, 'src/lib/artData.ts');
const IMAGE_DIR = path.join(ROOT_DIR, 'public/images/content/art');

// Ensure image directory exists
if (!fs.existsSync(IMAGE_DIR)) {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
}

async function fetchImage(url, dest) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Check if it's a placeholder image (e.g., Google Books generic 9KB/2KB images)
    if (buffer.length < 10000) {
      console.warn(`[WARN] Downloaded image is suspiciously small (${buffer.length} bytes), likely a placeholder. Rejecting it.`);
      return false;
    }

    fs.writeFileSync(dest, buffer);
    console.log(`[DOWNLOADED] -> ${path.basename(dest)}`);
    return true;
  } catch (error) {
    console.error(`[ERROR] Failed to download image from ${url}:`, error.message);
    return false;
  }
}

async function getImageUrl(item) {
  const { title, creator, type } = item;
  try {
    if (type === 'music') {
      const query = encodeURIComponent(`${title} ${creator}`);
      const res = await fetch(`https://itunes.apple.com/search?term=${query}&entity=album&limit=1&country=cn`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        let url = data.results[0].artworkUrl100;
        // Get high-res cover
        return url.replace('100x100bb', '600x600bb');
      }
    } else if (type === 'movie') {
      const query = encodeURIComponent(title);
      const tmdbApiKey = process.env.TMDB_API_KEY;
      if (!tmdbApiKey) throw new Error("TMDB_API_KEY is missing in .env");
      const res = await fetch(`https://api.themoviedb.org/3/search/movie?query=${query}&language=zh-CN&api_key=${tmdbApiKey}`);
      const data = await res.json();
      if (data.results && data.results.length > 0 && data.results[0].poster_path) {
        return `https://image.tmdb.org/t/p/w600_and_h900_bestv2${data.results[0].poster_path}`;
      }
    } else if (type === 'book') {
      const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
      
      // We will try three different query levels in sequence to get the best match:
      // 1. intitle:${title} + inauthor:${creator} (Highly specific)
      // 2. intitle:${title}
      // 3. title + creator (General search)
      const queries = [
        `intitle:${title} inauthor:${creator}`,
        `intitle:${title}`,
        `${title} ${creator}`
      ];

      for (const qStr of queries) {
        let attempt = 0;
        const maxRetries = 3;

        while (attempt < maxRetries) {
          try {
            const query = encodeURIComponent(qStr);
            const url = apiKey 
              ? `https://www.googleapis.com/books/v1/volumes?q=${query}&key=${apiKey}`
              : `https://www.googleapis.com/books/v1/volumes?q=${query}`;
            
            const res = await fetch(url);
            if (res.ok) {
              const data = await res.json();
              if (data.items && data.items.length > 0) {
                for (const itemEntry of data.items) {
                  const volumeInfo = itemEntry.volumeInfo;
                  if (volumeInfo.imageLinks && volumeInfo.imageLinks.thumbnail) {
                    console.log(`[FOUND COVER] on Google Books for "${title}" using query "${qStr}"`);
                    return volumeInfo.imageLinks.thumbnail.replace('zoom=1', 'zoom=3').replace('&edge=curl', '');
                  }
                }
              }
              // If query succeeds but no cover found, break retry loop and try next query
              break; 
            } else {
              console.warn(`[WARN] Google Books API returned status ${res.status} for query "${qStr}" (Attempt ${attempt + 1}/${maxRetries})`);
              if (res.status === 429) {
                // Rate limited, wait before retrying
                await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
              } else {
                break; // Don't retry on other HTTP errors like 400 or 403
              }
            }
          } catch (err) {
            console.warn(`[WARN] Google Books API call failed for query "${qStr}" (Attempt ${attempt + 1}/${maxRetries}): ${err.message}`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          }
          attempt++;
        }
      }
    }
  } catch (error) {
    console.error(`[API ERROR] Failed to fetch metadata for ${title}:`, error.message);
  }
  return null;
}

function generateSvgCover(item) {
  const { id, title, creator } = item;
  
  // A set of highly elegant gradient palettes tailored for different styles
  const gradients = [
    { stop1: '#111827', stop2: '#1F2937', text: '#F9FAFB', sub: '#9CA3AF' }, // Dark slate
    { stop1: '#0F172A', stop2: '#1E293B', text: '#F8FAFC', sub: '#94A3B8' }, // Dark blue-grey
    { stop1: '#1E1B4B', stop2: '#312E81', text: '#EEF2FF', sub: '#C7D2FE' }, // Indigo-night
    { stop1: '#1C1917', stop2: '#292524', text: '#FAFAF9', sub: '#A8A29E' }, // Stone-charcoal
    { stop1: '#022C22', stop2: '#064E3B', text: '#ECFDF5', sub: '#A7F3D0' }  // Deep emerald
  ];

  // Pick a gradient stably based on item title
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const grad = gradients[Math.abs(hash) % gradients.length];

  // Split title if too long to wrap cleanly in SVG
  let titleGroup = '';
  if (title.length > 8) {
    const half = Math.ceil(title.length / 2);
    const firstLine = title.substring(0, half);
    const secondLine = title.substring(half);
    titleGroup = `
      <text x="50%" y="36%" dominant-baseline="middle" text-anchor="middle" font-family="'Cinzel', 'Noto Serif SC', 'Playfair Display', serif" font-size="28" font-weight="bold" fill="${grad.text}" letter-spacing="1">${firstLine}</text>
      <text x="50%" y="46%" dominant-baseline="middle" text-anchor="middle" font-family="'Cinzel', 'Noto Serif SC', 'Playfair Display', serif" font-size="28" font-weight="bold" fill="${grad.text}" letter-spacing="1">${secondLine}</text>
    `;
  } else {
    titleGroup = `
      <text x="50%" y="41%" dominant-baseline="middle" text-anchor="middle" font-family="'Cinzel', 'Noto Serif SC', 'Playfair Display', serif" font-size="32" font-weight="bold" fill="${grad.text}" letter-spacing="2">${title}</text>
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" width="100%" height="100%">
  <defs>
    <linearGradient id="grad-${id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${grad.stop1};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${grad.stop2};stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#grad-${id})" />
  <rect x="20" y="20" width="360" height="560" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1.5" rx="12" />
  
  <!-- Subtle lighting accent -->
  <circle cx="200" cy="0" r="220" fill="rgba(255,255,255,0.015)" filter="blur(30px)" />
  
  <!-- Book spine visual simulation shadow -->
  <rect x="0" y="0" width="16" height="600" fill="rgba(0,0,0,0.25)" />
  <line x1="16" y1="0" x2="16" y2="600" stroke="rgba(255,255,255,0.05)" stroke-width="1" />

  ${titleGroup}

  <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle" font-family="'Inter', 'Noto Sans SC', sans-serif" font-size="15" fill="${grad.sub}" letter-spacing="1">
    ${creator}
  </text>
  
  <line x1="160" y1="480" x2="240" y2="480" stroke="rgba(255,255,255,0.12)" stroke-width="1" />
  <text x="50%" y="515" dominant-baseline="middle" text-anchor="middle" font-family="'Inter', sans-serif" font-size="10" fill="rgba(255,255,255,0.25)" letter-spacing="3">
    SELECTED BOOK
  </text>
</svg>`;
}

async function run() {
  console.log("Starting Art Sync Script...");

  if (!fs.existsSync(DATA_FILE)) {
    console.error("Source data file not found:", DATA_FILE);
    process.exit(1);
  }

  const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
  const items = JSON.parse(rawData);
  const populatedItems = [];

  for (const item of items) {
    const jpgFilename = `${item.type}_${item.id}.jpg`;
    const svgFilename = `${item.type}_${item.id}.svg`;
    const jpgPath = path.join(IMAGE_DIR, jpgFilename);
    const svgPath = path.join(IMAGE_DIR, svgFilename);

    let needsDownload = true;
    let publicPath = "";

    // 1. Check local cache (JPG)
    if (fs.existsSync(jpgPath)) {
      console.log(`[CACHED] ${jpgFilename} exists.`);
      needsDownload = false;
      publicPath = `/images/content/art/${jpgFilename}`;
    } 
    // 2. Check local cache (SVG Fallback)
    else if (fs.existsSync(svgPath)) {
      console.log(`[CACHED] ${svgFilename} exists.`);
      needsDownload = false;
      publicPath = `/images/content/art/${svgFilename}`;
    }

    // 3. Download if not cached
    if (needsDownload) {
      console.log(`[FETCHING METADATA] ${item.title}...`);
      const imageUrl = await getImageUrl(item);
      if (imageUrl) {
        const success = await fetchImage(imageUrl, jpgPath);
        if (success) {
          publicPath = `/images/content/art/${jpgFilename}`;
        }
      }

      // If download failed or no cover was found, generate a beautiful local SVG cover!
      if (!publicPath) {
        console.log(`[GENERATING FALLBACK COVER] ${item.title}...`);
        const svgContent = generateSvgCover(item);
        fs.writeFileSync(svgPath, svgContent);
        publicPath = `/images/content/art/${svgFilename}`;
      }
    }

    populatedItems.push({
      ...item,
      cover: publicPath
    });
  }

  // Generate the TypeScript file
  const tsContent = `// AUTO-GENERATED BY scripts/sync-art.mjs
// DO NOT EDIT DIRECTLY. Edit src/data/art-source.json instead.

export interface ArtItem {
  id: string;
  title: string;
  creator: string;
  cover: string;
  type: "music" | "book" | "movie";
  extra?: string;
}

export const artData: ArtItem[] = ${JSON.stringify(populatedItems, null, 2)};
`;

  fs.writeFileSync(OUTPUT_FILE, tsContent);
  console.log(`[SUCCESS] Generated ${OUTPUT_FILE}`);
}

run();
