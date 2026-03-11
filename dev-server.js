import { createServer } from "node:http";
import { parse } from "node:url";
import { config } from "dotenv";

config();

const PORT = 3001;

const routes = {
  "/api/spotify/search": () => import("./api/spotify/search.js"),
  "/api/spotify/recommend": () => import("./api/spotify/recommend.js"),
  "/api/listenbrainz/recommend": () =>
    import("./api/listenbrainz/recommend.js"),
  "/api/lastfm/recommend": () => import("./api/lastfm/recommend.js"),
  "/api/health": () => import("./api/health.js"),
};

createServer(async (req, res) => {
  const { pathname, query } = parse(req.url, true);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const loader = routes[pathname];
  if (!loader) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  req.query = query;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(data));
  };

  try {
    const mod = await loader();
    await mod.default(req, res);
  } catch (err) {
    console.error(err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
}).listen(PORT, () => {
  console.log(`API dev server running on http://localhost:${PORT}`);
});
