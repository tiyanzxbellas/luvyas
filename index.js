const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const BASE = 'https://v4.luvyaa.co';
const OUTPUT = '/tmp/scrape';

const TYPES = ['manga', 'manhua', 'manhwa', 'novel', 'pornwa'];
const STATUSES = ['', 'ongoing', 'completed', 'hiatus'];
const ORDERS = ['update', 'popular', 'title', 'titlereverse'];

const GENRES = {
  '4': 'Action', '5': 'Fantasy', '6': 'Adventure', '10': 'Drama',
  '25': 'School Life', '29': 'Psychological', '33': 'Time Travel',
  '35': 'Revenge', '43': 'Magic', '50': 'Adult', '51': 'Supernatural',
  '52': 'Romance', '83': 'Ecchi', '109': 'Thriller', '111': 'Comedy',
  '133': 'Military', '298': 'Mystery', '705': 'Cooking', '818': 'Demons',
  '881': 'Game', '1002': 'Shoujo', '1049': 'Mature', '1119': 'Historical',
  '1153': 'Shounen', '1224': 'Martial Arts', '1326': 'Horror',
  '1454': 'Gender Bender', '1455': 'Isekai', '1842': 'Manhwa',
  '1843': 'Adaptation', '1844': 'Manhua', '1845': 'Webtoon',
  '1846': 'Full Color', '1847': 'Webtoons', '1866': 'Sci-fi',
  '1894': 'Sports', '1900': 'Yuri', '1984': 'Seinen', '2055': 'Demon',
  '2056': 'Harem', '2089': 'Reincarnation', '2097': 'Comedy',
  '2099': 'Super Power', '2119': 'Josei', '2135': 'Tragedy',
  '2154': 'Seinen(M)', '2183': 'Shoujo(G)', '2188': 'Crime',
  '2251': 'Gore', '2806': 'Villainess', '4866': 'Smut', '4901': 'Shoujo(G)',
  '4914': 'Shounen Ai', '4951': 'Reverse Harem', '4999': 'Rofan',
  '5089': 'Entertainment', '5408': 'College Life', '5410': 'Office Workers'
};

async function getHTML(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:150.0) Gecko/20100101 Firefox/150.0',
      'Accept': 'text/html',
      'Referer': BASE + '/'
    }
  });
  return res.text();
}

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Parse URL
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname.replace('/api/', '');
  
  try {
    let response;

    if (pathname === 'list') {
      const type = url.searchParams.get('type') || 'manga';
      const status = url.searchParams.get('status') || '';
      const genre = url.searchParams.get('genre') || '';
      const page = parseInt(url.searchParams.get('page')) || 1;
      response = await getList(type, { status, genre, order: 'update', page });
    } 
    else if (pathname === 'search') {
      const query = url.searchParams.get('q') || '';
      response = await search(query);
    }
    else if (pathname.startsWith('detail/')) {
      const slug = pathname.replace('detail/', '');
      response = await getDetail(slug);
    }
    else if (pathname.startsWith('chapter/')) {
      const parts = pathname.replace('chapter/', '').split('/');
      const slug = parts[0];
      const num = parseInt(parts[1]) || 1;
      response = await getChapter(slug, num);
    }
    else if (pathname.startsWith('download/')) {
      const parts = pathname.replace('download/', '').split('/');
      const slug = parts[0];
      const num = parseInt(parts[1]) || 1;
      response = await downloadChapter(slug, num, OUTPUT);
    }
    else if (pathname === 'genres') {
      response = { total: Object.keys(GENRES).length, genres: GENRES };
    }
    else if (pathname === 'types') {
      response = { types: TYPES, statuses: STATUSES, orders: ORDERS, totalGenres: Object.keys(GENRES).length };
    }
    else {
      response = {
        author: 'Nimzz',
        types: TYPES,
        statuses: STATUSES,
        orders: ORDERS,
        totalGenres: Object.keys(GENRES).length,
        usage: {
          'genres': 'List all genres',
          'types': 'List types, statuses, orders',
          'list?type=manga&status=ongoing&genre=52&page=1': 'List with filters',
          'search?q=yuri': 'Search manga/novel',
          'detail/slug': 'Get detail + chapter list',
          'chapter/slug/num': 'Get chapter image URLs',
          'download/slug/num': 'Download chapter images'
        }
      };
    }

    res.status(200).json({ success: true, author: 'Nimzz', data: response });
  } catch (error) {
    res.status(500).json({ success: false, author: 'Nimzz', error: error.message });
  }
};

async function getList(type = 'manga', filters = {}) {
  const { status = '', genre = '', order = 'update', page = 1 } = filters;
  let url = `${BASE}/manga/?type=${type}&order=${order}`;
  if (status) url += `&status=${status}`;
  if (genre) url += `&genre%5B%5D=${genre}`;
  if (page > 1) url += `&page=${page}`;
  const html = await getHTML(url);
  const results = [];
  const regex = /<a href="https:\/\/v4\.luvyaa\.co\/([^"]+)\/"[^>]*title="([^"]+)"/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    if (!m[1].includes('chapter') && !m[1].includes('page') && !m[1].includes('manga') && !results.find(r => r.slug === m[1])) {
      results.push({ title: m[2].trim(), slug: m[1], url: BASE + '/' + m[1] + '/' });
    }
  }
  return { type, status: status || 'all', genre: genre ? GENRES[genre] || genre : 'all', order, page, total: results.length, results };
}

async function getDetail(slug) {
  const html = await getHTML(BASE + '/' + slug + '/');
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const title = titleMatch ? titleMatch[1].trim() : slug;
  const imgMatch = html.match(/<img[^>]+width="160"[^>]+height="213"[^>]+src="([^"]+)"/);
  const thumbnail = imgMatch ? imgMatch[1] : '';
  const synopsisMatch = html.match(/<meta name="description" content="([^"]+)"/);
  const synopsis = synopsisMatch ? synopsisMatch[1] : '';
  const chapters = [];
  const chapterRegex = /chapter-(\d+)\//g;
  let m;
  while ((m = chapterRegex.exec(html)) !== null) {
    const num = parseInt(m[1]);
    if (!chapters.includes(num)) chapters.push(num);
  }
  chapters.sort((a, b) => a - b);
  const genres = [];
  const genreRegex = /genres\/([a-z0-9-]+)\/" class="meta-pill">([^<]+)<\/a>/g;
  while ((m = genreRegex.exec(html)) !== null) {
    if (!genres.find(g => g.slug === m[1])) genres.push({ slug: m[1], name: m[2].trim() });
  }
  const statusMatch = html.match(/class="status-text">([^<]+)</);
  const typeMatch = html.match(/class="meta-pill">(Manhua|Manhwa|Manga|Novel|Pornwa)<\/a>/);
  const scoreMatch = html.match(/<span>(\d+\.?\d*)<\/span>/);
  return {
    title, slug, thumbnail, synopsis,
    type: typeMatch ? typeMatch[1].trim() : '',
    status: statusMatch ? statusMatch[1].trim() : '',
    score: scoreMatch ? parseFloat(scoreMatch[1]) : null,
    genres, chapters, totalChapters: chapters.length
  };
}

async function getChapter(slug, chapterNum) {
  const html = await getHTML(`${BASE}/${slug}-chapter-${chapterNum}/`);
  const imagesMatch = html.match(/"images"\s*:\s*\[([^\]]+)\]/);
  if (!imagesMatch) return { slug, chapter: chapterNum, images: [], error: 'No images found' };
  const images = imagesMatch[1].replace(/\\\//g, '/').replace(/"/g, '').split(',').map(url => url.trim());
  const prevMatch = html.match(/"prevUrl"\s*:\s*"([^"]+)"/);
  const nextMatch = html.match(/"nextUrl"\s*:\s*"([^"]+)"/);
  return {
    slug, chapter: chapterNum, images, totalImages: images.length,
    prev: prevMatch ? prevMatch[1].replace(/\\\//g, '/') : null,
    next: nextMatch ? nextMatch[1].replace(/\\\//g, '/') : null
  };
}

async function downloadChapter(slug, chapterNum, outputDir = OUTPUT) {
  const data = await getChapter(slug, chapterNum);
  if (data.error) return { slug, chapter: chapterNum, total: 0, downloaded: 0, failed: 0, error: data.error };
  
  const dir = `${outputDir}/${slug}/chapter-${chapterNum}`;
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  
  let downloaded = 0;
  for (let i = 0; i < data.images.length; i++) {
    const url = data.images[i];
    const name = String(i + 1).padStart(3, '0') + '.webp';
    const filePath = path.join(dir, name);
    try {
      const res = await fetch(url, {
        headers: {
          'Referer': `${BASE}/${slug}-chapter-${chapterNum}/`,
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'image/webp,image/*'
        }
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(filePath, buffer);
      downloaded++;
    } catch (e) {
      console.error(`Failed to download ${name}:`, e.message);
    }
  }
  
  return { 
    slug, 
    chapter: chapterNum, 
    total: data.images.length, 
    downloaded, 
    failed: data.images.length - downloaded, 
    path: dir 
  };
}

async function search(query) {
  const html = await getHTML(BASE + '/?s=' + encodeURIComponent(query));
  const results = [];
  const regex = /<a href="https:\/\/v4\.luvyaa\.co\/([^"]+)\/"[^>]*title="([^"]+)"/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    if (!m[1].includes('chapter') && !results.find(r => r.slug === m[1])) {
      results.push({ title: m[2].trim(), slug: m[1], url: BASE + '/' + m[1] + '/' });
    }
  }
  return { query, total: results.length, results };
}
