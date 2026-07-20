const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// We want to remove unwanted navigation items. Let's find how navigation is defined.
console.log(code.match(/const navItems = \[\s*([\s\S]*?)\];/));
