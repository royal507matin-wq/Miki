import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");

function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2];
    }
  }
}

loadEnv();

const client = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

function send(res, status, type, body, headers = {}) {
  res.writeHead(status, {
    "Content-Type": type,
    ...headers
  });
  res.end(body);
}

function json(res, status, data, headers = {}) {
  send(
    res,
    status,
    "application/json; charset=utf-8",
    JSON.stringify(data),
    headers
  );
}

function cookieAuth(req) {
  const cookie = req.headers.cookie || "";
  return /(?:^|;\s*)mikazi_auth=1(?:;|$)/.test(cookie);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";

    req.on("data", chunk => {
      data += chunk;

      if (data.length > 10_000_000) {
        reject(new Error("body too large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        resolve({});
      }
    });

    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  try {
    if (url.pathname === "/api/login" && req.method === "POST") {
      const body = await readBody(req);

      if (
        !process.env.MIK_PASSWORD ||
        String(body.password || "") !== process.env.MIK_PASSWORD
      ) {
        return json(res, 401, {
          ok: false,
          error: "رمز ورود اشتباه است."
        });
      }

      return json(
        res,
        200,
        { ok: true },
        {
          "Set-Cookie":
            "mikazi_auth=1; Path=/; HttpOnly; SameSite=Strict"
        }
      );
    }

    if (url.pathname === "/api/logout" && req.method === "POST") {
      return json(
        res,
        200,
        { ok: true },
        {
          "Set-Cookie":
            "mikazi_auth=; Path=/; HttpOnly; Max-Age=0; SameSite=Strict"
        }
      );
    }

    if (url.pathname === "/api/session" && req.method === "GET") {
      return json(res, 200, {
        authenticated: cookieAuth(req)
      });
    }

    if (url.pathname === "/api/chat" && req.method === "POST") {
      if (!cookieAuth(req)) {
        return json(res, 401, {
          error: "ورود لازم است."
        });
      }

      if (!process.env.GEMINI_API_KEY) {
        return json(res, 500, {
          error: "GEMINI_API_KEY در فایل .env وارد نشده است."
        });
      }

      const body = await readBody(req);
      const messages = Array.isArray(body.messages)
        ? body.messages
        : [];

      const memory = Array.isArray(body.memory) ? body.memory.filter(x => typeof x === "string").slice(0, 50) : [];
      const clean = messages
        .filter(
          m =>
            m &&
            (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string"
        )
        .slice(-30)
        .map(m => ({
          role: m.role,
          content: m.content.slice(0, 12000)
        }));

      const response = await client.chat.completions.create({
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are MIKAZI, a private AI assistant. User memory: " + (memory.length ? memory.join(" | ") : "none") + "."
          },
          ...clean
        ]
      });

      return json(res, 200, {
        ok: true,
        reply:
          response.choices?.[0]?.message?.content ||
          "پاسخی دریافت نشد."
      });
    }

    let file =
      url.pathname === "/"
        ? "index.html"
        : url.pathname.replace(/^\/+/, "");

    const full = path.normalize(
      path.join(publicDir, file)
    );

    if (!full.startsWith(publicDir)) {
      return send(res, 403, "text/plain", "Forbidden");
    }

    if (
      !fs.existsSync(full) ||
      fs.statSync(full).isDirectory()
    ) {
      return send(res, 404, "text/plain", "Not found");
    }

    const ext = path.extname(full);

    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".svg": "image/svg+xml"
    };

    return send(
      res,
      200,
      types[ext] || "application/octet-stream",
      fs.readFileSync(full)
    );

  } catch (e) {
    console.error(e);

    return json(res, 500, {
      error: "خطای داخلی سرور."
    });
  }
});

server.listen(process.env.PORT || 3000, () => {
  console.log(
    `MIKAZI is running on http://localhost:${process.env.PORT || 3000}`
  );
});
