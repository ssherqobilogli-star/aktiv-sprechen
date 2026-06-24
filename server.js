// Aktiv Sprechen — static fayllarni serve qiladi + /api/story endpoint orqali
// Groq API ni XAVFSIZ tarzda (faqat serverda) chaqiradi.
// GROQ_API_KEY Railway "Variables" bo'limida (VITE_ prefiksisiz!) sozlanishi kerak.

import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
// llama-3.3-70b-versatile 2026-yil 17-iyunda deprecated qilindi (Groq e'lon qildi).
// Tavsiya etilgan almashtiruvchi:
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

const LEVEL_INSTRUCTIONS = {
  A1: "Juda oddiy va qisqa jumlalar. FAQAT hozirgi zamon (Präsens) ishlat. Har jumlada 6-9 so'zdan oshmasin. Murakkab grammatika (Perfekt, Nebensatz, Konjunktiv) ISHLATMA.",
  A2: "Oddiy jumlalar, asosan Präsens va Perfekt zamoni. Oddiy bog'lovchilar (und, aber, weil, dann) ishlatilsin. Har jumla 8-12 so'z.",
  B1: "O'rta darajadagi jumlalar. Perfekt, Präteritum va oddiy ergash gaplar (weil, dass, wenn, obwohl) ishlatilsin. Jumlalar bir-biriga mantiqan bog'langan bo'lsin.",
  B2: "Murakkabroq, ko'p qatlamli jumlalar. Konjunktiv II, Passiv, turli bog'lovchilar (obwohl, während, indem, sodass) erkin ishlatilsin. Uslub adabiy-rasmiyroq bo'lsin.",
};

app.post("/api/story", async (req, res) => {
  try {
    const { words, level } = req.body || {};
    const lvl = (level || "A1").toUpperCase();

    if (!Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ error: "words massivi bo'sh yoki noto'g'ri" });
    }
    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: "GROQ_API_KEY serverda sozlanmagan" });
    }

    const wordList = words
      .map((w) => `${w.article ? w.article + " " : ""}${w.german} (${w.uzbek})`)
      .join(", ");

    const prompt = `Sen tajribali nemis tili o'qituvchisisan.

Quyidagi ${words.length} ta nemis so'zining HAR BIRINI kamida bir marta ishlatib, ${lvl} darajasiga mos, UZUN va MANTIQIY hikoya yoz:

${wordList}

QOIDALAR:
1. Grammatika darajasi: ${LEVEL_INSTRUCTIONS[lvl] || LEVEL_INSTRUCTIONS.A1}
2. Hikoya kamida 12-15 jumladan iborat bo'lsin, boshi-o'rtasi-oxiri aniq, voqea izchil rivojlansin (faqat tasodifiy jumlalar to'plami emas).
3. Ro'yxatdagi BARCHA so'zlarni hikoya matnida ishlat — birortasi tashlab ketilmasin.
4. So'zlarni tabiiy ravishda ishlat, zo'rma-zo'raki tiqishtirma.

Javobni AYNAN shu formatda qaytar (boshqa hech narsa yozma):
[nemischa hikoya matni]
---
[hikoyaning o'zbekcha tarjimasi]`;

    const maxTokens = Math.min(4096, 700 + words.length * 30);

    const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: maxTokens,
      }),
    });

    if (!groqResp.ok) {
      const errText = await groqResp.text();
      console.error("Groq API xatosi:", groqResp.status, errText);
      return res.status(502).json({ error: "Groq API xatosi" });
    }

    const data = await groqResp.json();
    const text = data?.choices?.[0]?.message?.content || "";
    const parts = text.split("---");
    const de = (parts[0] || text).trim();
    const uz = (parts[1] || "").trim();

    res.json({
      content: de,
      translation: uz,
      wordsUsed: words.map((w) => w.german),
    });
  } catch (err) {
    console.error("Server xatosi:", err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// Static fayllarni serve qilish (build chiqishi shu papkada)
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Aktiv Sprechen server ${PORT}-portda ishga tushdi`);
  console.log(`GROQ_API_KEY sozlangan: ${GROQ_API_KEY ? "ha" : "YO'Q — /api/story ishlamaydi!"}`);
});
