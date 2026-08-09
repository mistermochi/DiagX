const w = 200;
const h = 60;
const sx = 150, sy = 150; // top-left box
const ex = 400, ey = 300; // bottom-middle box

const vert = (Math.abs(sy - ey) / Math.abs(sx - ex)) > (h / w);
console.log("sy-ey:", Math.abs(sy - ey), "sx-ex:", Math.abs(sx - ex), "ratio:", Math.abs(sy - ey) / Math.abs(sx - ex), "h/w:", h/w, "vert:", vert);
