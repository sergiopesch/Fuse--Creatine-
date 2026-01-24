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
        ScrollTrigger.create({
            start: 'top -100',
            onUpdate: (self) => {
                if (self.direction === 1) {
                    gsap.to(navbar, { yPercent: -100, duration: 0.4, ease: 'power2.inOut' });
                } else {
                    gsap.to(navbar, { yPercent: 0, duration: 0.4, ease: 'power2.out' });
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
        .from('.hero-subtitle', { y: 22, autoAlpha: 0 }, 0.9)
        .from('.hero-cta-group', { y: 16, autoAlpha: 0 }, 1.05)
        .from('.nav', { y: -40, autoAlpha: 0 }, 0.2);

    // Hero scroll-linked depth + orbs
    if (!prefersReducedMotion) {
        gsap.to('.hero-content', {
            scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
            y: 180,
            opacity: 0.45,
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
                autoAlpha: 1,
                x: 0,
                y: 0,
                duration: prefersReducedMotion ? 0 : 1.05,
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
        // Continuous rings
        gsap.to('[data-visual="activation"] .ring-1', { rotation: 360, duration: 10, ease: 'none', repeat: -1 });
        gsap.to('[data-visual="activation"] .ring-2', { rotation: -360, duration: 16, ease: 'none', repeat: -1 });
        gsap.to('[data-visual="shield"] .ring-1', { rotation: 360, duration: 12, ease: 'none', repeat: -1 });
        gsap.to('[data-visual="shield"] .ring-2', { rotation: -360, duration: 18, ease: 'none', repeat: -1 });
        gsap.to('[data-visual="shield"] .ring-3', { rotation: 360, duration: 26, ease: 'none', repeat: -1 });

        // Activation particles breathe
        gsap.to('[data-visual="activation"] .fusion-particles span', {
            autoAlpha: 1,
            scale: 1.25,
            duration: 0.65,
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

    // Magnetic buttons (tactile feel)
    function enableMagnetic(el) {
        const strength = 18;
        const reset = () => gsap.to(el, { x: 0, y: 0, duration: 0.35, ease: 'power3.out' });

        el.addEventListener('mousemove', (e) => {
            const r = el.getBoundingClientRect();
            const relX = (e.clientX - r.left) / r.width - 0.5;
            const relY = (e.clientY - r.top) / r.height - 0.5;
            gsap.to(el, { x: relX * strength, y: relY * strength, duration: 0.25, ease: 'power3.out' });
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
            const reset = () => gsap.to(card, { rotationX: 0, rotationY: 0, duration: 0.5, ease: 'power3.out' });

            card.addEventListener('mousemove', (e) => {
                const r = card.getBoundingClientRect();
                const px = (e.clientX - r.left) / r.width;
                const py = (e.clientY - r.top) / r.height;

                const rotY = (px - 0.5) * (maxTilt * 2);
                const rotX = -(py - 0.5) * (maxTilt * 2);

                card.style.setProperty('--mx', `${px * 100}%`);
                card.style.setProperty('--my', `${py * 100}%`);
                gsap.to(card, { rotationX: rotX, rotationY: rotY, transformPerspective: 900, duration: 0.25, ease: 'power3.out' });
            });
            card.addEventListener('mouseleave', reset);
            card.addEventListener('blur', reset);
        });
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

    // Waitlist submission (demo)
    if (waitlistForm && submitBtn && successMessage) {
        waitlistForm.addEventListener('submit', (e) => {
            e.preventDefault();
            submitBtn.disabled = true;
            submitBtn.innerText = 'JOINING...';

            setTimeout(() => {
                gsap.to(waitlistForm, {
                    opacity: 0,
                    duration: 0.25,
                    onComplete: () => {
                        waitlistForm.style.display = 'none';
                        successMessage.classList.add('active');
                        gsap.fromTo(successMessage, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' });
                    },
                });
            }, 900);
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
    window.addEventListener('resize', () => ScrollTrigger.refresh());

    console.log('FUSE Motion System Initialised.');
})();
