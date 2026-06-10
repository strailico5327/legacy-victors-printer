window.addEventListener('dragstart', (event) => {
  event.preventDefault();
}, true);

window.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');

  style.textContent = `
    * {
      -webkit-user-drag: none !important;
    }

    img,
    a,
    svg,
    canvas {
      -webkit-user-drag: none !important;
      user-drag: none !important;
    }
  `;

  document.head.appendChild(style);
});