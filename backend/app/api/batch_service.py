"""
Batch Export Service
Handles Google Cloud Batch job submission for adaptive sampling and conversion.

Copied from the TESTED & WORKING emboao.py — all scripts are identical.
"""
import base64
import os
import time
from google.cloud import batch_v1
from google.oauth2 import service_account

# ═══════════════════════════════════════════════════════════════════════
# 🎛️  CONFIG
# ═══════════════════════════════════════════════════════════════════════

CONFIG = {
    "PROJECT_ID":   "assetrx-slr",
    "SA_FILE":      os.environ.get("GOOGLE_APPLICATION_CREDENTIALS",
                      r"C:\Users\tomas\Downloads\Kimi_Agent_GriidAi Referral Program Design (1)\backend\griidai-backend-sa.json"),
    "SA_EMAIL":     "griidai-backend-sa@assetrx-slr.iam.gserviceaccount.com",
    "USE_SPOT":     True,

    # ubuntu-full — عشان numpy + psutil متاحين
    "GDAL_IMAGE":   "ghcr.io/osgeo/gdal:ubuntu-full-3.8.5",
    "BOOT_DISK_GB": 100,

    "SAMPLE_PCT":        0.10,
    "RAM_SAFETY_FACTOR": 1.5,
    "MIN_VALID_RATIO":   0.90,
}

VECTOR_FORMATS = ["geojson", "shapefile", "kml", "geoparquet"]
RASTER_FORMATS = ["geotiff", "png", "jpeg", "jpeg2000"]

MACHINE_TYPES = [
    {"name": "c2d-highcpu-4",   "ram_gb": 8,    "vcpus": 4},
    {"name": "n1-standard-4",   "ram_gb": 15,   "vcpus": 4},
    {"name": "n1-standard-8",   "ram_gb": 30,   "vcpus": 8},
    {"name": "n1-highmem-8",    "ram_gb": 52,   "vcpus": 8},
    {"name": "n1-standard-16",  "ram_gb": 60,   "vcpus": 16},
    {"name": "n1-highmem-16",   "ram_gb": 104,  "vcpus": 16},
    {"name": "n1-standard-32",  "ram_gb": 120,  "vcpus": 32},
    {"name": "n1-highmem-32",   "ram_gb": 208,  "vcpus": 32},
    {"name": "n1-highmem-64",   "ram_gb": 416,  "vcpus": 64},
]


# ═══════════════════════════════════════════════════════════════════════
# 🧰  HELPERS
# ═══════════════════════════════════════════════════════════════════════

def get_credentials():
    """Get Google Cloud credentials."""
    return service_account.Credentials.from_service_account_file(CONFIG["SA_FILE"])


def parse_gcs_uri(uri):
    stripped = uri.replace("gs://", "")
    bucket   = stripped.split("/")[0]
    blob     = "/".join(stripped.split("/")[1:])
    return bucket, blob


def pick_machine_type(needed_ram_gb: float) -> dict:
    """اختار أرخص ماكينة فيها رام كافية."""
    required_ram = needed_ram_gb * 1.2

    for machine in MACHINE_TYPES:
        if machine["ram_gb"] >= required_ram:
            return machine
    return MACHINE_TYPES[-1]


def estimate_ram_from_file_size(file_size_gb: float, is_raster: bool = True) -> float:
    """تقدير أولي للرام بناءً على حجم الملف قبل الـ Sampling."""
    if not is_raster:
        return max(4.0, file_size_gb * 1.5)
    uncompressed_factor = 5
    estimated_ram_gb = file_size_gb * uncompressed_factor
    return max(8.0, min(estimated_ram_gb, 250.0))


def encode_script(script_text: str) -> str:
    """حوّل الـ script لـ base64 عشان نتجنب ARG_MAX ومشاكل الـ quoting."""
    return base64.b64encode(script_text.encode("utf-8")).decode("utf-8")


def is_vector_input(gcs_input: str) -> bool:
    """اكتشف نوع الـ input من الـ extension."""
    lower = gcs_input.lower()
    return any(lower.endswith(ext) for ext in [".parquet", ".geojson", ".json", ".shp", ".kml", ".gpkg", ".zip"])


# ═══════════════════════════════════════════════════════════════════════
# 🔄  BUILD SCRIPTS  (identical to emboao.py)
# ═══════════════════════════════════════════════════════════════════════

def build_prep_script(gcs_input: str, fmt: str, task_script: str,
                      dest: str = "/tmp/run_task.sh") -> str:
    """
    Host Runnable:
      1. ينزل الـ input من GCS باستخدام gsutil
      2. يكتب الـ task script على /tmp كـ base64 decode
    القرار بناءً على الـ input extension مش الـ output format
    """
    if is_vector_input(gcs_input):
        ext = os.path.splitext(gcs_input)[1].lower()
        if not ext: ext = ".parquet"
        local_input = f"/tmp/input{ext}"
    else:
        local_input = "/tmp/input.tif"
    encoded     = encode_script(task_script)

    return (
        "#!/bin/bash\n"
        "set -e\n"
        'echo "Downloading input from GCS..."\n'
        f'gsutil cp "{gcs_input}" {local_input}\n'
        f'echo "Download done: {local_input}"\n'
        f'echo "Writing task script to {dest}..."\n'
        "python3 -c \"\n"
        "import base64\n"
        f"script = base64.b64decode('{encoded}').decode('utf-8')\n"
        f"open('{dest}', 'w').write(script)\n"
        "\"\n"
        f"chmod +x {dest}\n"
        f'echo "Script ready: {dest}"\n'
    )


def _ensure_pip_block() -> str:
    """
    ✅ FIX 6: تثبيت pip بشكل مضمون داخل ubuntu-full container.
    - أولاً بنحاول apt-get لأنه أسرع وأأمن.
    - لو فشل، بنستخدم ensurepip كـ fallback.
    """
    return (
        "# ── تثبيت pip بشكل مضمون ──\n"
        "if ! python3 -m pip --version > /dev/null 2>&1; then\n"
        "    echo 'pip not found — trying ensurepip...'\n"
        "    python3 -m ensurepip --upgrade 2>/dev/null || true\n"
        "fi\n"
        "if ! python3 -m pip --version > /dev/null 2>&1; then\n"
        "    echo 'ensurepip failed — trying apt-get install python3-pip...'\n"
        "    apt-get update -qq && apt-get install -y python3-pip -qq\n"
        "fi\n"
        'echo "pip ready: $(python3 -m pip --version)"\n'
    )


def build_sample_script(gcs_input, sample_pct, min_valid_ratio, ram_safety_factor) -> str:
    """
    Task script للـ sample phase — بيتشغل جوه GDAL container.

    ✅ raster : بياخد tile من النص ويقيس RAM الفعلي
    ✅ vector : بيقرأ row groups فعلية من الـ parquet
               (مش بيحمل الملف كله في الـ memory)
    """

    # ──────────────────────────────────────────────
    # VECTOR SAMPLING — pyarrow row groups
    # ──────────────────────────────────────────────
    if is_vector_input(gcs_input):
        ext = os.path.splitext(gcs_input)[1].lower()
        if not ext: ext = ".parquet"

        if ext == ".parquet":
            py_script = (
                "import json, os, threading, time\n"
                "import pyarrow as pa\n"
                "import pyarrow.parquet as pq\n"
                "import geopandas as gpd\n"
                "import psutil\n"
                "from shapely import wkb\n"
                "\n"
                f"SAMPLE_PCT = {sample_pct}\n"
                f"RAM_SAFETY = {ram_safety_factor}\n"
                "INPUT_FILE = '/tmp/input.parquet'\n"
            "\n"
            "# اقرأ الـ metadata بدون ما تحمل الملف كله\n"
            "pf         = pq.ParquetFile(INPUT_FILE)\n"
            "total_rows = pf.metadata.num_rows\n"
            "num_groups = pf.metadata.num_row_groups\n"
            "print(f'Total rows: {total_rows}, row groups: {num_groups}')\n"
            "\n"
            "# احسب عدد الـ row groups المطلوبة للـ sample\n"
            "target_rows    = max(100, int(total_rows * SAMPLE_PCT))\n"
            "rows_per_group = total_rows // max(num_groups, 1)\n"
            "groups_needed  = max(1, int(target_rows / max(rows_per_group, 1)))\n"
            "groups_needed  = min(groups_needed, num_groups)\n"
            "print(f'Reading {groups_needed}/{num_groups} row groups (~{target_rows} rows)')\n"
            "\n"
            "# قياس الـ RAM أثناء القراءة الفعلية\n"
            "proc       = psutil.Process(os.getpid())\n"
            "peak_bytes = [proc.memory_info().rss]\n"
            "stop_flag  = [False]\n"
            "\n"
            "def monitor():\n"
            "    while not stop_flag[0]:\n"
            "        try:\n"
            "            rss = proc.memory_info().rss\n"
            "            if rss > peak_bytes[0]:\n"
            "                peak_bytes[0] = rss\n"
            "        except Exception:\n"
            "            break\n"
            "        time.sleep(0.2)\n"
            "\n"
            "t = threading.Thread(target=monitor, daemon=True)\n"
            "t.start()\n"
            "\n"
            "# نقرأ الـ row groups بس — مش الملف كله\n"
            "tables   = [pf.read_row_group(i) for i in range(groups_needed)]\n"
            "combined = pa.concat_tables(tables)\n"
            "df       = combined.to_pandas()\n"
            "\n"
            "# نحول الـ geometry ونعمل عملية بسيطة عشان نستهلك الـ RAM الفعلي\n"
            "if 'geometry' in df.columns:\n"
            "    df['geometry'] = df['geometry'].apply(\n"
            "        lambda g: wkb.loads(g) if isinstance(g, (bytes, bytearray)) else g\n"
            "    )\n"
            "    gdf = gpd.GeoDataFrame(df, geometry='geometry')\n"
            "    _   = gdf.geometry.is_valid\n"
            "    print(f'Sample GeoDataFrame: {len(gdf)} features')\n"
            "else:\n"
            "    print('Warning: no geometry column found — measuring raw DataFrame RAM')\n"
            "\n"
            "stop_flag[0] = True\n"
            "t.join()\n"
            "\n"
            "# الـ sample كان نسبة من الملف → نحسب المتوقع للـ 100%\n"
            "actual_ratio = groups_needed / num_groups\n"
            "peak_gb      = peak_bytes[0] / (1024 ** 3)\n"
            "needed_gb    = peak_gb * (1.0 / actual_ratio) * RAM_SAFETY\n"
            "\n"
            "print(f'Peak RAM (sample {actual_ratio:.0%}): {peak_gb:.3f} GB')\n"
            "print(f'Estimated full file RAM: {needed_gb:.1f} GB')\n"
            "\n"
            "result = {\n"
            "    'peak_ram_gb':   round(peak_gb, 3),\n"
            "    'needed_ram_gb': round(needed_gb, 2),\n"
            "    'skipped':       False,\n"
            "    'type':          'vector',\n"
            "    'total_rows':    total_rows,\n"
            "    'groups_read':   groups_needed,\n"
            "    'total_groups':  num_groups,\n"
            "}\n"
            "\n"
            "with open('/tmp/sample_result.json', 'w') as f:\n"
            "    json.dump(result, f)\n"
            "\n"
            "print('Sample result saved to /tmp/sample_result.json')\n"
            )
        else:
            py_script = (
                "import json, os, threading, time\n"
                "import geopandas as gpd\n"
                "import psutil\n"
                f"RAM_SAFETY = {ram_safety_factor}\n"
                f"INPUT_FILE = '/tmp/input{ext}'\n"
                "\n"
                "print('Reading input file fully for vector sample RAM estimation...')\n"
                "proc = psutil.Process(os.getpid())\n"
                "peak_bytes = [proc.memory_info().rss]\n"
                "stop_flag = [False]\n"
                "\n"
                "def monitor():\n"
                "    while not stop_flag[0]:\n"
                "        try:\n"
                "            rss = proc.memory_info().rss\n"
                "            if rss > peak_bytes[0]: peak_bytes[0] = rss\n"
                "        except Exception: break\n"
                "        time.sleep(0.1)\n"
                "\n"
                "t = threading.Thread(target=monitor, daemon=True)\n"
                "t.start()\n"
                "\n"
                "gdf = gpd.read_file(INPUT_FILE)\n"
                "total_rows = len(gdf)\n"
                "print(f'Read {total_rows} features')\n"
                "\n"
                "stop_flag[0] = True\n"
                "t.join()\n"
                "\n"
                "peak_gb = peak_bytes[0] / (1024 ** 3)\n"
                "needed_gb = peak_gb * RAM_SAFETY + 1.0\n"
                "print(f'Peak RAM: {peak_gb:.3f} GB')\n"
                "print(f'Estimated needed RAM: {needed_gb:.2f} GB')\n"
                "\n"
                "result = {\n"
                "    'peak_ram_gb': round(peak_gb, 3),\n"
                "    'needed_ram_gb': round(needed_gb, 2),\n"
                "    'skipped': False,\n"
                "    'type': 'vector',\n"
                "    'total_rows': total_rows\n"
                "}\n"
                "with open('/tmp/sample_result.json', 'w') as f:\n"
                "    json.dump(result, f)\n"
            )

        encoded_py = encode_script(py_script)

        return (
            "#!/bin/bash\n"
            "set -e\n"
            "echo 'Installing vector sampling deps...'\n"
            + _ensure_pip_block()
            + "python3 -m pip install pyarrow geopandas psutil shapely --quiet\n"
            'echo "Vector Adaptive Sampling: reading row groups..."\n'
            "python3 -c \"\n"
            "import base64\n"
            f"script = base64.b64decode('{encoded_py}').decode('utf-8')\n"
            "open('/tmp/sample_py.py', 'w').write(script)\n"
            "\"\n"
            "python3 /tmp/sample_py.py\n"
        )

    # ──────────────────────────────────────────────
    # RASTER SAMPLING — multi-region tile sampling
    # ──────────────────────────────────────────────
    py_script = (
        "import json, math, os, threading, time, gc\n"
        "import numpy as np\n"
        "import psutil\n"
        "from osgeo import gdal\n"
        "\n"
        "gdal.UseExceptions()\n"
        "gdal.SetCacheMax(256 * 1024 * 1024)\n"
        "proc = psutil.Process(os.getpid())\n"
        "base_ram_bytes = proc.memory_info().rss # الرام الأساسي للبرنامج والمكتبات قبل تحميل البيانات\n"
        "\n"
        f"SAMPLE_PCT      = {sample_pct}\n"
        f"MIN_VALID_RATIO = {min_valid_ratio}\n"
        f"RAM_SAFETY      = {ram_safety_factor}\n"
        "INPUT_TIF       = '/tmp/input.tif'\n"
        "\n"
        "ds      = gdal.Open(INPUT_TIF, gdal.GA_ReadOnly)\n"
        "total_x = ds.RasterXSize\n"
        "total_y = ds.RasterYSize\n"
        "band    = ds.GetRasterBand(1)\n"
        "nodata  = band.GetNoDataValue()\n"
        "dtype   = band.DataType\n"
        "dtype_size = gdal.GetDataTypeSize(dtype) // 8\n"
        "\n"
        "available_ram = psutil.virtual_memory().available\n"
        "print(f'Base Process RAM: {base_ram_bytes / (1024**3):.2f} GB')\n"
        "print(f'Available RAM: {available_ram / (1024**3):.2f} GB')\n"
        "\n"
        "# للـ Raster، مش محتاجين 10% ضخمة، بيكفي Tile بحجم ثابت وممثل\n"
        "tw = min(total_x, 4000)\n"
        "th = min(total_y, 4000)\n"
        "\n"
        "# تأكد إن الـ Tile مش أكبر من الرام المتاح (للملفات ذات الـ bit depth العالي)\n"
        "tile_bytes = tw * th * dtype_size\n"
        "if tile_bytes > available_ram * 0.4:\n"
        "    scale = math.sqrt((available_ram * 0.4) / tile_bytes)\n"
        "    tw = max(256, int(tw * scale))\n"
        "    th = max(256, int(th * scale))\n"
        "    print(f'Tile scaled down to {tw}x{th} to fit RAM constraints')\n"
        "\n"
        "print(f'Final sample tile size: {tw}x{th} ({tw*th*dtype_size/(1024**3):.2f} GB)')\n"
        "\n"
        "cx, cy = total_x // 2, total_y // 2\n"
        "candidates = [\n"
        "    (cx - tw // 2, cy - th // 2), # Center\n"
        "    (0, 0),                       # Top-Left\n"
        "    (total_x - tw, 0),            # Top-Right\n"
        "    (0, total_y - th),            # Bottom-Left\n"
        "    (total_x - tw, total_y - th)  # Bottom-Right\n"
        "]\n"
        "\n"
        "region_peaks = []\n"
        "for idx, (xo, yo) in enumerate(candidates):\n"
        "    xo = max(0, min(xo, total_x - tw))\n"
        "    yo = max(0, min(yo, total_y - th))\n"
        "    actual_tw = min(tw, total_x - xo)\n"
        "    actual_th = min(th, total_y - yo)\n"
        "    \n"
        "    try:\n"
        "        print(f'  Sampling region {idx} @ ({xo},{yo})...')\n"
        "        chunk = band.ReadAsArray(xo, yo, actual_tw, actual_th)\n"
        "        peak = proc.memory_info().rss\n"
        "        \n"
        "        if chunk is not None:\n"
        "            valid_mask = (chunk != nodata) if nodata is not None else np.isfinite(chunk.astype(float))\n"
        "            valid_count = np.sum(valid_mask)\n"
        "            valid_ratio = valid_count / chunk.size\n"
        "            if valid_ratio > 0.05:\n"
        "                region_peaks.append(peak)\n"
        "                print(f'    Region {idx}: peak={peak/(1024**3):.3f} GB, valid={valid_ratio:.1%}')\n"
        "            \n"
        "            del chunk\n"
        "            gc.collect()\n"
        "    except Exception as e:\n"
        "        print(f'    Failed region {idx}: {e}')\n"
        "        gc.collect()\n"
        "\n"
        "if not region_peaks:\n"
        "    peak_gb = proc.memory_info().rss / (1024 ** 3)\n"
        "    needed_gb = peak_gb * RAM_SAFETY + 2.0\n"
        "    dynamic_safety = RAM_SAFETY\n"
        "else:\n"
        "    peak_gb = max(region_peaks) / (1024 ** 3)\n"
        "    if len(region_peaks) > 1:\n"
        "        cv = np.std(region_peaks) / np.mean(region_peaks) if np.mean(region_peaks) > 0 else 0\n"
        "        dynamic_safety = RAM_SAFETY + (cv * 0.5)\n"
        "        dynamic_safety = min(2.5, max(RAM_SAFETY, dynamic_safety))\n"
        "    else:\n"
        "        dynamic_safety = RAM_SAFETY\n"
        "    \n"
        "    # للـ Raster: الرام المطلوب هو أقصى استهلاك لعينة واحدة + كاش GDAL + أمان\n"
        "    # لا يوجد ضرب في مقلوب النسبة لأن التحويل يتم بنظام الـ Blocks\n"
        "    # GDAL_CACHEMAX هو 4GB في الـ convert script\n"
        "    needed_gb = (peak_gb * dynamic_safety) + 4.0\n"
        "\n"
        "print(f'Peak RAM (Sample Tile): {peak_gb:.3f} GB')\n"
        "print(f'Estimated RAM for Full Raster Job: {needed_gb:.1f} GB')\n"
        "\n"
        "base_gb = base_ram_bytes / (1024 ** 3)\n"
        "data_peak_gb = max(peak_gb - base_gb, 0.0)\n"
        "\n"
        "result = {\n"
        "    'peak_ram_gb':   round(peak_gb, 3),\n"
        "    'data_peak_gb':   round(data_peak_gb, 3),\n"
        "    'needed_ram_gb': round(needed_gb, 2),\n"
        "    'dynamic_safety': round(dynamic_safety, 2),\n"
        "    'skipped':       False,\n"
        "    'type':          'raster',\n"
        "    'regions_sampled': len(region_peaks),\n"
        "}\n"
        "\n"
        "with open('/tmp/sample_result.json', 'w') as f:\n"
        "    json.dump(result, f)\n"
        "\n"
        "print('Sample result saved')\n"
    )

    encoded_py = encode_script(py_script)

    return (
        "#!/bin/bash\n"
        "set -e\n"
        # ✅ FIX 6: نثبّت numpy و psutil من apt أولاً (متاحين في ubuntu-full)
        "echo 'Installing raster sampling deps...'\n"
        "if apt-get install -y python3-numpy python3-psutil -qq 2>/dev/null; then\n"
        "    echo 'Installed via apt-get'\n"
        "else\n"
        "    echo 'apt-get failed — falling back to pip'\n"
        + _ensure_pip_block()
        + "    python3 -m pip install psutil numpy --quiet\n"
        "fi\n"
        'echo "Raster Adaptive Sampling: finding valid tile..."\n'
        "python3 -c \"\n"
        "import base64\n"
        f"script = base64.b64decode('{encoded_py}').decode('utf-8')\n"
        "open('/tmp/sample_py.py', 'w').write(script)\n"
        "\"\n"
        "python3 /tmp/sample_py.py\n"
    )


def build_convert_script(gcs_input, fmt) -> str:
    """Task script للـ full convert — بيتشغل جوه GDAL container."""

    if is_vector_input(gcs_input):
        ext = os.path.splitext(gcs_input)[1].lower()
        if not ext: ext = ".parquet"

        py_code = (
            "import geopandas as gpd, fiona\n"
            f"print('Reading {ext} vector input...')\n"
            f"input_file = '/tmp/input{ext}'\n"
            f"if '{ext}' == '.parquet':\n"
            "    gdf = gpd.read_parquet(input_file)\n"
            "else:\n"
            "    gdf = gpd.read_file(input_file)\n"
            f"fmt = '{fmt}'\n"
            "if fmt in ('geojson', 'kml') and str(gdf.crs) != 'EPSG:4326':\n"
            "    gdf = gdf.to_crs(epsg=4326)\n"
            "if fmt == 'geojson':\n"
            "    gdf.to_file('/tmp/output.geojson', driver='GeoJSON')\n"
            "elif fmt == 'geoparquet':\n"
            "    gdf.to_parquet('/tmp/output.parquet')\n"
            "elif fmt == 'shapefile':\n"
            "    gdf.to_file('/tmp/output.shp', driver='ESRI Shapefile')\n"
            "    import zipfile, os\n"
            "    with zipfile.ZipFile('/tmp/output_shp.zip', 'w', zipfile.ZIP_DEFLATED) as zf:\n"
            "        for ext_out in ['.shp', '.dbf', '.shx', '.prj', '.cpg']:\n"
            "            fpath = '/tmp/output' + ext_out\n"
            "            if os.path.exists(fpath):\n"
            "                zf.write(fpath, os.path.basename(fpath))\n"
            "elif fmt == 'kml':\n"
            "    fiona.supported_drivers['KML'] = 'rw'\n"
            "    gdf.to_file('/tmp/output.kml', driver='KML')\n"
            "print('Conversion done')\n"
        )
        encoded_py = encode_script(py_code)
        return (
            "#!/bin/bash\n"
            "set -e\n"
            f'echo "Converting vector to {fmt.upper()}..."\n'
            + _ensure_pip_block()
            + "python3 -m pip install pyarrow geopandas fiona --quiet\n"
            "python3 -c \"\n"
            "import base64\n"
            f"script = base64.b64decode('{encoded_py}').decode('utf-8')\n"
            "open('/tmp/convert_py.py', 'w').write(script)\n"
            "\"\n"
            "python3 /tmp/convert_py.py\n"
        )

    # ── raster convert ──
    translate_opts = {
        "geotiff": "-of GTiff -co COMPRESS=LZW -co TILED=YES -co BIGTIFF=IF_SAFER",
        "png":     "-of PNG -scale",
        "jpeg":    "-of JPEG -co QUALITY=85 -scale",
        "jpeg2000": "-of JP2OpenJPEG -co QUALITY=100 -co REVERSIBLE=YES",
    }[fmt]

    ext = {"geotiff": ".tif", "png": ".png", "jpeg": ".jpg", "jpeg2000": ".jp2"}[fmt]

    world_block = ""
    if fmt == "png":
        world_py = (
            "from osgeo import gdal\n"
            "gdal.UseExceptions()\n"
            "ds = gdal.Open('/tmp/input.tif')\n"
            "gt = ds.GetGeoTransform()\n"
            "open('/tmp/output.pgw','w').write(\n"
            "    str(gt[1])+'\\n'+str(gt[4])+'\\n'+str(gt[2])+'\\n'+\n"
            "    str(gt[5])+'\\n'+str(gt[0])+'\\n'+str(gt[3])+'\\n')\n"
            "print('World file written')\n"
        )
        zip_py = (
            "import zipfile, os\n"
            "files = ['/tmp/output.png', '/tmp/output.pgw']\n"
            "with zipfile.ZipFile('/tmp/output_png.zip','w',zipfile.ZIP_DEFLATED) as zf:\n"
            "    for f in files:\n"
            "        if os.path.exists(f): zf.write(f, os.path.basename(f))\n"
            "print('ZIP created: /tmp/output_png.zip')\n"
        )
        enc_world = encode_script(world_py)
        enc_zip   = encode_script(zip_py)
        world_block = (
            'echo "Generating world file..."\n'
            "python3 -c \"\n"
            "import base64\n"
            f"script = base64.b64decode('{enc_world}').decode('utf-8')\n"
            "open('/tmp/world_py.py','w').write(script)\n"
            "\"\n"
            "python3 /tmp/world_py.py\n"
            "python3 -c \"\n"
            "import base64\n"
            f"script = base64.b64decode('{enc_zip}').decode('utf-8')\n"
            "open('/tmp/zip_py.py','w').write(script)\n"
            "\"\n"
            "python3 /tmp/zip_py.py\n"
        )

    return (
        "#!/bin/bash\n"
        "set -e\n"
        "export GDAL_CACHEMAX=4000\n"
        "export GDAL_NUM_THREADS=ALL_CPUS\n"
        "export CHECK_DISK_FREE_SPACE=FALSE\n"
        f'echo "Converting raster to {fmt.upper()}..."\n'
        "TIME_START=$(date +%s%N)\n"
        f"gdal_translate {translate_opts} \\\n"
        "    --config GDAL_CACHEMAX 4000 \\\n"
        "    --config GDAL_NUM_THREADS ALL_CPUS \\\n"
        f"    /tmp/input.tif /tmp/output{ext}\n"
        "TIME_END=$(date +%s%N)\n"
        "ELAPSED=$(( (TIME_END - TIME_START) / 1000000 ))\n"
        f'echo "Conversion done in ${{ELAPSED}}ms"\n'
        + world_block
    )


def build_upload_result_script(gcs_output_base: str) -> str:
    """Host Runnable — رفع sample_result.json باستخدام gsutil"""
    return (
        "#!/bin/bash\n"
        "set -e\n"
        'echo "Uploading sample result..."\n'
        f'gsutil cp /tmp/sample_result.json "{gcs_output_base}/sample_result.json"\n'
        'echo "Sample result uploaded"\n'
    )


def build_upload_script(gcs_output: str, fmt: str) -> str:
    """Host Runnable — رفع الـ output الفعلي باستخدام gsutil"""
    local_output = {
        "geojson":   "/tmp/output.geojson",
        "shapefile": "/tmp/output_shp.zip",
        "kml":       "/tmp/output.kml",
        "geoparquet": "/tmp/output.parquet",
        "geotiff":   "/tmp/output.tif",
        "png":       "/tmp/output_png.zip",
        "jpeg":      "/tmp/output.jpg",
        "jpeg2000":  "/tmp/output.jp2",
    }[fmt]

    return (
        "#!/bin/bash\n"
        "set -e\n"
        'echo "Uploading output to GCS..."\n'
        f'gsutil cp "{local_output}" "{gcs_output}"\n'
        f'echo "Done: {gcs_output}"\n'
    )


# ═══════════════════════════════════════════════════════════════════════
# 🏗️  SUBMIT JOBS
# ═══════════════════════════════════════════════════════════════════════

def _base_job(machine_name, machine_ram_mib, machine_vcpus):
    sa       = batch_v1.ServiceAccount()
    sa.email = CONFIG["SA_EMAIL"]

    inst        = batch_v1.AllocationPolicy.InstancePolicyOrTemplate()
    inst.policy = batch_v1.AllocationPolicy.InstancePolicy()
    inst.policy.machine_type      = machine_name
    inst.policy.boot_disk         = batch_v1.AllocationPolicy.Disk()
    inst.policy.boot_disk.size_gb = CONFIG["BOOT_DISK_GB"]
    inst.policy.boot_disk.type_   = "pd-ssd"
    if CONFIG["USE_SPOT"]:
        inst.policy.provisioning_model = batch_v1.AllocationPolicy.ProvisioningModel.SPOT

    alloc                 = batch_v1.AllocationPolicy()
    alloc.instances       = [inst]
    alloc.service_account = sa

    task                             = batch_v1.TaskSpec()
    task.compute_resource            = batch_v1.ComputeResource()
    task.compute_resource.cpu_milli  = machine_vcpus * 1000
    task.compute_resource.memory_mib = machine_ram_mib

    group            = batch_v1.TaskGroup()
    group.task_count = 1
    group.task_spec  = task

    job                   = batch_v1.Job()
    job.task_groups       = [group]
    job.allocation_policy = alloc
    job.logs_policy       = batch_v1.LogsPolicy()
    job.logs_policy.destination = batch_v1.LogsPolicy.Destination.CLOUD_LOGGING

    return job, task


def submit_sample_job(gcs_input, fmt, gcs_output_base, creds, region):
    client = batch_v1.BatchServiceClient(credentials=creds)

    # استخدام ماكينة أكبر قليلاً (15GB) لضمان عدم حدوث OOM أثناء الـ sampling للملفات الضخمة
    sample_machine = MACHINE_TYPES[1]  # n1-standard-4 / 15GB

    job, task = _base_job(
        machine_name    = sample_machine["name"],
        machine_ram_mib = int(sample_machine["ram_gb"] * 1024 * 0.9),
        machine_vcpus   = sample_machine["vcpus"],
    )

    sample_task_script = build_sample_script(
        gcs_input,
        CONFIG["SAMPLE_PCT"],
        CONFIG["MIN_VALID_RATIO"],
        CONFIG["RAM_SAFETY_FACTOR"],
    )

    # Runnable 1: Host — download + write script
    r_prep             = batch_v1.Runnable()
    r_prep.script      = batch_v1.Runnable.Script()
    r_prep.script.text = build_prep_script(gcs_input, fmt, sample_task_script)

    # Runnable 2: Container — run the script
    r_sample = batch_v1.Runnable()
    r_sample.container            = batch_v1.Runnable.Container()
    r_sample.container.image_uri  = CONFIG["GDAL_IMAGE"]
    r_sample.container.entrypoint = "/bin/bash"
    r_sample.container.commands   = ["/tmp/run_task.sh"]
    r_sample.container.volumes    = ["/tmp:/tmp"]

    # Runnable 3: Host — upload result
    r_ul             = batch_v1.Runnable()
    r_ul.script      = batch_v1.Runnable.Script()
    r_ul.script.text = build_upload_result_script(gcs_output_base)

    task.runnables  = [r_prep, r_sample, r_ul]
    job.task_groups = [batch_v1.TaskGroup(task_count=1, task_spec=task)]

    job_id  = f"griidai-sample-{int(time.time())}"
    request = batch_v1.CreateJobRequest(
        job    = job,
        job_id = job_id,
        parent = f"projects/{CONFIG['PROJECT_ID']}/locations/{region}",
    )

    result = client.create_job(request)
    return result.name, job_id


def submit_full_job(gcs_input, fmt, gcs_output, machine: dict, creds, region):
    client = batch_v1.BatchServiceClient(credentials=creds)

    job, task = _base_job(
        machine_name    = machine["name"],
        machine_ram_mib = int(machine["ram_gb"] * 1024 * 0.9),
        machine_vcpus   = machine["vcpus"],
    )

    convert_task_script = build_convert_script(gcs_input, fmt)

    # Runnable 1: Host — download + write script
    r_prep             = batch_v1.Runnable()
    r_prep.script      = batch_v1.Runnable.Script()
    r_prep.script.text = build_prep_script(gcs_input, fmt, convert_task_script)

    # Runnable 2: Container — run the script
    r_convert = batch_v1.Runnable()
    r_convert.container            = batch_v1.Runnable.Container()
    r_convert.container.image_uri  = CONFIG["GDAL_IMAGE"]
    r_convert.container.entrypoint = "/bin/bash"
    r_convert.container.commands   = ["/tmp/run_task.sh"]
    r_convert.container.volumes    = ["/tmp:/tmp"]

    # Runnable 3: Host — upload output
    r_ul             = batch_v1.Runnable()
    r_ul.script      = batch_v1.Runnable.Script()
    r_ul.script.text = build_upload_script(gcs_output, fmt)

    task.runnables  = [r_prep, r_convert, r_ul]
    job.task_groups = [batch_v1.TaskGroup(task_count=1, task_spec=task)]

    job_id  = f"griidai-full-{int(time.time())}"
    request = batch_v1.CreateJobRequest(
        job    = job,
        job_id = job_id,
        parent = f"projects/{CONFIG['PROJECT_ID']}/locations/{region}",
    )

    result = client.create_job(request)
    return result.name, job_id


# ═══════════════════════════════════════════════════════════════════════
# ⏳  POLL & READ RESULTS  (used by export.py API)
# ═══════════════════════════════════════════════════════════════════════

def poll_job_status(job_name, creds, poll_sec=15):
    client = batch_v1.BatchServiceClient(credentials=creds)
    while True:
        job   = client.get_job(name=job_name)
        state = job.status.state
        if state == batch_v1.JobStatus.State.SUCCEEDED:
            yield "SUCCEEDED"
            return
        elif state in (
            batch_v1.JobStatus.State.FAILED,
            batch_v1.JobStatus.State.DELETION_IN_PROGRESS,
        ):
            yield "FAILED"
            return
        else:
            yield state.name
            time.sleep(poll_sec)


def read_sample_result(gcs_output_base, creds) -> dict:
    import json
    import tempfile
    from google.cloud import storage

    result_uri             = f"{gcs_output_base}/sample_result.json"
    bucket_name, blob_path = parse_gcs_uri(result_uri)

    client = storage.Client(credentials=creds)
    bucket = client.bucket(bucket_name)
    blob   = bucket.blob(blob_path)

    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        blob.download_to_filename(f.name)
        with open(f.name) as jf:
            return json.load(jf)


def get_file_size_gb(gcs_uri: str, creds) -> float:
    from google.cloud import storage
    bucket_name, blob_path = parse_gcs_uri(gcs_uri)
    client = storage.Client(credentials=creds)
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_path)
    blob.reload()
    size_bytes = blob.size or 0
    return size_bytes / (1024 ** 3)


# ═══════════════════════════════════════════════════════════════════════
# 🎯  run_batch_export  (called from export.py API)
# ═══════════════════════════════════════════════════════════════════════

def run_batch_export(gcs_input: str, fmt: str, gcs_output: str, gcs_output_base: str,
                     region: str = "us-east1", progress_callback=None):
    """
    Run the full batch export workflow:
    1. Check file size — if < 1 MB, skip sampling and use smallest machine
    2. Otherwise, submit sample job (10% sample)
    3. Poll until sample completes
    4. Read sample result and pick machine
    5. Submit full job
    6. Poll until full completes
    7. Return the GCS output URL
    """
    creds = get_credentials()

    # ── Check file size: skip sampling for small files (< 1 MB) ──
    SMALL_FILE_THRESHOLD_GB = 1.0 / 1024  # 1 MB in GB
    file_size_gb = get_file_size_gb(gcs_input, creds)

    if progress_callback:
        size_mb = file_size_gb * 1024
        progress_callback(f"File size: {size_mb:.2f} MB")

    if file_size_gb < SMALL_FILE_THRESHOLD_GB:
        # Small file → skip sampling, use smallest machine directly
        machine = MACHINE_TYPES[0]  # c2d-highcpu-4 / 8 GB

        if progress_callback:
            progress_callback(
                f"File < 1 MB — skipping sampling, using {machine['name']} ({machine['ram_gb']} GB RAM)"
            )
    else:
        # Large file → run adaptive sampling
        if progress_callback:
            progress_callback("Submitting sample job...")

        sample_job_name, sample_job_id = submit_sample_job(
            gcs_input, fmt, gcs_output_base, creds, region
        )

        if progress_callback:
            progress_callback(f"Sample job submitted: {sample_job_id}")

        sample_state = "UNKNOWN"
        for state in poll_job_status(sample_job_name, creds):
            sample_state = state
            if progress_callback:
                progress_callback(f"Sample job status: {state}")

        if sample_state != "SUCCEEDED":
            raise Exception(
                "The file is too complex or too large — the sampling phase crashed. "
                "We cannot process this file at this time."
            )

        if progress_callback:
            progress_callback("Sample job completed, reading result...")

        sample_result = read_sample_result(gcs_output_base, creds)
        needed_ram_gb = sample_result["needed_ram_gb"]

        if progress_callback:
            progress_callback(f"Sample RAM extrapolated: {needed_ram_gb:.1f} GB")

        # ── Check if needed RAM exceeds our maximum machine capacity ──
        max_machine = MACHINE_TYPES[-1]
        max_ram_gb = max_machine["ram_gb"]

        if needed_ram_gb > max_ram_gb:
            raise Exception(
                f"This file requires ~{needed_ram_gb:.0f} GB RAM, which exceeds our "
                f"maximum server capacity of {max_ram_gb} GB. "
                "We cannot process this file at this time."
            )

        machine = pick_machine_type(needed_ram_gb)

        if progress_callback:
            progress_callback(f"Selected machine: {machine['name']} ({machine['ram_gb']} GB RAM)")

    # ── Submit full conversion job ──
    full_job_name, full_job_id = submit_full_job(
        gcs_input, fmt, gcs_output, machine, creds, region
    )

    if progress_callback:
        progress_callback(f"Full job submitted: {full_job_id}")

    full_state = "UNKNOWN"
    for state in poll_job_status(full_job_name, creds):
        full_state = state
        if progress_callback:
            progress_callback(f"Full job status: {state}")

    if full_state != "SUCCEEDED":
        raise Exception(f"Full job failed with final state: {full_state}")

    if progress_callback:
        progress_callback("Conversion complete!")

    return gcs_output


# ═══════════════════════════════════════════════════════════════════════
# 🌍  SHP TO PMTILES (GEOJSON + MBTILES INTERMEDIARY)
# ═══════════════════════════════════════════════════════════════════════

def build_shp_to_pmtiles_script() -> str:
    """Runnable 2 — runs inside ubuntu-full container (c2d-highcpu-4 / 8GB RAM)."""
    
    py_code = (
        "import geopandas as gpd, glob, os\n"
        "import pyarrow\n"
        "print('Finding SHP file...')\n"
        "shps = glob.glob('/tmp/shp/**/*.shp', recursive=True)\n"
        "if not shps:\n"
        "    raise FileNotFoundError('No .shp file found in ZIP')\n"
        "shp = shps[0]\n"
        "print(f'Reading {shp}...')\n"
        "gdf = gpd.read_file(shp)\n"
        "if str(gdf.crs) != 'EPSG:4326':\n"
        "    print('Reprojecting to EPSG:4326...')\n"
        "    gdf = gdf.to_crs(epsg=4326)\n"
        "print('Exporting GeoParquet...')\n"
        "gdf.to_parquet('/tmp/output.parquet')\n"
        "print('Exporting GeoJSON (for tippecanoe)...')\n"
        "gdf.to_file('/tmp/output.geojson', driver='GeoJSON')\n"
        "print(f'Done! Features: {len(gdf)}, CRS: {gdf.crs}')\n"
    )
    encoded_py = encode_script(py_code)
    
    return (
        "#!/bin/bash\n"
        "set -e\n"
        "echo 'Updating apt and installing dependencies...'\n"
        "apt-get update -qq\n"
        "apt-get install -y unzip curl -qq\n"
        
        "echo 'Installing tippecanoe...'\n"
        "apt-get install -y software-properties-common -qq\n"
        "add-apt-repository -y ppa:mactelgege/tippecanoe\n"
        "apt-get update -qq\n"
        "apt-get install -y tippecanoe -qq\n"

        "echo 'Installing Python dependencies...'\n"
        + _ensure_pip_block() +
        "python3 -m pip install geopandas pyarrow shapely --quiet\n"

        "echo 'Downloading go-pmtiles...'\n"
        "curl -sL https://github.com/protomaps/go-pmtiles/releases/download/v1.22.3/go-pmtiles_1.22.3_Linux_x86_64.tar.gz | tar xz -C /tmp/\n"
        "chmod +x /tmp/pmtiles\n"

        "echo 'Unzipping SHP input...'\n"
        "mkdir -p /tmp/shp\n"
        "unzip -q /tmp/input.zip -d /tmp/shp/\n"

        "echo 'Running Python preparation script...'\n"
        "python3 -c \"\n"
        "import base64\n"
        f"script = base64.b64decode('{encoded_py}').decode('utf-8')\n"
        "open('/tmp/prep_shp.py', 'w').write(script)\n"
        "\"\n"
        "python3 /tmp/prep_shp.py\n"

        "echo 'Running tippecanoe (GeoJSON -> MBTiles)...'\n"
        "tippecanoe -o /tmp/output.mbtiles -zg --drop-densest-as-needed -l layer /tmp/output.geojson --force\n"

        "echo 'Converting MBTiles to PMTiles...'\n"
        "/tmp/pmtiles convert /tmp/output.mbtiles /tmp/output.pmtiles\n"
        "echo 'Complete!'\n"
    )

def build_upload_pmtiles_script(gcs_pmtiles: str, gcs_parquet: str) -> str:
    """Runnable 3 — runs on HOST."""
    return (
        "#!/bin/bash\n"
        "set -e\n"
        "echo 'Uploading PMTiles and GeoParquet to GCS...'\n"
        f"gsutil cp /tmp/output.pmtiles \"{gcs_pmtiles}\"\n"
        f"gsutil cp /tmp/output.parquet \"{gcs_parquet}\"\n"
        "echo 'Upload complete!'\n"
    )

def submit_shp_to_pmtiles_job(gcs_zip: str, gcs_pmtiles: str, gcs_parquet: str, creds, region: str = "us-east1"):
    """Submits the Google Cloud Batch Job to convert a zipped SHP to PMTiles and GeoParquet."""
    client = batch_v1.BatchServiceClient(credentials=creds)

    # Use c2d-highcpu-4 (4 vCPUs, 8GB RAM) directly for shapefiles
    machine = MACHINE_TYPES[0]
    job, task = _base_job(
        machine_name    = machine["name"],
        machine_ram_mib = int(machine["ram_gb"] * 1024 * 0.9),
        machine_vcpus   = machine["vcpus"],
    )

    # R1: Host -> Download ZIP
    r_dl = batch_v1.Runnable()
    r_dl.script = batch_v1.Runnable.Script()
    r_dl.script.text = (
        "#!/bin/bash\n"
        "set -e\n"
        "echo 'Downloading ZIP from GCS...'\n"
        f"gsutil cp \"{gcs_zip}\" /tmp/input.zip\n"
    )

    # R2: Container -> Run full conversion (SHP -> Parquet -> MBTiles -> PMTiles)
    r_convert = batch_v1.Runnable()
    r_convert.container = batch_v1.Runnable.Container()
    r_convert.container.image_uri = CONFIG["GDAL_IMAGE"]
    r_convert.container.entrypoint = "/bin/bash"
    r_convert.container.commands = ["-c", build_shp_to_pmtiles_script()]
    r_convert.container.volumes = ["/tmp:/tmp:rw"]

    # R3: Host -> Upload outputs
    r_ul = batch_v1.Runnable()
    r_ul.script = batch_v1.Runnable.Script()
    r_ul.script.text = build_upload_pmtiles_script(gcs_pmtiles, gcs_parquet)

    task.runnables = [r_dl, r_convert, r_ul]
    job.task_groups = [batch_v1.TaskGroup(task_count=1, task_spec=task)]

    job_id = f"griidai-shp-{int(time.time())}"
    request = batch_v1.CreateJobRequest(
        job=job,
        job_id=job_id,
        parent=f"projects/{CONFIG['PROJECT_ID']}/locations/{region}",
    )

    result = client.create_job(request)
    return result.name, job_id
