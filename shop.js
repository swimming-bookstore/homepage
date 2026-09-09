    (function () {
      const BG = 0xfff9ef;
      const IMG = 1408;
      const WORLD = 12.15;
      const S = WORLD / IMG;
      const SRC = typeof __STOREFRONT__ !== "undefined" ? __STOREFRONT__ : "assets/storefront.jpg";

      const CUTS = [
        { name: "1  logo",             x: 555, y:  40, w: 300, h: 300, z: 0.58 },
        { name: "2  upper banner",     x: 229, y: 360, w: 949, h: 284, z: 0.32 },
        { name: "3  right banner",     x:1184, y: 664, w: 124, h: 198, z: 0.381 },
        { name: "4  cornice",          x: 229, y: 644, w: 949, h:  46, z: 0.32 },
        { name: "5  left window",      x: 236, y: 690, w: 288, h: 348, z: 0.36 },
        { name: "6  door",             x: 524, y: 690, w: 360, h: 520, z: 0.44 },
        { name: "7  right window",     x: 884, y: 690, w: 285, h: 348, z: 0.36 },
        { name: "8  wall under left",  x: 236, y:1038, w: 288, h: 172, z: 0.28 },
        { name: "9  wall under right", x: 884, y:1038, w: 285, h: 172, z: 0.28 },
        { name: "10 post",             x:1166, y: 708, w:  26, h: 154, z: 0.38 },
        { name: "11 steps",            x: 214, y:1210, w: 977, h: 105, z: 0.22 }
      ];

      const params = new URLSearchParams(location.search);
      let debug = params.get("debug") === "1";
      const panel = document.getElementById("debug");

      const canvas = document.getElementById("scene");
      const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(BG, 1);
      if (renderer.outputColorSpace !== undefined) {
        renderer.outputColorSpace = THREE.SRGBColorSpace;
      } else if (renderer.outputEncoding !== undefined) {
        renderer.outputEncoding = THREE.sRGBEncoding;
      }

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(BG);

      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 120);
      camera.position.set(0, 0.15, 21.4);
      camera.lookAt(0, 0.15, 0);

      const shop = new THREE.Group();
      const logo = new THREE.Group();
      scene.add(shop);
      scene.add(logo);

      const pieces = [];
      let targetYaw = 0;
      let targetPitch = 0;
      let yaw = 0;
      let pitch = 0;

      function resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        const needW = w < 720 ? 11.6 : 13.4;
        const needH = w < 720 ? 13.8 : 12.6;
        const vFov = camera.fov * Math.PI / 180;
        const zForH = needH / (2 * Math.tan(vFov / 2));
        const zForW = needW / (2 * Math.tan(vFov / 2) * camera.aspect);
        camera.position.z = Math.max(zForH, zForW);
        camera.updateProjectionMatrix();
      }
      window.addEventListener("resize", resize);
      resize();

      function paintCut(c, img, cut, showLines) {
        const g = c.getContext("2d");
        g.clearRect(0, 0, cut.w, cut.h);
        g.drawImage(img, cut.x, cut.y, cut.w, cut.h, 0, 0, cut.w, cut.h);
        const holes = cut.holes || (cut.hole ? [cut.hole] : []);
        holes.forEach(function (h) {
          g.clearRect(h.x - cut.x, h.y - cut.y, h.w, h.h);
        });
        if (showLines) {
          g.save();
          g.strokeStyle = "#e23b3b";
          g.lineWidth = Math.max(2, Math.round(Math.min(cut.w, cut.h) * 0.012));
          g.strokeRect(
            g.lineWidth / 2,
            g.lineWidth / 2,
            cut.w - g.lineWidth,
            cut.h - g.lineWidth
          );
          g.fillStyle = "#e23b3b";
          g.font = "700 18px Outfit, system-ui, sans-serif";
          g.textBaseline = "top";
          g.fillText(cut.name, 8, 8);
          g.restore();
        }
      }

      function redBox(cut) {
        const hw = cut.w * S / 2, hh = cut.h * S / 2;
        const pts = new Float32Array([
          -hw, -hh, 0.003,  hw, -hh, 0.003,
           hw, -hh, 0.003,  hw,  hh, 0.003,
           hw,  hh, 0.003, -hw,  hh, 0.003,
          -hw,  hh, 0.003, -hw, -hh, 0.003
        ]);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
        const line = new THREE.LineSegments(
          geo,
          new THREE.LineBasicMaterial({ color: 0xe23b3b, depthTest: false })
        );
        line.renderOrder = 40;
        line.visible = debug;
        return line;
      }

      function renderPanel() {
        if (!panel) return;
        panel.classList.toggle("hidden", !debug);
        if (!debug) return;
        panel.innerHTML =
          "<h2>Debug · cuts</h2><ol>" +
          pieces.map(function (p, i) {
            const off = p.mesh.visible ? "" : " class='off'";
            return "<li data-i='" + i + "'" + off + ">" + p.cut.name + "</li>";
          }).join("") +
          "</ol><p class='hint'>Click a piece or a name to hide/show</p>";
      }

      function setDebug(on) {
        debug = on;
        pieces.forEach(function (p) {
          paintCut(p.canvas, p.img, p.cut, debug);
          p.map.needsUpdate = true;
          if (p.line) p.line.visible = debug;
        });
        renderPanel();
      }

      const img = new Image();
      img.onload = function () {
        CUTS.forEach(function (cut) {
          const c = document.createElement("canvas");
          c.width = cut.w;
          c.height = cut.h;
          paintCut(c, img, cut, debug);
          const map = new THREE.CanvasTexture(c);
          if (map.colorSpace !== undefined) map.colorSpace = THREE.SRGBColorSpace;
          else map.encoding = THREE.sRGBEncoding;
          map.minFilter = THREE.LinearFilter;
          map.magFilter = THREE.LinearFilter;
          map.needsUpdate = true;
          const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(cut.w * S, cut.h * S),
            new THREE.MeshBasicMaterial({
              map: map,
              transparent: true,
              depthWrite: false,
              polygonOffset: true,
              polygonOffsetFactor: -1,
              polygonOffsetUnits: -1,
              toneMapped: false
            })
          );
          mesh.position.set(
            (cut.x + cut.w / 2 - IMG / 2) * S,
            (IMG / 2 - (cut.y + cut.h / 2)) * S,
            cut.z
          );
          mesh.renderOrder = Math.round(cut.z * 100);
          mesh.material.polygonOffsetUnits = -mesh.renderOrder;
          const line = redBox(cut);
          mesh.add(line);
          if (/^1\s/.test(cut.name)) logo.add(mesh);
          else shop.add(mesh);
          pieces.push({ mesh: mesh, canvas: c, map: map, img: img, cut: cut, line: line });
        });
        renderPanel();
      };
      img.src = SRC;

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let downX = 0, downY = 0;

      window.addEventListener("pointerdown", function (e) {
        downX = e.clientX;
        downY = e.clientY;
      });
      window.addEventListener("pointerup", function (e) {
        if (!debug) return;
        if (Math.hypot(e.clientX - downX, e.clientY - downY) > 8) return;
        pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(pieces.map(function (p) { return p.mesh; }), false);
        if (!hits.length) return;
        const mesh = hits[0].object;
        mesh.visible = !mesh.visible;
        const p = pieces.find(function (x) { return x.mesh === mesh; });
        if (p && p.line) p.line.visible = debug;
        renderPanel();
      });
      if (panel) {
        panel.addEventListener("click", function (e) {
          const li = e.target.closest("li");
          if (!li) return;
          const i = +li.getAttribute("data-i");
          const p = pieces[i];
          if (!p) return;
          p.mesh.visible = !p.mesh.visible;
          if (p.line) p.line.visible = debug;
          renderPanel();
        });
      }

      function aimFrom(x, y) {
        const w = window.innerWidth || 1;
        const h = window.innerHeight || 1;
        const mobile = w < 720;
        const yawAmt = mobile ? 0.09 : 0.16;
        const pitchAmt = mobile ? 0.05 : 0.09;
        targetYaw = ((x / w) * 2 - 1) * yawAmt;
        targetPitch = ((y / h) * 2 - 1) * pitchAmt;
      }

      window.addEventListener("pointermove", function (e) {
        if (e.pointerType === "touch") return;
        aimFrom(e.clientX, e.clientY);
      });
      window.addEventListener("touchstart", function (e) {
        if (!e.touches.length) return;
        aimFrom(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: true });
      window.addEventListener("touchmove", function (e) {
        if (!e.touches.length) return;
        aimFrom(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: true });

      renderer.setAnimationLoop(function () {
        yaw += (targetYaw - yaw) * 0.035;
        pitch += (targetPitch - pitch) * 0.035;
        shop.rotation.y = yaw;
        shop.rotation.x = pitch;
        renderer.render(scene, camera);
      });
    })();
