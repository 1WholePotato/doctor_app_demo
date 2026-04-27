import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface Course {
  id: number;
  title: string;
  description: string;
  category: string;
}

export default function AdminCourse() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Web Development");

  const [showForm, setShowForm] = useState(false);

  const navigate = useNavigate();

  const handleCreateCourse = () => {
    if (!title) return;

    const newCourse: Course = {
      id: Date.now(),
      title,
      description,
      category,
    };

    setCourses([...courses, newCourse]);

    // reset
    setTitle("");
    setDescription("");
    setCategory("Web Development");
    setShowForm(false);
  };

  return (
  <div className="min-h-screen bg-gray-100 pt-24 px-6 text-black">
    
    {/* HEADER */}
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-3xl font-bold">Courses</h1>

      <button
        onClick={() => setShowForm(!showForm)}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
      >
        {showForm ? "Cancel" : "+ Add Course"}
      </button>
    </div>

    {/* FORM */}
    {showForm && (
      <div className="bg-white p-6 rounded-2xl shadow mb-8">
        <h2 className="text-xl font-semibold mb-4">Create New Course</h2>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="Course Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border p-2 rounded-lg"
          />

          <textarea
            placeholder="Course Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border p-2 rounded-lg"
          />

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border p-2 rounded-lg"
          >
            <option>Web Development</option>
            <option>Data Science</option>
            <option>Cyber Security</option>
            <option>AI & Machine Learning</option>
          </select>

          <button
            onClick={handleCreateCourse}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
          >
            Create Course
          </button>
        </div>
      </div>
    )}

    {/* COURSE LIST */}
    {courses.length === 0 ? (
      <p className="text-gray-600">No courses created yet...</p>
    ) : (
      <div className="grid md:grid-cols-2 gap-6">
        {courses.map((course) => (
          <div
            key={course.id}
            onClick={() => navigate(`/admincourses/${course.id}`)}
            className="bg-white p-6 rounded-2xl shadow cursor-pointer hover:shadow-lg transition"
          >
            <h3 className="text-xl font-bold">{course.title}</h3>
            <p className="text-gray-600 mt-2">{course.description}</p>

            <span className="inline-block mt-3 text-sm bg-blue-100 text-blue-600 px-3 py-1 rounded-full">
              {course.category}
            </span>
          </div>
        ))}
      </div>
    )}

  </div>
);
}