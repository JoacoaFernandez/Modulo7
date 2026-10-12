# TPO — UADEnet (Desarrollo de Aplicaciones II, 2Q 2026)

> Enunciado del Trabajo Práctico Obligatorio. Docente: Ing. Joaquín Timerman.
> **Nuestro módulo: 7. Analítica Institucional.**

## Contexto

La universidad desea modernizar su ecosistema digital para mejorar la experiencia de los estudiantes, docentes y administrativos. Actualmente, muchos procesos están fragmentados entre sistemas obsoletos, planillas manuales y aplicaciones poco escalables.

Se solicita desarrollar **"UADEnet"**, una plataforma modular que integre los principales servicios académicos, administrativos y de vida universitaria. El sistema debe estar preparado para operar en **múltiples sedes**, con **escalabilidad regional** y soporte a **eventos asincrónicos**.

## Requerimientos generales

- Cada grupo estará conformado por 5 o 6 estudiantes.
- Cada grupo diseñará e implementará un módulo del sistema "UADEnet".
- Cada módulo deberá integrarse con otros de acuerdo con las reglas de negocio establecidas en este documento. Los métodos de integración quedarán a criterio de cada grupo, y deberán estar justificados y correctamente defendidos en las entregas parciales y finales.
- Las tecnologías utilizadas para desarrollar cada módulo quedarán a criterio de cada grupo, y deberán estar justificadas y correctamente defendidas en las entregas parciales y finales.
- Se deberá documentar correctamente las APIs con herramientas como **Swagger** o **Postman**.

## Listado de módulos

### 1. Portal del Estudiante

- Login con mail de la universidad.
- Inscripción a materias del cuatrimestre y visualización de materias cursadas previamente (al menos: materia, cuatrimestre, nota obtenida y situación de la materia).
- Cuando se carga el resultado de un examen, notificación **en tiempo real** que lleve a una página con información de la materia y el resultado del examen.
- Cuando se aplica una sanción por préstamo tardío, notificación **en tiempo real** que lleve al portal de la biblioteca con información sobre la sanción aplicada.
- Cuando se aproxima un evento académico, notificación con enlace al portal de eventos con sus detalles.
- Calendario académico para consultar turnos de comedor, eventos y exámenes.
- Historial de compras y productos adquiridos en la Tienda Virtual.
- Carga de saldo para la cuenta institucional.

### 2. Portal del Docente

- Login con mail de la universidad.
- Alta de cursos, calificaciones y actas.
- Gestión de curso: registro de asistencia de estudiantes y carga de resultados de exámenes.
- Cuando se aproxima un evento académico, notificación con enlace al portal de eventos con sus detalles.
- Calendario académico para consultar turnos de comedor, eventos y exámenes.
- Historial de compras y productos adquiridos en la Tienda Virtual.
- Carga de saldo para la cuenta institucional.

### 3. Biblioteca Universitaria

- Bibliotecarios (login con mail de la universidad): administran el stock de libros físicos existentes en cada sede.
- Estudiantes (login con mail de la universidad): consultan el stock actual y piden préstamos.
- La devolución la gestiona un bibliotecario, que al recibir el libro físico debe reflejarlo en el sistema.
- Si un estudiante no devuelve un libro pasados **7 días de la fecha límite**, se le aplica una **sanción** y una **multa** sobre su saldo en la cuenta institucional. El costo de la multa lo define el módulo de **Backoffice Administrativo**.

### 4. Sistema de Comedor

- Estudiantes, administrativos y docentes (login con mail de la universidad): reservan turnos en el comedor de una sede, visualizan el menú y pagan sus compras con el saldo de la universidad.
- Las reservas se realizan con el saldo de la cuenta institucional; el costo lo define **Backoffice Administrativo** y debe figurar al momento de reservar.
- Una vez efectuada la reserva, el costo se descuenta de la cuenta institucional y **se restituye si el usuario se presenta**.

### 5. Tienda del Campus

- Estudiantes, administrativos y docentes (login con mail de la universidad): compran artículos de la tienda (desde productos con el logo de la universidad hasta artículos de librería para la cursada).
- El portal debe tener: buscador de productos, filtro, ordenamiento por precio y carrito de compras.
- Las compras solo pueden realizarse con el saldo de la cuenta institucional.
- Los administrativos de la tienda tienen permiso para gestionar el stock de productos.

### 6. Eventos Académicos

- Administrativos (login con mail de la universidad): gestionan eventos académicos. Cada evento tiene una **locación** y un **cupo máximo**.
- Estudiantes, administrativos y docentes: consultan y se inscriben a los eventos programados.
- No se puede reservar la misma locación para dos eventos concurrentes.
- No se permite la inscripción de una persona a dos eventos concurrentes.
- Las inscripciones pueden ser gratuitas o pagas; si son pagas, se descuenta del saldo de la cuenta institucional.
- Debe desarrollarse un método para **comprobar la asistencia** a los eventos.
- Cuando falte **una semana** para el evento, el módulo envía un recordatorio al usuario inscripto.

### 7. Analítica Institucional ⭐ (nuestro módulo)

El módulo de analítica institucional deberá **recolectar los eventos generados por los otros módulos** y generar los reportes requeridos por cada módulo.

**Dashboard — Dirección Académica** (administrativos de dirección académica). Estadísticas de estudiantes, docentes y materias. Como mínimo:

- Cantidad de materias en curso.
- Tasa de aprobación para cuatrimestres anteriores, segmentada por materia.
- Tasa de aprobación por docente.

**Dashboard — Dirección Financiera** (administrativos de dirección financiera). Estadísticas del estado financiero de la universidad. Como mínimo:

- Balances de saldo de la universidad.
- Gastos administrativos (incluyendo salarios).
- Productos más vendidos de la tienda.
- Facturación de los comedores de la sede.

**Sección de estadísticas de eventos**: frecuencia, concurrencia, tasa de presentismo, etc.

### 8. Backoffice Administrativo

Administrativos del sector de Operaciones y IT (login con mail de la universidad) administran reglas de negocio y datos maestros del ecosistema:

- **Gestión de usuarios y permisos**: ABM de estudiantes, docentes y personal administrativo, y asignación de roles y permisos específicos para cada módulo.
- **Parametrización tarifaria y financiera**: configuración centralizada de precios de reservas para comedor y eventos, multas de biblioteca y **liquidación de sueldos** del personal.
- **Gestión de sedes y espacios**: alta y mantenimiento del catálogo de sedes físicas y ubicaciones.

### 9. Gestión Académica y Planificación

Administrativos de la secretaría académica (login con mail de la universidad) administran la estructura educativa:

- Alta y gestión de carreras, planes de estudio, asignaturas y correlatividades.
- Planificación y asignación de aulas físicas por sede, gestionando horarios y capacidades máximas.
- Definición de fechas de inicio/fin de cuatrimestre y turnos de exámenes finales.
- Motor de validación de condiciones de regularidad (asistencia mínima y promedio) para habilitar inscripciones a finales.

### 10. CORE

- Gestiona la **comunicación entre todos los módulos**, respetando las necesidades de cada uno.
- Crea y administra **colas** (define topics/queues, gestión de errores).
- Gestiona la **autenticación** y la seguridad del sistema: emite y valida tokens, gestiona el login.
- Implementa un **gateway** para enrutar las peticiones de los portales a los microservicios de backend.
- Implementa un sistema para gestionar las **notificaciones** de los otros módulos.
- Gestiona el **saldo de las cuentas institucionales** (cobros, visualizaciones y acreditaciones).

## Entregas

1. **Primera entrega**
   - Mocks de cada vista.
   - Flujo de datos.
2. **Segunda entrega**
   - Módulo completamente funcional con las **integraciones mockeadas**.
3. **Entrega final**
   - Módulo completamente funcional e **integrado al resto del sistema**.
   - README con instrucciones para instalar y ejecutar el módulo.
   - Diagrama de arquitectura general del sistema.