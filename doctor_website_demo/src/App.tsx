import { Suspense, lazy } from "react";
import { Navigate, Routes, Route } from "react-router-dom";
import RequireAuth from "./components/RequireAuth";
import ErrorBoundary from "./components/ErrorBoundary";
import AdminLayout from "./components/AdminLayout";
import StudentLayout from "./components/StudentLayout";
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
            {/* Public routes */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset" element={<Navigate to="/forgot-password" replace />} />

            {/* Admin layout routes */}
            <Route
              element={
                <RequireAuth role="admin">
                  <AdminLayout />
                </RequireAuth>
              }
            >
              <Route path="/dashboard" element={<AdminLanding />} />
              <Route path="/admincourses" element={<AdminCourse />} />
              <Route path="/admincourses/:id" element={<AdminCourseDetails />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/settings" element={<AdminSettings />} />
              <Route path="/patients" element={<Navigate to="/admin/users" replace />} />
            </Route>

            {/* Student layout routes */}
            <Route
              element={
                <RequireAuth role="student">
                  <StudentLayout />
                </RequireAuth>
              }
            >
              <Route path="/studentlanding" element={<StudentLanding />} />
              <Route path="/courses" element={<StudentCourses />} />
              <Route path="/courses/:id" element={<StudentCourseDetails />} />
              <Route path="/grades" element={<StudentGrades />} />
              <Route path="/notifications" element={<StudentNotifications />} />
              <Route path="/profile" element={<StudentProfile />} />
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
