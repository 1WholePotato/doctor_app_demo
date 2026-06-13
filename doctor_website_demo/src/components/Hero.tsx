/**
 * Landing page components — Hero, AboutWebsite, AboutDoctor
 *
 * All three live in one file since they compose a single public landing page.
 *
 * DESIGN:
 * - Matches the admin gold/dark token system (same brand as Login & Register)
 * - Hero: full-screen dark navy with gold headline, animated scroll cue
 * - AboutWebsite: off-white section with 3 feature cards
 * - AboutDoctor: dark section with a doctor profile card + credential badges
 *
 * CHANGES FROM ORIGINALS:
 * 1. Replaced placeholder text with realistic medical platform copy.
 * 2. Hero CTA navigates to /register; secondary link to /login.
 * 3. Smooth scroll to #about and #doctor anchor sections.
 * 4. Animated stat counters (CSS only) in the hero.
 * 5. Feature cards in AboutWebsite with icons (no extra packages — Unicode symbols).
 * 6. Doctor credentials badges in AboutDoctor.
 * 7. No new npm packages needed. lucide-react used for icons.
 *
 * NPM: lucide-react (already installed)
 * Google Fonts: Fraunces + DM Sans (already in index.css)
 *
 * USAGE in Home.tsx:
 *   import Hero from "./Hero";
 *   import AboutWebsite from "./AboutWebsite";
 *   import AboutDoctor from "./AboutDoctor";
 *   export default function Home() {
 *     return <><Hero /><AboutWebsite /><AboutDoctor /></>;
 *   }
 */

import React from "react";
import { Link } from "react-router-dom";
import { BookOpen, CalendarDays, GraduationCap, Award, MapPin, Clock } from "lucide-react";

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



// ─── Hero ─────────────────────────────────────────────────────────────────────

export function Hero() {
  return (
    <>
      <style>{styles}</style>
      <div className="lp-shell">
        

        <section className="hero-section">
          <span className="hero-eyebrow">
            <span />
            Continuing Medical Education Platform
          </span>

          <h1 className="hero-h1">
            Expert-led courses for<br />
            <em>healthcare professionals.</em>
          </h1>

          <p className="hero-sub">
            Book sessions, earn CPD points, and advance your clinical skills — 
            all managed in one place by Dr MedLearn.
          </p>

          <div className="hero-actions">
            <Link to="/register" className="hero-btn-primary">Make a booking</Link>
            <a href="#about" className="hero-btn-ghost">Learn more</a>
          </div>

          <div className="hero-stats">
            <div className="hero-stat">
              <p className="hero-stat-val">1,<em>284</em></p>
              <p className="hero-stat-label">Students enrolled</p>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <p className="hero-stat-val"><em>32</em></p>
              <p className="hero-stat-label">Active courses</p>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <p className="hero-stat-val"><em>4.9</em> ★</p>
              <p className="hero-stat-label">Average rating</p>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <p className="hero-stat-val"><em>CPD</em></p>
              <p className="hero-stat-label">Points accredited</p>
            </div>
          </div>

          <div className="scroll-cue">
            <div className="scroll-cue-line" />
            Scroll
          </div>
        </section>
      </div>
    </>
  );
}

// ─── About Website ────────────────────────────────────────────────────────────

export function AboutWebsite() {
  const features = [
    {
      icon: BookOpen,
      title: "Expert-curated courses",
      desc: "All content is developed and reviewed by qualified medical professionals, ensuring clinical accuracy and real-world applicability.",
    },
    {
      icon: CalendarDays,
      title: "Flexible session booking",
      desc: "Choose from multiple dates and locations per course. Book your spot in seconds and receive instant confirmation.",
    },
    {
      icon: GraduationCap,
      title: "CPD point accreditation",
      desc: "Every course is accredited for Continuing Professional Development points, keeping your SANC registration up to date.",
    },
  ];

  return (
    <section id="about" className="about-section">
      <div className="about-inner">
        <p className="section-eyebrow">The platform</p>
        <h2 className="section-h2">Everything you need to<br />keep learning.</h2>
        <p className="section-sub">
          A purpose-built platform for healthcare professionals who want structured,
          accredited learning without the administrative overhead.
        </p>

        <div className="features-grid">
          {features.map((f) => (
            <div className="feature-card" key={f.title}>
              <div className="feature-icon"><f.icon /></div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── About Doctor ─────────────────────────────────────────────────────────────

export function AboutDoctor() {
  return (
    <section id="doctor" className="doctor-section">
      <div className="doctor-inner">

        {/* Left: copy */}
        <div className="doctor-left">
          <p className="section-eyebrow">Your instructor</p>
          <h2 className="section-h2">Meet the doctor<br />behind the courses.</h2>
          <p className="section-sub">
            With over 20 years of clinical and teaching experience, Dr MedLearn has
            trained hundreds of healthcare professionals across South Africa.
          </p>

          <div className="doctor-credentials">
            <span className="cred-badge"><Award />MBChB (UCT)</span>
            <span className="cred-badge"><Award />Fellowship CMSA</span>
            <span className="cred-badge"><Award />SANC Accredited</span>
            <span className="cred-badge"><Award />20+ years practice</span>
          </div>

          <Link to="/register" className="doctor-cta">
            <BookOpen size={16} /> Enrol in a course
          </Link>
        </div>

        {/* Right: profile card */}
        <div>
          <div className="doctor-card">
            <div className="doctor-avatar">Dr</div>
            <p className="doctor-name">Dr A. MedLearn</p>
            <p className="doctor-title">MB ChB · Fellow CMSA · SANC Registered Educator</p>
            <div className="doctor-divider" />
            <div className="doctor-meta">
              <div className="doctor-meta-row">
                <MapPin />
                Cape Town, South Africa — sessions nationwide
              </div>
              <div className="doctor-meta-row">
                <Clock />
                Courses run monthly across 3 cities
              </div>
              <div className="doctor-meta-row">
                <GraduationCap />
                1,284 students trained to date
              </div>
              <div className="doctor-meta-row">
                <BookOpen />
                32 active accredited courses
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}

// ─── Default export: full landing page ───────────────────────────────────────

export default function Home() {
  return (
    <>
      <Hero />
      <AboutWebsite />
      <AboutDoctor />
    </>
  );
}