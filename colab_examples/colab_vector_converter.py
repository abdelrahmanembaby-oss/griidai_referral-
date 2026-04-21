# =========================================================
# 🗺️ GEOPANDAS VECTOR CONVERTER (For Google Colab)
# =========================================================
# Geopandas is highly recommended on Colab because it natively supports 
# GeoParquet (via pyarrow) without needing complex GDAL compilation.

import os
import geopandas as gpd

def convert_vector(source_path: str, output_path: str, target_format: str):
    if not os.path.exists(source_path):
        raise FileNotFoundError(f"Source file not found: {source_path}")

    target_format = target_format.upper()
    print(f"Reading from {source_path}...")

    # Safely read Parquet or other formats (GeoJSON, Shapefile)
    if source_path.endswith('.parquet'):
        gdf = gpd.read_parquet(source_path)
    else:
        gdf = gpd.read_file(source_path)

    if target_format == "GEOJSON":
        print(f"Converting to GeoJSON: {output_path}...")
        gdf.to_file(output_path, driver="GeoJSON")
        print(f"✅ Conversion successful: {output_path}")

    elif target_format == "SHAPEFILE":
        print(f"Converting to ESRI Shapefile: {output_path}...")
        # Shapefiles only support 10-character column names.
        rename_map, used_names = {}, set()
        for col in gdf.columns:
            if col == "geometry": continue
            short = col[:10]
            counter = 1
            while short in used_names:
                short = col[:10 - len(str(counter))] + str(counter)
                counter += 1
            used_names.add(short)
            rename_map[col] = short
            
        gdf_shp = gdf.rename(columns=rename_map)
        gdf_shp.to_file(output_path, driver="ESRI Shapefile")
        print(f"✅ Conversion successful: {output_path}")

    elif target_format == "KML":
        print(f"Converting to KML: {output_path}...")
        # KML requires coordinates to be in EPSG:4326 (WGS84)
        if gdf.crs and gdf.crs.to_epsg() != 4326:
            print("Reprojecting to WGS84 for KML...")
            gdf = gdf.to_crs(epsg=4326)
        
        # Enable KML driver in fiona natively
        import fiona
        fiona.drvsupport.supported_drivers['KML'] = 'rw'
        
        gdf.to_file(output_path, driver="KML")
        print(f"✅ Conversion successful: {output_path}")

# ================= EXAMPLE USAGE =================
INPUT_FILE = "/content/year_2030_INTER_H.parquet"
OUTPUT_FILE = "/content/output.KML"
FORMAT = "KML" # "GEOJSON", "SHAPEFILE", or "KML"

convert_vector(INPUT_FILE, OUTPUT_FILE, FORMAT)
