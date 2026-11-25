"""Run once on the bundled source fonts: python3 scripts/subset-fonts.py.
Build-time only dependencies: fonttools and brotli. Preserve Latin Extended for names.
"""
from pathlib import Path
from io import BytesIO
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset
root = Path(__file__).resolve().parents[1]
for name in ['uz-events-serif.woff2', 'uz-events-serif-italic.woff2']:
    path = root / 'public/fonts' / name
    before = path.stat().st_size
    font = TTFont(path)
    if 'fvar' in font:
        axes = {a.axisTag: (400, 700) for a in font['fvar'].axes if a.axisTag == 'wght'}
        font = instantiateVariableFont(font, axes, inplace=True)
    # Reload the instantiated font so lazy variation tables use the new glyph order.
    buf = BytesIO(); font.save(buf); buf.seek(0); font = TTFont(buf)
    options = subset.Options()
    options.flavor = 'woff2'
    options.name_IDs = ['*']
    options.name_legacy = True
    options.name_languages = ['*']
    sub = subset.Subsetter(options=options)
    sub.populate(unicodes=list(range(0x20, 0x250)) + list(range(0x1e00, 0x1f00)) + list(range(0x2000, 0x2070)) + [0x20ac, 0x2122, 0x2190, 0x2192, 0x2212])
    sub.subset(font)
    font.save(path)
    checked = TTFont(path)
    assert all(ord(c) in checked.getBestCmap() for c in 'University of Zimbabweéñ–’')
    print(f'{name}: {before} -> {path.stat().st_size} bytes')
