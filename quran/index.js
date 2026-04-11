import {
  initQuranData,
  getAllSuras,
  getAllJuzs,
  getAyahsBySura,
  getAyahsByJuz,
} from '../src/db.js'

const BASE = import.meta.env.BASE_URL
// e.g. '/hadithmv/' → quranBase = '/hadithmv/quran'
const QURAN_BASE = BASE.replace(/\/$/, '') + '/quran'

// UI elements
const surahSelect = document.getElementById('filter-surah')
const juzSelect = document.getElementById('filter-juz')
const ayahInput = document.getElementById('filter-ayah')
const ayahGroup = document.getElementById('ayah-filter-group')
const resetBtn = document.getElementById('btn-reset')
const loadingEl = document.getElementById('loading')
const statusBar = document.getElementById('status-bar')
const outputEl = document.getElementById('output')

let allSuras = []
let allJuzs = []

// --- Routing ---

/**
 * Parse window.location into { surah, juz, ayah }.
 * /quran/5         → { surah: 5, juz: null, ayah: null }
 * /quran/5?ayah=3  → { surah: 5, juz: null, ayah: 3 }
 * /quran/juz/2     → { surah: null, juz: 2, ayah: null }
 * /quran/          → { surah: null, juz: null, ayah: null }
 */
function parseRoute() {
  const sub = window.location.pathname
    .slice(QURAN_BASE.length)
    .replace(/^\/+|\/+$/g, '')

  const params = new URLSearchParams(window.location.search)

  if (sub.startsWith('juz/')) {
    const n = parseInt(sub.slice(4))
    return { surah: null, juz: isNaN(n) ? null : n, ayah: null }
  }
  if (sub) {
    const n = parseInt(sub)
    const ayah = parseInt(params.get('ayah')) || null
    return { surah: isNaN(n) ? null : n, juz: null, ayah }
  }
  return { surah: null, juz: null, ayah: null }
}

function buildUrl(surah, juz, ayah) {
  if (juz) return `${QURAN_BASE}/juz/${juz}`
  if (surah) return `${QURAN_BASE}/${surah}${ayah ? `?ayah=${ayah}` : ''}`
  return `${QURAN_BASE}/`
}

function pushRoute(surah, juz, ayah) {
  history.pushState(null, '', buildUrl(surah, juz, ayah))
}

// --- Sync UI to route ---

function syncUI({ surah, juz, ayah }) {
  surahSelect.value = surah ?? ''
  juzSelect.value = juz ?? ''
  ayahInput.value = ayah ?? ''
  ayahGroup.style.display = surah ? 'flex' : 'none'
}

// --- Render ---

function surahTypeDv(type) {
  return type === 'Meccan' ? 'މައްކީ' : 'މަދަނީ'
}

function renderSurahBlock(sura, ayahs) {
  const bismillah = ayahs[0]?.bismillah
    ? `<div class="bismillah">${ayahs[0].bismillah}</div>`
    : ''

  const rows = ayahs.map((a) => `
    <div class="ayah-row">
      <div class="ayah-arabic">${a.text}<span class="ayah-marker">﴿${a.aya}﴾</span></div>
      ${a.dv ? `<div class="ayah-translation">${a.dv}</div>` : ''}
    </div>`).join('')

  return `
    <div class="surah-block">
      <div class="surah-header">
        <span class="surah-name">${sura.name}</span>
        <span class="surah-meta">
          <span>${sura.tname}</span>
          <span>${surahTypeDv(sura.type)}</span>
          <span>${sura.ayas} آيات</span>
        </span>
      </div>
      ${bismillah}
      <div class="ayahs">${rows}</div>
    </div>`
}

function setStatus(text) {
  statusBar.textContent = text ?? ''
  statusBar.style.display = text ? 'block' : 'none'
}

function setLoading(visible) {
  loadingEl.style.display = visible ? 'block' : 'none'
}

async function render() {
  const { surah, juz, ayah } = parseRoute()
  syncUI({ surah, juz, ayah })

  setLoading(true)
  outputEl.innerHTML = ''
  setStatus(null)

  try {
    if (surah) {
      const sura = allSuras.find((s) => s.index === surah)
      let ayahs = await getAyahsBySura(surah)
      ayahs.sort((a, b) => a.aya - b.aya)
      if (ayah) ayahs = ayahs.filter((a) => a.aya === ayah)

      if (!sura || ayahs.length === 0) {
        outputEl.innerHTML = `<div class="empty">އާޔަތެއް ނުފެނުނު</div>`
      } else {
        outputEl.innerHTML = renderSurahBlock(sura, ayahs)
        setStatus(`${ayahs.length} آيات`)
      }
    } else if (juz) {
      let ayahs = await getAyahsByJuz(juz)
      ayahs.sort((a, b) => a.sura - b.sura || a.aya - b.aya)

      if (ayahs.length === 0) {
        outputEl.innerHTML = `<div class="empty">ޖުޒްءގައި އާޔަތެއް ނެތް</div>`
      } else {
        const groups = new Map()
        for (const a of ayahs) {
          if (!groups.has(a.sura)) groups.set(a.sura, [])
          groups.get(a.sura).push(a)
        }
        let html = ''
        for (const [si, sa] of groups) {
          html += renderSurahBlock(allSuras.find((s) => s.index === si), sa)
        }
        outputEl.innerHTML = html
        setStatus(`ޖުޒްء ${juz} — ${ayahs.length} آيات`)
      }
    } else {
      let html = ''
      for (const sura of allSuras) {
        const ayahs = await getAyahsBySura(sura.index)
        ayahs.sort((a, b) => a.aya - b.aya)
        html += renderSurahBlock(sura, ayahs)
      }
      outputEl.innerHTML = html
      setStatus(`${allSuras.length} ސޫރަތް`)
    }
  } finally {
    setLoading(false)
  }
}

// --- Bootstrap ---

async function main() {
  setLoading(true)

  await initQuranData(BASE)
  ;[allSuras, allJuzs] = await Promise.all([getAllSuras(), getAllJuzs()])
  allSuras.sort((a, b) => a.index - b.index)
  allJuzs.sort((a, b) => a.index - b.index)

  for (const sura of allSuras) {
    const opt = document.createElement('option')
    opt.value = sura.index
    opt.textContent = `${sura.index}. ${sura.tname} — ${sura.name}`
    surahSelect.appendChild(opt)
  }

  for (const juz of allJuzs) {
    const opt = document.createElement('option')
    opt.value = juz.index
    opt.textContent = `ޖުޒްء ${juz.index}`
    juzSelect.appendChild(opt)
  }

  // Filter events → update URL then render
  surahSelect.addEventListener('change', () => {
    const surah = parseInt(surahSelect.value) || null
    pushRoute(surah, null, null)
    render()
  })

  juzSelect.addEventListener('change', () => {
    const juz = parseInt(juzSelect.value) || null
    pushRoute(null, juz, null)
    render()
  })

  ayahInput.addEventListener('change', () => {
    const { surah } = parseRoute()
    const ayah = parseInt(ayahInput.value) || null
    pushRoute(surah, null, ayah)
    render()
  })

  resetBtn.addEventListener('click', () => {
    pushRoute(null, null, null)
    render()
  })

  // Back / forward navigation
  window.addEventListener('popstate', render)

  await render()
}

main().catch(console.error)
