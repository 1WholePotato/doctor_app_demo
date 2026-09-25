import { Outlet } from "react-router-dom";
import StudentSidebar from "./StudentSidebar";
import "../styles/studentLayout.css";
import "../styles/studentPages.css";

export default function StudentLayout() {
  return (
    <div className="student-layout-shell">
      <StudentSidebar prefix="sl" />
      <Outlet />
    </div>
  );
}
