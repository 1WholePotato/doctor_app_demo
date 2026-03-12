import { useState } from "react";
import { useParams } from "react-router-dom";

interface ClassSession {
  id: number;
  date: string;
  capacity: number;
}

export default function AdminCourseDetails() {
  const { id } = useParams();

  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [date, setDate] = useState("");
  const [capacity, setCapacity] = useState(0);

  const handleAddSession = () => {
    if (!date) return;

    const newSession: ClassSession = {
      id: Date.now(),
      date,
      capacity,
    };

    setSessions([...sessions, newSession]);
    setDate("");
    setCapacity(0);
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">
        Course ID: {id}
      </h1>

      {/* Add Class Session */}
      <div className="bg-white p-6 rounded-2xl shadow mb-8">
        <h2 className="text-xl font-semibold mb-4">Add Class Session</h2>

        <div className="space-y-4">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border p-2 rounded-lg"
          />

          <input
            type="number"
            placeholder="Capacity"
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            className="w-full border p-2 rounded-lg"
          />

          <button
            onClick={handleAddSession}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
          >
            Add Session
          </button>
        </div>
      </div>

      {/* Session List */}
      <div className="space-y-4">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="bg-white p-4 rounded-xl shadow"
          >
            <p><strong>Date:</strong> {session.date}</p>
            <p><strong>Capacity:</strong> {session.capacity}</p>
          </div>
        ))}
      </div>
    </div>
  );
}