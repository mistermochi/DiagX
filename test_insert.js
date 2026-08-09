function getPath(sx, sy, explicitStart, ex, ey, explicitEnd, pts) {
    let startPt = [sx, sy];
    let endPt = [ex, ey];
    let newPts = [...pts];

    if (!explicitStart && pts.length > 0) {
        const p1 = pts[0];
        const p2 = pts.length > 1 ? pts[1] : endPt;
        let insertPt = [sx, sy];
        if (Math.abs(p1[0] - p2[0]) > Math.abs(p1[1] - p2[1])) {
            insertPt[0] = p1[0];
        } else {
            insertPt[1] = p1[1];
        }
        if (insertPt[0] !== sx || insertPt[1] !== sy) {
            newPts.unshift(insertPt);
        }
    }
    
    if (!explicitEnd && pts.length > 0) {
        const plast = pts[pts.length - 1];
        const pprev = pts.length > 1 ? pts[pts.length - 2] : startPt;
        let insertPt = [ex, ey];
        if (Math.abs(plast[0] - pprev[0]) > Math.abs(plast[1] - pprev[1])) {
            insertPt[0] = plast[0];
        } else {
            insertPt[1] = plast[1];
        }
        if (insertPt[0] !== ex || insertPt[1] !== ey) {
            newPts.push(insertPt);
        }
    }
    
    return [startPt, ...newPts, endPt];
}

console.log(getPath(400, 130, false, 160, 280, false, [[160, 200]]));
