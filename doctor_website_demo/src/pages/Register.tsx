import React, { useState } from "react";
import {supabase} from "../supabaseClient";
import { useNavigate } from "react-router-dom";

function Register(){
    const navigate = useNavigate();
    const [firstname, setFirstname] = useState("");
    const [lastname , setLastname] = useState("");
    const[email, setEmail] = useState("");
    const[password, setPassword] = useState("");
    const[birth_date, setBirthdate] = useState("");
    const[idNum, setIdnum] = useState("");
    const[passportNum, setpassportNum] = useState("");
    const[cell_num, setCellNum] = useState("");
    const[sanc_num, setSancNum] = useState("");
    const[isCiti, setIsCiti] = useState(true);


    const handleSubmit = async (e: React.FormEvent) =>{
        e.preventDefault();

        // 1. Create user in Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) {
    alert(error.message);
    return;
  }

  const user = data.user;

  if (!user) {
    alert("User not created");
    return;
  }

  // ✅ Validate ID / Passport
if (isCiti && !idNum) {
  alert("Please enter your ID number");
  return;
}

if (!isCiti && !passportNum) {
  alert("Please enter your passport number");
  return;
}
  // 2. Insert into your Users table
  const { error: insertError } = await supabase.from("Users").insert([
    {
      id: user.id, //  MUST match auth.users.id

      role_id: "PUT_STUDENT_ROLE_ID_HERE",

      firstname,
      lastname,
      birth_date,

      id_num: idNum || null,
      passport_num: passportNum || null,

      cell_num,
      email,

      sanc_num,
      active: true
    }
  ]);

  if (insertError) {
    alert(insertError.message);
    return;
  }

  // 3. Success
  alert("Account created successfully!");
  navigate("/login");
        
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
                            Last Name
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
                    <div>
                        <label className="block mb-2 text-sm font-md">
                            Birth Date
                        </label>
                        <input
                        type="date"
                        value={birth_date}
                        onChange={(e) => setBirthdate(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"/>
                    </div>
                    <div>
                        <label className="block mb-2 text-sm font-md">
                            Are you a South African Citisen?
                        </label>
                        <input
                        type="checkbox"
                        checked={isCiti}
                        onChange={(e) => setIsCiti(e.target.checked)}
                        />
                    </div>
                   {isCiti ? (
                                <div>
                                    <label className="block mb-2 text-sm font-md">
                                    ID Number
                                    </label>
                                    <input
                                    type="text"
                                    value={idNum}
                                    onChange={(e) => setIdnum(e.target.value)}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                                ) : (
                                <div>
                                    <label className="block mb-2 text-sm font-md">
                                    Passport Number
                                    </label>
                                    <input
                                    type="text"
                                    value={passportNum}
                                    onChange={(e) => setpassportNum(e.target.value)}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                                )}

                    <div>
                        <label className="block mb-2 text-sm font-md">
                            Cellphone Number
                        </label>
                        <input
                        type="text"
                        value={cell_num}
                        onChange={(e) => setCellNum(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"/>
                    </div>

                    <div>
                        <label className="block mb-2 text-sm font-md">
                            Saanc Number
                        </label>
                        <input
                        type="text"
                        value={sanc_num}
                        onChange={(e) => setSancNum(e.target.value)}
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