import { serveDir } from "@std/http";

const HTML = await Deno.readFile("src/index.html")

Deno.serve((req) => {
  const { pathname } = new URL(req.url);

  // Serve CSS files from the "styles" directory
  if (pathname.endsWith(".css")) {
    return serveDir(req, { fsRoot: "styles" })
  }

  return new Response(HTML, {
    headers: {
      "content-type": "text/html"
    }
  })
});
