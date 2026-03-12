import React, { useState } from "react";
import { Link } from "react-router-dom";

function AdminLanding() {
    return (
    <div>
      {/* Page Title */}
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        
        <div className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-gray-500 text-sm">Total Students</h2>
          <p className="text-3xl font-bold mt-2">1,284</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-gray-500 text-sm">Today's Classes</h2>
          <p className="text-3xl font-bold mt-2">32</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-gray-500 text-sm">Placeholder For Now</h2>
          <p className="text-3xl font-bold mt-2">5</p>
        </div>

      </div>

      {/* Quick Actions */}
      <div className="mb-10">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>

        <div className="flex gap-4 flex-wrap">
          <Link
            to="/admincourses"
            className="bg-blue-600 text-white px-6 py-3 rounded-xl shadow hover:bg-blue-700 transition"
          >
            View Courses
          </Link>

          <Link
            to="/patients"
            className="bg-green-600 text-white px-6 py-3 rounded-xl shadow hover:bg-green-700 transition"
          >
            Manage Users
          </Link>

          <Link
            to="/settings"
            className="bg-gray-700 text-white px-6 py-3 rounded-xl shadow hover:bg-gray-800 transition"
          >
            Manage Profile
          </Link>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Users</h2>

        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-4">User</th>
                <th className="p-4">Course</th>
                <th className="p-4">Date</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-4">John Doe</td>
                <td className="p-4">Course 1</td>
                <td className="p-4">32 March 2026</td>
                <td className="p-4 text-green-600 font-medium">PAID</td>
              </tr>

              <tr className="border-t">
                <td className="p-4">Pieter</td>
                <td className="p-4">Course 1</td>
                <td className="p-4">1 March 2026</td>
                <td className="p-4 text-yellow-600 font-medium">Pending</td>
              </tr>

              <tr className="border-t">
                <td className="p-4">Gielie</td>
                <td className="p-4">Course 3</td>
                <td className="p-4">3 March 2026</td>
                <td className="p-4 text-yellow-600 font-medium">Pending</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AdminLanding;