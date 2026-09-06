import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import AdminLanding from "./pages/AdminLanding";
import AdminCourse from "./pages/AdminCourse";
import AdminCourseDetails from "./pages/AdminCourseDetails";
import AdminUsers from "./pages/AdminUsers";
import AdminSettings from "./pages/AdminSettings";
import StudentLanding from "./pages/StudentLanding";
import StudentCourses from "./pages/StudentCourses";
import StudentCourseDetails from "./pages/StudentCourseDetails";
import StudentGrades from "./pages/StudentGrades";
import StudentProfile from "./pages/StudentProfile";
import StudentNotifications from "./pages/StudentNotifications";
import RequireAuth from "./components/RequireAuth";
import "./index.css";

import { Navigate, Routes, Route } from "react-router-dom";

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset" element={<Navigate to="/forgot-password" replace />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth role="admin">
              <AdminLanding />
            </RequireAuth>
          }
        />
        <Route
          path="/admincourses"
          element={
            <RequireAuth role="admin">
              <AdminCourse />
            </RequireAuth>
          }
        />
        <Route
          path="/admincourses/:id"
          element={
            <RequireAuth role="admin">
              <AdminCourseDetails />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequireAuth role="admin">
              <AdminUsers />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth role="admin">
              <AdminSettings />
            </RequireAuth>
          }
        />
        <Route path="/patients" element={<Navigate to="/admin/users" replace />} />
        <Route
          path="/studentlanding"
          element={
            <RequireAuth role="student">
              <StudentLanding />
            </RequireAuth>
          }
        />
        <Route
          path="/courses"
          element={
            <RequireAuth role="student">
              <StudentCourses />
            </RequireAuth>
          }
        />
        <Route
          path="/grades"
          element={
            <RequireAuth role="student">
              <StudentGrades />
            </RequireAuth>
          }
        />
        <Route
          path="/notifications"
          element={
            <RequireAuth role="student">
              <StudentNotifications />
            </RequireAuth>
          }
        />
        <Route
          path="/courses/:id"
          element={
            <RequireAuth role="student">
              <StudentCourseDetails />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth role="student">
              <StudentProfile />
            </RequireAuth>
          }
        />
      </Routes>
    </>
  );
}

export default App;
