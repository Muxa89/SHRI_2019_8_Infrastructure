const { resolve } = require('path');
const express = require('express');
const app = express();
const port = 8080;

const sendFile = path => (req, res) => res.sendFile(resolve(path));

app.get('/', (req, res) => {
  // console.log(req.query.hash);
  res.sendFile(resolve('src/html/index.html'));
});

app.get('/js/index.js', sendFile('src/js/index.js'));
app.get('/js/axios.js', sendFile('node_modules/axios/dist/axios.min.js'));
app.get('/build/:buildId', sendFile('src/html/build.html'));
app.get('/buildState', (req, res) =>
  res.send({
    builds: [
      {
        hash: '123',
        state: 'success',
        buildId: 111,
      },
      {
        hash: '223',
        state: 'failed',
        buildId: 222,
      },
    ],
  })
);

app.listen(port, () => console.log(`UI server is listening on port ${port}.`));
