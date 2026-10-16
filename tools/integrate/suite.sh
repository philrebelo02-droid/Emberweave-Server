#!/bin/bash
# every standalone test with no browser and no port 8871, on a tree, 6 at a time: suite.sh <tree> <outdir>  -> <outdir>/codes.txt (name exit)
# (the v1162-v1175 releases' suite.sh; tools/integrate/checks.py --suite runs it on the release tree and on BASE and compares the pass sets)
T=$1; O=$2; mkdir -p $O; rm -f $O/codes.txt; cd $T
ls tests/test_*.js | while read f; do if ! grep -qE "playwright|chromium|puppeteer|8871" $f; then echo $f; fi; done > $O/list.txt
export NODE_PATH=${NODE_PATH:-C:/Users/Home/Downloads/Emberweave-Server/node_modules}
cat $O/list.txt | xargs -P 6 -I{} bash -c 'n=$(basename {} .js); timeout 1500 node {} > '$O'/$n.log 2>&1; echo "$n $?" >> '$O'/codes.txt'
sort -o $O/codes.txt $O/codes.txt; echo DONE $(wc -l < $O/codes.txt)
