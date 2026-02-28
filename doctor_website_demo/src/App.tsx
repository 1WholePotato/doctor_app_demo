import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import Home from "./pages/Home"
import Login from "./pages/Login"
import Register from './pages/Register'
import AdminLanding from './pages/AdminLanding'
import './index.css'
import Navbar from "./components/Navbar"
import { Routes, Route } from "react-router-dom"

function App() {
 return(
  <>
    <Navbar />
   <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<AdminLanding />}/>
    </Routes>
  </>
  
 )
}

export default App