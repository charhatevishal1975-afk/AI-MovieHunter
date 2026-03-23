export default async function handler(req, res) {
  const API_KEY = process.env.GEMINI_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: "Missing API key" });
  }

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
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        }),
      }
    );

    const data = await response.json();

    // 🔥 THIS LINE IS CRITICAL
    if (!response.ok) {
      console.error("Gemini API error:", data);
      return res.status(500).json({ error: data });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || null;

    if (!text) {
      return res.status(500).json({ error: "No response from Gemini" });
    }

    res.status(200).json({ result: text });

  } catch (err) {
    console.error("Server crash:", err);
    res.status(500).json({ error: "Server error" });
  }
}