"""
╔══════════════════════════════════════════════════════════════════════╗
║  🚀 GRIIDAI EXPORT JOB — run_export.py                             ║
║                                                                      ║
║  شغّله مباشرةً:  python run_export.py                               ║
║  غيّر INPUT و FORMAT في الـ CONFIG بس                               ║
╚══════════════════════════════════════════════════════════════════════╝
"""

import os
import time

from google.cloud import batch_v1
from google.oauth2 import service_account

# ═══════════════════════════════════════════════════════════════════════
# 🎛️  CONFIG — غيّر القيم دي بس
# ═══════════════════════════════════════════════════════════════════════

CONFIG = {
    "PROJECT_ID": "assetrx-slr",
    "SA_FILE": r"C:\Users\tomas\Downloads\Kimi_Agent_GriidAi Referral Program Design (1)\backend\griidai-backend-sa.json",    "SA_EMAIL":   "griidai-backend-sa@assetrx-slr.iam.gserviceaccount.com",
    "USE_SPOT":   True,
    "GDAL_IMAGE": "ghcr.io/osgeo/gdal:ubuntu-small-3.8.5",
    "BOOT_DISK_GB": 100,

    # ── غيّر القيمتين دول بس ──
    "INPUT":  "gs://griidai-data/sample/FL_Pinalles_Water.tif",
    "FORMAT": "png",   # geotiff | png | jpeg | geojson | shapefile | kml
}

VECTOR_FORMATS = ["geojson", "shapefile", "kml"]
RASTER_FORMATS = ["geotiff", "png", "jpeg"]


# ═══════════════════════════════════════════════════════════════════════
# 🧰  HELPERS
# ═══════════════════════════════════════════════════════════════════════

def parse_gcs_uri(uri):
    stripped = uri.replace("gs://", "")
    bucket   = stripped.split("/")[0]
    blob     = "/".join(stripped.split("/")[1:])
    return bucket, blob


# ═══════════════════════════════════════════════════════════════════════
# 🔄  BUILD SCRIPTS (3 runnables)
# ═══════════════════════════════════════════════════════════════════════

def build_download_script(gcs_input, fmt):
    """Runnable 1 — runs on HOST, uses gcloud storage"""
    local_input = "/tmp/input.parquet" if fmt in VECTOR_FORMATS else "/tmp/input.tif"
    return f"""#!/bin/bash
set -e
echo "⬇️  Downloading input from GCS..."
gcloud storage cp "{gcs_input}" {local_input}
echo "✅ Download done → {local_input}"
"""


def build_convert_script(fmt):
    """Runnable 2 — runs INSIDE GDAL container, no network calls"""

    if fmt in VECTOR_FORMATS:
        return f"""#!/bin/bash
set -e
echo "🗺️  Converting to {fmt.upper()}..."

pip install pyarrow geopandas fiona --quiet

python3 - <<'PYEOF'
import geopandas as gpd, fiona
print("📖 Reading GeoParquet...")
gdf = gpd.read_parquet("/tmp/input.parquet")
print(f"   Rows: {{len(gdf):,}} | CRS: {{gdf.crs}}")
fmt = "{fmt}"
if fmt in ("geojson", "kml") and str(gdf.crs) != "EPSG:4326":
    print("🔄 Reprojecting to EPSG:4326...")
    gdf = gdf.to_crs(epsg=4326)
if fmt == "geojson":
    gdf.to_file("/tmp/output.geojson", driver="GeoJSON")
elif fmt == "shapefile":
    gdf.to_file("/tmp/output.shp", driver="ESRI Shapefile")
    import subprocess
    subprocess.run(["zip", "-r", "/tmp/output_shp.zip",
                    "/tmp/output.shp", "/tmp/output.dbf",
                    "/tmp/output.shx", "/tmp/output.prj"], check=True)
elif fmt == "kml":
    fiona.supported_drivers["KML"] = "rw"
    gdf.to_file("/tmp/output.kml", driver="KML")
print("✅ Conversion done")
PYEOF
"""

    translate_opts = {
        "geotiff": "-of GTiff -co COMPRESS=LZW -co TILED=YES -co BIGTIFF=IF_SAFER",
        "png":     "-of PNG -scale",
        "jpeg":    "-of JPEG -co QUALITY=85 -scale",
    }[fmt]

    ext = {"geotiff": ".tif", "png": ".png", "jpeg": ".jpg"}[fmt]

    # ── FIX: world_block بدون أي leading spaces ──
    world_block = ""
    if fmt == "png":
        world_block = """\
echo "🗺️  Generating world file..."
python3 - <<'PYEOF'
from osgeo import gdal
gdal.UseExceptions()
ds = gdal.Open('/tmp/input.tif')
gt = ds.GetGeoTransform()
with open('/tmp/output.pgw', 'w') as f:
    f.write(f'{gt[1]}\\n{gt[4]}\\n{gt[2]}\\n{gt[5]}\\n{gt[0]}\\n{gt[3]}\\n')
print('✅ World file written')
PYEOF
python3 - <<'ZIPEOF'
import zipfile, os
files = ["/tmp/output.png", "/tmp/output.pgw"]
with zipfile.ZipFile("/tmp/output_png.zip", "w", zipfile.ZIP_DEFLATED) as zf:
    for f in files:
        if os.path.exists(f):
            zf.write(f, os.path.basename(f))
print("✅ ZIP created → /tmp/output_png.zip")
ZIPEOF
"""

    return f"""#!/bin/bash
set -e
export GDAL_CACHEMAX=4000
export GDAL_NUM_THREADS=ALL_CPUS
export CHECK_DISK_FREE_SPACE=FALSE

echo "🔄 Converting to {fmt.upper()}..."
TIME_START=$(date +%s%N)

gdal_translate {translate_opts} \\
    --config GDAL_CACHEMAX 4000 \\
    --config GDAL_NUM_THREADS ALL_CPUS \\
    /tmp/input.tif /tmp/output{ext}

TIME_END=$(date +%s%N)
ELAPSED=$(( (TIME_END - TIME_START) / 1000000 ))
echo "⚡ Conversion done in ${{ELAPSED}}ms — $(du -h /tmp/output{ext} | cut -f1)"

{world_block}"""


def build_upload_script(gcs_output, fmt):
    """Runnable 3 — runs on HOST, uses gcloud storage"""
    local_output = {
        "geojson":   "/tmp/output.geojson",
        "shapefile": "/tmp/output_shp.zip",
        "kml":       "/tmp/output.kml",
        "geotiff":   "/tmp/output.tif",
        "png":       "/tmp/output_png.zip",
        "jpeg":      "/tmp/output.jpg",
    }[fmt]

    return f"""#!/bin/bash
set -e
echo "⬆️  Uploading output to GCS..."
gcloud storage cp "{local_output}" "{gcs_output}"
echo "🎉 Done → {gcs_output}"
"""


# ═══════════════════════════════════════════════════════════════════════
# 🏗️  SUBMIT BATCH JOB
# ═══════════════════════════════════════════════════════════════════════

def submit_job(gcs_input, fmt, gcs_output, creds, region):
    client = batch_v1.BatchServiceClient(credentials=creds)

    # ── Runnable 1: Download (HOST) ──
    runnable_dl = batch_v1.Runnable()
    runnable_dl.script = batch_v1.Runnable.Script()
    runnable_dl.script.text = build_download_script(gcs_input, fmt)

    # ── Runnable 2: Convert (GDAL container) ──
    runnable_convert = batch_v1.Runnable()
    runnable_convert.container = batch_v1.Runnable.Container()
    runnable_convert.container.image_uri  = CONFIG["GDAL_IMAGE"]
    runnable_convert.container.entrypoint = "/bin/bash"
    runnable_convert.container.commands   = ["-c", build_convert_script(fmt)]
    runnable_convert.container.volumes    = ["/tmp:/tmp:rw"]

    # ── Runnable 3: Upload (HOST) ──
    runnable_ul = batch_v1.Runnable()
    runnable_ul.script = batch_v1.Runnable.Script()
    runnable_ul.script.text = build_upload_script(gcs_output, fmt)

    # ── Task ──
    task = batch_v1.TaskSpec()
    task.runnables = [runnable_dl, runnable_convert, runnable_ul]
    task.compute_resource = batch_v1.ComputeResource()
    task.compute_resource.cpu_milli     = 4000
    task.compute_resource.memory_mib    = 8192

    group = batch_v1.TaskGroup()
    group.task_count = 1
    group.task_spec  = task

    # ── Allocation ──
    alloc    = batch_v1.AllocationPolicy()
    sa       = batch_v1.ServiceAccount()
    sa.email = CONFIG["SA_EMAIL"]

    inst        = batch_v1.AllocationPolicy.InstancePolicyOrTemplate()
    inst.policy = batch_v1.AllocationPolicy.InstancePolicy()
    inst.policy.machine_type      = "c2d-highcpu-4"
    inst.policy.boot_disk         = batch_v1.AllocationPolicy.Disk()
    inst.policy.boot_disk.size_gb = CONFIG["BOOT_DISK_GB"]
    inst.policy.boot_disk.type_   = "pd-ssd"
    if CONFIG["USE_SPOT"]:
        inst.policy.provisioning_model = batch_v1.AllocationPolicy.ProvisioningModel.SPOT

    alloc.instances       = [inst]
    alloc.service_account = sa

    # ── Job ──
    job = batch_v1.Job()
    job.task_groups       = [group]
    job.allocation_policy = alloc
    job.logs_policy       = batch_v1.LogsPolicy()
    job.logs_policy.destination = batch_v1.LogsPolicy.Destination.CLOUD_LOGGING

    job_id  = f"griidai-export-{int(time.time())}"
    request = batch_v1.CreateJobRequest()
    request.job    = job
    request.job_id = job_id
    request.parent = f"projects/{CONFIG['PROJECT_ID']}/locations/{region}"

    result = client.create_job(request)
    return result.name, job_id


# ═══════════════════════════════════════════════════════════════════════
# ⏳  POLL UNTIL DONE
# ═══════════════════════════════════════════════════════════════════════

def wait_for_job(job_name, creds, poll_sec=15):
    client = batch_v1.BatchServiceClient(credentials=creds)
    print(f"\n⏳ Polling every {poll_sec}s...")
    while True:
        job   = client.get_job(name=job_name)
        state = job.status.state
        if state == batch_v1.JobStatus.State.SUCCEEDED:
            print("✅ Job SUCCEEDED!")
            return
        elif state in (
            batch_v1.JobStatus.State.FAILED,
            batch_v1.JobStatus.State.DELETION_IN_PROGRESS,
        ):
            raise RuntimeError(f"❌ Job failed: {state.name}")
        else:
            print(f"   [{state.name}] still running...")
            time.sleep(poll_sec)


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
        "geojson": ".geojson", "shapefile": ".zip",
        "kml": ".kml", "geotiff": ".tif", "png": ".zip", "jpeg": ".jpg",
    }
    gcs_output = f"gs://{bucket_name}/exports/{stem}_export{ext_map[fmt]}"
    print(f"📤 Output : {gcs_output}")

    print(f"\n🚀 Submitting export job...")
    job_full_name, job_id = submit_job(gcs_input, fmt, gcs_output, creds, region)

    print(f"\n{'='*50}")
    print(f"✅ Job submitted!")
    print(f"   Job ID  : {job_id}")
    print(f"   Job Name: {job_full_name}")
    print(f"   Format  : {fmt.upper()}")
    print(f"   Output  : {gcs_output}")
    print(f"{'='*50}")
    print(f"\n📋 Track in console:")
    print(f"   https://console.cloud.google.com/batch/jobs?project={CONFIG['PROJECT_ID']}")

    wait_for_job(job_full_name, creds)
    print(f"\n📥 File ready at:\n   {gcs_output}")