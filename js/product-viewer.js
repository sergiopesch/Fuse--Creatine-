(function () {
    'use strict';

    const viewerNodes = document.querySelectorAll('[data-product-viewer]');
    if (!viewerNodes.length) return;

    const THREE_SRC = 'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js';
    let THREE = window.THREE;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function markFallback() {
        viewerNodes.forEach(node => node.classList.add('viewer-fallback'));
    }

    function loadThree() {
        if (window.THREE) return Promise.resolve(window.THREE);

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            const timeout = window.setTimeout(() => {
                script.remove();
                reject(new Error('Three.js load timed out'));
            }, 5000);

            script.src = THREE_SRC;
            script.async = true;
            script.onload = () => {
                window.clearTimeout(timeout);
                if (window.THREE) resolve(window.THREE);
                else reject(new Error('Three.js loaded without global THREE'));
            };
            script.onerror = () => {
                window.clearTimeout(timeout);
                reject(new Error('Three.js failed to load'));
            };

            document.head.appendChild(script);
        });
    }

    function createRoundedRectShape(width, height, radius) {
        const x = -width / 2;
        const y = -height / 2;
        const shape = new THREE.Shape();

        shape.moveTo(x + radius, y);
        shape.lineTo(x + width - radius, y);
        shape.quadraticCurveTo(x + width, y, x + width, y + radius);
        shape.lineTo(x + width, y + height - radius);
        shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        shape.lineTo(x + radius, y + height);
        shape.quadraticCurveTo(x, y + height, x, y + height - radius);
        shape.lineTo(x, y + radius);
        shape.quadraticCurveTo(x, y, x + radius, y);

        return shape;
    }

    function createPowderTexture(size) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        const gradient = ctx.createLinearGradient(0, 0, size, size);
        gradient.addColorStop(0, '#f4ead8');
        gradient.addColorStop(0.48, '#ddceb5');
        gradient.addColorStop(1, '#f7efdf');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        for (let i = 0; i < 5200; i += 1) {
            const alpha = 0.05 + Math.random() * 0.14;
            const light = Math.random() > 0.54 ? 255 : 205;
            const warm = Math.random() > 0.5 ? 238 : 220;
            ctx.fillStyle = `rgba(${light}, ${warm}, ${190 + Math.random() * 38}, ${alpha})`;
            const r = Math.random() * 1.05 + 0.18;
            ctx.beginPath();
            ctx.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2);
            ctx.fill();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2.2, 2.2);
        texture.anisotropy = 8;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        return texture;
    }

    function createLabelTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '800 132px Inter, Arial, sans-serif';
        ctx.letterSpacing = '14px';

        ctx.shadowColor = 'rgba(255, 255, 255, 0.42)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = 'rgba(92, 82, 67, 0.62)';
        ctx.fillText('FUSE', 512, 210);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
        ctx.lineWidth = 2;
        ctx.strokeText('FUSE', 512, 210);

        ctx.fillStyle = '#ff3b30';
        const underlineWidth = 210;
        const underlineHeight = 22;
        const underlineX = (canvas.width - underlineWidth) / 2;
        ctx.beginPath();
        ctx.roundRect(underlineX, 320, underlineWidth, underlineHeight, 9);
        ctx.fill();

        const texture = new THREE.CanvasTexture(canvas);
        texture.anisotropy = 8;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        return texture;
    }

    function createProductGroup() {
        const group = new THREE.Group();
        const powderTexture = createPowderTexture(512);
        const labelTexture = createLabelTexture();

        const shape = createRoundedRectShape(2.25, 2.05, 0.34);
        const geometry = new THREE.ExtrudeGeometry(shape, {
            depth: 1.02,
            bevelEnabled: true,
            bevelSize: 0.12,
            bevelThickness: 0.13,
            bevelSegments: 18,
            curveSegments: 24,
        });
        geometry.center();
        geometry.computeVertexNormals();

        const material = new THREE.MeshPhysicalMaterial({
            color: 0xe2d3ba,
            roughness: 0.92,
            metalness: 0,
            clearcoat: 0.08,
            clearcoatRoughness: 0.95,
            bumpMap: powderTexture,
            bumpScale: 0.04,
        });

        const block = new THREE.Mesh(geometry, material);
        block.castShadow = true;
        block.receiveShadow = true;
        group.add(block);

        const labelMaterial = new THREE.MeshBasicMaterial({
            map: labelTexture,
            transparent: true,
            depthWrite: false,
            toneMapped: false,
        });
        const label = new THREE.Mesh(new THREE.PlaneGeometry(1.62, 0.82), labelMaterial);
        label.position.set(0.07, -0.04, 0.665);
        group.add(label);

        return group;
    }

    function mountViewer(shell, index) {
        const canvasHost = shell.querySelector('.product-viewer-canvas');
        if (!canvasHost) return;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
        camera.position.set(0, 0, 5.4);

        const renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance',
        });
        renderer.setClearColor(0x000000, 0);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        canvasHost.appendChild(renderer.domElement);

        const product = createProductGroup();
        product.rotation.x = -0.22;
        product.rotation.y = index === 0 ? -0.42 : 0.42;
        product.position.y = shell.classList.contains('showcase-product') ? 0.28 : 0;
        scene.add(product);

        const keyLight = new THREE.DirectionalLight(0xffffff, 2.45);
        keyLight.position.set(-2.5, 3.4, 4.2);
        scene.add(keyLight);

        const rimLight = new THREE.DirectionalLight(0xffffff, 1.45);
        rimLight.position.set(3.4, 2.2, -2.2);
        scene.add(rimLight);

        const fillLight = new THREE.HemisphereLight(0xfffbf1, 0x1a0b08, 1.05);
        scene.add(fillLight);

        const redAccent = new THREE.PointLight(0xff3b30, 1.8, 6);
        redAccent.position.set(1.2, -1.8, 2.5);
        scene.add(redAccent);

        const shadow = new THREE.Mesh(
            new THREE.CircleGeometry(1.75, 64),
            new THREE.MeshBasicMaterial({
                color: 0x000000,
                transparent: true,
                opacity: 0.22,
                depthWrite: false,
            })
        );
        shadow.position.set(0.05, -1.28, -0.15);
        shadow.scale.set(1.25, 0.34, 1);
        scene.add(shadow);

        const state = {
            dragging: false,
            lastX: 0,
            lastY: 0,
            targetX: product.rotation.x,
            targetY: product.rotation.y,
            idleRotation: reducedMotion ? 0 : 0.002,
        };

        function resize() {
            const rect = shell.getBoundingClientRect();
            const width = Math.max(1, Math.floor(rect.width));
            const height = Math.max(1, Math.floor(rect.height));
            const showcaseScale = shell.classList.contains('showcase-product') ? 0.78 : 0.9;
            const scale = width < 260 ? 0.58 : width < 340 ? 0.66 : showcaseScale;
            product.scale.setScalar(scale);
            shadow.visible = width >= 260;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height, false);
        }

        function pointerDown(event) {
            state.dragging = true;
            state.lastX = event.clientX;
            state.lastY = event.clientY;
            shell.setPointerCapture(event.pointerId);
        }

        function pointerMove(event) {
            if (!state.dragging) return;
            const dx = event.clientX - state.lastX;
            const dy = event.clientY - state.lastY;
            state.lastX = event.clientX;
            state.lastY = event.clientY;
            state.targetY += dx * 0.008;
            state.targetX += dy * 0.006;
            state.targetX = Math.max(-1.25, Math.min(1.25, state.targetX));
        }

        function pointerUp(event) {
            state.dragging = false;
            if (shell.hasPointerCapture(event.pointerId))
                shell.releasePointerCapture(event.pointerId);
        }

        function keyDown(event) {
            const step = event.shiftKey ? 0.3 : 0.14;
            if (event.key === 'ArrowLeft') state.targetY -= step;
            else if (event.key === 'ArrowRight') state.targetY += step;
            else if (event.key === 'ArrowUp') state.targetX -= step;
            else if (event.key === 'ArrowDown') state.targetX += step;
            else return;
            event.preventDefault();
        }

        shell.addEventListener('pointerdown', pointerDown);
        shell.addEventListener('pointermove', pointerMove);
        shell.addEventListener('pointerup', pointerUp);
        shell.addEventListener('pointercancel', pointerUp);
        canvasHost.addEventListener('keydown', keyDown);

        const observer = new ResizeObserver(resize);
        observer.observe(shell);
        resize();

        function animate() {
            if (!state.dragging) state.targetY += state.idleRotation;
            product.rotation.x += (state.targetX - product.rotation.x) * 0.12;
            product.rotation.y += (state.targetY - product.rotation.y) * 0.12;
            shadow.rotation.z = -product.rotation.y * 0.18;
            renderer.render(scene, camera);
            window.requestAnimationFrame(animate);
        }

        shell.classList.add('viewer-ready');
        animate();
    }

    function init() {
        const start = () => {
            loadThree()
                .then(three => {
                    THREE = three;
                    viewerNodes.forEach((node, index) => {
                        try {
                            mountViewer(node, index);
                        } catch (error) {
                            console.warn(
                                '[FUSE Product Viewer] Falling back to product image.',
                                error
                            );
                            node.classList.add('viewer-fallback');
                        }
                    });
                })
                .catch(error => {
                    console.warn('[FUSE Product Viewer] Falling back to product image.', error);
                    markFallback();
                });
        };

        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(start, { timeout: 1200 });
        } else {
            window.setTimeout(start, 0);
        }
    }

    if (document.readyState === 'complete') init();
    else window.addEventListener('load', init, { once: true });
})();
