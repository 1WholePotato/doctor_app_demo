import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/useAuth";
import { authErrorMessage, authLinkOutcome, homeForRole, recoveryStep } from "../lib/auth";
import "../styles/auth.css";

export default function ForgotPassword({ resetMode = false }: { resetMode?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { user, loading: authLoading, passwordRecovery } = useAuth();
  const [linkFailed] = useState(() => resetMode && authLinkOutcome(window.location) === "failed");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [passwordChanged, setPasswordChanged] = useState(false);

  const step = recoveryStep({ resetMode, linkFailed, passwordRecovery, loading: authLoading });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      if (step === "choose-password") {
        if (password.length < 6) {
          setError("Password must be at least 6 characters.");
          return;
        }
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        setPassword("");
        setPasswordChanged(true);
      } else {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset`,
        });
        if (resetError) throw resetError;
        setMessage("If an account exists for that email, a password reset link is on its way. Use the newest link; earlier links stop working.");
      }
    } catch (err) {
      setError(authErrorMessage(err instanceof Error ? err : {}));
    } finally {
      setSubmitting(false);
    }
  };

  const choosing = step === "choose-password";
  const linkNotice = !resetMode || choosing || step === "checking-link" || message ? null : linkFailed
    ? "This reset link is invalid, has expired, or was already used. Enter your email below and we'll send you a new one."
    : "Open the password reset link from your email to choose a new password, or request a new link below.";

  return (
    <div className="fp-shell">
      <div className="fp-left">
        <div className="fp-logo"><div className="fp-logo-dot">✚</div>Dr <span>Admin</span></div>
        <div className="fp-hero">
          <h2>{choosing ? <>Choose a<br /><em>new password.</em></> : <>Account<br /><em>recovery.</em></>}</h2>
          <p>{choosing ? "Set a new password to regain access to your account." : "We'll email you a secure link to reset your password."}</p>
        </div>
        <p className="fp-footer">© 2026 Dr Admin. All rights reserved.</p>
      </div>
      <div className="fp-right">
        <div className="fp-wrap">
          <p className="eyebrow">Account</p>
          <h1>{choosing ? "Reset password" : resetMode ? "Request a new link" : "Forgot password"}</h1>
          <p className="sub">{choosing ? "Enter a new password for your account." : "Enter the email address you use to sign in."}</p>
          {linkNotice && <div className="lf-error" role="alert">{linkNotice}</div>}
          {message && <div className="fp-banner" role="status">{message}</div>}
          {error && <div className="lf-error" role="alert">{error}</div>}
          {step === "checking-link" ? (
            <div className="fp-banner" role="status">Checking your reset link…</div>
          ) : passwordChanged ? (
            <div className="fp-banner" role="status">
              Your password has been changed.{" "}
              <Link to={user ? homeForRole(user.role_id) : "/login"} className="fp-back">
                {user ? "Continue to your account →" : "Sign in →"}
              </Link>
            </div>
          ) : choosing || !message ? (
            <form onSubmit={handleSubmit}>
              {choosing ? (
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
              <button className="lf-submit" type="submit" disabled={submitting}>
                {submitting ? "Please wait…" : choosing ? "Update password" : resetMode ? "Send a new link" : "Send reset link"}
              </button>
            </form>
          ) : null}
          <Link to="/login" className="fp-back">← Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
