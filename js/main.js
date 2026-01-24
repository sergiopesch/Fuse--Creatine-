// ============================================
// FUSE WEBSITE - FULL JAVASCRIPT
// Version 1.0 - Pre-Launch
// ============================================

(function() {
    'use strict';

    // ============================================
    // NAVIGATION
    // ============================================
    
    const navbar = document.getElementById('navbar');
    let lastScroll = 0;

    function handleNavScroll() {
        const currentScroll = window.pageYOffset;
        
        if (currentScroll > 100) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
        
        lastScroll = currentScroll;
    }

    window.addEventListener('scroll', handleNavScroll, { passive: true });

    // ============================================
    // MOBILE MENU
    // ============================================
    
    const mobileToggle = document.getElementById('mobileToggle');
    const mobileMenu = document.getElementById('mobileMenu');

    window.toggleMobileMenu = function() {
        mobileToggle.classList.toggle('active');
        mobileMenu.classList.toggle('active');
        document.body.classList.toggle('menu-open');
    };

    window.closeMobileMenu = function() {
        mobileToggle.classList.remove('active');
        mobileMenu.classList.remove('active');
        document.body.classList.remove('menu-open');
    };

    mobileToggle.addEventListener('click', window.toggleMobileMenu);

    // ============================================
    // SMOOTH SCROLL
    // ============================================
    
    window.scrollToSection = function(sectionId) {
        const target = document.getElementById(sectionId);
        if (target) {
            const offsetTop = target.offsetTop - 80;
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    };

    // Handle all anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href && href.length > 1) {
                e.preventDefault();
                const targetId = href.substring(1);
                scrollToSection(targetId);
            }
        });
    });

    // ============================================
    // WAITLIST MODAL
    // ============================================
    
    const modalOverlay = document.getElementById('waitlistModal');
    const waitlistForm = document.getElementById('waitlistForm');
    const successMessage = document.getElementById('successMessage');
    const submitBtn = document.getElementById('submitBtn');

    window.openWaitlist = function() {
        modalOverlay.classList.add('active');
        document.body.classList.add('modal-open');
        
        // Focus first input for accessibility
        setTimeout(() => {
            const firstNameInput = document.getElementById('firstName');
            if (firstNameInput) firstNameInput.focus();
        }, 100);
    };

    window.closeWaitlist = function() {
        modalOverlay.classList.remove('active');
        document.body.classList.remove('modal-open');
        
        // Reset form after animation
        setTimeout(() => {
            if (waitlistForm) {
                waitlistForm.classList.remove('hidden');
                waitlistForm.reset();
            }
            if (successMessage) successMessage.classList.remove('active');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'JOIN THE WAITLIST';
            }
        }, 300);
    };

    // Close modal on overlay click
    modalOverlay.addEventListener('click', function(e) {
        if (e.target === modalOverlay) {
            closeWaitlist();
        }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
            closeWaitlist();
        }
    });

    // Form submission
    window.submitWaitlist = function(e) {
        if (e) e.preventDefault();
        
        const firstName = document.getElementById('firstName');
        const email = document.getElementById('email');
        
        // Basic validation
        if (!firstName.value.trim()) {
            firstName.focus();
            return;
        }
        
        if (!email.value.trim() || !isValidEmail(email.value)) {
            email.focus();
            return;
        }
        
        // Disable button and show loading
        submitBtn.disabled = true;
        submitBtn.textContent = 'JOINING...';
        
        // Simulate API call (replace with actual API integration)
        setTimeout(() => {
            // Hide form, show success
            waitlistForm.classList.add('hidden');
            successMessage.classList.add('active');
            
            // Log the submission (replace with actual API call)
            console.log('Waitlist signup:', {
                firstName: firstName.value,
                email: email.value,
                timestamp: new Date().toISOString(),
                source: 'FUSE Website v1.0'
            });
            
            // Dispatch custom event for external integrations
            window.dispatchEvent(new CustomEvent('fuse:waitlist-signup', {
                detail: {
                    firstName: firstName.value,
                    email: email.value
                }
            }));
            
        }, 1500);
    };

    if (waitlistForm) {
        waitlistForm.addEventListener('submit', window.submitWaitlist);
    }

    function isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    // ============================================
    // SCROLL ANIMATIONS
    // ============================================
    
    const animatedElements = document.querySelectorAll('.fade-in, .fade-in-left, .fade-in-right');
    
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const animationObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    animatedElements.forEach(el => animationObserver.observe(el));

    // ============================================
    // POUR CUP ANIMATION
    // ============================================
    
    const pourCup = document.getElementById('pourCup');
    let pourInterval = null;

    if (pourCup) {
        const pourObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Start animation cycle
                    if (!pourInterval) {
                        activatePourCup();
                        pourInterval = setInterval(activatePourCup, 5000);
                    }
                } else {
                    // Stop animation when out of view
                    if (pourInterval) {
                        clearInterval(pourInterval);
                        pourInterval = null;
                    }
                }
            });
        }, { threshold: 0.3 });
        
        pourObserver.observe(pourCup);
    }

    function activatePourCup() {
        pourCup.classList.add('activated');
        setTimeout(() => {
            pourCup.classList.remove('activated');
        }, 2000);
    }

    // ============================================
    // PUBLIC API FOR AGENTS
    // ============================================
    
    window.FUSE = {
        // Open waitlist modal
        openWaitlist: window.openWaitlist,
        
        // Close waitlist modal
        closeWaitlist: window.closeWaitlist,
        
        // Submit waitlist form programmatically
        submitWaitlistForm: function(firstName, email) {
            const firstNameInput = document.getElementById('firstName');
            const emailInput = document.getElementById('email');
            if (firstNameInput) firstNameInput.value = firstName;
            if (emailInput) emailInput.value = email;
            window.submitWaitlist();
        },
        
        // Scroll to section
        scrollTo: window.scrollToSection,
        
        // Get current modal state
        isModalOpen: function() {
            return modalOverlay.classList.contains('active');
        },
        
        // Get page sections
        getSections: function() {
            return ['hero', 'science', 'comparison', 'product'];
        },
        
        // Version info
        version: '1.0.0',
        brand: 'FUSE',
        tagline: 'Pour. Fuse. Perform.'
    };

    // ============================================
    // INITIALISATION
    // ============================================
    
    // Handle initial scroll state
    handleNavScroll();

    // Log successful initialisation
    console.log('FUSE Website v1.0 - British Made - Initialised');
    console.log('Agent API available at window.FUSE');

})();
