import React, { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";
import { Plus, Trash2, Send, RotateCw, AlertTriangle, CheckCircle2, Gift, Lock, LogOut, Download, Inbox } from "lucide-react";

// ============================================================
// ⚙️  CONFIG — set these as environment variables in Vercel
// (Project Settings → Environment Variables). See .env.example.
// ============================================================
const OWNER_EMAIL = import.meta.env.VITE_OWNER_EMAIL || "you@example.com";
const SCHOOL_NAME = import.meta.env.VITE_SCHOOL_NAME || "my school";
const SITE_NAME = import.meta.env.VITE_SITE_NAME || "3D Pocket Prints";
const COLORS = ["White", "Red", "Blue", "Black"];

// ---------- fonts ----------
const FontLoader = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
    .ff-display { font-family: 'Space Grotesk', ui-sans-serif, sans-serif; }
    .ff-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
  `}</style>
);

const C = {
  bg: "#15171B", panel: "#1C1F24", line: "#2B3036", lineFaint: "#22262C",
  text: "#ECE9E1", muted: "#868D96", mutedDim: "#565C63",
  accent: "#FF6A2B", green: "#5FBF7A",
};

// ============================================================
// PARSER + GEOMETRY (same generator engine as before)
// ============================================================
function parseDescription(raw) {
  const text = (raw || "").toLowerCase();
  let sizeMM = 50;
  const explicit = text.match(/(\d+(?:\.\d+)?)\s?(mm|cm)\b/);
  if (explicit) {
    const v = parseFloat(explicit[1]);
    sizeMM = explicit[2] === "cm" ? v * 10 : v;
  } else {
    if (/\b(tiny|mini|miniature)\b/.test(text)) sizeMM = 25;
    else if (/\bsmall\b/.test(text)) sizeMM = 38;
    else if (/\b(large|big)\b/.test(text)) sizeMM = 75;
    else if (/\b(huge|giant|massive)\b/.test(text)) sizeMM = 110;
  }
  sizeMM = Math.min(Math.max(sizeMM, 15), 150);
  const teethMatch = text.match(/(\d+)\s*teeth/);
  const teeth = teethMatch ? Math.min(Math.max(parseInt(teethMatch[1]), 6), 30) : 12;
  let shape = "block";
  if (/\bgear\b|\bcog\b/.test(text)) shape = "gear";
  else if (/\bvase\b/.test(text)) shape = "vase";
  else if (/phone (stand|holder|dock)/.test(text)) shape = "phonestand";
  else if (/key ?chain|key ?ring|\btag\b|\bfob\b/.test(text)) shape = "keychain";
  else if (/(box|container).*(lid|cap)|lidded/.test(text)) shape = "boxlid";
  else if (/\btube\b|\bpipe\b|hollow cylinder/.test(text)) shape = "tube";
  else if (/\bbracket\b|\bhook\b|\bl-?bracket\b|wall mount/.test(text)) shape = "bracket";
  else if (/\bstar\b/.test(text)) shape = "star";
  else if (/\bpyramid\b/.test(text)) shape = "pyramid";
  else if (/\btorus\b|\bring\b|\bdonut\b|\bdoughnut\b/.test(text)) shape = "torus";
  else if (/\bcone\b/.test(text)) shape = "cone";
  else if (/\bcylinder\b/.test(text)) shape = "cylinder";
  else if (/\bsphere\b|\bball\b|\borb\b/.test(text)) shape = "sphere";
  else if (/\bbox\b|\bcube\b|\bblock\b|\bcontainer\b/.test(text)) shape = "block";
  const narrowNeck = /narrow neck|thin neck|slim neck/.test(text);
  const hollow = /hollow|open top|no lid/.test(text);
  return { shape, sizeMM, teeth, narrowNeck, hollow, raw };
}

const SHAPE_LABEL = {
  gear: "Gear", vase: "Vase", phonestand: "Phone stand", keychain: "Keychain tag",
  boxlid: "Box with lid", tube: "Hollow tube", bracket: "L-bracket", star: "Star",
  pyramid: "Pyramid", torus: "Ring / torus", cone: "Cone", cylinder: "Cylinder",
  sphere: "Sphere", block: "Block",
};

// ---------- backend API (Vercel serverless functions, see /api) ----------
const api = {
  async login(passcode) {
    const r = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    return r.ok;
  },
  async createOrder(order) {
    await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
    });
  },
  async listOrders(passcode) {
    const r = await fetch("/api/orders", { headers: { "x-owner-passcode": passcode } });
    if (!r.ok) throw new Error("failed to load orders");
    const { orders } = await r.json();
    return orders;
  },
  async updateOrder(id, passcode, updates) {
    await fetch(`/api/orders?id=${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-owner-passcode": passcode },
      body: JSON.stringify(updates),
    });
  },
  async deleteOrder(id, passcode) {
    await fetch(`/api/orders?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "x-owner-passcode": passcode },
    });
  },
};

function randomMysterySpec() {
  const shapes = Object.keys(SHAPE_LABEL);
  const shape = shapes[Math.floor(Math.random() * shapes.length)];
  return {
    shape,
    sizeMM: 30 + Math.random() * 55,
    teeth: 8 + Math.floor(Math.random() * 12),
    narrowNeck: Math.random() < 0.5,
    hollow: Math.random() < 0.3,
    raw: "mystery",
  };
}

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x, y + r);
  s.lineTo(x, y + h - r);
  s.quadraticCurveTo(x, y + h, x + r, y + h);
  s.lineTo(x + w - r, y + h);
  s.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
  s.lineTo(x + w, y + r);
  s.quadraticCurveTo(x + w, y, x + w - r, y);
  s.lineTo(x + r, y);
  s.quadraticCurveTo(x, y, x, y + r);
  return s;
}

function buildModel(spec) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xff6a2b, roughness: 0.45, metalness: 0.08 });
  const S = spec.sizeMM;
  const add = (geo, pos = [0, 0, 0], rot = [0, 0, 0]) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    m.rotation.set(...rot);
    group.add(m);
    return m;
  };

  switch (spec.shape) {
    case "gear": {
      const outerR = S / 2, innerR = outerR * 0.78, holeR = outerR * 0.28;
      const shape = new THREE.Shape();
      const teeth = spec.teeth;
      const step = (Math.PI * 2) / (teeth * 2);
      for (let i = 0; i < teeth * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const a = i * step;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
      }
      shape.closePath();
      const hole = new THREE.Path();
      hole.absarc(0, 0, holeR, 0, Math.PI * 2, true);
      shape.holes.push(hole);
      const thickness = Math.max(S * 0.18, 5);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      add(geo, [0, thickness, 0]);
      break;
    }
    case "vase": {
      const height = S, maxR = S * 0.32, neckR = spec.narrowNeck ? S * 0.1 : S * 0.2;
      const pts = [];
      const n = 18;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const y = t * height;
        let r;
        if (t < 0.85) {
          r = maxR * (0.45 + 0.55 * Math.sin(Math.PI * Math.min(t / 0.85, 1)));
          r = Math.max(r, maxR * 0.4);
        } else {
          const tt = (t - 0.85) / 0.15;
          r = maxR * 0.4 * (1 - tt) + neckR * tt;
        }
        pts.push(new THREE.Vector2(Math.max(r, 2), Math.max(y, 0.001)));
      }
      add(new THREE.LatheGeometry(pts, 40), [0, 0, 0]);
      break;
    }
    case "phonestand": {
      const w = S, baseD = S * 0.55, baseH = S * 0.12;
      add(new THREE.BoxGeometry(w, baseH, baseD), [0, baseH / 2, 0]);
      const backH = S * 0.75;
      add(new THREE.BoxGeometry(w, backH, S * 0.1),
        [0, baseH + (backH / 2) * Math.cos((20 * Math.PI) / 180), -baseD / 2 + S * 0.08],
        [(-20 * Math.PI) / 180, 0, 0]);
      add(new THREE.BoxGeometry(w, S * 0.14, S * 0.1), [0, baseH + S * 0.05, baseD / 2 - S * 0.08]);
      break;
    }
    case "keychain": {
      const w = S, h = S * 0.42, thick = Math.max(S * 0.08, 3), holeR = h * 0.16;
      const shape = roundedRectShape(w, h, h * 0.18);
      const hole = new THREE.Path();
      hole.absarc(-w / 2 + h * 0.28, h / 2 - h * 0.28, holeR, 0, Math.PI * 2, true);
      shape.holes.push(hole);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      add(geo, [0, thick, 0]);
      break;
    }
    case "boxlid": {
      const w = S, d = S * 0.7, h = S * 0.55;
      add(new THREE.BoxGeometry(w, h, d), [0, h / 2, 0]);
      if (!spec.hollow) {
        const lid = new THREE.Mesh(
          new THREE.BoxGeometry(w * 1.04, h * 0.22, d * 1.04),
          new THREE.MeshStandardMaterial({ color: 0xffab7a, roughness: 0.45 })
        );
        lid.position.set(0, h + h * 0.11 + 2, 0);
        group.add(lid);
      }
      break;
    }
    case "tube": {
      const outerR = S / 2, innerR = outerR * 0.7, height = S;
      const shape = new THREE.Shape();
      shape.absarc(0, 0, outerR, 0, Math.PI * 2, false);
      const hole = new THREE.Path();
      hole.absarc(0, 0, innerR, 0, Math.PI * 2, true);
      shape.holes.push(hole);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      add(geo, [0, height, 0]);
      break;
    }
    case "bracket": {
      const leg = S, thick = Math.max(S * 0.16, 6), width = S * 0.6;
      const shape = new THREE.Shape();
      shape.moveTo(0, 0); shape.lineTo(leg, 0); shape.lineTo(leg, thick);
      shape.lineTo(thick, thick); shape.lineTo(thick, leg); shape.lineTo(0, leg);
      shape.closePath();
      const holeR = thick * 0.25;
      const h1 = new THREE.Path(); h1.absarc(thick * 1.6, thick / 2, holeR, 0, Math.PI * 2, true);
      const h2 = new THREE.Path(); h2.absarc(thick / 2, thick * 1.6, holeR, 0, Math.PI * 2, true);
      shape.holes.push(h1, h2);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      geo.translate(-leg / 2, 0, width / 2);
      add(geo, [0, 0, -S * 0.15]);
      break;
    }
    case "star": {
      const outerR = S / 2, innerR = outerR * 0.42, points = 5;
      const shape = new THREE.Shape();
      const step = Math.PI / points;
      for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const a = i * step - Math.PI / 2;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
      }
      shape.closePath();
      const thickness = Math.max(S * 0.16, 5);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      add(geo, [0, thickness, 0]);
      break;
    }
    case "pyramid":
      add(new THREE.ConeGeometry(S / 2, S * 0.85, 4), [0, S * 0.425, 0], [0, Math.PI / 4, 0]);
      break;
    case "torus":
      add(new THREE.TorusGeometry(S / 2, S * 0.16, 20, 40), [0, S * 0.16, 0], [Math.PI / 2, 0, 0]);
      break;
    case "cone":
      add(new THREE.ConeGeometry(S / 2, S * 0.9, 32), [0, S * 0.45, 0]);
      break;
    case "cylinder":
      add(new THREE.CylinderGeometry(S / 2, S / 2, S * 0.85, 32), [0, S * 0.425, 0]);
      break;
    case "sphere":
      add(new THREE.SphereGeometry(S / 2, 32, 24), [0, S / 2, 0]);
      break;
    case "block":
    default:
      add(new THREE.BoxGeometry(S, S * 0.6, S * 0.7), [0, S * 0.3, 0]);
      break;
  }

  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3(); box.getSize(size);
  const center = new THREE.Vector3(); box.getCenter(center);
  group.children.forEach((c) => {
    c.position.x -= center.x; c.position.z -= center.z; c.position.y -= box.min.y;
  });
  return { group, dims: { x: size.x, y: size.y, z: size.z } };
}

function groupToSTL(group, name = "model") {
  let out = `solid ${name}\n`;
  group.updateMatrixWorld(true);
  group.traverse((obj) => {
    if (!obj.isMesh) return;
    let geo = obj.geometry;
    if (geo.index) geo = geo.toNonIndexed();
    const pos = geo.attributes.position;
    const mw = obj.matrixWorld;
    for (let i = 0; i < pos.count; i += 3) {
      const vA = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mw);
      const vB = new THREE.Vector3().fromBufferAttribute(pos, i + 1).applyMatrix4(mw);
      const vC = new THREE.Vector3().fromBufferAttribute(pos, i + 2).applyMatrix4(mw);
      const cb = new THREE.Vector3().subVectors(vC, vB);
      const ab = new THREE.Vector3().subVectors(vA, vB);
      const n = cb.cross(ab).normalize();
      out += `facet normal ${n.x.toFixed(6)} ${n.y.toFixed(6)} ${n.z.toFixed(6)}\nouter loop\n`;
      out += `vertex ${vA.x.toFixed(6)} ${vA.y.toFixed(6)} ${vA.z.toFixed(6)}\n`;
      out += `vertex ${vB.x.toFixed(6)} ${vB.y.toFixed(6)} ${vB.z.toFixed(6)}\n`;
      out += `vertex ${vC.x.toFixed(6)} ${vC.y.toFixed(6)} ${vC.z.toFixed(6)}\n`;
      out += `endloop\nendfacet\n`;
    }
  });
  out += `endsolid ${name}\n`;
  return out;
}

function downloadSTL(group, filename) {
  const stl = groupToSTL(group, filename);
  // Data URI instead of a blob: URL — blob URLs can lose the race against
  // revokeObjectURL/navigation in sandboxed iframes and end up rendering the
  // raw STL text (a page full of vertex numbers) instead of downloading.
  const dataUri = "data:model/stl;charset=utf-8," + encodeURIComponent(stl);
  const a = document.createElement("a");
  a.href = dataUri;
  a.download = `${filename.trim().replace(/\s+/g, "-")}.stl`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ============================================================
// LIVE 3D PREVIEW (small, non-interactive, auto-rotating)
// ============================================================
function Preview({ items }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const groupsRef = useRef([]);

  useEffect(() => {
    const mount = mountRef.current;
    const width = mount.clientWidth, height = mount.clientHeight;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(C.panel);
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(38, width / height, 1, 3000);
    camera.position.set(160, 150, 220);
    camera.lookAt(0, 30, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.innerHTML = "";
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xfff2e8, 1.1);
    key.position.set(120, 200, 100);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x4a90c4, 0.3);
    rim.position.set(-150, 80, -100);
    scene.add(rim);

    const grid = new THREE.GridHelper(220, 22, 0x3a4048, 0x262b31);
    scene.add(grid);
    const bed = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 220),
      new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.9 })
    );
    bed.rotation.x = -Math.PI / 2;
    bed.position.y = -0.5;
    scene.add(bed);

    const container = new THREE.Group();
    scene.add(container);

    let raf;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      container.rotation.y += 0.006;
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    groupsRef.current = { container, renderer };
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    const container = groupsRef.current?.container;
    if (!container) return;
    for (let i = container.children.length - 1; i >= 0; i--) container.remove(container.children[i]);

    const gap = 10;
    let totalWidth = 0;
    const built = items
      .filter((it) => it.description.trim())
      .map((it) => {
        const spec = parseDescription(it.description);
        const { group, dims } = buildModel(spec);
        return { group, dims };
      });
    built.forEach((b) => (totalWidth += b.dims.x + gap));
    let cursor = -totalWidth / 2;
    built.forEach((b) => {
      b.group.position.x = cursor + b.dims.x / 2;
      cursor += b.dims.x + gap;
      container.add(b.group);
    });
  }, [items]);

  return <div ref={mountRef} style={{ width: "100%", height: "100%", minHeight: 260 }} />;
}

// ============================================================
// OWNER PANEL — passcode-gated, shared order inbox
// ============================================================
function OwnerPanel({ onExit }) {
  const [authed, setAuthed] = useState(false);
  const [pass, setPass] = useState("");
  const [passError, setPassError] = useState(false);
  const [checkingPass, setCheckingPass] = useState(false);
  const [orders, setOrders] = useState(null); // null = loading
  const [loadError, setLoadError] = useState(false);
  const [replyOpenId, setReplyOpenId] = useState(null);
  const [replyDrafts, setReplyDrafts] = useState({});

  const loadOrders = async () => {
    setLoadError(false);
    try {
      const results = await api.listOrders(pass);
      results.sort((a, b) => b.ts - a.ts);
      setOrders(results);
    } catch {
      setLoadError(true);
      setOrders([]);
    }
  };

  useEffect(() => {
    if (authed) loadOrders();
  }, [authed]);

  const tryLogin = async () => {
    setCheckingPass(true);
    const ok = await api.login(pass);
    setCheckingPass(false);
    if (ok) { setAuthed(true); setPassError(false); }
    else setPassError(true);
  };

  const handleDownload = (order) => {
    order.items.forEach((it, idx) => {
      setTimeout(() => {
        const { group } = buildModel(it.spec);
        downloadSTL(group, `${order.name}-${it.description.slice(0, 20)}`.replace(/[^a-z0-9-]/gi, "_"));
      }, idx * 400);
    });
  };

  const handleEmailCustomer = (order) => {
    const subject = encodeURIComponent(`Your 3D print files — ${order.name}`);
    const lines = order.items.map((i, idx) => `${idx + 1}. ${i.description}  (x${i.qty})`).join("\n");
    const body = encodeURIComponent(
      `Hi ${order.name},\n\nAttach the file(s) you just downloaded, then print with your own 3D printer.\n\nOrder:\n${lines}\n\nColor: ${order.color}\n\n— ${SITE_NAME}`
    );
    window.location.href = `mailto:${order.email}?subject=${subject}&body=${body}`;
  };

  const handleSendReply = async (order) => {
    const text = (replyDrafts[order.id] || "").trim();
    if (!text) return;
    const subject = encodeURIComponent(`Re: your 3D print order — ${SITE_NAME}`);
    const body = encodeURIComponent(text);
    window.location.href = `mailto:${order.email}?subject=${subject}&body=${body}`;

    const updates = { replied: true, replyText: text, replyTs: Date.now() };
    try { await api.updateOrder(order.id, pass, updates); } catch {}
    setOrders((os) => os.map((o) => (o.id === order.id ? { ...o, ...updates } : o)));
    setReplyOpenId(null);
  };

  const handleRemove = async (order) => {
    try { await api.deleteOrder(order.id, pass); } catch {}
    setOrders((os) => os.filter((o) => o.id !== order.id));
  };

  if (!authed) {
    return (
      <div className="ff-mono" style={{ minHeight: "100vh", background: C.bg, color: C.text, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <FontLoader />
        <div style={{ maxWidth: 320, width: "100%", textAlign: "center" }}>
          <Lock size={26} color={C.accent} style={{ marginBottom: 12 }} />
          <div className="ff-display" style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Owner panel</div>
          <input
            type="password"
            value={pass}
            onChange={(e) => { setPass(e.target.value); setPassError(false); }}
            onKeyDown={(e) => e.key === "Enter" && tryLogin()}
            placeholder="Passcode"
            style={{ width: "100%", background: C.panel, border: `1px solid ${passError ? "#D9534F" : C.line}`, borderRadius: 4, color: C.text, padding: "10px 12px", fontSize: 13, outline: "none", marginBottom: 10, textAlign: "center" }}
          />
          {passError && <div style={{ fontSize: 11.5, color: "#D9534F", marginBottom: 10 }}>Wrong passcode.</div>}
          <button onClick={tryLogin} disabled={checkingPass} style={{ width: "100%", background: C.accent, color: "#1A0D06", border: "none", borderRadius: 4, padding: "11px 0", fontSize: 13, fontWeight: 700, cursor: checkingPass ? "default" : "pointer", marginBottom: 10, opacity: checkingPass ? 0.7 : 1 }}>
            {checkingPass ? "Checking…" : "Enter"}
          </button>
          <button onClick={onExit} style={{ background: "none", border: "none", color: C.mutedDim, fontSize: 12, cursor: "pointer" }}>
            ← Back to order form
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ff-mono" style={{ minHeight: "100vh", background: C.bg, color: C.text }}>
      <FontLoader />
      <div style={{ borderBottom: `1px solid ${C.line}`, padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="ff-display" style={{ fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
          <Inbox size={18} color={C.accent} /> Orders
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={loadOrders} style={{ background: "none", border: `1px solid ${C.line}`, color: C.muted, borderRadius: 4, padding: "7px 12px", fontSize: 12, cursor: "pointer" }}>
            Refresh
          </button>
          <button onClick={onExit} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: `1px solid ${C.line}`, color: C.muted, borderRadius: 4, padding: "7px 12px", fontSize: 12, cursor: "pointer" }}>
            <LogOut size={13} /> Exit
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: 24 }}>
        {orders === null && <div style={{ color: C.mutedDim, fontSize: 13 }}>Loading orders…</div>}
        {loadError && <div style={{ color: "#D9534F", fontSize: 13 }}>Couldn't load orders — try refreshing.</div>}
        {orders && orders.length === 0 && !loadError && (
          <div style={{ color: C.mutedDim, fontSize: 13, textAlign: "center", padding: 40 }}>No orders yet.</div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {orders?.map((order) => (
            <div key={order.id} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{order.name}</div>
                  <div style={{ fontSize: 11.5, color: C.muted }}>{order.email}</div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{
                    fontSize: 10, padding: "3px 8px", borderRadius: 3, letterSpacing: "0.04em",
                    background: order.isStudent ? "#8A3E1D33" : "#4A90C433",
                    color: order.isStudent ? C.accent : "#7CB8E5",
                  }}>
                    {order.isStudent ? `${SCHOOL_NAME.toUpperCase()} · $1 CASH` : "REMOTE"}
                  </span>
                  {order.mode === "mystery" && (
                    <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 3, background: "#5FBF7A33", color: C.green }}>
                      MYSTERY
                    </span>
                  )}
                  {order.replied && (
                    <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 3, background: "#5FBF7A33", color: C.green }}>
                      REPLIED
                    </span>
                  )}
                </div>
              </div>

              <div style={{ fontSize: 12, color: C.text, lineHeight: 1.8, marginBottom: 4 }}>
                {order.items.map((it, idx) => (
                  <div key={idx}>{idx + 1}. {it.description} <span style={{ color: C.mutedDim }}>(x{it.qty})</span></div>
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 12 }}>
                Color: {order.color} · {new Date(order.ts).toLocaleString()}
              </div>
              {order.replied && (
                <div style={{ fontSize: 11.5, color: C.mutedDim, background: C.bg, border: `1px solid ${C.lineFaint}`, borderRadius: 4, padding: 10, marginBottom: 12 }}>
                  <span style={{ color: C.green }}>Last reply</span> ({new Date(order.replyTs).toLocaleString()}): {order.replyText}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => handleDownload(order)} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${C.accent}`, color: C.accent, borderRadius: 4, padding: "8px 12px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
                  <Download size={13} /> Download STL
                </button>
                {!order.isStudent && (
                  <button onClick={() => handleEmailCustomer(order)} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${C.line}`, color: C.muted, borderRadius: 4, padding: "8px 12px", fontSize: 11.5, cursor: "pointer" }}>
                    <Send size={13} /> Email customer
                  </button>
                )}
                <button
                  onClick={() => setReplyOpenId(replyOpenId === order.id ? null : order.id)}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${C.line}`, color: C.muted, borderRadius: 4, padding: "8px 12px", fontSize: 11.5, cursor: "pointer" }}
                >
                  <Send size={13} /> Reply
                </button>
                <button onClick={() => handleRemove(order)} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${C.line}`, color: C.mutedDim, borderRadius: 4, padding: "8px 12px", fontSize: 11.5, cursor: "pointer", marginLeft: "auto" }}>
                  <Trash2 size={13} /> Mark done
                </button>
              </div>

              {replyOpenId === order.id && (
                <div style={{ marginTop: 10 }}>
                  <textarea
                    value={replyDrafts[order.id] || ""}
                    onChange={(e) => setReplyDrafts((d) => ({ ...d, [order.id]: e.target.value }))}
                    rows={3}
                    placeholder={`e.g. "Yours is ready — I'll bring it to school tomorrow" or "Can you clarify the color?"`}
                    style={{ width: "100%", background: C.bg, border: `1px solid ${C.line}`, borderRadius: 4, color: C.text, padding: 10, fontSize: 12.5, resize: "vertical", outline: "none", marginBottom: 8 }}
                  />
                  <button
                    onClick={() => handleSendReply(order)}
                    disabled={!(replyDrafts[order.id] || "").trim()}
                    style={{
                      background: (replyDrafts[order.id] || "").trim() ? C.accent : C.line,
                      color: (replyDrafts[order.id] || "").trim() ? "#1A0D06" : C.mutedDim,
                      border: "none", borderRadius: 4, padding: "8px 14px", fontSize: 11.5, fontWeight: 700,
                      cursor: (replyDrafts[order.id] || "").trim() ? "pointer" : "default",
                    }}
                  >
                    Send reply
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
let uid = 1;
export default function FormeOrders() {
  useEffect(() => { document.title = SITE_NAME; }, []);
  const [view, setView] = useState("order"); // "order" | "owner"
  const [isStudent, setIsStudent] = useState(null); // null | true | false
  const [mode, setMode] = useState("custom"); // "custom" | "mystery"
  const [items, setItems] = useState([{ id: uid++, description: "", qty: 1 }]);
  const [mysteryQty, setMysteryQty] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [color, setColor] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const addItem = () => setItems((it) => [...it, { id: uid++, description: "", qty: 1 }]);
  const removeItem = (id) => setItems((it) => (it.length > 1 ? it.filter((i) => i.id !== id) : it));
  const updateItem = (id, field, value) =>
    setItems((it) => it.map((i) => (i.id === id ? { ...i, [field]: value } : i)));

  const validItems = items.filter((i) => i.description.trim());
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit =
    isStudent !== null && name.trim() && emailValid && color &&
    (mode === "custom" ? validItems.length > 0 : mysteryQty >= 1);

  const orderSummary = () =>
    (mode === "mystery"
      ? `Mystery item  (x${mysteryQty})`
      : validItems.map((i, idx) => `${idx + 1}. ${i.description}  (x${i.qty || 1})`).join("\n")
    ) + `\n\nColor: ${color}`;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    // one unified list, whether custom or mystery, each with its own spec
    // baked in now so it's reproducible later from the owner panel
    const orderItems =
      mode === "mystery"
        ? Array.from({ length: mysteryQty }, () => ({
            description: "Mystery item", qty: 1, spec: randomMysterySpec(),
          }))
        : validItems.map((it) => ({
            description: it.description, qty: it.qty || 1, spec: parseDescription(it.description),
          }));

    const order = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
      isStudent, mode, color, name, email, items: orderItems,
    };
    // Await this — mailto navigation right after a fire-and-forget save can
    // interrupt the write before it lands, which is why an order could go
    // out by email but never show up in the Owner panel.
    try {
      await api.createOrder(order);
    } catch {
      // still let the order proceed even if the panel save fails —
      // the email is the fallback record in that case
    }

    if (isStudent) {
      // notify the owner — no file, they'll print & hand it over at school
      const subject = encodeURIComponent(`New print order — ${name}`);
      const body = encodeURIComponent(
        `New order from ${name} (${SCHOOL_NAME}, in person pickup — collect $1 on handoff)\nEmail: ${email}\n\nItems:\n${orderSummary()}\n\n— sent from the ${SITE_NAME} order page`
      );
      window.location.href = `mailto:${OWNER_EMAIL}?subject=${subject}&body=${body}`;
    } else {
      // generate + download a file per item, staggered slightly so browsers
      // don't block back-to-back auto-downloads, then open the customer's
      // own email client so they can attach the file(s) and send to themselves
      orderItems.forEach((it, idx) => {
        setTimeout(() => {
          const { group } = buildModel(it.spec);
          downloadSTL(group, `${name}-${it.description.slice(0, 20)}`.replace(/[^a-z0-9-]/gi, "_"));
        }, idx * 400);
      });
      const subject = encodeURIComponent(`Your 3D print files — ${name}`);
      const body = encodeURIComponent(
        `Hi ${name},\n\nYour model file(s) just downloaded to this device. Attach them here before sending, then print with your own 3D printer.\n\nOrder:\n${orderSummary()}\n\n— ${SITE_NAME}`
      );
      setTimeout(() => {
        window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
      }, orderItems.length * 400 + 200);
    }
    setSubmitted(true);
  };

  const reset = () => {
    setIsStudent(null);
    setMode("custom");
    setItems([{ id: uid++, description: "", qty: 1 }]);
    setMysteryQty(1);
    setName(""); setEmail(""); setColor(""); setSubmitted(false);
  };

  if (view === "owner") {
    return <OwnerPanel onExit={() => setView("order")} />;
  }

  if (submitted) {
    return (
      <div className="ff-mono" style={{ minHeight: "100vh", background: C.bg, color: C.text, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <FontLoader />
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <CheckCircle2 size={40} color={C.green} style={{ marginBottom: 16 }} />
          <div className="ff-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Order sent</div>
          {isStudent ? (
            <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.7 }}>
              Your order went out by email. I'll print it myself and hand it to you at {SCHOOL_NAME} — 
              I'll reach out by email to confirm when it's ready. <strong style={{ color: C.text }}>$1 due when I hand it over.</strong>
            </p>
          ) : (
            <>
              <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.7 }}>
                Your model file(s) downloaded to this device, and an email draft opened so you can
                attach and send them to yourself.
              </p>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 12, marginTop: 14, textAlign: "left" }}>
                <AlertTriangle size={16} color={C.accent} style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>
                  You'll need your own 3D printer to print this file.
                </span>
              </div>
            </>
          )}
          <button onClick={reset} style={{ marginTop: 22, background: "transparent", border: `1px solid ${C.line}`, color: C.muted, borderRadius: 4, padding: "10px 18px", fontSize: 12, cursor: "pointer" }}>
            Place another order
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ff-mono" style={{ minHeight: "100vh", background: C.bg, color: C.text }}>
      <FontLoader />
      <div style={{ borderBottom: `1px solid ${C.line}`, padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="ff-display" style={{ fontSize: 22, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 10, height: 10, background: C.accent, borderRadius: 2 }} />
          {SITE_NAME.toUpperCase()}
        </div>
        <button onClick={() => setView("owner")} style={{ background: "none", border: "none", color: C.mutedDim, fontSize: 11, cursor: "pointer", letterSpacing: "0.04em" }}>
          Owner
        </button>
      </div>

      <div style={{ maxWidth: 920, margin: "0 auto", padding: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }} className="forme-grid">
        {/* LEFT: form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: C.accent, letterSpacing: "0.08em", marginBottom: 8 }}>ARE YOU AT {SCHOOL_NAME.toUpperCase()}?</div>
            <div style={{ display: "flex", gap: 10 }}>
              {[["Yes", true], ["No", false]].map(([label, val]) => (
                <button
                  key={label}
                  onClick={() => setIsStudent(val)}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 4, fontSize: 13, fontWeight: 700, cursor: "pointer",
                    border: `1px solid ${isStudent === val ? C.accent : C.line}`,
                    background: isStudent === val ? C.accent : "transparent",
                    color: isStudent === val ? "#1A0D06" : C.muted,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {isStudent === true && (
              <div style={{ display: "flex", gap: 8, marginTop: 10, fontSize: 11.5, color: C.mutedDim, alignItems: "flex-start" }}>
                <AlertTriangle size={13} color={C.accent} style={{ flexShrink: 0, marginTop: 1 }} />
                $1 due in person when I hand it over.
              </div>
            )}
            {isStudent === false && (
              <div style={{ display: "flex", gap: 8, marginTop: 10, fontSize: 11.5, color: C.mutedDim, alignItems: "flex-start" }}>
                <AlertTriangle size={13} color={C.accent} style={{ flexShrink: 0, marginTop: 1 }} />
                You'll get the file by email — you'll need your own 3D printer to print it.
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: 11, color: C.accent, letterSpacing: "0.08em", marginBottom: 8 }}>WHAT DO YOU WANT?</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              {[["custom", "Describe it"], ["mystery", "🎁 Mystery"]].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setMode(val)}
                  style={{
                    flex: 1, padding: "9px 0", borderRadius: 4, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                    border: `1px solid ${mode === val ? C.accent : C.line}`,
                    background: mode === val ? C.accent : "transparent",
                    color: mode === val ? "#1A0D06" : C.muted,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "mystery" ? (
              <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4, padding: 18, textAlign: "center" }}>
                <Gift size={26} color={C.accent} style={{ marginBottom: 8 }} />
                <div style={{ fontSize: 12.5, color: C.text, marginBottom: 4 }}>Surprise me</div>
                <div style={{ fontSize: 11, color: C.mutedDim, lineHeight: 1.6, marginBottom: 12 }}>
                  I'll pick what to make — you won't know until it's in your hands.
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: C.muted }}>How many</span>
                  <input
                    type="number" min={1} max={20} value={mysteryQty}
                    onChange={(e) => setMysteryQty(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ width: 56, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 4, color: C.text, padding: "6px 8px", fontSize: 12.5, outline: "none", textAlign: "center" }}
                  />
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {items.map((it, idx) => (
                    <div key={it.id} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4, padding: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 10.5, color: C.mutedDim }}>ITEM {idx + 1}</span>
                        {items.length > 1 && (
                          <button onClick={() => removeItem(it.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.mutedDim }}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                      <textarea
                        value={it.description}
                        onChange={(e) => updateItem(it.id, "description", e.target.value)}
                        rows={2}
                        placeholder="e.g. a small vase with a narrow neck, 70mm"
                        style={{ width: "100%", background: C.bg, border: `1px solid ${C.line}`, borderRadius: 4, color: C.text, padding: 8, fontSize: 12.5, resize: "vertical", outline: "none", marginBottom: 8 }}
                      />
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: C.muted }}>Qty</span>
                        <input
                          type="number" min={1} max={20} value={it.qty}
                          onChange={(e) => updateItem(it.id, "qty", Math.max(1, parseInt(e.target.value) || 1))}
                          style={{ width: 56, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 4, color: C.text, padding: "6px 8px", fontSize: 12.5, outline: "none" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={addItem} style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px dashed ${C.line}`, color: C.muted, borderRadius: 4, padding: "8px 12px", fontSize: 12, cursor: "pointer" }}>
                  <Plus size={13} /> Add another item
                </button>
              </>
            )}
          </div>

          <div>
            <div style={{ fontSize: 11, color: C.accent, letterSpacing: "0.08em", marginBottom: 8 }}>COLOR</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{
                    padding: "8px 14px", borderRadius: 4, fontSize: 12.5, cursor: "pointer",
                    border: `1px solid ${color === c ? C.accent : C.line}`,
                    background: color === c ? C.accent : "transparent",
                    color: color === c ? "#1A0D06" : C.muted, fontWeight: color === c ? 700 : 400,
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: C.accent, letterSpacing: "0.08em", marginBottom: 8 }}>YOUR INFO</div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name"
              style={{ width: "100%", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4, color: C.text, padding: "10px 12px", fontSize: 13, outline: "none", marginBottom: 8 }} />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email"
              style={{
                width: "100%", background: C.panel,
                border: `1px solid ${email.trim() && !emailValid ? "#D9534F" : C.line}`,
                borderRadius: 4, color: C.text, padding: "10px 12px", fontSize: 13, outline: "none",
              }} />
            {email.trim() && !emailValid && (
              <div style={{ fontSize: 11, color: "#D9534F", marginTop: 6 }}>
                Enter a real email address — that's where your order gets sent.
              </div>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              background: canSubmit ? C.accent : C.line, color: canSubmit ? "#1A0D06" : C.mutedDim,
              border: "none", borderRadius: 4, padding: "13px 16px", fontSize: 13, fontWeight: 700,
              cursor: canSubmit ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <Send size={15} /> {isStudent
              ? "SEND ORDER"
              : mode === "mystery" ? "SEND ME A MYSTERY FILE" : "GENERATE & EMAIL ME THE FILE"}
          </button>
        </div>

        {/* RIGHT: live preview */}
        <div>
          <div style={{ fontSize: 11, color: C.accent, letterSpacing: "0.08em", marginBottom: 8 }}>PREVIEW</div>
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4, overflow: "hidden", height: 300 }}>
            {mode === "mystery" ? (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <Gift size={40} color={C.accent} />
                <div style={{ fontSize: 12, color: C.mutedDim, letterSpacing: "0.04em" }}>NO PEEKING</div>
              </div>
            ) : (
              <Preview items={items} />
            )}
          </div>
          <div style={{ fontSize: 10.5, color: C.mutedDim, lineHeight: 1.6, marginTop: 10 }}>
            {mode === "mystery"
              ? "Mystery orders skip the preview on purpose — that's the surprise."
              : `Keyword-based generator — try gear, vase, phone stand, keychain, box with lid, hollow tube, bracket, star, pyramid, ring, cone, cylinder, sphere, or block. Add a size ("60mm") or a word like "small" / "large".`}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 760px) {
          .forme-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
