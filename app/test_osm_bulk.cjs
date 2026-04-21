const https = require('https');

const endpoints = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter"
];

// Small bbox in Maadi, Cairo (approx 500x500 meters)
const bbox = "29.955,31.265,29.960,31.270";

const layers = [
  { name: 'buildings', query: `way["building"](${bbox});relation["building"](${bbox});` },
  { name: 'highways', query: `way["highway"](${bbox});` },
  { name: 'amenities', query: `node["amenity"](${bbox});way["amenity"](${bbox});relation["amenity"](${bbox});` },
  { name: 'railway', query: `way["railway"](${bbox});` },
  { name: 'leisure', query: `way["leisure"](${bbox});relation["leisure"](${bbox});` },
];

function buildQuery(queryPart) {
  return `[out:json][timeout:25];(${queryPart});out body;>;out skel qt;`;
}

function fetchLayer(endpoint, layer) {
  return new Promise((resolve) => {
    const query = buildQuery(layer.query);
    const postData = 'data=' + encodeURIComponent(query);
    
    const url = new URL(endpoint);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            resolve({ 
              status: 'SUCCESS', 
              layer: layer.name, 
              endpoint: url.hostname, 
              elements: json.elements ? json.elements.length : 0 
            });
          } catch(e) {
            resolve({ status: 'PARSE_ERROR', layer: layer.name, endpoint: url.hostname, error: e.message });
          }
        } else {
          resolve({ status: `ERROR ${res.statusCode}`, layer: layer.name, endpoint: url.hostname, msg: data.substring(0, 100).replace(/\n/g, '') });
        }
      });
    });

    req.on('error', (e) => resolve({ status: 'NET_ERROR', layer: layer.name, endpoint: url.hostname, error: e.message }));
    req.write(postData);
    req.end();
  });
}

(async function runTests() {
  console.log("Starting bulk OSM tests on small region...");
  
  // Test sequential requests to single endpoint to simulate typical browser use
  for (const layer of layers) {
    const res = await fetchLayer(endpoints[0], layer);
    console.log(`[${res.endpoint}] Layer: ${res.layer.padEnd(10)} -> ${res.status.padEnd(10)} | Elements: ${res.elements || res.msg || res.error || 0}`);
    
    // Slight delay mimicking the browser 
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log("\\nTesting parallel requests...");
  const promises = layers.map((layer, i) => fetchLayer(endpoints[1], layer));
  const results = await Promise.all(promises);
  results.forEach(res => {
    console.log(`[${res.endpoint}] Layer: ${res.layer.padEnd(10)} -> ${res.status.padEnd(10)} | Elements: ${res.elements || res.msg || res.error || 0}`);
  });
})();
