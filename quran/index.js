import { initQuranData, getAllSuras, getAyahsBySura } from '../src/db.js'

const BASE = import.meta.env.BASE_URL

async function main() {
  await initQuranData(BASE)
  const suras = await getAllSuras()
  console.log('suras loaded:', suras.length)

  // Example: load Al-Fatiha
  const ayahs = await getAyahsBySura(1)
  console.log('Al-Fatiha ayahs:', ayahs)
}

main().catch(console.error)
