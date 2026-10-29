const fs=require('fs');
const src=fs.readFileSync('/app/www/js/i18n.js','utf8');
const m=src.match(/const translations = (\{[\s\S]*?\n\});/);
const tr=eval('('+m[1]+')');
for (const [k,v] of Object.entries(tr)) if (v.en===v.it || v.es===v.it) console.log(k, JSON.stringify(v).slice(0,140));
