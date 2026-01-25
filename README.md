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
│   ├── chat.js          # FUSE Agent chat API (Anthropic Claude)
│   ├── health.js        # Health check endpoint
│   └── signup.js        # Waitlist signup API
├── index.html          # Single-page application
├── css/
│   ├── admin.css       # Admin UI styles
│   ├── legal.css       # Legal page styles
│   └── style.css       # All styling (CSS custom properties, responsive)
├── js/
│   ├── admin.js        # Admin UI logic
│   ├── chat.js         # FUSE Agent chat widget
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

## FUSE Agent Chat

The site includes an AI-powered chat widget called the "FUSE Agent" - a friendly, British customer service assistant powered by Claude (Anthropic). The chat widget appears as a floating button in the bottom-right corner of the page.

### Features

- **Conversational AI**: Powered by Claude claude-sonnet-4-20250514 with a custom system prompt that embodies the FUSE brand personality
- **British Personality**: Smart, polite, evidence-based responses with subtle British charm
- **Product Knowledge**: Deep understanding of FUSE's technology, dosing guidelines, and scientific backing
- **Quick Actions**: Pre-defined questions for common queries (What is FUSE?, Dosing guide, etc.)
- **Rate Limiting**: 20 requests per minute per IP to prevent abuse
- **Error Handling**: Intelligent retry logic with user-friendly error messages
- **Accessibility**: Full ARIA support, keyboard navigation, and screen reader compatibility
- **Health Checks**: Automatic API configuration validation with developer-friendly diagnostics

### Setting Up the Chat Agent

The FUSE Agent requires an Anthropic API key to function. Without it, you'll see a 503 error.

#### Step 1: Get an Anthropic API Key

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Sign in or create an account
3. Navigate to API Keys section
4. Create a new API key (it will start with `sk-ant-`)

#### Step 2: Configure the Environment

**For Vercel Deployment:**

1. Go to your Vercel project dashboard
2. Navigate to **Settings** > **Environment Variables**
3. Add the following variable:
   - **Name**: `ANTHROPIC_API_KEY`
   - **Value**: Your API key (e.g., `sk-ant-api03-...`)
4. Click **Save**
5. Redeploy your project for changes to take effect

**For Local Development:**

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` and add your API key:
   ```
   ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
   ```

#### Step 3: Verify Configuration

1. Visit `/api/health` in your browser
2. Check that `apiKey.validFormat` is `true`
3. Check that `status` is `ok` (not `degraded`)

### Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| "Chat service is not configured" | `ANTHROPIC_API_KEY` is missing | Add the API key to Vercel environment variables or `.env` file |
| "API key format is invalid" | Key doesn't start with `sk-ant-` | Verify you copied the complete key from Anthropic Console |
| 503 Service Unavailable | API key missing or invalid | Check `/api/health` endpoint for diagnostics |
| "I'm temporarily unavailable" | Server-side configuration issue | Check browser console for detailed hints |

**Debugging Tips:**

- Open browser DevTools console - the chat widget logs configuration issues automatically
- Call `FUSEChat.checkHealth()` in the console to run a manual health check
- Visit `/api/health` directly to see the full configuration status

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Send messages to the FUSE Agent |
| `/api/health` | GET | Check API configuration and health status |

### Chat Widget API

The chat widget exposes a global `FUSEChat` object:

```javascript
// Open/close the chat window
FUSEChat.open()
FUSEChat.close()
FUSEChat.toggle()

// Check if chat is open
FUSEChat.isOpen()

// Clear conversation history
FUSEChat.clearHistory()

// Check API health (for debugging)
FUSEChat.checkHealth()
```

### Health Check

Visit `/api/health` to verify the chat service configuration. The endpoint returns diagnostic information including:

- API key presence and format validation
- Environment configuration status
- Runtime information

Example response:
```json
{
  "status": "ok",
  "apiKey": {
    "exists": true,
    "validFormat": true,
    "prefix": "sk-ant-..."
  },
  "issues": []
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes (for chat) | Anthropic API key for Claude chat agent. Must start with `sk-ant-`. Get it from [console.anthropic.com](https://console.anthropic.com/) |
| `BLOB_READ_WRITE_TOKEN` | Yes (for signups) | Vercel Blob read/write token for storing waitlist signups |
| `ADMIN_TOKEN` | Yes (for admin) | Shared secret used to authorize `/api/admin-signups` |
| `ENCRYPTION_KEY` | Yes (for security) | A 32+ character string used to encrypt PII in storage |

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
