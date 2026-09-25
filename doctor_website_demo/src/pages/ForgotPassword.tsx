import { Link } from "react-router-dom";
import "../styles/auth.css";

export default function ForgotPassword() {
  return (
    <div className="fp-shell">
      <div className="fp-left">
        <div className="fp-logo">
          <div className="fp-logo-dot">✚</div>
          Dr <span>Admin</span>
        </div>
        <div className="fp-hero">
          <h2>Reset is<br /><em>on the way.</em></h2>
          <p>This is a placeholder so we can test the login link. Email reset is not wired yet.</p>
        </div>
        <p className="fp-footer">© 2026 Dr Admin. All rights reserved.</p>
      </div>
      <div className="fp-right">
        <div className="fp-wrap">
          <p className="eyebrow">Account</p>
          <h1>Forgot password</h1>
          <p className="sub">Dummy reset page for navigation testing.</p>
          <div className="fp-banner" role="status">
            Password reset email is not enabled in this demo. Ask an admin if you are locked out, or return to sign in.
          </div>
          <Link to="/login" className="fp-back">← Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
