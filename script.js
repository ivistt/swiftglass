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

// ========== AUTOCOMPLETE (NHTSA API) ==========

const nhtsaCache = {
    makes: null,         // масив всіх марок після першого завантаження
    models: {}           // { 'Toyota': [...], 'BMW': [...] }
};

// Завантажуємо всі марки один раз при фокусі на полі
async function loadAllMakes() {
    if (nhtsaCache.makes) return nhtsaCache.makes;
    try {
        const res  = await fetch('https://vpic.nhtsa.dot.gov/api/vehicles/GetAllMakes?format=json');
        const data = await res.json();
        nhtsaCache.makes = data.Results.map(r => r.Make_Name).sort();
        return nhtsaCache.makes;
    } catch {
        return [];
    }
}

// Завантажуємо моделі для конкретної марки
async function loadModels(make) {
    const key = make.toLowerCase();
    if (nhtsaCache.models[key]) return nhtsaCache.models[key];
    try {
        const res  = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/${encodeURIComponent(make)}?format=json`);
        const data = await res.json();
        nhtsaCache.models[key] = data.Results.map(r => r.Model_Name).sort();
        return nhtsaCache.models[key];
    } catch {
        return [];
    }
}

// Фільтрація: шукаємо з початку рядка (startsWith), потім підрядок
function filterList(list, query) {
    if (!query) return list.slice(0, 80); // максимум 80 без фільтра
    const q = query.toLowerCase();
    const starts = list.filter(i => i.toLowerCase().startsWith(q));
    const contains = list.filter(i => !i.toLowerCase().startsWith(q) && i.toLowerCase().includes(q));
    return [...starts, ...contains].slice(0, 60);
}

// ── Ініціалізація autocomplete на input ──────────────────────
function initAutocomplete(inputId, getItems, onSelect) {
    const input = document.getElementById(inputId);
    if (!input) return;

    // Обгортаємо в relative контейнер
    const wrapper = input.parentElement;
    wrapper.style.position = 'relative';

    // Дропдаун
    const dropdown = document.createElement('ul');
    dropdown.className = 'ac-dropdown';
    dropdown.setAttribute('role', 'listbox');
    wrapper.appendChild(dropdown);

    let activeIdx = -1;
    let isOpen    = false;
    let allItems  = [];

    function openDropdown(items) {
        allItems = items;
        renderDropdown(filterList(items, input.value));
    }

    function renderDropdown(items) {
        activeIdx = -1;
        dropdown.innerHTML = '';
        if (items.length === 0) {
            dropdown.innerHTML = '<li class="ac-empty">Нічого не знайдено</li>';
        } else {
            items.forEach((item, i) => {
                const li = document.createElement('li');
                li.className = 'ac-item';
                li.setAttribute('role', 'option');
                li.setAttribute('data-idx', i);
                // Підсвічуємо збіг
                const q = input.value.toLowerCase();
                if (q && item.toLowerCase().startsWith(q)) {
                    li.innerHTML = `<b>${item.slice(0, q.length)}</b>${item.slice(q.length)}`;
                } else {
                    li.textContent = item;
                }
                li.addEventListener('mousedown', (e) => {
                    e.preventDefault(); // не знімаємо фокус з input
                    selectItem(item);
                });
                dropdown.appendChild(li);
            });
        }
        dropdown.classList.add('open');
        isOpen = true;
    }

    function selectItem(value) {
        input.value = value;
        closeDropdown();
        if (onSelect) onSelect(value);
    }

    function closeDropdown() {
        dropdown.classList.remove('open');
        dropdown.innerHTML = '';
        isOpen  = false;
        activeIdx = -1;
    }

    function highlightItem(idx) {
        const items = dropdown.querySelectorAll('.ac-item');
        items.forEach(li => li.classList.remove('ac-active'));
        if (items[idx]) {
            items[idx].classList.add('ac-active');
            items[idx].scrollIntoView({ block: 'nearest' });
        }
    }

    // ── Events ──
    input.addEventListener('focus', async () => {
        const items = await getItems(input.value);
        allItems = items;
        renderDropdown(filterList(items, input.value));
    });

    input.addEventListener('input', () => {
        if (!isOpen && allItems.length) {
            dropdown.classList.add('open');
            isOpen = true;
        }
        renderDropdown(filterList(allItems, input.value));
    });

    input.addEventListener('keydown', (e) => {
        const items = dropdown.querySelectorAll('.ac-item');
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIdx = Math.min(activeIdx + 1, items.length - 1);
            highlightItem(activeIdx);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIdx = Math.max(activeIdx - 1, 0);
            highlightItem(activeIdx);
        } else if (e.key === 'Enter' && activeIdx >= 0) {
            e.preventDefault();
            const active = dropdown.querySelector('.ac-active');
            if (active) selectItem(active.textContent);
        } else if (e.key === 'Escape') {
            closeDropdown();
        }
    });

    input.addEventListener('blur', () => {
        // Невеликий таймаут щоб mousedown встиг спрацювати
        setTimeout(closeDropdown, 150);
    });
}

// ── Типи кузова (фіксований список) ─────────────────────────
const BODY_TYPES = [
    'Седан', 'Хетчбек', 'Універсал', 'Позашляховик / SUV',
    'Кросовер', 'Купе', 'Кабріолет', 'Мінівен',
    'Пікап', 'Фургон', 'Мікроавтобус', 'Лімузин'
];

// Маппінг сирих значень NHTSA → наш список
const BODY_TYPE_MAP = {
    'sedan':        'Седан',
    'hatchback':    'Хетчбек',
    'wagon':        'Універсал',
    'station wagon':'Універсал',
    'suv':          'Позашляховик / SUV',
    'sport utility':'Позашляховик / SUV',
    'multipurpose': 'Позашляховик / SUV',
    'crossover':    'Кросовер',
    'coupe':        'Купе',
    'convertible':  'Кабріолет',
    'cabriolet':    'Кабріолет',
    'minivan':      'Мінівен',
    'van':          'Мінівен',
    'pickup':       'Пікап',
    'truck':        'Пікап',
    'cargo':        'Фургон',
    'bus':          'Мікроавтобус',
    'limousine':    'Лімузин',
    'passenger car':'Седан',
};

// Декодування року з 10-ї позиції VIN (стандарт ISO 3779)
function decodeYearFromVin(char) {
    const map = {
        'A':1980,'B':1981,'C':1982,'D':1983,'E':1984,'F':1985,'G':1986,'H':1987,
        'J':1988,'K':1989,'L':1990,'M':1991,'N':1992,'P':1993,'R':1994,'S':1995,
        'T':1996,'V':1997,'W':1998,'X':1999,'Y':2000,
        '1':2001,'2':2002,'3':2003,'4':2004,'5':2005,'6':2006,'7':2007,'8':2008,'9':2009,
        'A':2010,'B':2011,'C':2012,'D':2013,'E':2014,'F':2015,'G':2016,'H':2017,
        'J':2018,'K':2019,'L':2020,'M':2021,'N':2022,'P':2023,'R':2024,'S':2025,'T':2026,
    };
    // Цикл повторюється, тому беремо останнє значення (після 2000 пріоритет)
    const map2 = {
        'A':2010,'B':2011,'C':2012,'D':2013,'E':2014,'F':2015,'G':2016,'H':2017,
        'J':2018,'K':2019,'L':2020,'M':2021,'N':2022,'P':2023,'R':2024,'S':2025,'T':2026,
        '1':2001,'2':2002,'3':2003,'4':2004,'5':2005,'6':2006,'7':2007,'8':2008,'9':2009,
        'Y':2000,
    };
    const year = map2[char.toUpperCase()];
    return year ? String(year) : '';
}

function mapBodyType(raw) {
    if (!raw) return '';
    const lower = raw.toLowerCase();
    for (const [key, val] of Object.entries(BODY_TYPE_MAP)) {
        if (lower.includes(key)) return val;
    }
    return '';
}

// ── VIN декодер ──────────────────────────────────────────────
let vinDecodeTimer = null;

function initVinDecoder() {
    const vinInput = document.getElementById('cVin');
    if (!vinInput) return;

    vinInput.addEventListener('input', () => {
        const vin = vinInput.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        vinInput.value = vin;

        clearTimeout(vinDecodeTimer);
        clearVinStatus();

        if (vin.length === 17) {
            setVinStatus('loading');
            vinDecodeTimer = setTimeout(() => decodeVin(vin), 500);
        }
    });
}

async function decodeVin(vin) {
    try {
        const res  = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`);
        const data = await res.json();

        if (!data.Results) { setVinStatus('error'); return; }

        // Логуємо для відлагодження — можна прибрати після перевірки
        console.log('NHTSA VIN results:', data.Results.filter(r => r.Value && r.Value !== 'Not Applicable' && r.Value !== 'null' && r.Value !== null && r.Value !== '0'));

        const get = (varName, varId) => {
            // Спочатку шукаємо по назві
            let r = data.Results.find(r => r.Variable === varName);
            // Якщо не знайшли або значення порожнє — шукаємо по VariableId
            if ((!r || !r.Value || r.Value === 'Not Applicable' || r.Value === 'null' || r.Value === null || r.Value === '0') && varId) {
                r = data.Results.find(r => r.VariableId === varId);
            }
            return (r && r.Value && r.Value !== 'Not Applicable' && r.Value !== 'null' && r.Value !== null && r.Value !== '0')
                ? r.Value.trim() : '';
        };

        const make       = get('Make', 26);
        const model      = get('Model', 28);
        let   year       = get('Model Year', 29);
        const bodyRaw    = get('Body Class', 5) || get('Vehicle Type', 39);
        const bodyMapped = mapBodyType(bodyRaw);

        // Фоллбек: якщо NHTSA не повернув рік — декодуємо з 10-ї позиції VIN
        if (!year && vin.length === 17) {
            year = decodeYearFromVin(vin[9]);
        }

        const filled = [];

        if (make)       { setFieldAutofilled('cMake',  make);        filled.push('марку'); }
        if (model)      { setFieldAutofilled('cModel', model);       filled.push('модель'); }
        if (year)       { setFieldAutofilled('cYear',  year);        filled.push('рік'); }
        if (bodyMapped) { setFieldAutofilled('cBody',  bodyMapped);  filled.push('кузов'); }

        if (filled.length > 0) {
            setVinStatus('success', `Визначено: ${filled.join(', ')}`);
        } else {
            setVinStatus('error', 'Дані не знайдено — заповніть вручну');
        }

    } catch (err) {
        console.error('VIN decode error:', err);
        setVinStatus('error', 'Помилка запиту');
    }
}

function setFieldAutofilled(id, value) {
    const input = document.getElementById(id);
    if (!input) return;
    input.value = value;
    input.classList.add('autofilled');
    // Знімаємо підсвітку через 3с
    setTimeout(() => input.classList.remove('autofilled'), 3000);
}

function setVinStatus(type, msg) {
    let el = document.getElementById('vinStatus');
    if (!el) {
        el = document.createElement('div');
        el.id = 'vinStatus';
        el.className = 'vin-status';
        const vinInput = document.getElementById('cVin');
        if (vinInput) vinInput.parentElement.appendChild(el);
    }

    el.className = 'vin-status';
    if (type === 'loading') {
        el.classList.add('vin-loading');
        el.innerHTML = '<span class="vin-spinner"></span> Декодуємо VIN...';
    } else if (type === 'success') {
        el.classList.add('vin-ok');
        el.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> ${msg}`;
    } else if (type === 'error') {
        el.classList.add('vin-err');
        el.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> ${msg || 'Не вдалося декодувати'}`;
    }
}

function clearVinStatus() {
    const el = document.getElementById('vinStatus');
    if (el) el.remove();
    // Знімаємо autofilled з усіх полів якщо юзер змінює VIN
    ['cMake','cModel','cYear','cBody'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('autofilled');
    });
}

// ── Ініціалізуємо після DOMContentLoaded ────────────────────
document.addEventListener('DOMContentLoaded', function() {
    // Марка — завантажуємо всі марки
    initAutocomplete(
        'cMake',
        async () => loadAllMakes(),
        (selectedMake) => {
            // Скидаємо модель при зміні марки
            const modelInput = document.getElementById('cModel');
            if (modelInput) modelInput.value = '';
        }
    );

    // Модель — завантажуємо моделі для поточної марки
    initAutocomplete(
        'cModel',
        async () => {
            const make = document.getElementById('cMake').value.trim();
            if (!make) return [];
            return loadModels(make);
        },
        null
    );

    // Тип кузова — фіксований список
    initAutocomplete(
        'cBody',
        async () => BODY_TYPES,
        null
    );

    // VIN декодер
    initVinDecoder();
});

function calcNext(currentPage) {
    if (!calcValidatePage(currentPage)) return;

    if (currentPage === 2) {
        buildSummary();
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

    if (page === 2) {
        const make  = document.getElementById('cMake');
        const model = document.getElementById('cModel');
        const year  = document.getElementById('cYear');

        if (!make.value.trim()) { showFieldError(make, 'Введіть марку авто'); valid = false; }
        if (!model.value.trim()) { showFieldError(model, 'Введіть модель авто'); valid = false; }
        if (!year.value.trim()) { showFieldError(year, 'Введіть рік'); valid = false; }
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
        ['Ім\'я',      document.getElementById('cName').value],
        ['Телефон',    document.getElementById('cPhone').value],
        ['Зв\'язок',   contacts],
        ['Авто',       `${document.getElementById('cMake').value} ${document.getElementById('cModel').value}`],
        ['Тип кузова', document.getElementById('cBody').value || '—'],
        ['Рік',        document.getElementById('cYear').value],
        ['VIN',        document.getElementById('cVin').value || '—'],
    ];

    summary.innerHTML = rows.map(([k, v]) =>
        `<div class="summary-row"><span>${k}</span><span>${v}</span></div>`
    ).join('');
    summary.classList.add('visible');
}

async function submitCalc() {
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
        document.querySelector('.calc-page[data-page="4"]').classList.add('active');
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
