/**
 * Register.tsx — Production-grade Registration Page
 *
 * CHANGES FROM ORIGINAL:
 * 1. Split layout — dark left branding panel (same as Login) + white right form.
 * 2. Multi-step form — 3 steps so the long form doesn't overwhelm.
 *    Step 1: Personal info (name, email, password, birth date)
 *    Step 2: ID verification (SA citizen toggle → ID number or passport)
 *    Step 3: Contact & professional (cell, SANC number)
 * 3. Progress indicator at the top of the form showing which step you're on.
 * 4. Inline field validation — required fields checked before moving to next step.
 * 5. SA citizen toggle redesigned — pill toggle instead of a raw checkbox.
 * 6. All Supabase logic kept intact, no changes to the submit handler.
 * 7. Same CSS token system as Login.tsx — no new packages.
 *
 * NPM: none (lucide-react already installed but not needed here)
 * Google Fonts: Fraunces + DM Sans (already in index.css)
 */

import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "../supabaseClient";
import { useNavigate, Link } from "react-router-dom";
import { resolveStudentRoleId } from "../lib/roles";
import { authErrorMessage } from "../lib/auth";

// ─── Styles ───────────────────────────────────────────────────────────────────

import "../styles/auth.css";

const STEP_LABELS = ["Personal", "Identity", "Contact"];

export default function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState("");

  // Form state
  const [first_name,    setFirstname]   = useState("");
  const [last_name,     setLastname]    = useState("");
  const [email,         setEmail]       = useState("");
  const [password,      setPassword]    = useState("");
  const [showPassword,  setShowPassword] = useState(false);
  const [birth_date,    setBirthdate]   = useState("");
  const [id_num,        setIdnum]       = useState("");
  const [passport_num,  setpassportNum] = useState("");
  const [cell_num,      setCellNum]     = useState("");
  const [sanc_num,      setSancNum]     = useState("");
  const [isCiti,        setIsCiti]      = useState(true);

  // Per-field errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setErr = (key: string, msg: string) =>
    setErrors((p) => ({ ...p, [key]: msg }));
  const clearErr = (key: string) =>
    setErrors((p) => { const n = { ...p }; delete n[key]; return n; });

  // ── Step validation ──────────────────────────────────────────────────────────

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!first_name.trim()) e.first_name = "Required";
    if (!last_name.trim())  e.last_name  = "Required";
    if (!email.trim())      e.email      = "Required";
    if (password.length < 6) e.password  = "Minimum 6 characters";
    if (!birth_date)        e.birth_date = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e: Record<string, string> = {};
    if (isCiti && !id_num.trim())       e.id_num      = "Required for SA citizens";
    if (!isCiti && !passport_num.trim()) e.passport_num = "Required for non-citizens";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    setBanner("");
    if (step === 1 && validateStep1()) setStep(2);
    if (step === 2 && validateStep2()) setStep(3);
  };

  // ── Submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner("");

    if (!cell_num.trim()) { setErr("cell_num", "Required"); return; }

    setLoading(true);
    try {
      const studentRoleId = await resolveStudentRoleId();
      if (!studentRoleId) {
        setBanner("Student role is not configured. Add a student role in the database before accepting registrations.");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            birth_date,
            id_num: id_num.trim() || null,
            passport_num: passport_num.trim() || null,
            cell_num: cell_num.trim(),
            sanc_num: sanc_num.trim() || null,
          },
        },
      });

      if (error) {
        setBanner(authErrorMessage(error));
        return;
      }
      if (!data.user) {
        setBanner("The account service did not return a new user. Please try again.");
        return;
      }

      const { error: insertError } = await supabase.from("users").upsert({
        id: data.user.id,
        role_id: studentRoleId,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        birth_date,
        id_num: id_num.trim() || null,
        passport_num: passport_num.trim() || null,
        cell_num: cell_num.trim(),
        email: data.user.email ?? email.trim(),
        sanc_num: sanc_num.trim() || null,
        active: true,
      });

      if (insertError) {
        setBanner(`Your account was created, but its student profile could not be saved: ${authErrorMessage(insertError)} Please contact support before signing in.`);
        return;
      }

      if (!data.session) {
        setBanner("Account created. Check your email to confirm it before signing in.");
        return;
      }
      navigate("/login", { state: { registered: true } });
    } catch (error) {
      setBanner(authErrorMessage(error instanceof Error ? error : {}));
    } finally {
      setLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="reg-shell">

        {/* ── Left branding panel ── */}
        <div className="reg-left">
          <div className="reg-logo">
            <div className="reg-logo-dot">✚</div>
            Dr <span>Admin</span>
          </div>

          <div className="reg-hero">
            <h2>Join the<br /><em>platform.</em></h2>
            <p>Create your student account to browse courses, book sessions, and track your progress.</p>

            <div className="reg-steps-preview">
              {STEP_LABELS.map((label, i) => (
                <div className="rsp-item" key={label}>
                  <div className={`rsp-num${step > i + 1 ? " done" : ""}`}>{i + 1}</div>
                  <span className={`rsp-label${step > i + 1 ? " done" : ""}`}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="reg-footer">© 2026 Dr Admin. All rights reserved.</p>
        </div>

        {/* ── Right form panel ── */}
        <div className="reg-right">
          <div className="reg-form-wrap">
            <p className="eyebrow">Create account</p>
            <h1>Step {step} of 3</h1>
            <p className="sub">{["Personal information", "Identity verification", "Contact & professional"][step - 1]}</p>

            {/* Progress bar */}
            <div className="progress-track">
              {STEP_LABELS.map((label, i) => (
                <React.Fragment key={label}>
                  <div className="progress-step">
                    <div className={`progress-circle${step === i + 1 ? " active" : step > i + 1 ? " complete" : ""}`}>
                      {step > i + 1 ? "✓" : i + 1}
                    </div>
                    <span className={`progress-label${step === i + 1 ? " active" : ""}`}>{label}</span>
                  </div>
                  {i < STEP_LABELS.length - 1 && (
                    <div className={`progress-line${step > i + 1 ? " done" : ""}`} />
                  )}
                </React.Fragment>
              ))}
            </div>

            {banner && <div className="rf-banner" role="alert">⚠ {banner}</div>}

            <form onSubmit={handleSubmit}>

              {/* ── Step 1: Personal ── */}
              {step === 1 && (
                <div className="step-wrap">
                  <div className="rf-row">
                    <div className="rf-field">
                      <label htmlFor="reg-first-name">First name</label>
                      <input id="reg-first-name" type="text" value={first_name} placeholder="Jane"
                        className={errors.first_name ? "err" : ""}
                        onChange={(e) => { setFirstname(e.target.value); clearErr("first_name"); }} />
                      {errors.first_name && <span className="rf-error" role="alert">⚠ {errors.first_name}</span>}
                    </div>
                    <div className="rf-field">
                      <label htmlFor="reg-last-name">Last name</label>
                      <input id="reg-last-name" type="text" value={last_name} placeholder="Smith"
                        className={errors.last_name ? "err" : ""}
                        onChange={(e) => { setLastname(e.target.value); clearErr("last_name"); }} />
                      {errors.last_name && <span className="rf-error" role="alert">⚠ {errors.last_name}</span>}
                    </div>
                  </div>
                  <div className="rf-field">
                    <label htmlFor="reg-email">Email</label>
                    <input id="reg-email" type="email" value={email} placeholder="you@example.com"
                      className={errors.email ? "err" : ""}
                      onChange={(e) => { setEmail(e.target.value); clearErr("email"); }} />
                    {errors.email && <span className="rf-error" role="alert">⚠ {errors.email}</span>}
                  </div>
                  <div className="rf-field">
                    <label htmlFor="reg-password">Password</label>
                    <div style={{ position: "relative" }}>
                      <input id="reg-password" type={showPassword ? "text" : "password"} value={password} placeholder="Min. 6 characters"
                        className={errors.password ? "err" : ""}
                        style={{ paddingRight: "40px", width: "100%" }}
                        onChange={(e) => { setPassword(e.target.value); clearErr("password"); }} />
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
                          color: "var(--text-3)",
                          display: "flex",
                          alignItems: "center",
                          padding: 0,
                        }}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {errors.password && <span className="rf-error" role="alert">⚠ {errors.password}</span>}
                  </div>
                  <div className="rf-field">
                    <label htmlFor="reg-birth-date">Date of birth</label>
                    <input id="reg-birth-date" type="date" value={birth_date}
                      className={errors.birth_date ? "err" : ""}
                      onChange={(e) => { setBirthdate(e.target.value); clearErr("birth_date"); }} />
                    {errors.birth_date && <span className="rf-error" role="alert">⚠ {errors.birth_date}</span>}
                  </div>
                  <div className="rf-nav">
                    <button type="button" className="rf-next" onClick={handleNext}>Continue →</button>
                  </div>
                </div>
              )}

              {/* ── Step 2: Identity ── */}
              {step === 2 && (
                <div className="step-wrap">
                  <div className="rf-field">
                    <label>Are you a South African citizen?</label>
                    <div className="citi-toggle">
                      <button type="button" className={`citi-opt${isCiti ? " active" : ""}`} onClick={() => setIsCiti(true)}>
                        Yes, SA citizen
                      </button>
                      <button type="button" className={`citi-opt${!isCiti ? " active" : ""}`} onClick={() => setIsCiti(false)}>
                        No, foreign national
                      </button>
                    </div>
                  </div>

                  {isCiti ? (
                    <div className="rf-field">
                      <label htmlFor="reg-id-number">SA ID number</label>
                      <input id="reg-id-number" type="text" value={id_num} placeholder="13-digit ID number"
                        className={errors.id_num ? "err" : ""}
                        onChange={(e) => { setIdnum(e.target.value); clearErr("id_num"); }} />
                      {errors.id_num && <span className="rf-error" role="alert">⚠ {errors.id_num}</span>}
                    </div>
                  ) : (
                    <div className="rf-field">
                      <label htmlFor="reg-passport-number">Passport number</label>
                      <input id="reg-passport-number" type="text" value={passport_num} placeholder="e.g. A12345678"
                        className={errors.passport_num ? "err" : ""}
                        onChange={(e) => { setpassportNum(e.target.value); clearErr("passport_num"); }} />
                      {errors.passport_num && <span className="rf-error" role="alert">⚠ {errors.passport_num}</span>}
                    </div>
                  )}

                  <div className="rf-nav">
                    <button type="button" className="rf-back" onClick={() => setStep(1)}>← Back</button>
                    <button type="button" className="rf-next" onClick={handleNext}>Continue →</button>
                  </div>
                </div>
              )}

              {/* ── Step 3: Contact ── */}
              {step === 3 && (
                <div className="step-wrap">
                  <div className="rf-field">
                    <label htmlFor="reg-cell-number">Cell number</label>
                    <input id="reg-cell-number" type="tel" value={cell_num} placeholder="+27 82 000 0000"
                      className={errors.cell_num ? "err" : ""}
                      onChange={(e) => { setCellNum(e.target.value); clearErr("cell_num"); }} />
                    {errors.cell_num && <span className="rf-error" role="alert">⚠ {errors.cell_num}</span>}
                  </div>
                  <div className="rf-field">
                    <label htmlFor="reg-sanc-number">HPCSA/SANC Number <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
                    <input id="reg-sanc-number" type="text" value={sanc_num} placeholder="e.g. 12345678"
                      onChange={(e) => setSancNum(e.target.value)} />
                  </div>

                  <div className="rf-nav">
                    <button type="button" className="rf-back" onClick={() => setStep(2)}>← Back</button>
                    <button type="submit" className="rf-next" disabled={loading}>
                      {loading ? "Creating account…" : "Create account"}
                    </button>
                  </div>
                </div>
              )}

            </form>

            <p className="rf-footer">
              Already have an account?
              <Link to="/login">Sign in here</Link>
            </p>
          </div>
        </div>

      </div>
  );
}
