# **Especificación de Casos de Uso de Negocio — Proyecto DAMP**

**Desglose Jerárquico en Casos de Uso Resumen y Casos de Uso Usuario con Definición de Roles y Control de Estados de las Entidades de Negocio**

*Versión: 3.0 — Especificación Funcional Orientada al Negocio \| Fecha: Octubre 2026 \| Alcance: 18 Casos de Uso Resumen (CUR-001 a CUR-018) y 100 Casos de Uso Usuario (CUU-001 a CUU-100) — Total: 118 especificaciones orientadas al negocio con control de estados de entidades.*

## **1\. Definición de Roles de Negocio y Actores del Sistema**

En el negocio de DAMP participan cuatro roles de personas (Superadministrador, Administrador de Campo, Empleado Operador y Empleado Observador) y tres actores de campo/sistema. La siguiente tabla define el alcance y las responsabilidades de negocio de cada uno:

| Rol de Negocio / Actor | Categoría | Alcance en el Negocio | Responsabilidades y Permisos de Negocio |
| :---- | :---- | :---- | :---- |
| **Superadministrador** | Rol Humano — Administración General de la Plataforma | Toda la plataforma DAMP (nivel global y modo asistencia sobre campos de clientes) | Es el administrador comercial y operativo de la plataforma DAMP. Da de alta y administra las cuentas de los clientes (Administradores de Campo), define y modifica la cantidad máxima de collares contratados (cupo) de cada cliente, suspende o reactiva cuentas de usuarios, administra el catálogo global de Tipos de Animal, gestiona el Stock Central de collares y antenas receptoras (asignándolos o retirándolos de los campos de los clientes), audita el historial de comunicaciones de los dispositivos y puede operar en modo emulación/soporte asumiendo temporalmente el lugar de un Administrador de Campo para asistirlo. |
| **Administrador de Campo (Productor / Titular)** | Rol Humano — Cliente Titular de Establecimientos | Todos los campos/establecimientos de su propiedad y el personal a su cargo | Es el productor agropecuario o cliente que contrata el servicio. Puede crear nuevos campos, delimitar su perímetro geográfico en el mapa, editar sus datos o darlos de baja. Es el único habilitado dentro de su organización para dar de alta, editar, blanquear contraseñas, reincorporar o dar de baja a sus Empleados (asignándoles el rol de Empleado Operador o Empleado Observador en cada campo), así como para configurar los umbrales de alertas sanitarias de sus establecimientos. Además, posee permisos plenos para realizar todas las tareas operativas y de consulta en sus campos. |
| **Empleado Operador (Operador de Campo / Capataz / Veterinario Operativo)** | Rol Humano — Personal Operativo de Establecimiento | Exclusivamente los campos que su Administrador de Campo le haya asignado | Es el trabajador de campo o profesional encargado de la operación diaria en los establecimientos asignados por su empleador. Está habilitado para: dar de alta, editar y dar de baja animales (por venta o defunción); vincular y desvincular collares disponibles del campo a los animales; cambiar el estado operativo de un collar (Disponible / Fuera de servicio); registrar eventos médicos y pesajes; crear, editar, activar y desactivar zonas y cercos virtuales; asignar, desasignar y trasladar animales entre zonas o entre campos autorizados; crear y controlar planes de rotación de pastoreo; marcar alertas como resueltas; reportar falsos positivos de alertas y descargar reportes. No puede crear ni eliminar campos, ni gestionar empleados, ni alterar los umbrales de alerta. |
| **Empleado Observador (Visualizador / Asesor / Auditor)** | Rol Humano — Personal de Consulta de Establecimiento | Solo lectura sobre los campos que su Administrador de Campo le haya asignado | Es un integrante del equipo, asesor veterinario externo o auditor que requiere supervisar la información del establecimiento sin realizar cambios. Puede visualizar el tablero de indicadores, el mapa de ubicación en tiempo real del ganado, los recorridos históricos, los mapas de calor de pastoreo, el listado y ficha completa de los animales, el historial clínico, el estado de los collares y antenas receptoras, los planes de rotación, el centro de notificaciones, las predicciones de salud y descargar todos los reportes en PDF y Excel. No puede crear, modificar ni eliminar ningún registro. |
| **Dispositivo de Campo (Collar Inteligente y Antena Receptora / Gateway)** | Actor de Negocio Externo — Equipamiento de Monitoreo en Campo | El campo al cual se encuentra asignada la antena receptora y los collares del rodeo | El collar colocado en el animal mide periódicamente su ubicación geográfica, temperatura corporal, nivel de actividad física y carga de batería, enviando estos datos por radiofrecuencia a la Antena Receptora (Gateway) instalada en el campo. La antena transmite la lectura al sistema y recibe como respuesta los límites actualizados del cerco virtual para que el collar los aplique sobre el animal. |
| **Motor Predictivo de Salud (Inteligencia Artificial)** | Actor del Sistema — Análisis Preventivo Sanitario y Reproductivo | Evaluación continua sobre los animales con collar activo | Analiza el comportamiento térmico y de actividad física acumulado durante las últimas 24 horas de cada animal para detectar de forma anticipada patrones compatibles con Fiebre, Celo, Inactividad anormal o Anomalías generales de salud, calculando porcentajes de probabilidad para las próximas 6 a 48 horas. |
| **Planificador Automático de Rotación** | Actor del Sistema — Automatización de Pastoreo Rotativo | Campos con planes de rotación de perímetros activos | Supervisa el reloj de los planes de rotación de pastoreo en curso, desplaza gradualmente los límites del cerco virtual cada 5 minutos para guiar al ganado sin estrés hacia la siguiente parcela y ejecuta automáticamente el cambio de etapa o la finalización del ciclo al cumplirse los tiempos programados. |

## **2\. Entidades de Negocio y Control de Estados**

La siguiente tabla detalla las 17 entidades de negocio del sistema, los estados en los que puede encontrarse cada una y las reglas de negocio que gobiernan cómo el cambio de estado de una entidad impacta sobre las demás.

| Entidad de Negocio | Atributos Principales | Estados Posibles en el Negocio | Reglas de Negocio e Impacto entre Entidades |
| :---- | :---- | :---- | :---- |
| **Usuario (Cuenta de Persona)** | Nombre, Correo electrónico, Rol de Negocio, Estado de Cuenta, Estado de Contraseña, Cupo de Collares Contratados | **• Activa con Cambio de Contraseña Pendiente:** Cuenta recién creada o blanqueada; el usuario puede autenticarse pero debe definir su contraseña personal antes de operar. **• Activa y Operativa:** Cuenta habilitada con acceso normal según su rol de negocio. **• Suspendida / Dada de Baja:** Cuenta deshabilitada para ingresar al sistema, conservando su historial. | Si se suspende la cuenta de un Administrador de Campo, queda suspendido automáticamente el acceso operativo a todos sus campos tanto para él como para todos sus Empleados dependientes, sin perder ningún dato. El cupo de collares contratados de un Administrador de Campo nunca puede fijarse en un número menor a la cantidad de collares que ya tiene asignados en sus campos. |
| **Asignación de Empleado a Campo (Membresía de Personal)** | Empleado, Campo, Rol en el Campo (Empleado Operador o Empleado Observador), Fecha de Alta, Fecha de Baja, Estado | **• Asignación Activa:** El empleado tiene acceso vigente a ese campo con el rol asignado (Operador u Observador). **• Asignación Revocada / Inactiva:** El empleado fue desvinculado de ese campo (o dado de baja), registrándose la fecha de revocación pero conservando el antecedente histórico. **• Asignación Revocada / Inactiva:** El empleado fue desvinculado de esa granja (o dado de baja), registrándose la fecha de revocación pero conservando el antecedente histórico. | Un Empleado pertenece exclusivamente al plantel de un único Administrador de Campo. Si un ex-empleado dado de baja vuelve a ser contratado por el mismo Administrador de Campo, su cuenta y sus asignaciones seleccionadas se reactivan. |
| **Campo (Establecimiento Agropecuario)** | Nombre, Provincia, Localidad/Departamento, Dirección, Perímetro Geográfico, Superficie en Hectáreas, Administrador Propietario, Estado | **• Activo sin Perímetro Delimitado:** Campo operativo registrado únicamente con sus datos de ubicación. **• Activo con Perímetro Delimitado:** Campo operativo con su polígono límite trazado en el mapa y su superficie en hectáreas calculada. **• Dado de Baja / Archivado:** Campo cerrado lógicamente; ya no opera pero conserva los antecedentes históricos de los animales que tuvo. **• Activa con Perímetro Delimitado:** Granja operativa con su polígono límite trazado en el mapa y su superficie en hectáreas calculada. **• Dada de Baja / Archivada:** Granja cerrada lógicamente; ya no opera pero conserva los antecedentes históricos de los animales que tuvo. | Al dar de baja un Campo se ejecuta una liberación completa en cascada: 1\) Todos sus animales pasan a estado Archivado y se cierran sus vínculos con collares y cercos; 2\) Todos los collares asignados a ese campo se liberan y regresan al Stock Central (liberando el cupo del Administrador de Campo); 3\) Sus zonas/cercos virtuales se eliminan; 4\) Las asignaciones de personal sobre ese campo pasan a Inactivas. |
| **Zona / Cerco Virtual (Potrero)** | Nombre, Campo, Tipo de Pastura, Polígono de Coordenadas, Superficie, Fecha de Activación, Fecha de Desactivación, Estado | **• Activo (Sin animales asignados):** El cerco está encendido y delimitado dentro del campo, disponible para recibir ganado. **• Activo (Con animales contenidos):** El cerco está encendido y vigila activamente que los animales asignados no salgan de sus límites. **• Desactivado / Inactivo:** El cerco está apagado; conserva su dibujo y nombre para uso futuro pero no retiene animales. **• Eliminado:** Borrado únicamente cuando se da de baja el campo al que pertenece. **• Activo (Con animales contenidos):** El cerco está encendido y vigila activamente que los animales asignados no salgan de sus límites. **• Desactivado / Inactivo:** El cerco está apagado; conserva su dibujo y nombre para uso futuro pero no retiene animales. **• Eliminado:** Borrado únicamente cuando se da de baja la granja a la que pertenece. | El dibujo de toda Zona / Cerco Virtual debe estar 100% contenido dentro del perímetro del Campo. Tampoco se permite achicar el perímetro del Campo si ello dejara afuera a algún cerco activo. Al desactivar un cerco, todos los animales que estaban adentro quedan automáticamente desvinculados del cerco y sus collares quedan con sincronización pendiente para apagar la frontera. |
| **Asignación de Animal a Zona / Cerco Virtual** | Animal, Zona/Cerco Virtual, Fecha/Hora de Inicio, Fecha/Hora de Fin, Estado | **• Vigente / Activa (Sin fecha de fin):** El animal se encuentra actualmente asignado a esa zona/cerco virtual. **• Finalizada / Histórica (Con fecha de fin):** El animal dejó de pertenecer a esa zona/cerco, quedando el registro como historial de pastoreo. | Regla de negocio estricta: 1\) Un animal solo puede estar asignado a UNA única Zona/Cerco Virtual activo a la vez (asignarlo a uno nuevo finaliza automáticamente su asignación anterior); 2\) Un animal SOLO puede ser asignado a un cerco virtual si tiene un Collar Inteligente vinculado y activo. Si se le retira el collar al animal, su asignación al cerco virtual se finaliza automáticamente en ese mismo instante. |
| **Tipo de Animal (Categoría del Catálogo Global)** | Nombre de la Categoría, Especie, Descripción, Estado | **• Activo:** Disponible para ser elegido al registrar o editar animales en cualquier campo. **• Dado de Baja / Inactivo:** Oculto para nuevas asignaciones, pero preservado en las fichas de los animales actuales o históricos que ya tenían esa categoría. **• Dado de Baja / Inactivo:** Oculto para nuevas asignaciones, pero preservado en las fichas de los animales actuales o históricos que ya tenían esa categoría. | Solo el Superadministrador gestiona este catálogo. Nunca se borra un Tipo de Animal de forma destructiva para no dejar animales sin categoría; si se vuelve a crear un tipo con el nombre de uno dado de baja, el sistema lo reactiva automáticamente. |
| **Animal (Cabeza de Ganado)** | Caravana (Identificador único en el campo), Nombre, Campo, Tipo de Animal, Raza, Sexo, Edad (meses), Peso actual (kg), Estado Reproductivo, Estado de Ciclo de Vida | **• Activo en el Rodeo (Sin Collar):** Animal presente en el campo, sin dispositivo de rastreo colocado ni cerco virtual. **• Activo en el Rodeo (Con Collar y Sin Cerco):** Animal monitoreado por un collar activo, desplazándose libremente sin cerco virtual asignado. **• Activo en el Rodeo (Con Collar y Contenido en Cerco):** Animal monitoreado por un collar activo y contenido dentro de una zona/cerco virtual activo. **• Dado de Baja por Venta (Archivado):** Animal retirado del rodeo activo por haber sido vendido. **• Dado de Baja por Defunción (Archivado):** Animal retirado del rodeo activo por fallecimiento. **• Activo en el Rodeo (Con Collar y Sin Cerco):** Animal monitoreado por un collar activo, desplazándose libremente sin cerco virtual asignado. **• Activo en el Rodeo (Con Collar y Contenido en Cerco):** Animal monitoreado por un collar activo y contenido dentro de una zona/cerco virtual activo. **• Dado de Baja por Venta (Archivado):** Animal retirado del rodeo activo por haber sido vendido. **• Dado de Baja por Defunción (Archivado):** Animal retirado del rodeo activo por fallecimiento. | Cuando un Animal pasa a Dado de Baja (por Venta o por Defunción): 1\) Su vínculo con el collar se cierra automáticamente (el collar queda Libre/Disponible en el campo para otro animal); 2\) Su asignación a zona/cerco virtual se cierra automáticamente; 3\) Se registra el evento de baja en su historial médico; 4\) El animal queda archivado conservando toda su historia clínica y biométrica. |
| **Registro Médico (Evento del Historial Clínico)** | Animal, Tipo de Evento (Vacunación, Tratamiento, Cirugía, Parto, Pesaje o Evento de Ciclo de Vida), Fecha, Descripción, Valor numérico | **• Registrado en Historial Clínico:** Asiento permanente en la ficha sanitaria del animal. | Vinculación automática con el peso del animal: cada vez que se registra un evento médico de tipo Pesaje con un valor en kilos, se actualiza automáticamente el Peso Actual en la ficha del animal; inversamente, si se modifica el Peso Actual al editar la ficha del animal, el sistema crea automáticamente un evento médico de Pesaje dejando constancia del cambio. |
| **Collar Inteligente** | Número de Dispositivo, Código Identificador (Etiqueta/QR), Campo Asignado, Estado Operativo, Nivel de Batería, Fecha de Última Señal, Estado de Sincronización de Cerco | **• En Stock Central (Libre):** Registrado en la plataforma bajo control del Superadministrador, sin campo ni cliente asignado. **• Disponible en Campo (Libre en Establecimiento):** Asignado a un campo de un cliente (ocupando 1 lugar de su cupo contratado), en buen estado operativo y libre para colocarse en un animal. **• Vinculado a Animal (En Uso):** Asignado a un campo y colocado activamente sobre un animal del rodeo. **• Fuera de Servicio:** En reparación, mantenimiento o sin batería; no puede vincularse a ningún animal. **• Dado de Baja / Archivado:** Retirado de operación pero mantenido en el sistema porque posee historial de lecturas o de animales que lo usaron. Libera al animal y devuelve el cupo al cliente. **• Eliminado Definitivamente:** Borrado por completo (solo permitido si el collar jamás fue vinculado a un animal ni registró lecturas). **• Disponible en Granja (Libre en Establecimiento):** Asignado a una granja de un cliente (ocupando 1 lugar de su cupo contratado), en buen estado operativo y libre para colocarse en un animal. **• Vinculado a Animal (En Uso):** Asignado a una granja y colocado activamente sobre un animal del rodeo. **• Fuera de Servicio:** En reparación, mantenimiento o sin batería; no puede vincularse a ningún animal. **• Dado de Baja / Archivado:** Retirado de operación pero mantenido en el sistema porque posee historial de lecturas o de animales que lo usaron. Libera al animal y devuelve el cupo al cliente. **• Eliminado Definitivamente:** Borrado por completo (solo permitido si el collar jamás fue vinculado a un animal ni registró lecturas). | 1\) Cambiar un collar a Fuera de Servicio, trasladarlo a otro campo, devolverlo al Stock Central o Archivarlo desvincula automáticamente al animal que lo tuviera puesto (y cierra el cerco virtual de ese animal). 2\) Respecto al cerco virtual, el collar alterna entre Estado "Sincronización Pendiente" (cuando cambian los límites de su cerco) y "Sincronizado" (cuando recibe los nuevos límites en su comunicación con la antena). |
| **Vínculo Animal–Collar (Historial de Uso del Collar)** | Animal, Collar, Fecha/Hora de Colocación, Fecha/Hora de Retiro, Estado | **• Vínculo Activo / Vigente:** El collar está colocado actualmente en ese animal. **• Vínculo Finalizado / Histórico:** El collar fue retirado del animal en una fecha y hora determinadas. | Un animal activo solo puede tener un único collar colocado a la vez, y un collar solo puede estar colocado en un único animal a la vez. Al desvincular un collar nunca se borra el registro: se cierra con fecha de fin para que todas las lecturas tomadas durante ese lapso sigan perteneciendo históricamente a ese animal. |
| **Lectura Biométrica y de Ubicación (Telemetría)** | Collar, Animal Portador en ese instante, Fecha y Hora, Latitud, Longitud, Temperatura Corporal, Nivel de Actividad, Nivel de Batería | **• Registrada y Validada:** Almacenada en el historial del collar y atribuida al animal que portaba el collar en ese momento. | Solo se aceptan lecturas provenientes de una Antena Receptora válida y correspondientes a collares que pertenezcan al mismo campo que dicha antena. |
| **Plan de Rotación de Perímetros y sus Etapas** | Nombre del Plan, Campo, Secuencia de Zonas/Cercos (Etapas), Frecuencia en Horas, Modo Automático/Manual, Próxima Rotación, Estado del Plan y Estado de cada Etapa | **• Plan Activo (En Curso):** Ejecutando la rotación; la etapa actual está Activa (con su cerco encendido y los animales asignados a él), las etapas anteriores están Completadas y las siguientes están Pendientes. **• Plan Pausado:** El cronómetro de avance y la transición progresiva se encuentran detenidos temporalmente. **• Plan Completado:** Todas las etapas del ciclo finalizaron exitosamente; el ganado permanece en la última zona. **• Plan Cancelado:** El ciclo fue interrumpido antes de terminar (manualmente o por el inicio de un nuevo plan). | Solo puede haber un Plan de Rotación Activo por campo (iniciar uno nuevo cancela automáticamente el anterior). Mientras el plan está Activo y tiene una etapa siguiente, los límites del cerco virtual se desplazan gradualmente cada 5 minutos entre la zona actual y la próxima. |
| **Antena Receptora (Gateway)** | Nombre, Campo Asignado, Clave de Acceso del Dispositivo, Fecha de Última Comunicación, Intensidad de Señal, Estado de Conexión | • En Stock Central / Asignada a Campo (según tenencia). **• Sin Datos Iniciales:** Antena registrada que aún no ha enviado ninguna transmisión. **• En Línea:** Antena activa que se comunicó dentro de los últimos 15 minutos. **• Fuera de Línea (Desconectada):** Antena que lleva más de 15 minutos sin comunicarse con el sistema. **• Eliminada:** Retirada definitivamente del inventario, quedando su clave de acceso anulada. **• Sin Datos Iniciales:** Antena registrada que aún no ha enviado ninguna transmisión. **• En Línea:** Antena activa que se comunicó dentro de los últimos 15 minutos. **• Fuera de Línea (Desconectada):** Antena que lleva más de 15 minutos sin comunicarse con el sistema. **• Eliminada:** Retirada definitivamente del inventario, quedando su clave de acceso anulada. | Cada vez que una antena transmite datos válidos al sistema, su estado pasa a En Línea y se actualizan su fecha de última vista y calidad de señal. |
| **Registro de Auditoría de Comunicaciones de Dispositivos** | Fecha y Hora, Antena Receptora, Collar, Campo, Resultado de la Comunicación, Motivo de Rechazo (si aplica) | **• Comunicación Exitosa:** La lectura fue validada y guardada. **• Rechazada por Credencial Inválida:** La antena no presentó una clave de acceso válida. **• Rechazada por Collar Ajeno al Campo:** La antena captó la señal de un collar que pertenece a otro establecimiento o al Stock Central. **• Rechazada por Collar Inexistente o Datos Inválidos:** El número de collar no existe o los datos están incompletos. | Permite al Superadministrador auditar el funcionamiento de las antenas y collares en campo y puede ser depurado (vaciado) cuando se requiera limpiar el historial. |
| **Predicción de Salud (Evaluación Preventiva de IA)** | Animal, Collar, Evento Evaluado (Fiebre, Celo, Inactividad, Anomalía), Probabilidad (%), Umbral de Disparo (%), Ventana de 24h Analizada, Resultado | **• Anomalía Detectada (Sobre el Umbral):** La probabilidad calculada superó el límite de riesgo, quedando vinculada a una Alerta Preventiva. **• En Seguimiento / Normal (Bajo el Umbral):** La probabilidad no superó el límite de alerta, pero queda registrada para graficar la curva de evolución del animal. | Se evalúan los 4 eventos de salud sobre ventanas móviles de 24 horas (divididas en 48 bloques de 30 minutos) y se conserva la trazabilidad exacta de los datos que originaron el cálculo. |
| **Alerta (Notificación del Sistema)** | Animal, Campo, Tipo (Escape de Cerco, Salud por Umbral de Sensor, Salud Predictiva por IA, Sistema), Mensaje, Fecha de Disparo, Estado de Resolución, Evaluación de Falso Positivo, Nota del Operario | **• Activa / Pendiente de Atención:** La alerta fue disparada y requiere revisión en el campo. **• Resuelta / Atendida (Confirmada):** Un Administrador de Campo o Empleado Operador verificó la situación y la dio por atendida. **• Descartada como Falso Positivo:** Un Administrador de Campo o Empleado Operador determinó en campo que la alerta no correspondía a un problema real, quedando simultáneamente Resuelta y marcada como Falso Positivo junto con su nota explicativa. | Para evitar saturar al personal con avisos repetidos: 1\) No se genera una nueva alerta de Escape para un animal si ya tiene una alerta de Escape Activa sin resolver; 2\) No se genera una nueva alerta de Salud para el mismo evento si ya se disparó una en las últimas 6 horas para ese animal. |
| **Configuración de Umbrales de Alerta del Campo** | Campo, Umbral de Fiebre (°C), Umbral de Hipotermia (°C), Tiempo Máximo de Inactividad (minutos), Avisos por Correo Electrónico | **• Configuración por Defecto (Fiebre:** 39,5 °C, Hipotermia: 37,0 °C, Inactividad: 120 min, Correos desactivados). • Configuración Personalizada por el Administrador de Campo. | El umbral de hipotermia siempre debe ser estrictamente menor que el umbral de fiebre. |

## **3\. Matriz General de Casos de Uso y Roles Actuantes (18 Resumen y 100 Usuario)**

| CUR Padre | Módulo Resumen | Código CUU | Nombre del Caso de Uso Usuario | Roles de Negocio que Actúan |
| :---- | :---- | :---- | :---- | :---- |
| **CUR-001 (CU001)** | Autenticación, Control de Acceso y Asistencia a Clientes | **CUU-001** | Iniciar sesión en la plataforma con correo electrónico y contraseña | **Superadministrador, Administrador de Campo, Empleado Operador, Empleado Observador** |
| **CUR-001 (CU001)** | Autenticación, Control de Acceso y Asistencia a Clientes | **CUU-002** | Definir nueva contraseña obligatoria en el primer ingreso o luego de un blanqueo | **Superadministrador, Administrador de Campo, Empleado Operador, Empleado Observador** |
| **CUR-001 (CU001)** | Autenticación, Control de Acceso y Asistencia a Clientes | **CUU-003** | Cambiar voluntariamente la contraseña de la cuenta | **Superadministrador, Administrador de Campo, Empleado Operador, Empleado Observador** |
| **CUR-001 (CU001)** | Autenticación, Control de Acceso y Asistencia a Clientes | **CUU-004** | Bloquear automáticamente el acceso operativo ante suspensión del usuario o del Administrador de Campo empleador | **Administrador de Campo, Empleado Operador, Empleado Observador** |
| **CUR-001 (CU001)** | Autenticación, Control de Acceso y Asistencia a Clientes | **CUU-005** | Operar en nombre de un Administrador de Campo (Modo Asistencia / Emulación) | **Superadministrador** |
| **CUR-001 (CU001)** | Autenticación, Control de Acceso y Asistencia a Clientes | **CUU-006** | Finalizar el modo de asistencia o cerrar la sesión en el sistema | **Superadministrador (para finalizar asistencia), Todos los Roles (para cerrar sesión)** |
| **CUR-002 (CU002)** | Administración Global de Clientes, Usuarios y Cupos de Collares | **CUU-007** | Consultar el padrón global de usuarios y el consumo de cupo de collares de cada cliente | **Superadministrador** |
| **CUR-002 (CU002)** | Administración Global de Clientes, Usuarios y Cupos de Collares | **CUU-008** | Dar de alta un nuevo Administrador de Campo (Cliente) o usuario con contraseña temporal | **Superadministrador** |
| **CUR-002 (CU002)** | Administración Global de Clientes, Usuarios y Cupos de Collares | **CUU-009** | Modificar el rol de negocio de un usuario registrado | **Superadministrador** |
| **CUR-002 (CU002)** | Administración Global de Clientes, Usuarios y Cupos de Collares | **CUU-010** | Configurar o modificar el cupo máximo de collares contratados de un Administrador de Campo | **Superadministrador** |
| **CUR-002 (CU002)** | Administración Global de Clientes, Usuarios y Cupos de Collares | **CUU-011** | Suspender (dar de baja lógica) la cuenta de un usuario con suspensión en cascada de sus campos | **Superadministrador** |
| **CUR-002 (CU002)** | Administración Global de Clientes, Usuarios y Cupos de Collares | **CUU-012** | Reactivar una cuenta de usuario previamente suspendida | **Superadministrador** |
| **CUR-002 (CU002)** | Administración Global de Clientes, Usuarios y Cupos de Collares | **CUU-013** | Supervisar el listado global de todos los campos registrados en la plataforma | **Superadministrador** |
| **CUR-003 (CU003)** | Gestión de Campos | **CUU-014** | Consultar, buscar y seleccionar el campo activo de trabajo | **Administrador de Campo, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **CUR-003 (CU003)** | Gestión de Campos | **CUU-015** | Registrar un nuevo campo con datos de ubicación y trazado opcional de su perímetro geográfico | **Administrador de Campo, Superadministrador (en modo asistencia)** |
| **CUR-003 (CU003)** | Gestión de Campos | **CUU-016** | Editar los datos generales de un campo (nombre, provincia, departamento, dirección) | **Administrador de Campo, Superadministrador (en modo asistencia)** |
| **CUR-003 (CU003)** | Gestión de Campos | **CUU-017** | Delimitar o modificar el perímetro geográfico del campo validando que los cercos activos queden contenidos | **Administrador de Campo, Superadministrador (en modo asistencia)** |
| **CUR-003 (CU003)** | Gestión de Campos | **CUU-018** | Dar de baja lógica (archivar) un campo con liberación automática de collares, archivo de animales y baja de cercos | **Administrador de Campo, Superadministrador (en modo asistencia)** |
| **CUR-004 (CU004 y CU011)** | Gestión de Zonas de Pastoreo y Cercos Virtuales | **CUU-019** | Consultar el listado y el mapa general de zonas y cercos virtuales de un campo | **Administrador de Campo, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **CUR-004 (CU004 y CU011)** | Gestión de Zonas de Pastoreo y Cercos Virtuales | **CUU-020** | Crear una nueva zona / cerco virtual con tipo de pastura, polígono validado y asignación opcional de animales | **Administrador de Campo, Empleado Operador, Superadministrador (en modo asistencia)** |
| **CUR-004 (CU004 y CU011)** | Gestión de Zonas de Pastoreo y Cercos Virtuales | **CUU-021** | Editar el nombre, tipo de pastura o polígono de una zona / cerco virtual con aviso a los collares | **Administrador de Campo, Empleado Operador, Superadministrador (en modo asistencia)** |
| **CUR-004 (CU004 y CU011)** | Gestión de Zonas de Pastoreo y Cercos Virtuales | **CUU-022** | Desactivar una zona / cerco virtual liberando automáticamente a los animales contenidos | **Administrador de Campo, Empleado Operador, Superadministrador (en modo asistencia)** |
| **CUR-004 (CU004 y CU011)** | Gestión de Zonas de Pastoreo y Cercos Virtuales | **CUU-023** | Reactivar una zona / cerco virtual previamente desactivado | **Administrador de Campo, Empleado Operador, Superadministrador (en modo asistencia)** |
| **CUR-005 (CU005)** | Asignación y Movimiento de Animales entre Zonas/Cercos y entre Campos | **CUU-024** | Asignar individualmente un animal con collar activo a una zona / cerco virtual | **Administrador de Campo, Empleado Operador, Superadministrador (en modo asistencia)** |
| **CUR-005 (CU005)** | Asignación y Movimiento de Animales entre Zonas/Cercos y entre Campos | **CUU-025** | Desvincular individualmente a un animal de su zona / cerco virtual actual | **Administrador de Campo, Empleado Operador, Superadministrador (en modo asistencia)** |
| **CUR-005 (CU005)** | Asignación y Movimiento de Animales entre Zonas/Cercos y entre Campos | **CUU-026** | Asignar masivamente un lote de animales a una zona / cerco virtual | **Administrador de Campo, Empleado Operador, Superadministrador (en modo asistencia)** |
| **CUR-005 (CU005)** | Asignación y Movimiento de Animales entre Zonas/Cercos y entre Campos | **CUU-027** | Desvincular masivamente un lote de animales de su zona / cerco virtual | **Administrador de Campo, Empleado Operador, Superadministrador (en modo asistencia)** |
| **CUR-005 (CU005)** | Asignación y Movimiento de Animales entre Zonas/Cercos y entre Campos | **CUU-028** | Trasladar masivamente un lote de animales y sus collares vinculados hacia otro campo | **Administrador de Campo, Empleado Operador (con rol de Operador en ambos campos), Superadministrador (en modo asistencia)** |
| **CUR-005 (CU005)** | Asignación y Movimiento de Animales entre Zonas/Cercos y entre Campos | **CUU-029** | Consultar y filtrar los animales actualmente contenidos dentro de una zona / cerco específico | **Administrador de Campo, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **CUR-006 (CU006)** | Gestión del Catálogo Global de Tipos de Animal | **CUU-030** | Consultar el catálogo de tipos de animal y la cantidad de animales asociados a cada categoría | **Superadministrador (ve activos e inactivos), Administrador de Campo, Empleado Operador, Empleado Observador (ven tipos activos)** |
| **CUR-006 (CU006)** | Gestión del Catálogo Global de Tipos de Animal | **CUU-031** | Registrar un nuevo tipo de animal en el catálogo global | **Superadministrador** |
| **CUR-006 (CU006)** | Gestión del Catálogo Global de Tipos de Animal | **CUU-032** | Editar el nombre, especie o descripción de un tipo de animal existente | **Superadministrador** |
| **CUR-006 (CU006)** | Gestión del Catálogo Global de Tipos de Animal | **CUU-033** | Dar de baja lógica un tipo de animal conservando la clasificación histórica del ganado | **Superadministrador** |
| **CUR-006 (CU006)** | Gestión del Catálogo Global de Tipos de Animal | **CUU-034** | Reactivar un tipo de animal previamente dado de baja | **Superadministrador** |
| **CUR-007 (CU007)** | Gestión de Animales del Rodeo (Alta, Consulta, Edición y Baja) | **CUU-035** | Consultar, buscar y filtrar los animales del rodeo por múltiples criterios de negocio | **Administrador de Campo, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **CUR-007 (CU007)** | Gestión de Animales del Rodeo (Alta, Consulta, Edición y Baja) | **CUU-036** | Registrar el alta de un nuevo animal en el campo con colocación opcional de un collar disponible | **Administrador de Campo, Empleado Operador, Superadministrador (en modo asistencia)** |
| **CUR-007 (CU007)** | Gestión de Animales del Rodeo (Alta, Consulta, Edición y Baja) | **CUU-037** | Consultar la ficha integral de un animal (datos, collar actual e histórico, cerco, historia clínica y alertas) | **Administrador de Campo, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **CUR-007 (CU007)** | Gestión de Animales del Rodeo (Alta, Consulta, Edición y Baja) | **CUU-038** | Editar los datos de un animal con generación automática de registro médico de pesaje si cambia su peso | **Administrador de Campo, Empleado Operador, Superadministrador (en modo asistencia)** |
| **CUR-007 (CU007)** | Gestión de Animales del Rodeo (Alta, Consulta, Edición y Baja) | **CUU-039** | Dar de baja lógica (archivar) un animal por Venta liberando automáticamente su collar y su cerco virtual | **Administrador de Campo, Empleado Operador, Superadministrador (en modo asistencia)** |
| **CUR-007 (CU007)** | Gestión de Animales del Rodeo (Alta, Consulta, Edición y Baja) | **CUU-040** | Dar de baja lógica (archivar) un animal por Defunción liberando automáticamente su collar y su cerco virtual | **Administrador de Campo, Empleado Operador, Superadministrador (en modo asistencia)** |
| **CUR-008 (CU008)** | Gestión de Registros Médicos e Historial Clínico | **CUU-041** | Consultar el historial clínico completo de un animal | **Administrador de Campo, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **CUR-008 (CU008)** | Gestión de Registros Médicos e Historial Clínico | **CUU-042** | Registrar un evento clínico sanitario (Vacunación, Tratamiento, Cirugía o Parto) en un animal | **Administrador de Campo, Empleado Operador, Superadministrador (en modo asistencia)** |
| **CUR-008 (CU008)** | Gestión de Registros Médicos e Historial Clínico | **CUU-043** | Registrar un evento médico de Pesaje actualizando automáticamente el peso actual del animal | **Administrador de Campo, Empleado Operador, Superadministrador (en modo asistencia)** |
| **CUR-009 (CU009)** | Gestión de Collares Inteligentes (Stock Central, Asignación a Campos y Vinculación a Animales) | **CUU-044** | Consultar y filtrar el inventario de collares y su historial de animales portadores | **Superadministrador (ve todo el parque incluido Stock Central), Administrador de Campo, Empleado Operador, Empleado Observador (ven los collares de sus campos)** |
| **CUR-009 (CU009)** | Gestión de Collares Inteligentes (Stock Central, Asignación a Campos y Vinculación a Animales) | **CUU-045** | Registrar un nuevo collar inteligente en el Stock Central | **Superadministrador** |
| **CUR-009 (CU009)** | Gestión de Collares Inteligentes (Stock Central, Asignación a Campos y Vinculación a Animales) | **CUU-046** | Leer el código QR físico de un collar para agilizar su alta o localizarlo en el inventario | **Superadministrador, Administrador de Campo, Empleado Operador** |
| **CUR-009 (CU009)** | Gestión de Collares Inteligentes (Stock Central, Asignación a Campos y Vinculación a Animales) | **CUU-047** | Editar el número de dispositivo o el código identificador de un collar | **Superadministrador** |
| **CUR-009 (CU009)** | Gestión de Collares Inteligentes (Stock Central, Asignación a Campos y Vinculación a Animales) | **CUU-048** | Asignar un collar desde el Stock Central al campo de un cliente controlando su cupo contratado | **Superadministrador** |
| **CUR-009 (CU009)** | Gestión de Collares Inteligentes (Stock Central, Asignación a Campos y Vinculación a Animales) | **CUU-049** | Desasignar un collar de un campo devolviéndolo al Stock Central (con desvinculación automática de animal) | **Superadministrador** |
| **CUR-009 (CU009)** | Gestión de Collares Inteligentes (Stock Central, Asignación a Campos y Vinculación a Animales) | **CUU-050** | Vincular (colocar) un collar disponible del campo a un animal activo | **Administrador de Campo, Empleado Operador, Superadministrador (en modo asistencia)** |
| **CUR-009 (CU009)** | Gestión de Collares Inteligentes (Stock Central, Asignación a Campos y Vinculación a Animales) | **CUU-051** | Desvincular (retirar) un collar de un animal liberando el collar y cerrando automáticamente el cerco virtual del animal | **Administrador de Campo, Empleado Operador, Superadministrador** |
| **CUR-009 (CU009)** | Gestión de Collares Inteligentes (Stock Central, Asignación a Campos y Vinculación a Animales) | **CUU-052** | Cambiar el estado operativo de un collar entre Disponible y Fuera de Servicio | **Superadministrador, Administrador de Campo, Empleado Operador** |
| **CUR-009 (CU009)** | Gestión de Collares Inteligentes (Stock Central, Asignación a Campos y Vinculación a Animales) | **CUU-053** | Dar de baja lógica (archivar) un collar liberando al animal y devolviendo el cupo al Administrador de Campo | **Superadministrador** |
| **CUR-009 (CU009)** | Gestión de Collares Inteligentes (Stock Central, Asignación a Campos y Vinculación a Animales) | **CUU-054** | Reactivar (restaurar) un collar archivado devolviéndolo al Stock Central como Disponible | **Superadministrador** |
| **CUR-009 (CU009)** | Gestión de Collares Inteligentes (Stock Central, Asignación a Campos y Vinculación a Animales) | **CUU-055** | Eliminar definitivamente un collar sin historial o derivarlo a baja lógica si registra uso previo | **Superadministrador** |
| **CUR-010 (CU010)** | Visualización en Tiempo Real, Recorridos Históricos y Mapas de Calor | **CUU-056** | Visualizar la ubicación en tiempo real del rodeo sobre el mapa del campo con indicadores de señal y escape | **Administrador de Campo, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **CUR-010 (CU010)** | Visualización en Tiempo Real, Recorridos Históricos y Mapas de Calor | **CUU-057** | Consultar y reproducir los recorridos históricos de uno o varios animales por rango de fechas | **Administrador de Campo, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **CUR-010 (CU010)** | Visualización en Tiempo Real, Recorridos Históricos y Mapas de Calor | **CUU-058** | Generar y visualizar el mapa de calor de permanencia del ganado por período de tiempo | **Administrador de Campo, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **CUR-010 (CU010)** | Visualización en Tiempo Real, Recorridos Históricos y Mapas de Calor | **CUU-059** | Identificar zonas de sobrepastoreo y detectar "zonas muertas" (subutilizadas) dentro del campo | **Administrador de Campo, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **CUR-011 (CU011)** | Recepción de Lecturas de Campo, Control de Escape de Cerco y Sincronización con el Collar | **CUU-060** | Recibir y registrar una lectura válida de ubicación, temperatura, actividad y batería desde una antena del campo | **Dispositivo de Campo (Collar Inteligente a través de Antena Receptora)** |
| **CUR-011 (CU011)** | Recepción de Lecturas de Campo, Control de Escape de Cerco y Sincronización con el Collar | **CUU-061** | Rechazar y auditar lecturas provenientes de antenas no autorizadas o de collares pertenecientes a otro campo | **Dispositivo de Campo (Antena Receptora / Collar Inteligente)** |
| **CUR-011 (CU011)** | Recepción de Lecturas de Campo, Control de Escape de Cerco y Sincronización con el Collar | **CUU-062** | Verificar contención dentro del cerco virtual y disparar Alerta de Escape si el animal salió de los límites | **Dispositivo de Campo (al enviar lectura) y Sistema de Control de Cercos** |
| **CUR-011 (CU011)** | Recepción de Lecturas de Campo, Control de Escape de Cerco y Sincronización con el Collar | **CUU-063** | Entregar al collar los límites actualizados de su cerco virtual y marcarlo como Sincronizado | **Dispositivo de Campo (Antena Receptora y Collar Inteligente)** |
| **CUR-011 (CU011)** | Recepción de Lecturas de Campo, Control de Escape de Cerco y Sincronización con el Collar | **CUU-064** | Solicitar manualmente el reenvío (resincronización) del cerco virtual hacia un collar | **Administrador de Campo, Empleado Operador, Superadministrador** |
| **CUR-012 (CU012)** | Planificación y Ejecución de Pastoreo Rotativo (Rotación de Perímetros) | **CUU-065** | Crear e iniciar un plan de rotación de perímetros definiendo orden de zonas, duración y modo de avance | **Administrador de Campo, Empleado Operador, Superadministrador (en modo asistencia)** |
| **CUR-012 (CU012)** | Planificación y Ejecución de Pastoreo Rotativo (Rotación de Perímetros) | **CUU-066** | Consultar el estado del plan de rotación activo, el tiempo restante para la próxima etapa y el historial de rotaciones | **Administrador de Campo, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **CUR-012 (CU012)** | Planificación y Ejecución de Pastoreo Rotativo (Rotación de Perímetros) | **CUU-067** | Desplazar gradualmente los límites del cerco virtual cada 5 minutos entre la zona actual y la siguiente | **Planificador Automático de Rotación y Dispositivo de Campo** |
| **CUR-012 (CU012)** | Planificación y Ejecución de Pastoreo Rotativo (Rotación de Perímetros) | **CUU-068** | Ejecutar automáticamente el cambio a la siguiente etapa de rotación o finalizar el ciclo al cumplirse el tiempo | **Planificador Automático de Rotación** |
| **CUR-012 (CU012)** | Planificación y Ejecución de Pastoreo Rotativo (Rotación de Perímetros) | **CUU-069** | Adelantar manualmente el cambio de etapa o posponer el horario de la próxima rotación | **Administrador de Campo, Empleado Operador, Superadministrador (en modo asistencia)** |
| **CUR-012 (CU012)** | Planificación y Ejecución de Pastoreo Rotativo (Rotación de Perímetros) | **CUU-070** | Pausar, reanudar o cancelar definitivamente un plan de rotación de perímetros | **Administrador de Campo, Empleado Operador, Superadministrador (en modo asistencia)** |
| **CUR-013 (CU013)** | Gestión de Antenas Receptoras (Gateways) y Auditoría de Comunicaciones de Campo | **CUU-071** | Consultar el inventario de antenas receptoras (Gateways) y su estado de conexión y señal en tiempo real | **Superadministrador (ve todas incluidas las de Stock Central), Administrador de Campo, Empleado Operador, Empleado Observador (ven las antenas de sus campos)** |
| **CUR-013 (CU013)** | Gestión de Antenas Receptoras (Gateways) y Auditoría de Comunicaciones de Campo | **CUU-072** | Registrar una nueva antena receptora (Gateway) en stock o asignada a un campo | **Superadministrador, Administrador de Campo, Empleado Operador** |
| **CUR-013 (CU013)** | Gestión de Antenas Receptoras (Gateways) y Auditoría de Comunicaciones de Campo | **CUU-073** | Editar el nombre, cambiar la clave de acceso o reasignar el campo de una antena receptora | **Superadministrador, Administrador de Campo, Empleado Operador** |
| **CUR-013 (CU013)** | Gestión de Antenas Receptoras (Gateways) y Auditoría de Comunicaciones de Campo | **CUU-074** | Consultar y copiar la clave de acceso de una antena y su guía de configuración para el equipo físico | **Superadministrador, Administrador de Campo, Empleado Operador, Empleado Observador** |
| **CUR-013 (CU013)** | Gestión de Antenas Receptoras (Gateways) y Auditoría de Comunicaciones de Campo | **CUU-075** | Eliminar una antena receptora del inventario anulando su clave de acceso | **Superadministrador, Administrador de Campo, Empleado Operador** |
| **CUR-013 (CU013)** | Gestión de Antenas Receptoras (Gateways) y Auditoría de Comunicaciones de Campo | **CUU-076** | Auditar el registro global de comunicaciones de dispositivos y depurar el historial de auditoría | **Superadministrador** |
| **CUR-014 (CU014)** | Detección Predictiva de Eventos de Salud mediante Inteligencia Artificial | **CUU-077** | Analizar automáticamente el comportamiento de las últimas 24 horas de un animal y calcular su probabilidad de riesgo sanitario a 6 horas | **Motor Predictivo de Salud (al ingresar una nueva lectura de campo)** |
| **CUR-014 (CU014)** | Detección Predictiva de Eventos de Salud mediante Inteligencia Artificial | **CUU-078** | Registrar predicción positiva y disparar Alerta Preventiva de Salud cuando la probabilidad supera el umbral | **Motor Predictivo de Salud** |
| **CUR-014 (CU014)** | Detección Predictiva de Eventos de Salud mediante Inteligencia Artificial | **CUU-079** | Registrar predicción por debajo del umbral sin disparar alerta para seguimiento preventivo de tendencias | **Motor Predictivo de Salud** |
| **CUR-014 (CU014)** | Detección Predictiva de Eventos de Salud mediante Inteligencia Artificial | **CUU-080** | Proyectar la evolución probable de salud del animal en 4 etapas hasta las próximas 48 horas | **Motor Predictivo de Salud** |
| **CUR-014 (CU014)** | Detección Predictiva de Eventos de Salud mediante Inteligencia Artificial | **CUU-081** | Consultar el panel de Salud Predictiva del campo, el nivel de riesgo actual del rodeo y las curvas por animal | **Administrador de Campo, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **CUR-014 (CU014)** | Detección Predictiva de Eventos de Salud mediante Inteligencia Artificial | **CUU-082** | Inspeccionar el detalle de en qué mediciones se basó una predicción de salud | **Administrador de Campo, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **CUR-014 (CU014)** | Detección Predictiva de Eventos de Salud mediante Inteligencia Artificial | **CUU-083** | Marcar una alerta como Falso Positivo registrando la observación del operario y dándola por resuelta | **Administrador de Campo, Empleado Operador, Superadministrador (en modo asistencia)** |
| **CUR-014 (CU014)** | Detección Predictiva de Eventos de Salud mediante Inteligencia Artificial | **CUU-084** | Consultar las métricas de precisión del modelo en campo y obtener el registro de retroalimentación | **Administrador de Campo, Empleado Operador, Empleado Observador, Superadministrador** |
| **CUR-015 (CU015)** | Centro de Notificaciones y Gestión Operativa de Alertas | **CUU-085** | Consultar y filtrar el centro de notificaciones y alertas por campo, origen, tipo, animal y estado | **Administrador de Campo, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **CUR-015 (CU015)** | Centro de Notificaciones y Gestión Operativa de Alertas | **CUU-086** | Marcar una alerta activa como Resuelta / Atendida | **Administrador de Campo, Empleado Operador, Superadministrador (en modo asistencia)** |
| **CUR-016 (CU016)** | Configuración de Umbrales Sanitarios por Campo y Disparo de Alertas por Sensor | **CUU-087** | Consultar la configuración de umbrales sanitarios y avisos por correo de un campo | **Administrador de Campo, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **CUR-016 (CU016)** | Configuración de Umbrales Sanitarios por Campo y Disparo de Alertas por Sensor | **CUU-088** | Modificar y guardar los umbrales de fiebre, hipotermia, inactividad y avisos por correo del campo | **Administrador de Campo, Superadministrador (en modo asistencia)** |
| **CUR-016 (CU016)** | Configuración de Umbrales Sanitarios por Campo y Disparo de Alertas por Sensor | **CUU-089** | Evaluar cada lectura recibida contra los umbrales del campo y disparar alertas inmediatas de Fiebre, Hipotermia o Inactividad | **Sistema de Control de Umbrales (al recibir una lectura de campo)** |
| **CUR-017 (CU017)** | Generación de Reportes Documentales (PDF y Excel) y Tablero Analítico | **CUU-090** | Consultar el Tablero Analítico de indicadores del rodeo y evolución de alertas de los últimos 14 días | **Administrador de Campo, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **CUR-017 (CU017)** | Generación de Reportes Documentales (PDF y Excel) y Tablero Analítico | **CUU-091** | Descargar en planilla Excel el listado actualizado de animales o las lecturas biométricas por rango de fechas | **Administrador de Campo, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **CUR-017 (CU017)** | Generación de Reportes Documentales (PDF y Excel) y Tablero Analítico | **CUU-092** | Generar y descargar en PDF el Historial Médico completo de un animal | **Administrador de Campo, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **CUR-017 (CU017)** | Generación de Reportes Documentales (PDF y Excel) y Tablero Analítico | **CUU-093** | Generar y descargar en PDF el reporte de Escapes de Cerco Virtual por rango de fechas | **Administrador de Campo, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **CUR-017 (CU017)** | Generación de Reportes Documentales (PDF y Excel) y Tablero Analítico | **CUU-094** | Generar y descargar en PDF o Excel el Historial de Alertas y el desempeño del modelo predictivo | **Administrador de Campo, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **CUR-017 (CU017)** | Generación de Reportes Documentales (PDF y Excel) y Tablero Analítico | **CUU-095** | Generar y descargar en PDF el Resumen Ejecutivo del Rodeo del campo | **Administrador de Campo, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **CUR-018 (CU018)** | Gestión de Personal del Campo (Empleados Operadores y Observadores) | **CUU-096** | Consultar la nómina de personal propio y los campos donde cada empleado tiene acceso | **Administrador de Campo, Superadministrador (en modo asistencia)** |
| **CUR-018 (CU018)** | Gestión de Personal del Campo (Empleados Operadores y Observadores) | **CUU-097** | Dar de alta un nuevo empleado o reincorporar a un ex-empleado asignándole su rol (Operador u Observador) y sus campos | **Administrador de Campo, Superadministrador (en modo asistencia)** |
| **CUR-018 (CU018)** | Gestión de Personal del Campo (Empleados Operadores y Observadores) | **CUU-098** | Modificar el nombre, el rol operativo (Operador u Observador) o los campos asignativos a un empleado | **Administrador de Campo, Superadministrador (en modo asistencia)** |
| **CUR-018 (CU018)** | Gestión de Personal del Campo (Empleados Operadores y Observadores) | **CUU-099** | Blanquear (restablecer) la contraseña de un empleado asignándole una clave temporal | **Administrador de Campo, Superadministrador (en modo asistencia)** |
| **CUR-018 (CU018)** | Gestión de Personal del Campo (Empleados Operadores y Observadores) | **CUU-100** | Dar de baja lógica a un miembro del personal revocando su acceso a todos los campos | **Administrador de Campo, Superadministrador (en modo asistencia)** |

## **4\. Especificación Detallada de Casos de Uso (Nivel Resumen y Nivel Usuario)**

### **CUR-001: Autenticación, Control de Acceso y Asistencia a Clientes**

| CASO DE USO RESUMEN — CUR-001 (Base: CU001) | Autenticación, Control de Acceso y Asistencia a Clientes |
| :---- | :---- |
| **Nivel Jerárquico** | Caso de Uso Resumen (Módulo de Negocio) |
| **Roles de Negocio que Actúan** | **Superadministrador, Administrador de Campo, Empleado Operador, Empleado Observador** |
| **Objetivo de Negocio** | Permitir que todas las personas vinculadas a la plataforma ingresen de forma segura con su cuenta personal, obligar a definir una contraseña propia cuando ingresan por primera vez o tras un blanqueo, bloquear el acceso a cuentas o campos suspendidos y permitir que el Superadministrador opere en nombre de un Administrador de Campo cuando deba brindarle asistencia. |
| **Entidades de Negocio** | Usuario, Asignación de Empleado a Campo, Campo |
| **Control de Estados del Módulo** | Controla el estado de la Sesión de la persona (Sin sesión, Sesión activa o Sesión en modo asistencia) y el paso de la Cuenta de Usuario desde el estado "Activa con Cambio de Contraseña Pendiente" hacia "Activa y Operativa". |
| **Casos de Uso Usuario (6)** | • CUU-001: Iniciar sesión en la plataforma con correo electrónico y contraseña • CUU-002: Definir nueva contraseña obligatoria en el primer ingreso o luego de un blanqueo • CUU-003: Cambiar voluntariamente la contraseña de la cuenta • CUU-004: Bloquear automáticamente el acceso operativo ante suspensión del usuario o del Administrador de Campo empleador • CUU-005: Operar en nombre de un Administrador de Campo (Modo Asistencia / Emulación) • CUU-006: Finalizar el modo de asistencia o cerrar la sesión en el sistema |

#### **CUU-001 — Iniciar sesión en la plataforma con correo electrónico y contraseña**

| CASO DE USO USUARIO: CUU-001 | Iniciar sesión en la plataforma con correo electrónico y contraseña |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-001 — Autenticación, Control de Acceso y Asistencia a Clientes (Ref. Inicial: CU001) |
| **Roles de Negocio que Actúan** | **Superadministrador, Administrador de Campo, Empleado Operador, Empleado Observador** |
| **Necesidad / Objetivo** | Ingresar al sistema acreditando la identidad de la persona para acceder a las funciones y campos que le corresponden según su rol de negocio. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Entidad Usuario:** Existe en el sistema y se encuentra en estado "Activa y Operativa" (o "Activa con Cambio de Contraseña Pendiente"). **• Si quien ingresa es un Empleado (Operador u Observador):** debe poseer al menos una Asignación de Empleado a Campo en estado "Activa" sobre un Campo cuyo Administrador de Campo propietario también tenga su cuenta en estado "Activa". |
| **Flujo Básico (Paso a Paso)** | 1\. La persona ingresa su dirección de correo electrónico y su contraseña en la pantalla de acceso. 2\. El sistema verifica que la cuenta del Usuario exista, que sus credenciales sean correctas y que su estado sea "Activa". 3\. El sistema identifica el rol de negocio de la persona (Superadministrador, Administrador de Campo, Empleado Operador o Empleado Observador) y determina los campos activos a los que tiene derecho de acceso. 4\. El sistema inicia la sesión y dirige al usuario a su panel de trabajo principal. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. Correo inexistente o contraseña incorrecta:** El sistema rechaza el ingreso e informa que las credenciales son inválidas. Ninguna entidad cambia de estado. **• A2. Cuenta de Usuario en estado "Suspendida / Dada de Baja":** El sistema impide el ingreso e informa que la cuenta fue desactivada y debe contactar al administrador. • A3. Cuenta de Usuario en estado "Activa con Cambio de Contraseña Pendiente": El sistema valida el ingreso pero redirige obligatoriamente a la persona al cambio de contraseña inicial (CUU-002) antes de permitirle ver o gestionar cualquier información. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Usuario:** Conserva su estado "Activa" y queda con Sesión Activa en el sistema, con los permisos propios de su rol de negocio habilitados. **• Entidades Campo y Asignación de Empleado:** Sin modificaciones; quedan cargadas como contexto de trabajo del usuario. |

#### **CUU-002 — Definir nueva contraseña obligatoria en el primer ingreso o luego de un blanqueo**

| CASO DE USO USUARIO: CUU-002 | Definir nueva contraseña obligatoria en el primer ingreso o luego de un blanqueo |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-001 — Autenticación, Control de Acceso y Asistencia a Clientes (Ref. Inicial: CU001) |
| **Roles de Negocio que Actúan** | **Superadministrador, Administrador de Campo, Empleado Operador, Empleado Observador** |
| **Necesidad / Objetivo** | Reemplazar la contraseña provisoria entregada por el Superadministrador o por el Administrador de Campo por una clave personal definitiva que solo el titular conozca. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Entidad Usuario:** Ha iniciado sesión y su cuenta se encuentra en estado "Activa con Cambio de Contraseña Pendiente". |
| **Flujo Básico (Paso a Paso)** | 1\. El sistema presenta el formulario de cambio obligatorio de contraseña y mantiene bloqueado el acceso al resto de los módulos hasta completar este paso. 2\. El usuario ingresa su nueva contraseña personal y la repite para confirmarla. 3\. El sistema verifica que ambas coincidan y cumplan con la longitud mínima de seguridad. 4\. El sistema guarda la nueva contraseña del usuario y levanta la restricción de primer ingreso, habilitando el acceso normal a la plataforma. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. Las contraseñas ingresadas no coinciden o son demasiado cortas:** El sistema informa el error y solicita reintentar. El Usuario permanece en estado "Activa con Cambio de Contraseña Pendiente". |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Usuario:** Transiciona del estado "Activa con Cambio de Contraseña Pendiente" al estado "Activa y Operativa", con su nueva contraseña personal vigente. |

#### **CUU-003 — Cambiar voluntariamente la contraseña de la cuenta**

| CASO DE USO USUARIO: CUU-003 | Cambiar voluntariamente la contraseña de la cuenta |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-001 — Autenticación, Control de Acceso y Asistencia a Clientes (Ref. Inicial: CU001) |
| **Roles de Negocio que Actúan** | **Superadministrador, Administrador de Campo, Empleado Operador, Empleado Observador** |
| **Necesidad / Objetivo** | Modificar por propia voluntad la contraseña actual de acceso por una nueva por razones de seguridad o preferencia personal. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Entidad Usuario:** Con sesión iniciada y en estado "Activa y Operativa". |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario accede a la opción de cambio de contraseña e ingresa su contraseña actual seguida de la nueva contraseña y su confirmación. 2\. El sistema comprueba que la contraseña actual ingresada coincida con la registrada para ese Usuario. 3\. El sistema actualiza la contraseña por la nueva clave elegida y confirma la operación. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. La contraseña actual ingresada es incorrecta:** El sistema rechaza el cambio e informa que la contraseña actual no es válida. El Usuario mantiene su contraseña anterior sin cambios. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Usuario:** Permanece en estado "Activa y Operativa" con su contraseña de acceso actualizada. |

#### **CUU-004 — Bloquear automáticamente el acceso operativo ante suspensión del usuario o del Administrador de Campo empleador**

| CASO DE USO USUARIO: CUU-004 | Bloquear automáticamente el acceso operativo ante suspensión del usuario o del Administrador de Campo empleador |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-001 — Autenticación, Control de Acceso y Asistencia a Clientes (Ref. Inicial: CU001) |
| **Roles de Negocio que Actúan** | **Administrador de Campo, Empleado Operador, Empleado Observador** |
| **Necesidad / Objetivo** | Impedir de manera inmediata que una persona cuya cuenta fue dada de baja —o un empleado cuyo Administrador de Campo empleador fue suspendido— continúe operando sobre el campo. |
| **Precondiciones y Estado Inicial de las Entidades** | • El usuario intenta acceder o realizar una acción sobre un Campo mientras tiene una sesión abierta. • La cuenta del Usuario, o bien la cuenta del Administrador de Campo dueño de ese establecimiento, pasó al estado "Suspendida / Dada de Baja". • La cuenta del Usuario, o bien la cuenta del Administrador de Campo dueño de ese campo, pasó al estado "Suspendida / Dada de Baja". |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario solicita consultar o modificar información de un campo. 2\. El sistema verifica el estado actual de la cuenta del usuario, el estado del Campo y el estado de la cuenta del Administrador de Campo propietario. 3\. Al detectar que la cuenta del usuario fue dada de baja, el sistema cierra su sesión inmediatamente. 4\. Si la cuenta del Empleado sigue activa pero su Administrador de Campo empleador está en estado "Suspendida / Dada de Baja", el sistema impide el acceso al campo informando que la cuenta del productor propietario se encuentra temporalmente suspendida. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Tanto el usuario como el campo y el Administrador de Campo propietario están en estado "Activo": El sistema permite continuar con la operación solicitada. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades de Negocio:** No sufren alteraciones de datos; el acceso no autorizado queda bloqueado en el acto y la sesión del usuario inactivo pasa a estado "Sin sesión". |

#### **CUU-005 — Operar en nombre de un Administrador de Campo (Modo Asistencia / Emulación)**

| CASO DE USO USUARIO: CUU-005 | Operar en nombre de un Administrador de Campo (Modo Asistencia / Emulación) |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-001 — Autenticación, Control de Acceso y Asistencia a Clientes (Ref. Inicial: CU001) |
| **Roles de Negocio que Actúan** | **Superadministrador** |
| **Necesidad / Objetivo** | Permitir que el Superadministrador visualice y opere el sistema exactamente como lo ve un Administrador de Campo determinado para brindarle soporte técnico, configurar sus campos o auditar un inconveniente. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Superadministrador con cuenta en estado "Activa y Operativa". **• Entidad Usuario (Cliente objetivo):** Cuenta con rol Administrador de Campo en estado "Activa". |
| **Flujo Básico (Paso a Paso)** | 1\. Desde el padrón de usuarios, el Superadministrador selecciona a un Administrador de Campo y elige la opción de actuar en su nombre (emular usuario). 2\. El sistema activa el modo de asistencia mostrando un aviso permanente en pantalla que indica en nombre de qué Administrador de Campo se está operando. 3\. A partir de ese instante, el sistema habilita al Superadministrador el acceso a los campos, animales, collares, cercos, alertas y cupos de ese Administrador de Campo con sus mismos permisos y reglas de negocio. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. El Administrador de Campo seleccionado se encuentra en estado "Suspendido / Dado de Baja": El sistema no permite iniciar la asistencia sobre una cuenta inactiva. |
| **Postcondiciones y Estado Final de las Entidades** | **• Sesión del Superadministrador:** Pasa a estado "Sesión en Modo Asistencia / Emulación" actuando bajo el rol y alcance del Administrador de Campo seleccionado. **• Entidad Usuario:** Sin cambios en sus datos. |

#### **CUU-006 — Finalizar el modo de asistencia o cerrar la sesión en el sistema**

| CASO DE USO USUARIO: CUU-006 | Finalizar el modo de asistencia o cerrar la sesión en el sistema |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-001 — Autenticación, Control de Acceso y Asistencia a Clientes (Ref. Inicial: CU001) |
| **Roles de Negocio que Actúan** | **Superadministrador (para finalizar asistencia), Todos los Roles (para cerrar sesión)** |
| **Necesidad / Objetivo** | Regresar a la vista global de Superadministrador tras finalizar la asistencia a un cliente, o cerrar por completo la sesión de usuario al terminar de trabajar. |
| **Precondiciones y Estado Inicial de las Entidades** | • El usuario posee una sesión activa (o en modo asistencia). |
| **Flujo Básico (Paso a Paso)** | 1a. Si el Superadministrador selecciona "Salir del modo asistencia", el sistema restablece su vista y permisos globales de Superadministrador. 1b. Si cualquier usuario selecciona "Cerrar sesión", el sistema finaliza su sesión activa y lo devuelve a la pantalla de inicio de sesión. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Ninguno. |
| **Postcondiciones y Estado Final de las Entidades** | **• En fin de asistencia:** La sesión del Superadministrador vuelve a su estado normal de "Sesión Activa Global". **• En cierre de sesión:** La sesión del usuario pasa al estado "Sin sesión". |

### **CUR-002: Administración Global de Clientes, Usuarios y Cupos de Collares**

| CASO DE USO RESUMEN — CUR-002 (Base: CU002) | Administración Global de Clientes, Usuarios y Cupos de Collares |
| :---- | :---- |
| **Nivel Jerárquico** | Caso de Uso Resumen (Módulo de Negocio) |
| **Roles de Negocio que Actúan** | **Superadministrador** |
| **Objetivo de Negocio** | Permitir al Superadministrador gestionar el padrón completo de personas registradas en la plataforma, dar de alta nuevos Administradores de Campo (clientes), asignarles y modificarles la cantidad máxima de collares que tienen contratados por plan comercial, cambiar roles, suspender o reactivar cuentas y supervisar todos los campos dados de alta. |
| **Entidades de Negocio** | Usuario, Campo, Asignación de Empleado a Campo, Collar Inteligente |
| **Control de Estados del Módulo** | Gobierna el estado de la entidad Usuario (Creación con clave temporal pendiente, paso entre Activa y Suspendida/Baja Lógica, cambio de Rol de Negocio y actualización de su Cupo de Collares Contratados). |
| **Casos de Uso Usuario (7)** | • CUU-007: Consultar el padrón global de usuarios y el consumo de cupo de collares de cada cliente • CUU-008: Dar de alta un nuevo Administrador de Campo (Cliente) o usuario con contraseña temporal • CUU-009: Modificar el rol de negocio de un usuario registrado • CUU-010: Configurar o modificar el cupo máximo de collares contratados de un Administrador de Campo • CUU-011: Suspender (dar de baja lógica) la cuenta de un usuario con suspensión en cascada de sus campos • CUU-012: Reactivar una cuenta de usuario previamente suspendida • CUU-013: Supervisar el listado global de todos los campos registrados en la plataforma |

#### **CUU-007 — Consultar el padrón global de usuarios y el consumo de cupo de collares de cada cliente**

| CASO DE USO USUARIO: CUU-007 | Consultar el padrón global de usuarios y el consumo de cupo de collares de cada cliente |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-002 — Administración Global de Clientes, Usuarios y Cupos de Collares (Ref. Inicial: CU002) |
| **Roles de Negocio que Actúan** | **Superadministrador** |
| **Necesidad / Objetivo** | Visualizar todas las cuentas del sistema filtrando por rol, estado o nombre, y controlar cuántos collares tiene asignados actualmente cada Administrador de Campo respecto al cupo máximo que contrató. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Superadministrador con sesión activa. |
| **Flujo Básico (Paso a Paso)** | 1\. El Superadministrador accede al módulo de administración global de usuarios. 2\. El sistema presenta el listado de todos los Usuarios indicando su nombre, correo, rol de negocio (Superadministrador, Administrador de Campo o Empleado), estado de cuenta (Activa o Suspendida), campos vinculados y, para cada Administrador de Campo, la relación entre collares ocupados y cupo contratado (por ejemplo, 15 de 20 collares). 3\. El Superadministrador puede filtrar la lista por rol, por estado o buscar por nombre y correo. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Un Administrador de Campo o Empleado intenta acceder a este padrón global: El sistema deniega el acceso por ser exclusivo del Superadministrador. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades de Negocio:** Sin cambios (consulta de control administrativo y comercial). |

#### **CUU-008 — Dar de alta un nuevo Administrador de Campo (Cliente) o usuario con contraseña temporal**

| CASO DE USO USUARIO: CUU-008 | Dar de alta un nuevo Administrador de Campo (Cliente) o usuario con contraseña temporal |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-002 — Administración Global de Clientes, Usuarios y Cupos de Collares (Ref. Inicial: CU002) |
| **Roles de Negocio que Actúan** | **Superadministrador** |
| **Necesidad / Objetivo** | Incorporar un nuevo cliente productor (Administrador de Campo) o un nuevo integrante global al sistema, entregándole una contraseña provisoria y definiendo su cupo inicial de collares contratados. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Superadministrador con sesión activa. • No existe ningún otro Usuario registrado con el mismo correo electrónico. |
| **Flujo Básico (Paso a Paso)** | 1\. El Superadministrador selecciona la opción de crear un nuevo usuario. 2\. Completa el nombre, apellido, correo electrónico, contraseña temporal, selecciona el rol de negocio (por ejemplo, Administrador de Campo) e ingresa la cantidad máxima de collares contratados (cupo inicial). 3\. El sistema verifica que el correo electrónico no esté duplicado y registra al nuevo Usuario marcando que deberá cambiar su contraseña en su primer ingreso. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. El correo electrónico ya pertenece a otro usuario registrado:** El sistema impide el alta e informa que ya existe una cuenta con ese correo. • A2. El rol elegido no es Administrador de Campo (por ejemplo, Superadministrador): El sistema asigna automáticamente el cupo de collares contratados en 0, ya que el cupo comercial solo aplica a Administradores de Campo. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Usuario (Nueva):** Queda creada en estado "Activa con Cambio de Contraseña Pendiente", con el rol de negocio asignado y, si es Administrador de Campo, con su Cupo de Collares Contratados fijado y 0 collares ocupados. |

#### **CUU-009 — Modificar el rol de negocio de un usuario registrado**

| CASO DE USO USUARIO: CUU-009 | Modificar el rol de negocio de un usuario registrado |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-002 — Administración Global de Clientes, Usuarios y Cupos de Collares (Ref. Inicial: CU002) |
| **Roles de Negocio que Actúan** | **Superadministrador** |
| **Necesidad / Objetivo** | Cambiar el nivel de responsabilidad general de un usuario existente dentro de la plataforma (entre Empleado, Administrador de Campo o Superadministrador). |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Superadministrador con sesión activa. **• Entidad Usuario (Objetivo):** Existe en el sistema y no es el propio Superadministrador que ejecuta la acción. |
| **Flujo Básico (Paso a Paso)** | 1\. En el padrón global de usuarios, el Superadministrador selecciona al usuario cuyo rol desea modificar. 2\. Elige el nuevo rol de negocio y confirma el cambio. 3\. El sistema verifica que no se trate de la propia cuenta del Superadministrador en sesión y actualiza el rol del usuario. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. El Superadministrador intenta quitarse su propio rol de Superadministrador: El sistema bloquea la acción para evitar que la plataforma quede sin administración. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Usuario:** Queda actualizada con su nuevo Rol de Negocio conservando su estado de cuenta actual. |

#### **CUU-010 — Configurar o modificar el cupo máximo de collares contratados de un Administrador de Campo**

| CASO DE USO USUARIO: CUU-010 | Configurar o modificar el cupo máximo de collares contratados de un Administrador de Campo |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-002 — Administración Global de Clientes, Usuarios y Cupos de Collares (Ref. Inicial: CU002) |
| **Roles de Negocio que Actúan** | **Superadministrador** |
| **Necesidad / Objetivo** | Ampliar o reducir el límite de collares que un Administrador de Campo puede tener asignados en total entre todos sus establecimientos de acuerdo con el plan comercial contratado. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Superadministrador con sesión activa. **• Entidad Usuario (Objetivo):** Posee el rol de Administrador de Campo. |
| **Flujo Básico (Paso a Paso)** | 1\. El Superadministrador selecciona la opción de editar el cupo de collares de un Administrador de Campo e ingresa el nuevo límite máximo. 2\. El sistema contabiliza cuántos Collares Inteligentes activos (no dados de baja) se encuentran actualmente asignados a todos los campos de ese Administrador de Campo. 3\. El sistema comprueba que el nuevo cupo ingresado sea mayor o igual a la cantidad de collares que el cliente ya tiene en sus campos. 4\. El sistema guarda el nuevo cupo máximo contratado para ese Administrador de Campo. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. El nuevo cupo es menor a la cantidad de collares actualmente asignados a los campos del cliente: El sistema rechaza la reducción e informa cuántos collares tiene asignados actualmente, indicando que primero deben retirarse collares de sus campos al Stock Central antes de bajar su cupo. **• A2. El usuario seleccionado no tiene rol de Administrador de Campo:** El sistema informa que el cupo de collares solo aplica a cuentas de clientes productores. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Usuario (Administrador de Campo):** Queda con su Cupo de Collares Contratados actualizado al nuevo valor, habilitando (si se amplió) la asignación de más collares desde el Stock Central hacia sus campos. |

#### **CUU-011 — Suspender (dar de baja lógica) la cuenta de un usuario con suspensión en cascada de sus campos**

| CASO DE USO USUARIO: CUU-011 | Suspender (dar de baja lógica) la cuenta de un usuario con suspensión en cascada de sus campos |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-002 — Administración Global de Clientes, Usuarios y Cupos de Collares (Ref. Inicial: CU002) |
| **Roles de Negocio que Actúan** | **Superadministrador** |
| **Necesidad / Objetivo** | Deshabilitar el acceso de un usuario o de un cliente Administrador de Campo (por fin de contrato, mora o baja solicitada) sin borrar su información histórica, bloqueando también la operación en sus campos para todo su personal. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Superadministrador con sesión activa. **• Entidad Usuario (Objetivo):** Se encuentra en estado "Activa" y no es el propio Superadministrador. |
| **Flujo Básico (Paso a Paso)** | 1\. El Superadministrador selecciona la opción de desactivar/suspender sobre un usuario activo y confirma la operación. 2\. El sistema cambia el estado del Usuario a "Suspendida / Dada de Baja". 3\. Si el usuario suspendido es un Administrador de Campo, el sistema bloquea automáticamente el acceso operativo a todos los campos de su propiedad tanto para él como para los Empleados (Operadores y Observadores) de esos campos. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. El Superadministrador intenta suspender su propia cuenta:** El sistema rechaza la operación. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Usuario (Objetivo):** Pasa del estado "Activa" al estado "Suspendida / Dada de Baja" (no puede iniciar sesión ni operar). • Entidades Campo, Animales, Collares y Empleados dependientes (si el suspendido es Administrador de Campo): Conservan intactos sus datos y registros históricos, pero los campos quedan con acceso operativo suspendido mientras dure la baja del titular. |

#### **CUU-012 — Reactivar una cuenta de usuario previamente suspendida**

| CASO DE USO USUARIO: CUU-012 | Reactivar una cuenta de usuario previamente suspendida |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-002 — Administración Global de Clientes, Usuarios y Cupos de Collares (Ref. Inicial: CU002) |
| **Roles de Negocio que Actúan** | **Superadministrador** |
| **Necesidad / Objetivo** | Restablecer el acceso normal a la plataforma de un usuario o Administrador de Campo cuya cuenta había sido suspendida. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Superadministrador con sesión activa. **• Entidad Usuario (Objetivo):** Se encuentra en estado "Suspendida / Dada de Baja". |
| **Flujo Básico (Paso a Paso)** | 1\. En el padrón global de usuarios, el Superadministrador localiza al usuario suspendido y selecciona la opción de reactivar cuenta. 2\. El sistema restablece el estado del Usuario a "Activa y Operativa". |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Ninguno. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Usuario (Objetivo):** Pasa del estado "Suspendida / Dada de Baja" al estado "Activa y Operativa". **• Efecto en Cascada (si es Administrador de Campo):** Todos sus Campos activos y las Asignaciones de Empleados activas de su personal vuelven a estar inmediatamente operativas. |

#### **CUU-013 — Supervisar el listado global de todos los campos registrados en la plataforma**

| CASO DE USO USUARIO: CUU-013 | Supervisar el listado global de todos los campos registrados en la plataforma |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-002 — Administración Global de Clientes, Usuarios y Cupos de Collares (Ref. Inicial: CU002) |
| **Roles de Negocio que Actúan** | **Superadministrador** |
| **Necesidad / Objetivo** | Consultar de forma centralizada todos los campos dados de alta por los distintos Administradores de Campo, conociendo su propietario, ubicación, superficie, cantidad de animales, cercos y personal. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Superadministrador con sesión activa. |
| **Flujo Básico (Paso a Paso)** | 1\. El Superadministrador accede a la vista global de campos. 2\. El sistema muestra la lista paginada de todos los Campos registrados en la plataforma junto con el nombre y correo de su Administrador de Campo propietario, provincia, localidad, hectáreas, total de animales, total de cercos virtuales y cantidad de empleados. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Ninguno. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades de Negocio:** Sin cambios (consulta de supervisión global). |

### **CUR-003: Gestión de Campos**

| CASO DE USO RESUMEN — CUR-003 (Base: CU003) | Gestión de Campos |
| :---- | :---- |
| **Nivel Jerárquico** | Caso de Uso Resumen (Módulo de Negocio) |
| **Roles de Negocio que Actúan** | **Administrador de Campo (gestión completa), Empleado Operador y Empleado Observador (consulta y selección de campo de trabajo), Superadministrador (en modo asistencia)** |
| **Objetivo de Negocio** | Permitir al Administrador de Campo registrar sus campos, actualizar sus datos de ubicación, trazar o ajustar en el mapa el perímetro del campo (calculando su superficie en hectáreas y protegiendo los cercos internos) y dar de baja un campo liberando ordenadamente todos sus collares, animales, cercos y personal. |
| **Entidades de Negocio** | Campo, Asignación de Empleado a Campo, Zona / Cerco Virtual, Animal, Collar Inteligente, Vínculo Animal–Collar, Asignación de Animal a Zona / Cerco Virtual |
| **Control de Estados del Módulo** | Controla la creación del Campo (Activo sin o con perímetro), la actualización de su polígono perimetral y su paso al estado "Dado de Baja / Archivado" con la correspondiente cascada sobre animales, collares, cercos y empleados. |
| **Casos de Uso Usuario (5)** | • CUU-014: Consultar, buscar y seleccionar el campo activo de trabajo • CUU-015: Registrar un nuevo campo con datos de ubicación y trazado opcional de su perímetro geográfico • CUU-016: Editar los datos generales de un campo (nombre, provincia, departamento, dirección) • CUU-017: Delimitar o modificar el perímetro geográfico del campo validando que los cercos activos queden contenidos • CUU-018: Dar de baja lógica (archivar) un campo con liberación automática de collares, archivo de animales y baja de cercos |

#### **CUU-014 — Consultar, buscar y seleccionar el campo activo de trabajo \- OK**

| CASO DE USO USUARIO: CUU-014 | Consultar, buscar y seleccionar el campo activo de trabajo |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-003 — Gestión de Campos (Ref. Inicial: CU003) |
| **Roles de Negocio que Actúan** | **Administrador de Campo, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Visualizar el listado de campos a los que la persona tiene acceso (propios o asignados), conocer su superficie y ubicación, y elegir sobre qué campo operar en las distintas pantallas del sistema. |
| **Precondiciones y Estado Inicial de las Entidades** | • El usuario tiene sesión activa. • Existen Campos en estado "Activo" donde el usuario es el Administrador de Campo propietario o donde posee una Asignación de Empleado en estado "Activa". |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario accede a la sección de Campos o despliega el selector de campo. 2\. El sistema lista únicamente los Campos en estado "Activo" habilitados para ese usuario, mostrando nombre, dirección, localidad, provincia y superficie en hectáreas. 3\. El usuario puede buscar por nombre o ubicación y seleccionar el establecimiento con el que desea trabajar. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. El usuario aún no tiene ningún campo registrado o asignado:** El sistema muestra un aviso indicando que no hay campos disponibles y, si su rol es Administrador de Campo, le ofrece el botón para registrar su primer campo. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades de Negocio:** Sin cambios. El campo elegido queda establecido como el contexto activo de visualización y trabajo. |

#### **CUU-015 — Registrar un nuevo campo con datos de ubicación y trazado opcional de su perímetro geográfico \- OK**

| CASO DE USO USUARIO: CUU-015 | Registrar un nuevo campo con datos de ubicación y trazado opcional de su perímetro geográfico |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-003 — Gestión de Campos (Ref. Inicial: CU003) |
| **Roles de Negocio que Actúan** | **Administrador de Campo, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Dar de alta un nuevo campo indicando su nombre, provincia, localidad, dirección y dibujando opcionalmente sus límites en el mapa satelital para calcular su superficie en hectáreas. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Administrador de Campo con cuenta en estado "Activa y Operativa" (los Empleados Operadores y Observadores no tienen permitido crear campos). |
| **Flujo Básico (Paso a Paso)** | 1\. El Administrador de Campo inicia el registro de un nuevo campo y completa el nombre del campo, la provincia, el departamento/localidad y la dirección o referencia rural. 2\. En el paso siguiente, el sistema posiciona el mapa en la localidad seleccionada y permite al Administrador de Campo marcar los vértices que delimitan el perímetro del campo (mínimo 3 puntos), calculando automáticamente las hectáreas totales. 3\. El Administrador de Campo confirma la creación. 4\. El sistema registra el nuevo Campo y vincula automáticamente al usuario creador como su Administrador de Campo titular. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Un Empleado Operador o Empleado Observador intenta registrar un nuevo campo: El sistema impide la acción por estar reservada exclusivamente al Administrador de Campo. **• A2. Se intenta guardar un dibujo de perímetro con menos de 3 vértices:** El sistema solicita completar al menos 3 puntos para conformar un polígono válido o bien omitir el perímetro para definirlo más adelante. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Campo (Nueva):** Queda creada en estado "Activa con Perímetro Delimitado" (con sus hectáreas calculadas) o "Activa sin Perímetro Delimitado" (si se omitió el dibujo). **• Vinculación de Propiedad:** El usuario creador queda asignado en estado "Activo" con el rol de Administrador de Campo sobre el nuevo campo. |

#### **CUU-016 — Editar los datos generales de un campo (nombre, provincia, departamento, dirección) \- OK**

| CASO DE USO USUARIO: CUU-016 | Editar los datos generales de un campo (nombre, provincia, departamento, dirección) |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-003 — Gestión de Campos (Ref. Inicial: CU003) |
| **Roles de Negocio que Actúan** | **Administrador de Campo, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Actualizar el nombre comercial o los datos de localización geográfica de un campo existente. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Administrador de Campo propietario del campo. **• Entidad Campo:** Se encuentra en estado "Activa". |
| **Flujo Básico (Paso a Paso)** | 1\. El Administrador de Campo selecciona la opción de editar datos sobre uno de sus campos. 2\. Modifica el nombre, provincia, departamento o dirección de referencia y confirma los cambios. 3\. El sistema actualiza la ficha del Campo manteniendo intactos su perímetro, cercos, animales, collares y personal. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Un Empleado Operador o Empleado Observador intenta editar los datos del campo: El sistema no le habilita la acción por requerir rol de Administrador de Campo. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Campo:** Permanece en estado "Activa" con su nombre y datos de ubicación actualizados. |

#### **CUU-017 — Delimitar o modificar el perímetro geográfico del campo validando que los cercos activos queden contenidos \- OK**

| CASO DE USO USUARIO: CUU-017 | Delimitar o modificar el perímetro geográfico del campo validando que los cercos activos queden contenidos |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-003 — Gestión de Campos (Ref. Inicial: CU003) |
| **Roles de Negocio que Actúan** | **Administrador de Campo, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Trazar por primera vez o ajustar los vértices del límite exterior del campo en el mapa, recalculando su superficie en hectáreas y asegurando que ninguna zona o cerco virtual activo quede fuera de los nuevos límites. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Administrador de Campo propietario del campo. **• Entidad Campo:** Se encuentra en estado "Activa". |
| **Flujo Básico (Paso a Paso)** | 1\. El Administrador de Campo abre el mapa de delimitación perimetral del campo. 2\. Agrega, mueve o elimina vértices sobre el mapa satelital; el sistema muestra en tiempo real la nueva superficie calculada en hectáreas. 3\. Al confirmar el guardado, el sistema verifica todas las Zonas / Cercos Virtuales de ese campo que se encuentran en estado "Activo". 4\. Comprobado que el 100% de la superficie de todos los cercos activos queda dentro del nuevo límite exterior del campo, el sistema guarda el nuevo perímetro y actualiza las hectáreas del Campo. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Al reducir o mover el perímetro del campo, una o más Zonas / Cercos Virtuales en estado "Activo" quedan total o parcialmente fuera de los nuevos límites: El sistema bloquea el cambio e informa los nombres de los cercos afectados, indicando que primero deben ajustarse o desactivarse esos cercos antes de achicar el campo. El Campo conserva su perímetro y superficie anteriores. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Campo:** Queda en estado "Activa con Perímetro Delimitado", con sus nuevas coordenadas perimetrales y su superficie en hectáreas actualizada. **• Entidades Zona / Cerco Virtual (Activos):** Permanecen en estado "Activo" e íntegramente contenidos dentro del campo. |

#### **CUU-018 — Dar de baja lógica (archivar) un campo con liberación automática de collares, archivo de animales y baja de cercos**

| CASO DE USO USUARIO: CUU-018 | Dar de baja lógica (archivar) un campo con liberación automática de collares, archivo de animales y baja de cercos |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-003 — Gestión de Campos (Ref. Inicial: CU003) |
| **Roles de Negocio que Actúan** | **Administrador de Campo, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Cerrar operativamente un campo liberando de inmediato todos sus collares para que puedan reutilizarse, archivando sus animales sin perder su historia clínica y revocando los accesos de personal sobre ese campo. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Administrador de Campo propietario del campo. **• Entidad Campo:** Se encuentra en estado "Activa". |
| **Flujo Básico (Paso a Paso)** | 1\. El Administrador de Campo solicita eliminar / dar de baja el campo. 2\. El sistema presenta una advertencia detallada indicando cuántos animales activos y cuántos cercos posee el campo, y explicando el impacto sobre cada recurso. 3\. El Administrador de Campo confirma la baja definitiva del campo. 4\. El sistema ejecuta de manera conjunta e indivisible las siguientes acciones de cierre:    a) Finaliza todos los Vínculos Animal–Collar que estaban vigentes en el campo.    b) Finaliza todas las Asignaciones de Animales a Zonas / Cercos Virtuales vigentes en el campo.    c) Pasa todos los Animales del campo a estado "Archivado", conservando todo su historial médico y lecturas pasadas.    d) Libera todos los Collares Inteligentes que estaban asignados al campo, devolviéndolos al Stock Central.    e) Elimina las Zonas / Cercos Virtuales del campo.    f) Pasa a estado "Asignación Revocada / Inactiva" todos los vínculos de Empleados y del Administrador sobre ese campo, y cambia el Campo al estado "Dado de Baja / Archivado". |
| **Caminos Alternativos y Reglas de Negocio** | • A1. El Administrador de Campo cancela la confirmación en el cuadro de advertencia: No se realiza ningún cambio. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Campo:** Pasa del estado "Activa" al estado "Dada de Baja / Archivada" (con fecha de baja registrada). **• Entidades Animal (del campo):** Pasan a estado "Archivado", sin collar vinculado y sin cerco asignado, preservando su historia clínica. • Entidades Vínculo Animal–Collar y Asignación de Animal a Cerco (que estaban vigentes): Pasan todas a estado "Finalizada / Histórica" con fecha de fin. **• Entidades Collar Inteligente (que estaban en el campo):** Pasan todas al estado "En Stock Central (Libre)", sin campo ni animal asignado, liberando el cupo contratado del Administrador de Campo. **• Entidades Zona / Cerco Virtual (del campo):** Pasan a estado "Eliminado". **• Entidades Asignación de Empleado a Campo (de ese campo):** Pasan a estado "Asignación Revocada / Inactiva". |

### **CUR-004: Gestión de Zonas de Pastoreo y Cercos Virtuales**

| CASO DE USO RESUMEN — CUR-004 (Base: CU004 y CU011) | Gestión de Zonas de Pastoreo y Cercos Virtuales |
| :---- | :---- |
| **Nivel Jerárquico** | Caso de Uso Resumen (Módulo de Negocio) |
| **Roles de Negocio que Actúan** | **Administrador de Campo, Empleado Operador (gestión completa), Empleado Observador (solo consulta), Superadministrador (en modo asistencia)** |
| **Objetivo de Negocio** | Permitir subdividir la superficie de un campo en zonas o potreros delimitados mediante cercos virtuales inteligentes, especificando el tipo de pastura, validando que sus límites estén dentro del campo, y activando, editando o desactivando cada cerco con aviso automático a los collares de los animales. |
| **Entidades de Negocio** | Zona / Cerco Virtual, Campo, Animal, Asignación de Animal a Zona / Cerco Virtual, Collar Inteligente |
| **Control de Estados del Módulo** | Gobierna el ciclo de vida de la Zona / Cerco Virtual (Creación en estado Activo, Edición de límites con puesta de Collares en "Sincronización Pendiente", Desactivación con liberación automática de los animales contenidos, y Reactivación). |
| **Casos de Uso Usuario (5)** | • CUU-019: Consultar el listado y el mapa general de zonas y cercos virtuales de un campo • CUU-020: Crear una nueva zona / cerco virtual con tipo de pastura, polígono validado y asignación opcional de animales • CUU-021: Editar el nombre, tipo de pastura o polígono de una zona / cerco virtual con aviso a los collares • CUU-022: Desactivar una zona / cerco virtual liberando automáticamente a los animales contenidos • CUU-023: Reactivar una zona / cerco virtual previamente desactivado |

#### **CUU-019 — Consultar el listado y el mapa general de zonas y cercos virtuales de un campo**

| CASO DE USO USUARIO: CUU-019 | Consultar el listado y el mapa general de zonas y cercos virtuales de un campo |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-004 — Gestión de Zonas de Pastoreo y Cercos Virtuales (Ref. Inicial: CU004 y CU011) |
| **Roles de Negocio que Actúan** | **Administrador de Campo, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Visualizar sobre el mapa satelital el perímetro del campo junto con todas sus zonas y cercos virtuales (tanto activos como desactivados), su tipo de pastura, superficie en hectáreas y cantidad de animales contenidos. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Entidad Campo:** En estado "Activa", y el usuario posee acceso a ella (como Administrador de Campo, Empleado Operador o Empleado Observador). |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario accede a la sección de Cercos del campo seleccionado. 2\. El sistema presenta el mapa del campo con su perímetro exterior y dibuja los polígonos de todas las Zonas / Cercos Virtuales, diferenciando visualmente los que están en estado "Activo" de los "Desactivados". 3\. Junto al mapa, el sistema muestra la ficha de cada cerco con su nombre, tipo de pastura, hectáreas calculadas, estado y cantidad de animales actualmente asignados. |
| **Caminos Alternativos y Reglas de Negocio** | **• El campo aún no tiene zonas ni cercos creados:** El sistema muestra el mapa con el perímetro del campo e invita a crear el primer cerco (si el usuario es Administrador de Campo o Empleado Operador). |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades de Negocio:** Sin cambios (consulta operativa y geográfica). |

#### **CUU-020 — Crear una nueva zona / cerco virtual con tipo de pastura, polígono validado y asignación opcional de animales**

| CASO DE USO USUARIO: CUU-020 | Crear una nueva zona / cerco virtual con tipo de pastura, polígono validado y asignación opcional de animales |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-004 — Gestión de Zonas de Pastoreo y Cercos Virtuales (Ref. Inicial: CU004 y CU011) |
| **Roles de Negocio que Actúan** | **Administrador de Campo, Empleado Operador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Delimitar un nuevo potrero o cerco virtual dentro del campo indicando su nombre, el tipo de pastura disponible, trazando sus vértices en el mapa y pudiendo asignarle en el mismo acto un grupo inicial de animales con collar. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Administrador de Campo o Empleado Operador con acceso al campo. **• Entidad Campo:** En estado "Activa". |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario inicia la creación de un nuevo cerco virtual; el sistema sugiere un nombre correlativo (por ejemplo, "Potrero 1") y permite ingresar el tipo de pastura (por ejemplo, Alfalfa, Festuca, Verdeo). 2\. El usuario marca en el mapa los vértices del polígono del cerco (mínimo 3 puntos) y selecciona opcionalmente qué animales con collar activo desea incluir inicialmente. 3\. Si el Campo tiene un perímetro delimitado, el sistema comprueba que todos los vértices del nuevo cerco estén ubicados al 100% dentro de los límites del campo. 4\. El sistema crea la Zona / Cerco Virtual en estado "Activo" y, si se eligieron animales, los asigna al nuevo cerco (cerrando cualquier cerco anterior en el que estuvieran) y marca sus collares para sincronizar los nuevos límites. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Uno o más puntos del dibujo del cerco caen fuera del perímetro del Campo: El sistema rechaza la creación e informa que el cerco debe estar completamente contenido dentro de los límites del establecimiento. **• A2. El polígono tiene menos de 3 vértices:** El sistema solicita marcar al menos 3 puntos en el mapa. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Zona / Cerco Virtual (Nueva):** Queda creada en estado "Activo" (con animales contenidos si se seleccionaron, o sin animales asignados). • Entidades Asignación de Animal a Zona / Cerco Virtual (para los animales seleccionados): Sus asignaciones anteriores pasan a estado "Finalizada / Histórica" y se crean nuevas asignaciones en estado "Vigente / Activa" hacia el nuevo cerco. **• Entidades Collar Inteligente (de los animales asignados):** Pasan a estado de cerco "Sincronización Pendiente". |

#### **CUU-021 — Editar el nombre, tipo de pastura o polígono de una zona / cerco virtual con aviso a los collares**

| CASO DE USO USUARIO: CUU-021 | Editar el nombre, tipo de pastura o polígono de una zona / cerco virtual con aviso a los collares |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-004 — Gestión de Zonas de Pastoreo y Cercos Virtuales (Ref. Inicial: CU004 y CU011) |
| **Roles de Negocio que Actúan** | **Administrador de Campo, Empleado Operador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Modificar la denominación, la pastura o la forma geográfica de un cerco virtual existente y asegurar que los collares de todos los animales contenidos reciban los nuevos límites. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Administrador de Campo o Empleado Operador del campo. **• Entidad Zona / Cerco Virtual:** Existe en el campo. |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario selecciona la opción de editar sobre una Zona / Cerco Virtual. 2\. Modifica el nombre, el tipo de pastura y/o desplaza los vértices del polígono en el mapa, y confirma los cambios. 3\. Si se modificó el dibujo del polígono, el sistema verifica que los nuevos límites sigan estando 100% dentro del perímetro del Campo. 4\. El sistema guarda los cambios del cerco y, si el cerco está "Activo" y cambiaron sus coordenadas, marca los Collares Inteligentes de todos los animales actualmente contenidos en él con estado "Sincronización Pendiente". |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. El polígono modificado se sale de los límites del Campo:** El sistema impide guardar el cambio y mantiene la forma anterior del cerco. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Zona / Cerco Virtual:** Queda actualizada con su nuevo nombre, tipo de pastura y/o límites geográficos. • Entidades Collar Inteligente (de los animales contenidos en el cerco, si cambió el polígono): Pasan a estado "Sincronización Pendiente" para recibir el nuevo trazado en su próxima comunicación. |

#### **CUU-022 — Desactivar una zona / cerco virtual liberando automáticamente a los animales contenidos**

| CASO DE USO USUARIO: CUU-022 | Desactivar una zona / cerco virtual liberando automáticamente a los animales contenidos |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-004 — Gestión de Zonas de Pastoreo y Cercos Virtuales (Ref. Inicial: CU004 y CU011) |
| **Roles de Negocio que Actúan** | **Administrador de Campo, Empleado Operador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Apagar un cerco virtual para que deje de restringir el movimiento de los animales, desvinculando automáticamente a toda la hacienda que tenía asignada y ordenando a sus collares anular la frontera. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Administrador de Campo o Empleado Operador del campo. **• Entidad Zona / Cerco Virtual:** Se encuentra en estado "Activo". |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario selecciona la opción de desactivar sobre un cerco virtual activo y confirma la decisión. 2\. El sistema cambia la Zona / Cerco Virtual al estado "Desactivado / Inactivo" registrando la fecha y hora de desactivación. 3\. En el mismo acto, el sistema finaliza todas las Asignaciones de Animales a ese cerco que estaban vigentes y marca los Collares Inteligentes de esos animales con estado "Sincronización Pendiente" para que dejen de aplicar estímulos de frontera. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. El usuario cancela la confirmación:** El cerco permanece "Activo" con sus animales contenidos. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Zona / Cerco Virtual:** Pasa del estado "Activo" al estado "Desactivado / Inactivo" (con 0 animales contenidos). • Entidades Asignación de Animal a Zona / Cerco Virtual (que estaban vigentes en ese cerco): Pasan todas del estado "Vigente / Activa" al estado "Finalizada / Histórica". **• Entidades Animal (que estaban en el cerco):** Permanecen en estado "Activo en el Rodeo (Con Collar y Sin Cerco)". **• Entidades Collar Inteligente (de los animales liberados):** Pasan a estado "Sincronización Pendiente" para borrar los límites en el dispositivo físico. |

#### **CUU-023 — Reactivar una zona / cerco virtual previamente desactivado**

| CASO DE USO USUARIO: CUU-023 | Reactivar una zona / cerco virtual previamente desactivado |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-004 — Gestión de Zonas de Pastoreo y Cercos Virtuales (Ref. Inicial: CU004 y CU011) |
| **Roles de Negocio que Actúan** | **Administrador de Campo, Empleado Operador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Volver a encender una zona o cerco virtual que estaba inactivo para dejarlo disponible y poder asignarle nuevamente lotes de animales. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Administrador de Campo o Empleado Operador del campo. **• Entidad Zona / Cerco Virtual:** Se encuentra en estado "Desactivado / Inactivo". |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario selecciona la opción de activar sobre una Zona / Cerco Virtual inactiva. 2\. El sistema verifica que el polígono del cerco continúe estando 100% dentro del perímetro actual del Campo. 3\. El sistema cambia la Zona / Cerco Virtual al estado "Activo (Sin animales asignados)" registrando la nueva fecha de activación. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. El perímetro del Campo fue reducido mientras el cerco estaba desactivado y ahora el cerco sobresale de los límites del campo: El sistema impide la reactivación e indica que primero debe editarse el polígono del cerco para ajustarlo a los límites actuales del campo. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Zona / Cerco Virtual:** Pasa del estado "Desactivado / Inactivo" al estado "Activo (Sin animales asignados)", listo para recibir animales. |

### **CUR-005: Asignación y Movimiento de Animales entre Zonas/Cercos y entre Campos**

| CASO DE USO RESUMEN — CUR-005 (Base: CU005) | Asignación y Movimiento de Animales entre Zonas/Cercos y entre Campos |
| :---- | :---- |
| **Nivel Jerárquico** | Caso de Uso Resumen (Módulo de Negocio) |
| **Roles de Negocio que Actúan** | **Administrador de Campo, Empleado Operador (ejecución de asignaciones y traslados), Empleado Observador (solo consulta), Superadministrador (en modo asistencia)** |
| **Objetivo de Negocio** | Permitir ubicar y mover animales —tanto de manera individual como por lotes masivos— dentro de las zonas y cercos virtuales de un campo (exigiendo siempre que cuenten con un collar activo y cerrando su ubicación anterior), así como trasladar lotes de hacienda junto con sus collares desde un campo hacia otro. |
| **Entidades de Negocio** | Animal, Asignación de Animal a Zona / Cerco Virtual, Zona / Cerco Virtual, Collar Inteligente, Vínculo Animal–Collar, Registro Médico, Campo |
| **Control de Estados del Módulo** | Controla que cada Animal tenga a lo sumo una Asignación a Zona / Cerco Virtual en estado "Vigente / Activa" (condicionada a poseer un Vínculo Animal–Collar "Activo"), marca los collares en "Sincronización Pendiente" y gestiona el cambio de Campo tanto del Animal como de su Collar en traslados entre establecimientos. |
| **Casos de Uso Usuario (6)** | • CUU-024: Asignar individualmente un animal con collar activo a una zona / cerco virtual • CUU-025: Desvincular individualmente a un animal de su zona / cerco virtual actual • CUU-026: Asignar masivamente un lote de animales a una zona / cerco virtual • CUU-027: Desvincular masivamente un lote de animales de su zona / cerco virtual • CUU-028: Trasladar masivamente un lote de animales y sus collares vinculados hacia otro campo • CUU-029: Consultar y filtrar los animales actualmente contenidos dentro de una zona / cerco específico |

#### **CUU-024 — Asignar individualmente un animal con collar activo a una zona / cerco virtual**

| CASO DE USO USUARIO: CUU-024 | Asignar individualmente un animal con collar activo a una zona / cerco virtual |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-005 — Asignación y Movimiento de Animales entre Zonas/Cercos y entre Campos (Ref. Inicial: CU005) |
| **Roles de Negocio que Actúan** | **Administrador de Campo, Empleado Operador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Ubicar a un animal específico dentro de una zona o cerco virtual activo de su mismo campo para su contención y monitoreo de escapes. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Administrador de Campo o Empleado Operador con permisos en el campo. **• Entidad Animal:** En estado "Activo en el Rodeo" y CON un Collar Inteligente vinculado (Vínculo Animal–Collar en estado "Activo"). **• Entidad Zona / Cerco Virtual (Destino):** Pertenece al mismo Campo que el animal y se encuentra en estado "Activo". |
| **Flujo Básico (Paso a Paso)** | 1\. Desde el listado o ficha del animal, el usuario selecciona la Zona / Cerco Virtual al que desea asignarlo. 2\. El sistema verifica que el animal tenga un collar activo colocado y que el cerco destino pertenezca al mismo campo. 3\. Si el animal ya se encontraba asignado a otra Zona / Cerco Virtual, el sistema da por finalizada esa asignación anterior con la fecha y hora actual. 4\. El sistema registra la nueva Asignación de Animal a Zona / Cerco Virtual como vigente y marca el Collar Inteligente del animal con "Sincronización Pendiente". |
| **Caminos Alternativos y Reglas de Negocio** | • A1. El animal NO tiene un collar vinculado (está en estado "Activo sin Collar"): El sistema bloquea la asignación e informa que el animal debe tener un collar colocado para poder asignarlo a un cerco virtual. **• A2. El cerco pertenece a otro campo distinto del animal:** El sistema rechaza la operación. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Asignación de Animal a Zona / Cerco Virtual (Anterior, si tenía):** Pasa del estado "Vigente / Activa" al estado "Finalizada / Histórica". **• Entidad Asignación de Animal a Zona / Cerco Virtual (Nueva):** Queda creada en estado "Vigente / Activa" vinculando al animal con el nuevo cerco. **• Entidad Animal:** Queda en estado "Activo en el Rodeo (Con Collar y Contenido en Cerco)". **• Entidad Collar Inteligente:** Pasa a estado de cerco "Sincronización Pendiente". |

#### **CUU-025 — Desvincular individualmente a un animal de su zona / cerco virtual actual**

| CASO DE USO USUARIO: CUU-025 | Desvincular individualmente a un animal de su zona / cerco virtual actual |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-005 — Asignación y Movimiento de Animales entre Zonas/Cercos y entre Campos (Ref. Inicial: CU005) |
| **Roles de Negocio que Actúan** | **Administrador de Campo, Empleado Operador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Retirar a un animal de la zona o cerco virtual en el que estaba contenido para que quede libre de límites internos dentro del campo. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Administrador de Campo o Empleado Operador del campo. **• Entidad Animal:** Se encuentra en estado "Activo en el Rodeo (Con Collar y Contenido en Cerco)". |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario selecciona para el animal la opción de quitarlo de su cerco virtual actual. 2\. El sistema cierra la Asignación de Animal a Zona / Cerco Virtual registrando la fecha y hora de finalización. 3\. El sistema marca el Collar Inteligente del animal con "Sincronización Pendiente" para que desactive los límites en la próxima comunicación. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. El animal ya se encontraba sin cerco asignado:** El sistema mantiene al animal sin cerco sin generar registros adicionales. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Asignación de Animal a Zona / Cerco Virtual:** Pasa del estado "Vigente / Activa" al estado "Finalizada / Histórica". **• Entidad Animal:** Pasa al estado "Activo en el Rodeo (Con Collar y Sin Cerco)". **• Entidad Collar Inteligente:** Conserva su vínculo con el animal y pasa a estado de cerco "Sincronización Pendiente". |

#### **CUU-026 — Asignar masivamente un lote de animales a una zona / cerco virtual**

| CASO DE USO USUARIO: CUU-026 | Asignar masivamente un lote de animales a una zona / cerco virtual |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-005 — Asignación y Movimiento de Animales entre Zonas/Cercos y entre Campos (Ref. Inicial: CU005) |
| **Roles de Negocio que Actúan** | **Administrador de Campo, Empleado Operador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Asignar un grupo de animales seleccionados en bloque a una misma zona o cerco virtual en un solo paso operativo. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Administrador de Campo o Empleado Operador del campo. **• Entidades Animal (todo el lote seleccionado):** Pertenecen al mismo Campo y TODOS poseen un Collar Inteligente vinculado activo. **• Entidad Zona / Cerco Virtual (Destino):** Pertenece al mismo Campo y está en estado "Activo". |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario selecciona múltiples animales del rodeo y elige la acción masiva de asignar a cerco virtual. 2\. Selecciona la Zona / Cerco Virtual de destino y confirma la operación. 3\. El sistema comprueba que todos los animales del lote tengan collar activo colocado. 4\. De forma conjunta para todos los animales del lote, el sistema finaliza sus asignaciones de cerco previas (si las tenían), crea las nuevas Asignaciones vigentes hacia el cerco elegido y marca todos sus Collares Inteligentes con "Sincronización Pendiente". |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. Uno o más animales del lote seleccionado no tienen collar colocado:** El sistema cancela la operación completa e informa las caravanas de los animales que carecen de collar para que el usuario los desmarque o les vincule un collar primero. Ningún animal del lote cambia de estado. |
| **Postcondiciones y Estado Final de las Entidades** | • Entidades Asignación de Animal a Zona / Cerco Virtual (Anteriores del lote): Pasan todas a estado "Finalizada / Histórica". **• Entidades Asignación de Animal a Zona / Cerco Virtual (Nuevas del lote):** Se crea una en estado "Vigente / Activa" por cada animal del lote hacia el cerco destino. **• Entidades Animal (del lote):** Quedan todos en estado "Activo en el Rodeo (Con Collar y Contenido en Cerco)". **• Entidades Collar Inteligente (del lote):** Pasan todos a estado "Sincronización Pendiente". |

#### **CUU-027 — Desvincular masivamente un lote de animales de su zona / cerco virtual**

| CASO DE USO USUARIO: CUU-027 | Desvincular masivamente un lote de animales de su zona / cerco virtual |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-005 — Asignación y Movimiento de Animales entre Zonas/Cercos y entre Campos (Ref. Inicial: CU005) |
| **Roles de Negocio que Actúan** | **Administrador de Campo, Empleado Operador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Dejar sin cerco virtual asignado a un conjunto de animales seleccionados en una sola acción. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Administrador de Campo o Empleado Operador del campo. **• Entidades Animal (del lote):** En estado "Activo en el Rodeo". |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario selecciona varios animales y ejecuta la acción masiva de desasignar del cerco actual. 2\. El sistema finaliza todas las Asignaciones a Zona / Cerco Virtual vigentes de los animales seleccionados y marca sus Collares Inteligentes con "Sincronización Pendiente". |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Ninguno. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades Asignación de Animal a Zona / Cerco Virtual (del lote):** Pasan del estado "Vigente / Activa" al estado "Finalizada / Histórica". **• Entidades Animal (del lote):** Pasan al estado "Activo en el Rodeo (Con Collar y Sin Cerco)". **• Entidades Collar Inteligente (del lote):** Pasan a estado "Sincronización Pendiente". |

#### **CUU-028 — Trasladar masivamente un lote de animales y sus collares vinculados hacia otro campo**

| CASO DE USO USUARIO: CUU-028 | Trasladar masivamente un lote de animales y sus collares vinculados hacia otro campo |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-005 — Asignación y Movimiento de Animales entre Zonas/Cercos y entre Campos (Ref. Inicial: CU005) |
| **Roles de Negocio que Actúan** | **Administrador de Campo, Empleado Operador (con rol de Operador en ambos campos), Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Registrar el traslado físico y administrativo de un grupo de animales desde un campo de origen hacia otro campo de destino, trasladando con ellos los collares que llevan puestos, cerrando sus cercos anteriores y dejando constancia en su historia clínica. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Debe poseer permisos de gestión (Administrador de Campo o Empleado Operador) TANTO en el Campo de origen como en el Campo de destino. **• Entidad Campo (Destino):** Se encuentra en estado "Activa". **• Entidades Animal (del lote):** Se encuentran en estado "Activo en el Rodeo" en el Campo de origen. |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario selecciona uno o varios animales en el campo de origen y elige la opción de trasladar a otro campo. 2\. Selecciona el Campo de destino y confirma el traslado. 3\. El sistema verifica que el usuario tenga permisos de operación en ambos campos y ejecuta de manera integral el traslado:    a) Finaliza las Asignaciones a Zona / Cerco Virtual que los animales tuvieran vigentes en el campo de origen.    b) Cambia el campo de pertenencia de todos los Animales del lote hacia el Campo de destino.    c) Cambia el campo de pertenencia de todos los Collares Inteligentes que esos animales llevan colocados hacia el Campo de destino.    d) Registra un evento en el Historial Clínico de cada animal dejando asentado su traslado hacia el nuevo campo. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. El usuario es solo Empleado Observador en alguno de los dos campos o no tiene acceso al campo de destino: El sistema bloquea el traslado por falta de permisos. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades Animal (del lote):** Permanecen en estado "Activo en el Rodeo", ahora pertenecientes al Campo de destino, conservando su collar colocado pero quedando "Sin Cerco" en el nuevo campo. • Entidades Asignación de Animal a Zona / Cerco Virtual (en el campo origen): Pasan a estado "Finalizada / Histórica". **• Entidades Collar Inteligente (colocados en los animales trasladados):** Mantienen su estado "Vinculado a Animal (En Uso)" y pasan a pertenecer al inventario del Campo de destino. **• Entidades Registro Médico (Nuevas):** Se crea un registro de ciclo de vida en el historial clínico de cada animal documentando el cambio de establecimiento. |

#### **CUU-029 — Consultar y filtrar los animales actualmente contenidos dentro de una zona / cerco específico**

| CASO DE USO USUARIO: CUU-029 | Consultar y filtrar los animales actualmente contenidos dentro de una zona / cerco específico |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-005 — Asignación y Movimiento de Animales entre Zonas/Cercos y entre Campos (Ref. Inicial: CU005) |
| **Roles de Negocio que Actúan** | **Administrador de Campo, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Conocer el detalle exacto de qué cabezas de ganado se encuentran asignadas en este momento a un potrero o cerco virtual determinado. |
| **Precondiciones y Estado Inicial de las Entidades** | • El usuario tiene acceso de consulta al Campo. **• Entidad Zona / Cerco Virtual:** Existe en el campo. |
| **Flujo Básico (Paso a Paso)** | 1\. Desde la vista de cercos o desde el listado de animales, el usuario filtra por una Zona / Cerco Virtual específico. 2\. El sistema lista todos los Animales en estado "Activo en el Rodeo" cuya Asignación a esa Zona / Cerco Virtual se encuentra en estado "Vigente / Activa", mostrando su caravana, categoría, collar vinculado y estado sanitario. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. La zona o cerco no posee animales asignados actualmente:** El sistema informa que hay 0 animales contenidos en ese cerco. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades de Negocio:** Sin cambios (consulta de ocupación de potrero). |

### **CUR-006: Gestión del Catálogo Global de Tipos de Animal**

| CASO DE USO RESUMEN — CUR-006 (Base: CU006) | Gestión del Catálogo Global de Tipos de Animal |
| :---- | :---- |
| **Nivel Jerárquico** | Caso de Uso Resumen (Módulo de Negocio) |
| **Roles de Negocio que Actúan** | **Superadministrador (gestión completa del catálogo), Administrador de Campo, Empleado Operador y Empleado Observador (consulta al gestionar animales)** |
| **Objetivo de Negocio** | Mantener el catálogo estandarizado de categorías y especies animales de la plataforma (por ejemplo, Bovino de Carne, Bovino de Leche, Ovino) bajo control exclusivo del Superadministrador, permitiendo dar de alta, editar, dar de baja lógica sin afectar a los animales existentes y reactivar categorías. |
| **Entidades de Negocio** | Tipo de Animal, Animal |
| **Control de Estados del Módulo** | Controla el paso de cada Tipo de Animal entre los estados "Activo" y "Dado de Baja / Inactivo", garantizando que los animales registrados nunca pierdan su clasificación histórica. |
| **Casos de Uso Usuario (5)** | • CUU-030: Consultar el catálogo de tipos de animal y la cantidad de animales asociados a cada categoría • CUU-031: Registrar un nuevo tipo de animal en el catálogo global • CUU-032: Editar el nombre, especie o descripción de un tipo de animal existente • CUU-033: Dar de baja lógica un tipo de animal conservando la clasificación histórica del ganado • CUU-034: Reactivar un tipo de animal previamente dado de baja |

#### **CUU-030 — Consultar el catálogo de tipos de animal y la cantidad de animales asociados a cada categoría**

| CASO DE USO USUARIO: CUU-030 | Consultar el catálogo de tipos de animal y la cantidad de animales asociados a cada categoría |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-006 — Gestión del Catálogo Global de Tipos de Animal (Ref. Inicial: CU006) |
| **Roles de Negocio que Actúan** | **Superadministrador (ve activos e inactivos), Administrador de Campo, Empleado Operador, Empleado Observador (ven tipos activos)** |
| **Necesidad / Objetivo** | Conocer las categorías de animales disponibles en el sistema y, en el caso del Superadministrador, supervisar también las categorías dadas de baja y cuántas cabezas de ganado pertenecen a cada una. |
| **Precondiciones y Estado Inicial de las Entidades** | • El usuario posee una sesión activa en la plataforma. |
| **Flujo Básico (Paso a Paso)** | 1\. El Superadministrador accede al módulo de Tipos de Animal (o bien un Administrador de Campo / Empleado despliega las categorías al gestionar el rodeo). 2\. El sistema presenta el listado de Tipos de Animal mostrando su nombre, especie, descripción, estado ("Activo" o "Dado de Baja") y el total de animales asociados a cada tipo. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Un Administrador de Campo o Empleado intenta ingresar a la pantalla de administración del catálogo global: El sistema no se lo permite por ser una función exclusiva del Superadministrador. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades de Negocio:** Sin cambios. |

#### **CUU-031 — Registrar un nuevo tipo de animal en el catálogo global**

| CASO DE USO USUARIO: CUU-031 | Registrar un nuevo tipo de animal en el catálogo global |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-006 — Gestión del Catálogo Global de Tipos de Animal (Ref. Inicial: CU006) |
| **Roles de Negocio que Actúan** | **Superadministrador** |
| **Necesidad / Objetivo** | Incorporar una nueva categoría o especie animal al catálogo maestro para que todos los campos puedan clasificar su ganado con ella. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Superadministrador con sesión activa. • No existe otro Tipo de Animal en estado "Activo" con el mismo nombre. |
| **Flujo Básico (Paso a Paso)** | 1\. El Superadministrador selecciona la opción de agregar un nuevo Tipo de Animal. 2\. Ingresa el nombre de la categoría, la especie y una descripción opcional, y confirma el alta. 3\. El sistema verifica que el nombre no esté repetido entre los tipos activos y registra el nuevo Tipo de Animal en estado "Activo". |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. Ya existe un Tipo de Animal en estado "Activo" con ese mismo nombre:** El sistema rechaza el alta e informa que la categoría ya se encuentra activa. • A2. Ya existía un Tipo de Animal con ese mismo nombre pero en estado "Dado de Baja / Inactivo": El sistema lo reactiva automáticamente pasándolo a estado "Activo" y actualizando su especie y descripción (ver CUU-034). |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Tipo de Animal (Nueva):** Queda creada en estado "Activo", disponible inmediatamente para clasificar animales en todos los campos. |

#### **CUU-032 — Editar el nombre, especie o descripción de un tipo de animal existente**

| CASO DE USO USUARIO: CUU-032 | Editar el nombre, especie o descripción de un tipo de animal existente |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-006 — Gestión del Catálogo Global de Tipos de Animal (Ref. Inicial: CU006) |
| **Roles de Negocio que Actúan** | **Superadministrador** |
| **Necesidad / Objetivo** | Corregir o actualizar la denominación, especie o descripción de una categoría animal del catálogo. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Superadministrador con sesión activa. **• Entidad Tipo de Animal:** Existe en el catálogo. |
| **Flujo Básico (Paso a Paso)** | 1\. El Superadministrador selecciona la opción de editar sobre un Tipo de Animal. 2\. Modifica el nombre, la especie o la descripción y guarda los cambios. 3\. El sistema comprueba que el nuevo nombre no pertenezca a otro Tipo de Animal y actualiza la categoría. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. El nuevo nombre coincide con el de otro Tipo de Animal distinto:** El sistema impide el cambio e informa la duplicidad. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Tipo de Animal:** Queda actualizada con sus nuevos datos descriptivos, manteniendo su estado actual ("Activo" o "Dado de Baja") y conservando su vínculo con todos los animales asociados. |

#### **CUU-033 — Dar de baja lógica un tipo de animal conservando la clasificación histórica del ganado**

| CASO DE USO USUARIO: CUU-033 | Dar de baja lógica un tipo de animal conservando la clasificación histórica del ganado |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-006 — Gestión del Catálogo Global de Tipos de Animal (Ref. Inicial: CU006) |
| **Roles de Negocio que Actúan** | **Superadministrador** |
| **Necesidad / Objetivo** | Deshabilitar una categoría animal para que ya no pueda asignarse a nuevos animales, sin borrar ni alterar las fichas de los animales que ya la tenían asignada. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Superadministrador con sesión activa. **• Entidad Tipo de Animal:** Se encuentra en estado "Activo". |
| **Flujo Básico (Paso a Paso)** | 1\. El Superadministrador selecciona la opción de dar de baja sobre un Tipo de Animal activo y confirma la decisión. 2\. El sistema cambia el estado del Tipo de Animal a "Dado de Baja / Inactivo", ocultándolo de las listas de selección de nuevas altas de animales. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. El Tipo de Animal ya se encontraba en estado "Dado de Baja / Inactivo": El sistema informa que ya estaba desactivado. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Tipo de Animal:** Pasa del estado "Activo" al estado "Dado de Baja / Inactivo". **• Entidades Animal (que tenían asignado ese tipo):** Permanecen intactas sin perder su categoría ni su historia. |

#### **CUU-034 — Reactivar un tipo de animal previamente dado de baja**

| CASO DE USO USUARIO: CUU-034 | Reactivar un tipo de animal previamente dado de baja |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-006 — Gestión del Catálogo Global de Tipos de Animal (Ref. Inicial: CU006) |
| **Roles de Negocio que Actúan** | **Superadministrador** |
| **Necesidad / Objetivo** | Volver a habilitar en el catálogo operativo una categoría de animal que había sido dada de baja. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Superadministrador con sesión activa. **• Entidad Tipo de Animal:** Se encuentra en estado "Dado de Baja / Inactivo". |
| **Flujo Básico (Paso a Paso)** | 1\. En el listado del catálogo (mostrando inactivos), el Superadministrador selecciona la opción de reactivar sobre un Tipo de Animal dado de baja. 2\. El sistema cambia el estado del Tipo de Animal a "Activo". |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Ninguno. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Tipo de Animal:** Pasa del estado "Dado de Baja / Inactivo" al estado "Activo", volviendo a estar disponible en todos los campos. |

### **CUR-007: Gestión de Animales del Rodeo (Alta, Consulta, Edición y Baja)**

| CASO DE USO RESUMEN — CUR-007 (Base: CU007) | Gestión de Animales del Rodeo (Alta, Consulta, Edición y Baja) |
| :---- | :---- |
| **Nivel Jerárquico** | Caso de Uso Resumen (Módulo de Negocio) |
| **Roles de Negocio que Actúan** | **Administrador de Campo, Empleado Operador (gestión completa), Empleado Observador (solo consulta), Superadministrador (en modo asistencia)** |
| **Objetivo de Negocio** | Administrar la totalidad del ciclo de vida de cada animal perteneciente a un campo: desde su incorporación al rodeo (con colocación opcional de un collar disponible), búsqueda y filtrado avanzado, consulta de su ficha integral y actualización de datos productivos (con registro automático de pesaje), hasta su baja por Venta o por Defunción liberando automáticamente el collar y el cerco virtual. |
| **Entidades de Negocio** | Animal, Tipo de Animal, Collar Inteligente, Vínculo Animal–Collar, Zona / Cerco Virtual, Asignación de Animal a Zona / Cerco Virtual, Registro Médico, Alerta, Predicción de Salud |
| **Control de Estados del Módulo** | Controla el ciclo de vida del Animal: "Activo en el Rodeo (Sin Collar)", "Activo en el Rodeo (Con Collar y Sin Cerco)", "Activo en el Rodeo (Con Collar y Contenido en Cerco)", "Dado de Baja por Venta (Archivado)" y "Dado de Baja por Defunción (Archivado)", asegurando la liberación inmediata del Collar y del Cerco al producirse la baja. |
| **Casos de Uso Usuario (6)** | • CUU-035: Consultar, buscar y filtrar los animales del rodeo por múltiples criterios de negocio • CUU-036: Registrar el alta de un nuevo animal en el campo con colocación opcional de un collar disponible • CUU-037: Consultar la ficha integral de un animal (datos, collar actual e histórico, cerco, historia clínica y alertas) • CUU-038: Editar los datos de un animal con generación automática de registro médico de pesaje si cambia su peso • CUU-039: Dar de baja lógica (archivar) un animal por Venta liberando automáticamente su collar y su cerco virtual • CUU-040: Dar de baja lógica (archivar) un animal por Defunción liberando automáticamente su collar y su cerco virtual |

#### **CUU-035 — Consultar, buscar y filtrar los animales del rodeo por múltiples criterios de negocio**

| CASO DE USO USUARIO: CUU-035 | Consultar, buscar y filtrar los animales del rodeo por múltiples criterios de negocio |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-007 — Gestión de Animales del Rodeo (Alta, Consulta, Edición y Baja) (Ref. Inicial: CU007) |
| **Roles de Negocio que Actúan** | **Administrador de Campo, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Visualizar el padrón de animales del campo pudiendo filtrar por estado de ciclo de vida (Activos, Vendidos, Fallecidos), búsqueda por caravana o nombre, sexo, raza, tipo de animal, zona/cerco virtual, tenencia de collar y presencia de alertas activas. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Entidad Campo:** En estado "Activa", y el usuario tiene acceso a ella. |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario ingresa a la sección de Animales del campo. 2\. El sistema muestra la lista de animales indicando su caravana, nombre, categoría, raza, sexo, edad, peso actual, estado reproductivo, collar colocado (y su batería), zona/cerco virtual actual, riesgo sanitario y alertas. 3\. El usuario aplica cualquiera de los filtros disponibles para acotar el listado según su necesidad operativa. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. Ningún animal coincide con los filtros aplicados:** El sistema informa que no se encontraron animales para esa búsqueda y ofrece limpiar los filtros. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades de Negocio:** Sin cambios. |

#### **CUU-036 — Registrar el alta de un nuevo animal en el campo con colocación opcional de un collar disponible**

| CASO DE USO USUARIO: CUU-036 | Registrar el alta de un nuevo animal en el campo con colocación opcional de un collar disponible |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-007 — Gestión de Animales del Rodeo (Alta, Consulta, Edición y Baja) (Ref. Inicial: CU007) |
| **Roles de Negocio que Actúan** | **Administrador de Campo, Empleado Operador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Incorporar una nueva cabeza de ganado al rodeo del campo registrando sus datos identificatorios y productivos, y pudiendo vincularle en el mismo momento un collar libre del establecimiento. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Administrador de Campo o Empleado Operador con permisos en el campo. • No existe otro animal en el mismo campo con el mismo número de caravana. **• Entidad Tipo de Animal (seleccionada):** En estado "Activo". **• Si se elige asignarle un collar en el alta:** La entidad Collar Inteligente debe estar en estado "Disponible en Campo (Libre en Campo)" dentro de ese mismo campo. |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario abre el formulario de alta de animal e ingresa su caravana (obligatoria), nombre opcional, Tipo de Animal, raza, sexo, edad en meses, peso inicial en kilos, estado reproductivo y, opcionalmente, selecciona un Collar Inteligente disponible en el campo. 2\. El sistema verifica que la caravana sea única en el establecimiento y que el collar elegido (si se seleccionó uno) esté libre y operativo en el campo. 3\. El sistema crea el Animal en estado "Activo en el Rodeo" y, si se indicó un collar, crea el Vínculo Animal–Collar en estado "Activo / Vigente". |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. Ya existe un animal en el campo con esa misma caravana:** El sistema impide el registro e informa que la caravana ya está en uso. • A2. El collar seleccionado ya está colocado en otro animal o está Fuera de Servicio: El sistema rechaza la operación e informa que el collar no se encuentra disponible. |
| **Postcondiciones y Estado Final de las Entidades** | **• Si se dio de alta SIN collar:** Entidad Animal (Nueva) queda creada en estado "Activo en el Rodeo (Sin Collar)". **• Si se dio de alta CON collar:** Entidad Animal (Nueva) queda creada en estado "Activo en el Rodeo (Con Collar y Sin Cerco)"; Entidad Vínculo Animal–Collar (Nueva) queda en estado "Activo / Vigente"; Entidad Collar Inteligente pasa del estado "Disponible en Campo" al estado "Vinculado a Animal (En Uso)". |

#### **CUU-037 — Consultar la ficha integral de un animal (datos, collar actual e histórico, cerco, historia clínica y alertas)**

| CASO DE USO USUARIO: CUU-037 | Consultar la ficha integral de un animal (datos, collar actual e histórico, cerco, historia clínica y alertas) |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-007 — Gestión de Animales del Rodeo (Alta, Consulta, Edición y Baja) (Ref. Inicial: CU007) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Acceder al expediente completo de un animal específico para revisar su información productiva, qué collar tiene puesto, en qué zona está, los collares que usó en el pasado, todos sus eventos médicos y sus últimas alertas. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Entidad Animal:** Existe y pertenece a una granja a la que el usuario tiene acceso. |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario selecciona un animal del listado para abrir su ficha detallada. 2\. El sistema presenta de forma consolidada: sus datos filiatorios y productivos, el estado de su collar actual, su zona/cerco virtual actual, la línea de tiempo de sus Registros Médicos, sus Alertas recientes y el historial de Vínculos Animal–Collar. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Ninguno. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades de Negocio:** Sin cambios. |

#### **CUU-038 — Editar los datos de un animal con generación automática de registro médico de pesaje si cambia su peso**

| CASO DE USO USUARIO: CUU-038 | Editar los datos de un animal con generación automática de registro médico de pesaje si cambia su peso |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-007 — Gestión de Animales del Rodeo (Alta, Consulta, Edición y Baja) (Ref. Inicial: CU007) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Actualizar la caravana, nombre, categoría, raza, sexo, edad, estado reproductivo o peso actual de un animal, dejando asentado automáticamente un evento de Pesaje en su historia clínica cuando se modifique su peso. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Administrador de Granja o Empleado Operador de la granja. **• Entidad Animal:** Existe en la granja. |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario edita la ficha del animal modificando los datos necesarios (por ejemplo, actualizando su peso en kilos) y confirma el guardado. 2\. El sistema compara el nuevo peso ingresado con el peso que tenía registrado el animal anteriormente. 3\. El sistema actualiza los datos en la ficha del Animal y, si el peso cambió a un valor distinto del anterior, crea automáticamente un nuevo Registro Médico de tipo "Pesaje" con la fecha del día y el nuevo valor en kilos. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. Se editaron otros datos del animal pero el peso no varió:** Se actualiza la ficha del Animal sin crear un nuevo Registro Médico de pesaje. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Animal:** Queda actualizada con sus nuevos atributos productivos y peso actual. **• Entidad Registro Médico (Nueva, si se modificó el peso):** Queda creada en estado "Registrado en Historial Clínico" bajo el tipo "Pesaje" con el nuevo kilaje. |

#### **CUU-039 — Dar de baja lógica (archivar) un animal por Venta liberando automáticamente su collar y su cerco virtual**

| CASO DE USO USUARIO: CUU-039 | Dar de baja lógica (archivar) un animal por Venta liberando automáticamente su collar y su cerco virtual |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-007 — Gestión de Animales del Rodeo (Alta, Consulta, Edición y Baja) (Ref. Inicial: CU007) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Registrar que un animal fue vendido y ya no forma parte del rodeo activo de la granja, conservando toda su historia clínica y biométrica pero dejando inmediatamente libre su collar y cerrando su asignación de cerco virtual. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Administrador de Granja o Empleado Operador de la granja. **• Entidad Animal:** Se encuentra en estado "Activo en el Rodeo" (con o sin collar/cerco). |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario selecciona la opción de dar de baja al animal, indica como motivo "Venta" y confirma la operación. 2\. El sistema ejecuta de manera conjunta e indivisible las siguientes acciones de negocio:    a) Cambia el estado del Animal a "Dado de Baja por Venta (Archivado)".    b) Si el animal tenía un collar colocado, finaliza el Vínculo Animal–Collar con la fecha y hora actual, dejando el Collar Inteligente libre en la granja.    c) Si el animal estaba contenido en una zona o cerco virtual, finaliza su Asignación a Zona / Cerco Virtual.    d) Crea un Registro Médico en el historial clínico del animal dejando constancia de la fecha y del motivo de la baja por Venta. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. El usuario cancela la confirmación de baja:** Ninguna entidad modifica su estado. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Animal:** Pasa del estado "Activo en el Rodeo" al estado "Dado de Baja por Venta (Archivado)", quedando sin collar y sin cerco asignado pero conservando todo su historial. **• Entidad Vínculo Animal–Collar (si tenía collar puesto):** Pasa del estado "Activo / Vigente" al estado "Finalizado / Histórico". **• Entidad Collar Inteligente (el que portaba el animal):** Pasa del estado "Vinculado a Animal (En Uso)" al estado "Disponible en Granja (Libre en Establecimiento)", listo para ser colocado en otro animal de esa granja. **• Entidad Asignación de Animal a Zona / Cerco Virtual (si tenía cerco):** Pasa del estado "Vigente / Activa" al estado "Finalizada / Histórica". **• Entidad Registro Médico (Nueva):** Queda creado el asiento de auditoría clínica por baja por Venta. |

#### **CUU-040 — Dar de baja lógica (archivar) un animal por Defunción liberando automáticamente su collar y su cerco virtual**

| CASO DE USO USUARIO: CUU-040 | Dar de baja lógica (archivar) un animal por Defunción liberando automáticamente su collar y su cerco virtual |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-007 — Gestión de Animales del Rodeo (Alta, Consulta, Edición y Baja) (Ref. Inicial: CU007) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Registrar el fallecimiento de un animal del rodeo preservando sus registros sanitarios y lecturas previas para análisis veterinario, y liberando en el acto el collar que llevaba puesto y su asignación de cerco. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Administrador de Granja o Empleado Operador de la granja. **• Entidad Animal:** Se encuentra en estado "Activo en el Rodeo". |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario selecciona la opción de dar de baja al animal, elige como motivo "Defunción / Muerte" y confirma la operación. 2\. El sistema ejecuta de manera conjunta e indivisible:    a) Cambia el estado del Animal a "Dado de Baja por Defunción (Archivado)".    b) Si tenía collar colocado, finaliza el Vínculo Animal–Collar dejando el Collar Inteligente libre en la granja.    c) Si estaba en un cerco, finaliza la Asignación de Animal a Zona / Cerco Virtual.    d) Registra en el Historial Clínico del animal la fecha y el motivo de baja por Defunción. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. El usuario cancela la confirmación:** No se producen cambios. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Animal:** Pasa del estado "Activo en el Rodeo" al estado "Dado de Baja por Defunción (Archivado)", sin collar y sin cerco. **• Entidad Vínculo Animal–Collar (si tenía collar):** Pasa a estado "Finalizado / Histórico". **• Entidad Collar Inteligente:** Pasa del estado "Vinculado a Animal (En Uso)" al estado "Disponible en Granja (Libre en Establecimiento)", listo para reutilizarse en otro animal. **• Entidad Asignación de Animal a Zona / Cerco Virtual (si tenía cerco):** Pasa a estado "Finalizada / Histórica". **• Entidad Registro Médico (Nueva):** Queda creado el asiento de baja por Defunción en su historia clínica. |

### **CUR-008: Gestión de Registros Médicos e Historial Clínico**

| CASO DE USO RESUMEN — CUR-008 (Base: CU008) | Gestión de Registros Médicos e Historial Clínico |
| :---- | :---- |
| **Nivel Jerárquico** | Caso de Uso Resumen (Módulo de Negocio) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador (registro y consulta), Empleado Observador (solo consulta), Superadministrador (en modo asistencia)** |
| **Objetivo de Negocio** | Permitir documentar y consultar cronológicamente todas las novedades clínicas, sanitarias y productivas de cada animal (Vacunación, Tratamiento, Cirugía, Parto y Pesaje), manteniendo automáticamente actualizado el peso del animal ante cada control de balanza. |
| **Entidades de Negocio** | Registro Médico, Animal |
| **Control de Estados del Módulo** | Incorpora nuevos Registros Médicos en estado "Registrado en Historial Clínico" y, cuando el evento es de tipo Pesaje, actualiza el atributo de Peso Actual en la entidad Animal. |
| **Casos de Uso Usuario (3)** | • CUU-041: Consultar el historial clínico completo de un animal • CUU-042: Registrar un evento clínico sanitario (Vacunación, Tratamiento, Cirugía o Parto) en un animal • CUU-043: Registrar un evento médico de Pesaje actualizando automáticamente el peso actual del animal |

#### **CUU-041 — Consultar el historial clínico completo de un animal**

| CASO DE USO USUARIO: CUU-041 | Consultar el historial clínico completo de un animal |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-008 — Gestión de Registros Médicos e Historial Clínico (Ref. Inicial: CU008) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Revisar ordenados por fecha todos los eventos sanitarios, vacunaciones, tratamientos, cirugías, partos, pesajes y movimientos registrados para un animal. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Entidad Animal:** Pertenece a una granja a la que el usuario tiene acceso. |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario abre la ficha del animal y accede a su Historial Médico. 2\. El sistema muestra la línea de tiempo ordenada desde el evento más reciente al más antiguo, detallando fecha, tipo de evento, descripción y valor asociado. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. El animal aún no posee eventos registrados:** El sistema informa que no hay antecedentes médicos cargados para ese animal. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades de Negocio:** Sin cambios. |

#### **CUU-042 — Registrar un evento clínico sanitario (Vacunación, Tratamiento, Cirugía o Parto) en un animal**

| CASO DE USO USUARIO: CUU-042 | Registrar un evento clínico sanitario (Vacunación, Tratamiento, Cirugía o Parto) en un animal |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-008 — Gestión de Registros Médicos e Historial Clínico (Ref. Inicial: CU008) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Dejar asentada una intervención veterinaria o un evento reproductivo en la historia clínica de un animal. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Administrador de Granja o Empleado Operador de la granja. **• Entidad Animal:** Existe en la granja. |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario selecciona la opción de registrar un nuevo evento médico para el animal. 2\. Elige el tipo de evento ("Vacunación", "Tratamiento", "Cirugía" o "Parto"), indica la fecha, redacta la descripción u observación veterinaria e ingresa opcionalmente un valor numérico de referencia. 3\. El sistema guarda el nuevo Registro Médico vinculándolo al animal. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. Un Empleado Observador intenta cargar un evento médico:** El sistema no se lo permite por poseer rol exclusivo de lectura. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Registro Médico (Nueva):** Queda creada en estado "Registrado en Historial Clínico" asociada al Animal. **• Entidad Animal:** Conserva su estado y su peso actual sin alteraciones. |

#### **CUU-043 — Registrar un evento médico de Pesaje actualizando automáticamente el peso actual del animal**

| CASO DE USO USUARIO: CUU-043 | Registrar un evento médico de Pesaje actualizando automáticamente el peso actual del animal |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-008 — Gestión de Registros Médicos e Historial Clínico (Ref. Inicial: CU008) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Anotar el resultado de un pesaje en balanza dentro del historial del animal y reflejar automáticamente ese nuevo kilaje como peso actual en su ficha. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Administrador de Granja o Empleado Operador de la granja. **• Entidad Animal:** Existe en la granja. |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario abre el registro de nuevo evento médico y selecciona el tipo "Pesaje". 2\. Ingresa el peso medido en kilogramos, la fecha y una nota opcional, y confirma el registro. 3\. El sistema guarda el nuevo Registro Médico de Pesaje y, en el mismo acto, actualiza el Peso Actual en la ficha del Animal con el nuevo valor ingresado. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. Se ingresa un valor de peso negativo o inválido:** El sistema rechaza el dato y solicita un kilaje válido. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Registro Médico (Nueva):** Queda creada en estado "Registrado en Historial Clínico" con tipo "Pesaje" y el valor en kilos. **• Entidad Animal:** Queda actualizada con su nuevo Peso Actual en kilogramos. |

### **CUR-009: Gestión de Collares Inteligentes (Stock Central, Asignación a Granjas y Vinculación a Animales)**

| CASO DE USO RESUMEN — CUR-009 (Base: CU009) | Gestión de Collares Inteligentes (Stock Central, Asignación a Granjas y Vinculación a Animales) |
| :---- | :---- |
| **Nivel Jerárquico** | Caso de Uso Resumen (Módulo de Negocio) |
| **Roles de Negocio que Actúan** | **Superadministrador (gestión del Stock Central, alta, edición de identificadores, entrega/retiro a granjas de clientes, baja y eliminación), Administrador de Granja y Empleado Operador (vinculación/desvinculación a animales y estado Disponible/Fuera de Servicio), Empleado Observador (solo consulta)** |
| **Objetivo de Negocio** | Tener un control total sobre cada Collar Inteligente a lo largo de toda su vida útil: desde su ingreso al Stock Central, identificación por código QR, asignación comercial a las granjas de los Administradores de Granja respetando su cupo contratado, colocación y retiro sobre los animales del rodeo (sincronizado con los cercos virtuales), paso a mantenimiento (Fuera de Servicio), baja lógica (Archivado) y eliminación definitiva cuando no posee historial. |
| **Entidades de Negocio** | Collar Inteligente, Vínculo Animal–Collar, Animal, Asignación de Animal a Zona / Cerco Virtual, Granja, Usuario (Administrador de Granja), Lectura Biométrica y de Ubicación |
| **Control de Estados del Módulo** | Controla todos los estados posibles del Collar Inteligente ("En Stock Central", "Disponible en Granja", "Vinculado a Animal", "Fuera de Servicio", "Dado de Baja / Archivado" y "Eliminado Definitivamente") y el impacto directo de cada movimiento sobre el Animal, su Cerco Virtual y el Cupo Contratado del cliente. |
| **Casos de Uso Usuario (12)** | • CUU-044: Consultar y filtrar el inventario de collares y su historial de animales portadores • CUU-045: Registrar un nuevo collar inteligente en el Stock Central • CUU-046: Leer el código QR físico de un collar para agilizar su alta o localizarlo en el inventario • CUU-047: Editar el número de dispositivo o el código identificador de un collar • CUU-048: Asignar un collar desde el Stock Central a la granja de un cliente controlando su cupo contratado • CUU-049: Desasignar un collar de una granja devolviéndolo al Stock Central (con desvinculación automática de animal) • CUU-050: Vincular (colocar) un collar disponible de la granja a un animal activo • CUU-051: Desvincular (retirar) un collar de un animal liberando el collar y cerrando automáticamente el cerco virtual del animal • CUU-052: Cambiar el estado operativo de un collar entre Disponible y Fuera de Servicio • CUU-053: Dar de baja lógica (archivar) un collar liberando al animal y devolviendo el cupo al Administrador de Granja • CUU-054: Reactivar (restaurar) un collar archivado devolviéndolo al Stock Central como Disponible • CUU-055: Eliminar definitivamente un collar sin historial o derivarlo a baja lógica si registra uso previo |

#### **CUU-044 — Consultar y filtrar el inventario de collares y su historial de animales portadores**

| CASO DE USO USUARIO: CUU-044 | Consultar y filtrar el inventario de collares y su historial de animales portadores |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-009 — Gestión de Collares Inteligentes (Stock Central, Asignación a Granjas y Vinculación a Animales) (Ref. Inicial: CU009) |
| **Roles de Negocio que Actúan** | **Superadministrador (ve todo el parque incluido Stock Central), Administrador de Granja, Empleado Operador, Empleado Observador (ven los collares de sus granjas)** |
| **Necesidad / Objetivo** | Supervisar el listado de collares conociendo su estado actual, batería, última señal, granja asignada, animal que lo lleva puesto, estado de sincronización del cerco virtual y todos los animales que usaron ese collar anteriormente. |
| **Precondiciones y Estado Inicial de las Entidades** | • El usuario posee sesión activa en el sistema. |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario ingresa al módulo de Collares. 2\. Si es el Superadministrador, el sistema muestra todos los collares de la plataforma (en Stock Central, en granjas de clientes y archivados), permitiendo filtrar por Administrador de Granja, por establecimiento y por estado. 3\. Si es un Administrador de Granja o un Empleado (Operador u Observador), el sistema muestra únicamente los collares asignados a las granjas donde tiene acceso. 4\. Al abrir el detalle de un collar, el sistema exhibe su última lectura recibida y el historial cronológico de Vínculos Animal–Collar (qué animales lo llevaron puesto y entre qué fechas). |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Un Administrador de Granja o Empleado intenta consultar un collar perteneciente a otro cliente o al Stock Central: El sistema impide el acceso. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades de Negocio:** Sin cambios. |

#### **CUU-045 — Registrar un nuevo collar inteligente en el Stock Central**

| CASO DE USO USUARIO: CUU-045 | Registrar un nuevo collar inteligente en el Stock Central |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-009 — Gestión de Collares Inteligentes (Stock Central, Asignación a Granjas y Vinculación a Animales) (Ref. Inicial: CU009) |
| **Roles de Negocio que Actúan** | **Superadministrador** |
| **Necesidad / Objetivo** | Incorporar un nuevo collar físico recién fabricado o adquirido al inventario central de la plataforma para que quede libre en stock y pueda luego asignarse a la granja de algún cliente. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Superadministrador con sesión activa. • No existe ningún otro Collar Inteligente registrado con el mismo número de dispositivo ni con el mismo código identificador. |
| **Flujo Básico (Paso a Paso)** | 1\. El Superadministrador selecciona la opción de registrar un nuevo collar en stock. 2\. Ingresa el número único del dispositivo (por ejemplo, 105\) y su código identificador de etiqueta (por ejemplo, COLLAR-105), y confirma el alta. 3\. El sistema comprueba que ni el número ni el código identificador estén duplicados y registra el nuevo Collar Inteligente dentro del Stock Central. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. El número de dispositivo o el código identificador ya existen en otro collar: El sistema rechaza el alta e informa cuál de los dos datos está duplicado. **• A2. Un Administrador de Granja o Empleado intenta crear un collar:** El sistema deniega la acción por ser facultad exclusiva del Superadministrador. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Collar Inteligente (Nueva):** Queda creada en estado "En Stock Central (Libre)", sin granja asignada, sin animal vinculado y con estado operativo "Disponible". |

#### **CUU-046 — Leer el código QR físico de un collar para agilizar su alta o localizarlo en el inventario**

| CASO DE USO USUARIO: CUU-046 | Leer el código QR físico de un collar para agilizar su alta o localizarlo en el inventario |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-009 — Gestión de Collares Inteligentes (Stock Central, Asignación a Granjas y Vinculación a Animales) (Ref. Inicial: CU009) |
| **Roles de Negocio que Actúan** | **Superadministrador, Administrador de Granja, Empleado Operador** |
| **Necesidad / Objetivo** | Identificar rápidamente un collar físico mediante la cámara del teléfono o computadora sin necesidad de escribir manualmente su código. |
| **Precondiciones y Estado Inicial de las Entidades** | • El usuario cuenta con cámara habilitada en su dispositivo. |
| **Flujo Básico (Paso a Paso)** | 1\. En la pantalla de Collares, el usuario pulsa la opción de escanear código QR y enfoca la etiqueta del collar. 2\. El sistema lee el número y código identificador del collar. 3a. Si el collar ya se encuentra registrado en el listado, el sistema filtra automáticamente la vista mostrando ese collar en pantalla. 3b. Si el collar aún no existe en el sistema y quien escanea es el Superadministrador, el sistema abre automáticamente el formulario de alta en Stock Central con los datos del collar ya completados. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. El código QR es ilegible o no corresponde al formato de un collar:** El sistema avisa al usuario y permite realizar la búsqueda o carga de forma manual. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades de Negocio:** Sin cambios directos hasta que el usuario confirme el alta o la acción sobre el collar localizado. |

#### **CUU-047 — Editar el número de dispositivo o el código identificador de un collar**

| CASO DE USO USUARIO: CUU-047 | Editar el número de dispositivo o el código identificador de un collar |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-009 — Gestión de Collares Inteligentes (Stock Central, Asignación a Granjas y Vinculación a Animales) (Ref. Inicial: CU009) |
| **Roles de Negocio que Actúan** | **Superadministrador** |
| **Necesidad / Objetivo** | Corregir el número identificatorio o el código de etiqueta de un collar registrado sin perder su historial de uso ni sus lecturas. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Superadministrador con sesión activa. **• Entidad Collar Inteligente:** Existe en el sistema. • El nuevo número y el nuevo código identificador no pertenecen a ningún otro collar. |
| **Flujo Básico (Paso a Paso)** | 1\. El Superadministrador selecciona la opción de editar los datos identificatorios de un collar. 2\. Modifica el número de dispositivo y/o el código identificador de etiqueta y guarda los cambios. 3\. El sistema verifica que los nuevos datos no estén en uso por otro collar y actualiza el Collar Inteligente, manteniendo vinculados todos sus antecedentes históricos y lecturas. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. El nuevo número o código ya está ocupado por otro collar:** El sistema impide el guardado e informa el conflicto. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Collar Inteligente:** Queda actualizada con su nuevo número y/o código identificador, conservando intacto su estado actual, su granja, su animal vinculado y todo su historial. |

#### **CUU-048 — Asignar un collar desde el Stock Central a la granja de un cliente controlando su cupo contratado**

| CASO DE USO USUARIO: CUU-048 | Asignar un collar desde el Stock Central a la granja de un cliente controlando su cupo contratado |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-009 — Gestión de Collares Inteligentes (Stock Central, Asignación a Granjas y Vinculación a Animales) (Ref. Inicial: CU009) |
| **Roles de Negocio que Actúan** | **Superadministrador** |
| **Necesidad / Objetivo** | Entregar un collar disponible del Stock Central (o reasignarlo desde otro campo) al inventario de una granja perteneciente a un Administrador de Granja, verificando previamente que el cliente tenga cupo disponible según su plan contratado. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Superadministrador con sesión activa. **• Entidad Collar Inteligente:** Se encuentra en estado "En Stock Central (Libre)" (o asignado a otra granja, no archivado). **• Entidad Granja (Destino):** Se encuentra en estado "Activa". • Entidad Usuario (Administrador de Granja dueño del establecimiento destino): Se encuentra en estado "Con cupo disponible" (la cantidad total de collares asignados a todas sus granjas es menor que su Cupo de Collares Contratados). |
| **Flujo Básico (Paso a Paso)** | 1\. El Superadministrador selecciona un collar y elige la opción de asignarlo a un campo. 2\. Selecciona primero al Administrador de Granja (cliente) y luego la Granja específica de ese cliente donde se destinará el collar. 3\. El sistema verifica cuántos collares activos tiene actualmente asignados ese Administrador de Granja entre todos sus establecimientos y comprueba que no alcance ni supere su Cupo de Collares Contratados. 4\. Si el collar venía reasignado desde otra granja donde estaba colocado en un animal, el sistema finaliza automáticamente ese Vínculo Animal–Collar anterior. 5\. El sistema asigna el Collar Inteligente a la Granja de destino. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. El Administrador de Granja tiene cupo contratado igual a 0 o ya alcanzó el límite máximo de su cupo: El sistema bloquea la asignación e informa que el cliente ya tiene ocupado el total de su cupo contratado, indicando que debe ampliarse primero su cupo comercial (CUU-010) o liberarse otro collar. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Collar Inteligente:** Pasa del estado "En Stock Central (Libre)" al estado "Disponible en Granja (Libre en Establecimiento)" dentro de la granja seleccionada. **• Entidad Usuario (Administrador de Granja):** Incrementa en 1 la cantidad de collares consumidos de su cupo contratado. • Entidad Vínculo Animal–Collar (si el collar venía de otra granja con un animal): Pasa a estado "Finalizado / Histórico". |

#### **CUU-049 — Desasignar un collar de una granja devolviéndolo al Stock Central (con desvinculación automática de animal)**

| CASO DE USO USUARIO: CUU-049 | Desasignar un collar de una granja devolviéndolo al Stock Central (con desvinculación automática de animal) |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-009 — Gestión de Collares Inteligentes (Stock Central, Asignación a Granjas y Vinculación a Animales) (Ref. Inicial: CU009) |
| **Roles de Negocio que Actúan** | **Superadministrador** |
| **Necesidad / Objetivo** | Retirar un collar del establecimiento de un cliente para que regrese al Stock Central de la plataforma, dejando libre al animal si el collar estaba en uso y devolviéndole 1 lugar de cupo disponible al Administrador de Granja. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Superadministrador con sesión activa. **• Entidad Collar Inteligente:** Se encuentra asignado a una Granja (ya sea en estado "Disponible en Granja" o "Vinculado a Animal"). |
| **Flujo Básico (Paso a Paso)** | 1\. El Superadministrador selecciona la opción de desvincular de la granja / devolver al Stock Central sobre el collar y confirma. 2\. Si el collar se encontraba colocado en un animal (en estado "Vinculado a Animal"), el sistema finaliza automáticamente el Vínculo Animal–Collar con la fecha y hora actual. 3\. El sistema quita la asignación de la granja y devuelve el Collar Inteligente al Stock Central. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Un Administrador de Granja o Empleado intenta devolver un collar al Stock Central: El sistema no lo permite por ser una operación exclusiva del Superadministrador. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Collar Inteligente:** Pasa al estado "En Stock Central (Libre)", sin granja asignada y sin animal vinculado, listo para asignarse a cualquier otro cliente. **• Entidad Vínculo Animal–Collar (si estaba colocado en un animal):** Pasa del estado "Activo / Vigente" al estado "Finalizado / Histórico". **• Entidad Animal (que portaba el collar):** Queda en su granja en estado "Activo en el Rodeo (Sin Collar)". **• Entidad Usuario (Administrador de Granja):** Recupera 1 lugar libre dentro de su Cupo de Collares Contratados. |

#### **CUU-050 — Vincular (colocar) un collar disponible de la granja a un animal activo**

| CASO DE USO USUARIO: CUU-050 | Vincular (colocar) un collar disponible de la granja a un animal activo |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-009 — Gestión de Collares Inteligentes (Stock Central, Asignación a Granjas y Vinculación a Animales) (Ref. Inicial: CU009) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Asociar un collar libre del inventario de la granja a un animal específico del rodeo que no tenga collar, para comenzar a monitorear su ubicación y salud y permitir asignarlo a zonas o cercos virtuales. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Administrador de Granja o Empleado Operador con permisos en la granja. **• Entidad Collar Inteligente:** Pertenece a la misma Granja y se encuentra en estado "Disponible en Granja (Libre en Establecimiento)". **• Entidad Animal:** Pertenece a la misma Granja y se encuentra en estado "Activo en el Rodeo (Sin Collar)". |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario selecciona un collar libre de la granja y elige la opción de vincularlo a un animal (o desde el animal elige asignarle collar). 2\. Selecciona el animal activo de la misma granja y confirma la vinculación. 3\. El sistema comprueba que el collar esté Disponible y sin animal, que el animal esté Activo y sin otro collar puesto, y que ambos pertenezcan al mismo establecimiento. 4\. El sistema crea el Vínculo Animal–Collar en estado "Activo / Vigente" con la fecha y hora de colocación. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. El collar se encuentra en estado "Fuera de Servicio" o "Dado de Baja / Archivado": El sistema rechaza la vinculación informando que el collar no está disponible para uso. • A2. El collar ya está colocado en otro animal, o el animal elegido ya tiene otro collar puesto: El sistema impide la asignación informando el conflicto. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Vínculo Animal–Collar (Nueva):** Queda creada en estado "Activo / Vigente" (con fecha de inicio y sin fecha de fin). **• Entidad Collar Inteligente:** Pasa del estado "Disponible en Granja (Libre en Establecimiento)" al estado "Vinculado a Animal (En Uso)". **• Entidad Animal:** Pasa del estado "Activo en el Rodeo (Sin Collar)" al estado "Activo en el Rodeo (Con Collar y Sin Cerco)", quedando habilitado para ser asignado a zonas y cercos virtuales. |

#### **CUU-051 — Desvincular (retirar) un collar de un animal liberando el collar y cerrando automáticamente el cerco virtual del animal**

| CASO DE USO USUARIO: CUU-051 | Desvincular (retirar) un collar de un animal liberando el collar y cerrando automáticamente el cerco virtual del animal |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-009 — Gestión de Collares Inteligentes (Stock Central, Asignación a Granjas y Vinculación a Animales) (Ref. Inicial: CU009) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador, Superadministrador** |
| **Necesidad / Objetivo** | Quitarle el collar a un animal para que el animal quede sin collar (y fuera de cualquier cerco virtual) y el collar quede en estado libre dentro de la misma granja, permitiendo asignárselo a otro animal. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Administrador de Granja o Empleado Operador de la granja (o Superadministrador). **• Entidad Collar Inteligente:** Se encuentra en estado "Vinculado a Animal (En Uso)". **• Entidad Vínculo Animal–Collar:** Se encuentra en estado "Activo / Vigente". **• Entidad Animal:** Se encuentra en estado "Activo en el Rodeo (Con Collar)" (con o sin cerco virtual asignado). |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario selecciona la opción de desvincular animal sobre un collar en uso (o quitar collar desde la ficha del animal) y confirma la acción. 2\. El sistema ejecuta de manera conjunta e indivisible las siguientes transiciones de estado:    a) Finaliza el Vínculo Animal–Collar vigente estampando la fecha y hora de retiro, conservándolo en el historial para que todas las lecturas tomadas hasta ese instante sigan perteneciendo a ese animal.    b) Si el animal se encontraba asignado a una Zona / Cerco Virtual, finaliza automáticamente su Asignación a Zona / Cerco Virtual en ese mismo instante (dado que un animal sin collar no puede permanecer contenido en un cerco virtual). |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. El collar seleccionado no tenía ningún animal vinculado actualmente:** El sistema informa que el collar ya se encontraba libre. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Vínculo Animal–Collar:** Pasa del estado "Activo / Vigente" al estado "Finalizado / Histórico" (con fecha y hora de fin registradas). • Entidad Asignación de Animal a Zona / Cerco Virtual (si el animal estaba en un cerco): Pasa automáticamente del estado "Vigente / Activa" al estado "Finalizada / Histórica". **• Entidad Animal:** Pasa al estado "Activo en el Rodeo (Sin Collar y Sin Cerco)". **• Entidad Collar Inteligente:** Pasa del estado "Vinculado a Animal (En Uso)" al estado "Disponible en Granja (Libre en Establecimiento)", permaneciendo en el inventario de la misma granja y quedando inmediatamente habilitado para vincularse a otro animal. |

#### **CUU-052 — Cambiar el estado operativo de un collar entre Disponible y Fuera de Servicio**

| CASO DE USO USUARIO: CUU-052 | Cambiar el estado operativo de un collar entre Disponible y Fuera de Servicio |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-009 — Gestión de Collares Inteligentes (Stock Central, Asignación a Granjas y Vinculación a Animales) (Ref. Inicial: CU009) |
| **Roles de Negocio que Actúan** | **Superadministrador, Administrador de Granja, Empleado Operador** |
| **Necesidad / Objetivo** | Declarar un collar como "Fuera de Servicio" cuando presenta fallas, rotura o batería agotada (desvinculándolo automáticamente si estaba puesto en un animal), o volverlo al estado "Disponible" una vez reparado. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Superadministrador, Administrador de Granja o Empleado Operador con permisos sobre el collar. **• Entidad Collar Inteligente:** No se encuentra dado de baja/archivado. |
| **Flujo Básico (Paso a Paso)** | 1a. Para pasar a Fuera de Servicio: El usuario cambia el estado del collar a "Fuera de Servicio". Si el collar tenía un animal vinculado, el sistema finaliza automáticamente el Vínculo Animal–Collar y deja el collar en estado "Fuera de Servicio". 1b. Para volver a Disponible: Una vez solucionado el desperfecto, el usuario cambia el estado del collar de "Fuera de Servicio" a "Disponible". |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Mientras el collar está en estado "Fuera de Servicio", cualquier intento de vincularlo a un animal es rechazado por el sistema (CUU-050). |
| **Postcondiciones y Estado Final de las Entidades** | **• Al pasar a Fuera de Servicio:** Entidad Collar Inteligente queda en estado "Fuera de Servicio"; si tenía un Vínculo Animal–Collar activo, este pasa a "Finalizado / Histórico" y el Animal queda "Activo en el Rodeo (Sin Collar)". **• Al volver a Disponible:** Entidad Collar Inteligente pasa a estado "Disponible en Granja (Libre en Establecimiento)" (o "En Stock Central" si no tenía granja), listo para volver a utilizarse. |

#### **CUU-053 — Dar de baja lógica (archivar) un collar liberando al animal y devolviendo el cupo al Administrador de Granja**

| CASO DE USO USUARIO: CUU-053 | Dar de baja lógica (archivar) un collar liberando al animal y devolviendo el cupo al Administrador de Granja |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-009 — Gestión de Collares Inteligentes (Stock Central, Asignación a Granjas y Vinculación a Animales) (Ref. Inicial: CU009) |
| **Roles de Negocio que Actúan** | **Superadministrador** |
| **Necesidad / Objetivo** | Retirar de circulación un collar extraviado, dañado de forma irreparable o dado de baja, conservando intacto todo su historial de lecturas y asignaciones pasadas pero liberando al animal que lo portaba y restituyendo el cupo al cliente. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Superadministrador con sesión activa. **• Entidad Collar Inteligente:** Se encuentra activo en el inventario (en Stock Central, Disponible en Granja, Vinculado a Animal o Fuera de Servicio). |
| **Flujo Básico (Paso a Paso)** | 1\. El Superadministrador selecciona la opción de dar de baja / archivar sobre el collar y confirma la decisión. 2\. El sistema ejecuta en un solo paso:    a) Si el collar estaba colocado en un animal, finaliza el Vínculo Animal–Collar.    b) Si el collar estaba asignado a una granja, le quita la asignación de granja (devolviendo 1 unidad de cupo libre al Administrador de Granja).    c) Cambia el estado del Collar Inteligente a "Dado de Baja / Archivado" (y fuera de servicio). |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. El collar ya se encontraba en estado "Dado de Baja / Archivado":** El sistema informa que ya estaba dado de baja. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Collar Inteligente:** Pasa al estado "Dado de Baja / Archivado", sin granja asignada y sin animal vinculado. **• Entidad Vínculo Animal–Collar (si tenía animal):** Pasa a estado "Finalizado / Histórico". **• Entidad Animal (si lo llevaba puesto):** Queda en estado "Activo en el Rodeo (Sin Collar)". • Entidad Usuario (Administrador de Granja, si el collar estaba en un campo suyo): Recupera 1 lugar disponible en su Cupo de Collares Contratados. **• Entidades Históricas (Vínculos pasados y Lecturas Biométricas):** Se conservan 100% intactas. |

#### **CUU-054 — Reactivar (restaurar) un collar archivado devolviéndolo al Stock Central como Disponible**

| CASO DE USO USUARIO: CUU-054 | Reactivar (restaurar) un collar archivado devolviéndolo al Stock Central como Disponible |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-009 — Gestión de Collares Inteligentes (Stock Central, Asignación a Granjas y Vinculación a Animales) (Ref. Inicial: CU009) |
| **Roles de Negocio que Actúan** | **Superadministrador** |
| **Necesidad / Objetivo** | Reincorporar al servicio activo un collar que había sido archivado (por ejemplo, si fue recuperado en el campo o reparado), dejándolo disponible en el Stock Central. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Superadministrador con sesión activa. **• Entidad Collar Inteligente:** Se encuentra en estado "Dado de Baja / Archivado". |
| **Flujo Básico (Paso a Paso)** | 1\. Filtrando los collares archivados, el Superadministrador selecciona la opción de restaurar / reactivar sobre el collar. 2\. El sistema cambia el estado del Collar Inteligente a "En Stock Central (Libre)" con condición operativa "Disponible". |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Ninguno. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Collar Inteligente:** Pasa del estado "Dado de Baja / Archivado" al estado "En Stock Central (Libre)", listo para ser asignado a una granja. |

#### **CUU-055 — Eliminar definitivamente un collar sin historial o derivarlo a baja lógica si registra uso previo**

| CASO DE USO USUARIO: CUU-055 | Eliminar definitivamente un collar sin historial o derivarlo a baja lógica si registra uso previo |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-009 — Gestión de Collares Inteligentes (Stock Central, Asignación a Granjas y Vinculación a Animales) (Ref. Inicial: CU009) |
| **Roles de Negocio que Actúan** | **Superadministrador** |
| **Necesidad / Objetivo** | Borrar por completo del sistema un collar que fue cargado por error y nunca se utilizó, impidiendo estrictamente el borrado definitivo de cualquier collar que haya tenido animales asignados o lecturas registradas. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Superadministrador con sesión activa. **• Entidad Collar Inteligente:** Existe en el sistema. |
| **Flujo Básico (Paso a Paso)** | 1\. El Superadministrador solicita eliminar el collar. 2\. El sistema comprueba si el collar registra algún Vínculo Animal–Collar (actual o histórico) o alguna Lectura Biométrica y de Ubicación. 3\. Al comprobar que el collar tiene 0 vínculos con animales y 0 lecturas en toda su historia, el sistema elimina definitivamente el registro del Collar Inteligente. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. El collar posee al menos un vínculo histórico con un animal o al menos una lectura registrada: El sistema bloquea la eliminación definitiva para proteger la trazabilidad histórica del rodeo y ofrece al Superadministrador aplicar en su lugar la Baja Lógica / Archivado del collar (CUU-053). |
| **Postcondiciones y Estado Final de las Entidades** | **• Camino Básico (Collar virgen sin historial):** Entidad Collar Inteligente pasa a estado "Eliminado Definitivamente" (desaparece del sistema). **• Camino Alternativo (Collar con historial):** No se elimina; si se confirma su baja, pasa al estado "Dado de Baja / Archivado" conservando toda su historia. |

### **CUR-010: Visualización en Tiempo Real, Recorridos Históricos y Mapas de Calor**

| CASO DE USO RESUMEN — CUR-010 (Base: CU010) | Visualización en Tiempo Real, Recorridos Históricos y Mapas de Calor |
| :---- | :---- |
| **Nivel Jerárquico** | Caso de Uso Resumen (Módulo de Negocio) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **Objetivo de Negocio** | Permitir a los usuarios supervisar geográficamente a los animales de la granja sobre el mapa satelital, viendo su posición actual en vivo, distinguiendo qué animales tienen señal reciente o alerta de escape, reconstruyendo sus trayectorias pasadas por fechas y analizando mapas de calor para detectar zonas de sobrepastoreo o áreas subutilizadas. |
| **Entidades de Negocio** | Animal, Collar Inteligente, Vínculo Animal–Collar, Lectura Biométrica y de Ubicación, Zona / Cerco Virtual, Alerta, Granja |
| **Control de Estados del Módulo** | Relaciona cada Lectura Biométrica y de Ubicación con el Animal que llevaba puesto el collar en ese instante exacto (según el Vínculo Animal–Collar vigente en esa fecha/hora), garantizando que los recorridos y mapas de calor sean fieles aunque los collares hayan rotado de animal. |
| **Casos de Uso Usuario (4)** | • CUU-056: Visualizar la ubicación en tiempo real del rodeo sobre el mapa de la granja con indicadores de señal y escape • CUU-057: Consultar y reproducir los recorridos históricos de uno o varios animales por rango de fechas • CUU-058: Generar y visualizar el mapa de calor de permanencia del ganado por período de tiempo • CUU-059: Identificar zonas de sobrepastoreo y detectar "zonas muertas" (subutilizadas) dentro de la granja |

#### **CUU-056 — Visualizar la ubicación en tiempo real del rodeo sobre el mapa de la granja con indicadores de señal y escape**

| CASO DE USO USUARIO: CUU-056 | Visualizar la ubicación en tiempo real del rodeo sobre el mapa de la granja con indicadores de señal y escape |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-010 — Visualización en Tiempo Real, Recorridos Históricos y Mapas de Calor (Ref. Inicial: CU010) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Observar en el mapa del establecimiento dónde se encuentra cada animal con collar en este momento, agrupando los animales cercanos y diferenciando cuáles tienen señal al día, cuáles llevan más de 6 horas sin reportar y cuáles presentan alerta de escape. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Entidad Granja:** En estado "Activa", y el usuario tiene acceso a ella. • Existen Animales en estado "Activo en el Rodeo (Con Collar)". |
| **Flujo Básico (Paso a Paso)** | 1\. En el mapa de la granja, el usuario activa la visualización de animales (pudiendo además filtrar por una Zona / Cerco Virtual determinado). 2\. El sistema consulta la última posición registrada por el collar de cada animal activo (tomando únicamente lecturas ocurridas desde que el collar le fue colocado a ese animal) y actualiza el mapa automáticamente cada 30 segundos. 3\. El sistema clasifica y muestra el estado de señal del rodeo: animales con señal en línea (últimas 6 horas), animales sin señal reciente (más de 6 horas) y collares recién colocados aún sin lecturas. 4\. Al seleccionar un animal en el mapa, se despliega su resumen con caravana, temperatura corporal, actividad, batería, tiempo desde su última lectura y acceso directo a su recorrido. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Un collar fue colocado recién en un animal y todavía no emitió ninguna lectura desde su colocación: El sistema no le atribuye la posición vieja del animal anterior; lo contabiliza como "collar sin datos" hasta que emita su primera señal en el nuevo animal. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades de Negocio:** Sin cambios (consulta de monitoreo en tiempo real). |

#### **CUU-057 — Consultar y reproducir los recorridos históricos de uno o varios animales por rango de fechas**

| CASO DE USO USUARIO: CUU-057 | Consultar y reproducir los recorridos históricos de uno o varios animales por rango de fechas |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-010 — Visualización en Tiempo Real, Recorridos Históricos y Mapas de Calor (Ref. Inicial: CU010) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Ver sobre el mapa el trayecto completo que caminaron uno o más animales durante un período de fechas elegido, respetando qué collar tuvo puesto cada animal en cada tramo de tiempo. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Entidad Granja:** En estado "Activa", con animales que registran lecturas de ubicación en el período consultado. |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario abre la función de Recorridos desde la granja o desde un animal en el mapa. 2\. Selecciona uno o varios animales y define la fecha/hora de inicio y de fin de la consulta (por defecto, las últimas 24 horas). 3\. El sistema identifica qué Collar Inteligente llevó puesto cada animal en cada tramo dentro de ese rango de fechas y recupera las lecturas de ubicación correspondientes. 4\. El sistema dibuja en el mapa las líneas de trayectoria diferenciadas por color para cada animal, marcando su punto de partida y su punto final. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. La fecha de inicio es posterior a la fecha de fin:** El sistema solicita corregir el rango de fechas. • A2. Los animales elegidos no registran lecturas de ubicación en ese período: El sistema informa que no hay datos de recorrido para las fechas seleccionadas. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades de Negocio:** Sin cambios. |

#### **CUU-058 — Generar y visualizar el mapa de calor de permanencia del ganado por período de tiempo**

| CASO DE USO USUARIO: CUU-058 | Generar y visualizar el mapa de calor de permanencia del ganado por período de tiempo |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-010 — Visualización en Tiempo Real, Recorridos Históricos y Mapas de Calor (Ref. Inicial: CU010) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Visualizar mediante colores de intensidad térmica en qué sectores de la granja o de los potreros se concentró y pasó más tiempo el rodeo. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Entidad Granja:** En estado "Activa", y el usuario posee acceso a ella. |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario abre el Mapa de Calor de la granja (o el mapa de calor dentro del seguimiento de una rotación). 2\. Elige el período de análisis deseado (Últimas 24 horas, Últimos 7 días, Últimos 30 días o ciclo de rotación). 3\. El sistema reúne todas las posiciones registradas por los animales de la granja durante esa ventana de tiempo y proyecta sobre el mapa las manchas de calor según la densidad de permanencia. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. No existen lecturas de ubicación en el período seleccionado:** El mapa se muestra sin manchas de calor indicando 0 lecturas en el rango. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades de Negocio:** Sin cambios. |

#### **CUU-059 — Identificar zonas de sobrepastoreo y detectar "zonas muertas" (subutilizadas) dentro de la granja**

| CASO DE USO USUARIO: CUU-059 | Identificar zonas de sobrepastoreo y detectar "zonas muertas" (subutilizadas) dentro de la granja |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-010 — Visualización en Tiempo Real, Recorridos Históricos y Mapas de Calor (Ref. Inicial: CU010) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Evaluar el aprovechamiento real del pasto contrastando los sectores de concentración excesiva de ganado (riesgo de sobrepastoreo) contra aquellos sectores del potrero donde los animales nunca ingresan (zonas muertas por falta de agua, anegamiento o baja calidad forrajera). |
| **Precondiciones y Estado Inicial de las Entidades** | • Mapa de calor generado sobre una Granja con perímetro y/o Zonas / Cercos Virtuales trazados. |
| **Flujo Básico (Paso a Paso)** | 1\. Con el mapa de calor desplegado sobre los límites de los potreros, el usuario analiza las áreas rojas de máxima permanencia (sobrepastoreo) y las áreas sin color dentro del cerco activo (zonas muertas). 2\. Con base en esta información visual, el Administrador de Granja o el Empleado Operador decide si corresponde adelantar el cambio de potrero en la rotación (CUU-069) o modificar el dibujo del cerco virtual (CUU-021). |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Ninguno. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades de Negocio:** Sin cambios. |

### **CUR-011: Recepción de Lecturas de Campo, Control de Escape de Cerco y Sincronización con el Collar**

| CASO DE USO RESUMEN — CUR-011 (Base: CU011) | Recepción de Lecturas de Campo, Control de Escape de Cerco y Sincronización con el Collar |
| :---- | :---- |
| **Nivel Jerárquico** | Caso de Uso Resumen (Módulo de Negocio) |
| **Roles de Negocio que Actúan** | **Dispositivo de Campo (Collar Inteligente y Antena Receptora), Administrador de Granja, Empleado Operador, Superadministrador** |
| **Objetivo de Negocio** | Recibir y validar cada lectura enviada por los collares a través de las antenas receptoras del campo, verificar que el collar pertenezca a la misma granja que la antena, guardar las mediciones biométricas y de ubicación, comprobar si el animal salió de los límites de su cerco virtual para disparar la Alerta de Escape, y entregarle al collar las coordenadas actualizadas de su cerco. |
| **Entidades de Negocio** | Antena Receptora (Gateway), Collar Inteligente, Vínculo Animal–Collar, Animal, Lectura Biométrica y de Ubicación, Zona / Cerco Virtual, Asignación de Animal a Zona / Cerco Virtual, Alerta, Registro de Auditoría de Comunicaciones |
| **Control de Estados del Módulo** | Pone a la Antena Receptora en estado "En Línea", crea la nueva Lectura Biométrica y de Ubicación, actualiza batería y última señal del Collar Inteligente, crea una Alerta de Escape en estado "Activa" si el animal vulneró su cerco y pasa el Collar Inteligente del estado "Sincronización Pendiente" al estado "Sincronizado". |
| **Casos de Uso Usuario (5)** | • CUU-060: Recibir y registrar una lectura válida de ubicación, temperatura, actividad y batería desde una antena de la granja • CUU-061: Rechazar y auditar lecturas provenientes de antenas no autorizadas o de collares pertenecientes a otra granja • CUU-062: Verificar contención dentro del cerco virtual y disparar Alerta de Escape si el animal salió de los límites • CUU-063: Entregar al collar los límites actualizados de su cerco virtual y marcarlo como Sincronizado • CUU-064: Solicitar manualmente el reenvío (resincronización) del cerco virtual hacia un collar |

#### **CUU-060 — Recibir y registrar una lectura válida de ubicación, temperatura, actividad y batería desde una antena de la granja**

| CASO DE USO USUARIO: CUU-060 | Recibir y registrar una lectura válida de ubicación, temperatura, actividad y batería desde una antena de la granja |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-011 — Recepción de Lecturas de Campo, Control de Escape de Cerco y Sincronización con el Collar (Ref. Inicial: CU011) |
| **Roles de Negocio que Actúan** | **Dispositivo de Campo (Collar Inteligente a través de Antena Receptora)** |
| **Necesidad / Objetivo** | Incorporar al sistema las mediciones tomadas por un collar en el campo, actualizando el estado de conexión de la antena receptora y los indicadores actuales del collar y del animal. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Entidad Antena Receptora (Gateway):** Existe registrada con una clave de acceso válida y está asignada a una Granja. **• Entidad Collar Inteligente:** Existe registrado y pertenece a la misma Granja que la Antena Receptora. |
| **Flujo Básico (Paso a Paso)** | 1\. El Collar Inteligente envía por radiofrecuencia sus mediciones (latitud, longitud, temperatura corporal, actividad física y batería) a la Antena Receptora del campo, y esta las transmite al sistema identificándose con su clave. 2\. El sistema valida la identidad de la Antena Receptora y actualiza su estado de conexión a "En Línea", registrando la fecha/hora de contacto y la calidad de señal recibida. 3\. El sistema verifica que el Collar Inteligente exista y pertenezca a la misma Granja que la Antena Receptora. 4\. El sistema guarda la nueva Lectura Biométrica y de Ubicación, actualiza el nivel de batería y la fecha de última señal del Collar Inteligente y deja asentada la operación como "Comunicación Exitosa" en el registro de auditoría. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. El número de collar informado no existe en el sistema:** Se rechaza la lectura y se asienta en el Registro de Auditoría como "Rechazada por Collar Inexistente". |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Antena Receptora (Gateway):** Queda en estado "En Línea" con su fecha de última comunicación y nivel de señal actualizados. **• Entidad Lectura Biométrica y de Ubicación (Nueva):** Queda en estado "Registrada y Validada", asociada al collar y al animal que lo lleva puesto. **• Entidad Collar Inteligente:** Queda actualizado con su último nivel de batería y fecha/hora de última señal. **• Entidad Registro de Auditoría de Comunicaciones (Nueva):** Queda creada en estado "Comunicación Exitosa". |

#### **CUU-061 — Rechazar y auditar lecturas provenientes de antenas no autorizadas o de collares pertenecientes a otra granja**

| CASO DE USO USUARIO: CUU-061 | Rechazar y auditar lecturas provenientes de antenas no autorizadas o de collares pertenecientes a otra granja |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-011 — Recepción de Lecturas de Campo, Control de Escape de Cerco y Sincronización con el Collar (Ref. Inicial: CU011) |
| **Roles de Negocio que Actúan** | **Dispositivo de Campo (Antena Receptora / Collar Inteligente)** |
| **Necesidad / Objetivo** | Evitar que ingrese información falsa o que una antena de un campo registre por error la señal inalámbrica de un collar perteneciente a un establecimiento vecino. |
| **Precondiciones y Estado Inicial de las Entidades** | • Se recibe una transmisión cuya clave de antena no es válida, o bien cuyo Collar Inteligente pertenece a otra Granja distinta de la granja de la Antena Receptora (o está en el Stock Central). |
| **Flujo Básico (Paso a Paso)** | 1a. Si la clave presentada por la antena no corresponde a ninguna Antena Receptora registrada, el sistema bloquea la transmisión. 1b. Si la Antena Receptora es válida y pertenece a la Granja A, pero capta la señal de un Collar Inteligente que pertenece a la Granja B (o al Stock Central), el sistema actualiza el estado "En Línea" de la antena pero rechaza la lectura del collar ajeno. 2\. En todos los casos, el sistema guarda un asiento en el Registro de Auditoría de Comunicaciones detallando el motivo exacto del rechazo. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Los datos numéricos enviados están incompletos o fuera de los rangos físicos posibles: El sistema rechaza la lectura y la audita como datos inválidos. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades Lectura Biométrica y Collar Inteligente:** NO sufren ningún cambio (no se contaminan los datos del campo). **• Entidad Registro de Auditoría de Comunicaciones (Nueva):** Queda creada en estado "Rechazada por Credencial Inválida" o "Rechazada por Collar Ajeno a la Granja". |

#### **CUU-062 — Verificar contención dentro del cerco virtual y disparar Alerta de Escape si el animal salió de los límites**

| CASO DE USO USUARIO: CUU-062 | Verificar contención dentro del cerco virtual y disparar Alerta de Escape si el animal salió de los límites |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-011 — Recepción de Lecturas de Campo, Control de Escape de Cerco y Sincronización con el Collar (Ref. Inicial: CU011) |
| **Roles de Negocio que Actúan** | **Dispositivo de Campo (al enviar lectura) y Sistema de Control de Cercos** |
| **Necesidad / Objetivo** | Comprobar automáticamente ante cada nueva ubicación recibida si el animal permanece dentro de su zona o cerco virtual asignado y emitir de inmediato una Alerta de Escape si cruzó los límites, sin generar alertas repetidas si ya tenía una abierta. |
| **Precondiciones y Estado Inicial de las Entidades** | • Se registró una Lectura Biométrica y de Ubicación válida (CUU-060) con coordenadas geográficas. • El Collar Inteligente se encuentra en estado "Vinculado a Animal (En Uso)" sobre un Animal en estado "Activo en el Rodeo (Con Collar y Contenido en Cerco)". • La Zona / Cerco Virtual del animal se encuentra en estado "Activo" (o bajo un Plan de Rotación en curso). |
| **Flujo Básico (Paso a Paso)** | 1\. Al recibir la nueva ubicación del animal, el sistema obtiene los límites vigentes de su Zona / Cerco Virtual (o el polígono en transición si hay una rotación activa). 2\. El sistema evalúa geométricamente si la posición del animal se encuentra dentro o fuera de dicho polígono. 3\. Al detectar que la posición cayó FUERA de los límites del cerco, el sistema verifica si ese animal ya tiene una Alerta de tipo "Escape de Cerco" en estado "Activa / Pendiente de Atención". 4\. Si no tenía una alerta de escape activa previa, el sistema crea una nueva Alerta de "Escape de Cerco" en estado "Activa / Pendiente de Atención" indicando la caravana del animal, el nombre del cerco vulnerado y las coordenadas. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. La ubicación del animal se encuentra dentro de los límites del cerco:** No se genera ninguna alerta. • A2. El animal sigue fuera del cerco pero ya tenía una Alerta de Escape en estado "Activa / Pendiente de Atención": El sistema no duplica la alerta para no saturar de avisos al productor. |
| **Postcondiciones y Estado Final de las Entidades** | • Entidad Alerta (Nueva, si el animal salió del cerco y no tenía alerta de escape abierta): Queda creada con tipo "Escape de Cerco" en estado "Activa / Pendiente de Atención". |

#### **CUU-063 — Entregar al collar los límites actualizados de su cerco virtual y marcarlo como Sincronizado**

| CASO DE USO USUARIO: CUU-063 | Entregar al collar los límites actualizados de su cerco virtual y marcarlo como Sincronizado |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-011 — Recepción de Lecturas de Campo, Control de Escape de Cerco y Sincronización con el Collar (Ref. Inicial: CU011) |
| **Roles de Negocio que Actúan** | **Dispositivo de Campo (Antena Receptora y Collar Inteligente)** |
| **Necesidad / Objetivo** | Aprovechar el momento en que el collar se comunica con la antena para enviarle de regreso los vértices vigentes de su cerco virtual (o la orden de apagar el cerco si fue desasignado) y dejar registrado que el collar ya está actualizado. |
| **Precondiciones y Estado Inicial de las Entidades** | • Se acaba de procesar una lectura válida del Collar Inteligente (CUU-060). |
| **Flujo Básico (Paso a Paso)** | 1\. Inmediatamente después de recibir la lectura del collar, el sistema determina cuáles son las coordenadas vigentes del cerco virtual del animal que lleva puesto ese collar (o una lista vacía si el animal no tiene cerco asignado). 2\. El sistema envía dichas coordenadas como respuesta a la Antena Receptora para que las retransmita al Collar Inteligente. 3\. El sistema actualiza el estado de sincronización del Collar Inteligente a "Sincronizado", registrando la fecha y hora exacta de sincronización. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. El collar no está vinculado a ningún animal o su animal fue retirado del cerco: El sistema le envía coordenadas vacías para que el collar apague cualquier frontera anterior y lo marca igualmente como "Sincronizado". |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Collar Inteligente:** Su estado de sincronización de cerco pasa de "Sincronización Pendiente" a "Sincronizado", quedando registrada la fecha y hora de última sincronización. |

#### **CUU-064 — Solicitar manualmente el reenvío (resincronización) del cerco virtual hacia un collar**

| CASO DE USO USUARIO: CUU-064 | Solicitar manualmente el reenvío (resincronización) del cerco virtual hacia un collar |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-011 — Recepción de Lecturas de Campo, Control de Escape de Cerco y Sincronización con el Collar (Ref. Inicial: CU011) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador, Superadministrador** |
| **Necesidad / Objetivo** | Marcar manualmente desde la plataforma que un collar específico vuelva a actualizar las coordenadas de su cerco virtual en su próxima comunicación con la antena. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Administrador de Granja, Empleado Operador de la granja o Superadministrador. **• Entidad Collar Inteligente:** En estado "Vinculado a Animal (En Uso)" sobre un animal que se encuentra en estado "Activo en el Rodeo (Con Collar y Contenido en Cerco)". |
| **Flujo Básico (Paso a Paso)** | 1\. En el listado de collares, el usuario selecciona la opción de sincronizar cerco sobre un collar en uso. 2\. El sistema verifica que el animal portador tenga una Zona / Cerco Virtual en estado "Activo". 3\. El sistema cambia el estado de sincronización del Collar Inteligente a "Sincronización Pendiente" para que actualice sus límites en el próximo contacto. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. El collar no está colocado en ningún animal o el animal no tiene un cerco virtual activo: El sistema informa que no hay un cerco activo para sincronizar en ese collar. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Collar Inteligente:** Su estado de sincronización de cerco pasa a "Sincronización Pendiente". |

### **CUR-012: Planificación y Ejecución de Pastoreo Rotativo (Rotación de Perímetros)**

| CASO DE USO RESUMEN — CUR-012 (Base: CU012) | Planificación y Ejecución de Pastoreo Rotativo (Rotación de Perímetros) |
| :---- | :---- |
| **Nivel Jerárquico** | Caso de Uso Resumen (Módulo de Negocio) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador (configuración y control manual), Empleado Observador (solo consulta), Planificador Automático de Rotación (avance programado e interpolación), Superadministrador (en modo asistencia)** |
| **Objetivo de Negocio** | Permitir programar y ejecutar ciclos de rotación de pastoreo entre varias zonas o cercos virtuales de una granja, desplazando los límites de forma progresiva cada 5 minutos para trasladar a los animales de una parcela a la siguiente sin estrés, tanto de forma automática por horario como mediante acciones manuales de adelantar, posponer, pausar, reanudar o cancelar. |
| **Entidades de Negocio** | Plan de Rotación de Perímetros, Etapa de Rotación, Zona / Cerco Virtual, Asignación de Animal a Zona / Cerco Virtual, Animal, Collar Inteligente |
| **Control de Estados del Módulo** | Controla los estados del Plan de Rotación ("Activo", "Pausado", "Completado", "Cancelado") y de cada una de sus Etapas ("Pendiente", "En Curso / Activa", "Completada"), encendiendo y apagando los cercos correspondientes y reasignando automáticamente a todos los animales con collar de la granja en cada cambio de etapa. |
| **Casos de Uso Usuario (6)** | • CUU-065: Crear e iniciar un plan de rotación de perímetros definiendo orden de zonas, duración y modo de avance • CUU-066: Consultar el estado del plan de rotación activo, el tiempo restante para la próxima etapa y el historial de rotaciones • CUU-067: Desplazar gradualmente los límites del cerco virtual cada 5 minutos entre la zona actual y la siguiente • CUU-068: Ejecutar automáticamente el cambio a la siguiente etapa de rotación o finalizar el ciclo al cumplirse el tiempo • CUU-069: Adelantar manualmente el cambio de etapa o posponer el horario de la próxima rotación • CUU-070: Pausar, reanudar o cancelar definitivamente un plan de rotación de perímetros |

#### **CUU-065 — Crear e iniciar un plan de rotación de perímetros definiendo orden de zonas, duración y modo de avance**

| CASO DE USO USUARIO: CUU-065 | Crear e iniciar un plan de rotación de perímetros definiendo orden de zonas, duración y modo de avance |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-012 — Planificación y Ejecución de Pastoreo Rotativo (Rotación de Perímetros) (Ref. Inicial: CU012) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Poner en marcha un esquema de pastoreo rotativo eligiendo la secuencia de potreros (mínimo 2), cuántas horas permanecerá el ganado en cada uno y si el cambio de etapa será automático. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Administrador de Granja o Empleado Operador de la granja. **• Entidad Granja:** En estado "Activa" y cuenta con al menos 2 Zonas / Cercos Virtuales registrados. |
| **Flujo Básico (Paso a Paso)** | 1\. En la sección de Rotación de Pastoreo de la granja, el usuario ingresa el nombre del plan, selecciona en orden las Zonas / Cercos Virtuales que conformarán las etapas (mínimo 2), define la frecuencia en horas de cada etapa e indica si el avance debe ser automático. 2\. Al confirmar el inicio del plan, el sistema ejecuta de manera integral:    a) Si existía otro Plan de Rotación en estado "Activo" en esa granja, lo pasa automáticamente a estado "Cancelado".    b) Crea el nuevo Plan de Rotación en estado "Activo (En Curso)", fijando la primera etapa (Etapa 1\) en estado "En Curso / Activa" y las etapas siguientes en estado "Pendiente", y calculando la fecha/hora de la próxima rotación.    c) Pone en estado "Activo" la Zona / Cerco Virtual de la Etapa 1 y pone en estado "Desactivado / Inactivo" las zonas de las demás etapas del plan.    d) Reasigna a todos los Animales con collar de la granja hacia la Zona / Cerco Virtual de la Etapa 1 (cerrando sus asignaciones anteriores) y pone sus Collares Inteligentes en "Sincronización Pendiente". |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. Se seleccionan menos de 2 zonas/cercos o una duración menor a 1 hora:** El sistema solicita completar al menos 2 etapas y un tiempo válido. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Plan de Rotación (Anterior, si había uno activo):** Pasa a estado "Cancelado". **• Entidad Plan de Rotación (Nuevo):** Queda creado en estado "Activo (En Curso)" ubicado en su primera etapa. **• Entidades Etapa de Rotación:** Etapa 1 en estado "En Curso / Activa"; Etapas 2 en adelante en estado "Pendiente". **• Entidades Zona / Cerco Virtual (del plan):** La zona de la Etapa 1 queda en estado "Activo (Con animales contenidos)"; las zonas de las demás etapas quedan en estado "Desactivado / Inactivo". • Entidades Asignación de Animal a Zona / Cerco Virtual (de todo el rodeo con collar de la granja): Quedan en estado "Vigente / Activa" apuntando a la zona de la Etapa 1\. **• Entidades Collar Inteligente (del rodeo):** Pasan a estado "Sincronización Pendiente". |

#### **CUU-066 — Consultar el estado del plan de rotación activo, el tiempo restante para la próxima etapa y el historial de rotaciones**

| CASO DE USO USUARIO: CUU-066 | Consultar el estado del plan de rotación activo, el tiempo restante para la próxima etapa y el historial de rotaciones |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-012 — Planificación y Ejecución de Pastoreo Rotativo (Rotación de Perímetros) (Ref. Inicial: CU012) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Visualizar en qué parcela del ciclo se encuentra actualmente el rodeo, cuánto falta para pasar a la siguiente etapa, ver el avance sobre el mapa y consultar los planes de rotación anteriores. |
| **Precondiciones y Estado Inicial de las Entidades** | • El usuario posee acceso de consulta a la Granja. |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario ingresa a la pestaña de Rotación de Pastoreo de la granja. 2\. El sistema muestra el Plan de Rotación actual con el detalle de cada Etapa ("Completada", "En Curso" o "Pendiente"), el reloj regresivo hacia el próximo cambio de potrero, el mapa con la transición del cerco y el listado histórico de los últimos planes ejecutados en el campo. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. La granja no tiene ningún plan de rotación en curso:** El sistema muestra la vista lista para configurar un nuevo plan. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades de Negocio:** Sin cambios. |

#### **CUU-067 — Desplazar gradualmente los límites del cerco virtual cada 5 minutos entre la zona actual y la siguiente**

| CASO DE USO USUARIO: CUU-067 | Desplazar gradualmente los límites del cerco virtual cada 5 minutos entre la zona actual y la siguiente |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-012 — Planificación y Ejecución de Pastoreo Rotativo (Rotación de Perímetros) (Ref. Inicial: CU012) |
| **Roles de Negocio que Actúan** | **Planificador Automático de Rotación y Dispositivo de Campo** |
| **Necesidad / Objetivo** | Mover de forma progresiva y escalonada (cada 5 minutos) la frontera del cerco virtual desde la parcela actual hacia la parcela siguiente para que los animales se desplacen acompañando el movimiento del cerco sin sufrir estrés ni estímulos bruscos. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Entidad Plan de Rotación:** Se encuentra en estado "Activo (En Curso)" y posee una etapa siguiente pendiente. |
| **Flujo Básico (Paso a Paso)** | 1\. A medida que transcurre el tiempo de la etapa actual en escalones de 5 minutos, el sistema calcula la posición intermedia proporcional de los límites entre la Zona / Cerco Virtual actual y la Zona / Cerco Virtual de la próxima etapa. 2\. Cada vez que los collares se comunican con la antena receptora (o cuando el usuario observa el mapa de rotación), el sistema entrega ese polígono intermedio desplazado gradualmente. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. El plan se encuentra en su última etapa o está en estado "Pausado":** No se realiza desplazamiento intermedio; se mantienen fijos los límites de la zona actual. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades Collar Inteligente:** Reciben los límites progresivos correspondientes al intervalo actual de 5 minutos. |

#### **CUU-068 — Ejecutar automáticamente el cambio a la siguiente etapa de rotación o finalizar el ciclo al cumplirse el tiempo**

| CASO DE USO USUARIO: CUU-068 | Ejecutar automáticamente el cambio a la siguiente etapa de rotación o finalizar el ciclo al cumplirse el tiempo |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-012 — Planificación y Ejecución de Pastoreo Rotativo (Rotación de Perímetros) (Ref. Inicial: CU012) |
| **Roles de Negocio que Actúan** | **Planificador Automático de Rotación** |
| **Necesidad / Objetivo** | Pasar automáticamente al rodeo hacia la siguiente parcela programada cuando se cumple el horario de rotación, o dar por completado el plan cuando concluye el tiempo de la última etapa. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Entidad Plan de Rotación:** Se encuentra en estado "Activo (En Curso)", con avance automático habilitado, y se alcanzó la fecha/hora programada para la próxima rotación. |
| **Flujo Básico (Paso a Paso)** | 1\. Al cumplirse el plazo horario de la etapa actual, el sistema marca la Etapa de Rotación actual como "Completada". 2a. Si existe una etapa siguiente en el plan:     \- El sistema cambia la siguiente Etapa de Rotación del estado "Pendiente" al estado "En Curso / Activa" y calcula el nuevo horario de rotación.     \- Pone en estado "Activo" la Zona / Cerco Virtual de la nueva etapa y pasa a estado "Desactivado / Inactivo" la zona de la etapa que acaba de terminar.     \- Reasigna a todos los Animales con collar de la granja hacia la Zona / Cerco Virtual de la nueva etapa (finalizando la asignación a la zona anterior) y marca sus Collares Inteligentes con "Sincronización Pendiente". 2b. Si la etapa que acaba de cumplirse era la última del plan:     \- El sistema cambia el estado del Plan de Rotación a "Completado", dejando a los animales contenidos en la última zona del ciclo. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. El Plan de Rotación está en estado "Pausado" o fue configurado en modo manual: El sistema no avanza de etapa automáticamente. |
| **Postcondiciones y Estado Final de las Entidades** | **• Si avanzó a una etapa siguiente:** Etapa anterior pasa a "Completada"; Etapa nueva pasa a "En Curso / Activa"; Zona anterior pasa a "Desactivada"; Zona nueva pasa a "Activa"; Asignaciones de Animales pasan a la nueva zona; Collares pasan a "Sincronización Pendiente". **• Si concluyó la última etapa:** Entidad Plan de Rotación pasa del estado "Activo (En Curso)" al estado "Completado". |

#### **CUU-069 — Adelantar manualmente el cambio de etapa o posponer el horario de la próxima rotación**

| CASO DE USO USUARIO: CUU-069 | Adelantar manualmente el cambio de etapa o posponer el horario de la próxima rotación |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-012 — Planificación y Ejecución de Pastoreo Rotativo (Rotación de Perímetros) (Ref. Inicial: CU012) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Intervenir manualmente sobre el plan de rotación en curso según el estado real de la pastura o las condiciones climáticas: ya sea pasando de inmediato a la siguiente parcela o sumando horas de permanencia en la parcela actual. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Administrador de Granja o Empleado Operador de la granja. **• Entidad Plan de Rotación:** Se encuentra en estado "Activo (En Curso)" (o "Pausado" si se desea adelantar). |
| **Flujo Básico (Paso a Paso)** | 1a. Si el usuario elige "Adelantar rotación ahora": El sistema ejecuta de inmediato el cierre de la etapa actual y activa la siguiente etapa reasignando el cerco y los animales (o completa el plan si estaba en la última etapa). 1b. Si el usuario elige "Posponer rotación": El usuario indica cuántas horas adicionales desea permanecer en la zona actual (por ejemplo, 6 horas más) y el sistema extiende la fecha/hora de la próxima rotación sumando esas horas. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. No existe un plan de rotación activo en la granja:** El sistema informa que no hay una rotación en curso. |
| **Postcondiciones y Estado Final de las Entidades** | **• Si se adelantó:** Se producen inmediatamente las mismas transiciones de estado de etapa, zonas, animales y collares descritas en CUU-068. **• Si se pospuso:** Entidad Plan de Rotación conserva su estado "Activo (En Curso)" y su etapa actual, quedando actualizada su Fecha/Hora de Próxima Rotación con las horas adicionadas. |

#### **CUU-070 — Pausar, reanudar o cancelar definitivamente un plan de rotación de perímetros**

| CASO DE USO USUARIO: CUU-070 | Pausar, reanudar o cancelar definitivamente un plan de rotación de perímetros |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-012 — Planificación y Ejecución de Pastoreo Rotativo (Rotación de Perímetros) (Ref. Inicial: CU012) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Detener temporalmente el reloj de un plan de rotación activo, volver a ponerlo en marcha o cancelarlo de forma definitiva. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Administrador de Granja o Empleado Operador de la granja. **• Entidad Plan de Rotación:** Se encuentra en estado "Activo (En Curso)" o "Pausado". |
| **Flujo Básico (Paso a Paso)** | 1a. Para Pausar: El usuario selecciona pausar el plan activo; el sistema detiene el cronómetro y pasa el Plan de Rotación a estado "Pausado". 1b. Para Reanudar: El usuario selecciona reanudar sobre un plan pausado; el sistema vuelve el Plan de Rotación a estado "Activo (En Curso)" y recalcula el horario del próximo cambio de etapa. 1c. Para Cancelar: El usuario selecciona cancelar/finalizar el plan y confirma; el sistema pasa el Plan de Rotación al estado "Cancelado", dejando a los animales en la zona donde se encontraban en ese momento. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Ninguno. |
| **Postcondiciones y Estado Final de las Entidades** | **• Al Pausar:** Entidad Plan de Rotación pasa del estado "Activo (En Curso)" al estado "Pausado". **• Al Reanudar:** Entidad Plan de Rotación pasa del estado "Pausado" al estado "Activo (En Curso)" con nuevo horario de próxima rotación. **• Al Cancelar:** Entidad Plan de Rotación pasa a estado "Cancelado" (con fecha de finalización registrada); la Zona / Cerco Virtual actual y los animales contenidos en ella mantienen su estado actual. |

### **CUR-013: Gestión de Antenas Receptoras (Gateways) y Auditoría de Comunicaciones de Campo**

| CASO DE USO RESUMEN — CUR-013 (Base: CU013) | Gestión de Antenas Receptoras (Gateways) y Auditoría de Comunicaciones de Campo |
| :---- | :---- |
| **Nivel Jerárquico** | Caso de Uso Resumen (Módulo de Negocio) |
| **Roles de Negocio que Actúan** | **Superadministrador (gestión global de antenas, stock, reasignación entre granjas y auditoría de comunicaciones), Administrador de Granja y Empleado Operador (registro, edición y consulta de antenas de su granja), Empleado Observador (solo consulta)** |
| **Objetivo de Negocio** | Administrar las Antenas Receptoras (Gateways) encargadas de recibir en el campo las señales de los collares, supervisar su estado de conexión (En Línea, Fuera de Línea o Sin Datos Iniciales) y nivel de señal, gestionar su clave de acceso e instructivo de configuración, y permitir al Superadministrador auditar el registro completo de comunicaciones recibidas. |
| **Entidades de Negocio** | Antena Receptora (Gateway), Granja, Registro de Auditoría de Comunicaciones |
| **Control de Estados del Módulo** | Controla la tenencia de la Antena Receptora ("En Stock Central", "Asignada a Granja" o "Eliminada"), su estado de conexión ("Sin Datos Iniciales", "En Línea" o "Fuera de Línea") y la consulta o depuración de los Registros de Auditoría de Comunicaciones. |
| **Casos de Uso Usuario (6)** | • CUU-071: Consultar el inventario de antenas receptoras (Gateways) y su estado de conexión y señal en tiempo real • CUU-072: Registrar una nueva antena receptora (Gateway) en stock o asignada a una granja • CUU-073: Editar el nombre, cambiar la clave de acceso o reasignar la granja de una antena receptora • CUU-074: Consultar y copiar la clave de acceso de una antena y su guía de configuración para el equipo físico • CUU-075: Eliminar una antena receptora del inventario anulando su clave de acceso • CUU-076: Auditar el registro global de comunicaciones de dispositivos y depurar el historial de auditoría |

#### **CUU-071 — Consultar el inventario de antenas receptoras (Gateways) y su estado de conexión y señal en tiempo real**

| CASO DE USO USUARIO: CUU-071 | Consultar el inventario de antenas receptoras (Gateways) y su estado de conexión y señal en tiempo real |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-013 — Gestión de Antenas Receptoras (Gateways) y Auditoría de Comunicaciones de Campo (Ref. Inicial: CU013) |
| **Roles de Negocio que Actúan** | **Superadministrador (ve todas incluidas las de Stock Central), Administrador de Granja, Empleado Operador, Empleado Observador (ven las antenas de sus granjas)** |
| **Necesidad / Objetivo** | Supervisar qué antenas receptoras están operativas y transmitiendo ("En Línea"), cuáles llevan más de 15 minutos sin reportarse ("Fuera de Línea") y cuáles aún no han transmitido ("Sin Datos Iniciales"), junto con la intensidad y calidad de su señal. |
| **Precondiciones y Estado Inicial de las Entidades** | • El usuario posee sesión activa en el sistema. |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario accede a la sección de Antenas Receptoras (Gateways). 2\. El sistema lista las antenas autorizadas para su rol y calcula el estado de conexión actual de cada una según el tiempo transcurrido desde su última comunicación: "Sin Datos Iniciales" (si nunca se comunicó), "En Línea" (si se comunicó en los últimos 15 minutos) o "Fuera de Línea" (si pasaron más de 15 minutos). 3\. El usuario visualiza para cada antena su nombre, granja asignada, estado de conexión, fecha de última señal e indicadores de potencia y calidad de recepción. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Ninguno. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades de Negocio:** Sin cambios. |

#### **CUU-072 — Registrar una nueva antena receptora (Gateway) en stock o asignada a una granja**

| CASO DE USO USUARIO: CUU-072 | Registrar una nueva antena receptora (Gateway) en stock o asignada a una granja |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-013 — Gestión de Antenas Receptoras (Gateways) y Auditoría de Comunicaciones de Campo (Ref. Inicial: CU013) |
| **Roles de Negocio que Actúan** | **Superadministrador, Administrador de Granja, Empleado Operador** |
| **Necesidad / Objetivo** | Dar de alta una nueva antena receptora en el sistema asignándole un nombre identificatorio, vinculándola a una granja (o dejándola en Stock Central si lo hace el Superadministrador) y generándole su clave única de acceso. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Superadministrador, o bien Administrador de Granja / Empleado Operador sobre una granja activa. |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario selecciona la opción de registrar una nueva antena receptora (Gateway). 2\. Ingresa el nombre descriptivo de la antena (por ejemplo, "Antena Molino Norte"), selecciona la Granja a la que pertenecerá (o Stock Central si es Superadministrador) y puede indicar una clave o dejar que el sistema la genere automáticamente. 3\. El sistema verifica que la clave sea única y crea la nueva Antena Receptora. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. Se ingresó manualmente una clave que ya pertenece a otra antena:** El sistema rechaza el registro e informa la duplicidad. **• A2. Un Empleado Observador intenta registrar una antena:** El sistema no se lo permite por tener permisos exclusivos de lectura. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Antena Receptora (Nueva):** Queda creada en estado de inventario "Asignada a Granja" (o "En Stock Central"), en estado de conexión "Sin Datos Iniciales" y con su clave de acceso activa. |

#### **CUU-073 — Editar el nombre, cambiar la clave de acceso o reasignar la granja de una antena receptora**

| CASO DE USO USUARIO: CUU-073 | Editar el nombre, cambiar la clave de acceso o reasignar la granja de una antena receptora |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-013 — Gestión de Antenas Receptoras (Gateways) y Auditoría de Comunicaciones de Campo (Ref. Inicial: CU013) |
| **Roles de Negocio que Actúan** | **Superadministrador, Administrador de Granja, Empleado Operador** |
| **Necesidad / Objetivo** | Modificar la denominación de una antena, renovar su clave de acceso por motivos de seguridad o trasladarla a otro establecimiento. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Superadministrador, o Administrador de Granja / Empleado Operador con permisos en las granjas involucradas. **• Entidad Antena Receptora:** Existe en el inventario. |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario selecciona la opción de editar sobre una Antena Receptora. 2\. Modifica su nombre, su clave de acceso y/o la Granja asignada, y guarda los cambios. 3\. El sistema verifica que la nueva clave no esté repetida y actualiza los datos de la Antena Receptora. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. La clave modificada coincide con la de otra antena existente:** El sistema impide el cambio. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Antena Receptora:** Queda actualizada con su nuevo nombre, clave y/o Granja asignada (a partir de ese momento solo aceptará lecturas de collares que pertenezcan a su nueva granja). |

#### **CUU-074 — Consultar y copiar la clave de acceso de una antena y su guía de configuración para el equipo físico**

| CASO DE USO USUARIO: CUU-074 | Consultar y copiar la clave de acceso de una antena y su guía de configuración para el equipo físico |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-013 — Gestión de Antenas Receptoras (Gateways) y Auditoría de Comunicaciones de Campo (Ref. Inicial: CU013) |
| **Roles de Negocio que Actúan** | **Superadministrador, Administrador de Granja, Empleado Operador, Empleado Observador** |
| **Necesidad / Objetivo** | Visualizar la clave de acceso de una antena receptora (oculta por defecto por seguridad) y las instrucciones necesarias para configurar el equipo físico antes de instalarlo en el campo. |
| **Precondiciones y Estado Inicial de las Entidades** | • El usuario tiene acceso a la Antena Receptora en el listado. |
| **Flujo Básico (Paso a Paso)** | 1\. En la fila de la antena receptora, el usuario pulsa la opción para mostrar o copiar la clave de acceso del dispositivo, o abre la guía de configuración. 2\. El sistema revela la clave, permite copiarla con un clic y exhibe los pasos para cargar dicha credencial en la antena física. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Ninguno. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades de Negocio:** Sin cambios. |

#### **CUU-075 — Eliminar una antena receptora del inventario anulando su clave de acceso**

| CASO DE USO USUARIO: CUU-075 | Eliminar una antena receptora del inventario anulando su clave de acceso |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-013 — Gestión de Antenas Receptoras (Gateways) y Auditoría de Comunicaciones de Campo (Ref. Inicial: CU013) |
| **Roles de Negocio que Actúan** | **Superadministrador, Administrador de Granja, Empleado Operador** |
| **Necesidad / Objetivo** | Dar de baja y retirar del inventario una antena receptora que dejó de utilizarse o fue cargada por error, invalidando de inmediato su clave para que no pueda seguir enviando datos. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Superadministrador, Administrador de Granja o Empleado Operador con permisos sobre la antena. **• Entidad Antena Receptora:** Existe en el sistema. |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario selecciona la opción de eliminar sobre la Antena Receptora y confirma la acción en el cuadro de diálogo. 2\. El sistema elimina la Antena Receptora del inventario activo, dejando anulada su clave de acceso. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Si el dispositivo físico eliminado intenta volver a transmitir con su clave antigua: El sistema rechazará la comunicación como credencial inválida (CUU-061). |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Antena Receptora:** Pasa a estado "Eliminada" (su clave queda revocada). **• Entidades Registro de Auditoría de Comunicaciones (anteriores):** Permanecen conservadas en el historial. |

#### **CUU-076 — Auditar el registro global de comunicaciones de dispositivos y depurar el historial de auditoría**

| CASO DE USO USUARIO: CUU-076 | Auditar el registro global de comunicaciones de dispositivos y depurar el historial de auditoría |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-013 — Gestión de Antenas Receptoras (Gateways) y Auditoría de Comunicaciones de Campo (Ref. Inicial: CU013) |
| **Roles de Negocio que Actúan** | **Superadministrador** |
| **Necesidad / Objetivo** | Supervisar en detalle todas las transmisiones recibidas desde las antenas de campo (tanto las exitosas como las rechazadas por clave inválida, collar ajeno a la granja o collar inexistente) para diagnosticar problemas en terreno, y limpiar el historial cuando sea necesario. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Superadministrador con sesión activa. |
| **Flujo Básico (Paso a Paso)** | 1\. El Superadministrador accede al panel de Auditoría de Comunicaciones IoT. 2\. El sistema muestra un resumen estadístico (total de transmisiones, exitosas, rechazadas por clave, rechazadas por campo cruzado, collares no encontrados) y el listado detallado filtrable por estado, por collar y por antena receptora. 3\. Al seleccionar un registro, el Superadministrador visualiza los datos completos enviados por el dispositivo y el motivo de aceptación o rechazo. 4\. Si el Superadministrador selecciona la opción de limpiar el historial y confirma, el sistema depura (vacía) los registros de auditoría acumulados. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Un Administrador de Granja o Empleado intenta ingresar a este panel de auditoría global: El sistema deniega el acceso por ser exclusivo del Superadministrador. |
| **Postcondiciones y Estado Final de las Entidades** | **• En consulta:** Entidades sin cambios. **• En limpieza de historial:** Entidades Registro de Auditoría de Comunicaciones pasan a estado "Depurado / Limpiado" (el registro queda en 0 filas). |

### **CUR-014: Detección Predictiva de Eventos de Salud mediante Inteligencia Artificial**

| CASO DE USO RESUMEN — CUR-014 (Base: CU014) | Detección Predictiva de Eventos de Salud mediante Inteligencia Artificial |
| :---- | :---- |
| **Nivel Jerárquico** | Caso de Uso Resumen (Módulo de Negocio) |
| **Roles de Negocio que Actúan** | **Motor Predictivo de Salud (evaluación preventiva), Administrador de Granja, Empleado Operador (consulta y marcación de falsos positivos), Empleado Observador (solo consulta), Superadministrador (en modo asistencia)** |
| **Objetivo de Negocio** | Anticipar posibles cuadros clínicos o reproductivos en el ganado (Fiebre, Celo, Inactividad anormal y Anomalías generales de salud) evaluando automáticamente el comportamiento acumulado de las últimas 24 horas de cada animal, disparando alertas tempranas cuando la probabilidad supera el umbral de riesgo, registrando tendencias preventivas bajo el umbral y permitiendo a los operadores marcar falsos positivos para mejorar la precisión futura. |
| **Entidades de Negocio** | Predicción de Salud, Alerta, Lectura Biométrica y de Ubicación, Animal, Collar Inteligente, Usuario |
| **Control de Estados del Módulo** | Crea registros de Predicción de Salud en estado "Anomalía Detectada (Sobre el Umbral)" (generando una Alerta Preventiva en estado "Activa") o en estado "En Seguimiento / Normal (Bajo el Umbral)", y permite cambiar la Alerta al estado "Descartada como Falso Positivo" registrando la nota del operario. |
| **Casos de Uso Usuario (8)** | • CUU-077: Analizar automáticamente el comportamiento de las últimas 24 horas de un animal y calcular su probabilidad de riesgo sanitario a 6 horas • CUU-078: Registrar predicción positiva y disparar Alerta Preventiva de Salud cuando la probabilidad supera el umbral • CUU-079: Registrar predicción por debajo del umbral sin disparar alerta para seguimiento preventivo de tendencias • CUU-080: Proyectar la evolución probable de salud del animal en 4 etapas hasta las próximas 48 horas • CUU-081: Consultar el panel de Salud Predictiva de la granja, el nivel de riesgo actual del rodeo y las curvas por animal • CUU-082: Inspeccionar el detalle de en qué mediciones se basó una predicción de salud • CUU-083: Marcar una alerta como Falso Positivo registrando la observación del operario y dándola por resuelta • CUU-084: Consultar las métricas de precisión del modelo en campo y obtener el registro de retroalimentación |

#### **CUU-077 — Analizar automáticamente el comportamiento de las últimas 24 horas de un animal y calcular su probabilidad de riesgo sanitario a 6 horas**

| CASO DE USO USUARIO: CUU-077 | Analizar automáticamente el comportamiento de las últimas 24 horas de un animal y calcular su probabilidad de riesgo sanitario a 6 horas |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-014 — Detección Predictiva de Eventos de Salud mediante Inteligencia Artificial (Ref. Inicial: CU014) |
| **Roles de Negocio que Actúan** | **Motor Predictivo de Salud (al ingresar una nueva lectura de campo)** |
| **Necesidad / Objetivo** | Evaluar la evolución reciente de temperatura corporal, actividad física y condiciones ambientales de un animal con collar para estimar la probabilidad de que presente Fiebre, Celo, Inactividad o Anomalía en las próximas 6 horas. |
| **Precondiciones y Estado Inicial de las Entidades** | • Se registró una nueva Lectura Biométrica y de Ubicación (CUU-060) de un collar colocado en un Animal en estado "Activo en el Rodeo". • El animal cuenta con al menos 6 lecturas registradas dentro de las últimas 24 horas desde que lleva puesto ese collar. |
| **Flujo Básico (Paso a Paso)** | 1\. Tras guardarse la nueva lectura del animal, el sistema reúne todas las mediciones de temperatura y actividad de las últimas 24 horas de ese animal y las organiza en 48 intervalos de 30 minutos. 2\. El Motor Predictivo de Salud analiza la serie de 24 horas junto con las características del animal (categoría, sexo, edad, peso, estado reproductivo). 3\. El motor calcula el porcentaje de probabilidad de ocurrencia para cada uno de los 4 eventos monitoreados (Fiebre, Celo, Inactividad y Anomalía general) y lo compara contra su umbral de riesgo correspondiente. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. El collar fue colocado recientemente y el animal aún tiene menos de 6 lecturas en las últimas 24 horas: El sistema posterga la evaluación predictiva hasta contar con suficientes mediciones. • A2. Ya se había realizado una evaluación predictiva para ese animal en los últimos 30 minutos: El sistema aguarda al siguiente intervalo de 30 minutos para no recalcular innecesariamente. |
| **Postcondiciones y Estado Final de las Entidades** | **• Evaluación Predictiva Calculada:** Se obtienen los 4 porcentajes de probabilidad y su comparación contra el umbral, listos para ser registrados según superen o no el límite de alerta (CUU-078 y CUU-079). |

#### **CUU-078 — Registrar predicción positiva y disparar Alerta Preventiva de Salud cuando la probabilidad supera el umbral**

| CASO DE USO USUARIO: CUU-078 | Registrar predicción positiva y disparar Alerta Preventiva de Salud cuando la probabilidad supera el umbral |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-014 — Detección Predictiva de Eventos de Salud mediante Inteligencia Artificial (Ref. Inicial: CU014) |
| **Roles de Negocio que Actúan** | **Motor Predictivo de Salud** |
| **Necesidad / Objetivo** | Avisar tempranamente al Administrador de Granja y a los Empleados cuando el modelo predictivo detecta una alta probabilidad de Fiebre, Celo, Inactividad o Anomalía en un animal antes de que el cuadro se agrave. |
| **Precondiciones y Estado Inicial de las Entidades** | • En la evaluación predictiva (CUU-077), uno o más eventos alcanzaron o superaron su umbral de detección. |
| **Flujo Básico (Paso a Paso)** | 1\. Al detectar que la probabilidad de un evento superó su umbral, el sistema verifica si ese animal ya tuvo una Alerta Preventiva por ese mismo evento en las últimas 6 horas. 2\. Si no existe una alerta reciente para ese evento, el sistema crea una nueva Alerta de tipo "Salud Predictiva por IA" en estado "Activa / Pendiente de Atención", detallando la caravana del animal, el evento detectado, el porcentaje de probabilidad calculado y el umbral superado. 3\. El sistema guarda la Predicción de Salud en estado "Anomalía Detectada (Sobre el Umbral)" dejándola vinculada a la alerta generada. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Ya se había disparado una Alerta Preventiva por ese mismo evento en las últimas 6 horas para ese animal: El sistema guarda igualmente la Predicción de Salud para reflejar la curva en los gráficos, pero no crea una alerta repetida. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Alerta (Nueva, si no había una reciente):** Queda creada en estado "Activa / Pendiente de Atención" con origen "Salud Predictiva por IA". **• Entidad Predicción de Salud (Nueva):** Queda creada en estado "Anomalía Detectada (Sobre el Umbral)" y vinculada a la alerta. |

#### **CUU-079 — Registrar predicción por debajo del umbral sin disparar alerta para seguimiento preventivo de tendencias**

| CASO DE USO USUARIO: CUU-079 | Registrar predicción por debajo del umbral sin disparar alerta para seguimiento preventivo de tendencias |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-014 — Detección Predictiva de Eventos de Salud mediante Inteligencia Artificial (Ref. Inicial: CU014) |
| **Roles de Negocio que Actúan** | **Motor Predictivo de Salud** |
| **Necesidad / Objetivo** | Conservar los porcentajes de probabilidad que no llegaron a superar el umbral de alerta para que el productor y el veterinario puedan observar en los gráficos si el riesgo de un animal está subiendo gradualmente. |
| **Precondiciones y Estado Inicial de las Entidades** | • En la evaluación predictiva (CUU-077), el porcentaje calculado para el evento fue inferior al umbral de disparo. |
| **Flujo Básico (Paso a Paso)** | 1\. El sistema registra la Predicción de Salud con el porcentaje obtenido en estado "En Seguimiento / Normal (Bajo el Umbral)", sin generar ninguna notificación en el centro de alertas. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Ninguno. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Predicción de Salud (Nueva):** Queda creada en estado "En Seguimiento / Normal (Bajo el Umbral)", disponible en las curvas de evolución del panel predictivo. **• Entidad Alerta:** No se crea ninguna alerta. |

#### **CUU-080 — Proyectar la evolución probable de salud del animal en 4 etapas hasta las próximas 48 horas**

| CASO DE USO USUARIO: CUU-080 | Proyectar la evolución probable de salud del animal en 4 etapas hasta las próximas 48 horas |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-014 — Detección Predictiva de Eventos de Salud mediante Inteligencia Artificial (Ref. Inicial: CU014) |
| **Roles de Negocio que Actúan** | **Motor Predictivo de Salud** |
| **Necesidad / Objetivo** | Estimar cómo evolucionará el riesgo de Fiebre, Celo, Inactividad y Anomalía en horizontes sucesivos (de 0 a 6 horas, de 6 a 12 horas, de 12 a 24 horas y de 24 a 48 horas) identificando cuál es el evento de mayor riesgo y en qué etapa podría manifestarse. |
| **Precondiciones y Estado Inicial de las Entidades** | • El animal cuenta con una ventana de 24 horas de lecturas biométricas (48 intervalos de 30 minutos). |
| **Flujo Básico (Paso a Paso)** | 1\. A partir de los 48 intervalos de las últimas 24 horas del animal, el Motor Predictivo de Salud proyecta el comportamiento esperado para las siguientes etapas de 6h, 12h, 24h y 48h. 2\. Para cada una de las 4 etapas, determina la probabilidad de cada evento y elabora el resumen indicando el evento de mayor riesgo y el primer horizonte temporal en que superaría el umbral. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Ninguno. |
| **Postcondiciones y Estado Final de las Entidades** | **• Proyección Multi-Etapa Generada:** Queda disponible el pronóstico escalonado a 6h, 12h, 24h y 48h para el animal evaluado. |

#### **CUU-081 — Consultar el panel de Salud Predictiva de la granja, el nivel de riesgo actual del rodeo y las curvas por animal**

| CASO DE USO USUARIO: CUU-081 | Consultar el panel de Salud Predictiva de la granja, el nivel de riesgo actual del rodeo y las curvas por animal |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-014 — Detección Predictiva de Eventos de Salud mediante Inteligencia Artificial (Ref. Inicial: CU014) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Revisar en una vista dedicada el estado preventivo de todos los animales monitoreados de la granja, viendo cuáles están en "Riesgo Alto", cuáles "En Observación" y cuáles en estado "Normal", junto con la evolución histórica de sus probabilidades. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Entidad Granja:** En estado "Activa", y el usuario tiene acceso a ella. |
| **Flujo Básico (Paso a Paso)** | 1\. Dentro de la sección de Alertas y Salud Predictiva, el usuario accede a la pestaña de Salud Predictiva. 2\. El sistema muestra las tarjetas de los animales evaluados clasificadas por nivel de riesgo, exibiendo para cada uno las barras de probabilidad de Fiebre, Celo, Inactividad y Anomalía frente a su umbral. 3\. El usuario puede filtrar por animal, por tipo de evento sanitario y por período de días (últimas 24 horas, 3 días, 7 días o 14 días) para analizar el gráfico de evolución temporal. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. La granja aún no registra predicciones de salud:** El sistema muestra una explicación indicando que las evaluaciones se generan automáticamente a medida que los collares envían lecturas. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades de Negocio:** Sin cambios. |

#### **CUU-082 — Inspeccionar el detalle de en qué mediciones se basó una predicción de salud**

| CASO DE USO USUARIO: CUU-082 | Inspeccionar el detalle de en qué mediciones se basó una predicción de salud |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-014 — Detección Predictiva de Eventos de Salud mediante Inteligencia Artificial (Ref. Inicial: CU014) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Comprender por qué el sistema emitió una determinada probabilidad o alerta predictiva, revisando las temperaturas, niveles de actividad y promedios de las 24 horas exactas que fueron analizadas. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Entidad Predicción de Salud:** Existe registrada para un animal de la granja. |
| **Flujo Básico (Paso a Paso)** | 1\. En el panel de Salud Predictiva, el usuario selecciona la opción "¿En qué se basó?" sobre una predicción específica. 2\. El sistema reconstruye la ventana de 24 horas (los 48 bloques de 30 minutos) que originó ese cálculo y muestra un resumen claro con la temperatura mínima, promedio y máxima, la actividad física mínima, promedio y máxima, el porcentaje de cobertura de lecturas reales y el detalle intervalo por intervalo. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Ninguno. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades de Negocio:** Sin cambios. |

#### **CUU-083 — Marcar una alerta como Falso Positivo registrando la observación del operario y dándola por resuelta**

| CASO DE USO USUARIO: CUU-083 | Marcar una alerta como Falso Positivo registrando la observación del operario y dándola por resuelta |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-014 — Detección Predictiva de Eventos de Salud mediante Inteligencia Artificial (Ref. Inicial: CU014) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Dejar constancia de que, tras revisar al animal en el campo, una alerta disparada no correspondía a un problema real de salud o escape, cerrando la alerta y guardando el comentario del personal para perfeccionar el modelo predictivo. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Administrador de Granja o Empleado Operador de la granja (el Empleado Observador no puede modificar alertas). **• Entidad Alerta:** Existe en la granja. |
| **Flujo Básico (Paso a Paso)** | 1\. En el listado de alertas, el usuario selecciona la opción "Marcar como Falso Positivo" sobre la alerta. 2\. El sistema solicita una nota u observación opcional donde el operario explica lo constatado en el campo (por ejemplo: "Animal revisado en manga, temperatura normal luego de corrida"). 3\. Al confirmar, el sistema cambia el estado de la Alerta a "Descartada como Falso Positivo", la marca simultáneamente como resuelta/atendida y guarda la nota, la fecha/hora y el usuario que realizó la evaluación. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. Un Empleado Observador intenta marcar un falso positivo:** El sistema no le habilita la acción por tener permisos exclusivos de lectura. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Alerta:** Pasa al estado "Descartada como Falso Positivo" (quedando resuelta/inactiva en el contador de alertas pendientes y con la nota de retroalimentación y el usuario evaluador registrados). |

#### **CUU-084 — Consultar las métricas de precisión del modelo en campo y obtener el registro de retroalimentación**

| CASO DE USO USUARIO: CUU-084 | Consultar las métricas de precisión del modelo en campo y obtener el registro de retroalimentación |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-014 — Detección Predictiva de Eventos de Salud mediante Inteligencia Artificial (Ref. Inicial: CU014) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador, Empleado Observador, Superadministrador** |
| **Necesidad / Objetivo** | Conocer el porcentaje de acierto real que está teniendo el sistema predictivo en la granja (comparando alertas confirmadas contra falsos positivos por cada tipo de evento) y disponer de los casos validados por el personal para reentrenar el modelo. |
| **Precondiciones y Estado Inicial de las Entidades** | • El usuario posee acceso de consulta a la Granja. |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario consulta los indicadores de desempeño del modelo en el módulo de Alertas o Reportes. 2\. El sistema contabiliza todas las alertas predictivas de la granja, diferenciando cuántas fueron confirmadas como reales (resueltas), cuántas fueron descartadas como Falsos Positivos y cuántas siguen pendientes de revisión. 3\. El sistema calcula y muestra la tasa de precisión estimada y la tasa de falsos positivos global y para cada evento (Fiebre, Celo, Inactividad y Anomalía), permitiendo además exportar las evaluaciones con sus notas de operario. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Aún no se ha resuelto ni evaluado ninguna alerta predictiva en la granja: El indicador de precisión se muestra como "Sin casos cerrados aún". |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades de Negocio:** Sin cambios. |

### **CUR-015: Centro de Notificaciones y Gestión Operativa de Alertas**

| CASO DE USO RESUMEN — CUR-015 (Base: CU015) | Centro de Notificaciones y Gestión Operativa de Alertas |
| :---- | :---- |
| **Nivel Jerárquico** | Caso de Uso Resumen (Módulo de Negocio) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador (consulta y resolución), Empleado Observador (solo consulta), Superadministrador (en modo asistencia)** |
| **Objetivo de Negocio** | Centralizar en una única bandeja todas las alertas ocurridas en la granja (Escapes de Cerco, Alertas de Salud por Sensor, Alertas de Salud Predictiva por IA y Alertas de Sistema), permitiendo filtrarlas por múltiples criterios y marcarlas como resueltas una vez atendidas en el campo. |
| **Entidades de Negocio** | Alerta, Animal, Granja |
| **Control de Estados del Módulo** | Controla la visualización filtrada de la entidad Alerta y su paso del estado "Activa / Pendiente de Atención" al estado "Resuelta / Atendida (Confirmada)". |
| **Casos de Uso Usuario (2)** | • CUU-085: Consultar y filtrar el centro de notificaciones y alertas por granja, origen, tipo, animal y estado • CUU-086: Marcar una alerta activa como Resuelta / Atendida |

#### **CUU-085 — Consultar y filtrar el centro de notificaciones y alertas por granja, origen, tipo, animal y estado**

| CASO DE USO USUARIO: CUU-085 | Consultar y filtrar el centro de notificaciones y alertas por granja, origen, tipo, animal y estado |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-015 — Centro de Notificaciones y Gestión Operativa de Alertas (Ref. Inicial: CU015) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Revisar las alertas pendientes o el historial de alertas de la granja filtrando por origen (Modelo Predictivo IA, Sensor/Umbral Físico o Escape de Cerco), por categoría, por animal específico y por estado (Activas, Resueltas o Falsos Positivos). |
| **Precondiciones y Estado Inicial de las Entidades** | **• Entidad Granja:** En estado "Activa", y el usuario tiene acceso a ella. |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario ingresa al Centro de Notificaciones y Alertas y selecciona la granja. 2\. El sistema muestra el contador de alertas activas sin resolver y el listado ordenado de la más reciente a la más antigua, indicando para cada alerta su origen, gravedad, animal involucrado, fecha/hora, mensaje descriptivo y porcentaje de certeza (si provino de IA). 3\. El usuario aplica los filtros de origen, animal, tipo de alerta o estado de resolución para localizar las alertas buscadas. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. No existen alertas que coincidan con los filtros seleccionados:** El sistema informa que no hay alertas para mostrar. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades de Negocio:** Sin cambios. |

#### **CUU-086 — Marcar una alerta activa como Resuelta / Atendida**

| CASO DE USO USUARIO: CUU-086 | Marcar una alerta activa como Resuelta / Atendida |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-015 — Centro de Notificaciones y Gestión Operativa de Alertas (Ref. Inicial: CU015) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Registrar que un evento de alerta (como un animal que escapó del cerco o un animal con fiebre) ya fue verificado y asistido en el campo, quitándolo de la lista de alertas pendientes. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Administrador de Granja o Empleado Operador de la granja. **• Entidad Alerta:** Se encuentra en estado "Activa / Pendiente de Atención". |
| **Flujo Básico (Paso a Paso)** | 1\. Luego de atender la situación en el establecimiento, el Administrador de Granja o el Empleado Operador pulsa "Marcar como resuelta" sobre la alerta activa. 2\. El sistema cambia el estado de la Alerta a "Resuelta / Atendida (Confirmada)" y descuenta 1 unidad del indicador de alertas pendientes. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. Un Empleado Observador intenta resolver una alerta:** El sistema no le habilita el botón por poseer rol exclusivo de consulta. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Alerta:** Pasa del estado "Activa / Pendiente de Atención" al estado "Resuelta / Atendida (Confirmada)" (y si era una alerta de IA, queda contabilizada como caso real confirmado en las métricas de precisión). |

### **CUR-016: Configuración de Umbrales Sanitarios por Granja y Disparo de Alertas por Sensor**

| CASO DE USO RESUMEN — CUR-016 (Base: CU016) | Configuración de Umbrales Sanitarios por Granja y Disparo de Alertas por Sensor |
| :---- | :---- |
| **Nivel Jerárquico** | Caso de Uso Resumen (Módulo de Negocio) |
| **Roles de Negocio que Actúan** | **Administrador de Granja (configuración y consulta), Empleado Operador y Empleado Observador (solo consulta), Sistema de Control de Umbrales (evaluación automática de lecturas), Superadministrador (en modo asistencia)** |
| **Objetivo de Negocio** | Permitir al Administrador de Granja definir para cada establecimiento los límites físicos a partir de los cuales una lectura del collar debe disparar una alerta inmediata (temperatura de fiebre, temperatura de hipotermia, minutos máximos de inactividad y envío de avisos por correo electrónico), y evaluar automáticamente cada lectura recibida contra dichos valores. |
| **Entidades de Negocio** | Configuración de Umbrales de Alerta de la Granja, Granja, Lectura Biométrica y de Ubicación, Animal, Alerta |
| **Control de Estados del Módulo** | Mantiene la Configuración de Umbrales de la Granja (pasando de "Vigentes por Defecto" a "Personalizados por el Administrador de Granja") y crea nuevas Alertas de tipo "Salud por Umbral de Sensor" en estado "Activa / Pendiente de Atención" cuando las mediciones superan los límites. |
| **Casos de Uso Usuario (3)** | • CUU-087: Consultar la configuración de umbrales sanitarios y avisos por correo de una granja • CUU-088: Modificar y guardar los umbrales de fiebre, hipotermia, inactividad y avisos por correo de la granja • CUU-089: Evaluar cada lectura recibida contra los umbrales de la granja y disparar alertas inmediatas de Fiebre, Hipotermia o Inactividad |

#### **CUU-087 — Consultar la configuración de umbrales sanitarios y avisos por correo de una granja**

| CASO DE USO USUARIO: CUU-087 | Consultar la configuración de umbrales sanitarios y avisos por correo de una granja |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-016 — Configuración de Umbrales Sanitarios por Granja y Disparo de Alertas por Sensor (Ref. Inicial: CU016) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Ver cuáles son los límites de temperatura para fiebre e hipotermia, el tiempo de inactividad y las preferencias de notificación por correo vigentes en el establecimiento. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Entidad Granja:** En estado "Activa", y el usuario tiene acceso a ella. |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario accede a la sección de Alertas de la granja y visualiza el panel de Configuración de Umbrales. 2\. Si la granja aún no tenía valores personalizados, el sistema inicializa y muestra automáticamente la Configuración por Defecto (Fiebre: 39,5 °C, Hipotermia: 37,0 °C, Inactividad: 120 minutos, Correos desactivados). 3\. Si ya habían sido configurados, muestra los valores personalizados vigentes. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Ninguno. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Configuración de Umbrales de la Granja:** Disponible y vigente para el establecimiento. |

#### **CUU-088 — Modificar y guardar los umbrales de fiebre, hipotermia, inactividad y avisos por correo de la granja**

| CASO DE USO USUARIO: CUU-088 | Modificar y guardar los umbrales de fiebre, hipotermia, inactividad y avisos por correo de la granja |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-016 — Configuración de Umbrales Sanitarios por Granja y Disparo de Alertas por Sensor (Ref. Inicial: CU016) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Ajustar los valores límite de disparo de alertas por sensor de acuerdo con el criterio veterinario o las características del rodeo de esa granja. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Exclusivamente el Administrador de Granja propietario del establecimiento (los Empleados Operadores y Observadores no pueden alterar los umbrales). • El valor de temperatura de hipotermia ingresado debe ser menor que el valor de temperatura de fiebre. |
| **Flujo Básico (Paso a Paso)** | 1\. En el panel de Configuración de Alertas de la granja, el Administrador de Granja modifica el umbral de fiebre (°C), el umbral de hipotermia (°C), los minutos máximos de inactividad y/o activa o desactiva los avisos por correo ante escapes o eventos de salud. 2\. Confirma el guardado de la configuración. 3\. El sistema verifica que el umbral de hipotermia sea estrictamente menor al umbral de fiebre y guarda los nuevos valores para la granja. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. El umbral de hipotermia ingresado es mayor o igual al umbral de fiebre: El sistema rechaza el cambio e informa que la temperatura de hipotermia debe ser inferior a la de fiebre. • A2. Un Empleado Operador o Empleado Observador intenta editar los umbrales: El sistema mantiene los campos en modo de solo lectura y bloquea la modificación. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Configuración de Umbrales de la Granja:** Pasa a estado "Personalizada por el Administrador de Granja" con los nuevos valores vigentes para todas las lecturas siguientes. |

#### **CUU-089 — Evaluar cada lectura recibida contra los umbrales de la granja y disparar alertas inmediatas de Fiebre, Hipotermia o Inactividad**

| CASO DE USO USUARIO: CUU-089 | Evaluar cada lectura recibida contra los umbrales de la granja y disparar alertas inmediatas de Fiebre, Hipotermia o Inactividad |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-016 — Configuración de Umbrales Sanitarios por Granja y Disparo de Alertas por Sensor (Ref. Inicial: CU016) |
| **Roles de Negocio que Actúan** | **Sistema de Control de Umbrales (al recibir una lectura de campo)** |
| **Necesidad / Objetivo** | Detectar en el acto cuando un animal presenta una temperatura corporal fuera de los límites normales o permanece inmóvil durante demasiado tiempo según los sensores del collar, generando la alerta correspondiente. |
| **Precondiciones y Estado Inicial de las Entidades** | • Se registró una nueva Lectura Biométrica y de Ubicación (CUU-060) de un collar colocado en un Animal en estado "Activo en el Rodeo". |
| **Flujo Básico (Paso a Paso)** | 1\. Al ingresar la lectura, el sistema consulta la Configuración de Umbrales de la Granja a la que pertenece el animal. 2\. Control de Fiebre: Si la temperatura medida es mayor o igual al umbral de fiebre y el animal no tuvo una alerta de fiebre por sensor en las últimas 6 horas, el sistema crea una Alerta de "Salud por Umbral de Sensor (Fiebre)" en estado "Activa / Pendiente de Atención". 3\. Control de Hipotermia: Si la temperatura medida es menor o igual al umbral de hipotermia (y superior a 20 °C para descartar collares sueltos a temperatura ambiente) y no tuvo alerta de hipotermia en las últimas 6 horas, el sistema crea una Alerta de "Salud por Umbral de Sensor (Hipotermia)" en estado "Activa / Pendiente de Atención". 4\. Control de Inactividad: Si el nivel de actividad actual es mínimo o nulo, el sistema revisa las lecturas del animal durante los últimos minutos configurados en el umbral de inactividad; si durante todo ese lapso el animal permaneció sin actividad y no tuvo alerta reciente, crea una Alerta de "Salud por Umbral de Sensor (Inactividad)" en estado "Activa / Pendiente de Atención". |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. La temperatura medida es de 20 °C o menos:** El sistema no dispara alerta de hipotermia por corresponder a una medición de ambiente (collar no colocado o caído). • A2. El animal ya tenía una alerta del mismo tipo disparada en las últimas 6 horas: No se genera una alerta duplicada. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Alerta (Nueva, si se superó alguno de los umbrales):** Queda creada con origen "Salud por Umbral de Sensor" en estado "Activa / Pendiente de Atención". |

### **CUR-017: Generación de Reportes Documentales (PDF y Excel) y Tablero Analítico**

| CASO DE USO RESUMEN — CUR-017 (Base: CU017) | Generación de Reportes Documentales (PDF y Excel) y Tablero Analítico |
| :---- | :---- |
| **Nivel Jerárquico** | Caso de Uso Resumen (Módulo de Negocio) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **Objetivo de Negocio** | Brindar a todos los roles con acceso a la granja un tablero de indicadores clave y gráficos estadísticos, y permitir la generación y descarga de reportes formales en formato PDF y planillas Excel (.xlsx) listos para compartir, auditar o presentar ante asesores veterinarios. |
| **Entidades de Negocio** | Granja, Animal, Tipo de Animal, Collar Inteligente, Zona / Cerco Virtual, Registro Médico, Lectura Biométrica y de Ubicación, Alerta |
| **Control de Estados del Módulo** | Consolida la información actual e histórica de todas las entidades de la granja para su visualización estadística o exportación documental sin alterar el estado de ningún registro. |
| **Casos de Uso Usuario (6)** | • CUU-090: Consultar el Tablero Analítico de indicadores del rodeo y evolución de alertas de los últimos 14 días • CUU-091: Descargar en planilla Excel el listado actualizado de animales o las lecturas biométricas por rango de fechas • CUU-092: Generar y descargar en PDF el Historial Médico completo de un animal • CUU-093: Generar y descargar en PDF el reporte de Escapes de Cerco Virtual por rango de fechas • CUU-094: Generar y descargar en PDF o Excel el Historial de Alertas y el desempeño del modelo predictivo • CUU-095: Generar y descargar en PDF el Resumen Ejecutivo del Rodeo de la granja |

#### **CUU-090 — Consultar el Tablero Analítico de indicadores del rodeo y evolución de alertas de los últimos 14 días**

| CASO DE USO USUARIO: CUU-090 | Consultar el Tablero Analítico de indicadores del rodeo y evolución de alertas de los últimos 14 días |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-017 — Generación de Reportes Documentales (PDF y Excel) y Tablero Analítico (Ref. Inicial: CU017) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Visualizar un resumen ejecutivo en pantalla con las cifras totales de la granja (animales activos, vendidos y fallecidos, collares en uso y libres, cercos activos, alertas pendientes, distribución por tipo de animal y gráfico diario de alertas de las últimas 2 semanas). |
| **Precondiciones y Estado Inicial de las Entidades** | **• Entidad Granja:** En estado "Activa", y el usuario tiene acceso a ella. |
| **Flujo Básico (Paso a Paso)** | 1\. El usuario ingresa a la sección de Reportes o al Tablero Principal y selecciona la granja. 2\. El sistema calcula y presenta las tarjetas de indicadores generales, el desglose de cabezas por categoría animal y el gráfico comparativo de alertas de Salud vs. Escapes día por día durante los últimos 14 días. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Ninguno. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades de Negocio:** Sin cambios. |

#### **CUU-091 — Descargar en planilla Excel el listado actualizado de animales o las lecturas biométricas por rango de fechas**

| CASO DE USO USUARIO: CUU-091 | Descargar en planilla Excel el listado actualizado de animales o las lecturas biométricas por rango de fechas |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-017 — Generación de Reportes Documentales (PDF y Excel) y Tablero Analítico (Ref. Inicial: CU017) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Obtener un archivo Excel (.xlsx) con el padrón completo de animales de la granja y su estado actual, o bien con el detalle de todas las lecturas de temperatura, actividad y ubicación registradas entre dos fechas. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Entidad Granja:** En estado "Activa", y el usuario tiene acceso a ella. |
| **Flujo Básico (Paso a Paso)** | 1a. Para el Listado de Animales: El usuario pulsa "Descargar Excel" en la tarjeta "Listado de Animales"; el sistema genera y descarga una planilla con caravana, nombre, tipo, raza, sexo, edad, peso, estado, collar y cerco actual de cada animal. 1b. Para las Lecturas Biométricas: El usuario indica opcionalmente las fechas Desde y Hasta y pulsa "Descargar Excel" en "Lecturas Biométricas"; el sistema genera y descarga una planilla con cada medición de collar asociada al animal que lo portaba en esa fecha y hora. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. No existen registros en el rango de fechas elegido:** Se descarga la planilla Excel con los encabezados de columna y sin filas de datos. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades de Negocio:** Sin cambios. El usuario obtiene el archivo Excel descargado en su equipo. |

#### **CUU-092 — Generar y descargar en PDF el Historial Médico completo de un animal**

| CASO DE USO USUARIO: CUU-092 | Generar y descargar en PDF el Historial Médico completo de un animal |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-017 — Generación de Reportes Documentales (PDF y Excel) y Tablero Analítico (Ref. Inicial: CU017) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Obtener un documento PDF formal con la ficha identificatoria de un animal específico y el detalle cronológico de todas sus vacunaciones, tratamientos, cirugías, partos, pesajes y eventos registrados. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Entidad Animal:** Existe en la granja a la que el usuario tiene acceso. |
| **Flujo Básico (Paso a Paso)** | 1\. En la sección de Reportes (o desde la ficha del animal), el usuario selecciona el animal deseado y pulsa "Descargar PDF" en "Historial Médico de un Animal". 2\. El sistema reúne los datos del animal y todos sus Registros Médicos ordenados por fecha y genera el documento PDF para su descarga. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. El usuario no seleccionó ningún animal:** El botón de descarga permanece deshabilitado indicando "Elegí un animal". |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades de Negocio:** Sin cambios. El usuario obtiene el documento PDF del historial clínico. |

#### **CUU-093 — Generar y descargar en PDF el reporte de Escapes de Cerco Virtual por rango de fechas**

| CASO DE USO USUARIO: CUU-093 | Generar y descargar en PDF el reporte de Escapes de Cerco Virtual por rango de fechas |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-017 — Generación de Reportes Documentales (PDF y Excel) y Tablero Analítico (Ref. Inicial: CU017) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Contar con un informe en PDF de todos los incidentes de escape de cerco virtual ocurridos en la granja durante un período determinado. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Entidad Granja:** En estado "Activa", y el usuario tiene acceso a ella. |
| **Flujo Básico (Paso a Paso)** | 1\. En la sección de Reportes, el usuario define opcionalmente el rango de fechas Desde / Hasta y pulsa "Descargar PDF" en la tarjeta "Escapes de Cerco Virtual". 2\. El sistema recopila todas las Alertas de tipo "Escape de Cerco" de la granja en ese período y genera el documento PDF detallando fecha/hora, animal, descripción y si fue resuelto. |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. No hubo escapes en las fechas elegidas:** El documento PDF se genera informando que no se registraron escapes en ese período. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades de Negocio:** Sin cambios. El usuario obtiene el PDF de escapes. |

#### **CUU-094 — Generar y descargar en PDF o Excel el Historial de Alertas y el desempeño del modelo predictivo**

| CASO DE USO USUARIO: CUU-094 | Generar y descargar en PDF o Excel el Historial de Alertas y el desempeño del modelo predictivo |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-017 — Generación de Reportes Documentales (PDF y Excel) y Tablero Analítico (Ref. Inicial: CU017) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Exportar en formato PDF o Excel el registro completo de alertas de la granja, incluyendo su origen (Modelo Predictivo IA, Sensor/Umbral o Escape), porcentaje de certeza, estado (Activa, Resuelta o Falso Positivo), notas del operario y resumen de precisión. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Entidad Granja:** En estado "Activa", y el usuario tiene acceso a ella. |
| **Flujo Básico (Paso a Paso)** | 1\. En la tarjeta "Historial de Alertas" de la sección de Reportes, el usuario elige el formato de salida ("PDF" o "Excel") y opcionalmente el rango de fechas, y pulsa "Descargar". 2\. El sistema reúne las alertas del período junto con los indicadores de precisión y falsos positivos, y genera el archivo en el formato elegido. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Ninguno. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades de Negocio:** Sin cambios. El usuario obtiene el reporte de alertas en PDF o Excel. |

#### **CUU-095 — Generar y descargar en PDF el Resumen Ejecutivo del Rodeo de la granja**

| CASO DE USO USUARIO: CUU-095 | Generar y descargar en PDF el Resumen Ejecutivo del Rodeo de la granja |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-017 — Generación de Reportes Documentales (PDF y Excel) y Tablero Analítico (Ref. Inicial: CU017) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Empleado Operador, Empleado Observador, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Obtener un informe ejecutivo en PDF con la fotografía actual del establecimiento: totales de animales por estado, collares asignados, cercos activos, alertas sin resolver y composición del rodeo por categoría. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Entidad Granja:** En estado "Activa", y el usuario tiene acceso a ella. |
| **Flujo Básico (Paso a Paso)** | 1\. En la sección de Reportes, el usuario pulsa "Descargar PDF" en la tarjeta "Resumen del Rodeo". 2\. El sistema consolida los totales actuales de la granja y descarga el documento PDF. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Ninguno. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades de Negocio:** Sin cambios. El usuario obtiene el PDF de resumen ejecutivo. |

### **CUR-018: Gestión de Personal de la Granja (Empleados Operadores y Observadores)**

| CASO DE USO RESUMEN — CUR-018 (Base: CU018) | Gestión de Personal de la Granja (Empleados Operadores y Observadores) |
| :---- | :---- |
| **Nivel Jerárquico** | Caso de Uso Resumen (Módulo de Negocio) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Superadministrador (en modo asistencia)** |
| **Objetivo de Negocio** | Permitir al Administrador de Granja conformar y administrar su propio equipo de trabajo para sus establecimientos: dando de alta nuevos empleados con contraseña provisoria, asignándoles el rol de Empleado Operador o Empleado Observador en una o varias de sus granjas, reincorporando ex-empleados, modificando sus permisos, blanqueando sus contraseñas y dándolos de baja. |
| **Entidades de Negocio** | Usuario (Empleado), Asignación de Empleado a Granja, Granja |
| **Control de Estados del Módulo** | Controla el ciclo de vida del Usuario con rol de Empleado ("Activa con Cambio de Contraseña Pendiente", "Activa y Operativa" y "Suspendida / Dada de Baja") y el estado de cada Asignación de Empleado a Granja ("Asignación Activa" con rol Operador u Observador, o "Asignación Revocada / Inactiva"). |
| **Casos de Uso Usuario (5)** | • CUU-096: Consultar la nómina de personal propio y las granjas donde cada empleado tiene acceso • CUU-097: Dar de alta un nuevo empleado o reincorporar a un ex-empleado asignándole su rol (Operador u Observador) y sus granjas • CUU-098: Modificar el nombre, el rol operativo (Operador u Observador) o las granjas asignadas a un empleado • CUU-099: Blanquear (restablecer) la contraseña de un empleado asignándole una clave temporal • CUU-100: Dar de baja lógica a un miembro del personal revocando su acceso a todas las granjas |

#### **CUU-096 — Consultar la nómina de personal propio y las granjas donde cada empleado tiene acceso**

| CASO DE USO USUARIO: CUU-096 | Consultar la nómina de personal propio y las granjas donde cada empleado tiene acceso |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-018 — Gestión de Personal de la Granja (Empleados Operadores y Observadores) (Ref. Inicial: CU018) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Visualizar la lista completa de empleados contratados por el Administrador de Granja, conociendo su nombre, correo electrónico, si actúan como Empleado Operador o Empleado Observador y en cuáles de sus establecimientos están habilitados. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Administrador de Granja titular de al menos una granja activa. |
| **Flujo Básico (Paso a Paso)** | 1\. El Administrador de Granja accede a la sección de Personal. 2\. El sistema lista todos los Empleados vinculados a sus establecimientos, mostrando sus datos personales, su rol en el campo (Empleado Operador o Empleado Observador) y las granjas que tienen asignadas. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Un Empleado Operador o Empleado Observador intenta acceder a la administración de personal: El sistema deniega el acceso por ser facultad exclusiva del Administrador de Granja. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades de Negocio:** Sin cambios. |

#### **CUU-097 — Dar de alta un nuevo empleado o reincorporar a un ex-empleado asignándole su rol (Operador u Observador) y sus granjas**

| CASO DE USO USUARIO: CUU-097 | Dar de alta un nuevo empleado o reincorporar a un ex-empleado asignándole su rol (Operador u Observador) y sus granjas |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-018 — Gestión de Personal de la Granja (Empleados Operadores y Observadores) (Ref. Inicial: CU018) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Incorporar un nuevo trabajador al equipo (o volver a habilitar a un ex-empleado que había sido dado de baja anteriormente por el mismo Administrador de Granja), definiendo si será Empleado Operador o Empleado Observador y en qué granjas trabajará. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Administrador de Granja propietario de los establecimientos seleccionados. • El correo electrónico ingresado no pertenece a otro Administrador de Granja, ni al Superadministrador, ni a un empleado de otro productor distinto. |
| **Flujo Básico (Paso a Paso)** | 1\. El Administrador de Granja selecciona la opción de agregar personal. 2\. Completa el nombre, apellido, correo electrónico y contraseña temporal del empleado, elige su rol de negocio en el campo ("Empleado Operador" o "Empleado Observador") y marca una o varias de sus granjas. 3a. Si es una persona nueva en el sistema: El sistema crea el Usuario con rol de Empleado en estado "Activa con Cambio de Contraseña Pendiente" y crea las Asignaciones de Empleado a Granja en estado "Asignación Activa" para cada granja marcada. 3b. Si el correo corresponde a un ex-empleado del mismo Administrador de Granja que estaba dado de baja: El sistema reactiva su cuenta pasándola a "Activa con Cambio de Contraseña Pendiente" con la nueva clave temporal y reactiva sus Asignaciones en las granjas seleccionadas con el nuevo rol. |
| **Caminos Alternativos y Reglas de Negocio** | • A1. El correo electrónico ya pertenece a un empleado actualmente activo del mismo Administrador de Granja: El sistema informa que ya forma parte del personal activo y que puede editar sus granjas desde el listado. • A2. El correo electrónico está registrado por otro cliente o usuario ajeno: El sistema rechaza el alta informando que el correo ya está en uso en la plataforma. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Usuario (Empleado):** Queda en estado "Activa con Cambio de Contraseña Pendiente" (deberá definir su clave personal al ingresar por primera vez). **• Entidades Asignación de Empleado a Granja (para las granjas elegidas):** Quedan en estado "Asignación Activa" con el rol de "Empleado Operador" o "Empleado Observador" según lo seleccionado. |

#### **CUU-098 — Modificar el nombre, el rol operativo (Operador u Observador) o las granjas asignadas a un empleado**

| CASO DE USO USUARIO: CUU-098 | Modificar el nombre, el rol operativo (Operador u Observador) o las granjas asignadas a un empleado |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-018 — Gestión de Personal de la Granja (Empleados Operadores y Observadores) (Ref. Inicial: CU018) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Actualizar los permisos de un empleado activo (por ejemplo, promoverlo de Empleado Observador a Empleado Operador) o sumarle y quitarle establecimientos donde presta servicio. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Administrador de Granja empleador. **• Entidad Usuario (Empleado):** En estado "Activa" dentro del plantel del Administrador de Granja. |
| **Flujo Básico (Paso a Paso)** | 1\. El Administrador de Granja selecciona la opción de editar sobre un miembro de su personal. 2\. Modifica su nombre, cambia su rol entre "Empleado Operador" y "Empleado Observador" y/o marca o desmarca las granjas a las que tendrá acceso (manteniendo al menos una granja seleccionada), y guarda los cambios. 3\. El sistema actualiza los datos del empleado: en las granjas seleccionadas mantiene o activa su Asignación con el nuevo rol, y en las granjas que fueron desmarcadas pasa su Asignación al estado "Asignación Revocada / Inactiva". |
| **Caminos Alternativos y Reglas de Negocio** | • A1. Se desmarcan todas las granjas dejando al empleado sin ningún establecimiento: El sistema solicita seleccionar al menos una granja (o utilizar la opción de Dar de Baja al empleado si ya no trabajará en ninguna). |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Usuario (Empleado):** Permanece en estado "Activa" con su nombre actualizado. **• Entidades Asignación de Empleado a Granja (Granjas seleccionadas):** Quedan en estado "Asignación Activa" con el nuevo rol ("Empleado Operador" o "Empleado Observador"). **• Entidades Asignación de Empleado a Granja (Granjas desmarcadas):** Pasan del estado "Asignación Activa" al estado "Asignación Revocada / Inactiva" (el empleado deja de ver y operar en esos establecimientos de inmediato). |

#### **CUU-099 — Blanquear (restablecer) la contraseña de un empleado asignándole una clave temporal**

| CASO DE USO USUARIO: CUU-099 | Blanquear (restablecer) la contraseña de un empleado asignándole una clave temporal |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-018 — Gestión de Personal de la Granja (Empleados Operadores y Observadores) (Ref. Inicial: CU018) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Generar una nueva contraseña provisoria para un empleado que olvidó su clave de acceso, obligándolo a elegir una contraseña propia apenas vuelva a iniciar sesión. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Administrador de Granja empleador. **• Entidad Usuario (Empleado):** Pertenece al personal del Administrador de Granja. |
| **Flujo Básico (Paso a Paso)** | 1\. En el listado de personal, el Administrador de Granja selecciona la opción de restablecer contraseña sobre el empleado. 2\. Ingresa la nueva contraseña temporal y confirma la operación. 3\. El sistema actualiza la clave del empleado y cambia el estado de su cuenta a "Activa con Cambio de Contraseña Pendiente". |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. La contraseña temporal ingresada tiene menos de 6 caracteres:** El sistema solicita ingresar una clave de al menos 6 caracteres. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidad Usuario (Empleado):** Pasa al estado "Activa con Cambio de Contraseña Pendiente" (al iniciar sesión con la clave temporal será dirigido obligatoriamente a definir su clave personal según CUU-002). |

#### **CUU-100 — Dar de baja lógica a un miembro del personal revocando su acceso a todas las granjas**

| CASO DE USO USUARIO: CUU-100 | Dar de baja lógica a un miembro del personal revocando su acceso a todas las granjas |
| :---- | :---- |
| **Caso de Uso Resumen Padre** | CUR-018 — Gestión de Personal de la Granja (Empleados Operadores y Observadores) (Ref. Inicial: CU018) |
| **Roles de Negocio que Actúan** | **Administrador de Granja, Superadministrador (en modo asistencia)** |
| **Necesidad / Objetivo** | Desvincular a un empleado que deja de trabajar para el Administrador de Granja, bloqueando su ingreso al sistema y su acceso a todos los establecimientos, pero conservando el historial de las tareas y revisiones de alertas que realizó. |
| **Precondiciones y Estado Inicial de las Entidades** | **• Actor:** Administrador de Granja empleador. **• Entidad Usuario (Empleado):** Se encuentra en estado "Activa" con Asignaciones Activas en las granjas del productor. |
| **Flujo Básico (Paso a Paso)** | 1\. El Administrador de Granja selecciona la opción de dar de baja sobre el empleado y confirma la decisión. 2\. El sistema ejecuta de manera conjunta:    a) Cambia todas las Asignaciones de Empleado a Granja de ese trabajador al estado "Asignación Revocada / Inactiva", registrando la fecha y hora de baja.    b) Cambia el estado de la cuenta del Usuario (Empleado) a "Suspendida / Dada de Baja". |
| **Caminos Alternativos y Reglas de Negocio** | **• A1. El Administrador de Granja cancela la confirmación:** El empleado conserva su cuenta y asignaciones activas. |
| **Postcondiciones y Estado Final de las Entidades** | **• Entidades Asignación de Empleado a Granja (todas las del empleado):** Pasan del estado "Asignación Activa" al estado "Asignación Revocada / Inactiva" (con fecha de baja registrada). **• Entidad Usuario (Empleado):** Pasa del estado "Activa" al estado "Suspendida / Dada de Baja" (su sesión se cierra de inmediato y no puede volver a ingresar al sistema, salvo que en el futuro el Administrador de Granja decida reincorporarlo mediante CUU-097). |

