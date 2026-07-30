// Checks the Owner panel passcode server-side, so it's never shipped inside
// the client-side JavaScript bundle (unlike a passcode baked into React
// code, which anyone can read from the page source).

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end("Method Not Allowed");
  }
  const { passcode } = req.body || {};
  if (passcode && passcode === process.env.OWNER_PASSCODE) {
    return res.status(200).json({ ok: true });
  }
  return res.status(401).json({ ok: false });
}
