"""Build a self-contained HTML preview of the X Article from article.md.
Usage: python3 -I /tmp/work/build_preview.py <article_dir>
Writes <article_dir>/preview.html with all images embedded."""
import base64, html, os, re, sys

d = sys.argv[1]
src = open(os.path.join(d, 'article.md'), encoding='utf-8').read()


def inline(t):
    t = html.escape(t, quote=False)
    t = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])', r'<em>\1</em>', t)
    return t


def img_tag(alt, path):
    p = os.path.join(d, path)
    if os.path.exists(p):
        data = base64.b64encode(open(p, 'rb').read()).decode()
        img = f'<img src="data:image/png;base64,{data}" alt="{html.escape(alt)}">'
    else:
        img = f'<div class="missing">missing: {html.escape(path)}</div>'
    return f'<figure>{img}<figcaption>Image: {html.escape(os.path.basename(path))}</figcaption></figure>'


out, lines, i = [], src.split('\n'), 0
title = ''
while i < len(lines):
    ln = lines[i]
    if ln.startswith('```'):
        j = i + 1
        buf = []
        while j < len(lines) and not lines[j].startswith('```'):
            buf.append(lines[j]); j += 1
        out.append('<pre><code>' + html.escape('\n'.join(buf)) + '</code></pre>')
        i = j + 1; continue
    if not ln.strip():
        i += 1; continue
    if ln.startswith('# '):
        title = ln[2:].strip(); out.append(f'<h1>{inline(title)}</h1>')
    elif ln.startswith('## '):
        out.append(f'<h2>{inline(ln[3:].strip())}</h2>')
    elif ln.strip() == '---':
        out.append('<hr>')
    elif re.match(r'!\[(.*?)\]\((.*?)\)', ln.strip()):
        m = re.match(r'!\[(.*?)\]\((.*?)\)', ln.strip())
        out.append(img_tag(m.group(1), m.group(2)))
    elif ln.startswith('> '):
        buf = []
        while i < len(lines) and lines[i].startswith('> '):
            buf.append(lines[i][2:]); i += 1
        out.append('<blockquote>' + inline(' '.join(buf)) + '</blockquote>'); continue
    elif re.match(r'^- ', ln):
        buf = []
        while i < len(lines) and re.match(r'^- ', lines[i]):
            buf.append('<li>' + inline(lines[i][2:]) + '</li>'); i += 1
        out.append('<ul>' + ''.join(buf) + '</ul>'); continue
    elif re.match(r'^\d+\. ', ln):
        buf = []
        while i < len(lines) and re.match(r'^\d+\. ', lines[i]):
            buf.append('<li>' + inline(re.sub(r'^\d+\. ', '', lines[i])) + '</li>'); i += 1
        out.append('<ol>' + ''.join(buf) + '</ol>'); continue
    else:
        out.append(f'<p>{inline(ln.strip())}</p>')
    i += 1

page = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<style>
  body {{ margin: 0; background: #fff; color: #0f1419; font: 17px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, Helvetica, Arial, sans-serif; }}
  .note {{ background: #f7f3ec; border-bottom: 1px solid #e6dfd3; padding: 14px 20px; font-size: 14px; line-height: 1.5; color: #3b3833; }}
  .note b {{ color: #9c3b17; }}
  article {{ max-width: 640px; margin: 0 auto; padding: 28px 20px 80px; }}
  h1 {{ font-size: 31px; line-height: 1.2; margin: 0 0 22px; letter-spacing: -0.01em; }}
  h2 {{ font-size: 23px; line-height: 1.3; margin: 34px 0 14px; }}
  p {{ margin: 0 0 14px; }}
  ul, ol {{ margin: 0 0 16px; padding-left: 24px; }}
  li {{ margin: 0 0 8px; }}
  blockquote {{ margin: 18px 0; padding: 4px 0 4px 16px; border-left: 3px solid #cfd9de; color: #36414a; }}
  pre {{ background: #f7f9f9; border: 1px solid #eff3f4; border-radius: 10px; padding: 14px 16px; overflow-x: auto; margin: 6px 0 20px; }}
  code {{ font: 13.5px/1.55 "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace; font-variant-ligatures: none; }}
  hr {{ border: 0; border-top: 1px solid #eff3f4; margin: 34px 0; }}
  figure {{ margin: 10px 0 22px; }}
  figure img {{ width: 100%; border-radius: 14px; border: 1px solid #eff3f4; display: block; }}
  figcaption {{ font: 12px/1.4 ui-monospace, Menlo, monospace; color: #8b98a5; margin-top: 6px; }}
  .missing {{ padding: 40px; text-align: center; background: #fee; color: #a00; border-radius: 12px; }}
</style></head><body>
<div class="note"><b>Прев'ю статті для X.</b> Текст можна виділити й вставити в редактор X Articles: заголовки, жирний, списки й цитати переносяться. Картинки завантажуй окремо з папки images, підпис під кожною показує, яка саме. Код додавай окремим блоком коду в редакторі X, як в оригінальній статті.</div>
<article>
{chr(10).join(out)}
</article></body></html>'''
open(os.path.join(d, 'preview.html'), 'w', encoding='utf-8').write(page)
print('wrote', os.path.join(d, 'preview.html'), len(page) // 1024, 'KB')
