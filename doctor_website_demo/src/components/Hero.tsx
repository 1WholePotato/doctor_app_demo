import { Link } from "react-router-dom";
import { BookOpen, CalendarDays, GraduationCap, Award, MapPin, Clock } from "lucide-react";

import "../styles/landing.css";
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
            <Link to="/login" className="lp-nav-link lp-nav-signin">Sign in</Link>
            <Link to="/register" className="lp-nav-cta">Register</Link>
          </div>
        </nav>
        

        <section className="hero-section">
          <span className="hero-eyebrow">
            <span />
            Medical education platform demo
          </span>

          <h1 className="hero-h1">
            Expert-led courses for<br />
            <em>healthcare professionals.</em>
          </h1>

          <p className="hero-sub">
            Explore the course platform demo. Online booking, enrollment, and
            payment are not available.
          </p>

          <div className="hero-actions">
            <Link to="/register" className="hero-btn-primary">Create account</Link>
            <a href="#about" className="hero-btn-ghost">Learn more</a>
          </div>

          <div className="hero-stats">
            <div className="hero-stat">
              <p className="hero-stat-val">1,<em>284</em></p>
              <p className="hero-stat-label">Sample students</p>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <p className="hero-stat-val"><em>32</em></p>
              <p className="hero-stat-label">Sample courses</p>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <p className="hero-stat-val"><em>4.9</em> ★</p>
              <p className="hero-stat-label">Sample rating</p>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <p className="hero-stat-val"><em>CPD</em></p>
              <p className="hero-stat-label">Demo preview</p>
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
      title: "Course catalog preview",
      desc: "Explore course descriptions and session information in a demonstration learning platform.",
    },
    {
      icon: CalendarDays,
      title: "Session information",
      desc: "Preview dates and locations for course sessions. Online booking and payment are disabled, so no booking confirmations are issued.",
    },
    {
      icon: GraduationCap,
      title: "CPD information preview",
      desc: "Sample CPD information illustrates the course layout. This demo does not award points or confirm accreditation.",
    },
  ];

  return (
    <section id="about" className="about-section">
      <div className="about-inner">
        <p className="section-eyebrow">The platform</p>
        <h2 className="section-h2">Everything you need to<br />keep learning.</h2>
        <p className="section-sub">
          Explore course and instructor pages in this platform demo. Online
          enrollment and payment are not available.
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
          <p className="section-eyebrow">Example instructor</p>
          <h2 className="section-h2">Meet the doctor<br />behind the courses.</h2>
          <p className="section-sub">
            This example instructor profile illustrates how faculty experience
            and qualifications appear on the platform.
          </p>

          <div className="doctor-credentials">
            <span className="cred-badge"><Award />MBChB (UCT)</span>
            <span className="cred-badge"><Award />Fellowship CMSA</span>
            <span className="cred-badge"><Award />SANC Accredited</span>
            <span className="cred-badge"><Award />20+ years practice</span>
          </div>

          <Link to="/register" className="doctor-cta">
            <BookOpen size={16} /> Create an account
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
                Example schedule across 3 cities
              </div>
              <div className="doctor-meta-row">
                <GraduationCap />
                Sample total of 1,284 students
              </div>
              <div className="doctor-meta-row">
                <BookOpen />
                32 sample courses in this demo
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
