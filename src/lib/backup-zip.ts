import JSZip from "jszip";

/**
 * Builds a zip in memory from named text files. Used both for the "Download backup"
 * response (server, wrapped in a Buffer) and, in principle, anywhere else a zip of CSVs is
 * needed -- JSZip's arraybuffer output works the same in Node and the browser.
 */
export async function createZip(files: { name: string; content: string }[]): Promise<ArrayBuffer> {
  const zip = new JSZip();
  for (const file of files) zip.file(file.name, file.content);
  return zip.generateAsync({ type: "arraybuffer" });
}

/** Reads every file in an uploaded zip back out as text, keyed by its name inside the archive. */
export async function readZip(data: ArrayBuffer | Uint8Array): Promise<Record<string, string>> {
  const zip = await JSZip.loadAsync(data);
  const result: Record<string, string> = {};
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    result[name] = await entry.async("string");
  }
  return result;
}
