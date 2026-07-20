const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');
let mockStateMatch = serverCode.match(/const DEFAULT_MOCK_STATE\s*:\s*[^=]+=\s*({[\s\S]*?\n});/);
if (mockStateMatch) {
  let mockStateStr = mockStateMatch[1];
  let apiCode = fs.readFileSync('src/api.ts', 'utf8');
  apiCode = apiCode.replace(/export async function fetchState\(\): Promise<DMSState> \{[\s\S]*?return data;\n\}/, 
    `const DEFAULT_MOCK_STATE: DMSState = ${mockStateStr};\n\nexport async function fetchState(): Promise<DMSState> {\n  const local = localStorage.getItem("dms_state");\n  if (local) return JSON.parse(local);\n  localStorage.setItem("dms_state", JSON.stringify(DEFAULT_MOCK_STATE));\n  return DEFAULT_MOCK_STATE;\n}`);
  fs.writeFileSync('src/api.ts', apiCode);
  console.log("Mock API injected.");
} else {
  console.log("Not found.");
}
