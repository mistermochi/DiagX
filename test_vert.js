const sx = 475, sy = 130;
const ex = 125, ey = 230;
const w = 350, h = 60;
const w2 = 150, h2 = 60;

// Current heuristic
const current_vert = (Math.abs(sy - ey) / Math.abs(sx - ex)) > (h / w);

// New heuristic
const gapY = Math.abs(sy - ey) - (h + h2) / 2;
const gapX = Math.abs(sx - ex) - (w + w2) / 2;
let new_vert = true;

const elbow = 'vertical'; // Assume default elbow is vertical in draw.io for top-to-bottom

if (Math.abs(sy - ey) > h && Math.abs(sx - ex) > w) {
    // If separated both ways, prefer vertical if dy > dx? No, flowcharts are usually vertical.
    // Let's just say if sy != ey, use vertical.
}

console.log({current_vert});
