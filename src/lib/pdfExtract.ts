/**
 * Extract text from a PDF file using pdfjs-dist v4.
 */
export async function extractTextFromPdf(file: File): Promise<{ text: string; warning?: string }> {
  const pdfjsLib = await import("pdfjs-dist");

  // Set worker path for pdfjs-dist v4
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
  }

  const arrayBuffer = await file.arrayBuffer();

  let pdf;
  try {
    pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) }).promise;
  } catch (loadErr) {
    console.error("PDF load error:", loadErr);
    throw new Error("PDF kon niet worden geopend. Controleer of het bestand niet beschadigd of beveiligd is.");
  }

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str || "")
      .filter((s: string) => s.trim().length > 0)
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
