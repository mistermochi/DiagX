function getStart(cx, cy, geom, p1x, p1y) {
    const left = geom[0];
    const top = geom[1];
    const right = geom[0] + geom[2];
    const bottom = geom[1] + geom[3];
    
    let x = Math.max(left, Math.min(p1x, right));
    let y = Math.max(top, Math.min(p1y, bottom));
    
    // If [p1x, p1y] is outside, [x, y] is on the boundary.
    // If [p1x, p1y] is inside, [x, y] = [p1x, p1y] (this is rare for waypoints).
    return [x, y];
}

console.log("2-wp start:", getStart(475, 130, [300, 100, 350, 60], 320, 180));
console.log("1-wp start:", getStart(400, 130, [300, 100, 200, 60], 160, 200));
