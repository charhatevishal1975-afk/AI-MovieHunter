export default async function handler(req, res) {
  const API_KEY = process.env.OMDB_KEY;

  const { title, id, search } = req.query;

  let url = `https://www.omdbapi.com/?apikey=${API_KEY}`;

  if (title) {
    url += `&t=${encodeURIComponent(title)}`;
  } else if (id) {
    url += `&i=${id}`;
  } else if (search) {
    url += `&s=${encodeURIComponent(search)}`;
  } else {
    return res.status(400).json({ error: "No valid query" });
  }

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "OMDB failed" });
  }
}