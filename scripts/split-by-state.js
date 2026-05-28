#!/usr/bin/env node
/**
 * split-by-state.js
 * Toma un GeoJSON nacional y lo divide en 32 archivos, uno por estado.
 * Crea la estructura by-state/XX_nombre_estado/capa.geojson
 *
 * Uso:
 *   node scripts/split-by-state.js <archivo> [--layer <capa>]
 *   node scripts/split-by-state.js data/municipios.geojson
 *   node scripts/split-by-state.js data/codigos_postales.geojson --layer codigos_postales
 */

import fs from 'fs-extra'
import path from 'path'
import chalk from 'chalk'

const ESTADOS = {
  '01': 'aguascalientes',
  '02': 'baja_california',
  '03': 'baja_california_sur',
  '04': 'campeche',
  '05': 'coahuila',
  '06': 'colima',
  '07': 'chiapas',
  '08': 'chihuahua',
  '09': 'ciudad_de_mexico',
  '10': 'durango',
  '11': 'guanajuato',
  '12': 'guerrero',
  '13': 'hidalgo',
  '14': 'jalisco',
  '15': 'mexico',
  '16': 'michoacan',
  '17': 'morelos',
  '18': 'nayarit',
  '19': 'nuevo_leon',
  '20': 'oaxaca',
  '21': 'puebla',
  '22': 'queretaro',
  '23': 'quintana_roo',
  '24': 'san_luis_potosi',
  '25': 'sinaloa',
  '26': 'sonora',
  '27': 'tabasco',
  '28': 'tamaulipas',
  '29': 'tlaxcala',
  '30': 'veracruz',
  '31': 'yucatan',
  '32': 'zacatecas',
}

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
${chalk.bold('split-by-state.js')} — Divide un GeoJSON nacional en archivos por estado

${chalk.yellow('Uso:')}
  node scripts/split-by-state.js <archivo.geojson> [--layer <nombre>] [--out <directorio>]

${chalk.yellow('Ejemplos:')}
  node scripts/split-by-state.js data/municipios.geojson
  node scripts/split-by-state.js data/codigos_postales.geojson --layer codigos_postales
  node scripts/split-by-state.js data/municipios.geojson --out exports/by-state
    `)
    process.exit(0)
  }

  const inputFile = args[0]
  const layerIdx = args.indexOf('--layer')
  const outIdx = args.indexOf('--out')

  // Nombre de la capa: puede venir como argumento o se infiere del nombre del archivo
  const layerName = layerIdx !== -1
    ? args[layerIdx + 1]
    : path.basename(inputFile, path.extname(inputFile))

  const outDir = outIdx !== -1 ? args[outIdx + 1] : 'by-state'

  console.log(chalk.cyan(`\n📂 Leyendo: ${inputFile}`))

  if (!await fs.pathExists(inputFile)) {
    console.error(chalk.red(`Error: archivo no encontrado → ${inputFile}`))
    process.exit(1)
  }

  const geojson = await fs.readJSON(inputFile)

  if (geojson.type !== 'FeatureCollection') {
    console.error(chalk.red('Error: el archivo no es un FeatureCollection'))
    process.exit(1)
  }

  console.log(chalk.cyan(`✅ Features totales: ${geojson.features.length}`))

  // Agrupar por cve_ent
  const byState = {}

  for (const feature of geojson.features) {
    const cve_ent = feature.properties?.cve_ent

    if (!cve_ent) {
      console.warn(chalk.yellow(`  ⚠️  Feature sin cve_ent, se omite. Properties: ${JSON.stringify(feature.properties)}`))
      continue
    }

    const key = String(cve_ent).padStart(2, '0')
    if (!byState[key]) byState[key] = []
    byState[key].push(feature)
  }

  const statesFound = Object.keys(byState).sort()
  console.log(chalk.cyan(`🗺️  Estados encontrados: ${statesFound.length}`))

  // Guardar un archivo por estado
  let saved = 0
  const summary = []

  for (const cve_ent of statesFound) {
    const nombre = ESTADOS[cve_ent]
    if (!nombre) {
      console.warn(chalk.yellow(`  ⚠️  cve_ent desconocida: ${cve_ent}`))
      continue
    }

    const stateDir = path.join(outDir, `${cve_ent}_${nombre}`)
    await fs.ensureDir(stateDir)

    const outFile = path.join(stateDir, `${layerName}.geojson`)
    const stateGeoJSON = {
      type: 'FeatureCollection',
      features: byState[cve_ent],
    }

    await fs.writeJSON(outFile, stateGeoJSON)

    const count = byState[cve_ent].length
    summary.push({ cve_ent, nombre, count, outFile })
    saved++

    process.stdout.write(chalk.gray(`  📁 ${cve_ent}_${nombre}: ${count} features\n`))
  }

  console.log(chalk.green(`\n✅ Dividido en ${saved} archivos dentro de ./${outDir}/`))

  // Resumen de features por estado
  const total = summary.reduce((sum, s) => sum + s.count, 0)
  console.log(chalk.green(`📊 Total features guardados: ${total}\n`))

  // Estados sin features (si aplica)
  const missing = Object.keys(ESTADOS).filter(k => !byState[k])
  if (missing.length > 0) {
    console.log(chalk.yellow(`⚠️  Estados sin features en este archivo:`))
    missing.forEach(k => console.log(chalk.yellow(`   ${k} — ${ESTADOS[k]}`)))
  }
}

main().catch(err => {
  console.error(chalk.red(`\n❌ Error: ${err.message}`))
  process.exit(1)
})