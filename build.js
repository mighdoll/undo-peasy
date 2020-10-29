const { build } = require("esbuild");

const production = process.argv[2] == "production";
const outDir = production ? "dist" : "web";

function runBuild() {
  build({
    entryPoints: ["./src/Api.ts"],
    outdir: outDir,
    bundle: true,
    sourcemap: !production,
    minify: production,
    splitting: true,
    format: "esm",
    target: "es2019",
    define: { "process.env.NODE_ENV": production?'"production"':'"development"' },
  }).then(() => {
    console.log("Built esbuild to " + outDir);
  });
}

runBuild();
