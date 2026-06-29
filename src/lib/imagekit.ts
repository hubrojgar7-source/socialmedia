const privateKey = process.env.IMAGEKIT_PRIVATE_KEY!;
const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT!;

export async function uploadToImageKit(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString("base64");

  const res = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(privateKey + ":").toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      file: base64,
      fileName: file.name,
      folder: "/socialmedia",
      useUniqueFileName: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ImageKit upload failed: ${err}`);
  }

  return res.json() as Promise<{ url: string; fileId: string }>;
}

export function getImageUrl(path: string) {
  return `${urlEndpoint}/${path}`;
}
