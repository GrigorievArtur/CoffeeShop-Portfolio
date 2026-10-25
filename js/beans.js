/* =========================================
   BEANS — Three.js floating coffee beans
   Exposes: window.GoodDays.beans
   ========================================= */

window.GoodDays = window.GoodDays || {};

window.GoodDays.beans = (function () {
    'use strict';

    let camera = null;
    let renderer = null;
    let clock = null;
    const beans = [];

    function createBeanGeometry() {
        const geometry = new THREE.SphereGeometry(1, 32, 32);
        const pos = geometry.attributes.position;
        const vertex = new THREE.Vector3();

        for (let i = 0; i < pos.count; i++) {
            vertex.fromBufferAttribute(pos, i);
            vertex.z *= 0.6;

            // Crease down the middle of the bean
            if (Math.abs(vertex.x) < 0.3) {
                const factor = 1 - (Math.abs(vertex.x) / 0.3);
                vertex.z -= 0.3 * factor;
            }

            pos.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }

        geometry.computeVertexNormals();
        return geometry;
    }

    function animate() {
        requestAnimationFrame(animate);

        const time = clock.getElapsedTime();
        beans.forEach((bean) => {
            bean.rotation.x += bean.userData.rotX;
            bean.rotation.y += bean.userData.rotY;
            bean.rotation.z += bean.userData.rotZ;
            bean.position.y += Math.sin(
                time * bean.userData.floatSpeed + bean.userData.floatOffset
            ) * 0.005;
        });

        renderer.render(scene, camera);
    }

    let scene = null;

    function init(selector) {
        const container = document.querySelector(selector || '#canvas-container');
        if (!container) return;

        if (typeof THREE === 'undefined') {
            console.warn('Three.js failed to load — bean background disabled.');
            return;
        }

        scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x2A1A0E, 0.03);

        camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            100
        );
        camera.position.z = 15;

        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        // Lighting
        scene.add(new THREE.AmbientLight(0xffffff, 0.3));

        const dirLight = new THREE.DirectionalLight(0xFEF3E2, 0.8);
        dirLight.position.set(5, 10, 7);
        scene.add(dirLight);

        const accentLight = new THREE.PointLight(0xD4621A, 1.5, 50);
        accentLight.position.set(10, -10, 5);
        scene.add(accentLight);

        // Beans
        const beanGeometry = createBeanGeometry();
        const beanMaterial = new THREE.MeshStandardMaterial({
            color: 0x2A1A0E,
            roughness: 0.6,
            metalness: 0.1,
        });

        for (let i = 0; i < 35; i++) {
            const bean = new THREE.Mesh(beanGeometry, beanMaterial);
            const scale = Math.random() * 0.8 + 0.3;
            bean.scale.set(scale, scale, scale);

            bean.position.set(
                (Math.random() - 0.5) * 35,
                (Math.random() - 0.5) * 25,
                (Math.random() - 0.5) * 15 - 5
            );

            bean.userData = {
                rotX: (Math.random() - 0.5) * 0.015,
                rotY: (Math.random() - 0.5) * 0.015,
                rotZ: (Math.random() - 0.5) * 0.015,
                floatSpeed: Math.random() * 0.5 + 0.2,
                floatOffset: Math.random() * Math.PI * 2,
            };

            scene.add(bean);
            beans.push(bean);
        }

        clock = new THREE.Clock();
        animate();
    }

    function onResize() {
        if (!camera || !renderer) return;

        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    return { init, onResize };
})();
