# Simplificación: de Campo → Zona → Cerco a Campo → Cerco

* **Autor**: Claude (sesión con Santino)
* **Fecha**: 13/10/2026
* **Estado**: Completado (falta probar en navegador contra una base con la migración aplicada)

## 1. Qué cambió y por qué

### 1.1 Se eliminó el nivel "Zona"

El equipo notó que las zonas casi no se usaban y que obligaban al productor a dibujar dos veces (primero el campo, después la zona) antes de poder hacer un cerco. Además duplicaban información: un animal tenía una zona (`Animal.zoneId`) **y** un cerco (`AnimalGeofence`), y había código solo para mantener las dos cosas coherentes.

Ahora la jerarquía es **Campo → Cerco**. Si un establecimiento grande necesita dividirse, se cargan **varios campos** y dentro de cada uno se dibujan los cercos.

**Lo que se pierde / cambia de lugar:**
- El **tipo de pastura** pasa a ser un dato **opcional del cerco** (`Geofence.pastureType`).
- La **rotación de pastoreo** pasa a ser **por campo** (antes era por zona): los animales que rotan son los animales activos del campo.
- Los **roles son por campo**: si un productor parte su establecimiento en varios campos, tiene que invitar a su personal en cada uno.

### 1.2 Base de datos (`migrations/20261013000000_remove_zones_geofences_by_farm`)

- `geofences.farm_id` (se completa desde la zona antes de borrarla) y `geofences.pasture_type` (copiado de la zona).
- Se quitan `animals.zone_id`, `gateways.zone_id` y la tabla `zones`.
- `zone_rotation_plans` / `zone_rotation_steps` se reemplazan por `rotation_plans` / `rotation_steps` (con `farm_id`). **Los planes de rotación existentes se descartan.**

### 1.3 Backend

| Antes | Ahora |
|---|---|
| `GET/POST/PATCH/DELETE /zones` | Eliminado |
| `GET /geofences?zoneId=` | `GET /geofences?farmId=` |
| `POST /geofences` con `zoneId` | `POST /geofences` con `farmId` y `pastureType` opcional. El cerco se valida contra el **perímetro del campo**. |
| `/zones/:zoneId/rotation/*` | `/farms/:farmId/rotation/*` (módulo nuevo `rotations`) |
| `POST /animals/bulk/zone` | `POST /animals/bulk/geofence` (asigna o quita varios animales de un cerco; exige collar activo) |
| `PATCH /animals/:id/zone` | Eliminado (ya existía `PATCH /animals/:id/geofence`) |
| — (no se podían editar cercos) | `PATCH /geofences/:id`: edita nombre, pastura y/o polígono (validado contra el campo). Si cambia el polígono, los collares de sus animales quedan pendientes de recibir el cerco nuevo. |
| `GET /animals?zoneId=` | `GET /animals?geofenceId=` |
| `GET /animals/locations` devolvía `zone` | Devuelve `geofence` (cerco actual del animal) |

También se ajustaron: reportes (la columna "Zona" del Excel pasa a "Cerco"; el PDF y el dashboard ya no cuentan zonas), la validación que impide achicar un campo (ahora revisa cercos activos), el borrado de campos, gateways (sin zona), IoT (resuelve la rotación por campo) y el guard de permisos.

### 1.4 Frontend

- **Se borró `/zonas`** y su link del menú. Crear un campo ahora redirige a **Cercos**.
- **Cercos es la pantalla principal del mapa**: un solo selector (Campo), mapa a todo el ancho con tres vistas (Cercos / Hacienda en vivo / Mapa de calor), lista de cercos con pastura, y alta en un modal con mapa para dibujar, pastura opcional y selección de hacienda (solo animales con collar, que es lo que exige el backend). La pestaña "Pastoreo rotativo" sigue ahí, ahora por campo.
- **Hacienda**: el filtro "Potrero / Zona" pasa a **"Cerco"** y la acción masiva "Mover a potrero" pasa a **"Asignar a cerco"**. Se quitó la columna de zona y el campo zona de los formularios de alta/edición.
- **Gateways**: se quitó el selector de zona.
- Renombres: `ZoneMap` → `FenceMap`, `ZoneRotationMap` → `RotationMap`, `components/zones/*` → `components/fences/*`.

### 1.5 Antes de esto, en la misma sesión

- **Alta/edición en modal** (commit `e5d27bd`): el formulario lateral pasó a un modal con su propio mapa para dibujar, el mapa de la pantalla quedó a todo el ancho y los selectores chicos arriba a la derecha. Nombres sugeridos secuenciales (`suggestNextName`: "Cerco 1", "Cerco 2"…).
- **Se eliminó `/geolocalizacion`** (commit `871d173`): repetía los polígonos de otras pantallas; lo único propio (posición de los animales, recorrido por animal y mapa de calor) se integró como vistas del mapa. Hoy esas vistas viven en Cercos.

## 2. Cómo probarlo

```bash
# 1. Aplicar la migración (con la DB levantada)
cd backend && pnpm db:migrate        # o pnpm db:deploy

# 2. Tests del backend
pnpm test
```

En la app:
1. Crear un campo con perímetro → debería redirigir a **Cercos**.
2. "Nuevo cerco" → el nombre viene sugerido ("Cerco 1"), se puede cargar pastura, y no deja guardar puntos fuera del perímetro del campo.
   "Editar" en un cerco abre el mismo modal con el polígono cargado para ajustarlo.
3. En **Hacienda**, seleccionar varios animales con collar → "Asignar a cerco".
4. Pestaña "Pastoreo rotativo" con al menos 2 cercos y animales en el campo.

`scripts/bootstrap-simulation.js` ya no crea zona; si no se pasa `CENTER_LAT`/`CENTER_LNG`, centra el cerco de prueba en el perímetro del campo.

## 3. Pendientes

- **Rotación por campo con varios rodeos**: hoy rotan *todos* los animales activos del campo. Si un campo tiene rodeos separados que no deben rotar juntos, habría que guardar en el plan qué animales participan.
- **Paso "vincular Gateway" del alta de campo**: estaba bloqueado porque un gateway necesitaba una zona; ese bloqueo ya no existe, se puede retomar.
- Los epics anteriores (`epic-6-7`, `epic-4`, `epic-3`, etc.) siguen mencionando zonas: son registro histórico y no se reescribieron.
