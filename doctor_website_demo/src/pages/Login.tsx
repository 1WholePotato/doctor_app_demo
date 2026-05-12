import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import {supabase} from "../supabaseClient"


function Login(){
    const navigate = useNavigate();
    const [email,setEmail] = useState("");
    const [password, setPassword] = useState("")

    const testUsers = [{
        email: "admin123@gmail.com",
        password : "1234",
        role: "admin",
    },
    {
        email: "student123@gmail.com",
        password : "1234",
        role : "student",
    },];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        //const { data, error } = await supabase.auth.signInWithPassword({
    //email,
    //password
  //});

  //if (error) {
    //alert(error.message);
    //return;
  //}

  //const user = data.user;

  //Get user role from your Users table
  //const { data: profile, error: profileError } = await supabase
    //.from("Users")
    //.select("role_id")
    //.eq("id", user.id)
    //.single();

  //if (profileError) {
    //alert("Could not fetch user profile");
    //return;
  //}

  // Redirect based on role
  //if (profile.role_id === "PUT_ADMIN_ROLE_ID_HERE") {
    navigate("/dashboard");
  //} else {
    //navigate("/studentlanding");
  //}
    }



    return(
        <div className="min-h-screen flex items-center justify-center bg-grey-100 px-4">
            <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
                <h2 className="text-3xl font-bold text-center mb-6">Welcome Back!</h2>
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block mb-2 text-sm font-md">
                            Email
                        </label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"/>
                        
                    </div>
                    <div>
                        <label className="block mb-2 text-sm font-md">
                            Password
                        </label>
                        <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"/>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <label className="flex items-center gap-2">
                            Remember Me
                            <input type="checkbox" />
                        </label>
                        <a href="" className="hover:underline">
                            Forgot Password?
                        </a>
                    </div>

                    <button
                    type="submit"
                    className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-grey-500 transition">
                        Login
                    </button>
                </form>

                <div>
                    <p className="text-center text-sm">Dont have an account?
                        <a href="" className="hover:underline">Sign Up Here!</a>
                        <Link to="/register" className="hover:underline">Register</Link>
                    </p>
                </div>
            </div>
        </div>
    )
}

export default Login;