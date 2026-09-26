import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { Skeleton } from "../components/Skeleton";
import { type AppUser } from "../lib/auth";
import { useAuth } from "../context/useAuth";
import { loadRoles, roleLabel } from "../lib/roles";

export default function StudentProfile() {
  const navigate = useNavigate();
  const { user, loading: authLoading, refreshUser } = useAuth();

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

    if (!user) {
      if (!authLoading) navigate("/login");
      return;
    }

    async function load() {
      if (!user) return;
      const roles = await loadRoles();
      if (cancelled) return;
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
  }, [user, authLoading, navigate]);

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

    await refreshUser();
    setBanner({ type: "ok", text: "Profile updated successfully." });
    setSaving(false);
  };

  if (loading) {
    return (
      <main className="sp-main">
        <div className="sp-header">
          <p className="eyebrow">Account</p>
          <h1>My profile</h1>
        </div>
        <div className="sp-card" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="sp-row">
            <Skeleton width="100%" height={44} borderRadius={10} />
            <Skeleton width="100%" height={44} borderRadius={10} />
          </div>
          <Skeleton width="100%" height={44} borderRadius={10} />
          <Skeleton width="100%" height={44} borderRadius={10} />
          <Skeleton width="100%" height={44} borderRadius={10} />
          <Skeleton width="140px" height={42} borderRadius={10} style={{ marginTop: 12 }} />
        </div>
      </main>
    );
  }

  return (
    <>
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
                  <label htmlFor="sp-first-name">First name</label>
                  <input
                    id="sp-first-name"
                    type="text"
                    value={first_name}
                    className={errors.first_name ? "err" : ""}
                    onChange={(ev) => {
                      setFirstname(ev.target.value);
                      clearErr("first_name");
                    }}
                  />
                  {errors.first_name && (
                    <span className="sp-error" role="alert">⚠ {errors.first_name}</span>
                  )}
                </div>
                <div className="sp-field">
                  <label htmlFor="sp-last-name">Last name</label>
                  <input
                    id="sp-last-name"
                    type="text"
                    value={last_name}
                    className={errors.last_name ? "err" : ""}
                    onChange={(ev) => {
                      setLastname(ev.target.value);
                      clearErr("last_name");
                    }}
                  />
                  {errors.last_name && (
                    <span className="sp-error" role="alert">⚠ {errors.last_name}</span>
                  )}
                </div>
              </div>

              <div className="sp-field">
                <label htmlFor="sp-email">Email</label>
                <input
                  id="sp-email"
                  type="email"
                  value={email}
                  className={errors.email ? "err" : ""}
                  onChange={(ev) => {
                    setEmail(ev.target.value);
                    clearErr("email");
                  }}
                />
                {errors.email && <span className="sp-error" role="alert">⚠ {errors.email}</span>}
              </div>

              <div className="sp-field">
                <label htmlFor="sp-birth-date">Date of birth</label>
                <input
                  id="sp-birth-date"
                  type="date"
                  value={birth_date}
                  className={errors.birth_date ? "err" : ""}
                  onChange={(ev) => {
                    setBirthdate(ev.target.value);
                    clearErr("birth_date");
                  }}
                />
                {errors.birth_date && (
                  <span className="sp-error" role="alert">⚠ {errors.birth_date}</span>
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
                  <label htmlFor="sp-id-num">SA ID number</label>
                  <input
                    id="sp-id-num"
                    type="text"
                    value={id_num}
                    className={errors.id_num ? "err" : ""}
                    onChange={(ev) => {
                      setIdnum(ev.target.value);
                      clearErr("id_num");
                    }}
                  />
                  {errors.id_num && <span className="sp-error" role="alert">⚠ {errors.id_num}</span>}
                </div>
              ) : (
                <div className="sp-field">
                  <label htmlFor="sp-passport-num">Passport number</label>
                  <input
                    id="sp-passport-num"
                    type="text"
                    value={passport_num}
                    className={errors.passport_num ? "err" : ""}
                    onChange={(ev) => {
                      setPassportNum(ev.target.value);
                      clearErr("passport_num");
                    }}
                  />
                  {errors.passport_num && (
                    <span className="sp-error" role="alert">⚠ {errors.passport_num}</span>
                  )}
                </div>
              )}

              <div className="sp-field">
                <label htmlFor="sp-cell-num">Cell number</label>
                <input
                  id="sp-cell-num"
                  type="tel"
                  value={cell_num}
                  className={errors.cell_num ? "err" : ""}
                  onChange={(ev) => {
                    setCellNum(ev.target.value);
                    clearErr("cell_num");
                  }}
                />
                {errors.cell_num && <span className="sp-error" role="alert">⚠ {errors.cell_num}</span>}
              </div>

              <div className="sp-field">
                <label htmlFor="sp-sanc-num">
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
                  id="sp-sanc-num"
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
    </>
  );
}
