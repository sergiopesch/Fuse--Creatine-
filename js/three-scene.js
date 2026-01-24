/**
 * FUSE 3D Product Interactive Scene
 * Powered by Three.js + GSAP
 */

class FuseProduct3D {
    constructor(container, options = {}) {
        this.container = container;
        this.options = Object.assign({
            autoRotate: true,
            interactive: true,
            scale: 1,
            rotationSpeed: 0.005,
            floatAmplitude: 0.1,
            floatSpeed: 0.001
        }, options);

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        
        this.init();
    }

    init() {
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);

        this.camera.position.z = 5;

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
        mainLight.position.set(5, 5, 5);
        this.scene.add(mainLight);

        const rimLight = new THREE.PointLight(0xff3b30, 2, 10);
        rimLight.position.set(-3, 2, -3);
        this.scene.add(rimLight);

        const accentLight = new THREE.SpotLight(0xffffff, 1);
        accentLight.position.set(0, 5, 2);
        this.scene.add(accentLight);

        this.createProduct();
        this.setupInteractions();
        this.animate();

        window.addEventListener('resize', () => this.onResize());
    }

    createProduct() {
        this.productGroup = new THREE.Group();
        this.scene.add(this.productGroup);

        // Materials
        const matteBlack = new THREE.MeshPhysicalMaterial({
            color: 0x0a0a0a,
            roughness: 0.7,
            metalness: 0.2,
            clearcoat: 0.1,
            clearcoatRoughness: 0.4
        });

        const metallicRed = new THREE.MeshStandardMaterial({
            color: 0xff3b30,
            roughness: 0.3,
            metalness: 0.8
        });

        // Tub Geometry (Cylinder with rounded edges approximated)
        const tubGeometry = new THREE.CylinderGeometry(1, 1, 2.8, 64);
        const tub = new THREE.Mesh(tubGeometry, matteBlack);
        this.productGroup.add(tub);

        // Top Red Lip
        const lipGeometry = new THREE.CylinderGeometry(1.02, 1.02, 0.1, 64);
        const lip = new THREE.Mesh(lipGeometry, metallicRed);
        lip.position.y = 1.35;
        this.productGroup.add(lip);

        // Lid
        const lidGeometry = new THREE.CylinderGeometry(1.01, 1.01, 0.2, 64);
        const lid = new THREE.Mesh(lidGeometry, matteBlack);
        lid.position.y = 1.45;
        this.productGroup.add(lid);

        // Label Texture (Simplified Logo in 3D)
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, 1024, 1024);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 240px Bebas Neue, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('FUSE', 512, 450);
        
        ctx.fillStyle = '#ff3b30';
        ctx.font = '800 400px Bebas Neue, sans-serif';
        ctx.fillText('.', 740, 450);

        ctx.fillStyle = '#86868b';
        ctx.font = '700 40px Inter, sans-serif';
        ctx.letterSpacing = '10px';
        ctx.fillText('PERFORMANCE FUSION', 512, 650);

        const texture = new THREE.CanvasTexture(canvas);
        const labelMaterial = new THREE.MeshBasicMaterial({ 
            map: texture,
            transparent: true,
            side: THREE.FrontSide
        });

        const labelGeometry = new THREE.CylinderGeometry(1.005, 1.005, 2, 64, 1, true);
        const label = new THREE.Mesh(labelGeometry, labelMaterial);
        this.productGroup.add(label);

        this.productGroup.scale.set(this.options.scale, this.options.scale, this.options.scale);
    }

    setupInteractions() {
        this.mouse = new THREE.Vector2();
        this.targetRotation = new THREE.Vector2();
        this.currentRotation = new THREE.Vector2();

        if (this.options.interactive) {
            this.container.addEventListener('mousemove', (e) => {
                const rect = this.container.getBoundingClientRect();
                this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                
                this.targetRotation.y = this.mouse.x * 0.5;
                this.targetRotation.x = -this.mouse.y * 0.3;
            });

            this.container.addEventListener('touchstart', (e) => {
                this.touchStartX = e.touches[0].clientX;
            }, { passive: true });

            this.container.addEventListener('touchmove', (e) => {
                const deltaX = e.touches[0].clientX - this.touchStartX;
                this.targetRotation.y += deltaX * 0.001;
                this.touchStartX = e.touches[0].clientX;
            }, { passive: true });
        }
    }

    onResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const time = performance.now();

        // Floating animation
        this.productGroup.position.y = Math.sin(time * this.options.floatSpeed) * this.options.floatAmplitude;

        // Rotation logic
        if (this.options.autoRotate) {
            this.productGroup.rotation.y += this.options.rotationSpeed;
        }

        // Interaction smoothing
        this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * 0.1;
        this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * 0.1;

        this.productGroup.rotation.x = this.currentRotation.x;
        this.productGroup.rotation.y += this.currentRotation.y * 0.1;

        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const containers = document.querySelectorAll('.product-3d-container');
    
    containers.forEach(container => {
        const type = container.getAttribute('data-3d-product');
        let options = {};
        
        if (type === 'hero') {
            options = { scale: 1.2, rotationSpeed: 0.003 };
        } else if (type === 'science') {
            options = { scale: 0.8, autoRotate: true };
        } else if (type === 'showcase') {
            options = { scale: 1.5, floatAmplitude: 0.2 };
        }

        new FuseProduct3D(container, options);
    });
});
