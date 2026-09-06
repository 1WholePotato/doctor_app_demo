import AdminSidebar from "../components/AdminSidebar";

const globalStyles = `
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
    --radius:    14px;
    --font-display: 'Fraunces', Georgia, serif;
    --font-body:    'DM Sans', system-ui, sans-serif;
  }

  .as-shell * { box-sizing: border-box; margin: 0; padding: 0; }
  .as-shell { font-family: var(--font-body); background: var(--bg); min-height: 100vh; display: flex; }
  .sidebar { width: 228px; min-height: 100vh; background: var(--sidebar); display: flex; flex-direction: column; padding: 28px 16px; position: fixed; top: 0; left: 0; bottom: 0; z-index: 10; }
  .sidebar-logo { font-family: var(--font-display); font-size: 18px; font-weight: 300; color: #fff; letter-spacing: .02em; padding: 0 8px; margin-bottom: 36px; display: flex; align-items: center; gap: 10px; }
  .sidebar-logo span { color: var(--gold); }
  .sidebar-nav { display: flex; flex-direction: column; gap: 2px; flex: 1; }
  .nav-item { display: flex; align-items: center; gap: 11px; padding: 10px 12px; border-radius: 10px; color: #888887; font-size: 14px; font-weight: 400; text-decoration: none; transition: background .15s, color .15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; }
  .nav-item:hover { background: rgba(255,255,255,.07); color: #fff; }
  .nav-item.active { background: rgba(201,168,76,.15); color: var(--gold); }
  .nav-item svg { width: 18px; height: 18px; flex-shrink: 0; }
  .nav-section-label { font-size: 10px; font-weight: 500; letter-spacing: .1em; color: #444443; text-transform: uppercase; padding: 0 12px; margin: 20px 0 6px; }
  .sidebar-footer { margin-top: auto; padding-top: 20px; border-top: 1px solid #222221; }
  .as-main { margin-left: 228px; flex: 1; padding: 40px 44px; }
  .eyebrow { font-size: 12px; font-weight: 500; color: var(--text-3); letter-spacing: .08em; text-transform: uppercase; margin-bottom: 6px; }
  .as-main h1 { font-family: var(--font-display); font-size: 32px; font-weight: 300; color: var(--text-1); margin-bottom: 24px; }
  .as-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 28px; max-width: 560px; }
  .as-card p { font-size: 14px; color: var(--text-2); line-height: 1.7; }
`;

export default function AdminSettings() {
  return (
    <>
      <style>{globalStyles}</style>
      <div className="as-shell">
        <AdminSidebar />
        <main className="as-main">
          <p className="eyebrow">Account</p>
          <h1>Settings</h1>
          <div className="as-card">
            <p>
              Practice settings are not configurable in this demo yet. Use Users to change roles and Courses to assign teachers.
            </p>
          </div>
        </main>
      </div>
    </>
  );
}
