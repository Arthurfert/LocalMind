// Animation de la sphère de points
function initSphere() {
    const canvas = document.getElementById("sphere-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // Définir la taille
    canvas.width = 150;
    canvas.height = 150;

    // Paramètres de la sphère
    const numDots = 200;
    const dots = [];
    const radius = 60;

    for (let i = 0; i < numDots; i++) {
        const phi = Math.acos(-1 + (2 * i) / numDots);
        const theta = Math.sqrt(numDots * Math.PI) * phi;

        dots.push({
            x: radius * Math.cos(theta) * Math.sin(phi),
            y: radius * Math.sin(theta) * Math.sin(phi),
            z: radius * Math.cos(phi)
        });
    }

    let rotation = 0;

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        rotation += 0.005;

        dots.forEach(dot => {
            // Rotation Y
            const x1 = dot.x * Math.cos(rotation) - dot.z * Math.sin(rotation);
            const z1 = dot.z * Math.cos(rotation) + dot.x * Math.sin(rotation);

            // Rotation X légère
            const y1 = dot.y * Math.cos(0.2) - z1 * Math.sin(0.2);
            const z2 = z1 * Math.cos(0.2) + dot.y * Math.sin(0.2);

            // Projection 2D
            const scale = 200 / (200 + z2);
            const x2 = x1 * scale + canvas.width / 2;
            const y2 = y1 * scale + canvas.height / 2;

            const size = Math.max(0.7, scale * 1.5);
            let alpha = Math.min(1, Math.max(0.1, (radius - z2) / (radius * 1.5)));
            if (alpha < 0) alpha = 0;

            ctx.beginPath();
            ctx.arc(x2, y2, size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(2)})`;
            ctx.fill();
        });

        requestAnimationFrame(draw);
    }

    draw();
}
document.addEventListener("DOMContentLoaded", initSphere);

