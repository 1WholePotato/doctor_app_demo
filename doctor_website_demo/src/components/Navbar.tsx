import { BookOpen, CalendarDays, GraduationCap, Award, MapPin, Clock } from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";
// ─── Shared styles ────────────────────────────────────────────────────────────

const styles = `
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

  /* ── Navbar ── */
  .lp-nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 50;
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 48px;
    background: rgba(15,30,53,.85); backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255,255,255,.06);
  }
  .lp-nav-logo { display: flex; align-items: center; gap: 10px; font-family: var(--font-display); font-size: 17px; font-weight: 300; color: #fff; text-decoration: none; }
  .lp-nav-logo-dot { width: 26px; height: 26px; border-radius: 7px; background: var(--gold); display: flex; align-items: center; justify-content: center; font-size: 13px; color: #fff; }
  .lp-nav-logo span { color: var(--gold); }
  .lp-nav-links { display: flex; align-items: center; gap: 32px; }
  .lp-nav-link { font-size: 14px; color: rgba(255,255,255,.6); text-decoration: none; transition: color .15s; }
  .lp-nav-link:hover { color: #fff; }
  .lp-nav-cta { background: var(--gold); color: #fff; padding: 9px 20px; border-radius: 9px; font-size: 14px; font-weight: 500; text-decoration: none; transition: opacity .15s; }
  .lp-nav-cta:hover { opacity: .85; }

  /* ──────────────────────────────────────────────────────────────────────────── */
  /* HERO                                                                         */
  /* ──────────────────────────────────────────────────────────────────────────── */
  .hero-section {
    min-height: 100vh; background: var(--navy);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 120px 24px 80px; text-align: center; position: relative; overflow: hidden;
  }

  /* Background grain texture */
  .hero-section::before {
    content: ""; position: absolute; inset: 0;
    background-image: radial-gradient(circle at 20% 50%, rgba(201,168,76,.08) 0%, transparent 50%),
                      radial-gradient(circle at 80% 20%, rgba(43,100,160,.1) 0%, transparent 40%);
    pointer-events: none;
  }

  .hero-eyebrow {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(201,168,76,.12); border: 1px solid rgba(201,168,76,.25);
    color: var(--gold); font-size: 12px; font-weight: 500; letter-spacing: .08em;
    text-transform: uppercase; padding: 6px 16px; border-radius: 20px;
    margin-bottom: 28px;
    animation: fadeUp .5s ease .1s both;
  }
  .hero-eyebrow span { width: 6px; height: 6px; border-radius: 50%; background: var(--gold); }

  .hero-h1 {
    font-family: var(--font-display); font-size: clamp(36px, 6vw, 72px);
    font-weight: 300; color: #fff; line-height: 1.1; letter-spacing: -.02em;
    max-width: 800px; margin: 0 auto 24px;
    animation: fadeUp .5s ease .2s both;
  }
  .hero-h1 em { font-style: italic; color: var(--gold); }

  .hero-sub {
    font-size: clamp(15px, 1.8vw, 18px); color: rgba(255,255,255,.55);
    line-height: 1.7; max-width: 520px; margin: 0 auto 40px;
    animation: fadeUp .5s ease .3s both;
  }

  .hero-actions {
    display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap;
    animation: fadeUp .5s ease .4s both;
  }
  .hero-btn-primary {
    background: var(--gold); color: #fff; padding: 14px 32px; border-radius: 10px;
    font-size: 15px; font-weight: 500; text-decoration: none;
    transition: opacity .15s, transform .15s; display: inline-block;
  }
  .hero-btn-primary:hover { opacity: .88; transform: translateY(-1px); }
  .hero-btn-ghost {
    background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.15);
    color: rgba(255,255,255,.8); padding: 14px 28px; border-radius: 10px;
    font-size: 15px; font-weight: 400; text-decoration: none;
    transition: background .15s;
  }
  .hero-btn-ghost:hover { background: rgba(255,255,255,.12); }

  /* Stats strip */
  .hero-stats {
    display: flex; align-items: center; justify-content: center; gap: 48px;
    margin-top: 72px; flex-wrap: wrap;
    animation: fadeUp .5s ease .5s both;
  }
  .hero-stat { text-align: center; }
  .hero-stat-val { font-family: var(--font-display); font-size: 36px; font-weight: 300; color: #fff; line-height: 1; }
  .hero-stat-val em { font-style: normal; color: var(--gold); }
  .hero-stat-label { font-size: 12px; color: rgba(255,255,255,.4); margin-top: 6px; letter-spacing: .05em; text-transform: uppercase; }
  .hero-stat-divider { width: 1px; height: 40px; background: rgba(255,255,255,.1); }

  /* Scroll cue */
  .scroll-cue {
    position: absolute; bottom: 32px; left: 50%; transform: translateX(-50%);
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    color: rgba(255,255,255,.3); font-size: 11px; letter-spacing: .08em; text-transform: uppercase;
    animation: fadeUp .5s ease .7s both;
  }
  .scroll-cue-line { width: 1px; height: 40px; background: linear-gradient(to bottom, rgba(255,255,255,.3), transparent); animation: scrollPulse 2s ease infinite; }
  @keyframes scrollPulse { 0%,100%{opacity:.3;transform:scaleY(1)} 50%{opacity:.7;transform:scaleY(1.1)} }

  /* ──────────────────────────────────────────────────────────────────────────── */
  /* ABOUT WEBSITE                                                                */
  /* ──────────────────────────────────────────────────────────────────────────── */
  .about-section {
    background: var(--bg); padding: 100px 24px;
  }
  .about-inner { max-width: 1040px; margin: 0 auto; }
  .section-eyebrow { font-size: 11px; font-weight: 500; color: var(--gold); letter-spacing: .1em; text-transform: uppercase; margin-bottom: 12px; }
  .section-h2 { font-family: var(--font-display); font-size: clamp(28px, 4vw, 44px); font-weight: 300; color: var(--text-1); line-height: 1.2; letter-spacing: -.01em; margin-bottom: 16px; }
  .section-sub { font-size: 16px; color: var(--text-2); line-height: 1.7; max-width: 560px; margin-bottom: 60px; }

  .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
  .feature-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
    padding: 28px; display: flex; flex-direction: column; gap: 14px;
    transition: transform .15s, box-shadow .15s;
  }
  .feature-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,.07); }
  .feature-icon { width: 44px; height: 44px; border-radius: 12px; background: var(--gold-soft); display: flex; align-items: center; justify-content: center; }
  .feature-icon svg { width: 22px; height: 22px; color: var(--gold); }
  .feature-title { font-size: 16px; font-weight: 600; color: var(--text-1); }
  .feature-desc { font-size: 14px; color: var(--text-2); line-height: 1.65; }

  /* ──────────────────────────────────────────────────────────────────────────── */
  /* ABOUT DOCTOR                                                                 */
  /* ──────────────────────────────────────────────────────────────────────────── */
  .doctor-section { background: var(--navy); padding: 100px 24px; }
  .doctor-inner { max-width: 1040px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center; }
  .doctor-left .section-eyebrow { color: var(--gold); }
  .doctor-left .section-h2 { color: #fff; }
  .doctor-left .section-sub { color: rgba(255,255,255,.5); margin-bottom: 32px; }
  .doctor-credentials { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 36px; }
  .cred-badge { display: flex; align-items: center; gap: 7px; background: rgba(201,168,76,.1); border: 1px solid rgba(201,168,76,.2); color: var(--gold); font-size: 12px; font-weight: 500; padding: 6px 14px; border-radius: 8px; }
  .cred-badge svg { width: 14px; height: 14px; }
  .doctor-cta { display: inline-flex; align-items: center; gap: 8px; background: var(--gold); color: #fff; padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: 500; text-decoration: none; transition: opacity .15s; }
  .doctor-cta:hover { opacity: .85; }

  /* Doctor card (right side) */
  .doctor-card { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 18px; padding: 32px; }
  .doctor-avatar { width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, var(--gold), #a07830); display: flex; align-items: center; justify-content: center; font-family: var(--font-display); font-size: 28px; font-weight: 300; color: #fff; margin-bottom: 20px; }
  .doctor-name { font-family: var(--font-display); font-size: 22px; font-weight: 300; color: #fff; margin-bottom: 4px; }
  .doctor-title { font-size: 13px; color: rgba(255,255,255,.4); margin-bottom: 20px; }
  .doctor-divider { height: 1px; background: rgba(255,255,255,.08); margin-bottom: 20px; }
  .doctor-meta { display: flex; flex-direction: column; gap: 10px; }
  .doctor-meta-row { display: flex; align-items: center; gap: 10px; font-size: 13px; color: rgba(255,255,255,.55); }
  .doctor-meta-row svg { width: 15px; height: 15px; color: var(--gold); flex-shrink: 0; }

  @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }

  @media (max-width: 768px) {
    .lp-nav { padding: 16px 20px; }
    .lp-nav-links { display: none; }
    .hero-stats { gap: 24px; }
    .hero-stat-divider { display: none; }
    .doctor-inner { grid-template-columns: 1fr; }
  }
`;

// ─── Navbar (shared across all three sections) ────────────────────────────────

function LandingNav() {
  return (
    <nav className="lp-nav">
      <Link to="/" className="lp-nav-logo">
        <div className="lp-nav-logo-dot">✚</div>
        Dr <span>MedLearn</span>
      </Link>
      <div className="lp-nav-links">
        <a href="#about"  className="lp-nav-link">Platform</a>
        <a href="#doctor" className="lp-nav-link">About</a>
        <Link to="/login" className="lp-nav-link">Sign in</Link>
        <Link to="/register" className="lp-nav-cta">Get started</Link>
      </div>
    </nav>
  );
}

