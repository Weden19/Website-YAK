function toggleMenu() {
  document.getElementById('mobileNav').classList.toggle('open');
}

function closeMenu() {
  document.getElementById('mobileNav').classList.remove('open');
}

// Подсвечиваем активную ссылку при скролле
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-link');

window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(sec => {
    if (window.scrollY >= sec.offsetTop - 100) {
      current = sec.getAttribute('id');
    }
  });
  navLinks.forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('href') === '#' + current) {
      link.classList.add('active');
    }
  });
});
