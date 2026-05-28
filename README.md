# 🇲🇽 geojson-mexico

> GeoJSONs de México listos para usar — con propiedades estandarizadas, ligados entre capas y optimizados para producción.

El problema que este repo resuelve: descargas un GeoJSON de municipios de México y en `properties` solo viene `{ "NOMGEO": "Ecatepec" }`. Sin clave INEGI, sin referencia al estado padre, sin nada que lo ligue a tus catálogos. **Este repo lo arregla.**

Cada capa tiene propiedades estandarizadas con las claves oficiales del INEGI, y cada feature está ligado a su entidad padre para que puedas hacer joins sin ambigüedad.

---

## 📦 Capas disponibles

| Capa | Features | Tamaño | Estado |
|------|----------|--------|--------|
| Estados | 32 | ~200 KB | ✅ Listo |
| Municipios | 2,478 | ~13 MB | ✅ Listo |
| Códigos postales | ~145,000 | por estado | 🔜 Próximamente |
| Colonias | ~98,000 | por estado | 🔜 Próximamente |

---

## ✨ Características

- ✅ Propiedades estandarizadas con claves oficiales INEGI en todas las capas
- ✅ Cada municipio sabe a qué estado pertenece (`cve_ent`, `nom_ent`)
- ✅ Archivos divididos por estado para cargas ligeras
- ✅ Catálogos JSON sin geometría para dropdowns y lookups rápidos
- ✅ Disponible vía CDN (jsDelivr) y descarga directa
- ✅ Fuente oficial: INEGI Marco Geoestadístico 2025
- ✅ Geometrías simplificadas y reproyectadas a WGS84 para web

---

## 🔑 Convención de propiedades

Todas las capas usan las mismas claves para que puedas hacer joins fácilmente:

### Estados
```json
{
  "cve_ent": "19",
  "nom_ent": "Nuevo León"
}
```

### Municipios
```json
{
  "cve_geo": "19039",
  "cve_ent": "19",
  "nom_mun": "Monterrey",
  "nom_ent": "Nuevo León"
}
```
> `cve_geo` = `cve_ent` + `cve_mun` (5 dígitos, clave oficial INEGI)

### Códigos postales *(próximamente)*
```json
{
  "cp": "64000",
  "cve_mun": "19039",
  "cve_ent": "19",
  "nom_mun": "Monterrey",
  "nom_ent": "Nuevo León"
}
```

### Colonias *(próximamente)*
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

// Catálogo de municipios sin geometría
const res = await fetch('https://cdn.jsdelivr.net/gh/Fernando196/geojson-mexico@main/catalogs/municipios.json')
```

### Descarga directa

Ve a [Releases](https://github.com/Fernando196/geojson-mexico/releases) o descarga el archivo directo desde `data/` o `by-state/`.

---

## 📁 Estructura del repo

```
geojson-mexico/
├── data/
│   ├── estados.geojson          # 32 features
│   └── municipios.geojson       # 2,478 features
├── by-state/
│   ├── 01_aguascalientes/
│   │   ├── estado.geojson       # polígono del estado
│   │   └── municipios.geojson   # municipios del estado
│   ├── 02_baja_california/
│   └── ... (32 estados)
├── catalogs/
│   ├── estados.json             # claves y nombres, sin geometría
│   └── municipios.json          # claves y nombres, sin geometría
├── scripts/
│   ├── enrich.js                # normaliza properties de cualquier GeoJSON
│   ├── simplify.js              # reduce peso con mapshaper
│   ├── split-by-state.js        # parte el nacional en 32 archivos
│   ├── add-state-to-folders.js  # copia estado.geojson a cada carpeta
│   ├── validate.js              # valida propiedades y relaciones
│   └── generate-catalogs.js     # genera los JSON sin geometría
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
const res = await fetch('https://cdn.jsdelivr.net/gh/Fernando196/geojson-mexico@main/data/municipios.geojson')
const municipios = await res.json()

// Todos los municipios de Jalisco (cve_ent: "14")
const jalisco = municipios.features.filter(f => f.properties.cve_ent === '14')
```

### Lookup rápido con catálogo

```js
const res = await fetch('https://cdn.jsdelivr.net/gh/Fernando196/geojson-mexico@main/catalogs/municipios.json')
const catalogo = await res.json()
// → [{ cve_geo: "19039", cve_ent: "19", nom_mun: "Monterrey", nom_ent: "Nuevo León" }, ...]

const mty = catalogo.find(m => m.nom_mun === 'Monterrey')
const municipiosNL = catalogo.filter(m => m.cve_ent === '19')
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
| Estados | INEGI Marco Geoestadístico | 2025 |
| Municipios | INEGI Marco Geoestadístico | 2025 |
| Códigos postales | SEPOMEX | próximamente |
| Colonias | INEGI / SEPOMEX | próximamente |

---

## 🤝 Contribuir

¿Encontraste un error en un nombre, una clave incorrecta o una geometría rara? Abre un issue o manda un PR. Este repo es para la comunidad.

```bash
git clone https://github.com/Fernando196/geojson-mexico.git
cd geojson-mexico
npm install

# Validar propiedades
node scripts/validate.js data/municipios.geojson --layer municipios

# Partir por estado
node scripts/split-by-state.js data/municipios.geojson

# Generar catálogos
node scripts/generate-catalogs.js
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