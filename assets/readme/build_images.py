"""Compose README images for A14 Pomodoro from unedited application captures.

Usage: python build_images.py [capture folder] [output folder]
Defaults: screenshots/readme-captures and this folder. Needs Pillow and the
Selawik fonts in ~/.fonts (labels only). See screenshots/readme-captures/manifest.json.

Captures come from the current source run in an isolated fictional profile.
They are only cropped, scaled, given rounded corners and placed on a backdrop.
Pixels inside application windows are not edited.
"""
import sys, os
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "..", "screenshots", "readme-captures")
OUT = sys.argv[2] if len(sys.argv) > 2 else HERE
os.makedirs(OUT, exist_ok=True)

NAVY = (35, 57, 87)          # #233957 brand navy
NAVY_DEEP = (22, 36, 56)
GOLD = (240, 179, 91)        # #F0B35B brand gold
IVORY = (255, 253, 247)
SAND = (239, 233, 222)
SAND2 = (231, 223, 209)
LINE = (217, 209, 195)
MUTED = (88, 98, 104)
FONT = os.path.expanduser('~/.fonts/selawksb.ttf')  # Selawik Semibold
FONT_REG = os.path.expanduser('~/.fonts/selawk.ttf')


def src(name):
    return Image.open(os.path.join(SRC, name)).convert('RGBA')


def rounded(im, r, border=None, bw=2):
    im = im.convert('RGBA')
    mask = Image.new('L', im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.width - 1, im.height - 1), r, fill=255)
    if im.mode == 'RGBA':
        from PIL import ImageChops
        mask = ImageChops.multiply(mask, im.getchannel('A'))
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    if border:
        ImageDraw.Draw(out).rounded_rectangle((0, 0, im.width - 1, im.height - 1), r, outline=border, width=bw)
    return out


def fit(im, w=None, h=None):
    if w and h:
        s = min(w / im.width, h / im.height)
    elif w:
        s = w / im.width
    else:
        s = h / im.height
    return im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)


def shadow(canvas, box, r, blur=28, alpha=70, offset=(0, 14)):
    x0, y0, x1, y1 = box
    layer = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle(
        (x0 + offset[0], y0 + offset[1], x1 + offset[0], y1 + offset[1]), r, fill=(10, 25, 35, alpha))
    canvas.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))


def place(canvas, im, xy, r, border=None, sh=True, **kw):
    if sh:
        shadow(canvas, (xy[0], xy[1], xy[0] + im.width, xy[1] + im.height), r, **kw)
    canvas.alpha_composite(rounded(im, r, border), xy)


def backdrop(w, h, top, bottom, r=44):
    grad = Image.new('RGBA', (w, h))
    d = ImageDraw.Draw(grad)
    for y in range(h):
        t = y / (h - 1)
        d.line([(0, y), (w, y)], fill=tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3)) + (255,))
    return rounded(grad, r)


def save(im, name):
    path = os.path.join(OUT, name)
    im.convert('RGBA').save(path, optimize=True)
    print(name, im.size, os.path.getsize(path))


def panel(name):
    # Floating panels are captured with transparent corners; keep the app's own shape.
    return src(name)


def hero():
    W, H = 2400, 1480
    c = backdrop(W, H, (44, 70, 104), NAVY_DEEP)
    ring = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ring)
    d.arc((1500, -560, 2700, 640), 0, 360, fill=(255, 255, 255, 20), width=26)
    d.arc((1500, -560, 2700, 640), 270, 360, fill=GOLD + (150,), width=26)
    c.alpha_composite(ring)
    home = fit(src('home.png'), w=1720)
    place(c, home, (100, 110), 26, blur=40, alpha=120, offset=(0, 24))
    p = fit(panel('panel-circular.png'), w=470)
    place(c, p, (1830, 520), 34, blur=36, alpha=150, offset=(0, 20))
    save(c, 'hero.png')


def modes():
    W, H = 2400, 1000
    c = backdrop(W, H, SAND, SAND2)
    f = ImageFont.truetype(FONT, 46)
    d = ImageDraw.Draw(c)
    q = fit(src('quick.png'), w=1060)
    h = fit(src('home.png'), w=1060)
    for i, (im, label) in enumerate(((q, 'Quick Mode'), (h, 'Full Mode'))):
        x = 100 + i * (1060 + 80)
        d.ellipse((x, 72, x + 24, 96), fill=GOLD if i == 0 else NAVY)
        d.text((x + 40, 52), label, font=f, fill=NAVY)
        place(c, im, (x, 140), 20, border=LINE, blur=24, alpha=50)
    save(c, 'modes.png')


def timers():
    W, H = 2400, 900
    c = backdrop(W, H, SAND, SAND2)
    items = [
        (fit(panel('panel-digital.png'), w=540), 'Digital'),
        (fit(panel('panel-circular.png'), h=640), 'Circular'),
        (fit(panel('panel-circular-dark.png'), h=640), 'Circular, dark theme'),
        (fit(panel('panel-rest.png'), h=640), 'Rest countdown'),
    ]
    gap = 70
    total = sum(i.width for i, _ in items) + gap * (len(items) - 1)
    x = (W - total) // 2
    f = ImageFont.truetype(FONT_REG, 38)
    d = ImageDraw.Draw(c)
    for im, label in items:
        y = (H - 90 - im.height) // 2 + 10
        place(c, im, (x, y), 30, sh=True, blur=26, alpha=70)
        tw = d.textlength(label, font=f)
        d.text((x + (im.width - tw) / 2, H - 104), label, font=f, fill=MUTED)
        x += im.width + gap
    save(c, 'timers.png')


def tile(c, d, box, n, label, sub, im, r, fonts, border=True):
    fnum, flab, fsub = fonts
    tx, ty, tw, th = box
    d.rounded_rectangle((tx, ty, tx + tw, ty + th), 30, fill=IVORY + (255,), outline=LINE, width=2)
    d.ellipse((tx + 44, ty + 44, tx + 108, ty + 108), fill=NAVY)
    nw = d.textlength(n, font=fnum)
    d.text((tx + 76 - nw / 2, ty + 47), n, font=fnum, fill=IVORY)
    d.text((tx + 132, ty + 38), label, font=flab, fill=NAVY)
    lw = d.textlength(label, font=flab)
    d.text((tx + 132 + lw + 24, ty + 52), sub, font=fsub, fill=MUTED)
    return tx, ty, tw, th


def workflow():
    W = 2400
    pad, gap = 60, 60
    TW, TH = (W - pad * 2 - gap) // 2, 900
    RH = 640
    H = pad * 2 + TH * 2 + RH + gap * 2
    c = backdrop(W, H, SAND, SAND2)
    d = ImageDraw.Draw(c)
    fonts = (ImageFont.truetype(FONT, 40), ImageFont.truetype(FONT, 50), ImageFont.truetype(FONT_REG, 36))
    plan = src('home.png').crop((1954, 245, 2815, 1426))
    recall = src('recall-narrow.png').crop((80, 1200, 1840, 2576))
    log = src('log-narrow.png').crop((60, 350, 1860, 1245))
    rest = src('rest.png').crop((806, 470, 2074, 1250))
    tiles = [
        ('1', 'Plan', 'Subject, timer and optional goal', plan, 24),
        ('2', 'Focus', 'Floating timer beside your work', panel('panel-circular.png'), 34),
        ('3', 'Recall', 'Write what you remember first', recall, 24),
        ('4', 'Reflect', 'A short, optional session log', log, 24),
    ]
    for i, (n, label, sub, im, r) in enumerate(tiles):
        tx = pad + (i % 2) * (TW + gap)
        ty = pad + (i // 2) * (TH + gap)
        tile(c, d, (tx, ty, TW, TH), n, label, sub, im, r, fonts)
        area_w, area_h = TW - 110, TH - 200
        im = fit(im, w=area_w, h=area_h)
        x = tx + (TW - im.width) // 2
        y = ty + 150 + (area_h - im.height) // 2
        is_panel = label == 'Focus'
        place(c, im, (x, y), r, border=None if is_panel else LINE, blur=18, alpha=45, offset=(0, 8))
    ty = pad + 2 * (TH + gap)
    tw = W - pad * 2
    tile(c, d, (pad, ty, tw, RH), '5', 'Rest', 'Timed break, recorded separately from focus', rest, 24, fonts)
    a = fit(rest, h=RH - 190)
    b = fit(panel('panel-rest.png'), h=RH - 190)
    total = a.width + 90 + b.width
    x = pad + (tw - total) // 2
    y = ty + 150
    place(c, a, (x, y), 24, border=LINE, blur=18, alpha=45, offset=(0, 8))
    place(c, b, (x + a.width + 90, y), 34, blur=18, alpha=60, offset=(0, 8))
    save(c, 'workflow.png')


def themes():
    W, H = 2400, 1480
    light = fit(src('home.png'), w=2200)
    dark = fit(src('home-dark.png'), w=2200)
    mask = Image.new('L', light.size, 0)
    ImageDraw.Draw(mask).polygon([(1260, 0), (light.width, 0), (light.width, light.height), (940, light.height)], fill=255)
    merged = light.copy()
    merged.paste(dark, (0, 0), mask)
    ImageDraw.Draw(merged).line([(1260, 0), (940, light.height)], fill=GOLD + (255,), width=6)
    c = backdrop(W, H, SAND, SAND2)
    merged = merged.crop((0, 0, merged.width, min(merged.height, H - 200)))
    place(c, merged, (100, 100), 24, border=LINE, blur=30, alpha=60)
    save(c.crop((0, 0, W, merged.height + 200)), 'themes.png')


def theme_gallery():
    # Section captures run edge to edge; pad with the page colour so card borders stay whole.
    light = ImageOps.expand(src('theme-gallery.png').crop((0, 140, 2144, 1050)).convert('RGB'), 28, fill=(245, 241, 232))
    dark = ImageOps.expand(src('theme-gallery-darkslot.png').crop((0, 370, 2144, 1222)).convert('RGB'), 28, fill=(36, 43, 49))
    W = 2400
    pad = 80
    w = W - pad * 2
    a, b = fit(light, w=w), fit(dark, w=w)
    f = ImageFont.truetype(FONT, 42)
    H = pad + 70 + a.height + 70 + 70 + b.height + pad
    c = backdrop(W, H, SAND, SAND2)
    d = ImageDraw.Draw(c)
    y = pad
    for im, label, dot in ((a, '11 light themes', GOLD), (b, '15 dark themes', NAVY)):
        d.ellipse((pad, y + 14, pad + 24, y + 38), fill=dot)
        d.text((pad + 40, y - 6), label, font=f, fill=NAVY)
        y += 70
        place(c, im, (pad, y), 24, border=LINE, blur=24, alpha=50)
        y += im.height + 70
    save(c, 'theme-gallery.png')


def history():
    W, H = 2400, 1460
    sessions = src('history.png').crop((446, 0, 2880, 2000))
    review = src('history-review.png').crop((530, 521, 1950, 1360))
    c = backdrop(W, H, SAND, SAND2)
    s = fit(sessions, w=1560)
    place(c, s, (70, 90), 22, border=LINE, blur=26, alpha=55)
    rv = fit(review, w=860)
    place(c, rv, (W - 70 - rv.width, 560), 22, border=LINE, blur=34, alpha=95, offset=(0, 18))
    save(c, 'history.png')


def framed(name, out, box=None, width=2200, pad=0):
    im = src(name)
    if pad:
        im = ImageOps.expand(im.convert('RGB'), pad, fill=im.convert('RGB').getpixel((2, 2)))
    if box:
        im = im.crop(box)
    im = fit(im, w=width)
    save(rounded(im, 26, border=LINE, bw=3), out)


hero(); modes(); timers(); workflow(); themes(); theme_gallery(); history()
framed('stats-tall.png', 'stats.png', box=(448, 0, 2880, 3060), width=2200)
framed('learn.png', 'learn.png', box=(620, 30, 2710, 1700), width=1900)
framed('privacy.png', 'privacy.png', width=2000, pad=28)
framed('backup-done.png', 'backup.png', width=2000, pad=28)
