#!/usr/bin/env node
/**
 * enrich.js
 * Toma un GeoJSON o Shapefile crudo del INEGI y normaliza sus properties
 * con la convención estándar de geojson-mexico.
 *
 * Uso:
 *   node scripts/enrich.js <archivo> --layer <estados|municipios|codigos_postales|colonias>
 *   node scripts/enrich.js data/municipios_raw.shp --layer municipios
 *   node scripts/enrich.js data/municipios_raw.geojson --layer municipios
 *   node scripts/enrich.js data/estados_raw.geojson --layer estados --out data/estados.geojson
 */

import fs from 'fs-extra'
import path from 'path'
import { createReadStream } from 'fs'
import shapefile from 'shapefile'
import chalk from 'chalk'

// ─── Mapeo de campos crudos del INEGI a nuestra convención ───────────────────
// El INEGI usa nombres distintos según la versión del MGN.
// Agregamos todos los aliases conocidos para cubrir 2020, 2023 y 2024.

const FIELD_ALIASES = {
  cve_ent: ['CVE_ENT', 'CVEGEO_ENT', 'ID_ENTIDAD', 'EDO', 'CLAVE_ENT', 'cve_ent', 'CVE_EE'],
  cve_mun: ['CVE_MUN', 'CVEGEO_MUN', 'ID_MUNICIPIO', 'MUN', 'CLAVE_MUN', 'cve_mun'],
  cve_geo: ['CVEGEO', 'CVE_GEO', 'GEOCODIGO', 'cve_geo', 'CLAVE'],
  nom_ent: ['NOM_ENT', 'NOMGEO_ENT', 'NOMBRE_ENTIDAD', 'ESTADO', 'nom_ent', 'NOM_EE'],
  nom_mun: ['NOM_MUN', 'NOMGEO', 'NOMBRE_MUNICIPIO', 'MUNICIPIO', 'nom_mun', 'NOMBRE'],
  nom_colonia: ['NOM_COL', 'NOMBRE_COLONIA', 'COLONIA', 'nom_colonia', 'ASENTAMIENTO'],
  cp: ['CP', 'C_CP', 'COD_POSTAL', 'CODIGO_POSTAL', 'cp'],
  area_km2: ['AREA', 'AREA_KM2', 'SUPERFICIE', 'area_km2'],
}

// ─── Catálogo de estados para enriquecer municipios que solo traen cve_ent ───
const ESTADOS = {
  '01': 'Aguascalientes', '02': 'Baja California', '03': 'Baja California Sur',
  '04': 'Campeche', '05': 'Coahuila', '06': 'Colima', '07': 'Chiapas',
  '08': 'Chihuahua', '09': 'Ciudad de México', '10': 'Durango',
  '11': 'Guanajuato', '12': 'Guerrero', '13': 'Hidalgo', '14': 'Jalisco',
  '15': 'México', '16': 'Michoacán', '17': 'Morelos', '18': 'Nayarit',
  '19': 'Nuevo León', '20': 'Oaxaca', '21': 'Puebla', '22': 'Querétaro',
  '23': 'Quintana Roo', '24': 'San Luis Potosí', '25': 'Sinaloa',
  '26': 'Sonora', '27': 'Tabasco', '28': 'Tamaulipas', '29': 'Tlaxcala',
  '30': 'Veracruz', '31': 'Yucatán', '32': 'Zacatecas',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Busca el valor de un campo en properties usando los aliases conocidos.
 * Retorna el valor como string limpio, o null si no lo encuentra.
 */
function getField(properties, aliases) {
  for (const alias of aliases) {
    if (properties[alias] !== undefined && properties[alias] !== null) {
      return String(properties[alias]).trim()
    }
  }
  return null
}

/** Pad de clave con ceros a la izquierda */
function pad(value, length) {
  if (!value) return null
  return String(value).trim().padStart(length, '0')
}

// ─── Enriquecedores por capa ─────────────────────────────────────────────────

function enrichEstado(rawProps) {
  const cve_ent = pad(getField(rawProps, FIELD_ALIASES.cve_ent), 2)
  const nom_ent = getField(rawProps, FIELD_ALIASES.nom_ent) || ESTADOS[cve_ent] || null
  const area_km2 = getField(rawProps, FIELD_ALIASES.area_km2)

  return {
    cve_ent,
    nom_ent,
    ...(area_km2 ? { area_km2: parseFloat(area_km2) } : {}),
  }
}

function enrichMunicipio(rawProps) {
  let cve_ent = pad(getField(rawProps, FIELD_ALIASES.cve_ent), 2)
  let cve_mun = pad(getField(rawProps, FIELD_ALIASES.cve_mun), 3)

  // cve_geo puede venir ya completo (5 dígitos) o hay que construirlo
  let cve_geo = getField(rawProps, FIELD_ALIASES.cve_geo)
  if (cve_geo && cve_geo.length >= 5) {
    cve_geo = pad(cve_geo, 5)
    // Si no teníamos cve_ent o cve_mun, los sacamos del cve_geo
    if (!cve_ent) cve_ent = cve_geo.substring(0, 2)
    if (!cve_mun) cve_mun = cve_geo.substring(2, 5)
  } else if (cve_ent && cve_mun) {
    cve_geo = cve_ent + cve_mun
  }

  const nom_mun = getField(rawProps, FIELD_ALIASES.nom_mun)
  const nom_ent = getField(rawProps, FIELD_ALIASES.nom_ent) || ESTADOS[cve_ent] || null
  const area_km2 = getField(rawProps, FIELD_ALIASES.area_km2)

  return {
    cve_geo,
    cve_ent,
    nom_mun,
    nom_ent,
    ...(area_km2 ? { area_km2: parseFloat(area_km2) } : {}),
  }
}

function enrichCodigoPostal(rawProps) {
  const cp = pad(getField(rawProps, FIELD_ALIASES.cp), 5)
  let cve_ent = pad(getField(rawProps, FIELD_ALIASES.cve_ent), 2)
  let cve_mun = pad(getField(rawProps, FIELD_ALIASES.cve_mun), 3)

  let cve_geo = getField(rawProps, FIELD_ALIASES.cve_geo)
  if (cve_geo && cve_geo.length >= 5) {
    cve_geo = pad(cve_geo, 5)
    if (!cve_ent) cve_ent = cve_geo.substring(0, 2)
    if (!cve_mun) cve_mun = cve_geo.substring(2, 5)
  } else if (cve_ent && cve_mun) {
    cve_geo = cve_ent + cve_mun
  }

  const nom_mun = getField(rawProps, FIELD_ALIASES.nom_mun)
  const nom_ent = getField(rawProps, FIELD_ALIASES.nom_ent) || ESTADOS[cve_ent] || null

  return { cp, cve_mun, cve_ent, nom_mun, nom_ent }
}

function enrichColonia(rawProps) {
  const nom_colonia = getField(rawProps, FIELD_ALIASES.nom_colonia)
  const cp = pad(getField(rawProps, FIELD_ALIASES.cp), 5)
  let cve_ent = pad(getField(rawProps, FIELD_ALIASES.cve_ent), 2)
  let cve_mun = pad(getField(rawProps, FIELD_ALIASES.cve_mun), 3)

  let cve_geo = getField(rawProps, FIELD_ALIASES.cve_geo)
  if (cve_geo && cve_geo.length >= 5) {
    cve_geo = pad(cve_geo, 5)
    if (!cve_ent) cve_ent = cve_geo.substring(0, 2)
    if (!cve_mun) cve_mun = cve_geo.substring(2, 5)
  } else if (cve_ent && cve_mun) {
    cve_geo = cve_ent + cve_mun
  }

  const nom_mun = getField(rawProps, FIELD_ALIASES.nom_mun)
  const nom_ent = getField(rawProps, FIELD_ALIASES.nom_ent) || ESTADOS[cve_ent] || null

  // id_colonia: combinamos cve_geo + cp como identificador único
  const id_colonia = cve_geo && cp ? `${cve_geo}${cp}` : null

  return { id_colonia, nom_colonia, cp, cve_mun, cve_ent, nom_mun, nom_ent }
}

const ENRICHERS = {
  estados: enrichEstado,
  municipios: enrichMunicipio,
  codigos_postales: enrichCodigoPostal,
  colonias: enrichColonia,
}

// ─── Lectores de formato ──────────────────────────────────────────────────────

async function readShapefile(filePath) {
  const features = []
  const source = await shapefile.open(filePath)
  let result = await source.read()
  while (!result.done) {
    features.push(result.value)
    result = await source.read()
  }
  return features
}

async function readGeoJSON(filePath) {
  const raw = await fs.readJSON(filePath)
  if (raw.type === 'FeatureCollection') return raw.features
  if (raw.type === 'Feature') return [raw]
  throw new Error(`Formato no reconocido: ${raw.type}`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
${chalk.bold('enrich.js')} — Enriquece las properties de un GeoJSON/Shapefile del INEGI

${chalk.yellow('Uso:')}
  node scripts/enrich.js <archivo> --layer <capa> [--out <salida>]

${chalk.yellow('Capas disponibles:')}
  estados | municipios | codigos_postales | colonias

${chalk.yellow('Ejemplos:')}
  node scripts/enrich.js data/mun_raw.shp --layer municipios
  node scripts/enrich.js data/edo_raw.geojson --layer estados --out data/estados.geojson
    `)
    process.exit(0)
  }

  const inputFile = args[0]
  const layerIdx = args.indexOf('--layer')
  const outIdx = args.indexOf('--out')

  if (layerIdx === -1) {
    console.error(chalk.red('Error: debes especificar --layer'))
    process.exit(1)
  }

  const layer = args[layerIdx + 1]
  const enricher = ENRICHERS[layer]

  if (!enricher) {
    console.error(chalk.red(`Error: capa desconocida "${layer}". Opciones: ${Object.keys(ENRICHERS).join(', ')}`))
    process.exit(1)
  }

  const ext = path.extname(inputFile).toLowerCase()
  const outFile = outIdx !== -1
    ? args[outIdx + 1]
    : path.join(path.dirname(inputFile), `${path.basename(inputFile, ext)}_enriched.geojson`)

  console.log(chalk.cyan(`\n📂 Leyendo: ${inputFile}`))
  console.log(chalk.cyan(`🗺️  Capa: ${layer}`))

  let features
  if (ext === '.shp') {
    features = await readShapefile(inputFile)
  } else if (ext === '.geojson' || ext === '.json') {
    features = await readGeoJSON(inputFile)
  } else {
    console.error(chalk.red(`Formato no soportado: ${ext}. Usa .shp o .geojson`))
    process.exit(1)
  }

  console.log(chalk.cyan(`✅ Features encontrados: ${features.length}`))

  // Mostrar muestra de properties crudas para diagnóstico
  if (features.length > 0) {
    console.log(chalk.gray('\nProperties del primer feature (crudo):'))
    console.log(chalk.gray(JSON.stringify(features[0].properties, null, 2)))
  }

  // Enriquecer
  let enriched = 0
  let warnings = 0

  const enrichedFeatures = features.map((feature, i) => {
    const newProps = enricher(feature.properties || {})

    // Detectar properties nulas como warning
    const nullProps = Object.entries(newProps).filter(([, v]) => v === null).map(([k]) => k)
    if (nullProps.length > 0 && i < 5) {
      console.warn(chalk.yellow(`  ⚠️  Feature ${i}: properties nulas → ${nullProps.join(', ')}`))
      warnings++
    }

    enriched++
    return { ...feature, properties: newProps }
  })

  const geojson = {
    type: 'FeatureCollection',
    features: enrichedFeatures,
  }

  await fs.ensureDir(path.dirname(outFile))
  await fs.writeJSON(outFile, geojson)

  console.log(chalk.green(`\n✅ Listo: ${enriched} features enriquecidos`))
  if (warnings > 0) {
    console.log(chalk.yellow(`⚠️  ${warnings} features con properties nulas (revisa los aliases en FIELD_ALIASES)`))
  }
  console.log(chalk.green(`💾 Guardado en: ${outFile}\n`))

  // Mostrar muestra del resultado
  console.log(chalk.gray('Properties del primer feature (enriquecido):'))
  console.log(chalk.gray(JSON.stringify(enrichedFeatures[0]?.properties, null, 2)))
}

main().catch(err => {
  console.error(chalk.red(`\n❌ Error: ${err.message}`))
  process.exit(1)
})