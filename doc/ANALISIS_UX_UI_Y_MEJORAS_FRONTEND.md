# Análisis Completo de Experiencia de Usuario (UX/UI) y Propuesta de Mejoras Frontend

**Proyecto:** DAMP Agro (Sistema de Monitoreo Inteligente de Hacienda e IoT)  
**Fecha:** 25 de Agosto de 2026  
**Documento:** `/doc/ANALISIS_UX_UI_Y_MEJORAS_FRONTEND.md`

---

## 1. Resumen Ejecutivo

El presente documento ofrece una evaluación integral de la interfaz de usuario (UI), la arquitectura de información y la experiencia de usuario (UX) de la aplicación **DAMP Agro**.

El objetivo central es transformar el frontend en un producto con un estándar visual y funcional premium, adaptado específicamente al contexto de uso del **productor agropecuario y personal de campo en Argentina**. Se abordan problemas clave de redundancia visual en la navegación, imprecisiones en los formularios de registro de campos, falta de normalización de datos rurales y oportunidades de mejora en el monitoreo satelital e IoT.

---

## 2. Diagnóstico de Navegación y Jerarquía Visual

### 2.1. Redundancia de Títulos entre Topbar y Contenido Principal (`PageTitle.tsx`)

#### Diagnóstico

Actualmente, el componente `Topbar.tsx` incluye el componente `PageTitle.tsx`, el cual renderiza un elemento `<h2>` en la barra superior que muestra el nombre de la sección actual (ej. _"Dashboard"_, _"Campos"_, _"Hacienda"_).  
A su vez, en el cuerpo principal de cada vista (`page.tsx`), se vuelve a renderizar un encabezado `<h1>` con el mismo título o una variación idéntica (ej. `<h1>Registrar Nuevo Campo</h1>` o `<h1>Bienvenido</h1>`).

#### Impacto en la UX

- **Saturación y Espacio Desperdiciado:** La presencia de dos títulos prominentes separados por pocos píxeles de distancia resta espacio vertical valioso y distrae la atención del usuario.
- **Inconsistencia de Contexto:** Cuando se navega a sub-páginas (como `/farms/new`), el Topbar muestra _"Campos"_ mientras la pantalla muestra _"Registrar Nuevo Campo"_, lo que genera confusión sobre la jerarquía visual.

#### Propuesta de Solución

1. **Remover el `<h2>` estático del Topbar (`Topbar.tsx`):** Eliminar el título duplicado del centro/izquierda del header.
2. **Implementar Breadcrumbs Dinámicos:** Reemplazar el título estático en la barra superior por migas de pan limpias e interactivas:
   $$\text{Inicio} \longrightarrow \text{Campos} \longrightarrow \text{Registrar Campo}$$
3. **Reutilizar la Barra Superior para Acciones Globales:** Aprovechar el espacio libre en `Topbar` para ubicar elementos funcionales de alto valor:
   - **Selector rápido de Campo Activo:** Permite al productor cambiar de establecimiento con un clic sin volver al Dashboard.
   - **Buscador Global (`Cmd + K`):** Búsqueda directa por caravana/ID de animal, collar o zona.
   - **Indicador de Conectividad / Estado Sync:** Muestra el estado del socket/API IoT en tiempo real.

---

## 3. Rediseño del Registro y Gestión de Campos (`/farms/new`)

### 3.1. Problemática de los Datos Rurales Tradicionales

El formulario de creación de campos actual consta de 4 campos de texto plano:

- **Nombre:** `<input type="text">`
- **Dirección:** `<input type="text">` (Ej. _"Ruta 205 Km 90"_)
- **Provincia:** `<input type="text">` (Ej. _"Buenos Aires"_)
- **Superficie:** `<input type="number">` (Ej. _450.5_)

#### Deficiencias Identificadas

1. **Imprecisión de Direcciones Rurales:** En el campo argentino, las direcciones no poseen numeraciones ni calles formales. Un texto como _"Ruta 205 Km 90"_ es insuficiente para ubicar el casco, las tranqueras de acceso o los lotes dentro del sistema de geolocalización.
2. **Falta de Normalización en Provincias/Localidades:** El campo de texto libre para `provincia` genera incoherencias en la base de datos (ej. usuarios que ingresan _"Bs As"_, _"Buenos Aires"_, _"buenos aires"_, _"B.A."_), lo que invalida filtros posteriores, reportes regionales y agrupamientos.
3. **Ausencia de Identificador Sanitario / Legal (RENSPA):** No se solicita el número **RENSPA** (Registro Nacional Sanitario de Productores Agropecuarios de SENASA), indispensable para la trazabilidad ganadera, emisión de Documentos de Tránsito Electrónicos (DTE) y cumplimiento regulatorio.
4. **Flujo de Redirección Abrupto:** Al completar el registro, el sistema redirige inmediatamente a `/animals/new` (alta de animal), cuando el paso lógico en un campo nuevo es delimitar primero sus **Zonas / Lotes** y vincular **Gateways / Collares**.

---

### 3.2. Innovaciones Propuestas para el Registro Agropecuario

```
+-----------------------------------------------------------------------------------+
|               PASO 1: DATOS GENERALES          PASO 2: GEOLOCALIZACIÓN Y PERÍMETRO |
|  [ Nombre del Campo ]  [ Selector Provincia ]  [ Mapa Satelital Interactivo ]      |
|  [ RENSPA (SENASA)  ]  [ Depto / Partido   ]  [ Selector Tranquera / Punto GPS ]  |
+-----------------------------------------------------------------------------------+
```

#### A. Selector Normalizado de Provincias y Departamentos/Partidos

- Reemplazar el input de texto libre de `provincia` por un **Selector Dropdown con las 23 Provincias Argentinas + CABA**.
- Agregar un selector secundario dependiente de **Departamento / Partido** (ej. _Provincia: Buenos Aires_ $\rightarrow$ _Partido: Azul / Olavarría / Trenque Lauquen_).
- **Beneficio:** Garantiza la integridad de datos para la generación de reportes oficiales y filtros de mapas.

#### B. Registro Sanitario RENSPA Obligatorio

- Incorporar el campo **RENSPA** con máscara de entrada con formato SENASA:  
  `XX.XXX.X.XXXXX/XX` (Ej: `01.001.0.00001/00`).
- **Beneficio:** Permite conectar los animales del establecimiento con sus registros sanitarios y guías de movimiento.

#### C. Geolocalización Rural Interactiva (Punto Tranquera + Coordenadas GPS)

- Reemplazar la caja de texto _"Dirección"_ por un **Selector GPS con Mapa Interactivo (Leaflet/Mapbox)**:
  - El usuario puede buscar una localidad/Ruta o hacer clic directo en el mapa satelital para fijar la **Tranquera Principal / Casco del Campo**.
  - Autocompletado automático de coordenadas (Latitud / Longitud) e indicación de acceso terrestre.
- **Beneficio:** Facilita el envío de veterinaros, proveedores de insumos y la ubicación exacta para antenas Gateway LoRaWAN.

#### D. Delimitación de Perímetro (Geometría GeoJSON / Dibujo Poligonal)

- Permitir dibujar el contorno del campo sobre la vista satelital o importar archivos `.kml` / `.geojson` generados desde Google Earth o maquinaria agrícola.
- Cálculo automático de la superficie total en hectáreas a partir del polígono dibujado.
- **Beneficio:** Elimina errores manuales en la cantidad de hectáreas y sienta las bases para el módulo de virtual fencing (cerco virtual).

#### E. Flujo Asistido por Pasos (Onboarding Wizard)

Reemplazar el formulario plano por un asistente en 3 etapas:

1. **Paso 1: Identificación y Registro Sanitario:** Nombre, RENSPA, Provincia, Partido.
2. **Paso 2: Ubicación Satelital y Lotes:** Tranquera GPS, dibujo de superficie y subdivisión básica de potreros.
3. **Paso 3: Equipamiento Inicial:** Selección/vinculación de Gateway LoRaWAN instalado en el establecimiento.

---

## 4. Análisis de Módulos y Oportunidades de Mejora Visual

### 4.1. Módulo de Hacienda (`/animals`)

| Estado Actual                                      | Propuesta de Mejora UX                                                                                                                               | Beneficio Operativo                                                      |
| :------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------- |
| Tabla plana de animales con datos en texto simple. | **Vistas Conmutables (Tabla vs. Fichas/Cards):** Vista de tarjetas con foto/silueta por raza y categoría.                                            | Identificación rápida visual del stock en tablets/teléfonos en el campo. |
| Sin diferenciación visual de alertas sanitarias.   | **Badges de Salud y Estado de Actividad:** Codificación de colores (Verde = Normal, Amarillo = Letargo/Sin mov. 2h, Rojo = Fuera de Cerco).          | Detección inmediata de animales en riesgo o enfermos.                    |
| Filtro básico.                                     | **Filtros Multifacéticos Avanzados:** Filtrar por Lote, Raza, Categoría (Vaquillona, Toro, Ternero), Estado de Batería del collar y Alertas activas. | Agilidad en el manejo de rodeos de cientos o miles de cabezas.           |

---

### 4.2. Módulo de Geolocalización y Monitoreo Satelital (`/geolocalizacion`)

#### Diagnóstico

El mapa interactivo se muestra en un contenedor de altura fija y carece de controles avanzados para el trabajo en campo.

#### Propuestas de Mejora:

1. **Modo Pantalla Completa (Full-Screen Map):** Botón para expandir el mapa al 100% del viewport, permitiendo visualizar la totalidad del establecimiento sin distracciones de navegación.
2. **Capas de Mapa Intercambiables:** Permitir alternar entre vista **Satelital** (ideal para reconocer pasturas y tajamares), **Topográfica** y **Modo Oscuro Vectorial**.
3. **Agrupamiento Inteligente (Marker Clustering):** Cuando hay decenas de animales en un mismo potrero, agrupar marcadores con contador (ej. `[ 45 ]`) para no saturar la pantalla, desplegándose al hacer zoom.
4. **Playback de Recorrido Histórico (24h):** Selector temporal para animar la línea de tiempo y ver el trayecto recorrido por un animal o rodeo durante la jornada.

---

### 4.3. Módulo de Dispositivos IoT (Collares y Gateways `/collares`, `/gateways`)

#### Diagnóstico

Los valores de batería y señal de red LoRa se expresan únicamente como texto plano o números porcentuales.

#### Propuestas de Mejora:

- **Indicador Visual de Batería:** Icono dinámico con barra de nivel (Verde $> 50\%$, Amarillo $20\%-50\%$, Rojo animado $< 20\%$).
- **Medidor de Calidad de Señal (RSSI / SNR):** Indicador visual tipo celular (1 a 4 barras) que muestre la cobertura del Gateway sobre cada collar.
- **Alerta de Dispositivo Inactivo (Heartbeat Timeout):** Distinguir claramente cuando un collar dejó de emitir telemetría (ej. _"Sin reporte hace 4 horas"_).

---

## 5. Diseño de Sistema (Design System), Accesibilidad y Conectividad Rural

### 5.1. Soporte y Adaptabilidad al Entorno Rural (Offline / Low-Connectivity)

> [!IMPORTANT]
> El trabajo ganadero se realiza habitualmente en zonas con cobertura celular nula o inestable (3G/EDGE o sin señal).

#### Recomendaciones Técnicas:

1. **Indicador de Conectividad en Topbar:** Mostrar el estado del sistema con badge interactivo:  
   🟢 _Conectado_ | 🟡 _Modo Lectura (Sin conexión)_.
2. **Persistencia Local con Service Workers (PWA):** Permitir la consulta offline de la lista de hacienda y mapas cacheados previamente cuando el usuario ingresa al campo sin señal.
3. **Sincronización en Segundo Plano:** Permitir registrar eventos médicos o notas de campo estando offline y sincronizar automáticamente con la API REST al recuperar señal.

---

### 5.2. Estados de Carga y Micro-interacciones

- **Skeleton Screens en Lugar de Spinners:** Reemplazar los loaders giratorios por esqueletos animados (_Skeleton Loaders_) con la estructura de las tablas y KPIs. Esto reduce la percepción de latencia y evita saltos de layout (_Cumulative Layout Shift - CLS_).
- **Modales de Confirmación Descriptivos:** Reemplazar `window.confirm` nativos por modales elegantes con advertencia explícita sobre acciones destructivas (ej. archivar un animal o eliminar un cerco virtual activo).

---

## 6. Matriz de Priorización de Mejoras (Impacto vs. Esfuerzo)

|  N°   | Propuesta de Mejora                                            | Impacto UX / Negocio | Esfuerzo Técnico |    Prioridad     |
| :---: | :------------------------------------------------------------- | :------------------: | :--------------: | :--------------: |
| **1** | Eliminar título duplicado en Topbar e implementar Breadcrumbs  |       **Alto**       |     **Bajo**     | 🔴 **Inmediata** |
| **2** | Normalización de Provincias con Dropdown en `/farms/new`       |       **Alto**       |     **Bajo**     | 🔴 **Inmediata** |
| **3** | Incorporación de campo RENSPA en registro de campos            |       **Alto**       |     **Bajo**     | 🔴 **Inmediata** |
| **4** | Mapa Interactivo para Selector de Tranquera / GPS              |     **Muy Alto**     |    **Medio**     |   🟡 **Alta**    |
| **5** | Vistas Conmutables (Cards/Tabla) y Badges de Salud en Hacienda |       **Alto**       |    **Medio**     |   🟡 **Alta**    |
| **6** | Indicadores visuales de batería y cobertura LoRa en Collares   |      **Medio**       |     **Bajo**     |   🟡 **Alta**    |
| **7** | Full-Screen y Clustering de Marcadores en Mapa Satelital       |     **Muy Alto**     |    **Medio**     |   🟢 **Media**   |
| **8** | Soporte PWA / Indicador de Conexión Offline para campo         |     **Muy Alto**     |     **Alto**     |   🟢 **Media**   |

---

## 7. Conclusión y Próximos Pasos

La implementación de estas mejoras elevará significativamente la usabilidad y adopción de la plataforma **DAMP Agro**, transformando formularios rígidos en herramientas adaptadas al trabajo agrícola-ganadero real.

Se recomienda iniciar con la **Fase 1 (Navegación y Normalización de Campos)**, resolviendo la duplicación del Topbar y agregando el selector de Provincias, RENSPA y coordenadas GPS en el registro de campos.
