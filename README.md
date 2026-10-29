💈 Barbería Dulout 💈

Sitio web de **Barbería Dulout** (Chacabuco, Buenos Aires, Argentina) con **reserva de turnos online**. 
Los clientes eligen servicio, día y horario desde la página; el turno queda guardado en una base de datos y se registra automáticamente en Google Calendar.

## Funcionalidades

- **Página principal** (`index.html`) con la presentación de la barbería, los servicios con sus precios y los datos de contacto.
- **Servicios y precios dinámicos:** se cargan desde Supabase mediante `js/servicios.js`, así que se actualizan desde la base de datos sin tocar el HTML.
- **Reserva de turnos** (`turnos.html`): formulario con servicio, fecha, horario y datos del cliente. Los horarios ya ocupados no se pueden volver a reservar, y solo se pueden elegir los días de atención (jueves, viernes y sábados).
- **Base de datos en Supabase** (PostgreSQL) para turnos, franjas horarias, servicios y precios.
- **Sincronización con Google Calendar** mediante Make.com: al crear un turno se genera el evento (con el servicio y el nombre del cliente) y al eliminarlo se borra del calendario.

## Tecnologías

| Frontend | HTML, CSS y JavaScript |
| Base de datos | Supabase (`supabase-js`) |
| Automatizaciones | Make.com |
| Agenda | Google Calendar |

## Estructura del proyecto

```
.
├── index.html          # Página principal
├── turnos.html         # Página de reserva de turnos
├── supabase.sql        # Script SQL con las tablas de la base de datos
├── css/
│   └── estilos.css     # Estilos del sitio
└── js/
    ├── servicios.js    # Carga de servicios y precios desde Supabase
    └── turnos.js       # Lógica de la reserva de turnos
```

## Base de datos

El esquema completo está en `supabase.sql`. Las tablas principales son:


| `turnos` | Reservas: fecha, franja, servicio, datos del cliente, precio cobrado, estado e ID del evento de Google Calendar (`google_event_id`). |
| `franjas` | Horarios del día (`hora_inicio`, `hora_fin`, bloque mañana/tarde, activa). |
| `servicios` | Servicios que ofrece la barbería (nombre, descripción, activo). |
| `precios` | Historial de precios por servicio (`precio`, `vigente_desde`). |
| `dias_bloqueados` | Días sin atención (`fecha`, `motivo`). No se puede reservar un turno en esas fechas. |


### Agenda
Se atiende **solo con turno, los jueves, viernes y sábados**. Los turnos duran **40 minutos**:

- **Mañana:** 6 turnos, de 09:00 a 13:00 (el último empieza 12:20).
- **Tarde:** 11 turnos, de 14:00 a 21:20 (el último empieza 20:40).

La restricción de días se valida en dos lugares: en la página (`js/turnos.js`, para que el cliente no pueda elegir otros días) 
y en la base de datos (trigger `validar_turno_nuevo`, que rechaza cualquier turno fuera de esos días).

### Horarios ocupados

La función `franjas_ocupadas(dia)` devuelve los IDs de las franjas ya reservadas en una fecha. Así la página puede ocultar esos horarios sin exponer los datos de otros clientes (nombres ni teléfonos).


## Integración con Google Calendar (Make.com)

Hay dos escenarios en Make, activados por **Database Webhooks** de Supabase sobre la tabla `turnos`:

**Crear turno** (evento `INSERT`)

1. Webhook recibe el turno nuevo.
2. HTTP GET a Supabase para traer la franja horaria (`hora_inicio` / `hora_fin`).
3. Parse JSON.
4. HTTP GET a Supabase para traer el nombre del servicio.
5. Google Calendar → *Create an Event*, con el servicio y el cliente en el título.
6. HTTP PATCH a Supabase para guardar el `google_event_id` en el turno.

**Eliminar turno** (evento `DELETE`)

1. Webhook recibe el turno eliminado (los datos vienen en `old_record`).
2. Google Calendar → *Delete an Event*, usando el `google_event_id`.

> La sincronización va en una sola dirección: **base de datos → Google Calendar**. Para cancelar un turno hay que borrarlo desde la base de datos; borrar el evento a mano en el calendario no lo elimina de Supabase.

## Próximas mejoras

- Panel simple para que el barbero gestione y cancele turnos.
- Sincronización inversa (calendario → base de datos).

## Licencia

Proyecto personal. Todos los derechos reservados.
