function projectToBox(geom, px, py) {
    const left = geom[0];
    const top = geom[1];
    const right = geom[0] + geom[2];
    const bottom = geom[1] + geom[3];
    
    // Find closest point on box perimeter to (px, py)
    let x = Math.max(left, Math.min(px, right));
    let y = Math.max(top, Math.min(py, bottom));
    
    // If (px, py) is inside the box, this is not enough, but usually waypoints are outside.
    // If it's outside, one of x or y will be on the boundary.
    // Actually, if px is between left and right, x = px.
    // If py > bottom, y = bottom.
    // This perfectly finds [320, 160] for [320, 180]!
    
    // But what if it's diagonal?
    // If px = 200 (left of box), py = 200 (below box).
    // x = 300, y = 160 (corner).
    return [x, y];
}

console.log(projectToBox([300, 100, 350, 60], 320, 180));
