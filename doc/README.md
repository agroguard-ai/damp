# Guía de Redacción de Documentación del Sistema DAMP

Esta carpeta contiene la documentación técnica del proyecto DAMP, organizada por Epics. 

El objetivo principal de estos archivos **no es duplicar la información de Taiga** (las descripciones de las Epics y User Stories ya viven allí). Su propósito es **documentar qué y cómo se resolvió técnicamente la Epic**, dejando asentado el contrato de integración y las instrucciones claras de cómo conectarse o consumir esta parte del sistema. Esto facilita que tanto tus compañeros de equipo como cualquier IA asistente puedan entender el trabajo realizado y acoplarse a él de manera rápida sin tener que inspeccionar todo el código fuente.

---

## 1. Nomenclatura de Archivos

Cada Epic debe documentarse en su propio archivo Markdown (`.md`) dentro de esta carpeta `doc/`. La estructura de nombre de archivo estandarizada es:

`epic-[Nro_Epic]-[nombre-corto-epic]-[autor].md`

### Reglas de nomenclatura:
1. **Minúsculas**: Todo el nombre del archivo debe estar en minúsculas.
2. **Sin caracteres especiales**: No usar acentos, eñes, corchetes `[]` ni paréntesis `()`.
3. **Separadores**: Usar guiones medios `-` en lugar de espacios.
4. **Autor**: El nombre del desarrollador que la resolvió al final (`santino`, `matias` o `tomas`).

### Ejemplos prácticos:
* `epic-2-gestion-animales-abm-santino.md`
* `epic-3-alertas-automaticas-tomas.md`

---

## 2. Estructura del Documento de Epic

Cada archivo de Epic debe estructurarse obligatoriamente bajo las siguientes secciones técnicas:

```markdown
# Epic [Nro]: [Nombre de la Epic]

* **Autor**: [Nombre del Desarrollador]
* **Fecha de Finalización**: [DD/MM/AAAA]

## 1. Resumen de la Solución Técnica
Explicación concisa del enfoque técnico elegido para resolver esta Epic. Qué patrones se usaron y qué cambios estructurales se hicieron en la base de datos (Prisma), Backend (NestJS) y Frontend (Next.js).

## 2. Contrato de Integración y Consumo (Cómo Conectarse)
*Sección crítica para el equipo.* Detallar cómo interactuar con esta parte del sistema.
* **Endpoints / API**: 
  * `POST /animals` - Registra un animal y le vincula un collar.
    * **Request Body (JSON)**:
      ```json
      {
        "farmId": "string (UUID)",
        "tag": "string (opcional)",
        "breed": "string",
        "weightKg": "number",
        "ageMonths": "number",
        "collarMacAddress": "string (opcional)"
      }
      ```
    * **Response (JSON)**:
      ```json
      {
        "message": "Animal creado exitosamente",
        "animal": { "id": "uuid", "farmId": "uuid", ... },
        "collarLinked": true
      }
      ```
* **Eventos / Sockets (si aplica)**: Describir qué eventos emite o escucha.
* **Relaciones en Base de Datos**: Cómo impacta en otras tablas y qué campos usar como llave foránea.

## 3. Mapa del Código (Dónde buscar)
Rutas de los archivos clave creados o modificados para facilitar la navegación rápida en el código:
* **Modelos DB**: `backend/prisma/schema.prisma` (Tablas: `Animal`, `Collar`, `AnimalCollar`)
* **Controlador Backend**: `backend/src/animals/animals.controller.ts`
* **Lógica / Servicios**: `backend/src/animals/animals.service.ts`
* **Componentes Frontend / Páginas**: `frontend/src/app/animals/new/page.tsx`

## 4. Instrucciones de Prueba Rápida
Comandos, payloads de prueba o pasos mínimos en la UI para verificar que el módulo funciona.
```

---

## 3. Proceso de Actualización

1. Al iniciar una nueva Epic, el desarrollador responsable debe crear el archivo correspondiente en la carpeta `doc/` bajo la rama correspondiente.
2. A medida que se completan las Historias de Usuario, se debe ir actualizando el documento.
3. Al realizar el merge de la rama de la Epic a `main` o `develop`, el documento técnico debe estar completo y actualizado.
