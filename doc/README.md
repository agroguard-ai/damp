# Guía de Redacción de Documentación del Sistema DAMP

Esta carpeta contiene la documentación técnica del proyecto DAMP, organizada por Epics. Para mantener la consistencia en el repositorio, todos los miembros del equipo (Santino, Matías y Tomás) deben seguir las siguientes reglas para la creación y redacción de documentos.

---

## 1. Nomenclatura de Archivos

Cada Epic debe documentarse en su propio archivo Markdown (`.md`) dentro de esta carpeta `doc/`. La estructura de nombre de archivo estandarizada es:

`epic-[Nro_Epic]-[nombre-corto-epic]-[autor].md`

### Reglas de nomenclatura:
1. **Minúsculas**: Todo el nombre del archivo debe estar en minúsculas.
2. **Sin caracteres especiales**: No usar acentos, eñes, corchetes `[]` ni paréntesis `()`.
3. **Separadores**: Usar guiones medios `-` en lugar de espacios.
4. **Autor**: El nombre del autor al final del archivo en minúsculas (`santino`, `matias` o `tomas`).

### Ejemplos prácticos:
* Para la Epic *2 - Gestión de Animales [ABM]* desarrollada por **Santino**:
  `epic-2-gestion-animales-abm-santino.md`
* Para una Epic *3 - Alertas Automáticas* desarrollada por **Tomás**:
  `epic-3-alertas-automaticas-tomas.md`
* Para una Epic *4 - Geolocalización y Cerco Virtual* desarrollada por **Matías**:
  `epic-4-geolocalizacion-cerco-virtual-matias.md`

---

## 2. Estructura del Documento de Epic

Cada archivo de Epic debe estructurarse con las siguientes secciones:

```markdown
# Epic [Nro]: [Nombre Oficial de la Epic]

* **Autor**: [Nombre del Desarrollador]
* **Fecha de Creación**: [DD/MM/AAAA]
* **Estado**: [En Progreso / Completado]

## 1. Descripción General
Breve resumen de qué resuelve esta Epic y cuál es su objetivo dentro de la plataforma DAMP.

## 2. Historias de Usuario (US) Relacionadas
Detalle de las historias de usuario que componen la Epic.
* **US X.Y**: [Título de la US]
  * **Descripción**: Como [rol], quiero [acción] para [beneficio].
  * **Criterios de Aceptación**: [Lista de criterios]

## 3. Arquitectura y Stack Utilizado
Explicación técnica de cómo se estructuró la solución (ej. si se crearon nuevos módulos en NestJS, nuevas vistas en Next.js, cambios en el esquema de la base de datos, etc.).

## 4. Archivos Creados o Modificados
Lista de los archivos principales involucrados en la implementación de esta Epic.
* **Backend**:
  * `backend/src/...`
* **Frontend**:
  * `frontend/src/...`

## 5. Testing y Seguridad
Cómo probar los desarrollos de esta Epic y qué medidas de seguridad se implementaron (ej. validaciones de DTO, CORS, autenticación JWT, etc.).
```

---

## 3. Proceso de Actualización

1. Al iniciar una nueva Epic, el desarrollador responsable debe crear el archivo correspondiente en la carpeta `doc/` bajo la rama correspondiente.
2. A medida que se completan las Historias de Usuario, se debe ir actualizando el documento.
3. Al realizar el merge de la rama de la Epic a `main` o `develop`, el documento técnico debe estar completo y actualizado.
