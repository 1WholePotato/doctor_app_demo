import { Link } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--navy-deep, #0F172A)",
      color: "#F8FAFC",
      padding: "24px",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{
        maxWidth: "460px",
        width: "100%",
        textAlign: "center",
        background: "rgba(30, 48, 80, 0.5)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: "16px",
        padding: "48px 32px",
        backdropFilter: "blur(12px)",
      }}>
        <div style={{
          width: "64px",
          height: "64px",
          borderRadius: "16px",
          background: "rgba(43, 191, 170, 0.15)",
          color: "var(--s-teal, #2BBFAA)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 24px",
        }}>
          <Compass size={32} />
        </div>

        <p style={{
          fontSize: "12px",
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--s-teal, #2BBFAA)",
          marginBottom: "8px",
        }}>
          404 Error
        </p>

        <h1 style={{
          fontFamily: "'Fraunces', serif",
          fontSize: "32px",
          fontWeight: 400,
          lineHeight: 1.2,
          marginBottom: "12px",
          color: "#FFFFFF",
        }}>
          Page not found
        </h1>

        <p style={{
          fontSize: "15px",
          color: "#94A3B8",
          lineHeight: 1.6,
          marginBottom: "32px",
        }}>
          The medical education resource or portal page you are looking for does not exist or may have been moved.
        </p>

        <Link
          to="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "var(--s-teal, #2BBFAA)",
            color: "#0F172A",
            padding: "12px 24px",
            borderRadius: "10px",
            fontWeight: 600,
            fontSize: "14px",
            textDecoration: "none",
            transition: "opacity 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <ArrowLeft size={16} />
          Return to MedLearn Home
        </Link>
      </div>
    </div>
  );
}
