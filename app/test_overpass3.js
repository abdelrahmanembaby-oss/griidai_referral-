const query = `[out:json][timeout:90];
(
  way["highway"](30.04, 31.23, 30.05, 31.24);
);
out body;
>;
out skel qt;
`;

fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  body: 'data=' + encodeURIComponent(query),
  headers: {'Content-Type': 'application/x-www-form-urlencoded'}
}).then(res => {
  console.log('Status:', res.status);
  return res.text();
}).then(text => console.log('Response:', text.substring(0, 300)));
