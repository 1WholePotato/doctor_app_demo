import StudentSidebar from "../components/StudentSidebar";

const styles = `
  :root {
    --s-bg:       #F4F7FB;
    --s-surface:  #FFFFFF;
    --s-navy:     #0F1E35;
    --s-teal:     #2BBFAA;
    --s-teal-soft:#E6F7F5;
    --s-text-1:   #0F1E35;
    --s-text-2:   #4A5568;
    --s-text-3:   #94A3B8;
    --s-border:   #E2E8F0;
    --s-radius:   12px;
    --s-font:     'Plus Jakarta Sans', system-ui, sans-serif;
  }

  .sn-shell * { box-sizing: border-box; margin: 0; padding: 0; }
  .sn-shell { font-family: var(--s-font); background: var(--s-bg); min-height: 100vh; display: flex; }
  .sl-sidebar { width: 224px; min-height: 100vh; background: var(--s-navy); display: flex; flex-direction: column; padding: 26px 14px; position: fixed; top: 0; left: 0; bottom: 0; z-index: 10; }
  .sl-logo { display: flex; align-items: center; gap: 10px; padding: 0 8px; margin-bottom: 32px; }
  .sl-logo-mark { width: 30px; height: 30px; border-radius: 8px; background: var(--s-teal); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .sl-logo-mark svg { width: 16px; height: 16px; color: #fff; }
  .sl-logo-text { font-size: 14px; font-weight: 600; color: #fff; letter-spacing: -.01em; line-height: 1.2; }
  .sl-logo-text span { display: block; font-size: 11px; font-weight: 400; color: #4A6080; }
  .sl-nav { display: flex; flex-direction: column; gap: 2px; flex: 1; }
  .sl-nav-label { font-size: 10px; font-weight: 600; letter-spacing: .08em; color: #2D3F58; text-transform: uppercase; padding: 0 10px; margin: 18px 0 5px; }
  .sl-nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 9px; color: #64748B; font-size: 13px; font-weight: 400; text-decoration: none; transition: background .15s, color .15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; }
  .sl-nav-item:hover { background: rgba(255,255,255,.06); color: #CBD5E1; }
  .sl-nav-item.active { background: rgba(43,191,170,.15); color: var(--s-teal); font-weight: 500; }
  .sl-nav-item svg { width: 17px; height: 17px; flex-shrink: 0; }
  .sl-footer { margin-top: auto; padding-top: 18px; border-top: 1px solid #1E3050; }
  .sl-avatar-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; margin-bottom: 10px; }
  .sl-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--s-teal); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; color: #fff; flex-shrink: 0; }
  .sl-avatar-name { font-size: 13px; font-weight: 500; color: #CBD5E1; }
  .sl-avatar-role { font-size: 11px; color: #4A6080; }
  .sn-main { margin-left: 224px; flex: 1; padding: 32px 40px; }
  .eyebrow { font-size: 11px; font-weight: 600; color: var(--s-text-3); letter-spacing: .07em; text-transform: uppercase; margin-bottom: 5px; }
  .sn-main h1 { font-size: 28px; font-weight: 600; color: var(--s-text-1); margin-bottom: 24px; }
  .sn-empty { background: var(--s-surface); border: 1px solid var(--s-border); border-radius: var(--s-radius); padding: 48px 28px; text-align: center; }
  .sn-empty h2 { font-size: 18px; font-weight: 600; color: var(--s-text-1); margin-bottom: 8px; }
  .sn-empty p { font-size: 14px; color: var(--s-text-3); line-height: 1.6; }
`;

export default function StudentNotifications() {
  return (
    <>
      <style>{styles}</style>
      <div className="sn-shell">
        <StudentSidebar prefix="sl" />
        <main className="sn-main">
          <p className="eyebrow">Inbox</p>
          <h1>Notifications</h1>
          <div className="sn-empty">
            <h2>No notifications yet</h2>
            <p>When a class is confirmed or a result is posted, it will show up here.</p>
          </div>
        </main>
      </div>
    </>
  );
}
