const express = require('express');
const app = express();
const PORT = 3000;

const AuthKey = "Abc123";
const GateCount = 50;

function encode(data) {
  return Buffer.from(data).toString('base64');
}

function getAOB(data, gateId) {
  const arr = [];
  for (const char of data) {
    arr.push(String(char.charCodeAt(0)) + gateId);
  }
  return arr;
}

function getAOBSum(arr) {
  return arr.join('');
}

app.get('/active', (req, res) => {
  res.send('active');
});

app.get('/auth/key/:authKey', (req, res) => {
  const authKey = req.params.authKey;

  if (authKey !== AuthKey) {
    return res.status(403).send('Forbidden');
  }

  const exAuthToken = 'token12345';

  res.set('ex-auth-token', exAuthToken);
  res.send('OK');
});

app.get('/gate/:gateId/token/:token/key/:authKey', (req, res) => {
  const gateId = req.params.gateId;
  const token = req.params.token;
  const authKey = req.params.authKey;

  if (authKey !== AuthKey) {
    return res.status(403).send('Forbidden');
  }

  const aob = getAOB(Buffer.from(authKey).toString('base64'), gateId);
  const aobJson = JSON.stringify(aob);
  const aobSum = getAOBSum(aob);

  res.set('ex-auth-aob', aobJson);
  res.set('ex-auth-sum', aobSum);

  res.send('Gate OK');
});

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
