import * as esbuild from "esbuild";
import { readFileSync } from "node:fs";

const data = readFileSync("assets/storefront.jpg");
const src = `data:image/jpeg;base64,${data.toString("base64")}`;

await esbuild.build({
  entryPoints: ["shop.js"],
  minify: true,
  outfile: "shop.min.js",
  define: {
    __STOREFRONT__: JSON.stringify(src)
  }
});
