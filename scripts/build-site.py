"""Build an atomic page and content-addressed scripts for GitHub Pages."""
from pathlib import Path
import hashlib
import shutil

root = Path(__file__).resolve().parent.parent
output = root / "_site"
output.mkdir(exist_ok=True)
html = (root / "index.html").read_text(encoding="utf-8")
css = (root / "style.css").read_text(encoding="utf-8")
css_link = '<link rel="stylesheet" href="style.css">'
if html.count(css_link) != 1:
    raise RuntimeError("Expected exactly one site stylesheet")
# The page and its styles now arrive in one response, even with an old cache.
html = html.replace(css_link, '<style id="site-styles">\n' + css + '\n</style>')
for source in ("script.js", "cursor.js"):
    data = (root / source).read_bytes()
    filename = Path(source).stem + "." + hashlib.sha256(data).hexdigest()[:12] + ".js"
    reference = 'src="' + source + '"'
    if html.count(reference) != 1:
        raise RuntimeError("Expected exactly one reference to " + source)
    html = html.replace(reference, 'src="' + filename + '"')
    (output / filename).write_bytes(data)
# Keep previous URLs valid for visitors whose HTML is still cached.
for source in ("style.css", "script.js", "cursor.js"):
    shutil.copyfile(root / source, output / source)
shutil.copytree(root / "assets", output / "assets", dirs_exist_ok=True)
(output / "index.html").write_text(html, encoding="utf-8", newline="\n")
(output / ".nojekyll").touch()
print("Built page with embedded styles and versioned scripts:", output)
