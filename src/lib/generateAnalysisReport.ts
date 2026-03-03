import type { DbaCheck } from "@/hooks/useDbaChecks";

export async function generateAnalysisReport(check: DbaCheck) {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const loadImage = async (url: string): Promise<string> => {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  };

  const [zpLogo, onefellowLogo] = await Promise.all([
    loadImage("/templates/zp-approved-export.png"),
    loadImage("/templates/onefellow-export.png"),
  ]);

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const score = check.suggestions?.[0]?.score ?? 0;
  const summary = check.suggestions?.[0]?.summary ?? "";

  // Header logos
  doc.addImage(zpLogo, "PNG", 14, 10, 36, 18);
  doc.addImage(onefellowLogo, "PNG", pageWidth - 54, 14, 40, 10);

  // Title
  let y = 38;
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Wet DBA Analyserapport", pageWidth / 2, y, { align: "center" });

  y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Gegenereerd op ${new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}`, pageWidth / 2, y, { align: "center" });
  doc.setTextColor(0);

  // Candidate info
  y += 12;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Kandidaat", 14, y);
  y += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(check.client_name, 14, y);

  // Score section
  y += 12;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Compliance Score", 14, y);
  y += 8;

  // Score bar background
  const barWidth = pageWidth - 28;
  const barHeight = 8;
  doc.setFillColor(230, 230, 230);
  doc.roundedRect(14, y, barWidth, barHeight, 2, 2, "F");

  // Score bar fill
  const fillWidth = (score / 100) * barWidth;
  if (score >= 75) {
    doc.setFillColor(34, 197, 94);
  } else if (score >= 50) {
    doc.setFillColor(234, 179, 8);
  } else {
    doc.setFillColor(239, 68, 68);
  }
  doc.roundedRect(14, y, fillWidth, barHeight, 2, 2, "F");

  // Score text
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`${score}%`, pageWidth - 14, y + 6, { align: "right" });

  y += 14;

  // Status warning
  doc.setFillColor(255, 243, 205);
  doc.roundedRect(14, y, pageWidth - 28, 16, 2, 2, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(146, 100, 0);
  doc.text("! Score onder 75% - Certificering niet mogelijk", 20, y + 10);
  doc.setTextColor(0);

  y += 22;

  // Summary
  if (summary) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(summary, pageWidth - 28);
    doc.text(lines, 14, y);
    y += lines.length * 5 + 6;
  }

  // Field results table
  if (check.field_results?.length) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Veldencontrole", 14, y);
    y += 4;

    const tableData = check.field_results.map((field) => {
      const ok = field.present ?? field.filled;
      return [
        ok ? "V" : "X",
        field.field_name,
        ok ? (field.excerpt || field.value || "-") : (field.issue || "Ontbreekt"),
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [["", "Veld", "Resultaat"]],
      body: tableData,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [30, 64, 124] },
      columnStyles: {
        0: { cellWidth: 10, halign: "center", fontStyle: "bold" },
        1: { cellWidth: 55 },
      },
      didParseCell: (data: any) => {
        if (data.column.index === 0 && data.section === "body") {
          if (data.cell.raw === "V") {
            data.cell.styles.textColor = [34, 197, 94];
          } else {
            data.cell.styles.textColor = [239, 68, 68];
          }
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Missing fields / aandachtspunten
  if (check.missing_fields?.length) {
    // Check if we need a new page
    if (y > 240) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Aandachtspunten", 14, y);
    y += 7;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    check.missing_fields.forEach((field) => {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      doc.text(`•  ${field}`, 16, y);
      y += 6;
    });

    y += 4;
  }

  // KVK check result
  if (check.kvk_check_result) {
    if (y > 240) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("KVK Check", 14, y);
    y += 7;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const kvkStatus = check.kvk_check_result.match ? "V Match" : "X Geen match";
    doc.text(kvkStatus, 14, y);
    y += 6;

    if (check.kvk_check_result.explanation) {
      const expLines = doc.splitTextToSize(check.kvk_check_result.explanation, pageWidth - 28);
      doc.text(expLines, 14, y);
      y += expLines.length * 5 + 4;
    }

    if (check.kvk_check_result.suggestions?.length) {
      doc.setFont("helvetica", "bold");
      doc.text("Suggesties:", 14, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      check.kvk_check_result.suggestions.forEach((s: string) => {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }
        doc.text(`•  ${s}`, 16, y);
        y += 6;
      });
    }

    y += 4;
  }

  // Polis check
  const polisResult = check.suggestions?.[0]?.polis_check_result;
  if (polisResult) {
    if (y > 240) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Polis Check", 14, y);
    y += 7;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    if (polisResult.coverage_summary) {
      const covLines = doc.splitTextToSize(`Dekking: ${polisResult.coverage_summary}`, pageWidth - 28);
      doc.text(covLines, 14, y);
      y += covLines.length * 5 + 4;
    }
    if (polisResult.explanation) {
      const expLines = doc.splitTextToSize(polisResult.explanation, pageWidth - 28);
      doc.text(expLines, 14, y);
      y += expLines.length * 5 + 4;
    }
  }

  // Rewritten description
  if (check.rewritten_description) {
    if (y > 220) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Herschreven opdrachtomschrijving (DBA-proof)", 14, y);
    y += 7;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const rwLines = doc.splitTextToSize(check.rewritten_description, pageWidth - 28);
    doc.text(rwLines, 14, y);
    y += rwLines.length * 4 + 4;
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const h = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150);
    doc.text("ZP Approved - Analyserapport | www.zpzaken.nl", pageWidth / 2, h - 10, { align: "center" });
    doc.text(`Pagina ${i} van ${pageCount}`, pageWidth - 14, h - 10, { align: "right" });
    doc.setTextColor(0);
  }

  doc.save(`analyserapport-${check.client_name.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}
