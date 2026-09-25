# Implementation guide — `vaperizer2`

Use this file outside Cursor. Work on branch `vaperizer2`. When you want a review, come back with the files you changed.

**Repo root (this worktree):** `/home/vaper/Work/Worktrees/doctor_app_demo`

**App you actually edit:** `/home/vaper/Work/Worktrees/doctor_app_demo/doctor_website_demo`

**Branch:** `vaperizer2` (created from `stefanDemo` at `65d0b06`)

---

## 0. Start here every session

```bash
cd /home/vaper/Work/Worktrees/doctor_app_demo
git status                    # should say: On branch vaperizer2
cd doctor_website_demo
npm install                   # first time only
npm run dev                   # Vite, usually http://localhost:5173
```

Current login (until you replace it):

| Role    | Email                    | Password |
|---------|--------------------------|----------|
| Admin   | `admin123@gmail.com`     | `1234`   |
| Student | `student123@gmail.com`   | `1234`   |

Do **not** implement Stefan’s issues (#3 grades PDFs, #4 schema/RLS) unless you pair with him. Your issues: **#2 Users**, **#1 Testing/Security**, **#6 Class lists**, **#5 assets (blocked)**.

Suggested order: **#2 → #1 (auth + env + guards) → #6 (after his DB) → #1 tests → #5**.

---

## 1. Style guide (copy this, do not invent a new look)

Stefan did **not** use Tailwind for these screens. Each page injects a `<style>{...}</style>` string with CSS variables, then uses class names. Match that. Do not restyle with Tailwind utility classes on admin/student pages. `src/components/SideNav.tsx` is an old unused layout — ignore it.

Fonts are already in `doctor_website_demo/index.html`.

### Admin (doctor) — gold / cream

Copy tokens from `src/pages/AdminLanding.tsx` / `AdminCourse.tsx`.

```css
:root {
  --bg:          #F7F6F3;
  --surface:     #FFFFFF;
  --sidebar:     #111110;
  --gold:        #C9A84C;
  --gold-soft:   #F5EDD6;
  --text-1:      #111110;
  --text-2:      #6B6A66;
  --text-3:      #A09F9A;
  --border:      #E8E6E1;
  --radius:      14px;
  --font-display: 'Fraunces', Georgia, serif;
  --font-body:    'DM Sans', system-ui, sans-serif;
}
```

- Page background `--bg`, cards `--surface` + `1px solid var(--border)` + `border-radius: var(--radius)`
- Sidebar 228px, fixed, `--sidebar`, gold active state
- Headings: Fraunces, `font-weight: 300`
- Labels: 11–12px, uppercase, letter-spacing, `--text-3` or `--text-2`
- Primary button: black `--text-1`, white text, 10px radius (`btn-primary` in AdminCourse)
- Accent / links: `--gold`
- Tables: thead `#FAFAF8`, uppercase 11px headers
- Modal: overlay `rgba(17,17,16,.45)`, white card, close button top-right (copy `AddCourseModal` in `AdminCourse.tsx`)
- Icons: `lucide-react` (`Users`, `LayoutDashboard`, `BookOpen`, `Settings`, `LogOut`, `X`)

**Clone these files for admin Users:** `AdminLanding.tsx` (shell + table) and `AdminCourse.tsx` (modal + form fields).

### Student — navy / teal

Copy tokens from `src/pages/StudentLanding.tsx`.

```css
:root {
  --s-bg:        #F4F7FB;
  --s-surface:   #FFFFFF;
  --s-navy:      #0F1E35;
  --s-teal:      #2BBFAA;
  --s-teal-soft: #E6F7F5;
  --s-teal-mid:  #1A9E8C;
  --s-text-1:    #0F1E35;
  --s-text-2:    #4A5568;
  --s-text-3:    #94A3B8;
  --s-border:    #E2E8F0;
  --s-radius:    12px;
  --s-font:      'Plus Jakarta Sans', system-ui, sans-serif;
}
```

- Sidebar 224px, `--s-navy`, teal active state
- Headings: Plus Jakarta, `font-weight: 600`
- Primary button: `--s-teal` background, white text, 8px radius
- Cards: white, `1px solid var(--s-border)`
- Avatar circle in sidebar footer (initials)

**Clone `StudentLanding.tsx` / `StudentGrades.tsx` for the student profile page.**

### Page construction pattern (required)

Every authenticated page currently looks like this. Keep it:

1. `const styles = \`...\`` (or `globalStyles`)
2. `export default function Page() { const { pathname } = useLocation(); ... }`
3. Return `<> <style>{styles}</style> <div className="*-shell"> sidebar + main </div> </>`
4. Sidebar `NavItem` uses `Link` + `active={pathname.startsWith(...)}`

You will be adding routes. **Update the sidebar links on every page that has them**, not just the new pages. Today they are copy-pasted in:

| File | Broken links to fix |
|------|---------------------|
| `pages/AdminLanding.tsx` | Dashboard → `/` (wrong, use `/dashboard`). Students → `/patients`. Settings → `/settings` |
| `pages/AdminCourse.tsx` | same |
| `pages/AdminCourseDetails.tsx` | same |
| `pages/StudentLanding.tsx` | Settings → `/settings`. Notifications → `/notifications` (no page yet; leave or drop) |
| `pages/StudentCourses.tsx` | same |
| `pages/StudentCourseDetails.tsx` | same |
| `pages/StudentGrades.tsx` | same |

**Admin Students link:** change `/patients` → `/admin/users` (or `/users` — pick one and use it everywhere).

**Student Settings link:** change `/settings` → `/profile` (student’s own user page).

### Do / don’t

- Do copy existing class names (`nav-item`, `field`, `btn-primary`, `modal-overlay`, `table-inner`).
- Do keep inline `<style>` unless you extract one shared `AdminSidebar` / `StudentSidebar` component (optional but cleaner).
- Don’t introduce styled-components, MUI, or a new font.
- Don’t put new npm packages unless you truly need one (CSV download needs none).
- Don’t rewrite Student Grades or Admin Course Details — those are Stefan’s.

---

## 2. Shared scaffolding (do this once, before the pages)

### 2.1 Env + Supabase client — issue #1

**Create** `doctor_website_demo/.env.local` (already gitignored via `*.local`):

```
VITE_SUPABASE_URL=https://fwgwgeehrronfqilkdha.supabase.co
VITE_SUPABASE_ANON_KEY=<paste the anon key currently in src/supabaseClient.ts>
```

**Replace** `src/supabaseClient.ts` with:

```ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

Restart `npm run dev` after changing env.

Never put the **service role** key in the frontend.

### 2.2 Discover real table/column names

Stefan’s Register insert (this is the profile shape you must use):

```ts
supabase.from("users").insert([{
  id, role_id, first_name, last_name, birth_date,
  id_num, passport_num, cell_num, email, sanc_num, active,
}])
```

Login’s commented code still says `.from("Users")` — that is wrong. Use **`users`**.

In the Supabase dashboard, confirm:

- Table `users` columns (and whether `role_id` is a UUID FK to `roles`)
- Table `roles` (likely `id`, `name` or similar)
- Actual admin vs student role UUIDs — Register currently writes `"PUT_STUDENT_ROLE_ID_HERE"` which will fail or store garbage

Put the two role UUIDs in one place, e.g. `src/lib/roles.ts`:

```ts
// Fill from Supabase Table Editor → roles
export const STUDENT_ROLE_ID = "<uuid>";
export const ADMIN_ROLE_ID = "<uuid>";

export function isAdminRole(roleId: string) {
  return roleId === ADMIN_ROLE_ID;
}
```

Also **fix** `Register.tsx` to use `STUDENT_ROLE_ID` instead of the placeholder.

### 2.3 Auth helper — `src/lib/auth.ts` (new)

You need this for login, guards, Users pages, and sign-out.

```ts
import { supabase } from "../supabaseClient";
import { isAdminRole } from "./roles";

export type AppUser = {
  id: string;
  email: string;
  role_id: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  id_num: string | null;
  passport_num: string | null;
  cell_num: string | null;
  sanc_num: string | null;
  active: boolean;
};

export async function getSessionUser(): Promise<AppUser | null> {
  const { data: sessionData } = await supabase.auth.getUser();
  const authUser = sessionData.user;
  if (!authUser) return null;

  const { data, error } = await supabase
    .from("users")
    .select("id, email, role_id, first_name, last_name, birth_date, id_num, passport_num, cell_num, sanc_num, active")
    .eq("id", authUser.id)
    .single();

  if (error || !data) return null;
  return data as AppUser;
}

export function homeForRole(roleId: string) {
  return isAdminRole(roleId) ? "/dashboard" : "/studentlanding";
}

export async function signOut() {
  await supabase.auth.signOut();
}
```

Adjust `select` if column names in the DB differ. If RLS blocks `.single()`, that is Stefan’s #4 — note it and use a service-side policy, don’t bypass with the service role in the browser.

### 2.4 Route guard — `src/components/RequireAuth.tsx` (new)

Wrap admin and student route groups in `App.tsx`.

Behaviour:

- No session → `/login`
- Session but student hitting `/dashboard` or `/admin/*` → `/studentlanding`
- Session but admin hitting `/studentlanding`, `/courses`, `/grades`, `/profile` → `/dashboard` (or allow admin to view student pages if you prefer; issue #2 implies separate sides)

Wire sign-out on every sidebar `Sign out` button: `await signOut(); navigate("/login")`.

### 2.5 Routes to add in `src/App.tsx`

```tsx
<Route path="/profile" element={<StudentProfile />} />
<Route path="/admin/users" element={<AdminUsers />} />
```

Keep existing routes. Unused imports in `App.tsx` (`useState`, logos) can be deleted while you are there.

---

## 3. Issue #2 — Users (your main feature)

GitHub: student sees/updates **only their own** info. Admin sees **all users** (active + inactive) and may **change role only**.

### 3.1 Student page

**New file:** `src/pages/StudentProfile.tsx`

**Route:** `/profile`  
**Nav:** student sidebar “Settings” (or rename the label to “Profile”) → `/profile`

**Layout:** copy `StudentLanding` shell (navy sidebar + `sg-main` / `sl-main` padding).

**Load:**

```ts
const user = await getSessionUser();
```

**Form fields (same names as Register):**

| Field | Editable? | Notes |
|-------|-----------|--------|
| first_name | yes | required |
| last_name | yes | required |
| email | yes | also call `supabase.auth.updateUser({ email })` if it changed |
| birth_date | yes | `type="date"` |
| id_num / passport_num | yes | same SA-citizen toggle as Register |
| cell_num | yes | required |
| sanc_num | yes | optional |
| role | **no** | display only, e.g. “Student” |
| active | **no** | display only |

**Save:**

```ts
await supabase.from("users").update({
  first_name, last_name, email, birth_date,
  id_num: id_num || null,
  passport_num: passport_num || null,
  cell_num, sanc_num,
}).eq("id", user.id);
```

Do **not** send `role_id` or `active` from this form.

Validation: reuse Register’s required-field style (`rf-field`, `.err`, red `#C0392B`). Success: a small banner, not `alert()` if you can avoid it (Register still uses `alert` — a banner is finer).

Password: issue does not require it. Optional “change password” via `supabase.auth.updateUser({ password })` is extra; skip unless you have time.

### 3.2 Admin page

**New file:** `src/pages/AdminUsers.tsx`

**Route:** `/admin/users`  
**Nav:** every admin sidebar “Students” → `/admin/users` (label can stay “Students” or become “Users”)

**Layout:** copy `AdminLanding` / `AdminCourse` shell (dark sidebar, cream main).

**Load all users:**

```ts
const { data, error } = await supabase
  .from("users")
  .select("id, first_name, last_name, email, role_id, active, cell_num")
  .order("last_name");
```

If you have a `roles` table:

```ts
.select("id, first_name, last_name, email, role_id, active, cell_num, roles(name)")
```

**UI (issue asks for list + modal):**

1. Top: eyebrow `People` + heading `Users` (Fraunces 32px / 300).
2. Optional filter pills: All / Active / Inactive / Admin / Student.
3. Table columns: Name, Email, Role, Status (Active/Inactive badge), action “Change role”.
4. Status badges: copy AdminLanding `.badge-paid` (green) / `.badge-pending` (amber).
5. Clicking a row or “Change role” opens a modal.

**Modal (role only):**

- Show name + email as read-only text (not inputs).
- One `<select>`: Student / Admin (values = the two role UUIDs).
- Submit:

```ts
await supabase.from("users").update({ role_id: nextRoleId }).eq("id", selected.id);
```

- **Do not** include inputs for name, email, active, phone, etc. The issue is explicit: *for security that is the only thing admin can change.*

If the current user is changing **their own** role, either block it or warn — blocking is safer.

Empty state: copy AdminCourse empty-state (icon in gold-soft box).

### 3.3 RLS you will hit

If student `select` returns other users, or admin `update` of `role_id` fails, that is database policy (Stefan #4). Frontend still:

- Student query **must** `.eq("id", authUser.id)`
- Admin update **must** only patch `{ role_id }`

Do not “fix” RLS by using the service role in the client.

---

## 4. Issue #1 — Testing and Security

### 4.1 Turn on real login — `src/pages/Login.tsx`

Delete `TEST_USERS` and the fake match block.

Replace `handleSubmit` with the commented Supabase flow, corrected:

```ts
const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
if (authError) { setError(authError.message); setLoading(false); return; }

const profile = await getSessionUser();
if (!profile) { setError("Could not fetch user profile"); setLoading(false); return; }

navigate(homeForRole(profile.role_id));
```

Keep the existing login layout/CSS. `remember me` can stay visual-only unless you want `persistSession`.

Forgot-password link currently goes to `#` — optional: `supabase.auth.resetPasswordForEmail`. Not required by the issue.

### 4.2 Register

- Use `STUDENT_ROLE_ID` from `src/lib/roles.ts`
- After signup, if email confirmation is on, show “check your email” instead of assuming insert succeeded with a session

### 4.3 Guards + sign out

See §2.4. Every `Sign out` button in admin and student sidebars must call `signOut()` and navigate to `/login`.

### 4.4 Tests to run yourself (then I can re-check)

No test runner is set up. Manual is enough:

1. Wrong password → inline error, stay on `/login`
2. Student login → `/studentlanding` only. Pasting `/dashboard` redirects away
3. Admin login → `/dashboard` only
4. Student `/profile` shows **their** row only; saving does not change `role_id`
5. Admin `/admin/users` lists active and inactive; changing role persists after refresh
6. Admin cannot edit another user’s name/email from that UI (no fields)
7. Logged-out `/admin/users` → `/login`
8. `.env.local` used; `supabaseClient.ts` has no raw key

Optional: a small `doctor_website_demo/SECURITY_NOTES.md` listing what you verified. Skip if you don’t want extra files.

---

## 5. Issue #6 — Pull class lists (after Stefan’s #4)

**Where:** `src/pages/AdminLanding.tsx`, table “Classes Happening Soon”, Download button:

```tsx
<button className="btn-primary" onClick={() => ''}>Download</button>
```

`btn-primary` is **not defined** in AdminLanding’s stylesheet (it lives in AdminCourse). Copy `.btn-primary` into AdminLanding styles when you wire this.

**Issue requirements for each list:**

- Which class it is
- Who will give the class (instructor)
- Who will attend — **only students who paid**

**Data:** dummy `courses` array in AdminLanding is fake. Replace with a query of **upcoming sessions**, not dummy names.

Stefan’s #4 says bookings must FK **course sessions**, not courses. Until that lands, you cannot implement this correctly. When it does, expected shape (names will differ — check the dashboard):

```ts
// Pseudocode — confirm table/column names with Stefan
const { data } = await supabase
  .from("course_sessions")
  .select(`
    id, date, location, instructor,
    courses ( course_title ),
    bookings ( paid, users ( first_name, last_name, email ) )
  `)
  .gte("date", today)
  .order("date");
```

Then filter `bookings` where `paid === true`.

**Download:** no new library. Build a CSV in the browser:

```ts
function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map(r => r.map(c => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

CSV columns: `Class, Date, Instructor, Student name, Student email`.

One file per session on click. Filename e.g. `classlist-advanced-anatomy-2026-04-02.csv`.

If payment is stored elsewhere (`payments.status = 'paid'`), join that instead of `bookings.paid`. Ask Stefan before guessing.

Until #4 is done: leave a disabled Download + tooltip “Waiting on session bookings”, rather than generating fake CSVs.

---

## 6. Issue #5 — Frontend assets (do last)

Blocked on photos/SVGs from the doctor.

When they arrive:

- Public landing: `src/components/Hero.tsx`, `Navbar.tsx` (and unused `AboutDoctor.tsx` / `AboutWebsite.tsx` if you hook them into `Home.tsx`)
- Put files in `doctor_website_demo/public/` and reference `/filename.svg`
- Do not replace the gold/navy system with a new palette just because a logo arrived

---

## 7. File checklist (what “done” looks like)

```
doctor_website_demo/
  .env.local                          (new, not committed)
  src/lib/roles.ts                    (new)
  src/lib/auth.ts                     (new)
  src/components/RequireAuth.tsx      (new)
  src/supabaseClient.ts               (env only)
  src/App.tsx                         (new routes + guards)
  src/pages/Login.tsx                 (real auth)
  src/pages/Register.tsx              (real student role id)
  src/pages/StudentProfile.tsx        (new)
  src/pages/AdminUsers.tsx            (new)
  src/pages/AdminLanding.tsx          (nav + class list when unblocked)
  src/pages/AdminCourse.tsx           (nav + sign out)
  src/pages/AdminCourseDetails.tsx    (nav + sign out)
  src/pages/StudentLanding.tsx        (nav + sign out)
  src/pages/StudentCourses.tsx        (nav + sign out)
  src/pages/StudentCourseDetails.tsx  (nav + sign out)
  src/pages/StudentGrades.tsx         (nav + sign out)
```

Do **not** need to touch: `AdminGrades.tsx` (dead CSS), `SideNav.tsx`, student grades dummy data, admin session dummy data.

---

## 8. When you want a review

Come back with:

1. Branch still `vaperizer2` (or say if you branched again)
2. List of files you changed
3. Which issues you consider done (#2 / #1 / #6)
4. Anything that failed because of RLS or missing columns

I will check: routes, role-only admin updates, student self-scope, guards, env (no keys in git), and that the UI still matches the style guide above.
