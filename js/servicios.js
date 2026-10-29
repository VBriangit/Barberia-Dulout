const SUPABASE_URL = "https://tyjnjfnmahmudmngplmm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Ifcgd7IKNrOofkyht41K9A_BSlZJvCS";

const lista = document.querySelector("#lista-servicios");

function crearTarjeta(servicio) {
    const article = document.createElement("article");

    const titulo = document.createElement("h3");
    titulo.textContent = servicio.nombre;
    article.append(titulo);

    if (servicio.descripcion) {
        const descripcion = document.createElement("p");
        descripcion.textContent = servicio.descripcion;
        article.append(descripcion);
    }

    const precio = document.createElement("p");
    precio.textContent = `$${Number(servicio.precio).toLocaleString("es-AR")}`;
    article.append(precio);

    return article;
}

async function cargarServicios() {
    try {
        const cliente = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        const { data, error } = await cliente
            .from("precios_actuales")
            .select("servicio_id, nombre, precio, descripcion")
            .order("servicio_id");

        if (error) throw error;

        if (data.length === 0) {
            lista.textContent = "Pronto vas a ver los servicios acá.";
            return;
        }

        lista.replaceChildren(...data.map(crearTarjeta));
    } catch {
        lista.textContent = "No se pudieron cargar los servicios. Recargá la página.";
    }
}

cargarServicios();