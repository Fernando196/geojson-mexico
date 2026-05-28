#!/usr/bin/env node
/**
 * validate.js
 * Valida que un GeoJSON tenga las properties correctas según la convención
 * de geojson-mexico: claves presentes, formatos correctos y relaciones entre capas.
 *
 * Uso:
 *   node scripts/validate.js <archivo> [--layer <capa>]
 *   node scripts/validate.js data/municipios.geojson
 *   node scripts/validate.js data/estados.geojson --layer estados
 */

import fs from 'fs-extra'
import path from 'path'
import chalk from 'chalk'

// ─── Reglas de validación por capa ───────────────────────────────────────────

const RULES = {
  estados: {
    required: ['cve_ent', 'nom_ent'],
    optional: ['area_km2'],
    validate: (props) => {
      const errors = []
      if (props.cve_ent && !/^\d{2}$/.test(props.cve_ent))
        errors.push(`cve_ent debe ser 2 dígitos: "${props.cve_ent}"`)
      if (props.cve_ent) {
        const num = parseInt(props.cve_ent)
        if (num < 1 || num > 32)
          errors.push(`cve_ent fuera de rango (01-32): "${props.cve_ent}"`)
      }
      return errors
    }
  },
  municipios: {
    required: ['cve_geo', 'cve_ent', 'nom_mun', 'nom_ent'],
    optional: ['area_km2'],
    validate: (props) => {
      const errors = []
      if (props.cve_ent && !/^\d{2}$/.test(props.cve_ent))
        errors.push(`cve_ent debe ser 2 dígitos: "${props.cve_ent}"`)
      if (props.cve_geo && !/^\d{5}$/.test(props.cve_geo))
        errors.push(`cve_geo debe ser 5 dígitos: "${props.cve_geo}"`)
      if (props.cve_geo && props.cve_ent && !props.cve_geo.startsWith(props.cve_ent))
        errors.push(`cve_geo "${props.cve_geo}" no inicia con cve_ent "${props.cve_ent}"`)
      return errors
    }
  },
  codigos_postales: {
    required: ['cp', 'cve_mun', 'cve_ent'],
    optional: ['nom_mun', 'nom_ent'],
    validate: (props) => {
      const errors = []
      if (props.cp && !/^\d{5}$/.test(props.cp))
        errors.push(`cp debe ser 5 dígitos: "${props.cp}"`)
      if (props.cve_ent && !/^\d{2}$/.test(props.cve_ent))
        errors.push(`cve_ent debe ser 2 dígitos: "${props.cve_ent}"`)
      if (props.cve_mun && !/^\d{3}$/.test(props.cve_mun))
        errors.push(`cve_mun debe ser 3 dígitos: "${props.cve_mun}"`)
      return errors
    }
  },
  colonias: {
    required: ['nom_colonia', 'cp', 'cve_mun', 'cve_ent'],
    optional: ['id_colonia', 'nom_mun', 'nom_ent'],
    validate: (props) => {
      const errors = []
      if (props.cp && !/^\d{5}$/.test(props.cp))
        errors.push(`cp debe ser 5 dígitos: "${props.cp}"`)
      if (props.cve_ent && !/^\d{2}$/.test(props.cve_ent))
        errors.push(`cve_ent debe ser 2 dígitos: "${props.cve_ent}"`)
      return errors
    }
  },
}

// ─── Inferir capa desde nombre de archivo ─────────────────────────────────────

function inferLayer(filePath) {
  const name = path.basename(filePath, path.extname(filePath)).toLowerCase()
  if (name.includes('estado')) return 'estados'
  if (name.includes('municipio')) return 'municipios'
  if (name.includes('colonia')) return 'colonias'
  if (name.includes('cp') || name.includes('postal')) return 'codigos_postales'
  return null
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
${chalk.bold('validate.js')} — Valida propiedades de un GeoJSON de geojson-mexico

${chalk.yellow('Uso:')}
  node scripts/validate.js <archivo.geojson> [--layer <capa>]

${chalk.yellow('Capas:')}
  estados | municipios | codigos_postales | colonias

${chalk.yellow('Ejemplos:')}
  node scripts/validate.js data/municipios.geojson
  node scripts/validate.js data/estados.geojson --layer estados
    `)
    process.exit(0)
  }

  const inputFile = args[0]
  const layerIdx = args.indexOf('--layer')
  const layer = layerIdx !== -1 ? args[layerIdx + 1] : inferLayer(inputFile)

  if (!layer || !RULES[layer]) {
    console.error(chalk.red(`No se pudo determinar la capa. Usa --layer <estados|municipios|codigos_postales|colonias>`))
    process.exit(1)
  }

  const rules = RULES[layer]

  console.log(chalk.cyan(`\n📂 Validando: ${inputFile}`))
  console.log(chalk.cyan(`🗺️  Capa: ${layer}\n`))

  const geojson = await fs.readJSON(inputFile)
  const features = geojson.type === 'FeatureCollection' ? geojson.features : [geojson]

  let totalErrors = 0
  let totalWarnings = 0
  const missingFields = {}
  const formatErrors = []

  for (let i = 0; i < features.length; i++) {
    const props = features[i].properties || {}

    // Campos requeridos faltantes
    for (const field of rules.required) {
      if (props[field] === null || props[field] === undefined || props[field] === '') {
        missingFields[field] = (missingFields[field] || 0) + 1
        totalErrors++
      }
    }

    // Validaciones de formato
    const errs = rules.validate(props)
    for (const err of errs) {
      formatErrors.push(`Feature ${i}: ${err}`)
      totalErrors++
    }
  }

  // Resumen de campos faltantes
  if (Object.keys(missingFields).length > 0) {
    console.log(chalk.red('❌ Campos requeridos con valores nulos o vacíos:'))
    for (const [field, count] of Object.entries(missingFields)) {
      const pct = ((count / features.length) * 100).toFixed(1)
      console.log(chalk.red(`   ${field}: ${count} features (${pct}%)`))
    }
    console.log()
  }

  // Errores de formato (muestra máx 10)
  if (formatErrors.length > 0) {
    console.log(chalk.red('❌ Errores de formato:'))
    formatErrors.slice(0, 10).forEach(e => console.log(chalk.red(`   ${e}`)))
    if (formatErrors.length > 10) {
      console.log(chalk.red(`   ... y ${formatErrors.length - 10} más`))
    }
    console.log()
  }

  // Estadísticas generales
  console.log(chalk.bold('📊 Estadísticas:'))
  console.log(`   Total features:  ${features.length}`)
  console.log(`   Total errores:   ${totalErrors}`)

  // Muestra de values únicos para ayudar a debuggear
  const sampleProps = features[0]?.properties || {}
  console.log(chalk.gray('\n   Campos detectados en el archivo:'))
  Object.keys(sampleProps).forEach(k => {
    const val = sampleProps[k]
    console.log(chalk.gray(`   ${k}: ${JSON.stringify(val)}`))
  })

  // Veredicto final
  console.log()
  if (totalErrors === 0) {
    console.log(chalk.green('✅ Validación exitosa — el archivo cumple la convención geojson-mexico\n'))
    process.exit(0)
  } else {
    console.log(chalk.red(`❌ Validación fallida — ${totalErrors} errores encontrados`))
    console.log(chalk.yellow('💡 Tip: corre primero enrich.js para normalizar las properties\n'))
    process.exit(1)
  }
}

main().catch(err => {
  console.error(chalk.red(`\n❌ Error: ${err.message}`))
  process.exit(1)
})