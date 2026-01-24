# FUSE - Performance Coffee Creatine

Britain's first coffee-optimized creatine with Instant Fusion Technology.

## Overview

FUSE is a premium marketing website for an innovative performance supplement - a creatine product engineered specifically to dissolve seamlessly in hot coffee without clumping, grit, or taste alteration. The site showcases cutting-edge web animation techniques and delivers a high-end, immersive brand experience.

## Features

### Product Highlights
- **Instant Activation** - Micro-encapsulation system disperses particles evenly without clumping
- **Triple Shield Technology** - Three layers of thermal protection maintain 100% bioavailability in hot beverages
- **Zero Stirring Required** - Self-dispersing formula dissolves in under 3 seconds
- **Taste Neutral** - Preserves your coffee's original flavor profile
- **Configurable Dosing** - 5g to 20g adjustable serving sizes

### Website Features
- Smooth scrolling experience powered by Lenis
- Advanced GSAP animations with ScrollTrigger integration
- Interactive 3D product packaging visualization
- Magnetic button effects and card tilt interactions
- Custom cursor with blend mode effects
- Dose configurator with real-time visual feedback
- Fully responsive design for all device sizes
- Accessibility-first approach with reduced motion support
- Glassmorphic navigation with scroll-aware behavior

## Tech Stack

| Technology | Purpose |
|------------|---------|
| HTML5 | Semantic markup with ARIA accessibility |
| CSS3 | Custom properties, Grid, Flexbox, Backdrop filters |
| Vanilla JavaScript | No framework dependencies |
| [GSAP 3.12](https://greensock.com/gsap/) | Animation engine |
| [ScrollTrigger](https://greensock.com/scrolltrigger/) | Scroll-based animations |
| [Lenis](https://lenis.studiofreight.com/) | Smooth scroll implementation |
| Google Fonts | Bebas Neue + Inter typography |

## Project Structure

```
fuse-creatine/
├── admin.html          # Admin signups view
├── privacy.html        # Privacy policy
├── terms.html          # Terms and conditions
├── api/
│   ├── admin-signups.js # Protected admin API
│   └── signup.js        # Waitlist signup API
├── index.html          # Single-page application
├── css/
│   ├── admin.css       # Admin UI styles
│   ├── legal.css       # Legal page styles
│   └── style.css       # All styling (CSS custom properties, responsive)
├── js/
│   ├── admin.js        # Admin UI logic
│   └── main.js         # Animation & interaction logic
├── assets/
│   └── favicon.svg     # Brand favicon
└── README.md           # Documentation
```

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/fuse-creatine.git
   ```

2. Open `index.html` in a modern browser, or serve locally:
   ```bash
   # Using Python
   python -m http.server 8000

   # Using Node.js
   npx serve
   ```

3. Navigate to `http://localhost:8000`

## Waitlist Storage and Admin Access

The waitlist form posts to `/api/signup`, which stores signups in Vercel Blob storage
using non-guessable filenames. Users must consent to be contacted and agree to the Terms and
Privacy Policy. Admins can view signups at `/admin` (or `/admin.html`) by providing the admin token.
Legal pages are available at `/privacy` and `/terms`.
Rate limiting is enforced on the signup API to mitigate abuse.

Required environment variables:

- `BLOB_READ_WRITE_TOKEN`: Vercel Blob read/write token
- `ADMIN_TOKEN`: shared secret used to authorize `/api/admin-signups`
- `ENCRYPTION_KEY`: A 32+ character string used to encrypt PII in storage. (Required for security)

## Integration Test (Production-Ready)

Run a real end-to-end test against your deployed environment. This will submit a real signup
and then confirm it appears in the admin listing.

```bash
BASE_URL="https://your-deployment-url" \
ADMIN_TOKEN="your-admin-token" \
npm test
```

The test script retries the admin lookup with exponential backoff to account for
storage consistency delays.

## Sections

| Section | Description |
|---------|-------------|
| **Hero** | Full-viewport landing with animated title, product visual, and rotating evidence-based messaging |
| **Stats Bar** | Key metrics with animated counters (20G max dose, 0 stirring, 3s dissolve, 100% taste) |
| **Science** | Two-step process explanation with animated fusion visuals |
| **Comparison** | Side-by-side cards comparing regular creatine vs FUSE |
| **Product** | Detailed product showcase with feature highlights |
| **CTA** | Interactive dose configurator and waitlist signup |

## Accessibility

- Respects `prefers-reduced-motion` - animations disabled when user preference is set
- Respects `pointer: coarse` - touch-friendly interactions on mobile devices
- ARIA labels and roles for screen reader compatibility
- Keyboard navigation support (Escape closes modals, Enter submits forms)
- Focus states on all interactive elements

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance Considerations

- Transform-based animations for GPU acceleration
- `will-change` hints on frequently animated elements
- Lazy reveal system for off-screen content
- Optimized scroll handlers with GSAP's ticker
- SVG-based favicon for crisp rendering at all sizes

## Public API

The site exposes a global `FUSE` object for programmatic control:

```javascript
// Smooth scroll to any section
FUSE.scrollTo('#science')

// Open/close waitlist modal
FUSE.openWaitlist()
FUSE.closeWaitlist()

// Access Lenis instance
FUSE.lenis
```

## License

This project is proprietary. All rights reserved.

---

**Engineered in Britain** | FUSE Performance
