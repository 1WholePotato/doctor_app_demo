import { describe, it, expect } from "vitest";
import { generateCertificatePdf } from "../src/lib/certificateGenerator";
import { PDFDocument } from "pdf-lib";

describe("Certificate PDF Generator (Issue #3)", () => {
  it("generates a valid 1-page PDF document with correct metadata", async () => {
    const details = {
      studentName: "Dr. Jane Doe",
      courseTitle: "Advanced Pediatric Life Support",
      completionDate: "2026-09-25",
      instructorName: "Dr. A. MedLearn, MBChB",
      certificateId: "cert-uuid-1234-5678",
    };

    const pdfBytes = await generateCertificatePdf(details);

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(1000); // Ensures valid binary payload

    // Validate that pdf-lib can parse the output and it contains exactly 1 page
    const parsedPdf = await PDFDocument.load(pdfBytes);
    expect(parsedPdf.getPageCount()).toBe(1);

    const page = parsedPdf.getPage(0);
    const { width, height } = page.getSize();
    // Standard A4 landscape dimensions: ~841.89 x ~595.28
    expect(Math.round(width)).toBe(842);
    expect(Math.round(height)).toBe(595);
  });

  it("handles fallback defaults gracefully when optional fields are omitted", async () => {
    const pdfBytes = await generateCertificatePdf({
      studentName: "",
      courseTitle: "",
      completionDate: "",
      certificateId: "fallback-id",
    });

    const parsedPdf = await PDFDocument.load(pdfBytes);
    expect(parsedPdf.getPageCount()).toBe(1);
  });
});
