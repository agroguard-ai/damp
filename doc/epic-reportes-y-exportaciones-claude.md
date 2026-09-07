# Epic: Generación de Reportes y Exportaciones (CU017)

* **Autor**: Claude (sesión con Santino)
* **Fecha de Creación**: 17/08/2026
* **Estado**: Completado

## 1. Resumen de la Solución Técnica

No existía ninguna librería de generación de documentos en el proyecto. Se agregaron `exceljs` (Excel) y `pdfkit` (PDF) al backend, y se construyeron los 6 reportes que pide el CU, todos con chequeo de propiedad (`farm.userId` / `animal.farm.userId`) igual que el resto de la API.

**Pieza de infraestructura necesaria que no existía**: el proxy BFF del frontend (`frontend/src/lib/proxy.ts`) solo sabía reenviar JSON — hacía `.text()` sobre cualquier respuesta no-JSON y la reenvolvía en `NextResponse.json(...)`, lo cual corrompe un PDF/Excel binario. Se agregó `proxyFileDownload()`, que reenvía los bytes crudos preservando `Content-Type`/`Content-Disposition`. Sin esto, ningún botón de descarga hubiera funcionado — es la razón por la que las rutas de reportes en el frontend usan una función distinta a las demás.

## 2. Contrato de Integración y Consumo

Todos los endpoints son `GET`, protegidos por `ClerkAuthGuard`, y devuelven el archivo binario directamente (no JSON) con `Content-Disposition: attachment`.

* **`GET /reports/animals/:animalId/medical-history`** → PDF. Historial médico completo de un animal.
* **`GET /reports/farms/:farmId/animals`** → Excel. Listado de animales de la granja con su estado actual (tag, tipo, raza, peso, zona, collar, estado).
* **`GET /reports/farms/:farmId/telemetry?from=&to=`** → Excel. Lecturas biométricas de todos los collares activos de la granja en el rango de fechas indicado (ambos parámetros opcionales).
* **`GET /reports/farms/:farmId/escapes?from=&to=`** → PDF. Eventos de alerta `ESCAPE` en el rango indicado.
* **`GET /reports/farms/:farmId/alerts?format=pdf|xlsx&from=&to=`** → PDF o Excel según `format` (default `pdf`). Historial completo de alertas (no solo escapes).
* **`GET /reports/farms/:farmId/summary`** → PDF. Resumen: animales activos, collares asignados, zonas, cercos virtuales activos, alertas sin resolver.

## 3. Mapa del Código

| Capa | Archivo | Descripción |
|---|---|---|
| Backend | `backend/src/reports/reports.service.ts` | Las 6 consultas + generación de PDF (`pdfkit`) / Excel (`exceljs`), devuelven `Buffer` |
| Backend | `backend/src/reports/reports.controller.ts` | Setea `Content-Type`/`Content-Disposition` y hace `res.send(buffer)` con `@Res()` de Express |
| Frontend | `frontend/src/lib/proxy.ts` | `proxyFileDownload()` — passthrough binario (nuevo, ver sección 1) |
| Frontend | `frontend/src/app/api/reports/**` | 6 rutas proxy, una por reporte, todas usan `proxyFileDownload()` en vez de `proxyRequest()` |
| Frontend | `frontend/src/app/(dashboard)/reportes/page.tsx` | Selector de granja + rango de fechas + un botón de descarga por reporte (enlaces `<a href>` directos a las rutas proxy — el navegador maneja la descarga solo, no hace falta JS de por medio) |

## 4. Instrucciones de Prueba Rápida

Desde la UI (`/reportes`) es lo más simple: elegir campo, rango de fechas opcional, y click en cualquiera de los botones de descarga.

Por API directa (necesita token de Clerk):
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3001/reports/farms/<farmId>/summary \
  -o resumen.pdf
```

**Nota de verificación de esta sesión**: no se pudo probar por HTTP con `curl` sin autenticación real (bloqueado por Clerk, igual que el resto del backend). Se instanció `ReportsService` directamente contra la DB real con datos de prueba (sembrados y borrados después de verificar) para confirmar que el PDF sale con el header `%PDF` válido y el Excel con el magic `PK` de zip, con tamaños de archivo razonables y sin errores.
