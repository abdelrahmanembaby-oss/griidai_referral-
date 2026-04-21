# First, install GDAL in colab if not present:
# !apt-get install -y gdal-bin libgdal-dev
# !pip install gdal

from osgeo import gdal
import os

gdal.UseExceptions()

def convert_raster(source_path: str, output_path: str, target_format: str):
    print(f"Opening {source_path}...")
    src_ds = gdal.Open(source_path)
    if not src_ds:
        raise ValueError("GDAL could not open the source file.")

    target_format = target_format.upper()
    band_count = src_ds.RasterCount
    
    if target_format == "GEOTIFF":
        options = gdal.TranslateOptions(format="GTiff", creationOptions=["COMPRESS=LZW", "TILED=YES"])
        gdal.Translate(output_path, src_ds, options=options)

    elif target_format == "PNG":
        print(f"Converting to PNG with World File: {output_path}...")
        translate_kwargs = {
            "format": "PNG",
            "outputType": gdal.GDT_Byte,
            "scaleParams": [[]],  # Auto scale to 0-255
            "creationOptions": ["WORLDFILE=YES"], # This creates the .pgw sidecar along with the .png
        }
        # PNG supports max 4 bands. Extract RGB (bands 1,2,3) for multi-band images
        if band_count >= 3:
            translate_kwargs["bandList"] = [1, 2, 3] 
        else:
            translate_kwargs["bandList"] = [1] 

        options = gdal.TranslateOptions(**translate_kwargs)
        gdal.Translate(output_path, src_ds, options=options)

    elif target_format == "JPEG":
        print(f"Converting to JPEG: {output_path}...")
        translate_kwargs = {
            "format": "JPEG",
            "outputType": gdal.GDT_Byte,
            "scaleParams": [[]],
            "creationOptions": ["QUALITY=85"]
        }
        # JPEG must be 1 (Grayscale) or 3 (RGB) bands
        if band_count >= 3:
            translate_kwargs["bandList"] = [1, 2, 3] 
        else:
            translate_kwargs["bandList"] = [1] 

        options = gdal.TranslateOptions(**translate_kwargs)
        gdal.Translate(output_path, src_ds, options=options)

    print(f"✅ Conversion successful: {output_path}")

# ================= EXAMPLE USAGE =================
INPUT_FILE = "/content/new_image_cog.tif"
OUTPUT_FILE = "/content/output.jpeg"
FORMAT = "JPEG" # "GEOTIFF", "PNG", or "JPEG"

convert_raster(INPUT_FILE, OUTPUT_FILE, FORMAT)
