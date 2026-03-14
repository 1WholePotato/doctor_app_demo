import { useParams } from "react-router-dom";
import { useState } from "react";

interface Session {
  id: number;
  date: string;
  seatsLeft: number;
}

function StudentCourseDetails() {
  const { id } = useParams();

  const [showModal, setShowModal] = useState(false);
  const [bookedSession, setBookedSession] = useState<Session | null>(null);

  const sessions: Session[] = [
    { id: 1, date: "10 April 2026", seatsLeft: 6 },
    { id: 2, date: "17 April 2026", seatsLeft: 4 },
    { id: 3, date: "24 April 2026", seatsLeft: 2 }
  ];

  const courseName = "CPR Training";
  const description = "Learn essential life-saving CPR techniques.";

  const handleBook = (session: Session) => {
    setBookedSession(session);
    setShowModal(true);
  };

  return (
    <div>

      {/* Course Info */}
      <h1 className="text-3xl font-bold mb-3">{courseName}</h1>
      <p className="text-gray-600 mb-8">{description}</p>

      {/* Sessions */}
      <h2 className="text-2xl font-semibold mb-4">Available Sessions</h2>

      <div className="space-y-4">

        {sessions.map((session) => (
          <div
            key={session.id}
            className="bg-white p-6 rounded-2xl shadow flex justify-between items-center"
          >
            <div>
              <p className="font-semibold text-lg">{session.date}</p>
              <p className="text-gray-500 text-sm">
                Seats left: {session.seatsLeft}
              </p>
            </div>

            <button
              onClick={() => handleBook(session)}
              className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700"
            >
              Book Now
            </button>
          </div>
        ))}

      </div>

      {/* Success Modal */}
      {showModal && bookedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">

          <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md text-center">

            <h2 className="text-2xl font-bold mb-4">
              Booking Successful 🎉
            </h2>

            <p className="text-gray-600 mb-6">
              You have successfully booked
              <span className="font-semibold"> {courseName} </span>
              starting on
              <span className="font-semibold"> {bookedSession.date}</span>.
            </p>

            <button
              onClick={() => setShowModal(false)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Close
            </button>

          </div>

        </div>
      )}

    </div>
  );
}

export default StudentCourseDetails;