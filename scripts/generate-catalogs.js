#!/usr/bin/env node
/**
 * generate-catalogs.js
 * Extrae las properties de los GeoJSONs y genera catálogos JSON ligeros
 * sin geometría — perfectos para dropdowns, lookups y validaciones.
 *
 * Uso:
 *   node scripts/generate-catalogs.js
 *
 * Genera:
 *   catalogs/estados.json
 *   catalogs/municipios.json
 */

import fs from 'fs-extra'
import chalk from 'chalk'

async function generateCatalog(inputFile, outputFile, sortBy) {
  console.log(chalk.cyan(`\n📂 Leyendo: ${inputFile}`))

  if (!await fs.pathExists(inputFile)) {
    console.error(chalk.red(`  ❌ No encontré ${inputFile}`))
    return false
  }

  const geojson = await fs.readJSON(inputFile)
  const catalog = geojson.features
    .map(f => f.properties)
    .filter(Boolean)
    .sort((a, b) => (a[sortBy] || '').localeCompare(b[sortBy] || ''))

  await fs.ensureDir('catalogs')
  await fs.writeJSON(outputFile, catalog, { spaces: 2 })

  const size = (await fs.stat(outputFile)).size
  const kb = (size / 1024).toFixed(1)
  console.log(chalk.green(`  ✅ ${catalog.length} registros → ${outputFile} (${kb} KB)`))
  console.log(chalk.gray(`  Muestra: ${JSON.stringify(catalog[0])}`))
  return true
}

async function main() {
  console.log(chalk.bold('\n🗂️  Generando catálogos...\n'))

  await generateCatalog(
    'data/estados.geojson',
    'catalogs/estados.json',
    'cve_ent'
  )

  await generateCatalog(
    'data/municipios.geojson',
    'catalogs/municipios.json',
    'cve_geo'
  )

  console.log(chalk.bold('\n✅ Catálogos generados en catalogs/\n'))
  console.log(chalk.gray('Úsalos así:'))
  console.log(chalk.gray('  const estados = await fetch(".../catalogs/estados.json").then(r => r.json())'))
  console.log(chalk.gray('  const muns = await fetch(".../catalogs/municipios.json").then(r => r.json())'))
  console.log(chalk.gray('  // Buscar municipios de un estado:'))
  console.log(chalk.gray('  const nl = muns.filter(m => m.cve_ent === "19")\n'))
}

main().catch(err => {
  console.error(chalk.red(`\n❌ Error: ${err.message}`))
  process.exit(1)
})