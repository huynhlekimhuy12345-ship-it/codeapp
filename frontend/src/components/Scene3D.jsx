import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Scene3D — Nền 3D toàn màn hình, CHỈ vẽ nền, KHÔNG vẽ chữ.
 * Mọi chữ/panel/nút đều là HTML/CSS phủ bên trên (z-index).
 * variant="hero": đầy đủ chi tiết cho trang bán hàng.
 * variant="subtle": tối giản cho trang quản trị (nhẹ, không gây xao nhãng).
 */
export default function Scene3D({ variant = 'hero' }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Kiểm tra WebGL — không có thì thôi, CSS gradient phía sau sẽ lo phần nền.
    let renderer;
    try {
      const test = document.createElement('canvas');
      const gl = test.getContext('webgl2') || test.getContext('webgl');
      if (!gl) return;
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return;
    }

    const isMobile = window.innerWidth < 768;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const subtle = variant === 'subtle';

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x17100a, 0.03);

    const camera = new THREE.PerspectiveCamera(
      55, window.innerWidth / window.innerHeight, 0.1, 100
    );
    camera.position.set(0, 0.6, 9);

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
    mount.appendChild(renderer.domElement);

    // --- Ánh sáng ấm của xưởng da ---
    scene.add(new THREE.AmbientLight(0x6b4a2e, 1.1));
    const key = new THREE.PointLight(0xe8a54b, 900, 60);
    key.position.set(5, 6, 7);
    scene.add(key);
    const rim = new THREE.PointLight(0x8a4a2a, 500, 50);
    rim.position.set(-6, -3, 5);
    scene.add(rim);
    const top = new THREE.DirectionalLight(0xf2c57c, 0.7);
    top.position.set(0, 8, 2);
    scene.add(top);

    // --- Các tấm da lơ lửng ---
    const panelGroup = new THREE.Group();
    const palette = [0x6b4226, 0x8a5a33, 0x4a2f1c, 0xa06a3a, 0x5a3d24, 0x7a4a2c];
    const panelCount = subtle ? 0 : isMobile ? 8 : 16;
    const panels = [];
    for (let i = 0; i < panelCount; i++) {
      const w = 1 + Math.random() * 2.4;
      const h = 1.4 + Math.random() * 2.8;
      const geo = new THREE.PlaneGeometry(w, h);
      // Viền da: dùng 2 mặt phẳng chồng nhau tạo cảm giác dày dặn
      const mat = new THREE.MeshStandardMaterial({
        color: palette[i % palette.length],
        roughness: 0.85,
        metalness: 0.08,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(
        (Math.random() - 0.5) * 17,
        (Math.random() - 0.5) * 9,
        -2 - Math.random() * 8
      );
      m.rotation.set(
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 1.0,
        (Math.random() - 0.5) * 0.4
      );
      m.userData = {
        rs: (Math.random() - 0.5) * 0.0016,
        fs: 0.25 + Math.random() * 0.5,
        ph: Math.random() * Math.PI * 2,
        y0: m.position.y,
      };
      panelGroup.add(m);
      panels.push(m);
    }
    scene.add(panelGroup);

    // --- Hạt bụi vàng bay ---
    const pCount = subtle ? 70 : isMobile ? 160 : 420;
    const pos = new Float32Array(pCount * 3);
    const spd = new Float32Array(pCount);
    for (let i = 0; i < pCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 22;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 12;
      pos[i * 3 + 2] = -1 - Math.random() * 10;
      spd[i] = 0.0012 + Math.random() * 0.004;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0xe8b96a,
      size: 0.055,
      transparent: true,
      opacity: subtle ? 0.35 : 0.7,
      sizeAttenuation: true,
      depthWrite: false,
    });
    const dust = new THREE.Points(pGeo, pMat);
    scene.add(dust);

    // --- Parallax theo chuột ---
    let mx = 0;
    let my = 0;
    const onMouse = (e) => {
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
    };
    if (!subtle && !reduceMotion) window.addEventListener('mousemove', onMouse);

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    let raf = 0;
    let running = true;
    const clock = new THREE.Clock();

    const animate = () => {
      if (!running) return;
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      for (const m of panels) {
        m.rotation.z += m.userData.rs;
        m.position.y = m.userData.y0 + Math.sin(t * m.userData.fs + m.userData.ph) * 0.35;
      }

      const arr = pGeo.attributes.position.array;
      for (let i = 0; i < pCount; i++) {
        arr[i * 3 + 1] += spd[i];
        if (arr[i * 3 + 1] > 6) arr[i * 3 + 1] = -6;
      }
      pGeo.attributes.position.needsUpdate = true;

      camera.position.x += (mx * 1.4 - camera.position.x) * 0.03;
      camera.position.y += (0.6 - my * 0.9 - camera.position.y) * 0.03;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    const onVis = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!reduceMotion) {
        running = true;
        clock.getDelta();
        animate();
      }
    };
    document.addEventListener('visibilitychange', onVis);

    if (reduceMotion) {
      renderer.render(scene, camera); // một khung hình tĩnh
    } else {
      animate();
    }

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('resize', onResize);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((mm) => mm.dispose());
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [variant]);

  return <div ref={mountRef} className="scene3d" aria-hidden="true" />;
}
