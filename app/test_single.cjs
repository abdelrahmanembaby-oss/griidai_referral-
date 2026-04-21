const https = require('https');

const query = `[out:json][timeout:25];(way["highway"](30.04, 31.23, 30.05, 31.24););out body;>;out skel qt;`;
const postData = 'data=' + encodeURIComponent(query);

const req = https.request({
  hostname: 'overpass-api.de',
  path: '/api/interpreter',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData)
  }
}, (res) => {
  console.log('Status for Tahrir:', res.statusCode);
});
req.write(postData);
req.end();
