import { serveDir } from "@std/http";

const HTML = await Deno.readFile("src/index.html")

Deno.serve((req) => {
  const { pathname } = new URL(req.url);

  // Serve CSS files from the "styles" directory
  if (pathname.endsWith(".css")) {
    return serveDir(req, { fsRoot: "styles" })
  }

  if (pathname.endsWith('.woff2') || pathname.endsWith('.ttf')) {
    return serveDir(req, { fsRoot: "public" })
  }

  return new Response(HTML, {
    headers: {
      "content-type": "text/html"
    }
  })
});
