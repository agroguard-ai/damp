# Epic 3: Geolocalización y Monitoreo en Vivo

* **Autor**: Antigravity
* **Fecha de Creación**: 09/07/2026
* **Estado**: Completado

## 1. Resumen de la Solución Técnica
Esta Epic provee el rastreo satelital de la hacienda en tiempo real. Utiliza las coordenadas GPS enviadas periódicamente por los collares inteligentes (vía gateway) y las dibuja sobre un mapa interactivo corporativo.

* **Backend (NestJS + Prisma)**:
  * Se creó un endpoint específico `GET /api/animals/locations` protegido por `ClerkAuthGuard`.
  * Filtra por el establecimiento seleccionado (`farmId`) y retorna la lista de animales activos que tienen un collar vinculado.
  * Cruza cada animal con su última lectura de telemetría registrada (`TelemetryReading`) ordenada cronológicamente (obteniendo latitud, longitud, temperatura y nivel de batería).
* **Frontend (Next.js 16 + React Leaflet)**:
  * Componente `LiveTrackingMap`: Carga componentes de Leaflet con SSR desactivado para evitar conflictos de renderizado en servidor.
  * Mapea los polígonos de los potreros (`Zones`) como capas de fondo verdes traslúcidas.
  * Dibuja marcadores (pins) individuales sobre el mapa para cada animal con señal GPS activa.
  * Auto-ajuste de límites (*AutoBounds*): El mapa calcula automáticamente la extensión óptima (caja contenedora) que encuadra perfectamente todos los potreros y animales del campo seleccionado.
  * Ventanas informativas (Popups): Al hacer clic en el marcador de un animal se despliega un globo informativo con la caravana/tag, raza, temperatura corporal y nivel de batería del dispositivo.
  * Mecanismo de Polling: La pantalla realiza peticiones periódicas cada 30 segundos al endpoint de ubicaciones en vivo para actualizar la posición y estado de los animales sin recargar la página.

---

## 2. Contrato de Integración y Consumo (Cómo Conectarse)

### 2.1. Consulta de Ubicaciones en Vivo (Locations)
* **Endpoint**: `GET http://localhost:3001/api/animals/locations?farmId=UUID_DEL_CAMPO`
* **Headers**: `Authorization: Bearer <CLERK_JWT_TOKEN>`
* **Respuesta Exitosa (200 OK - JSON Array)**:
  ```json
  [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "tag": "Hereford 452",
      "breed": "Hereford",
      "weightKg": 480.0,
      "status": "ACTIVE",
      "animalType": {
        "id": "UUID_TIPO",
        "name": "Hereford",
        "species": "Bovino"
      },
      "zone": {
        "id": "UUID_ZONA",
        "name": "Potrero Norte"
      },
      "collar": {
        "id": "UUID_COLLAR",
        "serialNumber": "00:1B:44:11:3A:B7",
        "status": "ACTIVE"
      },
      "latestReading": {
        "id": "UUID_LECTURA",
        "latitude": -34.6037,
        "longitude": -58.3816,
        "temperature": 38.6,
        "batteryLevel: 92.5,
        "timestamp": "2026-07-09T14:00:00.000Z"
      }
    }
  ]
  ```

---

## 3. Mapa del Código (Dónde buscar)

### Backend
* **Servicio y Consulta**: [animals.service.ts](file:///c:/Users/catal/Desktop/Repos/damp/backend/src/animals/animals.service.ts)
* **Endpoint Explicito**: [animals.controller.ts](file:///c:/Users/catal/Desktop/Repos/damp/backend/src/animals/animals.controller.ts)

### Frontend
* **Página Principal de Monitoreo**: [geolocalizacion/page.tsx](file:///c:/Users/catal/Desktop/Repos/damp/frontend/src/app/geolocalizacion/page.tsx)
* **Componente de Mapa Leaflet**: [components/LiveTrackingMap.tsx](file:///c:/Users/catal/Desktop/Repos/damp/frontend/src/components/LiveTrackingMap.tsx)
* **Iconos y Estilos**: Importa hojas de estilo estándar de `leaflet/dist/leaflet.css`.

---

## 4. Instrucciones de Prueba Rápida y Simulación
1. Asigna un collar con MAC Address a un animal desde la sección de **Hacienda** e inicia el simulador en consola (por ejemplo, `node scripts/iot_simulator.js 00:1B:44:11:3A:B7`).
2. Dirígete en el navegador a `http://localhost:3000/geolocalizacion`.
3. Verás cómo el mapa carga el perímetro de los potreros de tu establecimiento y centra automáticamente el zoom en ellos.
4. Aparecerá un pin marcador en la posición del animal simulado. Al pulsar sobre el pin, verás un popup con sus lecturas biométricas reales de temperatura y nivel de batería.
5. Si dejas la pestaña abierta, notarás que cada 30 segundos el marcador del animal se desplaza ligeramente siguiendo la deriva o random-walk producida por el simulador.
