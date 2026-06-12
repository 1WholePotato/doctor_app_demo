/**
 * Login.tsx — Production-grade Login Page
 *
 * CHANGES:
 * 1. Matches the admin design system (Fraunces + DM Sans, gold accent, same tokens).
 * 2. Split layout — dark left panel with branding, white right panel with form.
 * 3. Role-based redirect: admin123 → /dashboard, student123 → /studentlanding.
 * 4. Supabase code left commented — uncomment when ready.
 * 5. Inline error message for wrong credentials.
 * 6. No new npm packages needed.
 *
 * Google Fonts (already in index.html):
 *   Fraunces + DM Sans
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

const styles = `
  :root {
    --bg:        #F7F6F3;
    --surface:   #FFFFFF;
    --sidebar:   #111110;
    --gold:      #C9A84C;
    --gold-soft: #F5EDD6;
    --text-1:    #111110;
    --text-2:    #6B6A66;
    --text-3:    #A09F9A;
    --border:    #E8E6E1;
    --font-display: 'Fraunces', Georgia, serif;
    --font-body:    'DM Sans', system-ui, sans-serif;
  }

  .login-shell {
    min-height: 100vh; display: flex;
    font-family: var(--font-body);
  }

  /* Left branding panel */
  .login-left {
    width: 420px; flex-shrink: 0;
    background: var(--sidebar);
    display: flex; flex-direction: column;
    justify-content: space-between;
    padding: 48px 44px;
  }
  .login-logo {
    display: flex; align-items: center; gap: 10px;
    font-family: var(--font-display); font-size: 18px;
    font-weight: 300; color: #fff; letter-spacing: .02em;
  }
  .login-logo span { color: var(--gold); }
  .login-logo-dot {
    width: 28px; height: 28px; border-radius: 8px;
    background: var(--gold);
    display: flex; align-items: center; justify-content: center;
    font-size: 15px;
  }
  .login-hero { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .login-hero h2 {
    font-family: var(--font-display); font-size: 36px;
    font-weight: 300; color: #fff; line-height: 1.25;
    margin-bottom: 16px; letter-spacing: -.01em;
  }
  .login-hero h2 em { font-style: italic; color: var(--gold); }
  .login-hero p { font-size: 14px; color: #888887; line-height: 1.7; max-width: 280px; }
  .login-footer { font-size: 12px; color: #444443; }

  /* Right form panel */
  .login-right {
    flex: 1; background: var(--bg);
    display: flex; align-items: center; justify-content: center;
    padding: 48px 40px;
  }
  .login-form-wrap { width: 100%; max-width: 380px; }
  .login-form-wrap .eyebrow {
    font-size: 11px; font-weight: 500; color: var(--text-3);
    letter-spacing: .08em; text-transform: uppercase; margin-bottom: 8px;
  }
  .login-form-wrap h1 {
    font-family: var(--font-display); font-size: 28px;
    font-weight: 300; color: var(--text-1); margin-bottom: 32px;
  }

  /* Fields */
  .lf-field { display: flex; flex-direction: column; gap: 7px; margin-bottom: 18px; }
  .lf-field label {
    font-size: 12px; font-weight: 500; color: var(--text-2);
    letter-spacing: .04em; text-transform: uppercase;
  }
  .lf-field input {
    width: 100%; border: 1px solid var(--border); border-radius: 10px;
    padding: 12px 14px; font-family: var(--font-body); font-size: 14px;
    color: var(--text-1); background: var(--surface); outline: none;
    transition: border-color .15s;
  }
  .lf-field input:focus { border-color: var(--gold); }

  .lf-row {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 26px;
  }
  .lf-remember { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-2); cursor: pointer; }
  .lf-remember input[type="checkbox"] { accent-color: var(--gold); width: 15px; height: 15px; }
  .lf-forgot { font-size: 13px; color: var(--gold); text-decoration: none; }
  .lf-forgot:hover { text-decoration: underline; }

  .lf-error {
    background: #FEE9E9; border: 1px solid #F5C1C1; border-radius: 10px;
    padding: 11px 14px; font-size: 13px; color: #A12D2D;
    margin-bottom: 18px; display: flex; align-items: center; gap: 8px;
  }

  .lf-submit {
    width: 100%; background: var(--text-1); color: #fff; border: none;
    padding: 13px; border-radius: 10px; font-family: var(--font-body);
    font-size: 14px; font-weight: 500; cursor: pointer;
    transition: background .15s; margin-bottom: 20px;
  }
  .lf-submit:hover { background: #2a2a28; }
  .lf-submit:disabled { background: var(--text-3); cursor: not-allowed; }

  .lf-footer { text-align: center; font-size: 13px; color: var(--text-3); }
  .lf-footer a { color: var(--gold); text-decoration: none; margin-left: 4px; }
  .lf-footer a:hover { text-decoration: underline; }

  @media (max-width: 768px) {
    .login-left { display: none; }
    .login-right { background: var(--surface); }
  }
`;

const TEST_USERS = [
  { email: "admin123@gmail.com",   password: "1234", role: "admin" },
  { email: "student123@gmail.com", password: "1234", role: "student" },
];

export default function Login() {
  const navigate = useNavigate();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // ── Supabase auth (uncomment when ready) ──────────────────────────────
    // const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    // if (authError) { setError(authError.message); setLoading(false); return; }
    // const { data: profile, error: profileError } = await supabase
    //   .from("Users").select("role_id").eq("id", data.user.id).single();
    // if (profileError) { setError("Could not fetch user profile"); setLoading(false); return; }
    // if (profile.role_id === "PUT_ADMIN_ROLE_ID_HERE") {
    //   navigate("/dashboard");
    // } else {
    //   navigate("/studentlanding");
    // }
    // ─────────────────────────────────────────────────────────────────────

    // ── Test user login (remove once Supabase is live) ────────────────────
    const match = TEST_USERS.find(
      (u) => u.email === email && u.password === password
    );

    if (!match) {
      setError("Incorrect email or password. Please try again.");
      setLoading(false);
      return;
    }

    if (match.role === "admin") {
      navigate("/dashboard");
    } else {
      navigate("/studentlanding");
    }
    // ─────────────────────────────────────────────────────────────────────
  };

  return (
    <>
      <style>{styles}</style>
      <div className="login-shell">

        {/* ── Left branding panel ── */}
        <div className="login-left">
          <div className="login-logo">
            <div className="login-logo-dot">✚</div>
            Dr <span>Admin</span>
          </div>

          <div className="login-hero">
            <h2>Medical education,<br /><em>elevated.</em></h2>
            <p>Access your courses, track your students, and manage your curriculum — all in one place.</p>
          </div>

          <p className="login-footer">© 2026 Dr Admin. All rights reserved.</p>
        </div>

        {/* ── Right form panel ── */}
        <div className="login-right">
          <div className="login-form-wrap">
            <p className="eyebrow">Welcome back</p>
            <h1>Sign in</h1>

            <form onSubmit={handleSubmit}>
              <div className="lf-field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="lf-field">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              <div className="lf-row">
                <label className="lf-remember">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  Remember me
                </label>
                <a href="#" className="lf-forgot">Forgot password?</a>
              </div>

              {error && (
                <div className="lf-error">
                  <span>⚠</span> {error}
                </div>
              )}

              <button className="lf-submit" type="submit" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <p className="lf-footer">
              Don't have an account?
              <a href="/register">Register here</a>
            </p>
          </div>
        </div>

      </div>
    </>
  );
}
