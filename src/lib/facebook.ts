interface PostResult {
  success: boolean;
  platformPostId?: string;
  error?: string;
}

async function fbPost(endpoint: string, params: Record<string, string>): Promise<PostResult> {
  try {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v) body.append(k, v);
    }
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data.error?.message || `HTTP ${res.status}`;
      console.error("FB API error:", endpoint, msg);
      return { success: false, error: msg };
    }
    return { success: true, platformPostId: data.id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function postToPage(pageId: string, token: string, message: string, imageUrl?: string): Promise<PostResult> {
  if (!imageUrl) {
    return fbPost(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
      message,
      access_token: token,
    });
  }

  // Detect video URLs
  const isVideo = /\.(mp4|mov|avi|mkv|webm|wmv|flv|3gp)$/i.test(imageUrl) || imageUrl.includes("/video/");

  if (isVideo) {
    return fbPost(`https://graph.facebook.com/v21.0/${pageId}/videos`, {
      file_url: imageUrl,
      description: message,
      access_token: token,
    });
  }

  // 1) Upload photo to Facebook to get a media ID
  const photoResult = await fbPost(`https://graph.facebook.com/v21.0/${pageId}/photos`, {
    url: imageUrl,
    published: "false",
    access_token: token,
  });
  if (!photoResult.success) return photoResult;

  // 2) Create a feed post with the photo attached
  return fbPost(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
    message,
    attached_media: JSON.stringify([{ media_fbid: photoResult.platformPostId! }]),
    access_token: token,
  });
}

export async function postToGroup(groupId: string, token: string, message: string, imageUrl?: string): Promise<PostResult> {
  if (!imageUrl) {
    return fbPost(`https://graph.facebook.com/v21.0/${groupId}/feed`, {
      message,
      access_token: token,
    });
  }
  // Groups support direct url posting to /photos
  return fbPost(`https://graph.facebook.com/v21.0/${groupId}/photos`, {
    url: imageUrl,
    message,
    published: "true",
    access_token: token,
  });
}

export async function postToMarketplace(pageId: string, token: string, options: {
  title: string;
  description: string;
  price: string;
  imageUrl?: string;
}): Promise<PostResult> {
  const params: Record<string, string> = {
    name: options.title,
    description: options.description,
    price: options.price,
    access_token: token,
  };
  if (options.imageUrl) params.image_url = options.imageUrl;
  return fbPost(`https://graph.facebook.com/v21.0/${pageId}/marketplace_listings`, params);
}

export async function postToProfile(userId: string, token: string, message: string, imageUrl?: string): Promise<PostResult> {
  if (!imageUrl) {
    return fbPost(`https://graph.facebook.com/v21.0/${userId}/feed`, {
      message,
      access_token: token,
    });
  }
  return fbPost(`https://graph.facebook.com/v21.0/${userId}/photos`, {
    url: imageUrl,
    message,
    published: "true",
    access_token: token,
  });
}
