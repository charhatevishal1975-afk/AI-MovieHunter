// ==========================================
// 1. BASIC CONFIGURATION
// ==========================================
const GEMINI_MODEL = 'gemma-3-27b-it';

let watchlist = [];
let currentModalmovie = null;

// Simple in-memory cache (big speed boost)
const movieCache = new Map();

// ==========================================
// 2. GALAXY BACKGROUND (UNCHANGED)
// ==========================================
function initGalaxy() {
    const canvas = document.getElementById('galaxy-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = 0, height = 0;

    const stars = [];
    const mousePos = { x: 0, y: 0 };

    const STAR_COUNT = 1000;

    const STAR_COLORS = [
        '#9bb0ff', '#aabfff', '#cad7ff',
        '#f8f7ff', '#fff4ea', '#ffd2a1', '#ffcc6f'
    ];

    function resizeCanvas() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    window.addEventListener('mousemove', (e) => {
        mousePos.x = e.clientX;
        mousePos.y = e.clientY;
    });

    for (let i = 0; i < STAR_COUNT; i++) {
        stars.push({
            x: Math.random() * width,
            y: Math.random() * height,
            r: Math.random() * 2,
            color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
            vx: (Math.random() - 0.5) * 0.8,
            vy: (Math.random() - 0.5) * 0.8,
            alpha: Math.random(),
            alphaStep: (Math.random() * 0.02) + 0.005
        });
    }

    function draw() {
        ctx.clearRect(0, 0, width, height);

        stars.forEach(star => {
            star.x += star.vx;
            star.y += star.vy;

            const dx = mousePos.x - star.x;
            const dy = mousePos.y - star.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 75 && dist !== 0) {
                const force = (75 - dist) / 75;
                star.x -= (dx / dist) * force * 5;
                star.y -= (dy / dist) * force * 5;
            }

            star.alpha += star.alphaStep;
            if (star.alpha > 1 || star.alpha < 0.2) {
                star.alphaStep *= -1;
            }

            if (star.x < 0) star.x = width;
            if (star.x > width) star.x = 0;
            if (star.y < 0) star.y = height;
            if (star.y > height) star.y = 0;

            ctx.globalAlpha = Math.abs(star.alpha);
            ctx.fillStyle = star.color;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
            ctx.fill();
        });

        requestAnimationFrame(draw);
    }

    draw();
}

initGalaxy();

// ==========================================
// 3. DOM HOOKS
// ==========================================
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultsArea = document.getElementById('movieContainer');
const resultsTitle = document.getElementById('resultsTitle');
const badgeSpinner = document.getElementById('badgeSpinner');
const watchlistCount = document.getElementById('watchlistCount');
const watchlistItems = document.getElementById('watchlistItems');

const optimizeBtn = document.getElementById('optimizeBtn');
const optimizerResult = document.getElementById('optimizerResult');
const addToWatchlistBtn = document.getElementById('addToWatchlistBtn');

const movieModalElement = document.getElementById('movieModal');
const movieModal = new bootstrap.Modal(movieModalElement);

// ==========================================
// 4. SEARCH FLOW (debounced + faster)
// ==========================================
let debounceTimer;

searchBtn.addEventListener('click', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runSearch, 200);
});

async function runSearch() {
    const userQuery = searchInput.value.trim();
    if (!userQuery) {
        alert('Please enter something');
        return;
    }

    resultsArea.innerHTML = '';
    resultsTitle.classList.remove('d-none');
    badgeSpinner.classList.remove('d-none');
    searchBtn.disabled = true;

    const looksLikeMood =
        userQuery.toLowerCase().includes('feel') ||
        userQuery.split(' ').length > 3;

    if (looksLikeMood) {
        await searchByMood(userQuery);
    } else {
        await searchWithAIHelp(userQuery);
    }

    badgeSpinner.classList.add('d-none');
    searchBtn.disabled = false;
}

searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        searchBtn.click();
    }
});

// ==========================================
// 5. GEMINI (PROXY)
// ==========================================
async function callGemini(promptText) {
    try {
        const res = await fetch("/api/gemini", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ prompt: promptText })
        });

        const json = await res.json();
        return json?.result || null;

    } catch (err) {
        console.error("Gemini error:", err);
        return null;
    }
}

// ==========================================
// 6. NON-MOOD SEARCH (UNCHANGED PROMPT)
// ==========================================
async function searchWithAIHelp(inputText) {
    const prompt = `
    User input: "${inputText}"
    Fix spelling, detect intent (actor / movie / genre).
    Return EXACTLY 10 popular IMDb movie titles.
    Separate with "|". No years. No explanation.
    `;

    const raw = await callGemini(prompt);
    if (!raw) {
        resultsArea.innerHTML = '<p class="text-danger">AI unavailable.</p>';
        return;
    }

    const titles = raw.split('|').map(t => t.trim());
    await fetchAndSortMovies(titles);
}

// ==========================================
// 7. MOOD SEARCH (UNCHANGED PROMPT)
// ==========================================
async function searchByMood(moodText) {
    const prompt = `
    User mood: "${moodText}"
    Recommend 10 popular movies matching this mood.
    Use exact IMDb titles.
    Separate with "|". No explanation.
    `;

    const raw = await callGemini(prompt);
    if (!raw) return;

    const titles = raw.split('|').map(t => t.trim());
    await fetchAndSortMovies(titles);
}

// ==========================================
// 8. OMDB (CACHED + PARALLEL)
// ==========================================
async function fetchMovieByTitle(title) {
    if (movieCache.has(title)) return movieCache.get(title);

    const res = await fetch(`/api/omdb?title=${encodeURIComponent(title)}`);
    const data = await res.json();

    movieCache.set(title, data);
    return data;
}

async function fetchAndSortMovies(titles) {
    const movies = await Promise.all(titles.map(fetchMovieByTitle));

    const validMovies = movies
        .filter(m => m.Response === 'True' && m.Poster !== 'N/A')
        .sort((a, b) => parseFloat(b.imdbRating) - parseFloat(a.imdbRating))
        .slice(0, 10);

    displayMovies(validMovies);
}

// ==========================================
// 9. MOVIE GRID (minor DOM optimization)
// ==========================================
function displayMovies(movies) {
    resultsArea.innerHTML = '';
    resultsArea.className = 'chroma-grid';

    const fragment = document.createDocumentFragment();

    movies.forEach(movie => {
        const card = document.createElement('div');
        card.className = 'chroma-card';

        card.onclick = () => showMovieDetails(movie.imdbID);

        card.innerHTML = `
            <div class="chroma-inner">
                <div class="chroma-img-wrapper">
                    <img src="${movie.Poster}" loading="lazy">
                </div>
                <div class="chroma-info">
                    <h3 class="name">${movie.Title}</h3>
                    <p class="small text-secondary">
                        ${movie.Year} • ★ ${movie.imdbRating}
                    </p>
                </div>
            </div>
        `;

        fragment.appendChild(card);
    });

    resultsArea.appendChild(fragment);
}

// ==========================================
// 10. MODAL (uses proxy now)
// ==========================================
async function showMovieDetails(imdbID) {
    const res = await fetch(`/api/omdb?id=${imdbID}`);
    const movie = await res.json();

    currentModalmovie = movie;

    document.getElementById('modalTitle').innerText = movie.Title;
    document.getElementById('modalPoster').src = movie.Poster;
    document.getElementById('modalYear').innerText = movie.Year;
    document.getElementById('modalRating').innerText = `★ ${movie.imdbRating}`;
    document.getElementById('modalRuntime').innerText = movie.Runtime;
    document.getElementById('modalGenre').innerText = movie.Genre;
    document.getElementById('modalPlot').innerText = movie.Plot;
    document.getElementById('modalCast').innerText = movie.Actors;

    const alreadyAdded = watchlist.some(m => m.imdbID === movie.imdbID);

    addToWatchlistBtn.innerText =
        alreadyAdded ? '✅ Added' : '+ Add to Watchlist';
    addToWatchlistBtn.disabled = alreadyAdded;

    fetchSimilarMovies(movie.Genre.split(',')[0]);

    movieModal.show();
}

// ==========================================
// 11. SIMILAR MOVIES (parallel fetch fix)
// ==========================================
async function fetchSimilarMovies(genre) {
    const container = document.getElementById('similarMoviesContainer');
    container.innerHTML = '<p class="text-secondary">Loading…</p>';

    const res = await fetch(`/api/omdb?search=${genre}`);
    const data = await res.json();

    container.innerHTML = '';

    if (!data.Search) return;

    const items = data.Search.slice(0, 3).filter(i => i.Poster !== 'N/A');

    const details = await Promise.all(
        items.map(i => fetch(`/api/omdb?id=${i.imdbID}`).then(r => r.json()))
    );

    items.forEach((item, index) => {
        const detail = details[index];

        const div = document.createElement('div');
        div.className = 'col-md-4';

        div.innerHTML = `
            <div class="suggestion-card d-flex"
                 onclick="showMovieDetails('${item.imdbID}')">
                <img src="${item.Poster}" class="suggestion-img">
                <div class="suggestion-body">
                    <div class="fw-bold text-truncate">${item.Title}</div>
                    <div class="small text-warning">★ ${detail.imdbRating}</div>
                    <div class="small text-secondary">${detail.Year}</div>
                </div>
            </div>
        `;

        container.appendChild(div);
    });
}

// ==========================================
// 12. WATCHLIST (UNCHANGED)
// ==========================================
addToWatchlistBtn.addEventListener('click', () => {
    if (!currentModalmovie) return;

    if (watchlist.some(m => m.imdbID === currentModalmovie.imdbID)) return;

    watchlist.push(currentModalmovie);
    updateWatchlistUI();

    addToWatchlistBtn.innerText = '✅ Added';
    addToWatchlistBtn.disabled = true;
});

document.getElementById('clearWatchlistBtn')
.addEventListener('click', () => {
    watchlist = [];
    updateWatchlistUI();
    optimizerResult.classList.add('d-none');
});

function updateWatchlistUI() {
    watchlistCount.innerText = watchlist.length;
    watchlistItems.innerHTML = '';

    watchlist.forEach(movie => {
        const li = document.createElement('li');
        li.className =
            'list-group-item bg-black text-white border-secondary d-flex justify-content-between';

        li.innerHTML =
            `<span>${movie.Title}</span><span>${movie.Runtime}</span>`;

        watchlistItems.appendChild(li);
    });
}

// ==========================================
// 13. OPTIMIZER (UNCHANGED)
// ==========================================
optimizeBtn.addEventListener('click', () => {
    const hours =
        parseFloat(document.getElementById('userHoursInput').value);

    if (isNaN(hours) || hours <= 0) {
        alert('Enter valid hours');
        return;
    }

    const availableMinutes = hours * 60;

    let totalMinutes = watchlist.reduce((sum, m) => {
        const runtime =
            parseInt(m.Runtime.replace(/\D/g, ''), 10) || 0;
        return sum + runtime;
    }, 0);

    optimizerResult.classList.remove('d-none');

    if (totalMinutes <= availableMinutes) {
        optimizerResult.className = 'alert alert-success';
        optimizerResult.innerHTML =
            `Fits perfectly (${totalMinutes}m / ${availableMinutes}m)`;
        return;
    }

    const sortedByRating =
        [...watchlist].sort(
            (a, b) => (a.imdbRating || 0) - (b.imdbRating || 0)
        );

    let remaining = totalMinutes;
    const dropped = [];

    for (const movie of sortedByRating) {
        if (remaining <= availableMinutes) break;

        const mins =
            parseInt(movie.Runtime.replace(/\D/g, ''), 10) || 0;
        remaining -= mins;
        dropped.push(movie);
    }

    optimizerResult.className = 'alert alert-warning';
    optimizerResult.innerHTML = `
        Drop ${dropped.length} lowest rated movie(s):
        <ul>${dropped.map(m => `<li>${m.Title}</li>`).join('')}</ul>
    `;
});// redeploy trigger
