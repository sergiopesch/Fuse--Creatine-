/**
 * FUSE Premium 3D Product - Honeycomb Capsule
 * White dodecahedron capsule with honeycomb texture
 * Elegant, high-end supplement visualization
 */

(function() {
    'use strict';

    function isWebGLAvailable() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext &&
                (canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    }

    function loadThreeJS(callback) {
        if (window.THREE) {
            callback();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/three@0.160.0/build/three.min.js';
        script.onload = callback;
        script.onerror = () => console.warn('Three.js failed to load');
        document.head.appendChild(script);
    }

    class FuseProduct3D {
        constructor(container) {
            this.container = container;
            this.mouse = { x: 0, y: 0 };
            this.targetRotation = { x: 0, y: 0 };
            this.currentRotation = { x: 0, y: 0 };
            this.baseRotationY = Math.PI * 0.15;
            this.baseRotationX = Math.PI * 0.08;
            this.isHovering = false;
            this.time = 0;

            // Interaction limits
            this.maxRotationX = 0.25;
            this.maxRotationY = 0.5;

            this.init();
        }

        init() {
            const width = this.container.clientWidth || 340;
            const height = this.container.clientHeight || 450;

            // Scene
            this.scene = new THREE.Scene();

            // Camera
            this.camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 1000);
            this.camera.position.set(0, 0.5, 5.5);
            this.camera.lookAt(0, 0, 0);

            // High-quality renderer
            this.renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true,
                powerPreference: 'high-performance',
                precision: 'highp'
            });
            this.renderer.setSize(width, height);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3));
            this.renderer.setClearColor(0x000000, 0);

            if (THREE.SRGBColorSpace) {
                this.renderer.outputColorSpace = THREE.SRGBColorSpace;
            }
            if (THREE.ACESFilmicToneMapping) {
                this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
                this.renderer.toneMappingExposure = 1.3;
            }
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

            this.container.appendChild(this.renderer.domElement);
            this.container.classList.add('has-webgl');

            this.setupLighting();
            this.createCapsule();
            this.setupInteractions();
            this.animate();

            window.addEventListener('resize', () => this.onResize());
        }

        setupLighting() {
            // Soft ambient
            const ambient = new THREE.AmbientLight(0xffffff, 0.6);
            this.scene.add(ambient);

            // Key light - warm white from top right
            const keyLight = new THREE.DirectionalLight(0xfff8f0, 1.8);
            keyLight.position.set(4, 6, 5);
            keyLight.castShadow = true;
            keyLight.shadow.mapSize.width = 2048;
            keyLight.shadow.mapSize.height = 2048;
            keyLight.shadow.camera.near = 0.5;
            keyLight.shadow.camera.far = 25;
            keyLight.shadow.bias = -0.0001;
            this.scene.add(keyLight);

            // Fill light - cooler from left
            const fillLight = new THREE.DirectionalLight(0xf0f5ff, 0.9);
            fillLight.position.set(-4, 3, 4);
            this.scene.add(fillLight);

            // Red rim light - brand accent
            const rimLight = new THREE.PointLight(0xff3b30, 3.5, 15);
            rimLight.position.set(-3, -1, -4);
            this.scene.add(rimLight);

            // Secondary red accent
            const rimLight2 = new THREE.PointLight(0xff3b30, 2.0, 12);
            rimLight2.position.set(3, 2, -3);
            this.scene.add(rimLight2);

            // Top highlight
            const topLight = new THREE.SpotLight(0xffffff, 1.5, 15, Math.PI / 5, 0.5);
            topLight.position.set(0, 8, 3);
            topLight.castShadow = true;
            this.scene.add(topLight);

            // Bottom fill for dimension
            const bottomFill = new THREE.PointLight(0xffffff, 0.5, 8);
            bottomFill.position.set(0, -4, 3);
            this.scene.add(bottomFill);

            // Front soft light
            const frontLight = new THREE.DirectionalLight(0xffffff, 0.4);
            frontLight.position.set(0, 0, 6);
            this.scene.add(frontLight);
        }

        createHoneycombTexture() {
            const canvas = document.createElement('canvas');
            canvas.width = 1024;
            canvas.height = 1024;
            const ctx = canvas.getContext('2d');

            // Base white
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 1024, 1024);

            // Honeycomb parameters
            const hexRadius = 28;
            const hexHeight = hexRadius * Math.sqrt(3);
            const hexWidth = hexRadius * 2;

            // Draw honeycomb pattern
            ctx.strokeStyle = 'rgba(220, 220, 225, 0.7)';
            ctx.lineWidth = 1.5;

            for (let row = -2; row < 40; row++) {
                for (let col = -2; col < 30; col++) {
                    const x = col * hexWidth * 0.75 + (row % 2) * hexWidth * 0.375;
                    const y = row * hexHeight * 0.5;
                    this.drawHexagon(ctx, x, y, hexRadius * 0.92);
                }
            }

            // Add subtle depth shading to hexagons
            ctx.fillStyle = 'rgba(240, 240, 245, 0.3)';
            for (let row = -2; row < 40; row++) {
                for (let col = -2; col < 30; col++) {
                    const x = col * hexWidth * 0.75 + (row % 2) * hexWidth * 0.375;
                    const y = row * hexHeight * 0.5;
                    this.fillHexagon(ctx, x, y, hexRadius * 0.85);
                }
            }

            const texture = new THREE.CanvasTexture(canvas);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(2, 2);
            texture.anisotropy = 16;
            return texture;
        }

        drawHexagon(ctx, x, y, radius) {
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i - Math.PI / 6;
                const hx = x + radius * Math.cos(angle);
                const hy = y + radius * Math.sin(angle);
                if (i === 0) {
                    ctx.moveTo(hx, hy);
                } else {
                    ctx.lineTo(hx, hy);
                }
            }
            ctx.closePath();
            ctx.stroke();
        }

        fillHexagon(ctx, x, y, radius) {
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i - Math.PI / 6;
                const hx = x + radius * Math.cos(angle);
                const hy = y + radius * Math.sin(angle);
                if (i === 0) {
                    ctx.moveTo(hx, hy);
                } else {
                    ctx.lineTo(hx, hy);
                }
            }
            ctx.closePath();
            ctx.fill();
        }

        createNormalMap() {
            const canvas = document.createElement('canvas');
            canvas.width = 1024;
            canvas.height = 1024;
            const ctx = canvas.getContext('2d');

            // Neutral normal map base (pointing up)
            ctx.fillStyle = 'rgb(128, 128, 255)';
            ctx.fillRect(0, 0, 1024, 1024);

            // Honeycomb depth effect
            const hexRadius = 28;
            const hexHeight = hexRadius * Math.sqrt(3);
            const hexWidth = hexRadius * 2;

            for (let row = -2; row < 40; row++) {
                for (let col = -2; col < 30; col++) {
                    const x = col * hexWidth * 0.75 + (row % 2) * hexWidth * 0.375;
                    const y = row * hexHeight * 0.5;

                    // Create depth illusion with gradient
                    const gradient = ctx.createRadialGradient(x, y, 0, x, y, hexRadius * 0.9);
                    gradient.addColorStop(0, 'rgb(128, 128, 240)'); // Center - slightly recessed
                    gradient.addColorStop(0.7, 'rgb(128, 128, 255)'); // Mid - neutral
                    gradient.addColorStop(1, 'rgb(140, 140, 255)'); // Edge - slight bevel

                    ctx.fillStyle = gradient;
                    this.fillHexagon(ctx, x, y, hexRadius * 0.9);
                }
            }

            const texture = new THREE.CanvasTexture(canvas);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(2, 2);
            texture.anisotropy = 16;
            return texture;
        }

        createFuseLogoTexture() {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const ctx = canvas.getContext('2d');

            // Transparent background
            ctx.clearRect(0, 0, 512, 512);

            // FUSE text - debossed style
            ctx.fillStyle = 'rgba(180, 180, 185, 0.9)';
            ctx.font = 'bold 120px "Bebas Neue", Impact, Arial Black, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Shadow for debossed effect
            ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            ctx.shadowBlur = 0;
            ctx.fillText('FUSE', 256, 240);

            // Inner shadow
            ctx.shadowColor = 'rgba(150, 150, 155, 0.5)';
            ctx.shadowOffsetX = -1;
            ctx.shadowOffsetY = -1;
            ctx.shadowBlur = 2;
            ctx.fillStyle = 'rgba(200, 200, 205, 0.4)';
            ctx.fillText('FUSE', 256, 240);

            // Red accent dot
            ctx.shadowColor = 'transparent';
            ctx.fillStyle = '#ff3b30';
            ctx.beginPath();
            ctx.arc(365, 195, 12, 0, Math.PI * 2);
            ctx.fill();

            const texture = new THREE.CanvasTexture(canvas);
            texture.anisotropy = 16;
            return texture;
        }

        createCapsule() {
            this.productGroup = new THREE.Group();
            this.scene.add(this.productGroup);

            // Create textures
            const honeycombTexture = this.createHoneycombTexture();
            const normalMap = this.createNormalMap();
            const logoTexture = this.createFuseLogoTexture();

            // Premium white matte material with honeycomb
            const capsuleMaterial = new THREE.MeshPhysicalMaterial({
                color: 0xffffff,
                map: honeycombTexture,
                normalMap: normalMap,
                normalScale: new THREE.Vector2(0.15, 0.15),
                roughness: 0.35,
                metalness: 0.02,
                clearcoat: 0.4,
                clearcoatRoughness: 0.25,
                reflectivity: 0.5,
                envMapIntensity: 0.6,
                sheen: 0.3,
                sheenRoughness: 0.4,
                sheenColor: new THREE.Color(0xffffff)
            });

            // Dodecahedron geometry (12-sided)
            const dodecahedronGeometry = new THREE.DodecahedronGeometry(1.3, 0);

            // Main capsule
            const capsule = new THREE.Mesh(dodecahedronGeometry, capsuleMaterial);
            capsule.castShadow = true;
            capsule.receiveShadow = true;
            this.productGroup.add(capsule);

            // Edge highlight material
            const edgeMaterial = new THREE.MeshPhysicalMaterial({
                color: 0xffffff,
                roughness: 0.2,
                metalness: 0.1,
                clearcoat: 0.8,
                clearcoatRoughness: 0.1,
                transparent: true,
                opacity: 0.9
            });

            // Create subtle edge glow using EdgesGeometry
            const edges = new THREE.EdgesGeometry(dodecahedronGeometry, 1);
            const edgeLines = new THREE.LineSegments(
                edges,
                new THREE.LineBasicMaterial({
                    color: 0xeeeeee,
                    linewidth: 1,
                    transparent: true,
                    opacity: 0.4
                })
            );
            edgeLines.scale.set(1.002, 1.002, 1.002);
            this.productGroup.add(edgeLines);

            // FUSE logo decal on front face
            const logoGeometry = new THREE.PlaneGeometry(1.2, 1.2);
            const logoMaterial = new THREE.MeshBasicMaterial({
                map: logoTexture,
                transparent: true,
                depthWrite: false,
                side: THREE.DoubleSide
            });
            const logoMesh = new THREE.Mesh(logoGeometry, logoMaterial);

            // Position on front face of dodecahedron
            logoMesh.position.set(0, 0, 1.08);
            logoMesh.scale.set(0.9, 0.9, 1);
            this.productGroup.add(logoMesh);

            // Red accent glow sphere (behind)
            const glowGeometry = new THREE.SphereGeometry(1.8, 32, 32);
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: 0xff3b30,
                transparent: true,
                opacity: 0.03,
                side: THREE.BackSide
            });
            const glowSphere = new THREE.Mesh(glowGeometry, glowMaterial);
            this.productGroup.add(glowSphere);

            // Subtle floating animation reference
            this.capsule = capsule;
            this.logoMesh = logoMesh;
            this.glowSphere = glowSphere;

            // Initial rotation to show the capsule elegantly
            this.productGroup.rotation.x = this.baseRotationX;
            this.productGroup.rotation.y = this.baseRotationY;
            this.productGroup.position.y = 0.1;
        }

        setupInteractions() {
            this.container.addEventListener('mouseenter', () => {
                this.isHovering = true;
            });

            this.container.addEventListener('mouseleave', () => {
                this.isHovering = false;
                this.targetRotation.x = 0;
                this.targetRotation.y = 0;
            });

            this.container.addEventListener('mousemove', (e) => {
                if (!this.isHovering) return;

                const rect = this.container.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

                this.targetRotation.y = x * this.maxRotationY;
                this.targetRotation.x = y * this.maxRotationX;
            });

            // Touch support
            let touchStartX = 0;
            let touchStartY = 0;

            this.container.addEventListener('touchstart', (e) => {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                this.isHovering = true;
            }, { passive: true });

            this.container.addEventListener('touchmove', (e) => {
                const deltaX = (e.touches[0].clientX - touchStartX) * 0.004;
                const deltaY = (e.touches[0].clientY - touchStartY) * 0.003;

                this.targetRotation.y = Math.max(-this.maxRotationY, Math.min(this.maxRotationY, deltaX));
                this.targetRotation.x = Math.max(-this.maxRotationX, Math.min(this.maxRotationX, -deltaY));
            }, { passive: true });

            this.container.addEventListener('touchend', () => {
                this.isHovering = false;
                this.targetRotation.x = 0;
                this.targetRotation.y = 0;
            }, { passive: true });
        }

        onResize() {
            const width = this.container.clientWidth || 340;
            const height = this.container.clientHeight || 450;
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        }

        animate() {
            requestAnimationFrame(() => this.animate());

            this.time += 0.01;

            // Smooth easing
            const easing = this.isHovering ? 0.08 : 0.04;

            this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * easing;
            this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * easing;

            // Apply rotation
            this.productGroup.rotation.x = this.baseRotationX + this.currentRotation.x;
            this.productGroup.rotation.y = this.baseRotationY + this.currentRotation.y;

            // Subtle floating animation
            this.productGroup.position.y = 0.1 + Math.sin(this.time * 0.8) * 0.03;

            // Subtle glow pulse
            if (this.glowSphere) {
                this.glowSphere.material.opacity = 0.03 + Math.sin(this.time * 1.2) * 0.015;
            }

            this.renderer.render(this.scene, this.camera);
        }
    }

    // Initialize
    function init() {
        if (!isWebGLAvailable()) {
            console.warn('WebGL not available');
            return;
        }

        loadThreeJS(() => {
            if (!window.THREE) return;

            const heroContainer = document.getElementById('hero3D');
            if (heroContainer) {
                new FuseProduct3D(heroContainer);
            }

            const productContainer = document.getElementById('product3D');
            if (productContainer) {
                new FuseProduct3D(productContainer);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
