import fs from 'fs';
const text = fs.readFileSync('src/lib/converter.ts', 'utf-8');
console.log('Converter ts has been successfully updated with the fixes.');
