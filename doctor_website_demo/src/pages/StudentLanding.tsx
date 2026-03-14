import { Link } from "react-router-dom";

function StudentLanding() {
    return(
        <div>
            <h1 className="text-3-xl font-bold mb-3">Welcome Back Student!</h1>
            <h3 className="text-1-xl font-bold mb-6">You have 3 classes scheduled</h3>
            {/*Cards*/}
            <h2 className="text-2-xl font-bold mb-3">Scheduled Classes</h2> 
            <Link
                        to="/admincourses"
                        className="bg-blue-600 text-white px-6 py-3 rounded-xl shadow hover:bg-blue-700 transition"
                      >
                        View Courses
                      </Link>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-white p-6 rounded-2-xl shadow">
                <h3 className="text-gray-500 text-sm">CPR Training</h3>
                <p className="text-3xl font-bold mt-2">32 March 2026</p>
                </div>
            
            
                <div className="bg-white p-6 rounded-2-xl shadow">
                <h3 className="text-gray-500 text-sm">Lobotomy 101</h3>
                <p className="text-3xl font-bold mt-2">1 April 2026</p>
                </div>
        
            
                <div className="bg-white p-6 rounded-2-xl shadow">
                <h3 className="text-gray-500 text-sm">First Aid Crash Course</h3>
                <p className="text-3xl font-bold mt-2">17 April 2026</p>
                </div>
            
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-white p-6 rounded-2-xl shadow">
                <h3 className="text-gray-500 text-sm">Grades</h3>
                <p className="text-3xl font-bold mt-2">First Aid 62%</p>
                <p className="text-3xl font-bold mt-2">CPR  42%</p>
                <p className="text-3xl font-bold mt-2">Lobotomy 101 60%</p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow">
                    <h3 className="text-gray-500 text-sm">Advanced Anatomy</h3>
                    <p className="text-lg font-semibold mt-2">Next Session: 20 April</p>

                    <Link
                        to="/courses"
                        className="inline-block mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                    >
                        View Course
                    </Link>
                </div>

                <div className="bg-white p-6 rounded-2-xl shadow">
                <h3 className="text-gray-500 text-sm">Notifications</h3>
                <p className="text-3xl font-bold mt-2">New Course Available!</p>
                <p className="text-3xl font-bold mt-2">First Aid Grades Available</p>
                <p className="text-3xl font-bold mt-2">You have a Pending class</p>
                </div>

            </div>


            
        </div>
    );
}

export default StudentLanding;