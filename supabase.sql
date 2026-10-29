-- 1. TABLAS

create table franjas (
  id smallint primary key,
  hora_inicio time not null,
  hora_fin time not null,
  bloque text not null check (bloque in ('mañana','tarde')),
  activa boolean not null default true
);

create table servicios (
  id smallint generated always as identity primary key,
  nombre text not null,
  activo boolean not null default true
);

create table precios (
  id bigint generated always as identity primary key,
  servicio_id smallint not null references servicios(id),
  precio numeric(10,2) not null check (precio >= 0),
  vigente_desde date not null default current_date
);

create table turnos (
  id bigint generated always as identity primary key,
  fecha date not null,
  franja_id smallint not null references franjas(id),
  servicio_id smallint not null references servicios(id),
  cliente_nombre text not null,
  cliente_telefono text not null,
  precio_cobrado numeric(10,2),
  estado text not null default 'confirmado'
    check (estado in ('confirmado','cancelado','atendido')),
  creado_en timestamptz not null default now()
);

create table dias_bloqueados (
  fecha date primary key,
  motivo text
);


-- 2. EVITAR DOBLE RESERVA

create unique index turnos_unico_activo
  on turnos (fecha, franja_id)
  where estado <> 'cancelado';


-- 3. VALIDACIONES AL RESERVAR
--    (no pasado, no día bloqueado, precio automático)

create or replace function validar_turno_nuevo()
returns trigger language plpgsql as $$
declare
  ahora timestamp := now() at time zone 'America/Argentina/Buenos_Aires';
  inicio time;
  precio_actual numeric(10,2);
begin
  select hora_inicio into inicio from franjas where id = new.franja_id;

  if (new.fecha + inicio) <= ahora then
    raise exception 'No se puede reservar un horario que ya pasó';
  end if;

  if exists (select 1 from dias_bloqueados where fecha = new.fecha) then
    raise exception 'Ese día no hay atención';
  end if;

  select precio into precio_actual
  from precios
  where servicio_id = new.servicio_id
    and vigente_desde <= ahora::date
  order by vigente_desde desc
  limit 1;

  if precio_actual is null then
    raise exception 'El servicio no tiene precio cargado';
  end if;

  new.precio_cobrado := precio_actual;  -- el cliente no puede elegir el precio
  return new;
end;
$$;

create trigger turnos_validar_antes_de_insertar
before insert on turnos
for each row execute function validar_turno_nuevo();


-- 4. DATOS INICIALES

insert into franjas (id, hora_inicio, hora_fin, bloque) values
(1,'09:00','09:40','mañana'),(2,'09:40','10:20','mañana'),
(3,'10:20','11:00','mañana'),(4,'11:00','11:40','mañana'),
(5,'11:40','12:20','mañana'),(6,'12:20','13:00','mañana'),
(7,'14:00','14:40','tarde'),(8,'14:40','15:20','tarde'),
(9,'15:20','16:00','tarde'),(10,'16:00','16:40','tarde'),
(11,'16:40','17:20','tarde'),(12,'17:20','18:00','tarde'),
(13,'18:00','18:40','tarde'),(14,'18:40','19:20','tarde'),
(15,'19:20','20:00','tarde'),(16,'20:00','20:40','tarde'),
(17,'20:40','21:20','tarde');

-- EJEMPLO: cambiá los servicios y precios por los reales de tu primo
insert into servicios (nombre) values
('Corte'), ('Barba'), ('Corte + barba');

insert into precios (servicio_id, precio) values
(1, 10000), (2, 6000), (3, 15000);


-- 5. SEGURIDAD (RLS)

alter table franjas enable row level security;
alter table servicios enable row level security;
alter table precios enable row level security;
alter table turnos enable row level security;
alter table dias_bloqueados enable row level security;

-- Cualquiera puede VER horarios, servicios, precios y días bloqueados
create policy "ver franjas" on franjas for select using (true);
create policy "ver servicios" on servicios for select using (activo);
create policy "ver precios" on precios for select using (true);
create policy "ver dias bloqueados" on dias_bloqueados for select using (true);

-- Cualquiera puede RESERVAR, pero no leer los turnos de otros
create policy "reservar turno" on turnos
  for insert
  with check (estado = 'confirmado');


-- 6. FUNCIÓN PARA SABER QUÉ HORARIOS ESTÁN OCUPADOS
--    (devuelve solo ids de franja, sin nombres ni teléfonos)

create or replace function franjas_ocupadas(dia date)
returns table (franja_id smallint)
language sql security definer set search_path = public as $$
  select franja_id from turnos
  where fecha = dia and estado <> 'cancelado';
$$;

grant execute on function franjas_ocupadas(date) to anon, authenticated;