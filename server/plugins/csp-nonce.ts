const NUXT_INLINE_SCRIPT =
  /<script(?![^>]*\bnonce=)([^>]*)>(?=\s*(?:window\.__NUXT__=|!function\(\)\{const e=document\.createElement\("link"\)\.relList))/gi;

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("render:html", (html, context) => {
    const nonce = String(context.event.context.cspNonce || "");
    if (!nonce) return;

    for (const area of ["head", "body", "bodyAppend", "bodyPrepend"] as const) {
      html[area] = html[area].map((fragment) =>
        fragment.replace(NUXT_INLINE_SCRIPT, `<script nonce="${nonce}"$1>`),
      );
    }
  });
});
