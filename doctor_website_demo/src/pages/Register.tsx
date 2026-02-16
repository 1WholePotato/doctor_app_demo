import React, { useState } from "react";

function Register(){
    const [firstname, setFirstname] = useState("");
    const [lastname , setLastname] = useState("");
    const[email, setEmail] = useState("");
    const[password, setPassword] = useState("");

    const handleSubmit = (e: React.FormEvent) =>{
        e.preventDefault()
        
    }

    return(
        <div className="min-h-screen flex items-center justify-center bg-grey-100 px-4">
            <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
                <h2 className="text-3xl font-bold text-center mb-6">Welcome Back!</h2>
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block mb-2 text-sm font-md">
                            First Name
                        </label>
                        <input type="text" value={firstname} onChange={(e) => setFirstname(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"/>
                        
                    </div>
                    <div>
                        <label className="block mb-2 text-sm font-md">
                            Password
                        </label>
                        <input type="text" value={lastname} onChange={(e) => setLastname(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"/>
                        
                    </div>
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
                   

                    <button
                    type="submit"
                    className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-grey-500 transition">
                        Register
                    </button>
                </form>

                
            </div>
        </div>

    )
}

export default Register;