export default async function handler(req, res) {
  const API_KEY = process.env.GEMINI_KEY;
  const { prompt } = req.body;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${GEMINI_API_KEY}`,
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

    if (!response.ok) {
      console.error("Gemini error:", data);
      return res.status(500).json({ error: data });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || null;

    res.status(200).json({ result: text });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}