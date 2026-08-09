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
import { supabase } from "../supabaseClient";
import { useNavigate, Link } from "react-router-dom";

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = `
  :root {
    --bg:        #F7F6F3;
    --surface:   #FFFFFF;
    --sidebar:   #111110;
    --gold:      #C9A84C;
    --gold-soft: #F5EDD6;
    --text-1:    #111110;
    --text-2:    #6B6A66;
    --text-3:    #A09F9A;
    --border:    #E8E6E1;
    --font-display: 'Fraunces', Georgia, serif;
    --font-body:    'DM Sans', system-ui, sans-serif;
  }

  .reg-shell { min-height: 100vh; display: flex; font-family: var(--font-body); }

  /* ── Left branding panel ── */
  .reg-left {
    width: 380px; flex-shrink: 0; background: var(--sidebar);
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 48px 44px;
  }
  .reg-logo { display: flex; align-items: center; gap: 10px; font-family: var(--font-display); font-size: 18px; font-weight: 300; color: #fff; }
  .reg-logo span { color: var(--gold); }
  .reg-logo-dot { width: 28px; height: 28px; border-radius: 8px; background: var(--gold); display: flex; align-items: center; justify-content: center; font-size: 15px; }
  .reg-hero { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .reg-hero h2 { font-family: var(--font-display); font-size: 32px; font-weight: 300; color: #fff; line-height: 1.3; margin-bottom: 16px; letter-spacing: -.01em; }
  .reg-hero h2 em { font-style: italic; color: var(--gold); }
  .reg-hero p { font-size: 14px; color: #888887; line-height: 1.7; max-width: 260px; }
  .reg-steps-preview { margin-top: 36px; display: flex; flex-direction: column; gap: 12px; }
  .rsp-item { display: flex; align-items: center; gap: 12px; }
  .rsp-num { width: 24px; height: 24px; border-radius: 50%; background: rgba(201,168,76,.2); color: var(--gold); font-size: 11px; font-weight: 600; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .rsp-num.done { background: var(--gold); color: #111110; }
  .rsp-label { font-size: 13px; color: #888887; }
  .rsp-label.done { color: #fff; }
  .reg-footer { font-size: 12px; color: #444443; }

  /* ── Right form panel ── */
  .reg-right { flex: 1; background: var(--bg); display: flex; align-items: center; justify-content: center; padding: 48px 40px; }
  .reg-form-wrap { width: 100%; max-width: 400px; }
  .reg-form-wrap .eyebrow { font-size: 11px; font-weight: 500; color: var(--text-3); letter-spacing: .08em; text-transform: uppercase; margin-bottom: 6px; }
  .reg-form-wrap h1 { font-family: var(--font-display); font-size: 26px; font-weight: 300; color: var(--text-1); margin-bottom: 8px; }
  .reg-form-wrap .sub { font-size: 13px; color: var(--text-3); margin-bottom: 24px; }

  /* Progress bar */
  .progress-track { display: flex; align-items: center; gap: 0; margin-bottom: 28px; }
  .progress-step { display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1; }
  .progress-circle { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; border: 2px solid var(--border); color: var(--text-3); background: var(--surface); transition: all .2s; }
  .progress-circle.active { border-color: var(--text-1); background: var(--text-1); color: #fff; }
  .progress-circle.complete { border-color: var(--gold); background: var(--gold); color: #fff; }
  .progress-label { font-size: 10px; font-weight: 500; color: var(--text-3); text-align: center; letter-spacing: .03em; white-space: nowrap; }
  .progress-label.active { color: var(--text-1); font-weight: 600; }
  .progress-line { flex: 1; height: 2px; background: var(--border); margin-bottom: 20px; max-width: 40px; transition: background .2s; }
  .progress-line.done { background: var(--gold); }

  /* Fields */
  .rf-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
  .rf-field label { font-size: 12px; font-weight: 500; color: var(--text-2); letter-spacing: .04em; text-transform: uppercase; }
  .rf-field input { width: 100%; border: 1px solid var(--border); border-radius: 10px; padding: 11px 14px; font-family: var(--font-body); font-size: 14px; color: var(--text-1); background: var(--surface); outline: none; transition: border-color .15s; }
  .rf-field input:focus { border-color: var(--gold); }
  .rf-field input.err { border-color: #C0392B; }
  .rf-error { font-size: 12px; color: #C0392B; display: flex; align-items: center; gap: 4px; }
  .rf-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

  /* Citizenship toggle */
  .citi-toggle { display: flex; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 4px; margin-bottom: 16px; }
  .citi-opt { flex: 1; padding: 9px; text-align: center; font-size: 13px; font-weight: 500; border-radius: 7px; cursor: pointer; border: none; background: none; font-family: var(--font-body); color: var(--text-3); transition: background .15s, color .15s; }
  .citi-opt.active { background: var(--text-1); color: #fff; }

  /* Nav buttons */
  .rf-nav { display: flex; gap: 10px; margin-top: 4px; }
  .rf-back { flex: 1; background: var(--surface); color: var(--text-2); border: 1px solid var(--border); padding: 12px; border-radius: 10px; font-family: var(--font-body); font-size: 14px; font-weight: 500; cursor: pointer; transition: background .15s; }
  .rf-back:hover { background: var(--border); }
  .rf-next { flex: 2; background: var(--text-1); color: #fff; border: none; padding: 12px; border-radius: 10px; font-family: var(--font-body); font-size: 14px; font-weight: 500; cursor: pointer; transition: background .15s; }
  .rf-next:hover { background: #2a2a28; }
  .rf-next:disabled { background: var(--text-3); cursor: not-allowed; }

  /* Error banner */
  .rf-banner { background: #FEE9E9; border: 1px solid #F5C1C1; border-radius: 10px; padding: 11px 14px; font-size: 13px; color: #A12D2D; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }

  /* Footer */
  .rf-footer { text-align: center; font-size: 13px; color: var(--text-3); margin-top: 18px; }
  .rf-footer a { color: var(--gold); text-decoration: none; margin-left: 4px; }
  .rf-footer a:hover { text-decoration: underline; }

  /* Step fade */
  .step-wrap { animation: stepIn .2s ease; }
  @keyframes stepIn { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } }

  @media (max-width: 768px) { .reg-left { display: none; } .reg-right { background: var(--surface); } }
`;

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

    // 1. Create user in Supabase Auth
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { setBanner(error.message); setLoading(false); return; }

    const user = data.user;
    if (!user) { setBanner("User not created"); setLoading(false); return; }

    // 2. Insert into Users table
    const { error: insertError } = await supabase.from("users").insert([{
      id:           user.id,
      role_id:      "PUT_STUDENT_ROLE_ID_HERE",
      first_name: first_name,
      last_name : last_name,
      birth_date: birth_date,
      id_num:       id_num || null,
      passport_num: passport_num || null,
      cell_num: cell_num,
      email: email,
      sanc_num: sanc_num,
      active:       true,
    }]);

    if (insertError) { setBanner(insertError.message); setLoading(false); return; }

    // 3. Success
    alert("Account created successfully!");
    navigate("/login");
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{styles}</style>
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

            {banner && <div className="rf-banner">⚠ {banner}</div>}

            <form onSubmit={handleSubmit}>

              {/* ── Step 1: Personal ── */}
              {step === 1 && (
                <div className="step-wrap">
                  <div className="rf-row">
                    <div className="rf-field">
                      <label>First name</label>
                      <input type="text" value={first_name} placeholder="Jane"
                        className={errors.first_name ? "err" : ""}
                        onChange={(e) => { setFirstname(e.target.value); clearErr("first_name"); }} />
                      {errors.first_name && <span className="rf-error">⚠ {errors.first_name}</span>}
                    </div>
                    <div className="rf-field">
                      <label>Last name</label>
                      <input type="text" value={last_name} placeholder="Smith"
                        className={errors.last_name ? "err" : ""}
                        onChange={(e) => { setLastname(e.target.value); clearErr("last_name"); }} />
                      {errors.last_name && <span className="rf-error">⚠ {errors.last_name}</span>}
                    </div>
                  </div>
                  <div className="rf-field">
                    <label>Email</label>
                    <input type="email" value={email} placeholder="you@example.com"
                      className={errors.email ? "err" : ""}
                      onChange={(e) => { setEmail(e.target.value); clearErr("email"); }} />
                    {errors.email && <span className="rf-error">⚠ {errors.email}</span>}
                  </div>
                  <div className="rf-field">
                    <label>Password</label>
                    <input type="password" value={password} placeholder="Min. 6 characters"
                      className={errors.password ? "err" : ""}
                      onChange={(e) => { setPassword(e.target.value); clearErr("password"); }} />
                    {errors.password && <span className="rf-error">⚠ {errors.password}</span>}
                  </div>
                  <div className="rf-field">
                    <label>Date of birth</label>
                    <input type="date" value={birth_date}
                      className={errors.birth_date ? "err" : ""}
                      onChange={(e) => { setBirthdate(e.target.value); clearErr("birth_date"); }} />
                    {errors.birth_date && <span className="rf-error">⚠ {errors.birth_date}</span>}
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
                      <label>SA ID number</label>
                      <input type="text" value={id_num} placeholder="13-digit ID number"
                        className={errors.id_num ? "err" : ""}
                        onChange={(e) => { setIdnum(e.target.value); clearErr("id_num"); }} />
                      {errors.id_num && <span className="rf-error">⚠ {errors.id_num}</span>}
                    </div>
                  ) : (
                    <div className="rf-field">
                      <label>Passport number</label>
                      <input type="text" value={passport_num} placeholder="e.g. A12345678"
                        className={errors.passport_num ? "err" : ""}
                        onChange={(e) => { setpassportNum(e.target.value); clearErr("passport_num"); }} />
                      {errors.passport_num && <span className="rf-error">⚠ {errors.passport_num}</span>}
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
                    <label>Cell number</label>
                    <input type="tel" value={cell_num} placeholder="+27 82 000 0000"
                      className={errors.cell_num ? "err" : ""}
                      onChange={(e) => { setCellNum(e.target.value); clearErr("cell_num"); }} />
                    {errors.cell_num && <span className="rf-error">⚠ {errors.cell_num}</span>}
                  </div>
                  <div className="rf-field">
                    <label>HPCSA/SANC Number <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
                    <input type="text" value={sanc_num} placeholder="e.g. 12345678"
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
    </>
  );
}
