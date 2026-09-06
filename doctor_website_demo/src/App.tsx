import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AdminLanding from "./pages/AdminLanding";
import AdminCourse from "./pages/AdminCourse";
import AdminCourseDetails from "./pages/AdminCourseDetails";
import StudentLanding from "./pages/StudentLanding";
import StudentCourses from "./pages/StudentCourses";
import StudentCourseDetails from "./pages/StudentCourseDetails";
import StudentGrades from "./pages/StudentGrades";
import RequireAuth from "./components/RequireAuth";
import "./index.css";

import { Routes, Route } from "react-router-dom";

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
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
          path="/courses/:id"
          element={
            <RequireAuth role="student">
              <StudentCourseDetails />
            </RequireAuth>
          }
        />
      </Routes>
    </>
  );
}

export default App;
