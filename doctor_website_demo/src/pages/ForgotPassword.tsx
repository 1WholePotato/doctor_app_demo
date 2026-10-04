import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { authErrorMessage } from "../lib/auth";
import "../styles/auth.css";

export default function ForgotPassword({ resetMode = false }: { resetMode?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!resetMode) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    const callback = new URLSearchParams(window.location.search).get("error_description")
      ?? new URLSearchParams(window.location.hash.slice(1)).get("error_description");
    if (callback) setError("This reset link is invalid or expired. Request a new one.");
    if (window.location.search.includes("code=") || window.location.hash.includes("type=recovery")) {
      void supabase.auth.getSession().then(({ data }) => {
        if (data.session) setReady(true);
      });
    }
    return () => subscription.unsubscribe();
  }, [resetMode]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      if (resetMode) {
        if (password.length < 6) {
          setError("Password must be at least 6 characters.");
          return;
        }
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        setMessage("Your password has been changed. You can now sign in.");
        setPassword("");
      } else {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset`,
        });
        if (resetError) throw resetError;
        setMessage("If an account exists for that email, a password reset link is on its way.");
      }
    } catch (err) {
      setError(authErrorMessage(err instanceof Error ? err : {}));
    } finally {
      setLoading(false);
    }
  };

  const canReset = ready || window.location.hash.includes("type=recovery");

  return (
    <div className="fp-shell">
      <div className="fp-left">
        <div className="fp-logo"><div className="fp-logo-dot">✚</div>Dr <span>Admin</span></div>
        <div className="fp-hero">
          <h2>{resetMode ? <>Choose a<br /><em>new password.</em></> : <>Account<br /><em>recovery.</em></>}</h2>
          <p>{resetMode ? "Set a new password to regain access to your account." : "We'll email you a secure link to reset your password."}</p>
        </div>
        <p className="fp-footer">© 2026 Dr Admin. All rights reserved.</p>
      </div>
      <div className="fp-right">
        <div className="fp-wrap">
          <p className="eyebrow">Account</p>
          <h1>{resetMode ? "Reset password" : "Forgot password"}</h1>
          <p className="sub">{resetMode ? "Enter a new password for your account." : "Enter the email address you use to sign in."}</p>
          {message && <div className="fp-banner" role="status">{message}</div>}
          {error && <div className="lf-error" role="alert">{error}</div>}
          {resetMode && !canReset ? (
            <div className="fp-banner" role="status">Open the password reset link from your email to choose a new password.</div>
          ) : !message || resetMode ? (
            <form onSubmit={handleSubmit}>
              {resetMode ? (
                <div className="lf-field">
                  <label htmlFor="new-password">New password</label>
                  <input id="new-password" type="password" autoComplete="new-password" minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} />
                </div>
              ) : (
                <div className="lf-field">
                  <label htmlFor="recovery-email">Email</label>
                  <input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
                </div>
              )}
              <button className="lf-submit" type="submit" disabled={loading}>
                {loading ? "Please wait…" : resetMode ? "Update password" : "Send reset link"}
              </button>
            </form>
          ) : null}
          <Link to="/login" className="fp-back">← Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
