# SnipMemory ✂️

SnipMemory is a professional, premium B2B SaaS platform built for modern hair salons and barber shops to manage customer style indexes, 4-angle visual haircut history, and automated client retention reminders.

This codebase is built on **Next.js App Router** with **React 19**, **Tailwind CSS v4**, and robust client-safe state synchronization.

---

## 🚀 Key Features

### 1. Marketing & Booking Surface
*   **Landing Page**: Interactive premium pricing plans, billing interval selection toggles (monthly vs. annual), and dynamic client benefit sections.
*   **Onboarding Flow**: 3-step progressive onboarding wizard to configure salon profiles, stylist station rosters, and custom reminder timelines.
*   **Discovery Portal (`/discovery`)**: Public search registry for clients to find registered salons, browse reviews, and view stylist ratings.

### 2. Salon Workspace App (`/app/*`)
*   **Barber Mode (`/app/barber`)**:
    *   Dynamic client lookup by name/phone with state preservation.
    *   **Live Camera Capture**: Hardware integration utilizing `getUserMedia` camera streams with precision SVG outline overlays (**Front**, **Left**, **Right**, **Back** profile views) for high-fidelity cut alignment.
    *   **Privacy Face Blur**: Optional dynamic client-side HTML5 canvas pixelation algorithm to obscure front-view facial identity before saving.
    *   **Cross-Salon OTP Transfer**: 6-digit SMS verification simulator that queries client credentials from other salons and copies styling history specs directly into the active ticket context.
    *   Graceful fallback for manual file uploads if camera access is restricted.
*   **Owner Dashboard (`/app/dashboard`)**:
    *   **Metrics View**: Weekly performance charts, monthly visit metrics, and pending retention stats.
    *   **Clients Database (`/app/clients`)**: High-performance sorting, searching, and direct deep-linking back to Barber Mode styling cards.
    *   **Reminders View (`/app/reminders`)**: Automated list of clients due for follow-ups, with template customizers and simulated WhatsApp dispatch broadcasts.
    *   **Billing Engine (`/app/billing`)**: Dedicated portal showcasing plan limits usage, glassmorphic mock credit card verification forms, and downloadable invoice simulators.
    *   **Settings (`/app/settings`)**: Station roster adjustments, staff profiles, plan upgrades, and invoice history tables.

### 3. Platform Admin Console (`/admin/*` & Subdomains)
*   **Operator Login**: Secure session gates.
*   **Host-Restricted Routing**: Integrated Next.js proxy routing restricting admin console access via matches to `admin.localhost` hostnames or `/admin` route paths.
*   **Platform Dashboard**: Real-time cross-platform metrics (Global salons, active subscriptions, Estimated MRR calculations, global visits).
*   **Salon Roster Inspector**: Deep inspect client lists, station totals, payment history, and administrative overrides (mark active/cancelled/past-due).
*   **Global Broadcast Settings**: Enable or disable system-wide warning banners displayed at the top of all salon-facing dashboard pages.

---

## 🛠️ Architecture & Technology Stack

*   **Framework**: Next.js (App Router)
*   **State Management**: React Context (`AppContext.jsx`) with dynamic `localStorage` hydration guards to prevent server-side rendering (SSR) mismatch states.
*   **Styling**: Tailwind CSS v4 featuring a curated professional B2B theme palette:
    *   `Steel Slate` dark mode variables (`#090a0f` / `#111219`)
    *   `Sapphire Indigo` accent tokens (`#6366f1` / `#4f46e5`)
    *   Smooth micro-animations (`animate-fade`, `animate-slide`)
*   **Gating Security**: Layout-level PIN protection gate (locks owner-only routes `/app/*` until the 4-digit PIN is entered).

---

## 📁 Repository Directory Structure

```text
src/
├── app/
│   ├── admin/
│   │   ├── login/           # Admin login portal
│   │   └── page.jsx         # Administrative command center
│   ├── app/
│   │   ├── barber/          # Barber styling mode & camera overlays
│   │   ├── billing/         # Dedicated B2B subscription manager
│   │   ├── clients/         # Owner clients CRM page
│   │   ├── dashboard/       # Owner statistics metrics page
│   │   ├── reminders/       # Retention reminder dispatcher
│   │   ├── settings/        # Stylists & station roster settings
│   │   ├── layout.jsx       # Workspace layout with PIN gate security
│   │   └── page.jsx         # Redirect to barber workspace
│   ├── checkout/            # Plan checkout simulator
│   ├── discovery/           # Public salon directory & reviews
│   ├── login/               # Owner workspace login (shortcut buttons removed)
│   ├── onboarding/          # Progressive setup flow
│   ├── signup/              # Account registration
│   ├── globals.css          # Tailwind CSS v4 variables & theme overrides
│   ├── layout.js            # Root layout with AppProvider wrapper
│   └── page.jsx             # Public marketing landing page
├── components/
│   └── OwnerDashboard.jsx   # Core client-side statistics & directory components
└── context/
    ├── AppContext.jsx       # Global application state layer
    └── mockData.js          # Platform demo database profiles
```

---

## 🏁 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org) (v18+) and [npm](https://npmjs.com) installed.

### Installation
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the application.

3. Run production build and compilation checks:
   ```bash
   npm run build
   ```

---

## 🔑 Sandbox Credentials

For ease of testing, the system is seeded with the following sandbox accounts:

### Salon Owner Workspace Accounts
*   **Active Pro Salon**:
    *   **Email**: `owner@classiccuts.com`
    *   **Password**: `password123`
*   **Trial Growth Salon**:
    *   **Email**: `owner@fadelab.com`
    *   **Password**: `password123`
*   **Past Due Subscription Salon** (triggers reminder banner):
    *   **Email**: `owner@goldenscissors.com`
    *   **Password**: `password123`

### Owner PIN Gates
*   **Owner PIN Code** (used to switch from Stylist/Barber mode to the Owner Dashboard): `1234` or `0000`

### Platform Administration Portal
*   **Access Route**: `/admin/login` or via subdomain `admin.localhost:3000/login`
*   **Email**: `admin@snipmemory.com`
*   **Password**: `admin`
