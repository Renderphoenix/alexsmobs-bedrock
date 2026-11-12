// Send Python to a running Blender through the Blender Lab MCP add-on's bridge (port 9876).
//   node blrun.js file.py        or        echo "import bpy; print(1)" | node blrun.js
// The add-on must be installed and "Start MCP Bridge Server" clicked (Preferences > Add-ons > MCP), and
// Preferences > System > Network > Allow Online Access must be on. Protocol: NUL-terminated JSON.
const net = require("net"), fs = require("fs");
const code = process.argv[2] ? fs.readFileSync(process.argv[2], "utf8") : fs.readFileSync(0, "utf8");
const port = parseInt(process.env.BLENDER_MCP_PORT || "9876", 10);
const s = net.connect(port, "localhost", () => s.write(JSON.stringify({ type: "execute", code, strict_json: false }) + "\0"));
let buf = "";
s.on("data", (d) => (buf += d));
s.on("end", () => {
  const r = JSON.parse(buf.replace(/\0$/, ""));
  console.log(r.stdout || "", r.stderr || "", r.status || "", r.message || "");
  if (r.result !== undefined) console.log(JSON.stringify(r.result).slice(0, 3000));
});
s.on("error", (e) => console.log("ERR", e.message, "(is Blender open with the MCP bridge server started?)"));
