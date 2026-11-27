/* === SLIDE PRESENTATION CONTROLLER ====================================
   Fixed 1920×1080 stage, scaled uniformly to viewport.
   Navigation: keyboard arrows/space, touch swipe, mouse wheel.
   Hash persistence: #1, #2, … deep-links and back/forward work.
   ===================================================================== */
class SlidePresentation {
    constructor(startIdx = 0) {
        this.slides  = Array.from(document.querySelectorAll('.slide'));
        this.total   = this.slides.length;
        this.current = 0;
        this.stage   = document.getElementById('deckStage');
        this.bar     = document.getElementById('progressBar');

        this.setupScale();
        this.setupKeyboard();
        this.setupTouch();
        this.setupWheel();
        this.show(startIdx, false);
    }

    setupScale() {
        const scale = () => {
            const f = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
            const x = (window.innerWidth  - 1920 * f) / 2;
            const y = (window.innerHeight - 1080 * f) / 2;
            this.stage.style.transform = `translate(${x}px,${y}px) scale(${f})`;
        };
        scale();
        window.addEventListener('resize', scale);
    }

    setupKeyboard() {
        document.addEventListener('keydown', e => {
            if (e.target.getAttribute('contenteditable')) return;
            if (['ArrowRight','ArrowDown',' ','PageDown'].includes(e.key)) { e.preventDefault(); this.next(); }
            if (['ArrowLeft','ArrowUp','PageUp'].includes(e.key))          { e.preventDefault(); this.prev(); }
            if (e.key === 'Home') this.show(0);
            if (e.key === 'End')  this.show(this.total - 1);
        });
    }

    setupTouch() {
        let sx = 0, sy = 0;
        document.addEventListener('touchstart', e => {
            sx = e.touches[0].clientX;
            sy = e.touches[0].clientY;
        }, {passive: true});
        document.addEventListener('touchend', e => {
            const dx = e.changedTouches[0].clientX - sx;
            const dy = e.changedTouches[0].clientY - sy;
            if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50)
                dx < 0 ? this.next() : this.prev();
        });
    }

    setupWheel() {
        let last = 0;
        document.addEventListener('wheel', e => {
            const now = Date.now();
            if (now - last < 650) return;
            last = now;
            e.deltaY > 0 ? this.next() : this.prev();
        }, {passive: true});
    }

    next() { this.show(this.current + 1); }
    prev() { this.show(this.current - 1); }

    show(idx, push = true) {
        this.current = Math.max(0, Math.min(idx, this.total - 1));
        this.slides.forEach((s, i) => {
            const on = i === this.current;
            s.classList.toggle('active',  on);
            s.classList.toggle('visible', on);
        });
        this.bar.style.width = ((this.current + 1) / this.total * 100) + '%';
        const url = '#' + (this.current + 1);
        if (push) history.pushState({slide: this.current + 1}, '', url);
        else      history.replaceState({slide: this.current + 1}, '', url);
    }
}

const initialHash = parseInt(location.hash.slice(1));
const deck = new SlidePresentation(initialHash >= 1 ? initialHash - 1 : 0);

window.addEventListener('popstate', e => {
    const slide = e.state?.slide ?? parseInt(location.hash.slice(1));
    if (slide >= 1) deck.show(slide - 1, false);
});

/* === SNOWFALL ==========================================================
   Gentle snow drift behind the slides — Sapporo, winter.
   Respects prefers-reduced-motion: static dots, no animation loop.
   ===================================================================== */
(function snowfall() {
    const canvas = document.getElementById('snowCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = 1920, H = 1080;
    canvas.width = W; canvas.height = H;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const FLAKES = [];
    const COUNT = 60;

    for (let i = 0; i < COUNT; i++) {
        const size = 7 + Math.random() * 11;           // font size in px
        FLAKES.push({
            x: Math.random() * W,
            y: Math.random() * H,
            size,
            v: size * 0.012 + 0.2,                     // bigger flakes fall faster
            drift: (Math.random() - 0.5) * 0.4,        // horizontal sway
            phase: Math.random() * Math.PI * 2,
            o: 0.25 + Math.random() * 0.45             // opacity
        });
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);
        ctx.font = '16px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const f of FLAKES) {
            ctx.font = `${f.size}px system-ui`;
            ctx.globalAlpha = f.o;
            ctx.fillText('❄️', f.x, f.y);
        }
        ctx.globalAlpha = 1;
    }

    if (reduced) { draw(); return; }

    let t = 0;
    function tick() {
        t += 0.01;
        ctx.clearRect(0, 0, W, H);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const f of FLAKES) {
            f.y += f.v;
            f.x += f.drift + Math.sin(t + f.phase) * 0.18;
            if (f.y > H + 20) { f.y = -20; f.x = Math.random() * W; }
            if (f.x > W + 20) f.x = -20;
            if (f.x < -20)    f.x = W + 20;
            ctx.font = `${f.size}px system-ui`;
            ctx.globalAlpha = f.o;
            ctx.fillText('❄️', f.x, f.y);
        }
        ctx.globalAlpha = 1;
        requestAnimationFrame(tick);
    }
    tick();
})();

/* === INLINE EDITOR =====================================================
   Hover top-left corner or press E to reveal edit toggle.
   Click any text to edit; Ctrl+S to save to localStorage.
   ===================================================================== */
const editor = {
    isActive: false,
    toggleEditMode() {
        this.isActive = !this.isActive;
        const toggle = document.getElementById('editToggle');
        toggle.classList.toggle('active', this.isActive);
        toggle.textContent = this.isActive ? '✓' : '✏';
        document.querySelectorAll('h1, h2, p, li, td, th, span, small, div').forEach(el => {
            if (el.children.length === 0 || el.matches('p, li, h1, h2'))
                el.contentEditable = this.isActive ? 'true' : 'false';
        });
        if (!this.isActive) this.save();
    },
    save() {
        localStorage.setItem('talk-deck-html', document.getElementById('deckStage').innerHTML);
    },
    load() {
        const saved = localStorage.getItem('talk-deck-html');
        if (saved) document.getElementById('deckStage').innerHTML = saved;
    }
};

// Hotzone hover reveal with 400ms grace period
const hotzone    = document.getElementById('editHotzone');
const editToggle = document.getElementById('editToggle');
let hideTimeout  = null;

hotzone.addEventListener('mouseenter', () => {
    clearTimeout(hideTimeout);
    editToggle.classList.add('show');
});
hotzone.addEventListener('mouseleave', () => {
    hideTimeout = setTimeout(() => { if (!editor.isActive) editToggle.classList.remove('show'); }, 400);
});
editToggle.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
editToggle.addEventListener('mouseleave', () => {
    hideTimeout = setTimeout(() => { if (!editor.isActive) editToggle.classList.remove('show'); }, 400);
});
editToggle.addEventListener('click', () => editor.toggleEditMode());
hotzone.addEventListener('click',    () => editor.toggleEditMode());

document.addEventListener('keydown', e => {
    if ((e.key === 'e' || e.key === 'E') && !e.target.getAttribute('contenteditable'))
        editor.toggleEditMode();
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); editor.save(); }
});
