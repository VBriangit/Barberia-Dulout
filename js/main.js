document.addEventListener('DOMContentLoaded', () => {
    const imagen = document.querySelector('.imagen-sobre-mi img');

    if (imagen) {
        // (hover)
        imagen.addEventListener('mouseenter', () => {
            imagen.style.borderColor = '#dfb76c'; // Oro cálido
            imagen.style.boxShadow = '0 0 20px rgba(223, 183, 108, 0.7)';
            imagen.style.transition = 'all 0.4s ease';
        });

        // Apaga el brillo cuando el mouse se aleja
        imagen.addEventListener('mouseleave', () => {
            imagen.style.borderColor = 'transparent';
            imagen.style.boxShadow = 'none';
        });
    }
});

// Menú hamburguesa
const header = document.querySelector('header');
  const btnMenu = document.getElementById('btn-menu');

  btnMenu.addEventListener('click', () => {
    const abierto = header.classList.toggle('abierto');
    btnMenu.classList.toggle('activo', abierto);
    btnMenu.setAttribute('aria-expanded', abierto);
  });

  // Cierra el menú al tocar un link
  header.querySelectorAll('nav a').forEach(link => {
    link.addEventListener('click', () => {
      header.classList.remove('abierto');
      btnMenu.classList.remove('activo');
      btnMenu.setAttribute('aria-expanded', 'false');
    });
  });