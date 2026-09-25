import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught application error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F7F6F3",
          fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
          padding: "24px",
          textAlign: "center",
        }}>
          <div style={{
            maxWidth: "460px",
            background: "#FFFFFF",
            padding: "36px 32px",
            borderRadius: "14px",
            border: "1px solid #E8E6E1",
            boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
          }}>
            <h1 style={{
              fontSize: "22px",
              fontWeight: 600,
              color: "#111110",
              marginBottom: "12px",
            }}>
              Something went wrong
            </h1>
            <p style={{
              fontSize: "14px",
              color: "#6B6A66",
              lineHeight: 1.6,
              marginBottom: "24px",
            }}>
              The application encountered an unexpected error. Please refresh the page or return to the home screen.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  background: "#C9A84C",
                  color: "#111110",
                  fontWeight: 600,
                  fontSize: "13px",
                  padding: "10px 20px",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                Reload Page
              </button>
              <a
                href="/"
                style={{
                  background: "#FAFAF8",
                  color: "#111110",
                  fontWeight: 500,
                  fontSize: "13px",
                  padding: "10px 20px",
                  border: "1px solid #E8E6E1",
                  borderRadius: "8px",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                Go Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
