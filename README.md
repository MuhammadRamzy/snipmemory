# SnipMemory

SnipMemory is a professional, premium B2B SaaS platform built for modern hair salons and barber shops to manage customer style indexes, 4-angle visual haircut history, and automated client retention reminders.

This codebase is built on **Next.js App Router** with **React 19**, **Tailwind CSS v4**, and robust client-safe state synchronization.

---

## Key Features

### 1. Marketing & Booking Surface
*   **Catchy, Cool & Live Landing Page**: Features high-fidelity design layout, active subscription toggles (monthly vs. annual), and an interactive simulator demonstrating the customer database lookup and the face-blur camera pipeline.
*   **Client Style History Portal**: An interactive public dashboard on the main landing page allowing clients to lookup their multi-salon haircut visual history log using their mobile number and a secure simulated SMS OTP bypass passcode (`123456`).
*   **Onboarding Flow**: 3-step progressive onboarding wizard to configure salon profiles, stylist station rosters, and custom reminder timelines.
*   **Discovery Portal (`/discovery`)**: Public search registry for clients to find registered salons, browse reviews, and view active stylist teams. Features a direct access gateway pointing to the salon's workspace.

### 2. Salon Dynamic Workspace App (`/salon/[salonId]/*`)
*   **Isolated Workspace login (`/salon/[salonId]/login`)**: Dynamically loads salon branding, staff rosters, and separates entry routes:
    *   **Owner Portal**: Authenticate via owner email and password. Redirects to Owner Panel.
    *   **Stylist Station**: Select profile from the salon's roster, input standard access PIN, and unlock the camera dashboard.
*   **Barber Mode (`/salon/[salonId]/barber`)**:
    *   Dynamic client lookup by name/phone with state preservation.
    *   **Live Camera Capture**: Hardware integration utilizing `getUserMedia` camera streams with precision SVG outline guides (Front, Left, Right, Back views) for high-fidelity cut alignment.
    *   **Privacy Face Blur**: Optional dynamic client-side HTML5 canvas pixelation algorithm to obscure front-view facial identity while preserving haircut silhouettes.
    *   **Cross-Salon OTP Transfer**: 6-digit SMS verification simulator that queries client credentials from other salons and copies styling history specs directly into the active ticket context.
    *   Graceful fallback for manual file uploads if camera access is restricted.
*   **Owner Dashboard (`/salon/[salonId]/dashboard`)**:
    *   **Metrics View**: Weekly performance charts, monthly visit metrics, and pending retention stats.
    *   **Clients Database (`/salon/[salonId]/clients`)**: High-performance sorting, searching, and direct deep-linking back to Barber Mode styling cards.
    *   **Reminders View (`/salon/[salonId]/reminders`)**: Automated list of clients due for follow-ups, with template customizers and simulated WhatsApp dispatch broadcasts.
    *   **Billing Engine (`/salon/[salonId]/billing`)**: Dedicated portal showcasing plan limits usage, glassmorphic credit card verification forms, and downloadable invoice simulators.
    *   **Settings (`/salon/[salonId]/settings`)**: Station roster adjustments, staff profiles, plan upgrades, and invoice history tables.

### 3. Platform Admin Console (`/admin/*`)
*   **Operator Login**: Secure session gates.
*   **Host-Restricted Routing**: Proxy routing restricting admin console access via matches to `admin.localhost` hostnames or `/admin` route paths.
*   **Platform Dashboard**: Real-time cross-platform metrics (Global salons count, active subscriptions, Estimated MRR calculations, global visits, and R2 Media Vault storage footprints).
*   **Salon Roster Inspector**: Deep inspect client lists, station totals, payment history, and administrative overrides (mark active/cancelled/past-due).
*   **Impersonation Override**: Bypasses authentication gates to instantly log into the salon owner's workspace for debugging and customer support.
*   **Global Broadcast Settings**: Manage platform announcements and custom notice levels.
*   **Pricing Tier Configurator**: Modify plan properties, monthly/annual prices, and limits directly from the admin panel.
*   **System integrity Diagnostics**: Verify database mapping and simulate diagnostic operations logs.

---

## Architecture & Technology Stack

*   **Framework**: Next.js (App Router)
*   **State Management**: React Context (`AppContext.jsx`) with dynamic `localStorage` hydration guards to prevent server-side rendering (SSR) mismatch states.
*   **Styling**: Tailwind CSS v4 featuring a curated professional B2B theme palette:
    *   `Steel Slate` dark mode variables (`#090a0f` / `#111219`)
    *   `Sapphire Indigo` accent tokens (`#6366f1` / `#4f46e5`)
    *   Smooth micro-animations (`animate-fade`, `animate-slide`)
*   **Gating Security**: Layout-level PIN protection gate (locks owner-only routes `/salon/[salonId]/*` until the 4-digit PIN is entered).

---

## Repository Directory Structure

```text
src/
├── app/
│   ├── admin/
│   │   ├── login/           # Admin login portal
│   │   └── page.jsx         # Administrative command center
│   ├── checkout/            # Plan checkout simulator
│   ├── discovery/           # Public salon directory & reviews
│   ├── onboarding/          # Progressive setup flow
│   ├── salon/
│   │   └── [salonId]/       # Dynamic salon workspace
│   │       ├── barber/      # Barber styling mode & camera overlays
│   │       ├── billing/     # Dedicated B2B subscription manager
│   │       ├── clients/     # Owner clients CRM page
│   │       ├── dashboard/   # Owner statistics metrics page
│   │       ├── login/       # Custom salon login page
│   │       ├── reminders/   # Retention reminder dispatcher
│   │       ├── settings/    # Stylists & station roster settings
│   │       └── layout.jsx   # Workspace layout with PIN gate security
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

## Getting Started

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

## Sandbox Credentials

For ease of testing, the system is seeded with the following sandbox accounts:

### Salon Owner Workspace Accounts
*   **Active Pro Salon**:
    *   **Email**: `owner@classiccuts.com`
    *   **Password**: `password123`
    *   **URL**: `/salon/salon-classic/login`
*   **Trial Growth Salon**:
    *   **Email**: `owner@fadelab.com`
    *   **Password**: `password123`
    *   **URL**: `/salon/salon-fade/login`
*   **Past Due Subscription Salon** (triggers reminder banner):
    *   **Email**: `owner@goldenscissors.com`
    *   **Password**: `password123`
    *   **URL**: `/salon/salon-scissors/login`

### Owner PIN Gates
*   **Owner PIN Code** (used to switch from Stylist/Barber mode to the Owner Dashboard): `1234` or `0000`

### Platform Administration Portal
*   **Access Route**: `/admin/login` or via subdomain `admin.localhost:3000/login`
*   **Email**: `admin@snipmemory.com`
*   **Password**: `admin`
