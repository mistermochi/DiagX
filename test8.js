const buffer = Buffer.from('\uFEFF<mxfile', 'utf8');
const textDecoder = new TextDecoder('utf-8');
let text = textDecoder.decode(buffer);
let clean = text.trim();
console.log(clean.startsWith('<mxfile'));
