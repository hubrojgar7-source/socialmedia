interface PostResult {
  success: boolean;
  platformPostId?: string;
  error?: string;
}

export async function postToPage(pageId: string, token: string, message: string, imageUrl?: string): Promise<PostResult> {
  try {
    const body: Record<string, string> = { message, access_token: token };
    if (imageUrl) body.url = imageUrl;

    const endpoint = imageUrl
      ? `https://graph.facebook.com/v21.0/${pageId}/photos`
      : `https://graph.facebook.com/v21.0/${pageId}/feed`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error?.message || "Unknown error" };

    return { success: true, platformPostId: data.id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function postToGroup(groupId: string, token: string, message: string, imageUrl?: string): Promise<PostResult> {
  try {
    const body: Record<string, string> = { message, access_token: token };
    if (imageUrl) body.url = imageUrl;

    const endpoint = imageUrl
      ? `https://graph.facebook.com/v21.0/${groupId}/photos`
      : `https://graph.facebook.com/v21.0/${groupId}/feed`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error?.message || "Unknown error" };

    return { success: true, platformPostId: data.id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function postToMarketplace(pageId: string, token: string, options: {
  title: string;
  description: string;
  price: string;
  imageUrl?: string;
}): Promise<PostResult> {
  try {
    const body: Record<string, string> = {
      name: options.title,
      description: options.description,
      price: options.price,
      access_token: token,
    };
    if (options.imageUrl) body.image_url = options.imageUrl;

    const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/marketplace_listings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error?.message || "Unknown error" };

    return { success: true, platformPostId: data.id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function postToProfile(userId: string, token: string, message: string, imageUrl?: string): Promise<PostResult> {
  try {
    const body: Record<string, string> = { message, access_token: token };
    if (imageUrl) body.url = imageUrl;

    const endpoint = imageUrl
      ? `https://graph.facebook.com/v21.0/${userId}/photos`
      : `https://graph.facebook.com/v21.0/${userId}/feed`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error?.message || "Unknown error" };

    return { success: true, platformPostId: data.id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
