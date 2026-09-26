import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { authErrorMessage, getSessionUser, homeForRole, signOut } from "../lib/auth";

import "../styles/auth.css";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const registered = (location.state as { registered?: boolean } | null)?.registered;
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) {
        setError(authErrorMessage(authError));
        return;
      }

      const profile = await getSessionUser();
      if (!profile) {
        await signOut();
        setError("Your account is signed in, but its profile could not be loaded. Contact support for help.");
        return;
      }

      navigate(homeForRole(profile.role_id));
    } catch (err) {
      setError(authErrorMessage(err instanceof Error ? err : {}));
    } finally {
      setLoading(false);
    }
  };

  return (
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
                <div style={{ position: "relative" }}>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    style={{ paddingRight: "40px", width: "100%" }}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#94A3B8",
                      display: "flex",
                      alignItems: "center",
                      padding: 0,
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="lf-row" style={{ justifyContent: "flex-end" }}>
                <Link to="/forgot-password" className="lf-forgot">Forgot password?</Link>
              </div>

              {registered && (
                <div className="lf-success" role="status">
                  Account created. Sign in below.
                </div>
              )}

              {error && (
                <div className="lf-error" role="alert">
                  <span aria-hidden="true">⚠</span> {error}
                </div>
              )}

              <button className="lf-submit" type="submit" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <p className="lf-footer">
              Don't have an account?
              <Link to="/register">Register here</Link>
            </p>
          </div>
        </div>

      </div>
  );
}
