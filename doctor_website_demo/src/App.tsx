import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import Home from "./pages/Home"
import Login from "./pages/Login"
import './index.css'
import { Routes, Route } from "react-router-dom"

function App() {
 return(
   <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
    </Routes>
 )
}

export default App