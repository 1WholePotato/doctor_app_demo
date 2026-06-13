import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import Home from "./pages/Home"
import Login from "./pages/Login"
import Register from './pages/Register'
import AdminLanding from './pages/AdminLanding'
import AdminCourse from './pages/AdminCourse'
import AdminCourseDetails from './pages/AdminCourseDetails'
import StudentLanding from './pages/StudentLanding'
import StudentCourses from './pages/StudentCourses'
import StudentCourseDetails from './pages/StudentCourseDetails'
import './index.css'

import { Routes, Route } from "react-router-dom"

function App() {
 return(
  <>
    
   <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<AdminLanding/>}/>
      <Route path="/admincourses" element={<AdminCourse/>}/>
      <Route path="/admincourses/:id" element={<AdminCourseDetails/>}/>
      <Route path ="/studentlanding" element={<StudentLanding/>}/>
      <Route path="/courses" element={<StudentCourses/>}/>
      <Route path="/courses/:id" element={<StudentCourseDetails/>}/>
    </Routes>
  </>
  
 )
}

export default App