const SUPABASE_URL = "https://tyjnjfnmahmudmngplmm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Ifcgd7IKNrOofkyht41K9A_BSlZJvCS";

const form = document.querySelector(".turnos-form");
const message = document.querySelector("#mensaje-turno");
const availabilityMessage = document.querySelector("#mensaje-disponibilidad");
const dateInput = form.elements.fecha;
const timeSelect = form.elements.horario;
const serviceSelect = form.elements.servicio;
const submitButton = form.querySelector('button[type="submit"]');
const businessTimeZone = "America/Argentina/Buenos_Aires";

let allHours = []; // { id, start, label } cargado desde la tabla franjas

function getBusinessDateTime() {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: businessTimeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

    return {
        date: `${values.year}-${values.month}-${values.day}`,
        time: `${values.hour}:${values.minute}`,
    };
}

dateInput.min = getBusinessDateTime().date;

dateInput.addEventListener("click", () => {
    try {
        dateInput.showPicker();
    } catch {
        // Navegador sin soporte: queda el comportamiento normal (ícono)
    }
});
function isFutureAppointment(date, time) {
    const now = getBusinessDateTime();
    return date > now.date || (date === now.date && time > now.time);
}

function setTimeOptions(placeholder, hours = []) {
    timeSelect.replaceChildren(
        new Option(placeholder, ""),
        ...hours.map((hour) => new Option(hour.label, hour.id))
    );
}

const shortTime = (value) => String(value).slice(0, 5);

const diasConAtencion = [4, 5, 6]; // jueves, viernes y sábado

function atiendeEseDia(fecha) {
    const [anio, mes, dia] = fecha.split("-").map(Number);
    return diasConAtencion.includes(new Date(anio, mes - 1, dia).getDay());
}

const formatPrice = (value) =>
    new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0,
    }).format(Number(value));

const configReady =
    SUPABASE_URL.startsWith("https://") &&
    (SUPABASE_ANON_KEY.startsWith("sb_publishable_") ||
        SUPABASE_ANON_KEY.startsWith("eyJ"));

setTimeOptions("Elegí una fecha primero");
timeSelect.disabled = true;
submitButton.disabled = true;

if (!configReady) {
    message.textContent = "Falta configurar la conexión con Supabase.";
} else {
    const supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    );

    // Carga servicios (con precio actual) y franjas horarias desde la base
    async function loadInitialData() {
        const [franjasRes, serviciosRes] = await Promise.all([
            supabaseClient
                .from("franjas")
                .select("id, hora_inicio, hora_fin")
                .eq("activa", true)
                .order("hora_inicio"),
            supabaseClient
                .from("precios_actuales")
                .select("servicio_id, nombre, precio")
                .order("servicio_id"),
        ]);

        if (franjasRes.error || serviciosRes.error) {
            throw franjasRes.error || serviciosRes.error;
        }

        allHours = franjasRes.data.map((franja) => ({
            id: franja.id,
            start: shortTime(franja.hora_inicio),
            label: `${shortTime(franja.hora_inicio)} - ${shortTime(franja.hora_fin)}`,
        }));

        serviceSelect.replaceChildren(
            new Option("Seleccioná un servicio", ""),
            ...serviciosRes.data.map(
                (s) => new Option(`${s.nombre} - ${formatPrice(s.precio)}`, s.servicio_id)
            )
        );
    }

    const dataReady = loadInitialData().catch(() => {
        message.textContent = "No se pudieron cargar los servicios. Recargá la página.";
    });

    let availabilityRequest = 0;

    dateInput.addEventListener("change", async () => {
        const selectedDate = dateInput.value;
        const requestId = ++availabilityRequest;

        timeSelect.disabled = true;
        submitButton.disabled = true;
        setTimeOptions(selectedDate ? "Consultando horarios..." : "Elegí una fecha primero");
        availabilityMessage.textContent = "";

        if (!selectedDate) {
            return;
        }

        if (!atiendeEseDia(selectedDate)) {
            setTimeOptions("Ese día no hay atención");
            availabilityMessage.textContent = "Atendemos solo jueves, viernes y sábados.";
            return;
        }

        try {
            await dataReady;

            const [ocupadasRes, bloqueadoRes] = await Promise.all([
                supabaseClient.rpc("franjas_ocupadas", { dia: selectedDate }),
                supabaseClient
                    .from("dias_bloqueados")
                    .select("motivo")
                    .eq("fecha", selectedDate)
                    .maybeSingle(),
            ]);

            if (requestId !== availabilityRequest) {
                return;
            }

            if (ocupadasRes.error || bloqueadoRes.error) {
                setTimeOptions("No se pudieron cargar los horarios");
                availabilityMessage.textContent = "Probá elegir la fecha de nuevo.";
                return;
            }

            if (bloqueadoRes.data) {
                setTimeOptions("Ese día no hay atención");
                availabilityMessage.textContent =
                    bloqueadoRes.data.motivo || "Elegí otra fecha.";
                return;
            }

            const reservedIds = new Set(ocupadasRes.data.map((row) => row.franja_id));
            const availableHours = allHours.filter(
                (hour) =>
                    !reservedIds.has(hour.id) &&
                    isFutureAppointment(selectedDate, hour.start)
            );

            if (availableHours.length === 0) {
                setTimeOptions("No quedan horarios para esa fecha");
                availabilityMessage.textContent = "Elegí otra fecha.";
                return;
            }

            setTimeOptions("Seleccioná un horario", availableHours);
            timeSelect.disabled = false;
            submitButton.disabled = false;
        } catch {
            if (requestId === availabilityRequest) {
                setTimeOptions("No se pudieron cargar los horarios");
                availabilityMessage.textContent = "Revisá tu conexión e intentá de nuevo.";
            }
        }
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const selectedHour = allHours.find(
            (hour) => String(hour.id) === timeSelect.value
        );

        if (!selectedHour || !isFutureAppointment(dateInput.value, selectedHour.start)) {
            message.textContent = "Ese horario ya pasó. Elegí otro.";
            timeSelect.value = "";
            dateInput.dispatchEvent(new Event("change"));
            return;
        }

        message.textContent = "Guardando turno...";
        submitButton.disabled = true;

        const formData = new FormData(form);
        const turno = {
            servicio_id: Number(formData.get("servicio")),
            fecha: formData.get("fecha"),
            franja_id: Number(formData.get("horario")),
            cliente_nombre: formData.get("nombre").trim(),
            cliente_telefono: formData.get("telefono").trim(),
            // precio_cobrado lo completa la base automáticamente
        };
        dateInput.disabled = true;

        try {
            const { error } = await supabaseClient.from("turnos").insert(turno);

            if (error?.code === "23505") {
                message.textContent = "Ese horario ya está reservado. Elegí otro.";
                dateInput.dispatchEvent(new Event("change"));
            } else if (error?.code === "P0001") {
                // Mensajes del trigger: horario pasado, día sin atención, etc.
                message.textContent = error.message;
            } else if (error) {
                message.textContent = "No se pudo guardar el turno. Probá de nuevo.";
            } else {
                message.textContent = "Turno reservado. ¡Te esperamos!";
                form.reset();
                setTimeOptions("Elegí una fecha primero");
                timeSelect.disabled = true;
                availabilityMessage.textContent = "";
            }
        } catch {
            message.textContent = "No se pudo conectar. Revisá tu conexión e intentá de nuevo.";
        } finally {
            dateInput.disabled = false;
            submitButton.disabled = timeSelect.disabled;
        }
    });
}