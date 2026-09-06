import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import StudentSidebar from "../components/StudentSidebar";
import { supabase } from "../supabaseClient";
import { getSessionUser, type AppUser } from "../lib/auth";
import { loadRoles, roleLabel } from "../lib/roles";

const styles = `
  :root {
    --s-bg:       #F4F7FB;
    --s-surface:  #FFFFFF;
    --s-navy:     #0F1E35;
    --s-teal:     #2BBFAA;
    --s-teal-soft:#E6F7F5;
    --s-teal-mid: #1A9E8C;
    --s-text-1:   #0F1E35;
    --s-text-2:   #4A5568;
    --s-text-3:   #94A3B8;
    --s-border:   #E2E8F0;
    --s-radius:   12px;
    --s-font:     'Plus Jakarta Sans', system-ui, sans-serif;
  }

  .sp-shell * { box-sizing: border-box; margin: 0; padding: 0; }
  .sp-shell { font-family: var(--s-font); background: var(--s-bg); min-height: 100vh; display: flex; }

  .sp-sidebar { width: 224px; min-height: 100vh; background: var(--s-navy); display: flex; flex-direction: column; padding: 26px 14px; position: fixed; top: 0; left: 0; bottom: 0; z-index: 10; }
  .sp-logo { display: flex; align-items: center; gap: 10px; padding: 0 8px; margin-bottom: 32px; }
  .sp-logo-mark { width: 30px; height: 30px; border-radius: 8px; background: var(--s-teal); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .sp-logo-mark svg { width: 16px; height: 16px; color: #fff; }
  .sp-logo-text { font-size: 14px; font-weight: 600; color: #fff; letter-spacing: -.01em; line-height: 1.2; }
  .sp-logo-text span { display: block; font-size: 11px; font-weight: 400; color: #64748B; }
  .sp-nav { display: flex; flex-direction: column; gap: 2px; flex: 1; }
  .sp-nav-label { font-size: 10px; font-weight: 600; letter-spacing: .08em; color: #2D3F58; text-transform: uppercase; padding: 0 10px; margin: 18px 0 5px; }
  .sp-nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 9px; color: #64748B; font-size: 13px; font-weight: 400; text-decoration: none; transition: background .15s, color .15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; }
  .sp-nav-item:hover { background: rgba(255,255,255,.06); color: #CBD5E1; }
  .sp-nav-item.active { background: rgba(43,191,170,.15); color: var(--s-teal); font-weight: 500; }
  .sp-nav-item svg { width: 17px; height: 17px; flex-shrink: 0; }
  .sp-footer { margin-top: auto; padding-top: 18px; border-top: 1px solid #1E3050; }
  .sp-avatar-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; margin-bottom: 10px; }
  .sp-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--s-teal); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; color: #fff; flex-shrink: 0; }
  .sp-avatar-name { font-size: 13px; font-weight: 500; color: #CBD5E1; }
  .sp-avatar-role { font-size: 11px; color: #4A6080; }

  .sp-main { margin-left: 224px; flex: 1; padding: 32px 40px; max-width: 720px; }
  .sp-header { margin-bottom: 24px; }
  .sp-header .eyebrow { font-size: 11px; font-weight: 600; color: var(--s-text-3); letter-spacing: .07em; text-transform: uppercase; margin-bottom: 5px; }
  .sp-header h1 { font-size: 28px; font-weight: 600; color: var(--s-text-1); letter-spacing: -.02em; }

  .sp-card { background: var(--s-surface); border: 1px solid var(--s-border); border-radius: var(--s-radius); padding: 28px; }
  .sp-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .sp-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
  .sp-field label { font-size: 12px; font-weight: 500; color: var(--s-text-2); letter-spacing: .04em; text-transform: uppercase; }
  .sp-field input { width: 100%; border: 1px solid var(--s-border); border-radius: 8px; padding: 11px 14px; font-family: var(--s-font); font-size: 14px; color: var(--s-text-1); background: var(--s-surface); outline: none; transition: border-color .15s; }
  .sp-field input:focus { border-color: var(--s-teal); }
  .sp-field input.err { border-color: #C0392B; }
  .sp-field input:disabled { background: #F8FAFC; color: var(--s-text-3); cursor: not-allowed; }
  .sp-error { font-size: 12px; color: #C0392B; }
  .sp-readonly { font-size: 14px; color: var(--s-text-1); padding: 11px 0; }
  .sp-readonly-label { font-size: 12px; font-weight: 500; color: var(--s-text-2); letter-spacing: .04em; text-transform: uppercase; margin-bottom: 4px; }

  .citi-toggle { display: flex; background: var(--s-surface); border: 1px solid var(--s-border); border-radius: 8px; padding: 4px; margin-bottom: 16px; }
  .citi-opt { flex: 1; padding: 9px; text-align: center; font-size: 13px; font-weight: 500; border-radius: 6px; cursor: pointer; border: none; background: none; font-family: var(--s-font); color: var(--s-text-3); transition: background .15s, color .15s; }
  .citi-opt.active { background: var(--s-navy); color: #fff; }

  .sp-banner { border-radius: 8px; padding: 11px 14px; font-size: 13px; margin-bottom: 16px; }
  .sp-banner.err { background: #FEE9E9; border: 1px solid #F5C1C1; color: #A12D2D; }
  .sp-banner.ok { background: var(--s-teal-soft); border: 1px solid #A7E8DE; color: var(--s-teal-mid); }

  .sp-btn { background: var(--s-teal); color: #fff; border: none; padding: 12px 24px; border-radius: 8px; font-family: var(--s-font); font-size: 14px; font-weight: 500; cursor: pointer; transition: background .15s; margin-top: 8px; }
  .sp-btn:hover { background: var(--s-teal-mid); }
  .sp-btn:disabled { background: var(--s-text-3); cursor: not-allowed; }

  .sp-loading { font-size: 14px; color: var(--s-text-3); padding: 40px 0; }
`;

export default function StudentProfile() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [roleName, setRoleName] = useState("Student");
  const [originalEmail, setOriginalEmail] = useState("");
  const [banner, setBanner] = useState<{ type: "err" | "ok"; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [first_name, setFirstname] = useState("");
  const [last_name, setLastname] = useState("");
  const [email, setEmail] = useState("");
  const [birth_date, setBirthdate] = useState("");
  const [id_num, setIdnum] = useState("");
  const [passport_num, setPassportNum] = useState("");
  const [cell_num, setCellNum] = useState("");
  const [sanc_num, setSancNum] = useState("");
  const [isCiti, setIsCiti] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const user = await getSessionUser();
      if (cancelled) return;

      if (!user) {
        navigate("/login");
        return;
      }

      const roles = await loadRoles();
      setProfile(user);
      setRoleName(roleLabel(user.role_id, roles));
      setOriginalEmail(user.email);
      setFirstname(user.first_name);
      setLastname(user.last_name);
      setEmail(user.email);
      setBirthdate(user.birth_date ?? "");
      setIdnum(user.id_num ?? "");
      setPassportNum(user.passport_num ?? "");
      setCellNum(user.cell_num ?? "");
      setSancNum(user.sanc_num ?? "");
      setIsCiti(Boolean(user.id_num || !user.passport_num));
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const clearErr = (key: string) =>
    setErrors((p) => {
      const n = { ...p };
      delete n[key];
      return n;
    });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!first_name.trim()) e.first_name = "Required";
    if (!last_name.trim()) e.last_name = "Required";
    if (!email.trim()) e.email = "Required";
    if (!birth_date) e.birth_date = "Required";
    if (isCiti && !id_num.trim()) e.id_num = "Required for SA citizens";
    if (!isCiti && !passport_num.trim()) e.passport_num = "Required for non-citizens";
    if (!cell_num.trim()) e.cell_num = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    if (!profile || !validate()) return;

    setSaving(true);

    const { error: updateError } = await supabase
      .from("users")
      .update({
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: email.trim(),
        birth_date,
        id_num: isCiti ? id_num.trim() || null : null,
        passport_num: !isCiti ? passport_num.trim() || null : null,
        cell_num: cell_num.trim(),
        sanc_num: sanc_num.trim() || null,
      })
      .eq("id", profile.id);

    if (updateError) {
      setBanner({ type: "err", text: updateError.message });
      setSaving(false);
      return;
    }

    if (email.trim() !== originalEmail) {
      const { error: authError } = await supabase.auth.updateUser({ email: email.trim() });
      if (authError) {
        setBanner({
          type: "err",
          text: `Profile saved but email update failed: ${authError.message}`,
        });
        setSaving(false);
        return;
      }
      setOriginalEmail(email.trim());
    }

    setBanner({ type: "ok", text: "Profile updated successfully." });
    setSaving(false);
  };

  if (loading) {
    return (
      <>
        <style>{styles}</style>
        <div className="sp-shell">
          <main className="sp-main" style={{ marginLeft: 0, maxWidth: "100%" }}>
            <p className="sp-loading">Loading profile…</p>
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <div className="sp-shell">
        <StudentSidebar prefix="sp" />

        <main className="sp-main">
          <div className="sp-header">
            <p className="eyebrow">Account</p>
            <h1>My profile</h1>
          </div>

          <div className="sp-card">
            {banner && (
              <div className={`sp-banner ${banner.type}`}>{banner.text}</div>
            )}

            <form onSubmit={handleSave}>
              <div className="sp-row">
                <div className="sp-field">
                  <label>First name</label>
                  <input
                    type="text"
                    value={first_name}
                    className={errors.first_name ? "err" : ""}
                    onChange={(ev) => {
                      setFirstname(ev.target.value);
                      clearErr("first_name");
                    }}
                  />
                  {errors.first_name && (
                    <span className="sp-error">⚠ {errors.first_name}</span>
                  )}
                </div>
                <div className="sp-field">
                  <label>Last name</label>
                  <input
                    type="text"
                    value={last_name}
                    className={errors.last_name ? "err" : ""}
                    onChange={(ev) => {
                      setLastname(ev.target.value);
                      clearErr("last_name");
                    }}
                  />
                  {errors.last_name && (
                    <span className="sp-error">⚠ {errors.last_name}</span>
                  )}
                </div>
              </div>

              <div className="sp-field">
                <label>Email</label>
                <input
                  type="email"
                  value={email}
                  className={errors.email ? "err" : ""}
                  onChange={(ev) => {
                    setEmail(ev.target.value);
                    clearErr("email");
                  }}
                />
                {errors.email && <span className="sp-error">⚠ {errors.email}</span>}
              </div>

              <div className="sp-field">
                <label>Date of birth</label>
                <input
                  type="date"
                  value={birth_date}
                  className={errors.birth_date ? "err" : ""}
                  onChange={(ev) => {
                    setBirthdate(ev.target.value);
                    clearErr("birth_date");
                  }}
                />
                {errors.birth_date && (
                  <span className="sp-error">⚠ {errors.birth_date}</span>
                )}
              </div>

              <div className="sp-field">
                <label>Are you a South African citizen?</label>
                <div className="citi-toggle">
                  <button
                    type="button"
                    className={`citi-opt${isCiti ? " active" : ""}`}
                    onClick={() => setIsCiti(true)}
                  >
                    Yes, SA citizen
                  </button>
                  <button
                    type="button"
                    className={`citi-opt${!isCiti ? " active" : ""}`}
                    onClick={() => setIsCiti(false)}
                  >
                    No, foreign national
                  </button>
                </div>
              </div>

              {isCiti ? (
                <div className="sp-field">
                  <label>SA ID number</label>
                  <input
                    type="text"
                    value={id_num}
                    className={errors.id_num ? "err" : ""}
                    onChange={(ev) => {
                      setIdnum(ev.target.value);
                      clearErr("id_num");
                    }}
                  />
                  {errors.id_num && <span className="sp-error">⚠ {errors.id_num}</span>}
                </div>
              ) : (
                <div className="sp-field">
                  <label>Passport number</label>
                  <input
                    type="text"
                    value={passport_num}
                    className={errors.passport_num ? "err" : ""}
                    onChange={(ev) => {
                      setPassportNum(ev.target.value);
                      clearErr("passport_num");
                    }}
                  />
                  {errors.passport_num && (
                    <span className="sp-error">⚠ {errors.passport_num}</span>
                  )}
                </div>
              )}

              <div className="sp-field">
                <label>Cell number</label>
                <input
                  type="tel"
                  value={cell_num}
                  className={errors.cell_num ? "err" : ""}
                  onChange={(ev) => {
                    setCellNum(ev.target.value);
                    clearErr("cell_num");
                  }}
                />
                {errors.cell_num && <span className="sp-error">⚠ {errors.cell_num}</span>}
              </div>

              <div className="sp-field">
                <label>
                  HPCSA/SANC Number{" "}
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--s-text-3)",
                      fontWeight: 400,
                      textTransform: "none",
                      letterSpacing: 0,
                    }}
                  >
                    (optional)
                  </span>
                </label>
                <input
                  type="text"
                  value={sanc_num}
                  onChange={(ev) => setSancNum(ev.target.value)}
                />
              </div>

              <div className="sp-row">
                <div>
                  <p className="sp-readonly-label">Role</p>
                  <p className="sp-readonly">{roleName}</p>
                </div>
                <div>
                  <p className="sp-readonly-label">Status</p>
                  <p className="sp-readonly">{profile?.active ? "Active" : "Inactive"}</p>
                </div>
              </div>

              <button type="submit" className="sp-btn" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </form>
          </div>
        </main>
      </div>
    </>
  );
}
