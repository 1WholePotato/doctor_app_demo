import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface Course {
    id: number;
    title: string;
    description: string;
}

export default function AdminCourse() {
    const [courses, setCourses] = useState<Course[]>([]);
    const [title, setTitle] = useState("");
    const[description, setDescription] = useState("");

    const navigate = useNavigate();

    const handleCreateCourse = () => {
    if (!title) return;

    const newCourse: Course = {
      id: Date.now(),
      title,
      description,
    };

    setCourses([...courses, newCourse]);
    setTitle("");
    setDescription("");
  };

  return(
    <div>
      <h1 className="text-3xl font-bold mb-6">Courses</h1>

      {/* Create Course Form */}
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

          <button
            onClick={handleCreateCourse}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Create Course
          </button>
        </div>
      </div>

      {/* Course List */}
      <div className="grid md:grid-cols-2 gap-6">
        {courses.map((course) => (
          <div
            key={course.id}
            onClick={() => navigate(`/courses/${course.id}`)}
            className="bg-white p-6 rounded-2xl shadow cursor-pointer hover:shadow-lg transition"
          >
            <h3 className="text-xl font-bold">{course.title}</h3>
            <p className="text-gray-600 mt-2">{course.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
  


}