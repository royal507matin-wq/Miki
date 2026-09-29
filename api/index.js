import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1"
});

function json(res, status, data) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

function authorized(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/(?:^|;\s*)mikazi_auth=([^;]+)/);
  return match && match[1] === "1";
}

export default async function handler(req, res) {
  if (req.method === "POST" && req.url.split("?")[0] === "/api/login") {
    let body = {};
    try {
      body = typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
    } catch {}
    const password = String(body.password || "");
    if (!process.env.MIK_PASSWORD || password !== process.env.MIK_PASSWORD) {
      return json(res, 401, { ok: false, error: "رمز ورود اشتباه است." });
    }
    res.setHeader(
      "Set-Cookie",
      "mikazi_auth=1; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800"
    );
    return json(res, 200, { ok: true });
  }

  if (req.method === "POST" && req.url.split("?")[0] === "/api/logout") {
    res.setHeader("Set-Cookie", "mikazi_auth=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
    return json(res, 200, { ok: true });
  }

  if (req.method === "GET" && req.url.split("?")[0] === "/api/session") {
    return json(res, 200, { authenticated: !!authorized(req) });
  }

  if (req.method === "POST" && req.url.split("?")[0] === "/api/chat") {
    if (!authorized(req)) return json(res, 401, { error: "ورود لازم است." });
    if (!process.env.OPENROUTER_API_KEY) {
      return json(res, 500, { error: "OPENROUTER_API_KEY در تنظیمات سرور وارد نشده است." });
    }

    let body = {};
    try {
      body = typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
    } catch {}

    const messages = Array.isArray(body.messages) ? body.messages : [];
    const clean = messages
      .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-30)
      .map(m => ({ role: m.role, content: m.content.slice(0, 12000) }));

    if (!clean.length) return json(res, 400, { error: "پیامی برای ارسال وجود ندارد." });

    try {
      const response = await client.responses.create({
        model: process.env.OPENROUTER_MODEL || "openrouter/free",
        instructions:
          "You are MIKAZI, a private AI assistant. Be helpful, accurate, concise when appropriate, and answer in the user's language. Do not claim to know private facts about the user unless they are explicitly provided in the conversation.",
        input: clean
      });

      return json(res, 200, { ok: true, reply: response.output_text || "پاسخی دریافت نشد." });
    } catch (error) {
      console.error(error);
      return json(res, 500, { error: "ارتباط با هوش مصنوعی برقرار نشد. تنظیمات API را بررسی کن." });
    }
  }

  return json(res, 404, { error: "Not found" });
}
