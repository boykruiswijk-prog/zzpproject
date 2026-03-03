/**
 * Extract text from a PDF file using pdfjs-dist.
 * Returns { text, warning? } on success, throws on hard failure.
 */
export async function extractTextFromPdf(file: File): Promise<{ text: string; warning?: string }> {
  const pdfjsLib = await import("pdfjs-dist");

  // Set worker - use URL constructor for Vite compatibility
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();

  // Try loading with standard data first
  let pdf;
  try {
    pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
    }).promise;
  } catch (loadErr) {
    console.error("PDF load error:", loadErr);
    // Retry without extra options
    try {
      pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
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
        // Include text with positional newlines for better structure
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
