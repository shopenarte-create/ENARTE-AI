import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
import { ServerRouter } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { isbot } from "isbot";
import { addDocumentResponseHeaders } from "./shopify.server";

export const streamTimeout = 5000;

const PROXY_PREFIX = process.env.ENARTE_PROXY_BASENAME || "/apps/enarte-ai";

function rewriteProxyHtml(html) {
  let out = html;
  out = out.replace(/=(["'])\/assets\//g, `=$1${PROXY_PREFIX}/assets/`);
  out = out.replace(/from (["'])\/assets\//g, `from $1${PROXY_PREFIX}/assets/`);
  if (!out.includes(`"${PROXY_PREFIX}/assets/"`) && out.includes('"/assets/')) {
    out = out.replace(/(["'])\/assets\//g, `$1${PROXY_PREFIX}/assets/`);
  }
  const importMap = `<script type="importmap">${JSON.stringify({
    imports: {
      "/assets/": `${PROXY_PREFIX}/assets/`,
    },
  })}</script>`;
  if (out.includes("</head>")) {
    out = out.replace("</head>", `${importMap}</head>`);
  } else {
    out = importMap + out;
  }
  return out;
}

export default async function handleRequest(
  request,
  responseStatusCode,
  responseHeaders,
  reactRouterContext,
) {
  addDocumentResponseHeaders(request, responseHeaders);
  const userAgent = request.headers.get("user-agent");
  const callbackName = isbot(userAgent ?? "") ? "onAllReady" : "onShellReady";
  const isAppProxy = Boolean(
    new URL(request.url).searchParams.get("path_prefix"),
  );
  // Buffer full HTML for proxy so path rewrites never split across chunks.
  const waitForFullHtml = isAppProxy || callbackName === "onAllReady";

  return new Promise((resolve, reject) => {
    let settled = false;
    const chunks = [];

    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={reactRouterContext} url={request.url} />,
      {
        [waitForFullHtml ? "onAllReady" : "onShellReady"]: () => {
          if (!isAppProxy) {
            const body = new PassThrough();
            const stream = createReadableStreamFromReadable(body);
            responseHeaders.set("Content-Type", "text/html");
            settled = true;
            resolve(
              new Response(stream, {
                headers: responseHeaders,
                status: responseStatusCode,
              }),
            );
            pipe(body);
            return;
          }

          const body = new PassThrough();
          body.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
          body.on("end", () => {
            if (settled) return;
            settled = true;
            const html = rewriteProxyHtml(Buffer.concat(chunks).toString("utf8"));
            responseHeaders.set("Content-Type", "text/html; charset=utf-8");
            resolve(
              new Response(html, {
                headers: responseHeaders,
                status: responseStatusCode,
              }),
            );
          });
          body.on("error", reject);
          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          console.error(error);
        },
      },
    );

    setTimeout(abort, streamTimeout + 1000);
  });
}
