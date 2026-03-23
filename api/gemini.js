export default async function handler(req, res) {
  const API_KEY = process.env.GEMINI_KEY;
  const { prompt } = req.body;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await response.json();

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;

    res.status(200).json({ result: text });

  } catch (err) {
    res.status(500).json({ error: "Gemini failed" });
  }
}