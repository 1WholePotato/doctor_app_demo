import { Outlet } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";
import "../styles/adminLayout.css";

export default function AdminLayout() {
  return (
    <div className="admin-layout-shell">
      <AdminSidebar />
      <Outlet />
    </div>
  );
}
