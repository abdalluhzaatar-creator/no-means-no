#!/bin/sh
# One HTML file of the whole game for a PC: opens with a double click, no server needed.
# Usage: sh tools/build-pc.sh   →   NoMeansNo-PC.html
set -e
cd "$(dirname "$0")/.."
npx --yes esbuild js/app.js --bundle --format=iife --minify --outfile=/tmp/nmn-game.js --log-level=warning
python3 - <<'PY'
html = open('index.html').read()
css = open('css/style.css').read()
js = open('/tmp/nmn-game.js').read().replace('</script', '<\\/script')
html = html.replace('<link rel="stylesheet" href="css/style.css">', '<style>' + css + '</style>')
html = html.replace('<script type="module" src="js/app.js"></script>', '<script>' + js + '</script>')
open('NoMeansNo-PC.html', 'w').write(html)
PY
echo "NoMeansNo-PC.html ready"
