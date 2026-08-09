function getStartPt(sx, sy, geom, p1, p2) {
    let insertPt = [sx, sy];
    if (Math.abs(p1[0] - p2[0]) > Math.abs(p1[1] - p2[1])) insertPt[0] = p1[0];
    else insertPt[1] = p1[1];
    
    let path = [[sx, sy]];
    if (insertPt[0] !== sx || insertPt[1] !== sy) path.push(insertPt);
    path.push(p1);
    
    const left = geom[0], top = geom[1], right = geom[0]+geom[2], bottom = geom[1]+geom[3];
    
    let outsidePt = null;
    for (let p of path) {
        if (p[0] < left || p[0] > right || p[1] < top || p[1] > bottom) {
            outsidePt = p;
            break;
        }
    }
    
    if (outsidePt) {
        let x = Math.max(left, Math.min(outsidePt[0], right));
        let y = Math.max(top, Math.min(outsidePt[1], bottom));
        return [x, y];
    }
    return [sx, sy]; // fallback
}

// 2-wp: left arrow
console.log("2-wp:", getStartPt(475, 130, [300, 100, 350, 60], [320, 180], [125, 180]));
// 1-wp:
console.log("1-wp:", getStartPt(400, 130, [300, 100, 200, 60], [160, 200], [160, 280]));
