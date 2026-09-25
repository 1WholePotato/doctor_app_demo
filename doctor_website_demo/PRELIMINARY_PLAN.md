# Doctor App Demo — V1 Implementation Plan (Draft / Working Blueprint)
**Target Branch:** `vaperizer2` (preparing for merge into `dev`)  
**Scope Exclusions:** RLS (deferred for RAD), Ozow payment gateway (external ticket).  
**New Key Architecture:** Cloudflare R2 (S3-compatible) for 1-page completion certificate PDF storage.

---

## Architecture & Workstream Division for Parallel Agent Execution

To allow multiple concurrent agents to work independently without merge conflicts or overlapping file locks, work is grouped into **5 decoupled modules**:

```
[Module 1: Core Cleanups & Linter Fixes] (Zero dependencies)
         |
         +---> [Module 2: Cloudflare R2 & PDF Certificates] (Standalone storage & PDF lib)
         |
         +---> [Module 3: Student Flow & Live Course Catalog] (Catalog & Enrollment data)
         |
         +---> [Module 4: Responsive Layouts & Design System] (CSS consolidation & Drawer)
         |
         +---> [Module 5: App Shell, AuthContext & Performance] (Routing, Lazy loading, ErrorBoundary)
```

---

## Module 1: Build Integrity, Linter Fixes & Dead Code Pruning (Agent 1)
> **Goal:** 100% clean builds, 0 lint errors, elimination of duplicate/stub files.

- [ ] **1.1 Fix React 19 Lint Errors in Course Details:**
  - In `src/pages/StudentCourseDetails.tsx:173`: Guard `if (!id) return;` inside `useEffect` and eliminate synchronous `setState` in effect body.
  - In `src/pages/AdminCourseDetails.tsx:283`: Wrap `loadData` in `useCallback([id])` and pass into `useEffect` dependency array.
- [ ] **1.2 Clean Dead & Orphaned Files:**
  - Remove `src/components/SideNav.tsx` (legacy Tailwind nav).
  - Remove `src/components/AboutDoctor.tsx` & `src/components/AboutWebsite.tsx` (stubs with placeholder text).
  - Remove `src/components/Navbar.tsx` (redundant with `Hero.tsx`).
  - Remove `src/pages/AdminGrades.tsx` (empty CSS-only stub).
  - Remove `src/App.css` (unused Vite template).
- [ ] **1.3 Replace Native Browser `alert()` Calls:**
  - Replace blocking `alert()` popups in `AdminCourse.tsx` and `AdminCourseDetails.tsx` with accessible toast/banner feedback.

---

## Module 2: Cloudflare R2 S3 Storage & PDF Certificates (Agent 2 - Issue #3)
> **Goal:** Automated 1-page completion certificates stored in Cloudflare R2 (S3 API).

- [ ] **2.1 Cloudflare R2 Storage Adapter (`src/lib/storage.ts`):**
  - Configure AWS S3 SDK v3 client (`@aws-sdk/client-s3` or lightweight S3 fetch client) configured for Cloudflare R2 endpoint (`https://<account_id>.r2.cloudflarestorage.com/<bucket_name>`).
  - Store R2 credentials in `.env.local` / Supabase Edge function secrets (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`).
  - Provide helper functions:
    - `uploadCertificatePdf(userId, courseId, pdfBlob): Promise<string>`
    - `getCertificateDownloadUrl(certificatePath): Promise<string>`
- [ ] **2.2 1-Page PDF Certificate Generator (`src/lib/certificateGenerator.ts`):**
  - Use `pdf-lib` (lightweight, zero canvas DOM dependency) to generate clean, professional 1-page certificate.
  - Template includes: Student Full Name, Course Title, Completion Date, Instructor Name, Verification UUID/hash, Official Stamp / Border.
- [ ] **2.3 Student Grades & Certificate UI:**
  - Update `src/pages/StudentGrades.tsx` to query real completions and provide a "Download Certificate" button triggering the Cloudflare R2 download URL.

---

## Module 3: Student Flow & Live Course Discovery Catalog (Agent 3)
> **Goal:** Eliminate dead ends in student user journey; connect live Supabase data.

- [ ] **3.1 Public Landing Page Section Composition:**
  - Fix `src/pages/Home.tsx` to render the full public page: Header Navbar, Hero banner, About Doctor, and Features sections.
- [ ] **3.2 Student Course Catalog Discovery:**
  - Currently `/courses` (`StudentCourses.tsx`) only shows already-booked courses.
  - Implement a segmented view or separate tab: "My Enrolled Courses" vs "Explore All Courses".
  - Allow un-enrolled students to browse available courses, read descriptions, and view upcoming session dates.
- [ ] **3.3 Connect Student & Admin Dashboards to Real Database Queries:**
  - In `src/pages/StudentLanding.tsx`: Replace mock arrays ("John", "Lobotomy 101") with live queries from `bookings` and `course_sessions`.
  - In `src/pages/AdminLanding.tsx`: Replace static metric counters ("1,284 students", "R 54k revenue") with live counts from `users` and `bookings`.

---

## Module 4: Responsive Mobile Layouts & Design Polish (Agent 4)
> **Goal:** Full mobile/tablet usability, horizontal table scrolling, WCAG 2.1 AA compliance.

- [ ] **4.1 Responsive Collapsible Navigation (Drawer / Hamburger):**
  - Implement mobile drawer in `AdminSidebar.tsx` and `StudentSidebar.tsx` for viewports <1024px.
  - Reset `.main-content`, `.sl-main`, `.sp-main` margin from `228px` to `0` on mobile.
- [ ] **4.2 Table Card Horizontal Scrolling:**
  - Wrap table elements in `overflow-x: auto` containers across `AdminLanding`, `AdminUsers`, `AdminCourseDetails`, and `StudentCourseDetails`.
- [ ] **4.3 Color Contrast & Button Remediation (WCAG 2.1 AA):**
  - Gold buttons: Change text from `#FFFFFF` to `#111110` (achieving 10.2:1 contrast).
  - Teal buttons: Darken to `#0E7468` (achieving 4.58:1 contrast).
  - Badge text: Darken to `#0F5B52` on light backgrounds.
- [ ] **4.4 Accessibility & Modal Improvements:**
  - Implement `useFocusTrap` hook and `Escape` key listeners for all modals (`AdminCourse`, `AdminUsers`, `AdminCourseDetails`).
  - Bind `htmlFor`/`id` across form controls in `StudentProfile.tsx` and `Register.tsx`.

---

## Module 5: App Shell, AuthContext & Performance (Agent 5)
> **Goal:** Zero flash on route changes, code-splitting <100kB chunks, ErrorBoundary.

- [ ] **5.1 In-Memory `AuthContext` Provider:**
  - Wrap app in `AuthProvider` that caches `user` session in state.
  - Prevents `RequireAuth` from flashing a white screen / unmounting on every navigation.
- [ ] **5.2 React Router Layouts:**
  - Refactor `App.tsx` into nested routes (`<AdminLayout />`, `<StudentLayout />`, `<PublicLayout />`) instead of flat disconnected routes.
- [ ] **5.3 Route Code Splitting (`React.lazy`):**
  - Lazy load all 15 page components with `<Suspense fallback={<LoadingSpinner />}>`.
  - Configure `vite.config.ts` manualChunks to separate `vendor-react` and `vendor-supabase`.
- [ ] **5.4 Global Error Boundary:**
  - Create `src/components/ErrorBoundary.tsx` to catch and gracefully display unexpected UI errors.

---

## Two-Phase Audit & Progress Gate Architecture

```
Phase 1: Implementation Sprint (Parallel Agents 1 - 5)
         │
         ▼
[Progress Gate 1: Automated Health Check]
  ├── npm run lint (0 errors, 0 warnings)
  ├── npx tsc -b (0 type errors)
  └── npm run build (clean chunked build)
         │
         ▼
Phase 2: Dual Independent No-Context Audits (2 Fresh Agents)
  ├── Auditor A: Code Quality, Edge Cases & Low-Hanging Fruit
  └── Auditor B: User Journey, Security Boundaries & S3/R2 Integrity
         │
         ▼
[Progress Gate 2: Final Sign-off & Pull Request Creation]
  ├── Merge all branch layers
  ├── Link PR via link_pull_request MCP tool
  └── Target `dev` branch
```
