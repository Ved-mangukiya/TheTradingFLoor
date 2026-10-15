# DEPENDENCIES SPECIFICATION — THE TRADING FLOOR CHAMPIONSHIP 2026

## 1. Zero-Bloat Dependency Philosophy

**The Trading Floor Championship** is engineered with an intentionally minimal dependency footprint. 
By avoiding heavy build frameworks (React, Angular, Webpack, Vite, Babel, Tailwind), the application achieves:
1. **Instant Cold Boot**: Launches in under 1 second without transpilation or build steps.
2. **Absolute Portability**: Can be copied via USB drive to any Windows/Mac/Linux laptop with Node.js installed.
3. **Infinite Longevity**: No dependency deprecation churn, broken peer dependencies, or vulnerability cascades.
4. **Offline Resilience**: Runs completely independent of npm registries or internet mirrors during events.

---

## 2. Production Runtime Dependencies

The application requires only two battle-tested, high-performance npm packages:

| Package | Version | Purpose | Security & Audit Notes |
| :--- | :---: | :--- | :--- |
| **`express`** | `^4.19.2` | Fast, unopinionated HTTP web framework. Serves static frontend assets (`public/`) and handles REST export endpoints (`/api/*`). | Industry standard. Configured with strict 10MB JSON body limit. |
| **`ws`** | `^8.18.0` | Ultra-fast, lightweight WebSocket implementation. Manages bi-directional client-server streaming for real-time market ticks, orders, and countdowns. | Native RFC 6455 compliant, zero native compilation required. |

---

## 3. Node.js Standard Library Modules (Zero-Install)
The backend utilizes standard core modules provided out-of-the-box by Node.js:
- `http`: Underlying HTTP server instance coupled with Express and WebSocket Server.
- `fs`: Asynchronous and synchronous file persistence for `data/universe_active.json` and `logs/`.
- `path`: Cross-platform path resolution across Windows and POSIX operating systems.
- `crypto`: Cryptographically secure session token generation (`crypto.randomBytes`).
- `os`: Network interface enumeration for automatic LAN IP discovery.

---

## 4. Frontend Browser Technologies (Zero-Install)
All client views in `public/` are crafted in pure standards-compliant web technologies:
- **HTML5**: Semantic layout with role-based view switching.
- **Vanilla CSS3**: Custom design tokens, CSS Grid, Flexbox, keyframe animations, and ivory luxury palette.
- **Vanilla JavaScript (ES2020+)**: Native `WebSocket` client API, `sessionStorage`, `AudioContext` sound generation, and Canvas 2D Bezier spline curves.

---

## 5. Safe Dependency Installation & Updates

To install or reinstall dependencies cleanly:
```bash
# Clean install from package.json
npm install

# Production-only install
npm install --production

# Audit for security advisories
npm audit
```
