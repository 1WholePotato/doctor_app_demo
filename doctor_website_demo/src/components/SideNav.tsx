import { Link, Outlet } from "react-router-dom";

export default function DashboardLayout() {
  return (
    <div className="flex h-screen bg-gray-100">
      
      {/* Sidebar */}
      <aside className="w-64 bg-blue-900 text-white p-5">
        <h2 className="text-2xl font-bold mb-8">Doctor Portal</h2>

        <nav className="space-y-4">
          <Link to="/dashboard" className="block hover:text-gray-300">
            Dashboard
          </Link>

          <Link to="/appointments" className="block hover:text-gray-300">
            Appointments
          </Link>

          <Link to="/patients" className="block hover:text-gray-300">
            Patients
          </Link>

          <Link to="/settings" className="block hover:text-gray-300">
            Settings
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <Outlet />
      </main>

    </div>
  );
}