const sx = 100, sy = 100;
const px = 200, py = 300;

let startPt = [sx, sy];
// If we want startPt to align with px, py
if (Math.abs(sx - px) < Math.abs(sy - py)) {
    startPt[0] = px; // Vertical segment? No, if startPt[0] == px, then the segment from startPt to [px, py] has the same X. So it's a vertical segment from [px, sy] to [px, py]? 
    // Wait, the original startPt is [sx, sy]. If we change startPt[0] = px, we are changing the starting point! We are saying the edge starts at [px, sy] instead of [sx, sy]!
} else {
    startPt[1] = py; // Edge starts at [sx, py]?
}
console.log(startPt);
