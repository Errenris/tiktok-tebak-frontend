export default async function handler(req, res) {
  const backend = process.env.NEXT_PUBLIC_BACKEND;
  const path = req.query.path;
  const body = req.body;

  const response = await fetch(`${backend}/admin/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {})
  });

  const data = await response.text();
  res.status(response.status).send(data);
}
