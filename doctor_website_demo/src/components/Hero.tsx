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

import { Link } from "react-router-dom";
import { BookOpen, CalendarDays, GraduationCap, Award, MapPin, Clock } from "lucide-react";


import "../styles/landing.css";
// ─── Navbar (shared across all three sections) ────────────────────────────────



// ─── Hero ─────────────────────────────────────────────────────────────────────

export function Hero() {
  return (
    <>
      
      <div className="lp-shell">
        <nav className="lp-nav">
          <Link to="/" className="lp-nav-logo">
            <div className="lp-nav-logo-dot">✚</div>
            Dr MedLearn <span>CME</span>
          </Link>
          <div className="lp-nav-links">
            <a href="#about" className="lp-nav-link">About</a>
            <a href="#doctor" className="lp-nav-link">Faculty</a>
            <Link to="/login" className="lp-nav-link">Sign in</Link>
            <Link to="/register" className="lp-nav-cta">Register</Link>
          </div>
        </nav>
        

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