import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtVND } from '../api';
import './Collection.css';

/**
 * Collection — Trang "Bộ sưu tập" với trải nghiệm 3D điều khiển bằng cuộn trang.
 *
 * Kiến trúc: canvas Three.js CHỈ vẽ nền 3D (không có chữ trong WebGL),
 * mọi chữ/nút/thẻ thông tin đều là HTML/CSS phủ bên trên.
 *
 * Timeline cuộn (GSAP ScrollTrigger, scrub có damping):
 *  - Phase 1: túi da đóng kín ở trung tâm + hero copy HTML.
 *  - Phase 2: pin scene, nắp túi xoay mở, camera dolly vào, sản phẩm bay lên.
 *  - Phase 3: túi lùi/mờ về hậu cảnh, từng sản phẩm lướt qua trung tâm
 *    kèm thẻ HTML hiển thị DỮ LIỆU THẬT từ API (tên, danh mục, giá).
 *
 *
 * ★ MODEL 3D THẬT (.glb) ĐÃ ĐƯỢC GẮN (thư mục public/models/):
 *   - Túi hero: bag.glb — briefcase da của reyshapes (CC0), CÓ SẴN animation
 *     "open"/"closed" → ScrollTrigger scrub trực tiếp qua AnimationMixer.
 *   - watch.glb — "Wrist Watch" của Poly by Google (CC BY 3.0).
 *   - wallet.glb — "A Wallet" của senior design (CC BY).
 *   - key.glb — "Key" của Quaternius (CC0).
 *   Tất cả qua Poly Pizza. Mỗi model đều có fallback: tải lỗi → tự động dùng
 *   hình khối procedural tương ứng, scene không bao giờ trống.
 *   Muốn đổi model khác: chỉ cần thay file .glb trong public/models/ giữ
 *   nguyên tên, hoặc sửa MODEL_BY_INDEX / khối "MODEL THẬT — túi hero".
 */

/* Sản phẩm dự phòng khi API không truy cập được lúc chạy */
const FALLBACK_PRODUCTS = [
  { id: 'fb1', name: 'Ví da bò Bifold', category_name: 'Ví da', price: 890000, fallback: true },
  { id: 'fb2', name: 'Dây đồng hồ da', category_name: 'Phụ kiện da', price: 349000, fallback: true },
  { id: 'fb3', name: 'Bao da chìa khóa', category_name: 'Phụ kiện da', price: 149000, fallback: true },
  { id: 'fb4', name: 'Bao hộ chiếu da', category_name: 'Phụ kiện da', price: 499000, fallback: true },
];

/* Thứ tự hình khối sản phẩm 3D (theo index sản phẩm):
   0 ví da, 1 dây đồng hồ, 2 bao da chìa khóa, 3 bao hộ chiếu,
   4 đựng thẻ, 5 thắt lưng.
   Các hàm dựng chi tiết (buildWallet, buildWatchStrap, ...) nằm trong
   effect dựng scene vì cần THREE — xem khối "HÌNH KHỐI SẢN PHẨM CHI TIẾT". */

const PHASE_LABELS = ['Mở đầu', 'Khám phá', 'Bộ sưu tập'];

export default function Collection() {
  const [products, setProducts] = useState(null); // null = đang tải API
  const [ready, setReady] = useState(false);     // scene 3D đã dựng xong

  // Chế độ hiển thị quyết định ngay từ đầu (trước khi dựng scene)
  const [webglOK] = useState(() => {
    try {
      const t = document.createElement('canvas');
      return !!(t.getContext('webgl2') || t.getContext('webgl'));
    } catch {
      return false;
    }
  });
  const [reduceMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const staticMode = !webglOK || reduceMotion;

  const stageRef = useRef(null);   // section được pin khi cuộn
  const canvasHostRef = useRef(null);
  const heroRef = useRef(null);
  const hintRef = useRef(null);
  const cardsRef = useRef([]);
  const dotsRef = useRef([]);

  /* 1. Tải DỮ LIỆU THẬT từ API backend */
  useEffect(() => {
    let alive = true;
    api
      .getProducts({ limit: 6 })
      .then((d) => {
        if (!alive) return;
        const list = (d.products || []).slice(0, 6);
        setProducts(list.length >= 3 ? list : FALLBACK_PRODUCTS);
      })
      .catch(() => {
        if (alive) setProducts(FALLBACK_PRODUCTS);
      });
    return () => {
      alive = false;
    };
  }, []);

  /* 2. Dựng scene 3D + timeline cuộn (three & gsap được lazy-load riêng) */
  useEffect(() => {
    if (!products || staticMode) return;
    const state = { disposed: false };
    let cleanup = null;

    (async () => {
      // Lazy-load: tách three + gsap thành chunk riêng, không chặn lần vẽ đầu
      const [THREE, gsapMod, stMod, rbgMod, gltfMod] = await Promise.all([
        import('three'),
        import('gsap'),
        import('gsap/ScrollTrigger'),
        import('three/examples/jsm/geometries/RoundedBoxGeometry.js'),
        import('three/examples/jsm/loaders/GLTFLoader.js'),
      ]);
      if (state.disposed) return;
      const gsap = gsapMod.gsap;
      const ScrollTrigger = stMod.ScrollTrigger;
      gsap.registerPlugin(ScrollTrigger);
      const RoundedBoxGeometry = rbgMod.RoundedBoxGeometry;
      const gltfLoader = new gltfMod.GLTFLoader();

      /* Chuẩn hoá model .glb: căn giữa + co về kích thước mục tiêu để giữ
         framing của camera. Trả về Group bọc ngoài để timeline cuộn thao
         tác như mesh thường. */
      const normalizeModel = (srcScene, targetSize) => {
        const wrap = new THREE.Group();
        const box = new THREE.Box3().setFromObject(srcScene);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        srcScene.scale.setScalar(targetSize / maxDim);
        const box2 = new THREE.Box3().setFromObject(srcScene);
        const center = box2.getCenter(new THREE.Vector3());
        srcScene.position.sub(center); // đưa tâm model về gốc
        srcScene.traverse((o) => {
          if (o.isMesh) o.castShadow = true;
        });
        wrap.add(srcScene);
        return wrap;
      };

      /* Tô lại màu da cho model .glb có màu gốc không hợp tông shop
         (ví dụ ví xanh lá, đồng hồ đen tuyền). Giữ nguyên hình khối thật,
         chỉ thay vật liệu → vẫn chân thực mà hợp palette da bò/cognac. */
      const tintModel = (wrap, tint) => {
        let i = 0;
        wrap.traverse((o) => {
          if (!o.isMesh) return;
          if (tint.mode === 'palette') {
            const tone = tint.tones[i++ % tint.tones.length];
            o.material = new THREE.MeshStandardMaterial({
              color: tone,
              roughness: 0.62,
              metalness: 0.08,
            });
          } else {
            o.material = new THREE.MeshStandardMaterial({
              color: tint.color,
              roughness: tint.roughness ?? 0.6,
              metalness: tint.metalness ?? 0.1,
            });
          }
        });
      };

      const N = products.length;
      const host = canvasHostRef.current;
      if (!host) return;
      const isMobile = window.innerWidth < 768;

      /* ---------- Renderer / Scene / Camera ---------- */
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
      renderer.setSize(host.clientWidth, host.clientHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x140d07); // nền tối espresso, che nền chung
      scene.fog = new THREE.FogExp2(0x140d07, 0.026);

      const camera = new THREE.PerspectiveCamera(
        50,
        host.clientWidth / host.clientHeight,
        0.1,
        100
      );
      camera.position.set(0, 0.9, 10);

      /* ---------- Ánh sáng studio ấm ---------- */
      scene.add(new THREE.AmbientLight(0x6b4a2e, 1.25));
      const key = new THREE.PointLight(0xe8a54b, 900, 60);
      key.position.set(5, 6, 7);
      scene.add(key);
      const rim = new THREE.PointLight(0xc96a35, 650, 55);
      rim.position.set(-6, 2.5, -4);
      scene.add(rim);
      const top = new THREE.DirectionalLight(0xf2c57c, 0.9);
      top.position.set(0, 8, 3);
      top.castShadow = true;
      top.shadow.camera.left = -7;
      top.shadow.camera.right = 7;
      top.shadow.camera.top = 7;
      top.shadow.camera.bottom = -7;
      scene.add(top);

      /* Sàn hứng bóng đổ */
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 40),
        new THREE.ShadowMaterial({ opacity: 0.35 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -2.4;
      ground.receiveShadow = true;
      scene.add(ground);

      const leather = (color, rough = 0.72) =>
        new THREE.MeshStandardMaterial({
          color,
          roughness: rough,
          metalness: 0.06,
          transparent: true, // để phase 3 làm mờ túi
        });

      /* ============================================================
       * THAY MODEL THẬT (.glb): thay toàn bộ khối buildBag() dưới đây bằng:
       *   const gltf = await new GLTFLoader().loadAsync('/models/bag.glb');
       *   const bag = gltf.data.scene;
       * Giữ nguyên flapPivot: trỏ tới node nắp túi trong model
       * (ví dụ: bag.getObjectByName('Flap')), rồi animate flapPivot.rotation.x
       * như timeline bên dưới. Hoặc dùng AnimationMixer nếu model có sẵn clip.
       * ============================================================ */
      const bag = new THREE.Group();
      const bagMats = [];
      const bodyMat = leather(0x6b4226);
      bagMats.push(bodyMat);
      const body = new THREE.Mesh(
        new RoundedBoxGeometry(3.4, 2.3, 1.7, 4, 0.16),
        bodyMat
      );
      body.castShadow = true;
      bag.add(body);

      const trimMat = leather(0x4a2f1c);
      bagMats.push(trimMat);
      const trim = new THREE.Mesh(
        new RoundedBoxGeometry(3.46, 0.34, 1.76, 2, 0.1),
        trimMat
      );
      trim.position.y = -1.02;
      bag.add(trim);

      // Nắp túi: pivot đặt ở mép trên-sau để xoay mở ra sau
      const flapPivot = new THREE.Group();
      flapPivot.position.set(0, 1.15, -0.85);
      const flapMat = leather(0x7a4a2c);
      bagMats.push(flapMat);
      const flap = new THREE.Mesh(
        new RoundedBoxGeometry(3.3, 1.5, 0.16, 3, 0.07),
        flapMat
      );
      flap.position.set(0, -0.72, 0.85); // lúc đóng: phủ mặt trước túi
      flap.castShadow = true;
      flapPivot.add(flap);

      // Khóa vàng trên nắp
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xd8a94e,
        metalness: 0.85,
        roughness: 0.3,
        transparent: true,
      });
      bagMats.push(goldMat);
      const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.1), goldMat);
      clasp.position.set(0, -1.18, 0.95);
      flapPivot.add(clasp);

      // Quai xách
      const handleMat = leather(0x4a2f1c);
      bagMats.push(handleMat);
      const handle = new THREE.Mesh(
        new THREE.TorusGeometry(0.55, 0.1, 12, 28, Math.PI),
        handleMat
      );
      handle.position.set(0, 1.15, 0);
      handle.castShadow = true;
      bag.add(handle);
      bag.add(flapPivot);
      scene.add(bag);

      /* ============================================================
       * ★ MODEL THẬT — túi hero: thử thay túi procedural ở trên bằng
       *   model briefcase da thật (public/models/bag.glb) có sẵn sẵn
       *   animation "open"/"closed". Tải lỗi → giữ nguyên túi procedural.
       *   Muốn dùng model khác: thay file bag.glb, giữ nguyên tên.
       * ============================================================ */
      let bagMixer = null;
      let openAction = null;
      let openClip = null;
      const openProxy = { p: 0 }; // tiến trình mở nắp, timeline cuộn điều khiển
      try {
        const bagGltf = await gltfLoader.loadAsync('/models/bag.glb');
        // Dọn các mesh procedural, GIỮ LẠI Group cha `bag` và mảng `bagMats`
        // để timeline cuộn (lùi/mờ túi phase 3) hoạt động không đổi
        for (const child of [...bag.children]) {
          bag.remove(child);
          child.traverse((o) => {
            if (o.geometry) o.geometry.dispose();
          });
        }
        bagMats.length = 0;
        const bagModel = normalizeModel(bagGltf.scene, 3.4);
        bagModel.traverse((o) => {
          if (o.isMesh) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach((m) => {
              m.transparent = true; // để phase 3 làm mờ túi như cũ
              if (!bagMats.includes(m)) bagMats.push(m);
            });
          }
        });
        bag.add(bagModel);
        // Gắn animation mở nắp có sẵn trong model
        const clips = bagGltf.animations || [];
        if (clips.length) {
          bagMixer = new THREE.AnimationMixer(bagModel);
          openClip =
            clips.find((a) => /open/i.test(a.name)) || clips[0];
          openAction = bagMixer.clipAction(openClip);
          openAction.play();
          openAction.paused = true; // timeline cuộn sẽ scrub action.time thủ công
          openAction.time = 0;
          bagMixer.update(0);
        }
      } catch {
        // Tải model thất bại → giữ nguyên túi procedural đã dựng ở trên
      }

      /* ============================================================
       * HÌNH KHỐI SẢN PHẨM CHI TIẾT — dựng từ hình học cơ bản
       * (hộp, trụ, vành), giữ số lượng mesh vừa phải cho mobile.
       * ★ THAY MODEL THẬT (.glb): thay từng hàm build*() dưới đây bằng:
       *     const gltf = await new GLTFLoader().loadAsync('/models/vi-da.glb');
       *     return gltf.scene;
       * (Giữ nguyên Group cha g bên ngoài để timeline cuộn vẫn hoạt động.)
       * ============================================================ */
      // Vật liệu dùng chung cho chi tiết
      const stitchMat = new THREE.MeshStandardMaterial({
        color: 0xe6c795, // chỉ may màu be nhạt
        roughness: 0.9,
        metalness: 0.0,
      });
      const goldDetailMat = new THREE.MeshStandardMaterial({
        color: 0xd8a94e, // kim loại vàng
        metalness: 0.9,
        roughness: 0.35,
      });
      const darkHoleMat = new THREE.MeshStandardMaterial({
        color: 0x1c1008, // lỗ đục tối
        roughness: 0.95,
        metalness: 0.0,
      });
      // Hộp mảnh dùng làm đường chỉ may dọc mép da
      const stitchBox = (w, h, d) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stitchMat);
        m.castShadow = true;
        return m;
      };
      const shadowed = (mesh) => {
        mesh.castShadow = true;
        return mesh;
      };

      // 1. Ví da bifold: hai tấm da gập hở + chỉ may + logo kim loại
      function buildWallet() {
        const g = new THREE.Group();
        const w = 0.52, t = 0.07, d = 0.68;
        const left = shadowed(
          new THREE.Mesh(new RoundedBoxGeometry(w, t, d, 3, 0.03), leather(0x8a5a33, 0.62))
        );
        left.position.x = -w / 2;
        g.add(left);
        // Nửa phải gập hở quanh gáy (trục z) như ví đang mở
        const rightPivot = new THREE.Group();
        const right = shadowed(
          new THREE.Mesh(new RoundedBoxGeometry(w, t, d, 3, 0.03), leather(0x7a4a2c, 0.62))
        );
        right.position.x = w / 2;
        rightPivot.add(right);
        rightPivot.rotation.z = 0.24;
        g.add(rightPivot);
        // Chỉ may dọc mép ngoài mỗi tấm
        const st1 = stitchBox(0.018, 0.012, d - 0.1);
        st1.position.set(-w + 0.03, t / 2 + 0.004, 0);
        g.add(st1);
        const st2 = stitchBox(0.018, 0.012, d - 0.1);
        st2.position.set(-0.03, t / 2 + 0.004, 0);
        g.add(st2);
        const st3 = stitchBox(0.018, 0.012, d - 0.1);
        st3.position.set(w - 0.03, t / 2 + 0.004, 0);
        rightPivot.add(st3); // gắn theo pivot để đi cùng tấm gập
        const st4 = stitchBox(0.018, 0.012, d - 0.1);
        st4.position.set(0.03, t / 2 + 0.004, 0);
        rightPivot.add(st4);
        // Logo kim loại nhỏ trên tấm trái
        const logo = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.1), goldDetailMat));
        logo.position.set(-w / 2, t / 2 + 0.008, 0.18);
        g.add(logo);
        return g;
      }

      // 2. Dây đồng hồ: 3 đoạn cong nhẹ + lỗ đục + khóa kim loại
      function buildWatchStrap() {
        const g = new THREE.Group();
        const mat = leather(0x4a2f1c, 0.6);
        const widths = [0.27, 0.25, 0.22];
        for (let i = 0; i < 3; i++) {
          const seg = shadowed(
            new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.085, widths[i], 2, 0.04), mat)
          );
          seg.position.set(-0.4 + i * 0.4, Math.sin(i * 0.55) * 0.07, 0);
          seg.rotation.z = -0.1 * i; // cong dần xuống
          g.add(seg);
        }
        // 3 lỗ đục trên đoạn cuối dây
        for (let i = 0; i < 3; i++) {
          const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.02, 12), darkHoleMat);
          hole.position.set(0.28 + i * 0.11, 0.098, 0);
          g.add(hole);
        }
        // Khóa: khung chữ nhật kim loại + chốt ngang ở đầu dây
        const bx = -0.72;
        const rail1 = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.035), goldDetailMat));
        rail1.position.set(bx, 0, 0.155);
        g.add(rail1);
        const rail2 = rail1.clone();
        rail2.position.z = -0.155;
        g.add(rail2);
        const bar1 = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.05, 0.34), goldDetailMat));
        bar1.position.set(bx - 0.07, 0, 0);
        g.add(bar1);
        const bar2 = bar1.clone();
        bar2.position.x = bx + 0.07;
        g.add(bar2);
        const pin = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.3, 8), goldDetailMat));
        pin.rotation.x = Math.PI / 2;
        pin.position.set(bx, 0.01, 0);
        g.add(pin);
        return g;
      }

      // 3. Bao da chìa khóa: túi bo tròn + khoen kim loại + nút bấm
      function buildKeyPouch() {
        const g = new THREE.Group();
        const pouch = shadowed(
          new THREE.Mesh(new RoundedBoxGeometry(0.52, 0.36, 0.2, 3, 0.08), leather(0xa06a3a, 0.62))
        );
        g.add(pouch);
        // Khoen tròn kim loại phía trên
        const ring = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 10, 28), goldDetailMat));
        ring.position.set(0, 0.32, 0);
        g.add(ring);
        // Móc nối nhỏ giữa khoen và túi
        const link = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 10), goldDetailMat));
        link.position.set(0, 0.2, 0);
        g.add(link);
        // Nút bấm vàng mặt trước
        const snap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 16), goldDetailMat);
        snap.rotation.x = Math.PI / 2;
        snap.position.set(0, 0.05, 0.105);
        g.add(snap);
        // Chỉ may hai mép đứng mặt trước
        const s1 = stitchBox(0.018, 0.3, 0.014);
        s1.position.set(0.2, 0, 0.098);
        g.add(s1);
        const s2 = stitchBox(0.018, 0.3, 0.014);
        s2.position.set(-0.2, 0, 0.098);
        g.add(s2);
        return g;
      }

      // 4. Bao hộ chiếu: bìa phẳng tỉ lệ hộ chiếu + ngăn trước + chỉ may
      function buildPassport() {
        const g = new THREE.Group();
        const cover = shadowed(
          new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.09, 1.08, 3, 0.03), leather(0x6e3b2a, 0.62))
        );
        g.add(cover);
        // Ngăn trước: tấm mỏng đặt chếch phía trên bìa
        const pocket = shadowed(
          new THREE.Mesh(new RoundedBoxGeometry(0.68, 0.035, 0.52, 2, 0.015), leather(0x5d3222, 0.65))
        );
        pocket.position.set(0, 0.06, 0.24);
        pocket.rotation.x = -0.05;
        g.add(pocket);
        // Chỉ may quanh mép bìa
        const s1 = stitchBox(0.7, 0.012, 0.018);
        s1.position.set(0, 0.048, 0.51);
        g.add(s1);
        const s2 = stitchBox(0.7, 0.012, 0.018);
        s2.position.set(0, 0.048, -0.51);
        g.add(s2);
        const s3 = stitchBox(0.018, 0.012, 1.0);
        s3.position.set(0.36, 0.048, 0);
        g.add(s3);
        const s4 = stitchBox(0.018, 0.012, 1.0);
        s4.position.set(-0.36, 0.048, 0);
        g.add(s4);
        // Logo kim loại nhỏ
        const logo = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.018, 0.09), goldDetailMat));
        logo.position.set(0, 0.088, -0.32);
        g.add(logo);
        return g;
      }

      // 5. Đựng thẻ: 3 thẻ mỏng xòe quạt
      function buildCardHolder() {
        const g = new THREE.Group();
        const tones = [0x7a4a2c, 0x8a5a33, 0x6b4226];
        for (let i = 0; i < 3; i++) {
          const card = shadowed(
            new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.028, 0.44), leather(tones[i], 0.6))
          );
          card.position.y = i * 0.036;
          card.rotation.y = (i - 1) * 0.22; // xòe quạt
          g.add(card);
        }
        return g;
      }

      // 6. Thắt lưng cuộn: 3 vòng torus xếp chồng + khóa vàng
      function buildBelt() {
        const g = new THREE.Group();
        const mat = leather(0x93603a, 0.62);
        for (let i = 0; i < 3; i++) {
          const ring = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.07, 10, 30), mat));
          ring.rotation.x = Math.PI / 2; // nằm ngang
          ring.position.set((i - 1) * 0.02, -0.08 + i * 0.085, 0);
          g.add(ring);
        }
        // Khóa thắt lưng vàng trên cùng
        const buckle = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.16), goldDetailMat));
        buckle.position.set(0.1, 0.12, 0.14);
        g.add(buckle);
        return g;
      }

      const BUILDERS = [buildWallet, buildWatchStrap, buildKeyPouch, buildPassport, buildCardHolder, buildBelt];

      /* ============================================================
       * ★ MODEL THẬT — sản phẩm: thử tải .glb theo từng index, thất bại
       *   → tự động fallback về hình khối procedural tương ứng.
       *   Muốn đổi model khác: thay file trong public/models/, giữ tên.
       * ============================================================ */
      const MODEL_BY_INDEX = [
        // 0: ví da — model gốc màu xanh lá/cam → tô lại tông da bò
        {
          url: '/models/wallet.glb',
          size: 1.0,
          tint: { mode: 'palette', tones: [0x8a5a33, 0x6b4226, 0x7a4a2c] },
        },
        // 1: đồng hồ — model gốc đen tuyền → nâu da
        {
          url: '/models/watch.glb',
          size: 0.95,
          tint: { mode: 'single', color: 0x7a4a2c, roughness: 0.55, metalness: 0.15 },
        },
        // 2: chìa khóa — nâu sẫm khó thấy → mạ đồng thau cho nổi
        {
          url: '/models/key.glb',
          size: 0.8,
          tint: { mode: 'single', color: 0xc9a227, roughness: 0.35, metalness: 0.85 },
        },
        null, // 3: bao hộ chiếu — giữ procedural
        null, // 4: đựng thẻ — giữ procedural
        null, // 5: thắt lưng — giữ procedural
      ];
      const modelResults = await Promise.allSettled(
        MODEL_BY_INDEX.map((m, i) =>
          m && i < N
            ? gltfLoader.loadAsync(m.url)
            : Promise.reject(new Error('procedural'))
        )
      );

      /* ---------- Các sản phẩm chi tiết bay ra từ túi ---------- */
      const productGroups = products.map((p, i) => {
        const g = new THREE.Group();
        const spec = MODEL_BY_INDEX[i % MODEL_BY_INDEX.length];
        const res = modelResults[i % modelResults.length];
        if (spec && res.status === 'fulfilled') {
          const model = normalizeModel(res.value.scene, spec.size);
          if (spec.tint) tintModel(model, spec.tint);
          g.add(model);
        } else {
          g.add(BUILDERS[i % BUILDERS.length]()); // fallback procedural
        }
        // Bắt đầu: ẩn bên trong túi
        g.position.set((Math.random() - 0.5) * 1.1, -0.3, (Math.random() - 0.5) * 0.4);
        g.scale.setScalar(0.001);
        g.userData = {
          spin: 0.0025 + Math.random() * 0.003,
          floatPh: Math.random() * Math.PI * 2,
        };
        scene.add(g);
        return g;
      });

      /* ---------- Hạt bụi vàng ---------- */
      const dCount = isMobile ? 80 : 200;
      const dPos = new Float32Array(dCount * 3);
      const dSpd = new Float32Array(dCount);
      for (let i = 0; i < dCount; i++) {
        dPos[i * 3] = (Math.random() - 0.5) * 22;
        dPos[i * 3 + 1] = (Math.random() - 0.5) * 12;
        dPos[i * 3 + 2] = -1 - Math.random() * 10;
        dSpd[i] = 0.0012 + Math.random() * 0.004;
      }
      const dGeo = new THREE.BufferGeometry();
      dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
      const dust = new THREE.Points(
        dGeo,
        new THREE.PointsMaterial({
          color: 0xe8b96a,
          size: 0.055,
          transparent: true,
          opacity: 0.7,
          sizeAttenuation: true,
          depthWrite: false,
        })
      );
      scene.add(dust);

      /* ---------- Timeline cuộn: 100 đơn vị ---------- */
      const rowX = (i) => (i - (N - 1) / 2) * 2.6;
      const tl = gsap.timeline({ defaults: { ease: 'none' } });

      // Phase 2 (18→45): nắp mở, camera dolly vào, sản phẩm bay lên
      if (openAction) {
        // Túi model thật: scrub animation "open" có sẵn theo tiến trình cuộn
        tl.to(
          openProxy,
          {
            p: 1,
            duration: 14,
            onUpdate: () => {
              openAction.time = openProxy.p * openClip.duration;
              bagMixer.update(0);
            },
          },
          16
        );
      } else {
        // Túi procedural (fallback): xoay nắp như cũ
        tl.to(flapPivot.rotation, { x: -2.5, duration: 14 }, 16);
      }
      tl.to(camera.position, { z: 6.4, y: 0.55, duration: 24 }, 16);
      productGroups.forEach((g, i) => {
        tl.to(g.scale, { x: 1, y: 1, z: 1, duration: 7 }, 24 + i * 3.2);
        tl.to(g.position, { y: 2.8, duration: 9 }, 24 + i * 3.2);
      });
      // Chuyển phase (46→56): túi lùi + mờ về hậu cảnh, SP xếp hàng
      tl.to(camera.position, { x: rowX(0), duration: 10 }, 46);
      tl.to(bag.position, { z: -7.5, duration: 10 }, 46);
      tl.to(bag.scale, { x: 0.8, y: 0.8, z: 0.8, duration: 10 }, 46);
      bagMats.forEach((m) => tl.to(m, { opacity: 0.1, duration: 10 }, 46));
      productGroups.forEach((g, i) => {
        tl.to(g.position, { x: rowX(i), y: 0.35, z: 0, duration: 10 }, 46);
      });
      // Phase 3 (56→100): camera pan ngang, từng SP vào trung tâm
      tl.to(camera.position, { x: rowX(N - 1), duration: 44 }, 56);

      /* ---------- Đồng bộ lớp HTML theo tiến trình cuộn ---------- */
      const heroEl = heroRef.current;
      const hintEl = hintRef.current;
      const st = ScrollTrigger.create({
        trigger: stageRef.current,
        start: 'top top',
        end: '+=400%',
        pin: true,
        scrub: 1.1, // damping cho chuyển động mượt
        animation: tl,
        onUpdate: (self) => {
          const pr = self.progress;
          // Hero mờ dần khi bắt đầu cuộn
          const ho = pr < 0.06 ? 1 : pr > 0.16 ? 0 : 1 - (pr - 0.06) / 0.1;
          if (heroEl) {
            heroEl.style.opacity = ho;
            heroEl.style.pointerEvents = ho > 0.5 ? 'auto' : 'none';
          }
          if (hintEl) hintEl.style.opacity = pr < 0.05 ? 1 : 0;
          // Thẻ sản phẩm nào đang ở trung tâm
          let active = -1;
          if (pr >= 0.56) {
            active = Math.min(N - 1, Math.floor(((pr - 0.56) / 0.44) * N));
          }
          cardsRef.current.forEach(
            (el, i) => el && el.classList.toggle('active', i === active)
          );
          // Chấm chỉ báo phase
          const phase = pr < 0.16 ? 0 : pr < 0.5 ? 1 : 2;
          dotsRef.current.forEach(
            (el, i) => el && el.classList.toggle('on', i === phase)
          );
        },
      });

      /* ---------- Vòng render: xoay nhẹ SP + bụi bay ---------- */
      let raf = 0;
      let running = true;
      const clock = new THREE.Clock();
      const animate = () => {
        if (!running || state.disposed) return;
        raf = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();
        for (const g of productGroups) {
          if (g.scale.x > 0.5) {
            g.rotation.y += g.userData.spin;
            g.position.y += Math.sin(t * 1.4 + g.userData.floatPh) * 0.0016;
          }
        }
        const arr = dGeo.attributes.position.array;
        for (let i = 0; i < dCount; i++) {
          arr[i * 3 + 1] += dSpd[i];
          if (arr[i * 3 + 1] > 6) arr[i * 3 + 1] = -6;
        }
        dGeo.attributes.position.needsUpdate = true;
        camera.lookAt(camera.position.x * 0.6, 0.35, 0);
        renderer.render(scene, camera);
      };
      animate();

      const onVis = () => {
        if (document.hidden) {
          running = false;
          cancelAnimationFrame(raf);
        } else {
          running = true;
          clock.getDelta();
          animate();
        }
      };
      document.addEventListener('visibilitychange', onVis);

      const onResize = () => {
        const w = host.clientWidth;
        const h = host.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener('resize', onResize);

      if (!state.disposed) setReady(true);

      cleanup = () => {
        running = false;
        cancelAnimationFrame(raf);
        document.removeEventListener('visibilitychange', onVis);
        window.removeEventListener('resize', onResize);
        st.kill();
        tl.kill();
        scene.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach((m) => m.dispose());
          }
        });
        renderer.dispose();
        if (renderer.domElement.parentNode === host) {
          host.removeChild(renderer.domElement);
        }
      };
    })();

    return () => {
      state.disposed = true;
      if (cleanup) cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, staticMode]);

  /* ---------- Chế độ tĩnh / không WebGL: chỉ render thẻ ---------- */
  if (staticMode || !products) {
    const list = products || [];
    return (
      <div className="container page">
        <h1 className="page-title">Bộ sưu tập</h1>
        <p className="collection-lead">
          Những món đồ da thủ công được chế tác tỉ mỉ từ xưởng của chúng tôi.
        </p>
        {!products && <p>Đang tải sản phẩm…</p>}
        <div className="collection-grid">
          {list.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      </div>
    );
  }

  /* ---------- Chế độ tương tác: scene 3D pin + HTML phủ ---------- */
  return (
    <div className="collection">
      <section className="collection-stage" ref={stageRef}>
        <div className="collection-canvas" ref={canvasHostRef} aria-hidden="true" />

        {/* HUD: chấm chỉ báo 3 phase — HTML, không phải WebGL */}
        <div className="collection-hud" aria-hidden="true">
          {PHASE_LABELS.map((label, i) => (
            <span
              key={label}
              className="hud-dot"
              ref={(el) => (dotsRef.current[i] = el)}
            >
              <i />
              {label}
            </span>
          ))}
        </div>

        {/* Phase 1: hero copy HTML */}
        <div className="collection-hero" ref={heroRef}>
          <span className="hero-kicker">Bộ sưu tập thủ công</span>
          <h1 className="hero-title">
            Mở chiếc túi, <em>khám phá</em> từng món đồ da
          </h1>
          <p className="hero-sub">
            Cuộn xuống để xem nắp túi mở ra và từng sản phẩm thủ công bay lên —
            tất cả được làm từ da bò thật 100%.
          </p>
          <div className="hero-cta">
            <Link to="/cua-hang" className="btn btn-primary">
              Xem tất cả sản phẩm
            </Link>
          </div>
        </div>

        {/* Gợi ý cuộn */}
        <div className="collection-hint" ref={hintRef} aria-hidden="true">
          <span>Cuộn xuống</span>
          <i />
        </div>

        {/* Phase 3: thẻ thông tin DỮ LIỆU THẬT từ API */}
        <div className="collection-cards">
          {products.map((p, i) => (
            <article
              key={p.id}
              className="collection-card glass"
              ref={(el) => (cardsRef.current[i] = el)}
            >
              <div className="cc-index">
                {String(i + 1).padStart(2, '0')} / {String(products.length).padStart(2, '0')}
              </div>
              <h3>{p.name}</h3>
              <p className="cc-cat">{p.category_name || 'Đồ da thủ công'}</p>
              <div className="cc-price">{fmtVND(p.price)}</div>
              {p.fallback ? (
                <Link to="/cua-hang" className="btn btn-primary btn-small">
                  Xem cửa hàng
                </Link>
              ) : (
                <Link to={`/san-pham/${p.id}`} className="btn btn-primary btn-small">
                  Xem chi tiết
                </Link>
              )}
            </article>
          ))}
        </div>

        {/* Ghi công model 3D (yêu cầu của giấy phép CC-BY) */}
        <div className="collection-credits" aria-hidden="true">
          Model 3D: “Wrist Watch” của Poly by Google (CC BY 3.0), “A Wallet” của
          senior design (CC BY), Briefcase của reyshapes (CC0), Key của
          Quaternius (CC0) — qua Poly Pizza
        </div>

        {!ready && <div className="collection-loading">Đang chuẩn bị trải nghiệm 3D…</div>}
      </section>
    </div>
  );
}

/* Thẻ sản phẩm dùng cho chế độ tĩnh / không WebGL */
function ProductCard({ p }) {
  return (
    <article className="collection-card glass static">
      <h3>{p.name}</h3>
      <p className="cc-cat">{p.category_name || 'Đồ da thủ công'}</p>
      <div className="cc-price">{fmtVND(p.price)}</div>
      {p.fallback ? (
        <Link to="/cua-hang" className="btn btn-primary btn-small">
          Xem cửa hàng
        </Link>
      ) : (
        <Link to={`/san-pham/${p.id}`} className="btn btn-primary btn-small">
          Xem chi tiết
        </Link>
      )}
    </article>
  );
}
