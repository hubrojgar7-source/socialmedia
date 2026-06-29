import { ImageKit } from "@imagekit/nodejs";

const ImageKitClass = ImageKit as unknown as {
  new (opts: {
    privateKey?: string;
    publicKey?: string;
    urlEndpoint?: string;
    baseURL?: string;
  }): { privateKey: string };
  Files: new (client: { privateKey: string }) => {
    upload: (body: {
      file: string;
      fileName: string;
      folder?: string;
      useUniqueFileName?: boolean;
    }) => Promise<{ url: string; fileId: string }>;
  };
};

const ik = new ImageKitClass({
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!,
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY!,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
});

const files = new ImageKitClass.Files(ik);

export async function uploadToImageKit(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString("base64");

  const result = await files.upload({
    file: base64,
    fileName: file.name,
    folder: "/socialmedia",
    useUniqueFileName: true,
  });

  return { url: result.url, fileId: result.fileId };
}

export function getImageUrl(path: string) {
  return `${process.env.IMAGEKIT_URL_ENDPOINT}/${path}`;
}
