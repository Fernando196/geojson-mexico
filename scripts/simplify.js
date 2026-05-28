#!/usr/bin/env node
/**
 * simplify.js
 * Reduce el peso de un GeoJSON usando mapshaper sin perder demasiada forma.
 * Ideal para pasar de archivos de 3GB a versiones web de 5-10MB.
 *
 * Uso:
 *   node scripts/simplify.js <archivo> [--percent <1-100>] [--out <salida>]
 *   node scripts/simplify.js data/municipios_raw.geojson
 *   node scripts/simplify.js data/municipios_raw.geojson --percent 5
 *   node scripts/simplify.js data/municipios_raw.shp --percent 10 --out data/municipios.geojson
 *
 * Porcentajes recomendados:
 *   Estados:          15-20%  → excelente calidad visual, ~200KB
 *   Municipios:        5-10%  → buena calidad visual, ~5-10MB
 *   Códigos postales:  3-5%   → calidad aceptable, manejable
 */

import { execSync } from 'child_process'
import fs from 'fs-extra'
import path from 'path'
import chalk from 'chalk'

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
${chalk.bold('simplify.js')} — Reduce el peso de un GeoJSON para uso en web

${chalk.yellow('Uso:')}
  node scripts/simplify.js <archivo> [--percent <1-100>] [--out <salida>]

${chalk.yellow('Opciones:')}
  --percent   Porcentaje de vértices a conservar (default: 10)
  --out       Archivo de salida (default: mismo nombre + _simplified)

${chalk.yellow('Porcentajes recomendados:')}
  estados           15-20%   → ~200 KB, excelente calidad
  municipios         5-10%   → ~5-10 MB, buena calidad visual
  codigos_postales   3-5%    → manejable para web
  colonias           3-5%    → manejable para web

${chalk.yellow('Ejemplos:')}
  node scripts/simplify.js data/municipios_raw.geojson
  node scripts/simplify.js data/municipios_raw.geojson --percent 5
  node scripts/simplify.js data/estados_raw.shp --percent 15 --out data/estados.geojson
    `)
    process.exit(0)
  }

  const inputFile = args[0]
  const percentIdx = args.indexOf('--percent')
  const outIdx = args.indexOf('--out')

  const percent = percentIdx !== -1 ? parseInt(args[percentIdx + 1]) : 10
  const ext = path.extname(inputFile).toLowerCase()
  const outFile = outIdx !== -1
    ? args[outIdx + 1]
    : path.join(
        path.dirname(inputFile),
        `${path.basename(inputFile, ext)}_simplified.geojson`
      )

  if (!await fs.pathExists(inputFile)) {
    console.error(chalk.red(`Error: archivo no encontrado → ${inputFile}`))
    process.exit(1)
  }

  const inputSize = (await fs.stat(inputFile)).size
  console.log(chalk.cyan(`\n📂 Archivo: ${inputFile}`))
  console.log(chalk.cyan(`📦 Tamaño original: ${formatBytes(inputSize)}`))
  console.log(chalk.cyan(`🎚️  Porcentaje de simplificación: ${percent}%`))
  console.log(chalk.cyan(`💾 Salida: ${outFile}\n`))

  await fs.ensureDir(path.dirname(outFile))

  // Comando mapshaper
  // -simplify: algoritmo Visvalingam weighted, mantiene topología
  // keep-shapes: evita que municipios pequeños desaparezcan
  // -proj wgs84: asegura que la salida esté en WGS84
  const cmd = [
    'npx mapshaper',
    `"${inputFile}"`,
    `name=layer`,
    `-simplify weighted keep-shapes ${percent}%`,
    `-proj wgs84`,
    `-o "${outFile}" format=geojson`,
  ].join(' ')

  console.log(chalk.gray(`Ejecutando mapshaper...`))

  try {
    execSync(cmd, { stdio: 'inherit' })
  } catch (err) {
    console.error(chalk.red('\n❌ Error en mapshaper'))
    process.exit(1)
  }

  if (await fs.pathExists(outFile)) {
    const outputSize = (await fs.stat(outFile)).size
    const reduction = (((inputSize - outputSize) / inputSize) * 100).toFixed(1)

    console.log(chalk.green(`\n✅ Simplificación completa`))
    console.log(chalk.green(`📦 Tamaño original:   ${formatBytes(inputSize)}`))
    console.log(chalk.green(`📦 Tamaño resultado:  ${formatBytes(outputSize)}`))
    console.log(chalk.green(`📉 Reducción:         ${reduction}%`))
    console.log(chalk.green(`💾 Guardado en: ${outFile}\n`))

    // Sugerencias
    if (outputSize > 15 * 1024 * 1024) {
      console.log(chalk.yellow(`⚠️  El archivo sigue siendo grande (>${formatBytes(15 * 1024 * 1024)})`))
      console.log(chalk.yellow(`   Considera bajar el porcentaje: --percent ${Math.max(1, percent - 3)}\n`))
    } else if (outputSize < 500 * 1024 && percent > 5) {
      console.log(chalk.blue(`💡 El archivo es muy ligero. Podrías subir el porcentaje para mejor calidad: --percent ${percent + 5}\n`))
    }
  }
}

main().catch(err => {
  console.error(chalk.red(`\n❌ Error: ${err.message}`))
  process.exit(1)
})