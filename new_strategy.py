"""
╔══════════════════════════════════════════════════════════════════════╗
║  🚀 GRIIDAI EXPORT JOB — run_export.py                             ║
║                                                                      ║
║  شغّله مباشرةً:  python run_export.py                               ║
║  غيّر INPUT و FORMAT في الـ CONFIG بس                               ║
║                                                                      ║
║  🧠 Adaptive Sampling:                                               ║
║     بياخد 10% من الملف، يقيس الـ RAM، يختار الـ machine تلقائي    ║
║                                                                      ║
║  🔧 FIXES:                                                           ║
║     1. ubuntu-full  (numpy + psutil متاحين)                        ║
║     2. volume mount بدون :rw                                        ║
║     3. scripts بتتكتب على /tmp كـ base64  (تتجنب ARG_MAX)         ║
║     4. gsutil cp بدل gcloud storage cp  (Python 3.9 compatible)    ║
║     5. python3 -m pip بدل pip  (مش موجود في PATH على GDAL image)  ║
║     6. apt-get install numpy/psutil بدل pip  (ubuntu-full)         ║
║        + ensurepip للـ packages اللي مش في apt                     ║
╚══════════════════════════════════════════════════════════════════════╝
"""

import base64
import os
import time

from google.cloud import batch_v1
from google.oauth2 import service_account

# ═══════════════════════════════════════════════════════════════════════
# 🎛️  CONFIG — غيّر القيم دي بس
# ═══════════════════════════════════════════════════════════════════════

CONFIG = {
    "PROJECT_ID":   "assetrx-slr",
    "SA_FILE":      r"C:\Users\tomas\Downloads\Kimi_Agent_GriidAi Referral Program Design (1)\backend\griidai-backend-sa.json",
    "SA_EMAIL":     "griidai-backend-sa@assetrx-slr.iam.gserviceaccount.com",
    "USE_SPOT":     True,

    # ubuntu-full — عشان numpy + psutil متاحين
    "GDAL_IMAGE":   "ghcr.io/osgeo/gdal:ubuntu-full-3.8.5",
    "BOOT_DISK_GB": 100,

    # ── غيّر القيمتين دول بس ──
    "INPUT":  "gs://griidai-data/sample/masked_FL_2090_INTER_H_True_SLR_ID.tif",
    "FORMAT": "png",   # geotiff | png | jpeg | geojson | shapefile | kml

    # ── Adaptive sampling — مش محتاج تغير ──
    "SAMPLE_PCT":        0.10,
    "RAM_SAFETY_FACTOR": 1.3,
    "MIN_VALID_RATIO":   0.90,
}

VECTOR_FORMATS = ["geojson", "shapefile", "kml"]
RASTER_FORMATS = ["geotiff", "png", "jpeg"]

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

def parse_gcs_uri(uri):
    stripped = uri.replace("gs://", "")
    bucket   = stripped.split("/")[0]
    blob     = "/".join(stripped.split("/")[1:])
    return bucket, blob


def pick_machine_type(needed_ram_gb: float, file_size_gb: float = 0) -> dict:
    """اختار الماكينة بناءً على الرام المطلوبة + حجم الملف (لتحديد عدد الـ Cores)."""
    # 1. حدد الحد الأدنى من الـ Cores بناءً على حجم الملف
    if file_size_gb >= 20:
        min_cores = 32
    elif file_size_gb >= 10:
        min_cores = 16
    elif file_size_gb >= 4:
        min_cores = 8
    else:
        min_cores = 4

    # 2. حدد الحد الأدنى من الرام
    required_ram = needed_ram_gb * 1.2

    # 3. اختار أرخص ماكينة تحقق الشرطين (RAM + Cores)
    for machine in MACHINE_TYPES:
        if machine["vcpus"] >= min_cores and machine["ram_gb"] >= required_ram:
            return machine
    return MACHINE_TYPES[-1]


def get_file_size_gb(gcs_uri: str, creds) -> float:
    """جيب حجم الملف من GCS بالجيجابايت."""
    from google.cloud import storage
    bucket_name, blob_path = parse_gcs_uri(gcs_uri)
    client = storage.Client(credentials=creds)
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_path)
    blob.reload()  # fetch metadata
    size_bytes = blob.size or 0
    size_gb = size_bytes / (1024 ** 3)
    return round(size_gb, 3)


def encode_script(script_text: str) -> str:
    """حوّل الـ script لـ base64 عشان نتجنب ARG_MAX ومشاكل الـ quoting."""
    return base64.b64encode(script_text.encode("utf-8")).decode("utf-8")


# ═══════════════════════════════════════════════════════════════════════
# 🔄  BUILD SCRIPTS
# ═══════════════════════════════════════════════════════════════════════

def build_prep_script(gcs_input: str, fmt: str, task_script: str,
                      dest: str = "/tmp/run_task.sh") -> str:
    """
    Host Runnable:
      1. ينزل الـ input من GCS باستخدام gsutil
      2. يكتب الـ task script على /tmp كـ base64 decode
    """
    local_input = "/tmp/input.parquet" if fmt in VECTOR_FORMATS else "/tmp/input.tif"
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


def build_sample_script(fmt, sample_pct, min_valid_ratio, ram_safety_factor) -> str:
    """
    Task script للـ sample phase — بيتشغل جوه GDAL container.
    """
    if fmt in VECTOR_FORMATS:
        return (
            "#!/bin/bash\n"
            "set -e\n"
            'echo "Vector format — skipping RAM sampling"\n'
            'echo \'{"peak_ram_gb": 1.0, "needed_ram_gb": 2.0, "skipped": true}\''
            " > /tmp/sample_result.json\n"
            'echo "Done"\n'
        )

    py_script = (
        "import json, math, os, threading, time, psutil\n"
        "import numpy as np\n"
        "from osgeo import gdal\n"
        "\n"
        "gdal.UseExceptions()\n"
        "\n"
        f"SAMPLE_PCT      = {sample_pct}\n"
        f"MIN_VALID_RATIO = {min_valid_ratio}\n"
        f"RAM_SAFETY      = {ram_safety_factor}\n"
        "INPUT_TIF       = '/tmp/input.tif'\n"
        "\n"
        "# Get available memory and cap the sample tile\n"
        "available_ram = psutil.virtual_memory().available\n"
        "max_array_bytes = available_ram * 0.5  # Use max 50% of available RAM for array\n"
        "print(f'Available RAM: {available_ram / (1024**3):.2f} GB')\n"
        "print(f'Max array size: {max_array_bytes / (1024**3):.2f} GB')\n"
        "\n"
        "ds      = gdal.Open(INPUT_TIF, gdal.GA_ReadOnly)\n"
        "total_x = ds.RasterXSize\n"
        "total_y = ds.RasterYSize\n"
        "band    = ds.GetRasterBand(1)\n"
        "nodata  = band.GetNoDataValue()\n"
        "dtype   = band.DataType\n"
        "dtype_size = gdal.GetDataTypeSize(dtype) // 8  # bytes per pixel\n"
        "\n"
        "# Calculate ideal sample size based on percentage\n"
        "side = math.sqrt(SAMPLE_PCT)\n"
        "ideal_tw = max(256, int(total_x * side))\n"
        "ideal_th = max(256, int(total_y * side))\n"
        "\n"
        "# Cap based on available memory (accounting for potential multi-band reads)\n"
        "max_pixels = max_array_bytes // dtype_size\n"
        "current_pixels = ideal_tw * ideal_th\n"
        "\n"
        "if current_pixels > max_pixels:\n"
        "    # Scale down proportionally to fit memory\n"
        "    scale = math.sqrt(max_pixels / current_pixels)\n"
        "    ideal_tw = max(256, int(ideal_tw * scale))\n"
        "    ideal_th = max(256, int(ideal_th * scale))\n"
        "    print(f'Tile too large, scaled down by {scale:.2f}x')\n"
        "\n"
        "tw, th = ideal_tw, ideal_th\n"
        "print(f'Final sample tile size: {tw}x{th} ({tw*th*dtype_size/(1024**3):.2f} GB)')\n"
        "\n"
        "cx, cy = total_x // 2, total_y // 2\n"
        "candidates = [\n"
        "    (cx - tw // 2, cy - th // 2),\n"
        "    (cx - tw,      cy - th // 2),\n"
        "    (cx,           cy - th // 2),\n"
        "    (cx - tw // 2, cy - th),\n"
        "    (cx - tw // 2, cy),\n"
        "    (0, 0),\n"
        "]\n"
        "\n"
        "chosen = None\n"
        "for xo, yo in candidates:\n"
        "    xo = max(0, min(xo, total_x - tw))\n"
        "    yo = max(0, min(yo, total_y - th))\n"
        "    actual_tw = min(tw, total_x - xo)\n"
        "    actual_th = min(th, total_y - yo)\n"
        "    \n"
        "    # Check if this tile fits in memory before reading\n"
        "    tile_bytes = actual_tw * actual_th * dtype_size\n"
        "    if tile_bytes > available_ram * 0.7:\n"
        "        print(f'  Skipping tile @ ({xo},{yo}): too large ({tile_bytes/(1024**3):.1f} GB)')\n"
        "        continue\n"
        "    \n"
        "    try:\n"
        "        chunk = band.ReadAsArray(xo, yo, actual_tw, actual_th)\n"
        "    except Exception as e:\n"
        "        print(f'  Failed to read tile @ ({xo},{yo}): {e}')\n"
        "        continue\n"
        "        \n"
        "    if chunk is None:\n"
        "        continue\n"
        "    valid = (np.sum(chunk != nodata) / chunk.size) if nodata is not None else (np.sum(np.isfinite(chunk.astype(float))) / chunk.size)\n"
        "    print(f'  tile @ ({xo},{yo}): size={actual_tw}x{actual_th}, valid={valid:.1%}')\n"
        "    if valid >= MIN_VALID_RATIO:\n"
        "        chosen = (xo, yo, actual_tw, actual_th)\n"
        "        print('  Tile selected!')\n"
        "        break\n"
        "\n"
        "ds = None\n"
        "if chosen is None:\n"
        "    # Fallback: use smallest possible tile from center\n"
        "    tw = min(1024, total_x)\n"
        "    th = min(1024, total_y)\n"
        "    chosen = (cx - tw//2, cy - th//2, tw, th)\n"
        "    print(f'Warning: No ideal tile found, using fallback {tw}x{th} from center')\n"
        "\n"
        "xo, yo, tw, th = chosen\n"
        "\n"
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
        "print(f'Converting sample tile ({tw}x{th})...')\n"
        "gdal.SetCacheMax(512 * 1024 * 1024)\n"
        "ds_in = gdal.Open(INPUT_TIF)\n"
        "opts  = gdal.TranslateOptions(format='PNG', srcWin=[xo, yo, tw, th], scaleParams=[[]])\n"
        "gdal.Translate('/tmp/sample_output.png', ds_in, options=opts)\n"
        "ds_in = None\n"
        "\n"
        "stop_flag[0] = True\n"
        "t.join()\n"
        "\n"
        "peak_gb   = peak_bytes[0] / (1024 ** 3)\n"
        "actual_ratio = (tw * th) / (total_x * total_y)\n"
        "# ✅ FIX: GDAL translates block-by-block, so RAM doesn't scale linearly with area.\n"
        "# We allocate peak_gb * 1.5 + 4GB (GDAL Cache) and cap it to avoid huge instances.\n"
        "needed_gb = min(60.0, max(8.0, peak_gb * 1.2 + 4.0)) * RAM_SAFETY\n"
        "\n"
        "print(f'Peak RAM (sample): {peak_gb:.3f} GB')\n"
        "print(f'Actual sample ratio: {actual_ratio:.4f} ({actual_ratio*100:.2f}%)')\n"
        "print(f'Estimated full file: {needed_gb:.1f} GB')\n"
        "\n"
        "result = {\n"
        "    'peak_ram_gb':   round(peak_gb, 3),\n"
        "    'needed_ram_gb': round(needed_gb, 2),\n"
        "    'skipped':       False,\n"
        "    'tile': {'x_off': xo, 'y_off': yo, 'x_size': tw, 'y_size': th},\n"
        "    'actual_ratio':  actual_ratio,\n"
        "}\n"
        "\n"
        "with open('/tmp/sample_result.json', 'w') as f:\n"
        "    json.dump(result, f)\n"
        "\n"
        "print('Sample result saved to /tmp/sample_result.json')\n"
    )

    encoded_py = encode_script(py_script)

    return (
        "#!/bin/bash\n"
        "set -e\n"
        "echo 'Installing numpy and psutil...'\n"
        "if apt-get install -y python3-numpy python3-psutil -qq 2>/dev/null; then\n"
        "    echo 'Installed via apt-get'\n"
        "else\n"
        "    echo 'apt-get failed — falling back to pip'\n"
        + _ensure_pip_block() +
        "    python3 -m pip install psutil numpy --quiet\n"
        "fi\n"
        'echo "Adaptive Sampling: finding valid tile..."\n'
        "python3 -c \"\n"
        "import base64\n"
        f"script = base64.b64decode('{encoded_py}').decode('utf-8')\n"
        "open('/tmp/sample_py.py', 'w').write(script)\n"
        "\"\n"
        "python3 /tmp/sample_py.py\n"
    )


def build_convert_script(fmt) -> str:
    """Task script للـ full convert — بيتشغل جوه GDAL container."""

    if fmt in VECTOR_FORMATS:
        py_code = (
            "import geopandas as gpd, fiona\n"
            "print('Reading GeoParquet...')\n"
            "gdf = gpd.read_parquet('/tmp/input.parquet')\n"
            f"fmt = '{fmt}'\n"
            "if fmt in ('geojson', 'kml') and str(gdf.crs) != 'EPSG:4326':\n"
            "    gdf = gdf.to_crs(epsg=4326)\n"
            "if fmt == 'geojson':\n"
            "    gdf.to_file('/tmp/output.geojson', driver='GeoJSON')\n"
            "elif fmt == 'shapefile':\n"
            "    gdf.to_file('/tmp/output.shp', driver='ESRI Shapefile')\n"
            "    import subprocess\n"
            "    subprocess.run(['zip','-r','/tmp/output_shp.zip',\n"
            "        '/tmp/output.shp','/tmp/output.dbf',\n"
            "        '/tmp/output.shx','/tmp/output.prj'], check=True)\n"
            "elif fmt == 'kml':\n"
            "    fiona.supported_drivers['KML'] = 'rw'\n"
            "    gdf.to_file('/tmp/output.kml', driver='KML')\n"
            "print('Conversion done')\n"
        )
        encoded_py = encode_script(py_code)
        return (
            "#!/bin/bash\n"
            "set -e\n"
            f'echo "Converting to {fmt.upper()}..."\n'
            + _ensure_pip_block() +
            "python3 -m pip install pyarrow geopandas fiona --quiet\n"
            "python3 -c \"\n"
            "import base64\n"
            f"script = base64.b64decode('{encoded_py}').decode('utf-8')\n"
            "open('/tmp/convert_py.py', 'w').write(script)\n"
            "\"\n"
            "python3 /tmp/convert_py.py\n"
        )

    translate_opts = {
        "geotiff": "-of GTiff -co COMPRESS=LZW -co TILED=YES -co BIGTIFF=IF_SAFER",
        "png":     "-of PNG -scale",
        "jpeg":    "-of JPEG -co QUALITY=85 -scale",
    }[fmt]

    ext = {"geotiff": ".tif", "png": ".png", "jpeg": ".jpg"}[fmt]

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
        f'echo "Converting full file to {fmt.upper()}..."\n'
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
        "geotiff":   "/tmp/output.tif",
        "png":       "/tmp/output_png.zip",
        "jpeg":      "/tmp/output.jpg",
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

    sample_machine = MACHINE_TYPES[0]  # c2d-highcpu-4 / 8GB

    job, task = _base_job(
        machine_name    = sample_machine["name"],
        machine_ram_mib = int(sample_machine["ram_gb"] * 1024 * 0.9),
        machine_vcpus   = sample_machine["vcpus"],
    )

    sample_task_script = build_sample_script(
        fmt,
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

    convert_task_script = build_convert_script(fmt)

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
# ⏳  POLL UNTIL DONE
# ═══════════════════════════════════════════════════════════════════════

def wait_for_job(job_name, creds, poll_sec=15, label="Job"):
    client = batch_v1.BatchServiceClient(credentials=creds)
    print(f"\n⏳ Polling {label} every {poll_sec}s...")
    while True:
        job   = client.get_job(name=job_name)
        state = job.status.state
        if state == batch_v1.JobStatus.State.SUCCEEDED:
            print(f"✅ {label} SUCCEEDED!")
            return
        elif state in (
            batch_v1.JobStatus.State.FAILED,
            batch_v1.JobStatus.State.DELETION_IN_PROGRESS,
        ):
            raise RuntimeError(f"❌ {label} failed: {state.name}")
        else:
            print(f"   [{state.name}] still running...")
            time.sleep(poll_sec)


# ═══════════════════════════════════════════════════════════════════════
# 📥  READ SAMPLE RESULT FROM GCS
# ═══════════════════════════════════════════════════════════════════════

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


# ═══════════════════════════════════════════════════════════════════════
# 🎯  MAIN
# ═══════════════════════════════════════════════════════════════════════

if __name__ == "__main__":

    gcs_input = CONFIG["INPUT"]
    fmt       = CONFIG["FORMAT"]

    print(f"🔑 Loading service account: {CONFIG['SA_FILE']}")
    creds = service_account.Credentials.from_service_account_file(CONFIG["SA_FILE"])

    bucket_name, blob_path = parse_gcs_uri(gcs_input)
    print(f"📦 Bucket : {bucket_name}")
    print(f"📄 File   : {blob_path}")

    region = "us-east1"
    print(f"🌍 Using region: {region}")

    stem    = os.path.splitext(os.path.basename(blob_path))[0]
    ext_map = {
        "geojson":   ".geojson",
        "shapefile": ".zip",
        "kml":       ".kml",
        "geotiff":   ".tif",
        "png":       ".zip",
        "jpeg":      ".jpg",
    }
    gcs_output      = f"gs://{bucket_name}/exports/{stem}_export{ext_map[fmt]}"
    gcs_output_base = f"gs://{bucket_name}/exports/{stem}_meta"

    print(f"📤 Output : {gcs_output}")

    # ══════════════════════════════════════════════
    # STEP 1: Sample Job
    # ══════════════════════════════════════════════
    print(f"\n{'='*55}")
    print(f"🧠 STEP 1: Submitting SAMPLE job (10% of file)...")
    print(f"{'='*55}")

    sample_job_name, sample_job_id = submit_sample_job(
        gcs_input, fmt, gcs_output_base, creds, region
    )
    print(f"   Sample Job ID  : {sample_job_id}")
    print(f"   Sample Job Name: {sample_job_name}")

    wait_for_job(sample_job_name, creds, label="Sample Job")

    # ══════════════════════════════════════════════
    # STEP 2: اقرأ النتيجة واختار الـ machine
    # ══════════════════════════════════════════════
    print(f"\n{'='*55}")
    print(f"📊 STEP 2: Reading sample result & picking machine...")
    print(f"{'='*55}")

    sample_result = read_sample_result(gcs_output_base, creds)
    needed_ram_gb = sample_result["needed_ram_gb"]
    peak_ram_gb   = sample_result["peak_ram_gb"]

    # جيب حجم الملف الأصلي من GCS
    file_size_gb = get_file_size_gb(gcs_input, creds)

    print(f"   Peak RAM (10% sample) : {peak_ram_gb:.3f} GB")
    print(f"   Estimated full RAM    : {needed_ram_gb:.1f} GB")
    print(f"   File size on GCS      : {file_size_gb:.3f} GB")

    machine = pick_machine_type(needed_ram_gb, file_size_gb)
    print(f"   ✓ Machine selected    : {machine['name']} "
          f"({machine['ram_gb']} GB RAM / {machine['vcpus']} vCPUs)")
    print(f"   Min cores (by size)   : based on {file_size_gb:.1f} GB file")

    # ══════════════════════════════════════════════
    # STEP 3: Full Convert Job
    # ══════════════════════════════════════════════
    print(f"\n{'='*55}")
    print(f"🚀 STEP 3: Submitting FULL convert job...")
    print(f"{'='*55}")

    full_job_name, full_job_id = submit_full_job(
        gcs_input, fmt, gcs_output, machine, creds, region
    )
    print(f"   Full Job ID  : {full_job_id}")
    print(f"   Full Job Name: {full_job_name}")
    print(f"   Machine Type : {machine['name']}")
    print(f"   RAM          : {machine['ram_gb']} GB")

    wait_for_job(full_job_name, creds, label="Full Convert Job")

    # ══════════════════════════════════════════════
    # DONE
    # ══════════════════════════════════════════════
    print(f"\n{'='*55}")
    print(f"🎉 All done!")
    print(f"   Format  : {fmt.upper()}")
    print(f"   Output  : {gcs_output}")
    print(f"   Machine : {machine['name']} ({machine['ram_gb']} GB)")
    print(f"{'='*55}")
    print(f"\n📋 Track in console:")
    print(f"   https://console.cloud.google.com/batch/jobs?project={CONFIG['PROJECT_ID']}")
    print(f"\n📥 File ready at:\n   {gcs_output}")