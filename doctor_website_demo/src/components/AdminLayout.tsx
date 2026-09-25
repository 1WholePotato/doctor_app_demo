import { Outlet } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";
import "../styles/adminLayout.css";
import "../styles/adminPages.css";

export default function AdminLayout() {
  return (
    <div className="admin-layout-shell">
      <AdminSidebar />
      <Outlet />
    </div>
  );
}
