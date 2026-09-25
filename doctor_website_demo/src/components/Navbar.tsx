/**
 * STUB COMPONENT: Navbar (LandingNav)
 * NOTE: Tracked under Issue #5 for frontend public navigation.
 * Retained until final public landing layout integration is completed.
 */
import { Link } from "react-router-dom";
// ─── Shared styles ───────────────────────────────────────────────────────────

export const styles = `
  :root {
    --bg:           #F7F6F3;
    --surface:      #FFFFFF;
    --navy:         #0F1E35;
    --gold:         #C9A84C;
    --gold-soft:    #F5EDD6;
    --text-1:       #111110;
    --text-2:       #6B6A66;
    --text-3:       #A09F9A;
    --border:       #E8E6E1;
    --font-display: 'Fraunces', Georgia, serif;
    --font-body:    'DM Sans', system-ui, sans-serif;
  }

  .lp-shell * { box-sizing: border-box; margin: 0; padding: 0; }
  .lp-shell { font-family: var(--font-body); }

  /* ─── Navbar ─── */
  .lp-nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 50;
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 48px;
    background: rgba(15,30,53,0.92);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255,255,255,0.07);
    transition: background 0.2s;
  }
  .lp-logo {
    display: flex; align-items: center; gap: 10px;
    text-decoration: none;
  }
  .lp-logo-mark {
    width: 32px; height: 32px; border-radius: 8px;
    background: var(--gold); display: flex; align-items: center; justify-content: center;
    font-family: var(--font-display); font-size: 15px; font-weight: 400; color: #111110;
  }
  .lp-logo-text {
    font-family: var(--font-display); font-size: 18px; font-weight: 300;
    color: #fff; letter-spacing: 0.01em;
  }
  .lp-logo-text span { color: var(--gold); }
  .lp-nav-links { display: flex; align-items: center; gap: 32px; }
  .lp-nav-link {
    color: rgba(255,255,255,0.7); font-size: 14px; font-weight: 400;
    text-decoration: none; transition: color 0.15s;
  }
  .lp-nav-link:hover { color: #fff; }
  .lp-nav-cta {
    background: var(--gold); color: #111110;
    padding: 9px 20px; border-radius: 8px;
    font-size: 13px; font-weight: 500; text-decoration: none;
    transition: background 0.15s, transform 0.15s;
    letter-spacing: 0.01em;
  }
  .lp-nav-cta:hover { background: #d4b55e; transform: translateY(-1px); }

  /* ─── Hero ─── */
  .hero-section {
    min-height: 100vh; background: var(--navy);
    display: flex; flex-direction: column; justify-content: center;
    padding: 120px 48px 80px; position: relative; overflow: hidden;
  }
  /* subtle radial background glow */
  .hero-section::before {
    content: ''; position: absolute; top: 20%; left: 50%;
    transform: translate(-50%, -50%);
    width: 800px; height: 500px;
    background: radial-gradient(ellipse, rgba(201,168,76,0.07) 0%, transparent 70%);
    pointer-events: none;
  }
  .hero-inner { max-width: 900px; margin: 0 auto; text-align: center; position: relative; z-index: 1; }
  .hero-eyebrow {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 14px; border-radius: 20px;
    background: rgba(201,168,76,0.12); border: 1px solid rgba(201,168,76,0.25);
    color: var(--gold); font-size: 12px; font-weight: 500;
    letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 28px;
  }
  .hero-eyebrow-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--gold); }
  .hero-title {
    font-family: var(--font-display); font-size: clamp(40px, 6vw, 68px);
    font-weight: 300; color: #fff; line-height: 1.1;
    letter-spacing: -0.02em; margin-bottom: 24px;
  }
  .hero-title em { font-style: italic; color: var(--gold); }
  .hero-sub {
    font-size: clamp(16px, 2vw, 19px); font-weight: 300;
    color: rgba(255,255,255,0.65); line-height: 1.65;
    max-width: 620px; margin: 0 auto 40px;
  }
  .hero-actions { display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 64px; }
  .hero-btn-primary {
    background: var(--gold); color: #111110;
    padding: 14px 32px; border-radius: 10px;
    font-size: 15px; font-weight: 500; text-decoration: none;
    transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
    letter-spacing: 0.01em;
  }
  .hero-btn-primary:hover {
    background: #d4b55e; transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(201,168,76,0.3);
  }
  .hero-btn-secondary {
    background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.85);
    padding: 14px 28px; border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.12);
    font-size: 15px; font-weight: 400; text-decoration: none;
    transition: background 0.15s, color 0.15s;
  }
  .hero-btn-secondary:hover { background: rgba(255,255,255,0.1); color: #fff; }

  /* stats row */
  .hero-stats {
    display: flex; align-items: center; justify-content: center;
    border-top: 1px solid rgba(255,255,255,0.08);
    padding-top: 40px; max-width: 680px; margin: 0 auto;
  }
  .hero-stat { flex: 1; text-align: center; }
  .hero-stat + .hero-stat { border-left: 1px solid rgba(255,255,255,0.08); }
  .hero-stat-val {
    font-family: var(--font-display); font-size: 32px; font-weight: 300;
    color: #fff; letter-spacing: -0.02em;
  }
  .hero-stat-val em { font-style: normal; color: var(--gold); }
  .hero-stat-label { font-size: 12px; color: rgba(255,255,255,0.45); letter-spacing: 0.04em; text-transform: uppercase; margin-top: 4px; }

  /* scroll cue */
  .hero-scroll {
    position: absolute; bottom: 28px; left: 50%; transform: translateX(-50%);
    color: rgba(255,255,255,0.3); font-size: 11px; letter-spacing: 0.08em;
    text-transform: uppercase; text-decoration: none;
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    transition: color 0.15s;
  }
  .hero-scroll:hover { color: rgba(255,255,255,0.6); }
  .hero-scroll-line { width: 1px; height: 24px; background: rgba(255,255,255,0.15); animation: scrollPulse 2s infinite; }

  /* ─── About Website ─── */
  .about-section {
    padding: 100px 48px; background: var(--bg);
  }
  .about-inner { max-width: 960px; margin: 0 auto; }
  .section-eyebrow {
    font-size: 11px; font-weight: 500; color: var(--text-3);
    letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 12px;
  }
  .section-h2 {
    font-family: var(--font-display); font-size: clamp(28px, 4vw, 42px);
    font-weight: 300; color: var(--text-1); line-height: 1.2;
    letter-spacing: -0.01em; margin-bottom: 16px;
  }
  .section-sub {
    font-size: 16px; color: var(--text-2); line-height: 1.65;
    max-width: 580px; margin-bottom: 56px;
  }

  .features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
  .feature-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 14px; padding: 32px 28px;
    display: flex; flex-direction: column; gap: 14px;
    transition: transform 0.15s, box-shadow 0.15s;
  }
  .feature-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,0.06); }
  .feature-icon {
    width: 44px; height: 44px; border-radius: 11px;
    background: var(--gold-soft); color: #7A5E1A;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px;
  }
  .feature-icon svg { width: 22px; height: 22px; }
  .feature-title { font-family: var(--font-display); font-size: 18px; font-weight: 400; color: var(--text-1); }
  .feature-desc { font-size: 13px; color: var(--text-2); line-height: 1.6; }

  /* ─── About Doctor ─── */
  .doctor-section {
    padding: 100px 48px; background: var(--navy);
    position: relative; overflow: hidden;
  }
  .doctor-inner {
    max-width: 960px; margin: 0 auto;
    display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center;
  }
  .doctor-left .section-eyebrow { color: var(--gold); }
  .doctor-left .section-h2 { color: #fff; }
  .doctor-left .section-sub { color: rgba(255,255,255,0.65); margin-bottom: 32px; }

  .doctor-credentials { display: flex; flex-direction: column; gap: 12px; margin-bottom: 36px; }
  .cred-badge {
    display: inline-flex; align-items: center; gap: 10px;
    font-size: 13px; color: rgba(255,255,255,0.8);
  }
  .cred-badge svg { width: 16px; height: 16px; color: var(--gold); flex-shrink: 0; }

  .doctor-cta {
    display: inline-flex; align-items: center; gap: 8px;
    background: var(--gold); color: #111110;
    padding: 13px 28px; border-radius: 10px;
    font-size: 14px; font-weight: 500; text-decoration: none;
    transition: background 0.15s, transform 0.15s;
  }
  .doctor-cta:hover { background: #d4b55e; transform: translateY(-1px); }

  /* Doctor card / photo placeholder */
  .doctor-card {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 20px; padding: 36px 32px;
    display: flex; flex-direction: column; align-items: center; text-align: center;
  }
  .doctor-avatar {
    width: 96px; height: 96px; border-radius: 50%;
    background: rgba(201,168,76,0.15); border: 2px solid var(--gold);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-display); font-size: 32px; color: var(--gold);
    margin-bottom: 18px;
  }
  .doctor-name { font-family: var(--font-display); font-size: 22px; font-weight: 300; color: #fff; margin-bottom: 4px; }
  .doctor-title { font-size: 13px; color: var(--gold); font-weight: 400; margin-bottom: 16px; letter-spacing: 0.02em; }
  .doctor-divider { width: 40px; height: 1px; background: rgba(255,255,255,0.12); margin-bottom: 16px; }
  .doctor-meta { display: flex; flex-direction: column; gap: 8px; width: 100%; text-align: left; }
  .doctor-meta-row {
    display: flex; align-items: center; gap: 10px;
    font-size: 12px; color: rgba(255,255,255,0.55);
    padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .doctor-meta-row:last-child { border-bottom: none; }
  .doctor-meta-row svg { width: 14px; height: 14px; color: var(--gold); flex-shrink: 0; }

  @keyframes scrollPulse {
    0%, 100% { opacity: 0.2; transform: scaleY(1); }
    50% { opacity: 0.8; transform: scaleY(0.6); }
  }

  /* Responsive */
  @media (max-width: 768px) {
    .lp-nav { padding: 16px 24px; }
    .lp-nav-links { display: none; }
    .hero-section { padding: 100px 24px 60px; }
    .hero-stats { flex-direction: column; gap: 20px; }
    .hero-stat + .hero-stat { border-left: none; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 20px; }
    .features-grid { grid-template-columns: 1fr; }
    .doctor-inner { grid-template-columns: 1fr; }
    .about-section, .doctor-section { padding: 60px 24px; }
  }
`;

export default function LandingNav() {
  return (
    <nav className="lp-nav">
      <Link to="/" className="lp-logo">
        <div className="lp-logo-mark">M</div>
        <span className="lp-logo-text">Dr <span>MedLearn</span></span>
      </Link>
      <div className="lp-nav-links">
        <a href="#about" className="lp-nav-link">Platform</a>
        <a href="#doctor" className="lp-nav-link">About</a>
        <Link to="/login" className="lp-nav-link">Sign in</Link>
        <Link to="/register" className="lp-nav-cta">Get started</Link>
      </div>
    </nav>
  );
}
