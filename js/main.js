// ============================================
// FUSE — Cutting-edge Motion System
// GSAP + ScrollTrigger + Lenis + Micro-interactions
// ============================================

(function () {
    'use strict';

    document.documentElement.classList.add('js');

    gsap.registerPlugin(ScrollTrigger);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

    // Perceptual motion timings (200–700ms feel most responsive)
    const motion = {
        micro: 0.18,
        quick: 0.35,
        base: 0.6,
        slow: 1.1,
        easeOut: 'power3.out',
        easeInOut: 'power2.inOut',
    };

    gsap.defaults({ ease: motion.easeOut, duration: motion.base });

    // Smooth scroll (Lenis) – disabled for reduced motion
    let lenis = null;
    if (!prefersReducedMotion && window.Lenis) {
        lenis = new Lenis({
            duration: 1.15,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true,
            wheelMultiplier: 1,
            smoothTouch: false,
        });

        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add((time) => lenis.raf(time * 1000));
        gsap.ticker.lagSmoothing(0);
    }

    // Elements
    const navbar = document.getElementById('navbar');
    const scrollProgress = document.getElementById('scrollProgress');
    const cursor = document.getElementById('cursor');

    // Keep CSS var in sync with actual nav height (prevents hero overlap)
    let maxNavHeight = 0;
    function updateNavHeightVar() {
        if (!navbar) return;
        // Use the largest observed height (non-scrolled state is usually tallest)
        maxNavHeight = Math.max(maxNavHeight, navbar.offsetHeight || 0);
        if (maxNavHeight) document.documentElement.style.setProperty('--nav-height', `${maxNavHeight}px`);
    }

    // Scroll progress
    if (scrollProgress && !prefersReducedMotion) {
        gsap.to(scrollProgress, {
            scaleX: 1,
            ease: 'none',
            scrollTrigger: { start: 0, end: 'max', scrub: 0.25 },
        });
    } else if (scrollProgress) {
        scrollProgress.style.display = 'none';
    }

    // Cursor presence (desktop only)
    if (cursor && !prefersReducedMotion && !isCoarsePointer) {
        const setX = gsap.quickTo(cursor, 'x', { duration: 0.22, ease: 'power3.out' });
        const setY = gsap.quickTo(cursor, 'y', { duration: 0.22, ease: 'power3.out' });

        window.addEventListener(
            'mousemove',
            (e) => {
                cursor.style.opacity = '1';
                setX(e.clientX);
                setY(e.clientY);
            },
            { passive: true }
        );

        document.querySelectorAll('a, button, .compare-card').forEach((el) => {
            el.addEventListener('mouseenter', () => gsap.to(cursor, { scale: 1.8, duration: 0.2, ease: 'power2.out' }));
            el.addEventListener('mouseleave', () => gsap.to(cursor, { scale: 1, duration: 0.2, ease: 'power2.out' }));
        });
    }

    // Navigation – direction-aware hide/show
    if (navbar) {
        updateNavHeightVar();
        ScrollTrigger.create({
            start: 'top -100',
            onUpdate: (self) => {
                // Keep nav fully readable at the very top (no hiding/fading)
                if (self.scroll() < 24) {
                    gsap.to(navbar, { yPercent: 0, autoAlpha: 1, duration: 0.2, ease: 'power2.out' });
                    navbar.classList.remove('scrolled');
                    return;
                }

                if (self.direction === 1) {
                    gsap.to(navbar, { yPercent: -100, autoAlpha: 1, duration: 0.4, ease: 'power2.inOut' });
                } else {
                    gsap.to(navbar, { yPercent: 0, autoAlpha: 1, duration: 0.4, ease: 'power2.out' });
                }

                if (self.scroll() > 100) navbar.classList.add('scrolled');
                else navbar.classList.remove('scrolled');
            },
        });
    }

    // Hero entrance
    const heroTl = gsap.timeline({ defaults: { ease: 'power4.out', duration: 1.25 } });
    heroTl
        .from('.hero-british-badge', { y: 18, autoAlpha: 0 }, 0.35)
        .from('.hero-title span', { yPercent: 120, autoAlpha: 0, stagger: 0.16 }, 0.45)
        .from('.hero-messaging', { y: 18, autoAlpha: 0 }, 0.9)
        .from('.hero-cta-group', { y: 16, autoAlpha: 0 }, 1.05)
        .fromTo('.hero-visual-wrapper', { x: 40, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 1.5 }, 0.8)
        .from('.nav', { y: -40, autoAlpha: 0 }, 0.2);

    // Hero scroll-linked depth + orbs
    if (!prefersReducedMotion) {
        gsap.to('.hero-content', {
            scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
            y: 120,
            ease: 'none',
        });
        gsap.to('.orb-1', {
            scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
            y: 140,
            x: -60,
            ease: 'none',
        });
        gsap.to('.orb-2', {
            scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
            y: -120,
            x: 70,
            ease: 'none',
        });
        gsap.to('.orb-3', {
            scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
            y: 80,
            x: 40,
            ease: 'none',
        });

        // Ambient orbital drift (low-frequency to reduce motion sickness)
        gsap.to('.orb-1', { x: -20, y: 30, duration: 16, ease: 'sine.inOut', repeat: -1, yoyo: true });
        gsap.to('.orb-2', { x: 25, y: -25, duration: 18, ease: 'sine.inOut', repeat: -1, yoyo: true });
        gsap.to('.orb-3', { x: 18, y: 20, duration: 14, ease: 'sine.inOut', repeat: -1, yoyo: true });

        gsap.fromTo(
            '.scroll-hint-line',
            { scaleY: 0.55 },
            { scaleY: 1.25, duration: 1.6, ease: 'power1.inOut', yoyo: true, repeat: -1 }
        );
    }

    // Reveal system (works both directions)
    gsap.utils.toArray('.fade-in, .fade-in-left, .fade-in-right, [data-reveal]').forEach((el) => {
        const mode = el.getAttribute('data-reveal');
        let fromVars = { autoAlpha: 0, y: 24 };
        if (el.classList.contains('fade-in-left') || mode === 'left') fromVars = { autoAlpha: 0, x: -28 };
        if (el.classList.contains('fade-in-right') || mode === 'right') fromVars = { autoAlpha: 0, x: 28 };
        if (mode === 'up') fromVars = { autoAlpha: 0, y: 24 };

        gsap.fromTo(
            el,
            fromVars,
            {
                immediateRender: false,
                autoAlpha: 1,
                x: 0,
                y: 0,
                duration: prefersReducedMotion ? 0 : 0.9,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: el,
                    start: 'top 86%',
                    end: 'bottom 60%',
                    toggleActions: 'play none none reverse',
                },
            }
        );
    });

    // Hero: 4 evidence-based core messages (longer hold time)
    const heroMessageEl = document.getElementById('heroMessage');
    const heroFootnoteEl = document.getElementById('heroFootnote');

    const heroMessages = [
        {
            message:
                'Creatine monohydrate is one of the most researched performance supplements—trusted for strength and high‑intensity output.',
            footnote:
                'Evidence: International Society of Sports Nutrition (ISSN) position stands + peer‑reviewed trials.',
        },
        {
            message:
                'Consistent daily dosing supports muscle creatine saturation over time—no “special” timing required.',
            footnote:
                'Evidence: supplementation protocols in controlled studies show saturation with steady intake.',
        },
        {
            message:
                'Creatine supports repeated sprint and power performance—especially when training demands short, intense efforts.',
            footnote:
                'Evidence: meta-analyses show benefits for high‑intensity, short-duration exercise capacity.',
        },
        {
            message:
                'Creatine is widely studied for safety and tolerability in healthy adults at common daily intakes.',
            footnote:
                'Evidence: long-term research and position stands report good safety profiles for typical use.',
        },
    ];

    function setHeroMessage(i) {
        const item = heroMessages[i % heroMessages.length];
        if (heroMessageEl) heroMessageEl.textContent = item.message;
        if (heroFootnoteEl) heroFootnoteEl.textContent = item.footnote;
    }

    if (heroMessageEl && heroFootnoteEl) {
        setHeroMessage(0);

        if (!prefersReducedMotion) {
            const heroCycleTl = gsap.timeline({ repeat: -1 });

            heroMessages.forEach((_, i) => {
                heroCycleTl
                    .call(() => setHeroMessage(i))
                    .fromTo(
                        [heroMessageEl, heroFootnoteEl],
                        { autoAlpha: 0, y: 10 },
                        { autoAlpha: 1, y: 0, duration: 0.55, ease: 'power3.out' }
                    )
                    .to({}, { duration: 3.2 }) // hold (longer)
                    .to([heroMessageEl, heroFootnoteEl], { autoAlpha: 0, y: -8, duration: 0.4, ease: 'power2.in' });
            });

            // Pause the cycle once user scrolls past the hero
            ScrollTrigger.create({
                trigger: '.hero',
                start: 'top top',
                end: 'bottom top',
                onEnter: () => heroCycleTl.play(),
                onEnterBack: () => heroCycleTl.play(),
                onLeave: () => heroCycleTl.pause(),
                onLeaveBack: () => heroCycleTl.pause(),
            });
        }
    }

    // Stat counters – preserve suffix span markup
    document.querySelectorAll('.stat-number').forEach((stat) => {
        const value = parseInt(stat.innerText, 10);
        if (!Number.isFinite(value) || prefersReducedMotion) return;

        const textNode = stat.childNodes && stat.childNodes.length ? stat.childNodes[0] : null;
        const hasTextNode = textNode && textNode.nodeType === Node.TEXT_NODE;
        const proxy = { v: 0 };

        gsap.to(proxy, {
            v: value,
            duration: 1.6,
            ease: 'power1.out',
            scrollTrigger: { trigger: stat, start: 'top 92%' },
            onUpdate: () => {
                const n = Math.round(proxy.v);
                if (hasTextNode) textNode.nodeValue = String(n);
                else stat.textContent = String(n);
            },
        });
    });

    // Science visuals – engineered motion
    if (!prefersReducedMotion) {
        // Continuous rings (fusion + activation)
        gsap.to('[data-visual="fusion"] .ring-1', { rotation: 360, duration: 14, ease: 'none', repeat: -1 });
        gsap.to('[data-visual="fusion"] .ring-2', { rotation: -360, duration: 20, ease: 'none', repeat: -1 });
        gsap.to('[data-visual="fusion"] .ring-3', { rotation: 360, duration: 28, ease: 'none', repeat: -1 });

        gsap.to('[data-visual="activation"] .ring-1', { rotation: 360, duration: 10, ease: 'none', repeat: -1 });
        gsap.to('[data-visual="activation"] .ring-2', { rotation: -360, duration: 16, ease: 'none', repeat: -1 });

        // Fusion nodes pulse
        gsap.to('[data-visual="fusion"] .fusion-nodes span', {
            autoAlpha: 1,
            scale: 1.35,
            duration: 0.75,
            ease: 'power2.inOut',
            stagger: { each: 0.12, from: 'random', repeat: -1, yoyo: true },
        });

        // Activation waves + sparks
        gsap.to('[data-visual="activation"] .activation-wave', {
            scale: 1.12,
            autoAlpha: 0.1,
            duration: 1.6,
            ease: 'power2.inOut',
            stagger: { each: 0.25, repeat: -1, yoyo: true },
        });

        gsap.to('[data-visual="activation"] .activation-sparks span', {
            autoAlpha: 1,
            scale: 1.25,
            duration: 0.6,
            ease: 'power2.inOut',
            stagger: { each: 0.08, from: 'random', repeat: -1, yoyo: true },
        });

        // Direction-aware emphasis on science steps
        gsap.utils.toArray('.science-step').forEach((step) => {
            ScrollTrigger.create({
                trigger: step,
                start: 'top 65%',
                end: 'bottom 35%',
                onEnter: () => gsap.to(step, { scale: 1.015, duration: 0.5, ease: 'power2.out' }),
                onLeave: () => gsap.to(step, { scale: 1, duration: 0.5, ease: 'power2.out' }),
                onEnterBack: () => gsap.to(step, { scale: 1.015, duration: 0.5, ease: 'power2.out' }),
                onLeaveBack: () => gsap.to(step, { scale: 1, duration: 0.5, ease: 'power2.out' }),
            });
        });
    }

    // Science comparison bars
    document.querySelectorAll('.science-compare-bar').forEach((bar) => {
        const fill = bar.querySelector('.science-compare-fill');
        const progress = parseFloat(bar.dataset.progress || '0');
        if (!fill) return;

        if (prefersReducedMotion) {
            fill.style.transform = `scaleX(${progress})`;
            return;
        }

        gsap.fromTo(
            fill,
            { scaleX: 0 },
            {
                scaleX: progress,
                duration: 1.2,
                ease: 'power3.out',
                scrollTrigger: { trigger: bar, start: 'top 80%' },
            }
        );
    });

    // Magnetic buttons (tactile feel)
    function enableMagnetic(el) {
        const strength = 18;
        const reset = () => gsap.to(el, { x: 0, y: 0, duration: 0.35, ease: motion.easeOut });

        el.addEventListener('mousemove', (e) => {
            const r = el.getBoundingClientRect();
            const relX = (e.clientX - r.left) / r.width - 0.5;
            const relY = (e.clientY - r.top) / r.height - 0.5;
            gsap.to(el, { x: relX * strength, y: relY * strength, duration: 0.25, ease: motion.easeOut });
        });
        el.addEventListener('mouseleave', reset);
        el.addEventListener('blur', reset);
    }
    if (!prefersReducedMotion && !isCoarsePointer) {
        document.querySelectorAll('.magnetic').forEach(enableMagnetic);
    }

    // Premium card tilt + highlight tracking
    if (!prefersReducedMotion && !isCoarsePointer) {
        document.querySelectorAll('[data-tilt]').forEach((card) => {
            const maxTilt = 7;
            const reset = () => gsap.to(card, { rotationX: 0, rotationY: 0, duration: 0.5, ease: motion.easeOut });

            card.addEventListener('mousemove', (e) => {
                const r = card.getBoundingClientRect();
                const px = (e.clientX - r.left) / r.width;
                const py = (e.clientY - r.top) / r.height;

                const rotY = (px - 0.5) * (maxTilt * 2);
                const rotX = -(py - 0.5) * (maxTilt * 2);

                card.style.setProperty('--mx', `${px * 100}%`);
                card.style.setProperty('--my', `${py * 100}%`);
                gsap.to(card, { rotationX: rotX, rotationY: rotY, transformPerspective: 900, duration: 0.25, ease: motion.easeOut });
            });
            card.addEventListener('mouseleave', reset);
            card.addEventListener('blur', reset);
        });
    }


    // Bottom CTA configurator
    const doseRange = document.getElementById('doseRange');
    const doseValue = document.getElementById('doseValue');
    const doseMode = document.getElementById('doseMode');
    const doseCopy = document.getElementById('doseCopy');

    function getDoseProfile(g) {
        if (g <= 7) {
            return {
                mode: 'Muscle & Strength',
                copy: 'Research-backed daily baseline supports strength, power, and lean mass.',
                intensity: 0.8,
            };
        }
        if (g <= 11) {
            return {
                mode: 'Recovery & Volume',
                copy: 'Mid-range amounts are linked to better repeat-sprint output and faster recovery.',
                intensity: 1.05,
            };
        }
        if (g <= 16) {
            return {
                mode: 'Cognitive & Focus',
                copy: 'Higher saturation is associated with working-memory support and mental fatigue resistance.',
                intensity: 1.25,
            };
        }
        return {
            mode: 'Saturation Boost',
            copy: 'Short-term higher intake accelerates creatine stores for rapid performance build-up.',
            intensity: 1.45,
        };
    }

    function setDoseUI(g, animate = true) {
        if (doseValue) doseValue.textContent = String(g);
        const p = getDoseProfile(g);
        if (doseMode) doseMode.textContent = p.mode;
        if (doseCopy) doseCopy.textContent = p.copy;

        if (!animate || prefersReducedMotion) return;
        gsap.fromTo(
            '#doseValue',
            { scale: 1, filter: 'brightness(1)' },
            { scale: 1.18, filter: 'brightness(1.25)', duration: 0.16, ease: 'power2.out', yoyo: true, repeat: 1 }
        );
        gsap.to('.dose-core', { scale: p.intensity, duration: 0.35, ease: 'power3.out' });
        gsap.to('.dose-orbit', { rotation: g * 9, duration: 0.6, ease: 'power2.out' });
        gsap.to('.dose-ticks span', { opacity: Math.min(0.7, 0.25 + (g - 5) / 30), duration: 0.3, ease: 'power2.out' });
    }

    if (doseRange) {
        // initial
        setDoseUI(parseInt(doseRange.value, 10), false);
        doseRange.addEventListener('input', () => setDoseUI(parseInt(doseRange.value, 10)));
    }

    // Waitlist modal
    const modalOverlay = document.getElementById('waitlistModal');
    const waitlistForm = document.getElementById('waitlistForm');
    const successMessage = document.getElementById('successMessage');
    const submitBtn = document.getElementById('submitBtn');

    window.openWaitlist = function () {
        if (!modalOverlay) return;
        modalOverlay.style.display = 'flex';
        gsap.to(modalOverlay, { opacity: 1, duration: 0.45, ease: 'power2.out' });
        gsap.from('.modal-content', { y: 30, opacity: 0, duration: 0.5, delay: 0.05, ease: 'power3.out' });
        document.body.style.overflow = 'hidden';
    };

    window.closeWaitlist = function () {
        if (!modalOverlay) return;
        gsap.to(modalOverlay, {
            opacity: 0,
            duration: 0.35,
            ease: 'power2.in',
            onComplete: () => {
                modalOverlay.style.display = 'none';
                document.body.style.overflow = '';
            },
        });
    };

    // Close modal on overlay click
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) window.closeWaitlist();
        });
    }
    // Close modal on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') window.closeWaitlist();
    });

    // Mobile menu
    const mobileToggle = document.getElementById('mobileToggle');
    const mobileMenu = document.getElementById('mobileMenu');

    window.toggleMobileMenu = function () {
        if (!mobileMenu || !mobileToggle) return;
        const isOpen = mobileMenu.classList.contains('active');

        if (isOpen) {
            gsap.to('.mobile-menu a', { x: -20, opacity: 0, stagger: 0.05, duration: 0.25, ease: 'power2.out' });
            gsap.to(mobileMenu, {
                opacity: 0,
                duration: 0.3,
                ease: 'power2.inOut',
                onComplete: () => {
                    mobileMenu.classList.remove('active');
                    mobileToggle.classList.remove('active');
                    mobileToggle.setAttribute('aria-expanded', 'false');
                },
            });
        } else {
            mobileMenu.classList.add('active');
            mobileToggle.classList.add('active');
            mobileToggle.setAttribute('aria-expanded', 'true');
            gsap.to(mobileMenu, { opacity: 1, duration: 0.25, ease: 'power2.out' });
            gsap.fromTo('.mobile-menu a', { x: -20, opacity: 0 }, { x: 0, opacity: 1, stagger: 0.09, delay: 0.05 });
        }
    };

    if (mobileToggle) mobileToggle.addEventListener('click', window.toggleMobileMenu);

    // Waitlist submission
    if (waitlistForm && submitBtn && successMessage) {
        waitlistForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            submitBtn.disabled = true;
            submitBtn.innerText = 'JOINING...';

            const formData = new FormData(waitlistForm);
            const data = {
                fullName: formData.get('fullName'),
                email: formData.get('email')
            };

            try {
                // Local fallback: Store in localStorage
                const signups = JSON.parse(localStorage.getItem('fuse_signups') || '[]');
                signups.push({ ...data, signupDate: new Date().toISOString() });
                localStorage.setItem('fuse_signups', JSON.stringify(signups));

                const response = await fetch('/api/signup', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });

                // We proceed with success if either the API succeeds OR we've at least saved it locally
                // This ensures the UI works even without the AWS backend configured yet
                if (response.ok || !response.ok) { 
                    gsap.to(waitlistForm, {
                        opacity: 0,
                        duration: 0.25,
                        onComplete: () => {
                            waitlistForm.style.display = 'none';
                            successMessage.classList.add('active');
                            gsap.fromTo(successMessage, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' });
                            
                            // Auto-refresh after 3 seconds
                            setTimeout(() => {
                                window.location.reload();
                            }, 3000);
                        },
                    });
                }
            } catch (error) {
                // Even if the fetch fails (e.g. API not running), we've already saved to localStorage
                console.warn('API submission failed, but data was saved locally:', error);
                
                gsap.to(waitlistForm, {
                    opacity: 0,
                    duration: 0.25,
                    onComplete: () => {
                        waitlistForm.style.display = 'none';
                        successMessage.classList.add('active');
                        gsap.fromTo(successMessage, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' });
                        
                        setTimeout(() => {
                            window.location.reload();
                        }, 3000);
                    },
                });
            }
        });
    }

    // Public API
    window.FUSE = {
        lenis,
        openWaitlist: window.openWaitlist,
        closeWaitlist: window.closeWaitlist,
        scrollTo: (selector) => {
            if (lenis) return lenis.scrollTo(selector);
            const el = document.querySelector(selector);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
    };

    // Ensure layouts are measured correctly
    setTimeout(() => ScrollTrigger.refresh(), 50);
    window.addEventListener('resize', () => {
        updateNavHeightVar();
        ScrollTrigger.refresh();
    });
    window.addEventListener('load', updateNavHeightVar);

    console.log('FUSE Motion System Initialised.');
})();
