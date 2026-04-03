// Initialize Swiper for reviews slider
document.addEventListener('DOMContentLoaded', function() {

    // ── Videos Swiper (з manifest.json) ──────────────────────
    initVideoSwiper();

    async function initVideoSwiper() {
        const wrapper = document.getElementById('videoSwiperWrapper');
        if (!wrapper) return;

        let files = [];

        try {
            const res  = await fetch('videos/manifest.json');
            const data = await res.json();
            files = data.videos || [];
        } catch {
            console.warn('videos/manifest.json не знайдено або помилка читання');
            return;
        }

        if (files.length === 0) return;

        // Генеруємо слайди
        files.forEach(filename => {
            const slide = document.createElement('div');
            slide.className = 'swiper-slide';
            slide.innerHTML = `
                <div class="video-card">
                    <video src="videos/${filename}" muted loop playsinline preload="metadata"></video>
                </div>`;
            wrapper.appendChild(slide);
        });

        // Показуємо перший кадр у всіх відео після завантаження метаданих
        wrapper.querySelectorAll('video').forEach(vid => {
            vid.addEventListener('loadedmetadata', () => {
                vid.currentTime = 0.01;
            }, { once: true });
        });

        // Ініціалізуємо Swiper
        const videoSwiper = new Swiper('.videos-swiper', {
            slidesPerView: 'auto',
            centeredSlides: true,
            spaceBetween: 16,
            loop: false,
            navigation: {
                nextEl: '.videos-btn-next',
                prevEl: '.videos-btn-prev',
            },
            breakpoints: {
                768: {
                    spaceBetween: 20,
                }
            },
        });

        // Автоплей тільки активного слайду
        function playActive() {
            // Зупиняємо всі
            wrapper.querySelectorAll('video').forEach(v => {
                v.pause();
                v.currentTime = 0;
            });

            // Грає тільки активний
            const idx = videoSwiper.activeIndex;
            const activeSlide = videoSwiper.slides[idx];
            if (activeSlide) {
                const vid = activeSlide.querySelector('video');
                if (vid) {
                    vid.currentTime = 0;
                    vid.play().catch(err => console.warn('play failed:', err));
                }
            }
        }

        // Вішаємо події після ініціалізації
        videoSwiper.on('slideChangeTransitionEnd', playActive);

        // Запускаємо перший після невеликої затримки
        setTimeout(playActive, 500);
    }

    // Reviews Slider
    const reviewsSwiper = new Swiper('.reviews-slider', {
        slidesPerView: 1,
        centeredSlides: true,
        spaceBetween: 24,
        loop: true,
        centeredSlides: false,
        autoplay: {
            delay: 5000,
            disableOnInteraction: false,
        },
        breakpoints: {
            640: {
                slidesPerView: 2.5,
                spaceBetween: parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.5
            }
        }
    });
    
    // FAQ Accordion
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
        question.addEventListener('click', () => {
            // Close all other items
            faqItems.forEach(otherItem => {
                if (otherItem !== item && otherItem.classList.contains('active')) {
                    otherItem.classList.remove('active');
                }
            });
            
            // Toggle current item
            item.classList.toggle('active');
        });
    });
    
    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            
            // Skip if it's just "#"
            if (href === '#') {
                e.preventDefault();
                return;
            }
            
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Add scroll animation for cards
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe cards for animation
    const cards = document.querySelectorAll('.service-card, .vehicle-card, .feature-card, .review-card, .process-card');
    cards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(card);
    });
});

// Phone number tracking (optional - can be connected to analytics)
document.querySelectorAll('a[href^="tel:"]').forEach(link => {
    link.addEventListener('click', function() {
        // You can add analytics tracking here
        console.log('Phone number clicked:', this.getAttribute('href'));
    });
});


// ========== CALCULATOR LOGIC ==========

// URL вашого Cloudflare Worker (замініть після деплою)
const WORKER_URL = 'https://swiftglass.skifchaqwerty.workers.dev';
let calcPhotos = []; // зберігаємо File objects

// ========== AUTOCOMPLETE + VIN DECODER ==========
// Логіка винесена в окремий файл: vin-decoder.js



function calcNext(currentPage) {
    if (!calcValidatePage(currentPage)) return;

    if (currentPage === 1) {
        // no summary needed here
    }

    const pages = document.querySelectorAll('.calc-page');
    pages.forEach(p => p.classList.remove('active'));

    const next = document.querySelector(`.calc-page[data-page="${currentPage + 1}"]`);
    if (next) next.classList.add('active');

    // Update steps indicator
    updateSteps(currentPage + 1);
}

function calcBack(currentPage) {
    const pages = document.querySelectorAll('.calc-page');
    pages.forEach(p => p.classList.remove('active'));

    const prev = document.querySelector(`.calc-page[data-page="${currentPage - 1}"]`);
    if (prev) prev.classList.add('active');

    updateSteps(currentPage - 1);
}

function updateSteps(activePage) {
    document.querySelectorAll('.calc-step').forEach(step => {
        const num = parseInt(step.dataset.step);
        step.classList.remove('active', 'done');
        if (num === activePage) step.classList.add('active');
        if (num < activePage) step.classList.add('done');
    });
}

function calcValidatePage(page) {
    let valid = true;

    // Clear previous errors
    document.querySelectorAll('.calc-error-msg').forEach(e => e.remove());
    document.querySelectorAll('.calc-input.error').forEach(e => e.classList.remove('error'));

    if (page === 1) {
        const make  = document.getElementById('cMake');
        const model = document.getElementById('cModel');
        const year  = document.getElementById('cYear');

        if (!make.value.trim()) { showFieldError(make, 'Введіть марку авто'); valid = false; }
        if (!model.value.trim()) { showFieldError(model, 'Введіть модель авто'); valid = false; }
        if (!year.value.trim()) { showFieldError(year, 'Введіть рік'); valid = false; }
    }

    if (page === 2) {
        const name  = document.getElementById('cName');
        const phone = document.getElementById('cPhone');

        if (!name.value.trim()) {
            showFieldError(name, "Введіть ваше ім'я");
            valid = false;
        }
        if (!phone.value.trim()) {
            showFieldError(phone, 'Введіть номер телефону');
            valid = false;
        }
    }

    return valid;
}

function showFieldError(input, msg) {
    input.classList.add('error');
    const err = document.createElement('span');
    err.className = 'calc-error-msg';
    err.textContent = msg;
    input.parentElement.appendChild(err);
}

function handlePhotoUpload(input) {
    const files = Array.from(input.files);
    files.forEach(file => {
        if (calcPhotos.length >= 5) return;
        calcPhotos.push(file);
    });
    renderPreviews();
    // reset input so same file can be selected again
    input.value = '';
}

function renderPreviews() {
    const container = document.getElementById('uploadPreviews');
    const inner     = document.getElementById('uploadInner');
    container.innerHTML = '';

    if (calcPhotos.length === 0) {
        inner.style.display = '';
        return;
    }

    inner.style.display = 'none';

    calcPhotos.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const item = document.createElement('div');
            item.className = 'upload-preview-item';
            item.innerHTML = `
                <img src="${e.target.result}" alt="фото ${index+1}">
                <button class="remove-photo" onclick="removePhoto(${index})">✕</button>
            `;
            container.appendChild(item);
        };
        reader.readAsDataURL(file);
    });
}

function removePhoto(index) {
    calcPhotos.splice(index, 1);
    renderPreviews();
}

function buildSummary() {
    const summary = document.getElementById('calcSummary');
    const contacts = [
        document.getElementById('cViber').checked  ? 'Viber'    : null,
        document.getElementById('cTelegram').checked ? 'Telegram' : null,
        document.getElementById('cCall').checked   ? 'Дзвінок'  : null,
    ].filter(Boolean).join(', ') || '—';

    const rows = [
        ['Авто',       `${document.getElementById('cMake').value} ${document.getElementById('cModel').value}`],
        ['Тип кузова', document.getElementById('cBody').value || '—'],
        ['Рік',        document.getElementById('cYear').value],
        ['VIN',        document.getElementById('cVin').value || '—'],
        ['Ім\'я',      document.getElementById('cName').value],
        ['Телефон',    document.getElementById('cPhone').value],
        ['Зв\'язок',   contacts],
    ];

    summary.innerHTML = rows.map(([k, v]) =>
        `<div class="summary-row"><span>${k}</span><span>${v}</span></div>`
    ).join('');
    summary.classList.add('visible');
}

async function submitCalc() {
    if (!calcValidatePage(2)) return;
    buildSummary();
    const btn = document.getElementById('submitBtn');
    btn.classList.add('loading');
    btn.innerHTML = 'Відправка...';

    const contacts = [
        document.getElementById('cViber').checked    ? 'Viber'    : null,
        document.getElementById('cTelegram').checked  ? 'Telegram' : null,
        document.getElementById('cCall').checked      ? 'Дзвінок'  : null,
    ].filter(Boolean).join(', ') || '—';

    try {
        // 1. Відправляємо текстові дані через Worker
        const orderRes = await fetch(`${WORKER_URL}/send-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name:       document.getElementById('cName').value,
                phone:      document.getElementById('cPhone').value,
                contacts,
                make:       document.getElementById('cMake').value,
                model:      document.getElementById('cModel').value,
                bodyType:   document.getElementById('cBody').value,
                year:       document.getElementById('cYear').value,
                vin:        document.getElementById('cVin').value,
                photoCount: calcPhotos.length,
            })
        });

        if (!orderRes.ok) throw new Error('Worker error: ' + await orderRes.text());

        // 2. Відправляємо фото по одному через Worker
        for (let i = 0; i < calcPhotos.length; i++) {
            const fd = new FormData();
            fd.append('photo', calcPhotos[i]);
            fd.append('caption', i === 0 ? `📷 Фото до заявки` : '');
            await fetch(`${WORKER_URL}/send-photo`, { method: 'POST', body: fd });
        }

        // 3. Показуємо успіх
        document.querySelectorAll('.calc-page').forEach(p => p.classList.remove('active'));
        document.querySelector('.calc-page[data-page="3"]').classList.add('active');
        document.querySelector('.calc-steps').style.display = 'none';

    } catch (err) {
        console.error('Worker/Telegram error:', err);
        btn.classList.remove('loading');
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/></svg> Надіслати заявку`;
        alert('Помилка відправки. Зателефонуйте нам напряму: 380668187645');
    }
}

function calcReset() {
    // Reset all fields
    ['cName','cPhone','cMake','cModel','cBody','cYear','cVin'].forEach(id => {
        document.getElementById(id).value = '';
    });
    ['cViber','cTelegram','cCall'].forEach(id => {
        document.getElementById(id).checked = false;
    });
    calcPhotos = [];
    renderPreviews();
    document.getElementById('uploadInner').style.display = '';
    document.getElementById('calcSummary').classList.remove('visible');

    // Reset steps
    document.querySelectorAll('.calc-page').forEach(p => p.classList.remove('active'));
    document.querySelector('.calc-page[data-page="1"]').classList.add('active');
    document.querySelector('.calc-steps').style.display = '';
    updateSteps(1);

    // Reset button
    const btn = document.getElementById('submitBtn');
    if (btn) {
        btn.classList.remove('loading');
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/></svg> Надіслати заявку`;
    }
}

// Drag & drop for upload zone
document.addEventListener('DOMContentLoaded', function() {
    const zone = document.getElementById('uploadZone');
    if (!zone) return;

    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.style.borderColor = 'var(--yellow)';
    });

    zone.addEventListener('dragleave', () => {
        zone.style.borderColor = '';
    });

    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.style.borderColor = '';
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        files.forEach(file => {
            if (calcPhotos.length < 5) calcPhotos.push(file);
        });
        renderPreviews();
    });
});
