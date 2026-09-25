import { Suspense, lazy } from "react";
import { Navigate, Routes, Route } from "react-router-dom";
import RequireAuth from "./components/RequireAuth";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider } from "./context/AuthContext";
import "./index.css";

// Lazy-loaded route views to split JS bundle
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const AdminLanding = lazy(() => import("./pages/AdminLanding"));
const AdminCourse = lazy(() => import("./pages/AdminCourse"));
const AdminCourseDetails = lazy(() => import("./pages/AdminCourseDetails"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const StudentLanding = lazy(() => import("./pages/StudentLanding"));
const StudentCourses = lazy(() => import("./pages/StudentCourses"));
const StudentCourseDetails = lazy(() => import("./pages/StudentCourseDetails"));
const StudentGrades = lazy(() => import("./pages/StudentGrades"));
const StudentProfile = lazy(() => import("./pages/StudentProfile"));
const StudentNotifications = lazy(() => import("./pages/StudentNotifications"));

function PageLoading() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#F4F7FB",
      color: "#94A3B8",
      fontFamily: "system-ui, sans-serif",
      fontSize: "14px",
    }}>
      Loading…
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Suspense fallback={<PageLoading />}>
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
        </Suspense>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
