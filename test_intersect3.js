function perimeterIntersect(geom, cx, cy, nx, ny) {
    const left = geom[0];
    const top = geom[1];
    const right = geom[0] + geom[2];
    const bottom = geom[1] + geom[3];

    const dx = nx - cx;
    const dy = ny - cy;

    if (dx === 0 && dy === 0) return [cx, cy];

    let minT = Infinity;
    
    if (dx > 0) minT = Math.min(minT, (right - cx) / dx);
    else if (dx < 0) minT = Math.min(minT, (left - cx) / dx);

    if (dy > 0) minT = Math.min(minT, (bottom - cy) / dy);
    else if (dy < 0) minT = Math.min(minT, (top - cy) / dy);

    if (minT === Infinity) return [cx, cy];
    return [cx + minT * dx, cy + minT * dy];
}

console.log(perimeterIntersect([100, 100, 100, 50], 300, 125, 300, 300));
