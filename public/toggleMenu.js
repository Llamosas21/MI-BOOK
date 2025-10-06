let isMenuOpen = false;

function toggleMenu() {
  const sideMenu = document.querySelector('.side-menu');
  if (sideMenu) {
    if (isMenuOpen) {
      sideMenu.classList.remove('open');
    } else {
      sideMenu.classList.add('open');
    }
    isMenuOpen = !isMenuOpen;
  }
}
