import { Link } from "react-router-dom"

function Navbar() {

    return (
        <nav className="fixed top-0 w-full bg-white shadow-md z-50">
            <div className="max-w-6x1 mx-auto px-6 py-4 flex justify-between items-center">
                <h1 className="text-xl font-bold">
                    Doctor Website
                </h1>
                <div className="space-x-6">
                    <a href="#aboutwebsite" className="hover:text-blue-600">About</a>
                    <a href="#aboutdoctor" className="hover:text-blue-600">Doctor</a>
                    <button className="bg-blue-600 text-white px-4 py-2 rounded">Book Now</button>
                    <Link to="/login" className="bg-blue-600 text-white px-4 py-2 rounded">Login</Link>
                </div>
            </div>
        </nav>
    )
}

export default Navbar