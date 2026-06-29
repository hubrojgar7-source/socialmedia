interface ProductContext {
  name: string;
  description: string | null;
  price: string | null;
  stockStatus: string;
  images: string[] | null;
}

const nepaliCorrections: [RegExp, string][] = [
  [/hjur/gi, "hajur"],
  [/\bsnga\b/gi, "sanga"],
  [/moble/gi, "mobile"],
  [/iphon/gi, "iphone"],
  [/sam[ns][ua]/gi, "samsung"],
  [/\bprce\b/gi, "price"],
  [/\bpric\b/gi, "price"],
  [/delivry/gi, "delivery"],
  [/stok/gi, "stock"],
  [/avail/gi, "available"],
  [/\bxxa\b/gi, "xa"],
  [/kat[ii]+/gi, "kati"],
  [/\bsanchi\b/gi, "sanchai"],
  [/\btelemitry\b/gi, "telemetry"],
  [/\btelemtry\b/gi, "telemetry"],
  [/\bavl\b/gi, "available"],
  [/\bdy\b/gi, "delivery"],
  [/\bsman\b/gi, "samsung"],
  [/\bsamna\b/gi, "samsung"],
  [/\bxaa+\b/gi, "xa"],
  [/\bchaina\b/gi, "chaina"],
  [/\bchha\b/gi, "cha"],
  [/\bhunxa\b/gi, "huncha"],
  [/\bmilxa\b/gi, "milcha"],
  [/\bdinu\b/gi, "dinu"],
  [/\bgarna\b/gi, "garna"],
  [/\border\b/gi, "order"],
];

function normalizeInput(text: string): string {
  let normalized = text.toLowerCase().trim();
  for (const [pattern, replacement] of nepaliCorrections) {
    normalized = normalized.replace(pattern, replacement);
  }
  normalized = normalized.replace(/\s+/g, " ").trim();
  return normalized;
}

interface Provider {
  name: string;
  baseUrl: string;
  model: string;
  apiKey: string;
}

const providers: (Provider | null)[] = [
  process.env.GEMINI_API_KEY
    ? { name: "Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.0-flash", apiKey: process.env.GEMINI_API_KEY }
    : null,
].filter(Boolean) as Provider[];

const rateLimitedUntil: Record<string, number> = {};

function searchProducts(message: string, inventory: ProductContext[]): {
  matched: ProductContext[];
  hasProductQuery: boolean;
  message: string;
} {
  const words = message.toLowerCase().split(/\s+/);
  const productKeywords = ["price", "cost", "kati", "xa?", "chaina", "available", "stock", "chahiyo", "have", "do you", "kun", "ma xa", "sanga xa"];

  const hasProductQuery = productKeywords.some((kw) => message.toLowerCase().includes(kw));
  const matched = inventory.filter((p) => {
    const name = p.name.toLowerCase();
    return name.split(/\s+/).some((word) => word.length > 2 && words.includes(word))
      || words.some((w) => name.includes(w) && w.length > 2)
      || (p.description && words.some((w) => p.description!.toLowerCase().includes(w) && w.length > 3));
  });

  return { matched, hasProductQuery, message };
}

function buildPrompt(customerMessage: string, customerName: string, businessName: string, matchedProducts: ProductContext[]): string {
  const productSection = matchedProducts.length > 0
    ? matchedProducts.map((p) =>
        `- ${p.name}${p.price ? ` ($${p.price})` : ""}${p.description ? `: ${p.description.slice(0, 100)}` : ""} — ${p.stockStatus === "in_stock" ? "In Stock" : p.stockStatus === "low_stock" ? "Low Stock" : "Sold Out"}`
      ).join("\n")
    : "No matching product found. Ask for the product name, brand, or model. DO NOT invent any product or price.";

  return `You are a friendly sales agent for "${businessName}". Reply to the customer based ONLY on the data below.

ABSOLUTELY NEVER use placeholder text like [Business Name] or [industry]. Always say "${businessName}".

Customer name: ${customerName}
Customer message: "${customerMessage}"

## Matching Products
${productSection}

## Language Understanding Rules

### Language Support
The customer may communicate in ANY language: English, Nepali (Unicode), Romanized Nepali (Nepanglish), Mixed English+Nepali, Hindi, or any other language. Always understand and respond appropriately.

### Romanized Nepali (Nepanglish)
Understand common expressions like: k xa, k cha, kk xa, sanchai, sanchai ho?, hajur, hajur sanga, xa?, chaina?, kati ho?, dinu hunxa?, cha ni?, yo xa?, ramro xa?, hunxa?, available xa?, order garna milxa?, delivery hunxa?

### Typo Handling
Customers may type quickly. Silently interpret intended meaning. NEVER tell the customer they made a mistake.

### Mixed Language Examples
- "iPhone ko price kati ho?" — "Delivery free xa?" — "Yo available cha?" — "Samsung ko charger cha?"
Treat all as normal messages.

### If Meaning Is Ambiguous
Ask a short clarification question instead of guessing. Example — Customer: "charger xa?" → "Kun phone ko charger khojnu bhayeko ho? Samsung, iPhone, ki aru kunai model?"

### Never Guess Products
If the ## Matching Products section says "No matching product found", ask for the product name, brand, or model. NEVER invent products or prices.

### Reply Language
Reply in the customer's preferred language. Customer writes in Nepali → reply in Nepali. Customer writes in English → reply in English. Customer writes mixed → match their mix.

### Tone
Be natural, conversational, 1-3 sentences max. Use polite Nepali where appropriate: Hajur, Namaste, Dhanyabad, Kripaya, Maaf garnuhos.

Reply as a sales agent from ${businessName}:`;
}

function cleanReply(reply: string, businessName: string): string {
  return reply
    .replace(/\[Business Name\]/gi, businessName)
    .replace(/\[business name\]/gi, businessName)
    .replace(/\[industry.*?\]/gi, "")
    .replace(/\[product.*?\]/gi, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function callProvider(provider: Provider, prompt: string, businessName: string): Promise<string | null> {
  try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (provider.name === "Gemini") {
        headers["x-goog-api-key"] = provider.apiKey;
      } else {
        headers["Authorization"] = `Bearer ${provider.apiKey}`;
      }
      const res = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: "POST",
        headers,
      body: JSON.stringify({
        model: provider.model,
        messages: [
          { role: "system", content: `You are a sales agent for "${businessName}". Reply in the customer's language (English, Nepali, mixed — match them). NEVER use brackets like [Business Name]. Always say "${businessName}". Never invent products. Be concise: 1-3 sentences.` },
          { role: "user", content: prompt },
        ],
        max_tokens: 300,
        temperature: 0.5,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (res.status === 429) {
      rateLimitedUntil[provider.name] = Date.now() + 60_000;
      return null;
    }

    if (!res.ok) {
      console.warn(`${provider.name} returned ${res.status}: ${await res.text()}`);
      return null;
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || null;
    return raw ? cleanReply(raw, businessName) : null;
  } catch (err) {
    console.warn(`${provider.name} error:`, err);
    return null;
  }
}

function ruleBasedReply(message: string, inventory: ProductContext[], businessName: string, customerName: string): string {
  const lower = message.toLowerCase().trim();

  // Use the same product search as the AI pipeline
  const { matched } = searchProducts(message, inventory);

  // Nepali / Nepanglish detection — broad: "xa", "cha", "hola", "hajur", devanagari, etc.
  const isNepali = /[क-ह]/.test(lower) || /\b(xa|cha|hola|hajur|sanchai|dinu|milxa|hunxa|chaina|kati|ramro|gar|ma|ko|yo|tyo|bata|sanga)\b/i.test(lower);

  // Product query: asking about availability or a specific item
  const isProductQuery = /\b(xa\??$|chaina|available|stock|price|kati|dinu|magauna|order)\b/i.test(lower)
    || /\b(receiver|mobile|phone|charger|earphone|headphone|speaker|cable|adapter|battery|case|cover|screen|case)\b/i.test(lower);

  if (isProductQuery && matched.length > 0) {
    const list = matched.map(p =>
      `${p.name}${p.price ? ` ($${p.price})` : ""} — ${p.stockStatus === "in_stock" ? "In Stock" : p.stockStatus === "low_stock" ? "Low Stock" : "Sold Out"}`
    ).join("\n");
    if (isNepali) {
      return `Namaste ${customerName}! ${businessName} ma yiniharu products upalabda chan:\n${list}\n\nKun ko barema janakari chahiyo?`;
    }
    return `Hi ${customerName}! Here are matching products from ${businessName}:\n${list}\n\nWhich one would you like to know more about?`;
  }

  if (isProductQuery && matched.length === 0) {
    if (isNepali) {
      return `Namaste ${customerName}! ${businessName} ma tapailai chahiyeko product bhetiyena. Kripaya product ko naam, brand, ya model bhanidinus.`;
    }
    return `Hi ${customerName}! I couldn't find that product in ${businessName}'s inventory. Could you tell me the product name, brand, or model?`;
  }

  if (isNepali) {
    if (/\b(namaste|namaskar|hello|hi)\b/i.test(lower)) {
      return `Namaste ${customerName}! ${businessName} ma swagat cha. Ma yaha tapailai sahayata garna ko lagi chu. Kati sahayata chahiyo?`;
    }
    if (/\b(k xa|k cha|sanchai)\b/i.test(lower)) {
      return `Sanchai cha ${customerName}! ${businessName} bata kura gardai chu. Kati sahayata chahiyo?`;
    }
    if (/\b(price|kati|cost|mulya|मूल्य)\b/i.test(lower)) {
      if (inventory.length > 0) {
        const prices = inventory.map(p => `${p.name} $${p.price}`).join(", ");
        return `${businessName} ma ${prices} cha. Kun product ko barema janakari chahiyo?`;
      }
      return `${businessName} ma dherai products upalabda chan. Kun product ko barema janakari chahiyo?`;
    }
    if (/\b(who|को|ke ho|के हो)\b/i.test(lower)) {
      return `Ma ${businessName} ko sales assistant hu. Tapailai kunai sahayata chahiyeko cha?`;
    }
    if (/\b(thank|dhanyabad|धन्य)\b/i.test(lower)) {
      return `Dhanyabad ${customerName}! Feri kunai sahayata chahiyo bhane ${businessName} ma samparka garnuhos.`;
    }
    if (/\b(bye|alvida|goodbye)\b/i.test(lower)) {
      return `Alvida ${customerName}! ${businessName} ma feri bhetna paayau bhane khushi hunechaau.`;
    }
    return `Namaste ${customerName}! Ma ${businessName} bata kura gardai chu. Tapailai kun sahayata chahiyo?`;
  }

  // English
  if (/\b(hello|hi|hey)\b/i.test(lower)) {
    return `Hi ${customerName}! Welcome to ${businessName}. How can I help you today?`;
  }
  if (/\b(thank|thanks)\b/i.test(lower)) {
    return `You're welcome, ${customerName}! Let me know if you need anything else from ${businessName}.`;
  }
  if (/\b(bye|goodbye)\b/i.test(lower)) {
    return `Goodbye ${customerName}! Feel free to reach out to ${businessName} anytime.`;
  }
  if (/\b(hours|open|location|address)\b/i.test(lower)) {
    return `Thanks for asking! Someone from ${businessName} will get back to you shortly with our hours and location.`;
  }
  if (/\b(who|what is|about)\b/i.test(lower)) {
    return `We're ${businessName} — happy to help! Check out our products or ask me anything.`;
  }

  return `Hi ${customerName}! Welcome to ${businessName}. I can help you find products, check prices and availability. What are you looking for today?`;
}

export async function generateAutoReply(
  customerMessage: string,
  customerName: string,
  inventory: ProductContext[],
  businessName: string
): Promise<string | null> {
  const normalized = normalizeInput(customerMessage);
  const { matched } = searchProducts(normalized, inventory);
  const prompt = buildPrompt(normalized, customerName, businessName, matched);

  const now = Date.now();
  for (const name of Object.keys(rateLimitedUntil)) {
    if (now > rateLimitedUntil[name]) delete rateLimitedUntil[name];
  }

  const available = providers.filter((p): p is Provider => p !== null && !rateLimitedUntil[p.name]);

  for (const provider of available) {
    const reply = await callProvider(provider, prompt, businessName);
    if (reply) return reply;
  }

  return ruleBasedReply(normalized, inventory, businessName, customerName);
}
