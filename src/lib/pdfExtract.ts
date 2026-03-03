/**
 * Extract text from a PDF file using pdfjs-dist.
 * Disables the worker to avoid Vite cache version mismatches.
 */
export async function extractTextFromPdf(file: File): Promise<{ text: string; warning?: string }> {
  const pdfjsLib = await import("pdfjs-dist");

  // Disable worker to avoid version mismatch issues with Vite's dep cache
  pdfjsLib.GlobalWorkerOptions.workerSrc = "";
  
  const arrayBuffer = await file.arrayBuffer();

  let pdf;
  try {
    pdf = await (pdfjsLib as any).getDocument({ 
      data: new Uint8Array(arrayBuffer.slice(0)),
      disableWorker: true,
    }).promise;
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
