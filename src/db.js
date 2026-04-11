const DB_NAME = 'hadithmv'
const DB_VERSION = 1

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (e) => {
      const db = e.target.result

      // suras: keyed by surah number (1-114)
      // fields: index, name, tname, ename, type, ayas, order, rukus
      if (!db.objectStoreNames.contains('suras')) {
        db.createObjectStore('suras', { keyPath: 'index' })
      }

      // juzs: keyed by juz number (1-30)
      // fields: index, sura, aya (starting point)
      if (!db.objectStoreNames.contains('juzs')) {
        db.createObjectStore('juzs', { keyPath: 'index' })
      }

      // ayahs: compound key [sura, aya]
      // fields: sura, aya, juz, text, bismillah?
      // indexed by sura and juz for efficient filtering
      if (!db.objectStoreNames.contains('ayahs')) {
        const store = db.createObjectStore('ayahs', { keyPath: ['sura', 'aya'] })
        store.createIndex('by_sura', 'sura')
        store.createIndex('by_juz', 'juz')
      }
    }

    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror = (e) => reject(e.target.error)
  })
}

function parseQuranXml(xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const ayahs = []
  for (const sura of doc.querySelectorAll('sura')) {
    const suraIndex = parseInt(sura.getAttribute('index'))
    for (const aya of sura.querySelectorAll('aya')) {
      const record = {
        sura: suraIndex,
        aya: parseInt(aya.getAttribute('index')),
        text: aya.getAttribute('text'),
      }
      const bismillah = aya.getAttribute('bismillah')
      if (bismillah) record.bismillah = bismillah
      ayahs.push(record)
    }
  }
  return ayahs
}

function parseMetadataXml(xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')

  const suras = Array.from(doc.querySelectorAll('suras > sura')).map((s) => ({
    index: parseInt(s.getAttribute('index')),
    name: s.getAttribute('name'),
    tname: s.getAttribute('tname'),
    ename: s.getAttribute('ename'),
    type: s.getAttribute('type'),
    ayas: parseInt(s.getAttribute('ayas')),
    order: parseInt(s.getAttribute('order')),
    rukus: parseInt(s.getAttribute('rukus')),
  }))

  const juzs = Array.from(doc.querySelectorAll('juzs > juz')).map((j) => ({
    index: parseInt(j.getAttribute('index')),
    sura: parseInt(j.getAttribute('sura')),
    aya: parseInt(j.getAttribute('aya')),
  }))

  return { suras, juzs }
}

/**
 * Build a lookup: for each ayah [sura, aya] → juz number.
 * Uses the juz boundary list (sorted by sura/aya) to assign juz numbers.
 */
function buildJuzMap(juzs, ayahs) {
  // Sort juz boundaries ascending
  const boundaries = [...juzs].sort((a, b) => a.index - b.index)

  // For each ayah, find its juz by scanning boundaries in reverse
  return ayahs.map((ayah) => {
    let juz = 1
    for (const boundary of boundaries) {
      if (
        ayah.sura > boundary.sura ||
        (ayah.sura === boundary.sura && ayah.aya >= boundary.aya)
      ) {
        juz = boundary.index
      } else {
        break
      }
    }
    return { ...ayah, juz }
  })
}

async function isDataLoaded(db) {
  return new Promise((resolve) => {
    const tx = db.transaction('suras', 'readonly')
    const req = tx.objectStore('suras').count()
    req.onsuccess = () => resolve(req.result > 0)
    req.onerror = () => resolve(false)
  })
}

async function bulkPut(db, storeName, records) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    for (const record of records) store.put(record)
    tx.oncomplete = resolve
    tx.onerror = (e) => reject(e.target.error)
  })
}

let _db = null

async function getDB() {
  if (!_db) _db = await openDB()
  return _db
}

/**
 * Fetch and parse the XML files, then seed IndexedDB on first run.
 * Safe to call multiple times — skips if data already exists.
 */
export async function initQuranData(baseUrl) {
  const db = await getDB()
  if (await isDataLoaded(db)) return

  const [quranXml, metadataXml] = await Promise.all([
    fetch(`${baseUrl}data/quran.xml`).then((r) => r.text()),
    fetch(`${baseUrl}data/quran-metadata.xml`).then((r) => r.text()),
  ])

  const rawAyahs = parseQuranXml(quranXml)
  const { suras, juzs } = parseMetadataXml(metadataXml)
  const ayahs = buildJuzMap(juzs, rawAyahs)

  await Promise.all([
    bulkPut(db, 'suras', suras),
    bulkPut(db, 'juzs', juzs),
    bulkPut(db, 'ayahs', ayahs),
  ])
}

/** Get metadata for all 114 suras */
export async function getAllSuras() {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction('suras', 'readonly').objectStore('suras').getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = (e) => reject(e.target.error)
  })
}

/** Get metadata for one sura by number (1-114) */
export async function getSura(suraIndex) {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction('suras', 'readonly').objectStore('suras').get(suraIndex)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = (e) => reject(e.target.error)
  })
}

/** Get all juz boundaries (30 entries) */
export async function getAllJuzs() {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction('juzs', 'readonly').objectStore('juzs').getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = (e) => reject(e.target.error)
  })
}

/** Get all ayahs for a sura */
export async function getAyahsBySura(suraIndex) {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('ayahs', 'readonly')
    const req = tx.objectStore('ayahs').index('by_sura').getAll(suraIndex)
    req.onsuccess = () => resolve(req.result)
    req.onerror = (e) => reject(e.target.error)
  })
}

/** Get all ayahs for a juz (1-30) */
export async function getAyahsByJuz(juzIndex) {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('ayahs', 'readonly')
    const req = tx.objectStore('ayahs').index('by_juz').getAll(juzIndex)
    req.onsuccess = () => resolve(req.result)
    req.onerror = (e) => reject(e.target.error)
  })
}

/** Get a single ayah */
export async function getAyah(suraIndex, ayaIndex) {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction('ayahs', 'readonly').objectStore('ayahs').get([suraIndex, ayaIndex])
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = (e) => reject(e.target.error)
  })
}

/** Full-text search across all ayahs — returns matching records */
export async function searchAyahs(query) {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const results = []
    const req = db.transaction('ayahs', 'readonly').objectStore('ayahs').openCursor()
    req.onsuccess = (e) => {
      const cursor = e.target.result
      if (!cursor) return resolve(results)
      if (cursor.value.text.includes(query)) results.push(cursor.value)
      cursor.continue()
    }
    req.onerror = (e) => reject(e.target.error)
  })
}
