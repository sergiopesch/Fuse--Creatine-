/**
 * FUSE Premium 3D Product
 * Highest quality fitness supplement packaging visualization
 * Static display with hover-only interaction
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
            this.baseRotationY = Math.PI; // Front-facing
            this.isHovering = false;

            // Interaction limits (radians)
            this.maxRotationX = 0.15;  // ~8.5 degrees up/down
            this.maxRotationY = 0.4;   // ~23 degrees left/right

            this.init();
        }

        init() {
            const width = this.container.clientWidth || 340;
            const height = this.container.clientHeight || 450;

            // Scene
            this.scene = new THREE.Scene();

            // Camera - optimal viewing distance
            this.camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 1000);
            this.camera.position.set(0, 0.3, 7.5);
            this.camera.lookAt(0, 0, 0);

            // High-quality renderer
            this.renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true,
                powerPreference: 'high-performance',
                precision: 'highp'
            });
            this.renderer.setSize(width, height);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3)); // Higher quality
            this.renderer.setClearColor(0x000000, 0);
            
            // Premium color management
            if (THREE.SRGBColorSpace) {
                this.renderer.outputColorSpace = THREE.SRGBColorSpace;
            }
            if (THREE.ACESFilmicToneMapping) {
                this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
                this.renderer.toneMappingExposure = 1.15;
            }
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

            this.container.appendChild(this.renderer.domElement);

            this.setupLighting();
            this.createProduct();
            this.setupInteractions();
            this.animate();

            window.addEventListener('resize', () => this.onResize());
        }

        setupLighting() {
            // Soft ambient fill
            const ambient = new THREE.AmbientLight(0xffffff, 0.5);
            this.scene.add(ambient);

            // Key light (main)
            const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
            keyLight.position.set(3, 5, 4);
            keyLight.castShadow = true;
            keyLight.shadow.mapSize.width = 2048;
            keyLight.shadow.mapSize.height = 2048;
            keyLight.shadow.camera.near = 0.5;
            keyLight.shadow.camera.far = 20;
            keyLight.shadow.bias = -0.0001;
            this.scene.add(keyLight);

            // Fill light (softer, opposite side)
            const fillLight = new THREE.DirectionalLight(0xffffff, 0.7);
            fillLight.position.set(-3, 2, 3);
            this.scene.add(fillLight);

            // Rim light (red accent for brand)
            const rimLight = new THREE.PointLight(0xff3b30, 2.5, 12);
            rimLight.position.set(-2.5, 0, -3);
            this.scene.add(rimLight);

            // Top spotlight for lid highlight
            const topSpot = new THREE.SpotLight(0xffffff, 1.2, 12, Math.PI / 6, 0.4);
            topSpot.position.set(0, 6, 2);
            topSpot.castShadow = true;
            this.scene.add(topSpot);

            // Subtle bottom fill
            const bottomFill = new THREE.PointLight(0xffffff, 0.4, 6);
            bottomFill.position.set(0, -2, 3);
            this.scene.add(bottomFill);
        }

        createProduct() {
            this.productGroup = new THREE.Group();
            this.scene.add(this.productGroup);

            const segments = 256; // Ultra-high quality geometry

            // ===== PREMIUM MATERIALS =====
            
            // Matte black body with subtle sheen
            const bodyMaterial = new THREE.MeshPhysicalMaterial({
                color: 0x080808,
                roughness: 0.32,
                metalness: 0.15,
                clearcoat: 0.9,
                clearcoatRoughness: 0.2,
                reflectivity: 0.5,
                envMapIntensity: 0.8
            });

            // Premium metallic red
            const redMaterial = new THREE.MeshPhysicalMaterial({
                color: 0xff3b30,
                roughness: 0.18,
                metalness: 0.95,
                clearcoat: 1.0,
                clearcoatRoughness: 0.08,
                reflectivity: 1.0,
                envMapIntensity: 1.2
            });

            // Premium lid with subtle texture
            const lidMaterial = new THREE.MeshPhysicalMaterial({
                color: 0x0a0a0a,
                roughness: 0.22,
                metalness: 0.35,
                clearcoat: 0.95,
                clearcoatRoughness: 0.12,
                reflectivity: 0.7,
                envMapIntensity: 0.9
            });

            // ===== MAIN BODY =====
            const bodyRadius = 1.0;
            const bodyHeight = 2.6;

            const bodyGeometry = new THREE.CylinderGeometry(
                bodyRadius, bodyRadius * 0.98, bodyHeight, segments, 1, false
            );
            const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
            body.castShadow = true;
            body.receiveShadow = true;
            this.productGroup.add(body);

            // Bottom cap
            const bottomCap = new THREE.Mesh(
                new THREE.CircleGeometry(bodyRadius * 0.98, segments),
                bodyMaterial
            );
            bottomCap.rotation.x = Math.PI / 2;
            bottomCap.position.y = -bodyHeight / 2;
            this.productGroup.add(bottomCap);

            // ===== RED ACCENT BAND =====
            const bandGeometry = new THREE.CylinderGeometry(
                bodyRadius + 0.008, bodyRadius + 0.008, 0.14, segments
            );
            const band = new THREE.Mesh(bandGeometry, redMaterial);
            band.position.y = bodyHeight / 2 - 0.18;
            band.castShadow = true;
            this.productGroup.add(band);

            // Red lip ring
            const lipGeometry = new THREE.TorusGeometry(bodyRadius + 0.015, 0.045, 48, segments);
            const lip = new THREE.Mesh(lipGeometry, redMaterial);
            lip.rotation.x = Math.PI / 2;
            lip.position.y = bodyHeight / 2 - 0.08;
            lip.castShadow = true;
            this.productGroup.add(lip);

            // ===== LID =====
            const lidRadius = bodyRadius + 0.025;
            const lidHeight = 0.38;
            
            const lidGeometry = new THREE.CylinderGeometry(
                lidRadius, lidRadius, lidHeight, segments
            );
            const lid = new THREE.Mesh(lidGeometry, lidMaterial);
            lid.position.y = bodyHeight / 2 + lidHeight / 2 - 0.03;
            lid.castShadow = true;
            this.productGroup.add(lid);

            // Lid top
            const lidTop = new THREE.Mesh(
                new THREE.CircleGeometry(lidRadius, segments),
                lidMaterial
            );
            lidTop.rotation.x = -Math.PI / 2;
            lidTop.position.y = bodyHeight / 2 + lidHeight - 0.03;
            this.productGroup.add(lidTop);

            // Lid grip ridges (premium detail)
            for (let i = 0; i < 64; i++) {
                const angle = (i / 64) * Math.PI * 2;
                const ridge = new THREE.Mesh(
                    new THREE.BoxGeometry(0.006, lidHeight * 0.65, 0.025),
                    lidMaterial
                );
                ridge.position.x = Math.cos(angle) * (lidRadius + 0.012);
                ridge.position.z = Math.sin(angle) * (lidRadius + 0.012);
                ridge.position.y = bodyHeight / 2 + lidHeight / 2 - 0.03;
                ridge.rotation.y = -angle;
                this.productGroup.add(ridge);
            }

            // ===== HIGH-RES LABEL =====
            this.createLabel(bodyRadius, bodyHeight, segments);

            // ===== FINAL POSITIONING =====
            this.productGroup.scale.set(0.85, 0.85, 0.85);
            this.productGroup.position.y = -0.1;
            this.productGroup.rotation.y = this.baseRotationY;
        }

        createLabel(radius, height, segments) {
            const canvas = document.createElement('canvas');
            canvas.width = 2048;
            canvas.height = 2048;
            const ctx = canvas.getContext('2d');

            // Premium black background
            ctx.fillStyle = '#080808';
            ctx.fillRect(0, 0, 2048, 2048);

            // Subtle gradient overlay
            const gradient = ctx.createLinearGradient(0, 0, 0, 2048);
            gradient.addColorStop(0, 'rgba(255,255,255,0.025)');
            gradient.addColorStop(0.5, 'rgba(0,0,0,0)');
            gradient.addColorStop(1, 'rgba(255,255,255,0.015)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 2048, 2048);

            // Top red accent line
            ctx.fillStyle = '#ff3b30';
            ctx.fillRect(0, 180, 2048, 5);

            // FUSE Logo
            ctx.fillStyle = '#ffffff';
            ctx.font = '900 400px "Bebas Neue", Impact, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('FUSE', 1024, 520);

            // Red dot accent
            ctx.fillStyle = '#ff3b30';
            ctx.beginPath();
            ctx.arc(1360, 420, 45, 0, Math.PI * 2);
            ctx.fill();

            // Tagline
            ctx.fillStyle = '#86868b';
            ctx.font = '700 52px "Inter", "Helvetica Neue", sans-serif';
            ctx.fillText('PERFORMANCE FUSION', 1024, 720);

            // Elegant divider
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(624, 820);
            ctx.lineTo(1424, 820);
            ctx.stroke();

            // Product type
            ctx.fillStyle = '#ffffff';
            ctx.font = '600 46px "Inter", "Helvetica Neue", sans-serif';
            ctx.fillText('CREATINE MONOHYDRATE', 1024, 920);

            // Dose - prominent
            ctx.fillStyle = '#ff3b30';
            ctx.font = '800 68px "Inter", "Helvetica Neue", sans-serif';
            ctx.fillText('5000MG', 1024, 1040);

            // Per serving
            ctx.fillStyle = '#86868b';
            ctx.font = '500 34px "Inter", "Helvetica Neue", sans-serif';
            ctx.fillText('PER SERVING', 1024, 1110);

            // UK Badge
            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.beginPath();
            ctx.roundRect(824, 1220, 400, 75, 38);
            ctx.fill();
            
            ctx.fillStyle = '#ffffff';
            ctx.font = '700 30px "Inter", "Helvetica Neue", sans-serif';
            ctx.fillText('🇬🇧 ENGINEERED IN BRITAIN', 1024, 1262);

            // Bottom specs
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.font = '500 30px "Inter", "Helvetica Neue", sans-serif';
            ctx.fillText('60 SERVINGS  •  300G NET WT.', 1024, 1400);

            // Formula code
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.font = '600 26px "Inter", monospace';
            ctx.fillText('FORMULA MT-01', 1024, 1470);

            // Bottom red accent
            ctx.fillStyle = '#ff3b30';
            ctx.fillRect(0, 1780, 2048, 5);

            // High-quality texture
            const texture = new THREE.CanvasTexture(canvas);
            texture.anisotropy = 16;
            texture.generateMipmaps = true;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;

            const labelMaterial = new THREE.MeshStandardMaterial({
                map: texture,
                transparent: true,
                roughness: 0.45,
                metalness: 0.02,
                side: THREE.FrontSide
            });

            const labelGeometry = new THREE.CylinderGeometry(
                radius + 0.004, radius + 0.004, height * 0.82, segments, 1, true
            );
            const label = new THREE.Mesh(labelGeometry, labelMaterial);
            label.position.y = -0.12;
            this.productGroup.add(label);
        }

        setupInteractions() {
            // Mouse interaction - limited range of motion
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

                // Limited rotation range
                this.targetRotation.y = x * this.maxRotationY;
                this.targetRotation.x = y * this.maxRotationX;
            });

            // Touch interaction
            let touchStartX = 0;
            let touchStartY = 0;

            this.container.addEventListener('touchstart', (e) => {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                this.isHovering = true;
            }, { passive: true });

            this.container.addEventListener('touchmove', (e) => {
                const deltaX = (e.touches[0].clientX - touchStartX) * 0.003;
                const deltaY = (e.touches[0].clientY - touchStartY) * 0.002;

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

            // Smooth easing for interactions
            const easing = this.isHovering ? 0.08 : 0.05;
            
            this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * easing;
            this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * easing;

            // Apply rotation - base rotation + interaction offset
            this.productGroup.rotation.x = this.currentRotation.x;
            this.productGroup.rotation.y = this.baseRotationY + this.currentRotation.y;

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
