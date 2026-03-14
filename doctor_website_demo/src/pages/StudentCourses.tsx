import { useNavigate } from "react-router-dom";

interface Course {
  id: number;
  title: string;
  description: string;
  nextDate: string;
  seatsLeft: number;
}

function StudentCourses() {
  const navigate = useNavigate();

  // Demo courses (later from Supabase)
  const courses: Course[] = [
    {
      id: 1,
      title: "CPR Training",
      description: "Learn life-saving CPR techniques.",
      nextDate: "10 April 2026",
      seatsLeft: 6,
    },
    {
      id: 2,
      title: "First Aid Crash Course",
      description: "Essential emergency response skills.",
      nextDate: "15 April 2026",
      seatsLeft: 4,
    },
    {
      id: 3,
      title: "Advanced Anatomy",
      description: "Deep dive into human anatomy.",
      nextDate: "22 April 2026",
      seatsLeft: 10,
    },
  ];

  return (
    <div>

      {/* Page Title */}
      <h1 className="text-3xl font-bold mb-6">Available Courses</h1>

      {/* Course Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {courses.map((course) => (
          <div
            key={course.id}
            className="bg-white p-6 rounded-2xl shadow hover:shadow-lg transition"
          >
            <h2 className="text-xl font-bold">{course.title}</h2>

            <p className="text-gray-600 mt-2">
              {course.description}
            </p>

            <div className="mt-4 text-sm text-gray-500">
              <p>Next Session: {course.nextDate}</p>
              <p>Seats Left: {course.seatsLeft}</p>
            </div>

            <button
              onClick={() => navigate(`/studentcourses/${course.id}`)}
              className="mt-5 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              View Course
            </button>
          </div>
        ))}

      </div>
    </div>
  );
}

export default StudentCourses;