import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtVND } from '../api';
import { useStore } from '../context/StoreContext';
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
 *   - Túi hero: bag.glb — "Briefcase" da của Poly by Google (CC BY 3.0),
 *     model tĩnh (không animation) → phase 2 dùng hiệu ứng nghiêng túi
 *     + camera dolly để gợi cảm giác mở nắp.
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
   effect dựng scene vì cần THREE — xem khối "HÌNH KHỐI SẢN PHẨM CHI TIẾT".
 * NÂNG CẤP TRỰC QUAN: RoomEnvironment + ACES + studio 3 điểm + vignette.
 * INSPECTOR 3D: nút "Xem 3D" trên mỗi thẻ (hoặc bấm trực tiếp vào sản phẩm
 * 3D) mở overlay toàn màn hình: xoay/kéo/phóng to model thật bằng
 * OrbitControls, kèm panel thông tin + thêm vào giỏ hàng.
 */

const PHASE_LABELS = ['Mở đầu', 'Khám phá', 'Bộ sưu tập'];

export default function Collection() {
  const [products, setProducts] = useState(null); // null = đang tải API
  const [ready, setReady] = useState(false);     // scene 3D đã dựng xong
  const [inspectIdx, setInspectIdx] = useState(null); // index SP đang mở inspector 3D
  const { addToCart } = useStore();

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
  const inspectOpenRef = useRef(false); // inspector mở → vòng render chính tạm nghỉ
  const modelsRef = useRef([]);         // object 3D thật (model .glb / procedural) theo index SP

  /* Mở / đóng inspector 3D: khóa cuộn body khi mở */
  const openInspector = (i) => {
    inspectOpenRef.current = true;
    document.body.style.overflow = 'hidden';
    setInspectIdx(i);
  };
  const closeInspector = () => {
    inspectOpenRef.current = false;
    document.body.style.overflow = '';
    setInspectIdx(null);
  };
  // An toàn: nếu rời trang khi inspector đang mở thì trả lại cuộn body
  useEffect(() => () => { document.body.style.overflow = ''; }, []);

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
      const [THREE, gsapMod, stMod, rbgMod, gltfMod, roomMod] = await Promise.all([
        import('three'),
        import('gsap'),
        import('gsap/ScrollTrigger'),
        import('three/examples/jsm/geometries/RoundedBoxGeometry.js'),
        import('three/examples/jsm/loaders/GLTFLoader.js'),
        import('three/examples/jsm/environments/RoomEnvironment.js'),
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
      // Tone mapping điện ảnh → màu da/kim loại sâu và "sang" hơn
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.95;
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x140d07); // nền tối espresso, che nền chung
      scene.fog = new THREE.FogExp2(0x140d07, 0.026);

      // Environment map: RoomEnvironment cho phản chiếu PBR chân thực
      // trên da và chi tiết kim loại. Giữ intensity vừa phải để không
      // cháy sáng, mất màu nâu da bò đặc trưng.
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new roomMod.RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = 0.45;
      pmrem.dispose();

      const camera = new THREE.PerspectiveCamera(
        50,
        host.clientWidth / host.clientHeight,
        0.1,
        100
      );
      camera.position.set(0, 0.9, 10);

      /* ---------- Ánh sáng studio 3 điểm (ấm, sang) ---------- */
      // Key: đèn chính hướng, đổ bóng mềm
      const key = new THREE.DirectionalLight(0xffe3b8, 1.7);
      key.position.set(5, 7, 6);
      key.castShadow = true;
      key.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
      key.shadow.camera.left = -7;
      key.shadow.camera.right = 7;
      key.shadow.camera.top = 7;
      key.shadow.camera.bottom = -7;
      key.shadow.bias = -0.0004;
      scene.add(key);
      // Fill: làm mềm vùng tối, ánh nâu ấm nhẹ từ bên trái
      const fill = new THREE.DirectionalLight(0xc98d5e, 0.4);
      fill.position.set(-6, 2, 5);
      scene.add(fill);
      // Rim: viền vàng ấm từ phía sau → tách sản phẩm khỏi nền tối
      const rim = new THREE.DirectionalLight(0xff9d4d, 1.1);
      rim.position.set(-3, 4, -7);
      scene.add(rim);
      // Ambient rất nhẹ (environment map đã lo phần lớn ánh sáng môi trường)
      scene.add(new THREE.AmbientLight(0x6b4a2e, 0.35));

      /* Sàn hứng bóng đổ */
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 40),
        new THREE.ShadowMaterial({ opacity: 0.35 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -2.4;
      ground.receiveShadow = true;
      scene.add(ground);

      /* Bóng tiếp xúc mềm (fake AO): quầng tối radial dưới vùng sản phẩm
         phase 3, giúp sản phẩm "đứng" có chiều sâu trên nền */
      const shadowTex = (() => {
        const c = document.createElement('canvas');
        c.width = c.height = 256;
        const ctx = c.getContext('2d');
        const grd = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
        grd.addColorStop(0, 'rgba(0,0,0,0.55)');
        grd.addColorStop(0.55, 'rgba(0,0,0,0.22)');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, 256, 256);
        return new THREE.CanvasTexture(c);
      })();
      const contactShadow = new THREE.Mesh(
        new THREE.PlaneGeometry(11, 3.6),
        new THREE.MeshBasicMaterial({
          map: shadowTex,
          transparent: true,
          depthWrite: false,
        })
      );
      contactShadow.rotation.x = -Math.PI / 2;
      contactShadow.position.y = -1.32;
      scene.add(contactShadow);

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
       * ★ MODEL THẬT — túi hero (nạp nền, KHÔNG chặn timeline):
       *   Túi procedural ở trên được dùng ngay để dựng scene/timeline;
       *   khi bag.glb ("Briefcase" của Poly by Google, CC BY 3.0) tải xong
       *   sẽ thay thế mesh. Model này tĩnh (không animation) nên phase 2
       *   dùng hiệu ứng nghiêng túi + camera dolly để gợi cảm giác mở nắp.
       *   Tải lỗi → giữ nguyên túi procedural.
       * ============================================================ */
      const bagFade = { o: 1 }; // độ mờ túi phase 3 (proxy để swap model không ảnh hưởng)
      let bagIsModel = false; // true khi bag.glb đã swap vào (model tĩnh)
      const swapInBagModel = (bagGltf) => {
        if (state.disposed) return;
        bagIsModel = true;
        // Dọn các mesh procedural, GIỮ LẠI Group cha `bag`
        for (const child of [...bag.children]) {
          bag.remove(child);
          child.traverse((o) => {
            if (o.geometry) o.geometry.dispose();
          });
        }
        bagMats.length = 0;
        const bagModel = normalizeModel(bagGltf.scene, 3.4);
        // Tô lại màu da bò đậm cho model túi
        // → làm TRƯỚC khi thu thập materials để giữ transparent/opacity
        tintModel(bagModel, {
          mode: 'palette',
          tones: [0x6b4226, 0x7a4a2c, 0x5a3a22],
        });
        bagModel.traverse((o) => {
          if (o.isMesh) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach((m) => {
              m.transparent = true; // để phase 3 làm mờ túi như cũ
              m.opacity = bagFade.o; // đồng bộ độ mờ hiện tại của timeline
              if (!bagMats.includes(m)) bagMats.push(m);
            });
          }
        });
        bag.add(bagModel);
      };
      // Nạp nền: không await ở đây để scene/timeline dựng ngay lập tức
      gltfLoader.loadAsync('/models/bag.glb').then(swapInBagModel).catch(() => {});

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
       * ★ MODEL THẬT — sản phẩm (nạp nền, KHÔNG chặn timeline):
       *   Dựng procedural ngay để timeline chạy tức thì; khi từng .glb
       *   tải xong sẽ thay thế procedural bằng model thật (hiệu ứng
       *   hiện dần). Tải lỗi → giữ nguyên procedural.
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

      /* ---------- Các sản phẩm: dựng procedural NGAY, swap model thật sau ---------- */
      const productGroups = products.map((p, i) => {
        const g = new THREE.Group();
        g.add(BUILDERS[i % BUILDERS.length]()); // procedural trước, model thật swap sau
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
      // Lưu object 3D thật của từng SP → inspector 3D sẽ clone lại, không tải lại
      // (được cập nhật lại mỗi khi model .glb swap vào)
      modelsRef.current = productGroups.map((g) => g.children[0] || g);

      // Nạp nền từng model .glb → thay thế procedural khi xong
      MODEL_BY_INDEX.forEach((spec, i) => {        if (!spec || i >= N) return;
        gltfLoader
          .loadAsync(spec.url)
          .then((gltf) => {
            if (state.disposed) return;
            const g = productGroups[i];
            if (!g) return;
            const old = g.children[0];
            if (old) {
              g.remove(old);
              old.traverse((o) => {
                if (o.geometry) o.geometry.dispose();
              });
            }
            const model = normalizeModel(gltf.scene, spec.size);
            if (spec.tint) tintModel(model, spec.tint);
            const targetS = model.scale.x; // tỉ lệ sau normalize
            model.scale.setScalar(targetS * 0.55); // hiệu ứng hiện dần
            g.add(model);
            modelsRef.current[i] = model;
            gsap.to(model.scale, {
              x: targetS,
              y: targetS,
              z: targetS,
              duration: 0.7,
              ease: 'back.out(1.5)',
            });
          })
          .catch(() => {
            /* tải lỗi → giữ nguyên procedural */
          });
      });

      /* Bấm trực tiếp vào sản phẩm 3D → mở inspector xem chi tiết */
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const onCanvasClick = (e) => {
        if (inspectOpenRef.current) return;
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(productGroups, true);
        if (!hits.length) return;
        let obj = hits[0].object;
        const idx = productGroups.findIndex((g) => {
          let p = obj;
          while (p) {
            if (p === g) return true;
            p = p.parent;
          }
          return false;
        });
        if (idx >= 0 && products[idx]) openInspector(idx);
      };
      renderer.domElement.addEventListener('click', onCanvasClick);

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

      // Phase 2 (18→45): gợi cảm giác mở nắp túi để sản phẩm bay lên
      // - Túi procedural: xoay nắp (flapPivot) như cũ
      // - Túi model thật (tĩnh, không animation): nghiêng cả túi ra sau
      //   + camera dolly vào, nhìn vào miệng túi khi sản phẩm bay lên
      const openProxy = { p: 0 }; // tiến trình mở, timeline cuộn điều khiển
      tl.to(
        openProxy,
        {
          p: 1,
          duration: 14,
          onUpdate: () => {
            if (bagIsModel) {
              bag.rotation.x = -0.42 * openProxy.p;
              bag.position.y = -0.25 * openProxy.p;
            } else {
              flapPivot.rotation.x = -2.5 * openProxy.p;
            }
          },
        },
        16
      );
      tl.to(camera.position, { z: 6.4, y: 0.55, duration: 24 }, 16);
      productGroups.forEach((g, i) => {
        tl.to(g.scale, { x: 1, y: 1, z: 1, duration: 7 }, 24 + i * 3.2);
        tl.to(g.position, { y: 2.8, duration: 9 }, 24 + i * 3.2);
      });
      // Chuyển phase (46→56): túi lùi + mờ về hậu cảnh, SP xếp hàng.
      // Fade qua proxy bagFade để model swap vào sau vẫn mờ đúng.
      tl.to(camera.position, { x: rowX(0), duration: 10 }, 46);
      tl.to(bag.position, { z: -7.5, duration: 10 }, 46);
      tl.to(bag.scale, { x: 0.8, y: 0.8, z: 0.8, duration: 10 }, 46);
      tl.to(
        bagFade,
        {
          o: 0.1,
          duration: 10,
          onUpdate: () => bagMats.forEach((m) => (m.opacity = bagFade.o)),
        },
        46
      );
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
            // visibility:hidden để nút CTA tàng hình không chặn click
            // vào sản phẩm 3D / thẻ ở phase 2-3
            heroEl.style.visibility = ho > 0.5 ? 'visible' : 'hidden';
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
          // Phase 3: phóng to nhẹ SP đang ở trung tâm để thấy rõ chi tiết
          productGroups.forEach((g, i) => {
            if (g.scale.x > 0.5) {
              g.scale.setScalar(pr >= 0.56 ? (i === active ? 1.45 : 1) : 1);
            }
          });
        },
      });

      /* ---------- Vòng render: xoay nhẹ SP + bụi bay ---------- */
      let raf = 0;
      let running = true;
      const clock = new THREE.Clock();
      const animate = () => {
        if (!running || state.disposed) return;
        raf = requestAnimationFrame(animate);
        // Inspector đang mở: nghỉ render scene chính, tiết kiệm GPU
        if (inspectOpenRef.current) return;
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
        renderer.domElement.removeEventListener('click', onCanvasClick);
        st.kill();
        tl.kill();
        scene.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach((m) => m.dispose());
          }
        });
        if (scene.environment) scene.environment.dispose();
        shadowTex.dispose();
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
        {/* Vignette: quầng tối viền → nền có chiều sâu, sản phẩm nổi bật hơn */}
        <div className="collection-vignette" aria-hidden="true" />

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
              <div className="cc-actions">
                {p.fallback ? (
                  <Link to="/cua-hang" className="btn btn-primary btn-small">
                    Xem cửa hàng
                  </Link>
                ) : (
                  <Link to={`/san-pham/${p.id}`} className="btn btn-primary btn-small">
                    Xem chi tiết
                  </Link>
                )}
                <button
                  className="btn btn-ghost btn-small"
                  onClick={() => openInspector(i)}
                >
                  Xem 3D
                </button>
              </div>
            </article>
          ))}
        </div>

        {/* Ghi công model 3D (yêu cầu của giấy phép CC-BY) */}
        <div className="collection-credits" aria-hidden="true">
          Model 3D: “Wrist Watch” của Poly by Google (CC BY 3.0), “A Wallet” của
          senior design (CC BY), “Briefcase” của Poly by Google (CC BY 3.0),
          Key của Quaternius (CC0) — qua Poly Pizza
        </div>

        {!ready && <div className="collection-loading">Đang chuẩn bị trải nghiệm 3D…</div>}
      </section>

      {/* Inspector 3D: xem chi tiết từng món, xoay qua xoay lại */}
      {inspectIdx !== null && products[inspectIdx] && (
        <ProductInspector
          product={products[inspectIdx]}
          modelObject={modelsRef.current[inspectIdx] || null}
          onClose={closeInspector}
          addToCart={addToCart}
        />
      )}
    </div>
  );
}

/* ============================================================
 * ProductInspector — overlay toàn màn hình xem chi tiết 1 sản phẩm:
 * model 3D THẬT (clone từ scene chính, không tải lại) + OrbitControls
 * (kéo xoay, cuộn/phóng to, damping, tự xoay đến khi user chạm vào),
 * panel HTML: tên, danh mục, giá, mô tả, thêm vào giỏ hàng.
 * ESC / bấm nền / nút Đóng để thoát. Model tải lỗi → hiện mesh
 * procedural fallback, không bao giờ trống.
 * ============================================================ */
function ProductInspector({ product, modelObject, onClose, addToCart }) {
  const viewRef = useRef(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  // Phím ESC đóng inspector
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Dựng viewport 3D riêng cho inspector
  useEffect(() => {
    let disposed = false;
    let cleanup = null;
    (async () => {
      const [THREE, orbitMod, roomMod] = await Promise.all([
        import('three'),
        import('three/examples/jsm/controls/OrbitControls.js'),
        import('three/examples/jsm/environments/RoomEnvironment.js'),
      ]);
      if (disposed || !viewRef.current) return;
      const host = viewRef.current;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(host.clientWidth, host.clientHeight);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.95;
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      // Environment cho phản chiếu PBR chân thực (vừa phải, không cháy sáng)
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTex = pmrem.fromScene(new roomMod.RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;
      scene.environmentIntensity = 0.45;
      pmrem.dispose();

      const camera = new THREE.PerspectiveCamera(
        42,
        host.clientWidth / host.clientHeight,
        0.1,
        50
      );
      camera.position.set(1.8, 1.2, 3.4);

      // Studio 3 điểm cho inspector
      const key = new THREE.DirectionalLight(0xffe3b8, 1.7);
      key.position.set(4, 6, 5);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xc98d5e, 0.4);
      fill.position.set(-5, 2, 4);
      scene.add(fill);
      const rim = new THREE.DirectionalLight(0xff9d4d, 1.1);
      rim.position.set(-2, 4, -6);
      scene.add(rim);
      scene.add(new THREE.AmbientLight(0x6b4a2e, 0.35));

      // Clone model thật từ scene chính (chia sẻ geometry/material → rẻ)
      if (modelObject) {
        const model = modelObject.clone(true);
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        model.scale.setScalar(1.7 / maxDim);
        const box2 = new THREE.Box3().setFromObject(model);
        model.position.sub(box2.getCenter(new THREE.Vector3()));
        scene.add(model);
      }

      // Bóng tiếp xúc mềm dưới sản phẩm
      const shadowTex = (() => {
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const ctx = c.getContext('2d');
        const grd = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
        grd.addColorStop(0, 'rgba(0,0,0,0.55)');
        grd.addColorStop(0.6, 'rgba(0,0,0,0.2)');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, 128, 128);
        return new THREE.CanvasTexture(c);
      })();
      const contact = new THREE.Mesh(
        new THREE.PlaneGeometry(3.2, 3.2),
        new THREE.MeshBasicMaterial({
          map: shadowTex,
          transparent: true,
          depthWrite: false,
        })
      );
      contact.rotation.x = -Math.PI / 2;
      contact.position.y = -1.05;
      scene.add(contact);

      // OrbitControls: kéo xoay, cuộn/phóng to, damping; tự xoay đến khi chạm
      const controls = new orbitMod.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.minDistance = 1.4;
      controls.maxDistance = 9;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 1.1;
      controls.addEventListener(
        'start',
        () => {
          controls.autoRotate = false;
        },
        { once: true }
      );
      controls.target.set(0, 0.05, 0);

      let raf = 0;
      let run = true;
      const animate = () => {
        if (!run || disposed) return;
        raf = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      const onResize = () => {
        const w = host.clientWidth;
        const h = host.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener('resize', onResize);

      cleanup = () => {
        run = false;
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', onResize);
        controls.dispose();
        envTex.dispose();
        shadowTex.dispose();
        // KHÔNG dispose geometry/material của model: đang dùng chung với scene chính
        renderer.dispose();
        if (renderer.domElement.parentNode === host) {
          host.removeChild(renderer.domElement);
        }
      };
    })();
    return () => {
      disposed = true;
      if (cleanup) cleanup();
    };
  }, [modelObject]);

  const inStock = product.fallback ? true : product.stock > 0;

  return (
    <div
      className="inspect-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Xem 3D ${product.name}`}
    >
      <div className="inspect-backdrop" onClick={onClose} />
      <div className="inspect-box glass">
        <div className="inspect-view" ref={viewRef}>
          <div className="inspect-hint3d">Kéo để xoay · Cuộn để phóng to</div>
        </div>
        <aside className="inspect-panel">
          <button className="inspect-close" onClick={onClose} aria-label="Đóng">
            ✕
          </button>
          <div className="cc-index">Xem 3D</div>
          <h2>{product.name}</h2>
          <p className="cc-cat">{product.category_name || 'Đồ da thủ công'}</p>
          <div className="cc-price">{fmtVND(product.price)}</div>
          {product.description && (
            <p className="inspect-desc">{product.description}</p>
          )}
          {!product.fallback && (
            <div
              className="inspect-stock"
              style={{ color: inStock ? '#8fd18f' : '#e08a8a' }}
            >
              {inStock ? `Còn ${product.stock} sản phẩm` : 'Hết hàng'}
            </div>
          )}
          {!product.fallback && (
            <div className="qty-row">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
              <span>{qty}</span>
              <button
                onClick={() => setQty((q) => Math.min(product.stock || 99, q + 1))}
              >
                +
              </button>
            </div>
          )}
          <div className="inspect-actions">
            {product.fallback ? (
              <Link to="/cua-hang" className="btn btn-primary">
                Xem cửa hàng
              </Link>
            ) : (
              <button
                className="btn btn-primary"
                disabled={!inStock}
                onClick={() => {
                  addToCart(product, qty);
                  setAdded(true);
                  setTimeout(() => setAdded(false), 1800);
                }}
              >
                {added ? '✓ Đã thêm vào giỏ' : '🛒 Thêm vào giỏ hàng'}
              </button>
            )}
            <button className="btn btn-ghost" onClick={onClose}>
              Đóng
            </button>
          </div>
        </aside>
      </div>
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
