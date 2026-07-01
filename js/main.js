// ===== ЗАГРУЗКА ДАННЫХ САЙТА =====
async function loadSiteData() {
  try {
    const response = await fetch('data/vrchat.json');
    if (!response.ok) throw new Error('Network error');
    const data = await response.json();

    // Участники
    const membersEl = document.getElementById('stat-members');
    if (membersEl && data.members) {
      membersEl.textContent = data.members;
    }

    // Ближайший ивент
    if (data.nextEvent) {
      const container = document.getElementById('regularEvents');
      if (container) {
        container.innerHTML = `
          <div class="event-card">
            <h3 class="event-title">${data.nextEvent.name}</h3>
            <p class="event-date">${data.nextEvent.date} в ${data.nextEvent.time}</p>
            <p class="event-world">${data.nextEvent.world}</p>
            ${data.nextEvent.description ? `<p class="event-desc">${data.nextEvent.description}</p>` : ''}
          </div>
        `;
      }
    }

    // Галерея
    if (data.gallery && data.gallery.length > 0) {
      initSlider(data.gallery);
    } else {
      const viewport = document.querySelector('.slider-viewport');
      if (viewport) {
        viewport.innerHTML = '<div class="slider-placeholder">Фото появятся после первого ивента</div>';
      }
    }
  } catch (err) {
    console.error('Failed to load site data:', err);
  }
}

// ===== СЛАЙДЕР =====
const sliderState = {
  images: [],
  current: 0,
  timer: null,
  SLIDE_DURATION: 5000,
};

function initSlider(images) {
  const viewport = document.querySelector('.slider-viewport');
  const dotsContainer = document.getElementById('sliderDots');
  const totalEl = document.getElementById('sliderTotal');
  const currentEl = document.getElementById('sliderCurrent');

  if (!viewport || !images || images.length === 0) return;

  sliderState.images = images;
  sliderState.current = 0;

  viewport.innerHTML = '';
  if (dotsContainer) dotsContainer.innerHTML = '';

  images.forEach((url, i) => {
    const slide = document.createElement('div');
    slide.className = 'slider-slide' + (i === 0 ? ' is-active' : '');
    slide.dataset.index = i;

    const img = document.createElement('img');
    img.src = url;
    img.alt = `Фото ${i + 1}`;
    img.loading = i < 2 ? 'eager' : 'lazy';
    img.decoding = 'async';

    slide.appendChild(img);
    viewport.appendChild(slide);

    if (dotsContainer) {
      const dot = document.createElement('button');
      dot.className = 'slider-dot' + (i === 0 ? ' is-active' : '');
      dot.setAttribute('aria-label', `Слайд ${i + 1}`);
      dot.onclick = () => goToSlide(i);
      dotsContainer.appendChild(dot);
    }
  });

  if (totalEl) totalEl.textContent = images.length;
  if (currentEl) currentEl.textContent = 1;

  startAutoPlay();
}

function goToSlide(index) {
  const slides = document.querySelectorAll('.slider-slide');
  const dots = document.querySelectorAll('.slider-dot');
  const currentEl = document.getElementById('sliderCurrent');
  const total = sliderState.images.length;

  if (total === 0) return;

  const next = ((index % total) + total) % total;

  slides[sliderState.current]?.classList.remove('is-active');
  dots[sliderState.current]?.classList.remove('is-active');

  sliderState.current = next;
  slides[next]?.classList.add('is-active');
  dots[next]?.classList.add('is-active');

  if (currentEl) currentEl.textContent = next + 1;
}

function startAutoPlay() {
  stopAutoPlay();
  sliderState.timer = setInterval(() => {
    goToSlide(sliderState.current + 1);
  }, sliderState.SLIDE_DURATION);
}

function stopAutoPlay() {
  if (sliderState.timer) {
    clearInterval(sliderState.timer);
    sliderState.timer = null;
  }
}

function sliderNext() {
  goToSlide(sliderState.current + 1);
  startAutoPlay();
}

function sliderPrev() {
  goToSlide(sliderState.current - 1);
  startAutoPlay();
}

window.sliderNext = sliderNext;
window.sliderPrev = sliderPrev;

window.toggleMenu = function() {
  const nav = document.getElementById('mobileNav');
  if (nav) nav.classList.toggle('open');
};

window.closeMenu = function() {
  const nav = document.getElementById('mobileNav');
  if (nav) nav.classList.remove('open');
};

document.addEventListener('DOMContentLoaded', () => {
  loadSiteData();

  const slider = document.querySelector('.slider');
  if (slider) {
    slider.addEventListener('mouseenter', stopAutoPlay);
    slider.addEventListener('mouseleave', startAutoPlay);
  }

  document.addEventListener('keydown', (e) => {
    if (!sliderState.images.length) return;
    if (e.key === 'ArrowLeft') sliderPrev();
    if (e.key === 'ArrowRight') sliderNext();
  });
});