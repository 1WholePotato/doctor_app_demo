import React from "react";

export function Skeleton({
  width = "100%",
  height = "16px",
  borderRadius = "6px",
  className = "",
  style,
}: {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`skeleton-pulse ${className}`}
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

export function CourseCardSkeleton({ isDark = false }: { isDark?: boolean }) {
  const bg = isDark ? "#FFFFFF" : "#FFFFFF";
  return (
    <div
      style={{
        background: bg,
        border: "1px solid #E8E6E1",
        borderRadius: "14px",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Skeleton width="60%" height={22} borderRadius={6} />
        <Skeleton width="25%" height={22} borderRadius={12} />
      </div>
      <Skeleton width="100%" height={14} />
      <Skeleton width="85%" height={14} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
        <Skeleton width="40%" height={24} borderRadius={12} />
        <Skeleton width="20%" height={24} borderRadius={6} />
      </div>
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr style={{ borderBottom: "1px solid #E8E6E1" }}>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: "16px 20px" }}>
          <Skeleton width={i === 0 ? "70%" : "50%"} height={16} />
        </td>
      ))}
    </tr>
  );
}

export function StatCardSkeleton() {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E8E6E1",
        borderRadius: "14px",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <Skeleton width="40%" height={14} />
      <Skeleton width="60%" height={32} borderRadius={8} />
      <Skeleton width="30%" height={12} />
    </div>
  );
}
