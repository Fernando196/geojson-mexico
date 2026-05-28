#!/usr/bin/env node
/**
 * add-state-to-folders.js
 * Lee data/estados.geojson y copia el feature de cada estado
 * a su carpeta correspondiente en by-state/XX_nombre/estado.geojson
 *
 * Uso:
 *   node scripts/add-state-to-folders.js
 *   node scripts/add-state-to-folders.js --states data/estados.geojson --dir by-state
 */

import fs from 'fs-extra'
import path from 'path'
import chalk from 'chalk'

const ESTADOS = {
  '01': 'aguascalientes',      '02': 'baja_california',
  '03': 'baja_california_sur', '04': 'campeche',
  '05': 'coahuila',            '06': 'colima',
  '07': 'chiapas',             '08': 'chihuahua',
  '09': 'ciudad_de_mexico',    '10': 'durango',
  '11': 'guanajuato',          '12': 'guerrero',
  '13': 'hidalgo',             '14': 'jalisco',
  '15': 'mexico',              '16': 'michoacan',
  '17': 'morelos',             '18': 'nayarit',
  '19': 'nuevo_leon',          '20': 'oaxaca',
  '21': 'puebla',              '22': 'queretaro',
  '23': 'quintana_roo',        '24': 'san_luis_potosi',
  '25': 'sinaloa',             '26': 'sonora',
  '27': 'tabasco',             '28': 'tamaulipas',
  '29': 'tlaxcala',            '30': 'veracruz',
  '31': 'yucatan',             '32': 'zacatecas',
}

async function main() {
  const args = process.argv.slice(2)
  const statesIdx = args.indexOf('--states')
  const dirIdx = args.indexOf('--dir')

  const statesFile = statesIdx !== -1 ? args[statesIdx + 1] : 'data/estados.geojson'
  const byStateDir = dirIdx !== -1 ? args[dirIdx + 1] : 'by-state'

  console.log(chalk.cyan(`\n📂 Leyendo: ${statesFile}`))

  if (!await fs.pathExists(statesFile)) {
    console.error(chalk.red(`Error: no encontré ${statesFile}`))
    process.exit(1)
  }

  const geojson = await fs.readJSON(statesFile)
  const features = geojson.features

  console.log(chalk.cyan(`✅ Estados encontrados: ${features.length}\n`))

  let saved = 0
  let skipped = 0

  for (const feature of features) {
    const cve_ent = feature.properties?.cve_ent
    if (!cve_ent) {
      console.warn(chalk.yellow(`  ⚠️  Feature sin cve_ent, se omite`))
      skipped++
      continue
    }

    const key = String(cve_ent).padStart(2, '0')
    const nombre = ESTADOS[key]

    if (!nombre) {
      console.warn(chalk.yellow(`  ⚠️  cve_ent desconocida: ${key}`))
      skipped++
      continue
    }

    const stateDir = path.join(byStateDir, `${key}_${nombre}`)

    // Si no existe la carpeta, la creamos (puede que no se haya corrido split todavía)
    await fs.ensureDir(stateDir)

    const outFile = path.join(stateDir, 'estado.geojson')

    // GeoJSON con solo este estado
    const stateGeoJSON = {
      type: 'FeatureCollection',
      features: [feature],
    }

    await fs.writeJSON(outFile, stateGeoJSON)
    console.log(chalk.gray(`  📁 ${key}_${nombre} → estado.geojson`))
    saved++
  }

  console.log(chalk.green(`\n✅ ${saved} archivos estado.geojson creados en ./${byStateDir}/`))
  if (skipped > 0) console.log(chalk.yellow(`⚠️  ${skipped} estados omitidos`))
  console.log()
}

main().catch(err => {
  console.error(chalk.red(`\n❌ Error: ${err.message}`))
  process.exit(1)
})