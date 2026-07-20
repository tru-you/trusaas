const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /switch \(activeSection\) \{([\s\S]*?)default:/;
let match = regex.exec(code);
if (match) {
  console.log(match[1]);
}
