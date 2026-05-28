# 🇲🇽 geojson-mexico

> GeoJSONs de México listos para usar — con propiedades estandarizadas, ligados entre capas y optimizados para producción.

El problema que este repo resuelve: descargas un GeoJSON de municipios de México y en `properties` solo viene `{ "NOMGEO": "Ecatepec" }`. Sin clave INEGI, sin referencia al estado padre, sin nada que lo ligue a tus catálogos. **Este repo lo arregla.**

Cada capa tiene propiedades estandarizadas con las claves oficiales del INEGI, y cada feature está ligado a su entidad padre para que puedas hacer joins sin ambigüedad.

---

## ✨ Características

- ✅ Propiedades estandarizadas con claves oficiales INEGI en todas las capas
- ✅ Cada municipio sabe a qué estado pertenece (`cve_ent`, `nom_ent`)
- ✅ Cada colonia sabe su CP, municipio y estado
- ✅ Archivos divididos por estado para cargas ligeras
- ✅ Catálogos JSON sin geometría para dropdowns y lookups rápidos
- ✅ Disponible vía CDN (jsDelivr), npm y descarga directa
- ✅ Fuente oficial: INEGI Marco Geoestadístico 2023
- ✅ Geometrías simplificadas para web (sin sacrificar forma)

---

## 📦 Capas disponibles

| Capa | Features | Tamaño | Estado |
|------|----------|--------|--------|
| Estados | 32 | ~200 KB | ✅ Listo |
| Municipios | 2,475 | ~8 MB | ✅ Listo |
| Códigos postales | ~145,000 | por estado | 🔄 En proceso |
| Colonias | ~98,000 | por estado | 🔄 En proceso |

---

## 🔑 Convención de propiedades

Todas las capas usan las mismas claves para que puedas hacer joins fácilmente:

### Estados
```json
{
  "cve_ent": "19",
  "nom_ent": "Nuevo León",
  "region": "Noreste",
  "area_km2": 64220.06
}
```

### Municipios
```json
{
  "cve_geo": "19039",
  "cve_ent": "19",
  "nom_mun": "Monterrey",
  "nom_ent": "Nuevo León",
  "area_km2": 325.72
}
```
> `cve_geo` = `cve_ent` + `cve_mun` (5 dígitos, clave oficial INEGI)

### Códigos postales
```json
{
  "cp": "64000",
  "cve_mun": "19039",
  "cve_ent": "19",
  "nom_mun": "Monterrey",
  "nom_ent": "Nuevo León"
}
```

### Colonias
```json
{
  "id_colonia": "1903901",
  "nom_colonia": "Centro",
  "cp": "64000",
  "cve_mun": "19039",
  "cve_ent": "19",
  "nom_mun": "Monterrey",
  "nom_ent": "Nuevo León"
}
```

---

## 🚀 Cómo consumir

### CDN (jsDelivr) — sin instalar nada

```js
// Estados
const res = await fetch('https://cdn.jsdelivr.net/gh/Fernando196/geojson-mexico@main/data/estados.geojson')
const estados = await res.json()

// Municipios (todos)
const res = await fetch('https://cdn.jsdelivr.net/gh/Fernando196/geojson-mexico@main/data/municipios.geojson')

// Municipios de un estado (más ligero)
const res = await fetch('https://cdn.jsdelivr.net/gh/Fernando196/geojson-mexico@main/by-state/19_nuevo_leon/municipios.geojson')
```

### npm

```bash
npm install geojson-mexico
```

```js
import { estados, getMunicipios, getByEstado } from 'geojson-mexico'

// GeoJSON completo de estados
const estadosGeo = estados()

// Municipios de Nuevo León (cve_ent: "19")
const municipiosNL = getMunicipios('19')

// Todos los datos de un estado
const nuevoLeon = getByEstado('19')
// → { municipios, codigos_postales, colonias }
```

### Descarga directa

Ve a [Releases](https://github.com/Fernando196/geojson-mexico/releases) y descarga el zip del estado o capa que necesitas.

---

## 📁 Estructura del repo

```
geojson-mexico/
├── data/
│   ├── estados.geojson          # 32 features, ~200 KB
│   ├── municipios.geojson       # 2,475 features, ~8 MB
│   ├── codigos_postales.geojson # (próximamente)
│   └── colonias.geojson         # (próximamente)
├── by-state/
│   ├── 01_aguascalientes/
│   │   ├── municipios.geojson
│   │   ├── codigos_postales.geojson
│   │   └── colonias.geojson
│   ├── 02_baja_california/
│   │   └── ...
│   └── ... (32 estados)
├── catalogs/
│   ├── estados.json             # Solo nombres y claves, sin geometría
│   ├── municipios.json
│   └── codigos_postales.json
├── scripts/
│   ├── enrich.js                # Enriquece properties de cualquier GeoJSON
│   ├── simplify.js              # Reduce peso con mapshaper
│   ├── split-by-state.js        # Parte el nacional en 32 archivos
│   └── validate.js              # Valida propiedades y relaciones
└── package.json
```

---

## 💡 Ejemplos de uso

### Leaflet — resaltar municipio al hover

```js
import L from 'leaflet'

const res = await fetch('https://cdn.jsdelivr.net/gh/Fernando196/geojson-mexico@main/by-state/19_nuevo_leon/municipios.geojson')
const municipios = await res.json()

L.geoJSON(municipios, {
  onEachFeature(feature, layer) {
    layer.on('mouseover', () => {
      layer.setStyle({ fillColor: '#3B82F6', fillOpacity: 0.5 })
      layer.bindTooltip(`${feature.properties.nom_mun} — ${feature.properties.cve_geo}`).openTooltip()
    })
    layer.on('mouseout', () => layer.resetStyle())
  }
}).addTo(map)
```

### Filtrar municipios por estado

```js
const res = await fetch('.../municipios.geojson')
const municipios = await res.json()

// Todos los municipios de Jalisco (cve_ent: "14")
const jalisco = municipios.features.filter(f => f.properties.cve_ent === '14')
```

### Lookup rápido con catálogo (sin cargar geometría)

```js
const res = await fetch('.../catalogs/municipios.json')
const catalogo = await res.json()
// → [{ cve_geo: "19039", cve_ent: "19", nom_mun: "Monterrey", nom_ent: "Nuevo León" }, ...]

// Buscar municipio por nombre
const mty = catalogo.find(m => m.nom_mun === 'Monterrey')
```

---

## 🗺️ Claves de estados (INEGI)

| Clave | Estado | Clave | Estado |
|-------|--------|-------|--------|
| 01 | Aguascalientes | 17 | Morelos |
| 02 | Baja California | 18 | Nayarit |
| 03 | Baja California Sur | 19 | Nuevo León |
| 04 | Campeche | 20 | Oaxaca |
| 05 | Coahuila | 21 | Puebla |
| 06 | Colima | 22 | Querétaro |
| 07 | Chiapas | 23 | Quintana Roo |
| 08 | Chihuahua | 24 | San Luis Potosí |
| 09 | Ciudad de México | 25 | Sinaloa |
| 10 | Durango | 26 | Sonora |
| 11 | Guanajuato | 27 | Tabasco |
| 12 | Guerrero | 28 | Tamaulipas |
| 13 | Hidalgo | 29 | Tlaxcala |
| 14 | Jalisco | 30 | Veracruz |
| 15 | México | 31 | Yucatán |
| 16 | Michoacán | 32 | Zacatecas |

---

## 📊 Fuentes

| Capa | Fuente | Versión |
|------|--------|---------|
| Estados | INEGI Marco Geoestadístico | Dic 2023 |
| Municipios | INEGI Marco Geoestadístico | Dic 2023 |
| Códigos postales | SEPOMEX / INEGI | 2024 |
| Colonias | INEGI DENUE + SEPOMEX | 2024 |

---

## 🤝 Contribuir

¿Encontraste un error en un nombre, una clave incorrecta o una geometría rara? Abre un issue o manda un PR. Este repo es para la comunidad.

```bash
git clone https://github.com/Fernando196/geojson-mexico.git
cd geojson-mexico
npm install

# Procesar un GeoJSON nuevo
node scripts/enrich.js input.geojson --layer municipios

# Partir por estado
node scripts/split-by-state.js data/municipios.geojson

# Validar propiedades
node scripts/validate.js data/municipios.geojson
```

---

## 📝 Licencia

MIT — úsalo como quieras, en producción, en proyectos comerciales, en gobierno. Solo da crédito si puedes.

Los datos son públicos y provienen de fuentes oficiales del gobierno mexicano (INEGI, SEPOMEX).

---

<p align="center">
  Hecho con ❤️ para la comunidad dev de México
  <br>
  <a href="https://github.com/Fernando196/geojson-mexico/issues">Reportar error</a> ·
  <a href="https://github.com/Fernando196/geojson-mexico/discussions">Discusiones</a>
</p>