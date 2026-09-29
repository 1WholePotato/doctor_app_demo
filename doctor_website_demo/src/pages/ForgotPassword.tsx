import { Link } from "react-router-dom";

const styles = `
  :root {
    --bg:        #F7F6F3;
    --surface:   #FFFFFF;
    --sidebar:   #111110;
    --gold:      #C9A84C;
    --text-1:    #111110;
    --text-2:    #6B6A66;
    --text-3:    #A09F9A;
    --border:    #E8E6E1;
    --font-display: 'Fraunces', Georgia, serif;
    --font-body:    'DM Sans', system-ui, sans-serif;
  }

  .fp-shell { min-height: 100vh; display: flex; font-family: var(--font-body); }
  .fp-left {
    width: 420px; flex-shrink: 0; background: var(--sidebar);
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 48px 44px;
  }
  .fp-logo { display: flex; align-items: center; gap: 10px; font-family: var(--font-display); font-size: 18px; font-weight: 300; color: #fff; }
  .fp-logo span { color: var(--gold); }
  .fp-logo-dot { width: 28px; height: 28px; border-radius: 8px; background: var(--gold); display: flex; align-items: center; justify-content: center; font-size: 15px; }
  .fp-hero { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .fp-hero h2 { font-family: var(--font-display); font-size: 36px; font-weight: 300; color: #fff; line-height: 1.25; margin-bottom: 16px; }
  .fp-hero h2 em { font-style: italic; color: var(--gold); }
  .fp-hero p { font-size: 14px; color: #888887; line-height: 1.7; max-width: 280px; }
  .fp-footer { font-size: 12px; color: #444443; }
  .fp-right { flex: 1; background: var(--bg); display: flex; align-items: center; justify-content: center; padding: 48px 40px; }
  .fp-wrap { width: 100%; max-width: 380px; }
  .eyebrow { font-size: 11px; font-weight: 500; color: var(--text-3); letter-spacing: .08em; text-transform: uppercase; margin-bottom: 8px; }
  .fp-wrap h1 { font-family: var(--font-display); font-size: 26px; font-weight: 300; color: var(--text-1); margin-bottom: 10px; }
  .fp-wrap .sub { font-size: 14px; color: var(--text-2); line-height: 1.6; margin-bottom: 24px; }
  .fp-banner { background: #F5EDD6; border: 1px solid var(--gold); color: #7A5E1A; border-radius: 10px; padding: 12px 14px; font-size: 13px; line-height: 1.5; margin-bottom: 24px; }
  .fp-back { font-size: 13px; color: var(--gold); text-decoration: none; font-weight: 500; }
  .fp-back:hover { text-decoration: underline; }
`;

export default function ForgotPassword() {
  return (
    <>
      <style>{styles}</style>
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
    </>
  );
}
