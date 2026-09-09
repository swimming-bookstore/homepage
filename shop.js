    (function () {
      const BG = 0xfff9ef;
      const IMG = 1408;
      const WORLD = 12.15;
      const S = WORLD / IMG;
      const SRC = typeof __STOREFRONT__ !== "undefined" ? __STOREFRONT__ : "assets/storefront.jpg";

      const CUTS = [
        { name: "logo",             x: 555, y:  40, w: 300, h: 300, z: 0 },
        { name: "upper banner",     x: 229, y: 360, w: 949, h: 284, z: 0.75 },
        { name: "right banner",     x:1184, y: 664, w: 124, h: 198, z: 0.25 },
        { name: "cornice",          x: 229, y: 644, w: 949, h:  46, z: 1.5 },
        { name: "left window",      x: 236, y: 690, w: 308, h: 332, z: 0.5 },
        { name: "door",             x: 544, y: 690, w: 320, h: 527, z: 0.02 },
        { name: "right window",     x: 864, y: 690, w: 305, h: 332, z: 0.5 },
        { name: "wall under left",  x: 236, y:1022, w: 308, h: 195, z: 0.75 },
        { name: "wall under right", x: 864, y:1022, w: 305, h: 195, z: 0.75 },
        { name: "post",             x:1166, y: 708, w:  26, h: 154, z: 0.25 },
        { name: "steps",            x: 214, y:1217, w: 977, h:  98, z: 1 }
      ];

      const params = new URLSearchParams(location.search);
      let debug = params.get("debug") === "1";
      let showLines = true;
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
      let greyPlane = null;
      let join24 = null;
      let targetYaw = 0;
      let targetPitch = 0;
      let yaw = 0;
      let pitch = 0;
      let gyroYaw = 0;
      let gyroPitch = 0;
      let pointerX = 0.5;
      let pointerY = 0.5;
      let touching = false;
      let touchOnCanvas = false;
      let touchStartX = 0;
      let touchStartY = 0;
      let touchGesture = "";
      let idleT = 0;
      let gyroArmed = false;

      function mobileView() {
        return window.innerWidth < 720 || window.matchMedia("(hover: none) and (pointer: coarse)").matches;
      }

      function clamp(v, a, b) {
        return Math.max(a, Math.min(b, v));
      }

      const hero = canvas.parentElement;
      let lockedW = 0;
      let lockedDebug = null;

      function pinHero() {
        if (!hero) return;
        const debugOn = !!(panel && !panel.classList.contains("hidden"));
        const w = window.innerWidth;
        if (!mobileView()) {
          lockedW = 0;
          lockedDebug = null;
          hero.style.height = "";
          return;
        }
        if (w === lockedW && lockedDebug === debugOn) return;
        lockedW = w;
        lockedDebug = debugOn;
        const viewH = Math.round((window.visualViewport && window.visualViewport.height) || window.innerHeight);
        const above = debugOn ? (hero.offsetTop || 0) : 0;
        hero.style.height = Math.max(280, viewH - above) + "px";
      }

      function resize() {
        pinHero();
        const w = canvas.clientWidth || window.innerWidth;
        const h = canvas.clientHeight || window.innerHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / Math.max(h, 1);
        const needW = w < 720 ? 11.6 : 13.4;
        const needH = w < 720 ? 13.8 : 12.6;
        const vFov = camera.fov * Math.PI / 180;
        const zForH = needH / (2 * Math.tan(vFov / 2));
        const zForW = needW / (2 * Math.tan(vFov / 2) * camera.aspect);
        camera.position.z = Math.max(zForH, zForW);
        camera.updateProjectionMatrix();
      }
      window.addEventListener("resize", resize);
      window.addEventListener("orientationchange", function () {
        lockedW = 0;
        resize();
      });
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
          g.fillText((CUTS.indexOf(cut) + 1) + "  " + cut.name, 8, 8);
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
        line.visible = false;
        return line;
      }

      function applyLines() {
        pieces.forEach(function (p) {
          paintCut(p.canvas, p.img, p.cut, debug && showLines);
          p.map.needsUpdate = true;
          if (p.line) p.line.visible = debug && showLines && p.mesh.visible;
        });
      }

      function renderPanel() {
        if (!panel) return;
        panel.classList.toggle("hidden", !debug);
        document.body.classList.toggle("debug-on", debug);
        if (!debug) return;
        const yawDeg = Math.round(yaw * 180 / Math.PI);
        const pitchDeg = Math.round(pitch * 180 / Math.PI);
        panel.innerHTML =
          "<h2>debug</h2><ul>" +
          pieces.map(function (p, i) {
            const off = p.mesh.visible ? "" : " class='off'";
            return "<li data-i='" + i + "'" + off + ">" + (i + 1) + "  " + p.cut.name + "</li>";
          }).join("") +
          "</ul><label class='opt'><input type='checkbox' id='show-lines'" +
          (showLines ? " checked" : "") + "> red lines</label>" +
          "<p class='hint'>yaw " + yawDeg + "° · pitch " + pitchDeg + "°</p>" +
          "<p class='hint'>Move to the hero edges for ±90°</p>";
        pinHero();
        resize();
      }

      function setDebug(on) {
        debug = on;
        if (!debug) showLines = false;
        if (greyPlane) greyPlane.visible = debug;
        applyLines();
        renderPanel();
      }

      const img = new Image();
      img.onload = function () {
        const logoCut = CUTS[0];
        const stepsCut = CUTS[10];
        const topY = (IMG / 2 - (logoCut.y + logoCut.h)) * S;
        const bottomY = (IMG / 2 - (stepsCut.y + stepsCut.h)) * S;
        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(WORLD * 1.2, topY - bottomY),
          new THREE.MeshBasicMaterial({
            color: 0xb4b4b4,
            depthWrite: true,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1,
            toneMapped: false
          })
        );
        plane.position.set(0, (topY + bottomY) / 2, 0);
        plane.renderOrder = -1;
        plane.visible = debug;
        greyPlane = plane;
        shop.add(plane);

        CUTS.forEach(function (cut) {
          const c = document.createElement("canvas");
          c.width = cut.w;
          c.height = cut.h;
          paintCut(c, img, cut, false);
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
              depthWrite: true,
              toneMapped: false
            })
          );
          mesh.position.set(
            (cut.x + cut.w / 2 - IMG / 2) * S,
            (IMG / 2 - (cut.y + cut.h / 2)) * S,
            cut.z
          );
          mesh.renderOrder = Math.round(cut.z * 100);
          const line = redBox(cut);
          mesh.add(line);
          if (cut.name === "logo") logo.add(mesh);
          else shop.add(mesh);
          pieces.push({ mesh: mesh, canvas: c, map: map, img: img, cut: cut, line: line });
        });
        const a = CUTS[1];
        const b = CUTS[3];
        const corniceTopX = 244;
        const corniceTopW = 921;
        const joinW = corniceTopW * S;
        const joinZ = Math.abs(b.z - a.z);
        const strip = new THREE.Mesh(
          new THREE.PlaneGeometry(joinW, joinZ),
          new THREE.MeshBasicMaterial({
            color: 0x2b4a77,
            side: THREE.DoubleSide,
            depthWrite: true,
            toneMapped: false
          })
        );
        strip.rotation.x = Math.PI / 2;
        strip.position.set(
          (corniceTopX + corniceTopW / 2 - IMG / 2) * S,
          (IMG / 2 - b.y) * S,
          (a.z + b.z) / 2
        );
        strip.renderOrder = 5;
        join24 = strip;
        shop.add(strip);

        function addJoinStrip(front, back, color, yImg, wImg, xImg) {
          const joinZ = Math.abs(front.z - back.z);
          const y = yImg != null ? yImg : (front.y + front.h);
          const w = wImg != null ? wImg : back.w;
          const x = xImg != null ? xImg : back.x;
          const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(w * S, joinZ),
            new THREE.MeshBasicMaterial({
              color: color,
              side: THREE.DoubleSide,
              depthWrite: true,
              toneMapped: false
            })
          );
          mesh.rotation.x = Math.PI / 2;
          mesh.position.set(
            (x + w / 2 - IMG / 2) * S,
            (IMG / 2 - y) * S,
            (front.z + back.z) / 2
          );
          mesh.renderOrder = 5;
          shop.add(mesh);
          return mesh;
        }
        function addSideJoinStrip(a, b, color, edgeX, hImg, yImg) {
          const joinZ = Math.abs(a.z - b.z);
          const h = hImg != null ? hImg : a.h;
          const yMid = yImg != null ? yImg : (a.y + a.h / 2);
          const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(joinZ, h * S),
            new THREE.MeshBasicMaterial({
              color: color,
              side: THREE.DoubleSide,
              depthWrite: true,
              toneMapped: false
            })
          );
          mesh.rotation.y = Math.PI / 2;
          mesh.position.set(
            (edgeX - IMG / 2) * S,
            (IMG / 2 - yMid) * S,
            (a.z + b.z) / 2
          );
          mesh.renderOrder = 5;
          shop.add(mesh);
          return mesh;
        }
        function sampleColor(x, y, w, h) {
          const c = document.createElement("canvas");
          c.width = 1;
          c.height = 1;
          const g = c.getContext("2d");
          g.drawImage(img, x, y, w, h, 0, 0, 1, 1);
          const d = g.getImageData(0, 0, 1, 1).data;
          return (d[0] << 16) | (d[1] << 8) | d[2];
        }
        const BLUE = 0x2b4a77;
        const MILK = 0xf3e9df;
        const steps = CUTS[10];
        const door = CUTS[5];
        const sideStop = steps.y;
        const side8H = sideStop - CUTS[7].y;
        const side9H = sideStop - CUTS[8].y;
        addJoinStrip(CUTS[3], CUTS[4], BLUE);
        addJoinStrip(CUTS[3], door, BLUE);
        addJoinStrip(CUTS[3], CUTS[6], BLUE);
        addSideJoinStrip(CUTS[4], door, BLUE, door.x);
        addSideJoinStrip(CUTS[7], door, BLUE, door.x, side8H, CUTS[7].y + side8H / 2);
        addSideJoinStrip(CUTS[6], door, BLUE, door.x + door.w);
        addSideJoinStrip(CUTS[8], door, BLUE, door.x + door.w, side9H, CUTS[8].y + side9H / 2);
        addJoinStrip(CUTS[4], CUTS[7], BLUE, (CUTS[4].y + CUTS[4].h + CUTS[7].y) / 2);
        addJoinStrip(CUTS[6], CUTS[8], BLUE, (CUTS[6].y + CUTS[6].h + CUTS[8].y) / 2);
        addJoinStrip(door, steps, MILK, door.y + door.h);
        addSideJoinStrip(CUTS[6], CUTS[9], BLUE, (CUTS[6].x + CUTS[6].w + CUTS[9].x) / 2);
        addJoinStrip(steps, CUTS[7], MILK, steps.y, door.x - steps.x, steps.x);
        addJoinStrip(steps, CUTS[8], MILK, steps.y, (steps.x + steps.w) - (door.x + door.w), door.x + door.w);


        applyLines();
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
        const r = canvas.getBoundingClientRect();
        if (!r.width || !r.height) return;
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
        pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(pieces.map(function (p) { return p.mesh; }), false);
        if (!hits.length) return;
        const mesh = hits[0].object;
        mesh.visible = !mesh.visible;
        const p = pieces.find(function (x) { return x.mesh === mesh; });
        if (p && p.line) p.line.visible = showLines && p.mesh.visible;
        renderPanel();
      });
      if (panel) {
        panel.addEventListener("change", function (e) {
          if (e.target.id !== "show-lines") return;
          showLines = e.target.checked;
          applyLines();
        });
        panel.addEventListener("click", function (e) {
          const li = e.target.closest("li");
          if (!li) return;
          const i = +li.getAttribute("data-i");
          const p = pieces[i];
          if (!p) return;
          p.mesh.visible = !p.mesh.visible;
          if (p.line) p.line.visible = showLines && p.mesh.visible;
          renderPanel();
        });
      }

      function onOrient(e) {
        const g = e.gamma || 0;
        const b = e.beta || 0;
        gyroYaw = clamp(g / 38, -1, 1) * 0.16;
        gyroPitch = clamp((b - 48) / 36, -1, 1) * 0.09;
      }

      function armGyro() {
        if (gyroArmed) return;
        gyroArmed = true;
        const DOE = window.DeviceOrientationEvent;
        if (!DOE) return;
        if (typeof DOE.requestPermission === "function") {
          DOE.requestPermission().then(function (state) {
            if (state === "granted") window.addEventListener("deviceorientation", onOrient);
          }).catch(function () {});
        } else {
          window.addEventListener("deviceorientation", onOrient);
        }
      }

      function aimFrom(x, y) {
        const r = canvas.getBoundingClientRect();
        const w = r.width || window.innerWidth || 1;
        const h = r.height || window.innerHeight || 1;
        pointerX = clamp((x - r.left) / w, 0, 1);
        pointerY = clamp((y - r.top) / h, 0, 1);
      }

      function endTouch() {
        touching = false;
        touchOnCanvas = false;
        touchGesture = "";
      }

      window.addEventListener("pointermove", function (e) {
        if (debug) {
          if (e.pointerType === "touch" && !touchOnCanvas && !touching) return;
          if (e.pointerType === "touch") touching = true;
          aimFrom(e.clientX, e.clientY);
          return;
        }
        if (e.pointerType === "touch") {
          if (!touchOnCanvas && !touching) return;
          if (!touchGesture) {
            const dx = e.clientX - touchStartX;
            const dy = e.clientY - touchStartY;
            if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
            touchGesture = Math.abs(dy) > Math.abs(dx) * 1.15 ? "scroll" : "tilt";
            if (touchGesture === "scroll") {
              touching = false;
              touchOnCanvas = false;
              return;
            }
            touching = true;
          }
          if (touchGesture === "tilt") aimFrom(e.clientX, e.clientY);
          return;
        }
        aimFrom(e.clientX, e.clientY);
      });
      canvas.addEventListener("pointerdown", function (e) {
        if (e.pointerType !== "touch" && !mobileView()) return;
        touching = false;
        touchOnCanvas = true;
        touchGesture = "";
        touchStartX = e.clientX;
        touchStartY = e.clientY;
      });
      window.addEventListener("pointerup", function () {
        const tappedHero = touchOnCanvas && touchGesture !== "scroll";
        endTouch();
        if (tappedHero) armGyro();
      });
      window.addEventListener("pointercancel", function () { endTouch(); });

      renderer.setAnimationLoop(function () {
        const mobile = mobileView();
        idleT += mobile ? 0.016 : 0.01;
        const idleYaw = Math.sin(idleT) * (mobile ? 0.042 : 0.012);
        const idlePitch = Math.cos(idleT * 0.73) * (mobile ? 0.022 : 0.007);

        if (debug) {
          targetYaw = (pointerX * 2 - 1) * (Math.PI / 2);
          targetPitch = (pointerY * 2 - 1) * (Math.PI / 2);
          yaw = targetYaw;
          pitch = targetPitch;
        } else if (mobile && touching) {
          targetYaw = (pointerX * 2 - 1) * 0.24;
          targetPitch = (pointerY * 2 - 1) * 0.2;
        } else if (mobile) {
          targetYaw = gyroYaw + idleYaw;
          targetPitch = gyroPitch + idlePitch;
        } else {
          targetYaw = (pointerX * 2 - 1) * 0.16 + idleYaw;
          targetPitch = (pointerY * 2 - 1) * 0.09 + idlePitch;
        }

        if (!debug) {
          const ease = mobile ? (touching ? 0.18 : 0.07) : 0.035;
          yaw += (targetYaw - yaw) * ease;
          pitch += (targetPitch - pitch) * ease;
        }
        shop.rotation.y = yaw;
        shop.rotation.x = pitch;
        if (debug) {
          logo.rotation.y = yaw;
          logo.rotation.x = pitch;
        } else {
          logo.rotation.set(0, 0, 0);
        }
        shop.position.x = debug ? 0 : yaw * (mobile ? 0.55 : 0.2);
        shop.position.y = debug ? 0 : -pitch * (mobile ? 0.35 : 0.12);
        if (debug && panel) {
          const hints = panel.querySelectorAll(".hint");
          if (hints[0]) {
            hints[0].textContent =
              "yaw " + Math.round(yaw * 180 / Math.PI) + "° · pitch " + Math.round(pitch * 180 / Math.PI) + "°";
          }
        }
        renderer.render(scene, camera);
      });
    })();
