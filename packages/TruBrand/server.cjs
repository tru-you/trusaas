const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 4600;

app.use(express.static(__dirname));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log('TruBrand running on port ' + PORT));
