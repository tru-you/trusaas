#!/bin/bash
FILES="src/App.tsx src/components/*.tsx"

# Backgrounds
sed -i -E 's/bg-\[#(050b12|050e14|070d15|070e18|090D16|0a111a|0a1420|0b121f|0B121F|0b1320|0b1422|0F172A)\]/bg-slate-50/g' $FILES
sed -i -E 's/bg-\[#(0f1826|101b2a|101d25|202c33|1a1a2e)\]/bg-white/g' $FILES

# Texts
sed -i -E 's/text-\[#(E8EEF6)\]/text-slate-900/g' $FILES
sed -i -E 's/text-\[#(9DB0C6|A0B0C6|5F7590)\]/text-slate-600/g' $FILES
sed -i -E 's/text-gray-400/text-slate-500/g' $FILES
sed -i -E 's/text-gray-300/text-slate-600/g' $FILES
sed -i -E 's/text-gray-500/text-slate-500/g' $FILES
sed -i -E 's/text-white\/50/text-slate-400/g' $FILES
sed -i -E 's/text-white\/70/text-slate-600/g' $FILES
sed -i -E 's/text-white\/80/text-slate-700/g' $FILES

# Borders
sed -i -E 's/border-white\/10/border-slate-200/g' $FILES
sed -i -E 's/border-white\/20/border-slate-300/g' $FILES
sed -i -E 's/border-white\/30/border-slate-300/g' $FILES
sed -i -E 's/border-t-white\/10/border-t-slate-200/g' $FILES
sed -i -E 's/border-b-white\/10/border-b-slate-200/g' $FILES
sed -i -E 's/border-\[#101b2a\]/border-slate-200/g' $FILES
sed -i -E 's/border-\[#1a1a2e\]/border-slate-200/g' $FILES

# Hovers
sed -i -E 's/hover:bg-\[#(101b2a|0f1826|1a1a2e)\]/hover:bg-slate-100/g' $FILES
sed -i -E 's/hover:bg-white\/5/hover:bg-slate-100/g' $FILES
sed -i -E 's/hover:bg-white\/10/hover:bg-slate-200/g' $FILES
sed -i -E 's/hover:text-white/hover:text-slate-900/g' $FILES
sed -i -E 's/hover:text-\[#E8EEF6\]/hover:text-slate-900/g' $FILES

# Wait, the buttons still need `text-white` when they have a blue background `bg-[#1466E0]`
# I will make sure the brand color `bg-[#1466E0]` gets `text-white`. Usually they already have `text-white`.

echo "Done"
