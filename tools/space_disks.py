"""Renders the Earth and Moon disks for the Moon-case scene (img/earth_disk.png, img/moon_disk.png).

Sources (public domain, NASA): Blue Marble shaded relief via NASA GIBS WMS; LRO WAC global mosaic via NASA Moon Trek WMTS.
Usage: python tools/space_disks.py <cache_dir>   (downloads ~40 images into cache_dir, then writes into img/)
"""
import io, os, sys, urllib.request
import numpy as np
from PIL import Image

cache, out = sys.argv[1], os.path.join(os.path.dirname(__file__), '..', 'img')
os.makedirs(cache, exist_ok=True)

def get(url, name):
    p = os.path.join(cache, name)
    if not os.path.exists(p):
        with urllib.request.urlopen(url, timeout=60) as r, open(p, 'wb') as f: f.write(r.read())
    return Image.open(p).convert('RGB')

earth = get('https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0'
            '&LAYERS=BlueMarble_ShadedRelief_Bathymetry&STYLES=&CRS=EPSG:4326&BBOX=-90,-180,90,180&WIDTH=2048&HEIGHT=1024&FORMAT=image/jpeg', 'earth.jpg')
T = 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/2/{r}/{c}.jpg'
moon = Image.new('RGB', (2048, 1024))
for r in range(4):
    for c in range(8): moon.paste(get(T.format(r=r, c=c), f'moon_{r}_{c}.jpg'), (c * 256, r * 256))

def disk(img, size, lon0, lat0, light=(-0.5, 0.45, 0.75), atmosphere=False):
    """Orthographic view of an equirectangular map, with soft day-side lighting."""
    a = np.asarray(img, dtype=np.float32) / 255
    h, w = a.shape[:2]
    y, x = np.mgrid[0:size, 0:size]
    x = (x + .5) / size * 2 - 1; y = 1 - (y + .5) / size * 2
    r2 = x * x + y * y; inside = r2 <= 1; z = np.sqrt(np.clip(1 - r2, 0, 1))
    p0, l0 = np.radians(lat0), np.radians(lon0)
    lat = np.arcsin(np.clip(z * np.sin(p0) + y * np.cos(p0), -1, 1))
    lon = l0 + np.arctan2(x, z * np.cos(p0) - y * np.sin(p0))
    u = ((np.degrees(lon) + 180) % 360) / 360 * (w - 1); v = (90 - np.degrees(lat)) / 180 * (h - 1)
    rgb = a[v.astype(int), u.astype(int)]
    L = np.array(light) / np.linalg.norm(light)
    shade = np.clip(x * L[0] + y * L[1] + z * L[2], 0, 1) * .85 + .15
    rgb = rgb * shade[..., None]
    if atmosphere: rgb = rgb + (1 - z)[..., None] ** 3 * np.array([.25, .45, .9]) * .6
    alpha = np.clip((1 - np.sqrt(r2)) * size / 2, 0, 1)  # one-pixel antialiased edge
    out_a = np.dstack([np.clip(rgb, 0, 1), alpha * inside]) * 255
    return Image.fromarray(out_a.astype(np.uint8), 'RGBA')

disk(earth, 520, -68, -8, atmosphere=True).save(os.path.join(out, 'earth_disk.png'), optimize=True)
disk(Image.eval(moon, lambda p: min(255, int(p * 1.35))), 320, 10, 5).save(os.path.join(out, 'moon_disk.png'), optimize=True)
print('ok')
