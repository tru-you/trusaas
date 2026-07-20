#!/bin/bash
FILES="src/App.tsx src/components/*.tsx"

sed -i -E 's/bg-slate-50/bg-\[#070d15\]/g' $FILES
sed -i -E 's/bg-white/bg-\[#0f1826\]/g' $FILES

sed -i -E 's/text-slate-900/text-\[#E8EEF6\]/g' $FILES
sed -i -E 's/text-slate-600/text-\[#9DB0C6\]/g' $FILES
sed -i -E 's/text-slate-500/text-gray-400/g' $FILES
sed -i -E 's/text-slate-400/text-white\/50/g' $FILES
sed -i -E 's/text-slate-700/text-white\/80/g' $FILES

sed -i -E 's/border-slate-200/border-white\/10/g' $FILES
sed -i -E 's/border-slate-300/border-white\/20/g' $FILES
sed -i -E 's/border-t-slate-200/border-t-white\/10/g' $FILES
sed -i -E 's/border-b-slate-200/border-b-white\/10/g' $FILES

sed -i -E 's/hover:bg-slate-100/hover:bg-white\/5/g' $FILES
sed -i -E 's/hover:bg-slate-200/hover:bg-white\/10/g' $FILES
sed -i -E 's/hover:text-slate-900/hover:text-white/g' $FILES

echo "Reverted"
