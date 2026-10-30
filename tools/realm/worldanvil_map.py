#!/usr/bin/env python3
"""World Anvil map swap for Phil's world 'Emberweave' (Boromir API v2).

Phil, 30 Oct 2026: "for now we take what grok has and swap out world anvil".

What the API can and cannot do (openapi parts/image/image.yml, parts/map/map.yml, read 30 Oct 2026):
  - It CANNOT upload an image binary: "Create Image (NYI) ... It is currently not possible to upload image binaries via the API".
    Create Map / Update Map / layers only take the id of an image ALREADY uploaded in World Anvil.
  - It CAN list the world's maps and images, read a map, create a map from an existing image id, and rename a map (PATCH).
So a swap is: (1) `prepare` writes the upload file, (2) Phil uploads it once in World Anvil (Images, drag and drop),
(3) `swap --image <id>` creates the new map from it and renames the old map to "... (archived <date>)". Nothing is deleted.

    python tools/realm/worldanvil_map.py list                         read-only: maps + images in the world
    python tools/realm/worldanvil_map.py prepare --realm-dir <build>  writes the upload JPEG next to the build
    python tools/realm/worldanvil_map.py swap --image <image id> --title "Emberweave - The Realm (v13)" [--old <map id>]
The keys are read from C:\\Emberweave\\secrets and are never printed, logged or written anywhere.
"""
import argparse, json, os, sys, time, urllib.request, urllib.error

BASE = 'https://www.worldanvil.com/api/external/boromir'
SECRETS = r'C:\Emberweave\secrets'
WORLD = '4e12d9ea-1560-4fbd-b1eb-53921a89d9e6'


def _keys():
    with open(os.path.join(SECRETS, 'worldanvil_app_key.txt')) as f:
        app = f.read().strip()
    with open(os.path.join(SECRETS, 'worldanvil_user_token.txt')) as f:
        tok = f.read().strip()
    return app, tok


def call(method, path, body=None):
    app, tok = _keys()
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method,
                                 headers={'x-application-key': app, 'x-auth-token': tok, 'Content-Type': 'application/json',
                                          'User-Agent': 'Emberweave realm tool (worldanvil_map.py)'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode() or '{}')
    except urllib.error.HTTPError as e:
        return {'success': False, 'status': e.code, 'error': e.read().decode('utf-8', 'replace')[:500]}


def listing():
    maps = call('POST', '/world/maps?id=' + WORLD, {'limit': 50, 'offset': 0})
    imgs = call('POST', '/world/images?id=' + WORLD, {'limit': 50, 'offset': 0})
    out = {'maps': [], 'images': []}
    for m in maps.get('entities', []) or []:
        full = call('GET', '/map?id=%s&granularity=1' % m['id'])
        out['maps'].append({'id': m['id'], 'title': m.get('title'), 'url': m.get('url'), 'state': full.get('state'),
                            'isPublic': full.get('isPublic'), 'width': full.get('width'), 'height': full.get('height'),
                            'image': (full.get('image') or {}).get('id') if isinstance(full.get('image'), dict) else full.get('image'),
                            'updateDate': (full.get('updateDate') or {}).get('date') if isinstance(full.get('updateDate'), dict) else full.get('updateDate')})
    for i in imgs.get('entities', []) or []:
        out['images'].append({'id': i['id'], 'title': i.get('title'), 'url': i.get('url')})
    if not maps.get('success', True) or not imgs.get('success', True):
        out['errors'] = {'maps': maps if not maps.get('success', True) else None, 'images': imgs if not imgs.get('success', True) else None}
    return out


def prepare(realm_dir, out=None):
    """The upload file: the whole realm as one JPEG. World Anvil's map viewer tiles big images itself; its upload limit
    depends on the membership tier, so the long side is kept to 16384 px (q90)."""
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = None
    realm = json.load(open(os.path.join(realm_dir, 'realm.json')))
    longest = 16384
    L = [l for l in realm['levels'] if l['width'] <= longest * 1.06][0]   # the deepest level near the upload size (memory)
    canvas = Image.new('RGB', (L['width'], L['height']))
    for r in range(L['rows']):
        for c in range(L['cols']):
            canvas.paste(Image.open(os.path.join(realm_dir, 'tiles', 'z%d' % L['z'], 'r%02dc%02d.webp' % (r, c))).convert('RGB'), (c * realm['tile'], r * realm['tile']))
    # the tree as it stands at full life, the same picture the map shows
    t = Image.open(os.path.join(realm_dir, 'tree', 'wt_28.webp')).convert('RGBA')
    cp = L['cellPx']; side = realm['tree']['sideCells'] * cp
    tx = realm['tree']['cx'] * cp - side / 2; ty = (realm['tree']['cy'] - realm['realmTop']) * cp - side / 2
    t = t.resize((max(1, round(side)), max(1, round(side))), Image.LANCZOS)
    canvas.paste(t, (int(round(tx)), int(round(ty))), t)
    if max(canvas.size) > longest:
        k = longest / max(canvas.size); canvas = canvas.resize((round(canvas.size[0] * k), round(canvas.size[1] * k)), Image.LANCZOS)
    out = out or os.path.join(realm_dir, 'WORLD ANVIL upload %s.jpg' % realm['version'])
    canvas.save(out, quality=90, optimize=True)
    return out, canvas.size, os.path.getsize(out)


def swap(image_id, title, old):
    created = call('PUT', '/map', {'title': title, 'image': {'id': image_id}, 'world': {'id': WORLD}})
    if not created.get('id'):
        return {'created': created}
    renamed = None
    if old:
        cur = call('GET', '/map?id=%s&granularity=-1' % old)
        renamed = call('PATCH', '/map?id=' + old, {'title': (cur.get('title') or 'Old map') + ' (archived ' + time.strftime('%d %b %Y') + ')'})
    return {'created': created, 'renamedOld': renamed}


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest='cmd', required=True)
    sp.add_parser('list')
    p = sp.add_parser('prepare'); p.add_argument('--realm-dir', required=True); p.add_argument('--out')
    s = sp.add_parser('swap'); s.add_argument('--image', required=True); s.add_argument('--title', required=True); s.add_argument('--old')
    a = ap.parse_args()
    if a.cmd == 'list':
        print(json.dumps(listing(), indent=1))
    elif a.cmd == 'prepare':
        print(prepare(a.realm_dir, a.out))
    else:
        print(json.dumps(swap(a.image, a.title, a.old), indent=1))
