import requests
import json
import time
import os

BASE_URL = "http://localhost:8000/api/export"

# 1. Create a dummy GeoJSON file
test_geojson = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {"name": "Test Point"},
            "geometry": {"type": "Point", "coordinates": [10.0, 20.0]}
        }
    ]
}
with open("test.geojson", "w") as f:
    json.dump(test_geojson, f)

print("Created test.geojson")

# 2. Upload and start export
with open("test.geojson", "rb") as f:
    files = {"file": ("test.geojson", f, "application/geo+json")}
    data = {"target_format": "kml"}
    print(f"Uploading to {BASE_URL}/upload...")
    resp = requests.post(f"{BASE_URL}/upload", files=files, data=data)

if resp.status_code != 202:
    print("Upload Failed:", resp.text)
    exit(1)

task_info = resp.json()
task_id = task_info["task_id"]
print(f"Upload successful. Task ID: {task_id}")

# 3. Poll for status
while True:
    time.sleep(1)
    status_resp = requests.get(f"{BASE_URL}/status?task_id={task_id}")
    if status_resp.status_code != 200:
        print("Status check failed:", status_resp.text)
        exit(1)
    
    status_data = status_resp.json()
    print(f"[{status_data['status']}] {status_data['progress']}% - {status_data['message']}")
    
    if status_data["status"] == "SUCCESS":
        print(f"Export ready at: {status_data['download_url']}")
        
        # Try downloading
        dl_resp = requests.get(f"http://localhost:8000{status_data['download_url']}")
        if dl_resp.status_code == 200:
            print("Download successful! Size:", len(dl_resp.content), "bytes")
        else:
            print("Download failed:", dl_resp.text)
        break
    elif status_data["status"] == "FAILURE":
        print("Export failed!")
        break

# Clean up
if os.path.exists("test.geojson"):
    os.remove("test.geojson")
