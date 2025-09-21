"use strict";

var canvas;
var gl;
var program;

var modelViewMatrix, projectionMatrix;
var modelViewMatrixLoc, projectionMatrixLoc;

var vertices = [];
var vertexColors = [];
var indices = [];

// Variabel Animasi
var isAnimating = false;
var animationPreset = 'spin';
var animationTime = 0;

init();

/**
 * Fungsi utama untuk inisialisasi WebGL
 */
function init() {
    canvas = document.getElementById("gl-canvas");
    gl = canvas.getContext('webgl2');
    if (!gl) alert("WebGL 2.0 isn't available");

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);
    
    // Buat model monitor
    createMonitorModel();

    // Setup buffer
    setupBuffers();

    // Dapatkan lokasi uniform
    modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
    projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");

    // Atur matriks proyeksi (sudut pandang kamera)
    projectionMatrix = perspective(50.0, canvas.width / canvas.height, 0.1, 100.0);
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));

    setupEventListeners();

    render();
}

/**
 * Membuat geometri dan warna untuk model monitor
 */

function createMonitorModel() {
    // Warna
    const screenBezelColor = vec4(0.2, 0.2, 0.2, 1.0); // Abu-abu gelap
    const screenPanelColor = vec4(0.05, 0.05, 0.05, 1.0); // Hampir hitam
    const standColor = vec4(0.5, 0.5, 0.5, 1.0); // Abu-abu medium untuk tiang
    const baseColor = vec4(0.3, 0.3, 0.3, 1.0);   // Abu-abu lebih gelap untuk alas
    
    // Dimensi
    const screenWidth = 0.7;
    const screenHeight = 0.42; // Sedikit lebih tinggi
    const screenDepth = 0.05;  // Sedikit lebih tebal
    
    // Vertikal offset untuk centering
    const yOffset = 0.35; 

    // 1. Bezel/Bingkai Layar (Balok)
    createCube(screenWidth, screenHeight, screenDepth, screenBezelColor, 0, yOffset, 0);

    // 2. Panel Layar (Balok lebih tipis di depan Bezel)
    createCube(screenWidth * 0.92, screenHeight * 0.88, 0.01, screenPanelColor, 0, yOffset, screenDepth / 2 + 0.005);
    
    // 3. Tiang Penyangga (Silinder) - Dibuat lebih pendek
    const standHeight = 0.25; // <--- TINGGI TIANG DIKURANGI
    const standYPos = yOffset - (screenHeight / 2) - (standHeight / 2);
    generateCylinder(0.04, standHeight, 20, standColor, 0, standYPos, 0);

    // 4. Alas/Base (Silinder pendek dan lebar) - Tetap sama, posisinya disesuaikan
    const baseYPos = standYPos - (standHeight / 2) - 0.015;
    generateCylinder(0.2, 0.03, 30, baseColor, 0, baseYPos, 0);
}
/**
 * Helper function untuk membuat balok (untuk layar dan bezel)
 */
function createCube(width, height, depth, color, cx, cy, cz) {
    const w = width / 2;
    const h = height / 2;
    const d = depth / 2;

    const v = [
        vec3(-w + cx, -h + cy, d + cz), // 0
        vec3( w + cx, -h + cy, d + cz), // 1
        vec3( w + cx,  h + cy, d + cz), // 2
        vec3(-w + cx,  h + cy, d + cz), // 3
        vec3(-w + cx, -h + cy, -d + cz),// 4
        vec3( w + cx, -h + cy, -d + cz),// 5
        vec3( w + cx,  h + cy, -d + cz),// 6
        vec3(-w + cx,  h + cy, -d + cz) // 7
    ];
    
    const startIndex = vertices.length;
    vertices.push(...v);
    for (let i = 0; i < 8; i++) vertexColors.push(color);

    const cubeIndices = [
        0, 1, 2, 0, 2, 3, // Depan
        4, 5, 6, 4, 6, 7, // Belakang
        3, 2, 6, 3, 6, 7, // Atas
        0, 1, 5, 0, 5, 4, // Bawah
        4, 0, 3, 4, 3, 7, // Kiri
        1, 5, 6, 1, 6, 2  // Kanan
    ];

    for (const index of cubeIndices) {
        indices.push(startIndex + index);
    }
}

/**
 * Helper function untuk membuat silinder (untuk tiang dan alas)
 */
function generateCylinder(radius, height, segments, color, cx, cy, cz) {
    const h = height / 2;
    const startIndex = vertices.length;

    // Titik pusat atas dan bawah
    const topCenter = vec3(cx, cy + h, cz);
    const bottomCenter = vec3(cx, cy - h, cz);
    vertices.push(topCenter, bottomCenter);
    vertexColors.push(color, color);
    const topCenterIndex = startIndex;
    const bottomCenterIndex = startIndex + 1;

    // Buat titik-titik melingkar
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * 2 * Math.PI;
        const x = cx + radius * Math.cos(angle);
        const z = cz + radius * Math.sin(angle);
        vertices.push(vec3(x, cy + h, z)); // Lingkaran atas
        vertices.push(vec3(x, cy - h, z)); // Lingkaran bawah
        vertexColors.push(color, color);
    }

    // Buat sisi-sisi dan tutup
    for (let i = 0; i < segments; i++) {
        const top1 = startIndex + 2 + i * 2;
        const bottom1 = top1 + 1;
        const top2 = startIndex + 2 + (i + 1) * 2;
        const bottom2 = top2 + 1;

        // Sisi samping
        indices.push(top1, bottom1, top2);
        indices.push(bottom1, bottom2, top2);
        
        // Tutup atas
        indices.push(topCenterIndex, top1, top2);
        
        // Tutup bawah
        indices.push(bottomCenterIndex, bottom2, bottom1);
    }
}


/**
 * Mengirim data ke GPU
 */
function setupBuffers() {
    // Buffer Indeks
    var iBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    // Buffer Warna
    var cBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(vertexColors), gl.STATIC_DRAW);
    var colorLoc = gl.getAttribLocation(program, "aColor");
    gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(colorLoc);

    // Buffer Posisi
    var vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW);
    var positionLoc = gl.getAttribLocation(program, "aPosition");
    gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(positionLoc);
}

/**
 * Fungsi render yang dipanggil setiap frame
 */
function render() {
    // Ambil nilai dari UI
    const bgColor = document.getElementById('bg-color').value;
    let posX = parseFloat(document.getElementById('position-x').value);
    let posY = parseFloat(document.getElementById('position-y').value);
    let posZ = parseFloat(document.getElementById('position-z').value);
    let rotX = parseFloat(document.getElementById('rotation-x').value);
    let rotY = parseFloat(document.getElementById('rotation-y').value);
    let rotZ = parseFloat(document.getElementById('rotation-z').value);
    let scaleValue = parseFloat(document.getElementById('scale').value);
    
    // Logika Animasi
    if (isAnimating) {
        animationTime += 0.016; // ~60fps
        if (animationPreset === 'spin') {
            rotY = (animationTime * 50) % 360;
            document.getElementById('rotation-y').value = rotY.toFixed(0);
            document.getElementById('rotation-y-value').textContent = rotY.toFixed(0);
        } else if (animationPreset === 'bounce') {
            posY = 0.3 * Math.sin(animationTime * 4); // Langsung ubah variabel posY
            document.getElementById('position-y').value = posY.toFixed(2);
            document.getElementById('position-y-value').textContent = posY.toFixed(2);
        } else if (animationPreset === 'pulse') {
            scaleValue = 1.0 + 0.2 * Math.sin(animationTime * 5);
            document.getElementById('scale').value = scaleValue.toFixed(2);
            document.getElementById('scale-value').textContent = scaleValue.toFixed(2);
        }
    }

    // Atur warna background
    const rgb = hexToRgb(bgColor);
    gl.clearColor(rgb[0], rgb[1], rgb[2], 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_TEST_BIT);

    // Bangun Model-View Matrix dari nilai UI
    let mvm = mat4();
    mvm = mult(mvm, translate(0, 0, -3)); // Mundurkan kamera
    mvm = mult(mvm, translate(posX, posY, posZ));
    mvm = mult(mvm, rotate(rotZ, vec3(0, 0, 1)));
    mvm = mult(mvm, rotate(rotY, vec3(0, 1, 0)));
    mvm = mult(mvm, rotate(rotX, vec3(1, 0, 0)));
    mvm = mult(mvm, scale(scaleValue, scaleValue, scaleValue)); // <-- PERBAIKAN UTAMA DI SINI
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(mvm));

    // Mode Wireframe
    if (document.getElementById('wireframe-mode').checked) {
        // Gambar setiap segitiga sebagai kerangka garis (loop)
        for (let i = 0; i < indices.length; i += 3) {
            gl.drawElements(gl.LINE_LOOP, 3, gl.UNSIGNED_SHORT, i * 2); // offset dikali 2 karena Uint16 = 2 byte
        }
    } else {
        gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    }

    requestAnimationFrame(render);
}


// --- FUNGSI-FUNGSI BANTUAN (UI, Event, dll) ---

function hexToRgb(hex) {
    hex = hex.replace('#', '');
    var bigint = parseInt(hex, 16);
    return [((bigint >> 16) & 255) / 255, ((bigint >> 8) & 255) / 255, (bigint & 255) / 255];
}

function setupEventListeners() {
    // Tombol Animasi
    document.getElementById('animate-btn').onclick = () => {
        isAnimating = !isAnimating;
        animationTime = 0; // Reset waktu animasi
        document.getElementById('animate-btn').textContent = isAnimating ? 'Stop Animasi' : 'Mulai Animasi';
    };
    document.getElementById('animation-preset').onchange = (e) => animationPreset = e.target.value;

    // Update tampilan nilai slider
    const sliders = ['scale', 'position-x', 'position-y', 'position-z', 'rotation-x', 'rotation-y', 'rotation-z'];
    sliders.forEach(id => {
        const slider = document.getElementById(id);
        const span = document.getElementById(id + '-value');
        if (slider && span) {
             slider.addEventListener('input', () => {
                const value = parseFloat(slider.value);
                span.textContent = id.includes('rot') ? value.toFixed(0) : value.toFixed(2);
            });
        }
    });
    
    // Fungsionalitas Reset, Simpan/Muat Preset, Unduh Gambar...
    // (Bisa ditambahkan di sini, mirip dengan kode yang sudah ada di HTML)
}