import { readFileSync, mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

function parseSuras(xml) {
  const suras = []
  const re = /<sura\s+([^/]+)\/>/g
  let m
  while ((m = re.exec(xml)) !== null) {
    const attr = (name) => {
      const a = new RegExp(`${name}="([^"]*)"`)
      const match = m[1].match(a)
      return match ? match[1] : ''
    }
    suras.push({
      index: parseInt(attr('index')),
      ayas: parseInt(attr('ayas')),
      name: attr('name'),
      tname: attr('tname'),
      ename: attr('ename'),
      type: attr('type'),
    })
  }
  return suras
}

function escape(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function injectMeta(html, { title, description, canonicalUrl }) {
  const esc = escape
  const og = [
    `  <title>${esc(title)}</title>`,
    `  <meta name="description" content="${esc(description)}">`,
    `  <meta property="og:type" content="website">`,
    `  <meta property="og:site_name" content="ޙަދީޘްއެމްވީ">`,
    `  <meta property="og:title" content="${esc(title)}">`,
    `  <meta property="og:description" content="${esc(description)}">`,
    canonicalUrl ? `  <meta property="og:url" content="${esc(canonicalUrl)}">` : '',
    `  <meta name="twitter:card" content="summary">`,
    `  <meta name="twitter:title" content="${esc(title)}">`,
    `  <meta name="twitter:description" content="${esc(description)}">`,
    canonicalUrl ? `  <link rel="canonical" href="${esc(canonicalUrl)}">` : '',
  ].filter(Boolean).join('\n')

  // Replace existing <title> and insert OG block before </head>
  return html
    .replace(/<title>[^<]*<\/title>/, '')
    .replace('</head>', og + '\n</head>')
}

/**
 * Vite plugin — generates a static HTML page for every surah and juz
 * during `vite build`, each with unique <title>, OG tags, and canonical URL.
 *
 * @param {object} options
 * @param {string} options.siteUrl  Full origin, e.g. "https://user.github.io"
 */
export function quranPagesPlugin({ siteUrl = '' } = {}) {
  let suras = []
  let outDir = 'dist'
  let root = process.cwd()

  return {
    name: 'quran-static-pages',
    apply: 'build',

    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
      root = config.root
    },

    buildStart() {
      const xml = readFileSync(resolve(root, 'public/data/quran-metadata.xml'), 'utf-8')
      suras = parseSuras(xml)
    },

    closeBundle() {
      const template = readFileSync(resolve(outDir, 'quran/index.html'), 'utf-8')
      const base = '/hadithmv'

      // --- Surah pages: dist/quran/[n]/index.html ---
      for (const sura of suras) {
        const title = `${sura.tname} (${sura.name}) — ޤުރްއާން — ޙަދީޘްއެމްވީ`
        const description = `Surah ${sura.ename} — ${sura.type} — ${sura.ayas} verses`
        const canonicalUrl = siteUrl ? `${siteUrl}${base}/quran/${sura.index}/` : ''

        const html = injectMeta(template, { title, description, canonicalUrl })
        const dir = resolve(outDir, `quran/${sura.index}`)
        mkdirSync(dir, { recursive: true })
        writeFileSync(resolve(dir, 'index.html'), html)
      }

      // --- Juz pages: dist/quran/juz/[n]/index.html ---
      for (let i = 1; i <= 30; i++) {
        const title = `ޖުޒްء ${i} — ޤުރްއާން — ޙަދީޘްއެމްވީ`
        const description = `Juz ${i} of the Holy Quran`
        const canonicalUrl = siteUrl ? `${siteUrl}${base}/quran/juz/${i}/` : ''

        const html = injectMeta(template, { title, description, canonicalUrl })
        const dir = resolve(outDir, `quran/juz/${i}`)
        mkdirSync(dir, { recursive: true })
        writeFileSync(resolve(dir, 'index.html'), html)
      }

      console.log(`[quran-pages] generated ${suras.length} surah pages + 30 juz pages`)
    },
  }
}
