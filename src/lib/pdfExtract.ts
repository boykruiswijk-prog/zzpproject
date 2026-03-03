/**
 * Extract text from a PDF file using pdfjs-dist v4.
 * Returns { text, warning? } on success, throws on hard failure.
 */
export async function extractTextFromPdf(file: File): Promise<{ text: string; warning?: string }> {
  const pdfjsLib = await import("pdfjs-dist");

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  // Read buffer once - copy for potential retry
  const arrayBuffer = await file.arrayBuffer();

  let pdf;
  try {
    pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) }).promise;
  } catch (loadErr) {
    console.error("PDF load error:", loadErr);
    // Retry with fresh copy
    try {
      pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) }).promise;
    } catch (retryErr) {
      console.error("PDF retry load error:", retryErr);
      throw new Error("PDF kon niet worden geopend. Mogelijk is het bestand beschadigd of beveiligd.");
    }
  }

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => {
        const str = item.str || "";
        const hasEOL = item.hasEOL;
        return str + (hasEOL ? "\n" : "");
      })
      .join(" ");
    fullText += pageText + "\n";
  }

  const trimmed = fullText.trim();

  if (trimmed.length < 20) {
    return {
      text: trimmed,
      warning: "Dit lijkt een gescand document (afbeelding). Er kon weinig tot geen tekst worden uitgelezen. Plak de tekst handmatig in het tekstveld.",
    };
  }

  return { text: trimmed };
}
