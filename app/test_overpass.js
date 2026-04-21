const query = `[out:json][timeout:90][maxsize:1073741824];
(
  way["building"](30.0, 31.2, 30.01, 31.21);
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
}).then(text => console.log('Response:', text.substring(0, 100)));
