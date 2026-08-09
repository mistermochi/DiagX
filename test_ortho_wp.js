function getStartPt(sx, sy, ex, ey, pts) {
    let startPt = [sx, sy];
    let endPt = [ex, ey];
    
    // Determine orientation of first segment based on pts[0] and pts[1]
    let p1 = pts[0];
    let p2 = pts.length > 1 ? pts[1] : endPt;
    
    // If p1 and p2 form a horizontal line, start to p1 must be vertical.
    let dx = Math.abs(p1[0] - p2[0]);
    let dy = Math.abs(p1[1] - p2[1]);
    
    if (dx > dy) {
        // p1 to p2 is horizontal, so start to p1 is vertical
        startPt[0] = p1[0];
    } else {
        // p1 to p2 is vertical, so start to p1 is horizontal
        startPt[1] = p1[1];
    }
    
    // Similarly for end
    let pLast = pts[pts.length - 1];
    let pPrev = pts.length > 1 ? pts[pts.length - 2] : startPt;
    
    dx = Math.abs(pLast[0] - pPrev[0]);
    dy = Math.abs(pLast[1] - pPrev[1]);
    
    if (dx > dy) {
        // pPrev to pLast is horizontal, so pLast to end is vertical
        endPt[0] = pLast[0];
    } else {
        endPt[1] = pLast[1];
    }
    
    return {startPt, endPt};
}

// Left arrow: sx=475, sy=130. ex=125, ey=230. pts = [[320, 180], [125, 180]]
console.log(getStartPt(475, 130, 125, 230, [[320, 180], [125, 180]]));
