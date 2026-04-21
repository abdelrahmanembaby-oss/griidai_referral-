import json
import os

file_path = "C:\\Users\\tomas\\Downloads\\buildings_1775112046496.geojson"

try:
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    features = data.get("features", [])
    print(f"Total features: {len(features)}")
    
    empty_geometries = 0
    invalid_geometries = 0
    
    for feature in features:
        geom = feature.get("geometry")
        if not geom:
            empty_geometries += 1
        elif geom.get("type") not in ["Point", "LineString", "Polygon", "MultiPoint", "MultiLineString", "MultiPolygon", "GeometryCollection"]:
            invalid_geometries += 1
        elif "coordinates" not in geom or not geom["coordinates"]:
            empty_geometries += 1
            
    print(f"Empty/Missing Geometries: {empty_geometries}")
    print(f"Invalid Geometries: {invalid_geometries}")
    
except Exception as e:
    print(f"Error loading JSON: {e}")
