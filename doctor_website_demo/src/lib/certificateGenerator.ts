export interface CertificateDetails {
  studentName: string;
  courseTitle: string;
  completionDate: string;
  instructorName?: string;
  certificateId: string;
}

/**
 * Generates an authoritative 1-page completion certificate in A4 Landscape
 * using pdf-lib (zero DOM/canvas dependency, runs cleanly in browser & node).
 * Dynamically imports pdf-lib to keep ~400kB out of initial bundle.
 */
export async function generateCertificatePdf(details: CertificateDetails): Promise<Uint8Array> {
  const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");

  const pdfDoc = await PDFDocument.create();
  // Standard A4 Landscape: 841.89 x 595.28 points
  const page = pdfDoc.addPage([841.89, 595.28]);
  const { width, height } = page.getSize();

  const fontTitle = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const fontBody = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBodyBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

  // Palette: Dark Navy & Rich Gold
  const navy = rgb(0.06, 0.12, 0.21);      // #0F1E35
  const gold = rgb(0.79, 0.66, 0.30);      // #C9A84C
  const muted = rgb(0.40, 0.45, 0.52);     // #667285

  // Outer Border (Navy)
  page.drawRectangle({
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    borderColor: navy,
    borderWidth: 2,
  });

  // Inner Border (Gold)
  page.drawRectangle({
    x: 32,
    y: 32,
    width: width - 64,
    height: height - 64,
    borderColor: gold,
    borderWidth: 1.5,
  });

  // Header Title
  const headerText = "CERTIFICATE OF COMPLETION";
  const headerFontSize = 26;
  const headerWidth = fontTitle.widthOfTextAtSize(headerText, headerFontSize);
  page.drawText(headerText, {
    x: (width - headerWidth) / 2,
    y: height - 110,
    size: headerFontSize,
    font: fontTitle,
    color: navy,
  });

  // Eyebrow / Subheading
  const subText = "THIS IS PROUDLY PRESENTED TO";
  const subFontSize = 11;
  const subWidth = fontBody.widthOfTextAtSize(subText, subFontSize);
  page.drawText(subText, {
    x: (width - subWidth) / 2,
    y: height - 145,
    size: subFontSize,
    font: fontBody,
    color: gold,
  });

  // Student Full Name
  const studentName = details.studentName || "Healthcare Professional";
  const nameFontSize = 32;
  const nameWidth = fontTitle.widthOfTextAtSize(studentName, nameFontSize);
  page.drawText(studentName, {
    x: (width - nameWidth) / 2,
    y: height - 210,
    size: nameFontSize,
    font: fontTitle,
    color: navy,
  });

  // Name underline
  page.drawLine({
    start: { x: (width - nameWidth) / 2 - 20, y: height - 222 },
    end: { x: (width + nameWidth) / 2 + 20, y: height - 222 },
    thickness: 1,
    color: gold,
  });

  // Body Context
  const bodyText = "for successfully completing all accredited clinical requirements and academic coursework for";
  const bodyFontSize = 12;
  const bodyWidth = fontBody.widthOfTextAtSize(bodyText, bodyFontSize);
  page.drawText(bodyText, {
    x: (width - bodyWidth) / 2,
    y: height - 260,
    size: bodyFontSize,
    font: fontBody,
    color: muted,
  });

  // Course Title
  const courseTitle = details.courseTitle || "Advanced Clinical Course";
  const courseFontSize = 20;
  const courseWidth = fontBodyBold.widthOfTextAtSize(courseTitle, courseFontSize);
  page.drawText(courseTitle, {
    x: (width - courseWidth) / 2,
    y: height - 300,
    size: courseFontSize,
    font: fontBodyBold,
    color: navy,
  });

  // Signatures and Validation Row
  const sigY = 120;

  // Left Signature: Instructor
  const instructorText = details.instructorName ?? "Dr. A. MedLearn, MBChB";
  page.drawText(instructorText, {
    x: 100,
    y: sigY + 24,
    size: 13,
    font: fontItalic,
    color: navy,
  });
  page.drawLine({
    start: { x: 100, y: sigY + 16 },
    end: { x: 280, y: sigY + 16 },
    thickness: 1,
    color: muted,
  });
  page.drawText("Authorized Instructor / SANC Accredited", {
    x: 100,
    y: sigY,
    size: 10,
    font: fontBody,
    color: muted,
  });

  // Right Signature: Date & Verification
  page.drawText(`Issued: ${details.completionDate || new Date().toISOString().slice(0, 10)}`, {
    x: width - 280,
    y: sigY + 24,
    size: 11,
    font: fontBody,
    color: navy,
  });
  page.drawLine({
    start: { x: width - 280, y: sigY + 16 },
    end: { x: width - 100, y: sigY + 16 },
    thickness: 1,
    color: muted,
  });
  page.drawText(`Certificate ID: ${details.certificateId.slice(0, 18)}`, {
    x: width - 280,
    y: sigY,
    size: 9,
    font: fontBody,
    color: muted,
  });

  return await pdfDoc.save();
}

/**
 * Triggers a direct browser download of generated certificate PDF
 */
export function downloadCertificateFile(pdfBytes: Uint8Array, fileName: string): void {
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
