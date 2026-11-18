import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { fetchPrintedDemand, formatDate, type PrintedDemandRow } from "../lib/adminBookings";
import "../styles/adminBookings.css";

export default function AdminPrintedMaterial() {
  const [rows, setRows] = useState<PrintedDemandRow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await fetchPrintedDemand();
      if (cancelled) return;
      setRows(result.rows);
      setLoadError(result.error ?? "");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const total = rows.reduce((sum, row) => sum + row.booksNeeded, 0);

  return (
    <main className="ac-main">
      <div className="ac-header">
        <div className="ac-header-left">
          <p className="eyebrow">Ordering</p>
          <h1>Printed material</h1>
        </div>
      </div>
      <p className="course-help">
        Printed books to order for each upcoming class: confirmed bookings plus seats still held for payment. Lapsed holds, cancelled bookings and electronic material are not counted.
      </p>

      {loadError && <p className="load-error"><AlertCircle />{loadError}</p>}

      <div className="table-card">
        {loading ? <p className="table-empty">Loading classes…</p> : rows.length === 0 ? (
          <p className="table-empty">No upcoming classes.</p>
        ) : (
          <table className="table-inner">
            <thead>
              <tr>
                <th>Class</th>
                <th>Course</th>
                <th>Location</th>
                <th>Confirmed</th>
                <th>Held</th>
                <th>Books to order</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.classId}>
                  <td>{formatDate(row.startDate)} {row.startTime}</td>
                  <td><Link to={`/admincourses/${row.courseId}`}>{row.courseTitle}</Link></td>
                  <td>{row.locationName}</td>
                  <td>{row.confirmed}</td>
                  <td>{row.held}</td>
                  <td><strong>{row.booksNeeded}</strong></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}>All upcoming classes</td>
                <td><strong>{total}</strong></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </main>
  );
}
