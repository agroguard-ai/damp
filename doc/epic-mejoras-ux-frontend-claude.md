# Epic: Mejoras UX/UI de Frontend + CI/CD

* **Autor**: Claude (sesión con Santino)
* **Fecha**: 25-26/08/2026
* **Estado**: Implementadas las propuestas de bajo/medio esfuerzo del análisis UX/UI. Las de mayor esfuerzo (PWA, clustering, playback histórico) quedan sin empezar — ver sección 4.

## 1. Resumen de la Solución Técnica

Un compañero (Tomás) subió `doc/ANALISIS_UX_UI_Y_MEJORAS_FRONTEND.md` (25/08/2026) con un diagnóstico y una matriz de priorización de mejoras de UX/UI, junto con una tanda grande de cambios de frontend propios (buscador de dirección, dibujo de perímetro, controles de mapa, normalización de provincias). Esta sesión tomó esa matriz y fue implementando, en commits chicos e independientes, los ítems de prioridad "Inmediata"/"Alta" que no requerían agregar dependencias nuevas ni rediseños grandes.

**Importante**: parte del diagnóstico del documento de Tomás ya estaba desactualizado contra el código real al momento de leerlo — por ejemplo, describía la vista de hacienda (`/animals`) como "tabla plana de animales con datos en texto simple" cuando en realidad ya era una grilla de tarjetas con badges de salud (de una sesión anterior). Se verificó cada ítem contra el código antes de decidir qué hacía falta, no se asumió el diagnóstico al pie de la letra.

### 1.1 RENSPA (item 3.2.B)

Campo nuevo para el Registro Nacional Sanitario de Productores Agropecuarios (SENASA), necesario para trazabilidad ganadera.

- **Backend**: `Farm.renspa` (`String?`, migración `20260826000000_add_farm_renspa`), validado con `@Matches` contra el formato `XX.XXX.X.XXXXX/XX` en `CreateFarmDto`.
- **Frontend**: input con autoformato en `farms/new/page.tsx` — inserta puntos/barra a medida que se tipea, no deja avanzar al paso 2 si quedó incompleto (pero es opcional, vacío es válido).

### 1.2 Breadcrumbs dinámicos (item 2.1)

Tomás ya había sacado el `<h2>` duplicado del Topbar (`PageTitle.tsx` eliminado) pero no había puesto el reemplazo — el Topbar había quedado con un lado vacío.

- **`components/layout/Breadcrumbs.tsx`** (nuevo): arma la miga de pan a partir de `usePathname()`, con un diccionario de etiquetas en español para los segmentos conocidos. IDs dinámicos en la URL (UUID o numéricos) se muestran truncados (`#1a2b3c4d`) — no hay fetch del nombre real del recurso, sería una mejora futura.
- Se integró en `Topbar.tsx`.
- **Bug de CI encontrado y corregido**: la primera versión reasignaba una variable `let` dentro de un `.map()` durante el render, lo que dispara `react-hooks/immutability` (regla nueva del preset de Next.js). Se corrigió calculando el href con `slice().join()` en cada iteración en vez de acumular estado mutable entre iteraciones.

### 1.3 Indicador visual de señal LoRa (item 4.3, parcial)

- **`components/gateways/SignalStrength.tsx`** (nuevo): barras tipo señal de celular a partir de `Gateway.lastRssi` (con `lastSnr` en el tooltip) — reemplaza el texto plano "RSSI: -72" que había en `/gateways`.
- **No se agregó indicador de batería de collar**: ese dato no existe en el modelo `Collar` (el collar no lo reporta) — mostrarlo hubiera sido un número inventado. Queda pendiente de verdad hasta que el firmware lo soporte.

### 1.4 Modal de confirmación reutilizable (item 5.2)

- **`context/ConfirmDialogContext.tsx`** (nuevo): `useConfirm()`, reemplazo async de `window.confirm()` — `if (!(await confirm({ title, description, danger })))`. Mismo patrón de provider que `ToastContext.tsx`, montado en `layout.tsx`.
- Migrados los 7 call sites de `confirm()` nativo que había en toda la app: `AdminUserList`, `FarmUserList`, cercos (desactivar), zonas (eliminar), collares (cambiar estado), animales (archivar), gateways (eliminar), tipos de animal (eliminar).

### 1.5 Skeleton loaders (item 5.2)

- **`components/ui/Skeleton.tsx`** (nuevo): `Skeleton` (bloque pulsante base), `SkeletonCard`/`SkeletonCardGrid` (listados tipo tarjeta), `SkeletonRow`/`SkeletonRowList` (listados tipo fila).
- Aplicados donde reemplazan un spinner de **carga de contenido de página** (hacienda, zonas, gateways, collares, alertas, tipos de animal, y un placeholder del tamaño del mapa en geolocalización). Los spinners de **botones** (guardar, agregar registro médico, etc.) se dejaron igual a propósito — son feedback de una mutación puntual, no carga de contenido, y no es el patrón que este ítem del análisis busca reemplazar.

### 1.6 Filtros multifacéticos en hacienda (item 4.1, parcial)

- **Filtro por Zona/Lote**: el backend ya soportaba `zoneId` como query param en `GET /animals`, no estaba expuesto en la UI. Se agregó el `<select>` reutilizando `farmZones`, que la página ya cargaba.
- **Filtro "Solo con alertas activas"**: no existía en absoluto. Se agregó `hasActiveAlert` como query param en `GET /animals` (`animals.controller.ts` → `animals.service.ts`, filtra `alerts: { some: { isResolved: false } }`), con tests (`animals.service.spec.ts`), y un checkbox en la UI (no un `<select>`, porque es un booleano).
- **No se agregó** filtro por batería de collar (mismo motivo que 1.3: el dato no existe) ni por "categoría" (Vaquillona/Toro/Ternero — no existe ese concepto en el modelo, `AnimalType` es especie, no categoría etaria).

### 1.7 Flujo de alta de campo (item 3.1.4)

Redirigir a `/animals/new` justo después de crear un campo era un salto abrupto — sin zonas ni cercos todavía, no hay dónde asignar el animal. Se cambió a `router.push('/zonas?farmId=' + farm.id)`, y `zonas/page.tsx` ahora lee ese `farmId` de la URL para preseleccionar el campo recién creado.

**Bug de build encontrado y corregido**: `useSearchParams()` en un componente que se prerrenderiza como página estática rompe `next build` con "should be wrapped in a suspense boundary" — **ni `tsc` ni `eslint` lo detectan**, solo aparece corriendo `pnpm run build` de verdad. Se solucionó separando `ZonasPage` (wrapper con `<Suspense>`) de `ZonasPageContent` (la lógica real). Esto quedó como aprendizaje para el resto del equipo: los cambios que tocan `useSearchParams`/`useParams` en páginas nuevas deberían verificarse con un build real, no solo lint.

### 1.8 CI/CD (nuevo — no existía nada antes)

- **`damp/.github/workflows/backend-ci.yml`**: `prisma generate` + `tsc --noEmit` + `pnpm test`, sin DB real (los tests mockean `PrismaService`). Trigger por path (`backend/**`).
- **`damp/.github/workflows/frontend-ci.yml`**: `tsc --noEmit` + `pnpm run lint`, sin build completo (para no depender de env vars de Clerk que no están en CI). Trigger por path (`frontend/**`).
- **`damp-ml-api/.github/workflows/tests.yml`**: `pytest tests/`, no depende del dataset ni del modelo (no están versionados en git).
- Encontró y forzó a corregir, de rebote, tres bugs reales que nadie había notado porque no había CI corriendo antes: el de `react-hooks/immutability` en Breadcrumbs (1.2), un `any` sin tipar en `GoogleAddressSearch.tsx` (código de Tomás), y un problema de formato en `next.config.ts`.

### 1.9 `start.bat` (conveniencia de desarrollo)

Script en la raíz de `damp/` que levanta DB (Docker, solo el servicio `db` del compose — no `backend`/`ml-service`, que ahora también están definidos ahí como contenedores completos pero el flujo de dev real sigue siendo `pnpm` directo) + backend + frontend, cada uno en su propia ventana. Documentado en `damp/README.md`. Probado de punta a punta: los tres servicios levantan y los puertos 3000/3001 quedan escuchando.

## 2. Mapa del Código

| Capa | Archivo | Estado |
|---|---|---|
| Backend | `backend/prisma/schema.prisma`, `migrations/20260826000000_add_farm_renspa/` | `Farm.renspa` (nuevo) |
| Backend | `backend/src/farms/dto/create-farm.dto.ts` | Validación de formato RENSPA |
| Backend | `backend/src/animals/animals.service.ts`, `animals.controller.ts` | Filtro `hasActiveAlert` (nuevo) |
| Backend | `backend/src/animals/animals.service.spec.ts` | **Nuevo** — 3 tests del filtro |
| Frontend | `frontend/src/components/layout/Breadcrumbs.tsx` | **Nuevo** |
| Frontend | `frontend/src/components/gateways/SignalStrength.tsx` | **Nuevo** |
| Frontend | `frontend/src/context/ConfirmDialogContext.tsx` | **Nuevo** |
| Frontend | `frontend/src/components/ui/Skeleton.tsx` | **Nuevo** |
| Frontend | `frontend/src/app/(dashboard)/farms/new/page.tsx` | RENSPA, redirect a `/zonas` |
| Frontend | `frontend/src/app/(dashboard)/zonas/page.tsx` | Preselección por `?farmId=`, `Suspense` boundary |
| Frontend | `frontend/src/app/(dashboard)/animals/page.tsx` | Filtros de Zona y "alertas activas", skeleton |
| Frontend | 7 páginas/componentes con `window.confirm()` migrado | Ver 1.4 |
| Frontend | 6 páginas con skeleton en vez de spinner | Ver 1.5 |
| CI | `damp/.github/workflows/*.yml`, `damp-ml-api/.github/workflows/tests.yml` | **Nuevo** |
| Dev | `damp/start.bat`, `damp/README.md` | **Nuevo** |

## 3. Instrucciones de Prueba Rápida

```bash
# Verificar RENSPA: crear un campo con RENSPA incompleto no deja avanzar al paso 2.
# Verificar hasActiveAlert:
curl "http://localhost:3001/animals?farmId=<uuid>&hasActiveAlert=true" -H "Authorization: Bearer <token>"
# Solo deberían volver animales con alguna Alert(isResolved: false).

# Verificar que el build real sigue sano (lint/tsc no alcanzan para esto):
cd frontend && pnpm run build
```

## 4. Qué queda por hacer

- **Clustering de marcadores** y **playback histórico** en el mapa satelital (items 4.2.3/4.2.4) — necesitan una librería nueva de Leaflet, no se empezaron.
- **PWA / modo offline** (item 5.1) — la propuesta más grande del análisis, necesita decisiones de arquitectura (Service Worker, qué se cachea, qué se sincroniza offline) antes de empezar a programar.
- **Paso 3 del wizard de alta de campo** ("Equipamiento inicial: vincular Gateway") — tiene un bloqueo real de dependencias: un `Gateway` necesita una `Zone`, y las zonas no existen todavía en ese punto del flujo (se crean después, en `/zonas`). Se resolvió parcialmente con 1.7 (redirigir a Zonas en vez de a alta de animal), pero el paso de gateway en sí no se implementó.
- **Vista de tarjetas/filtros de categoría en hacienda**: el diagnóstico original de Tomás pedía "categoría" (Vaquillona/Toro/Ternero) como filtro — no existe ese campo en el modelo `Animal` hoy, sería un cambio de schema aparte.
- **Nombre real de recursos en breadcrumbs**: hoy los IDs dinámicos en la URL se muestran truncados (`#1a2b3c4d`) en vez del nombre real del campo/zona/animal — necesitaría un fetch adicional por segmento dinámico.
