import * as three from 'three';
import * as progressive from './progressive-brick-layout'
import $ from 'jquery';

var houseMargin = 0.001; //min margin in percent
let roofRingSides = ['north', 'east', 'south', 'west'];

function generateTreemap(d3, data, params) {
  var layout = d3.layout.treemap()
    .size([1.0, 1.0])
    .sticky(true)
    .round(false)
    .padding(4 * houseMargin)
    .value(function (d) { return d.area; });

  return layout.nodes(data).filter(function (d) {
    return Math.min(d.dx, d.dy) > 0.001 * houseMargin;
  });
}

function codeCity(d3, element, rawData, params, margin, isProgressiveLayout = true) {
  var canvas = d3.select(element);
  let houseMeshes = [];
  let linearLayoutEnabled = false;
  let floorEnable = true;

  var data, normalized_block_size = null
  let currentMargin = margin;

  if (isProgressiveLayout) {
    [data, normalized_block_size] = progressive.calculate_area(rawData, currentMargin)
  } else {
    normalized_block_size = 0.05
    data = generateTreemap(d3, rawData, params);
  }

  var width = canvas.node().offsetWidth;
  var height = width;

  var raycaster = new three.Raycaster();
  var scene = new three.Scene();
  var camera = new three.PerspectiveCamera(45.0, width / height, 1.0, 1000);

  if (!window.renderer)
    window.renderer = new three.WebGLRenderer({ alpha: true, antialias: true });
  var renderer = window.renderer;
  var intersected;
  var rootHouse;

  var fragmentShader = " \
varying vec2 vUv; \
varying vec3 vColor; \
varying vec3 pos; \
uniform float glow; \
void main() { \
    float m = 0.8+pos.z*1.0; \
    float d1 = abs(vUv.x-1.0); \
    float d2 = vUv.x; \
    float d3 = abs(vUv.y-1.0); \
    float d4 = vUv.y; \
    float minDistance = min(min(min(d1,d2),d3),d4); \
    float dEdge = 1.0; \
    float treshold = 0.12; \
    float multiplier = 1.05; \
    if (minDistance < treshold) \
        dEdge = multiplier/(1.0+pow(minDistance/treshold+0.01,2.0)*(multiplier-1.0)); \
    m = dEdge*m; \
    m = m*glow; \
    float dPersp = sqrt(pow(vUv.x-1.0,2.0)+pow(vUv.y-1.0,2.0)); \
    m = (1.0+dPersp*0.2)*m; \
    gl_FragColor = vec4(vColor.x*m, vColor.y*m,vColor.z*m ,1.0); \
}";
  var vertexShader = " \
uniform float glow; \
uniform vec3 color; \
varying vec3 vColor; \
varying vec2 vUv; \
varying vec3 pos; \
void main() { \
    vUv = uv; \
    vColor = color; \
    gl_Position = projectionMatrix * \
                  modelViewMatrix * vec4(position, 1.0 ); \
    pos = position; \
} \
";

  var cameraDistance = 3.0;
  var cameraHeight = 1.95;
  var cameraZ = -1.4;
  var cameraPitch = 0.0;
  var cameraAngle = 0.0;
  var maximumHeight = 250;
  var minimumHeight = 0.005;

  let twoDState = null;
  let panRAF = null;

  // --- FOV zoom helpers ---
  const fovLimits = { min: 15, max: 85 };  // tighter min = more zoom-in
  camera.fov = 45;                          // starting FOV
  camera.updateProjectionMatrix();

  function clampFov(v) {
    return Math.max(fovLimits.min, Math.min(fovLimits.max, v));
  }

  function setFov(fov) {
    camera.fov = clampFov(fov);
    camera.updateProjectionMatrix();
    render();
  }

  function getFov() {
    return camera.fov;
  }

  // Optional: normalized zoom (0..1) -> FOV in [min,max]
  function setZoom(normalized) {
    const t = Math.max(0, Math.min(1, normalized));
    const fov = fovLimits.min + (fovLimits.max - fovLimits.min) * (1 - t);
    setFov(fov);
  }

  const zoomStep = 1.1; // multiplier per click

  const onZoomIn = () => {
    setFov(camera.fov / zoomStep); // smaller FOV = zoom in
  };

  const onZoomOut = () => {
    setFov(camera.fov * zoomStep); // bigger FOV = zoom out
  };

  function isFile(path) {
    return typeof path === "string" && /\.\w+$/.test(path) || false;
  }

  function addHouse(d, normalized_block_size = 0.05) {
    let is_building = isFile(d.key);

    var unitHeight = 3 / 1000;
    var w = 1000;
    var h = 1000;
    var gw = Math.max(0, (d.dx - 2 * houseMargin) * w) / 500;
    var gh = Math.max(0, (d.dy - 2 * houseMargin) * h) / 500;
    var baseHeight = Math.sqrt((d.height - minimumHeight) / (maximumHeight - minimumHeight));
    if (isNaN(baseHeight) || !isFinite(baseHeight)) {
      baseHeight = 0;
    }
    var gd = unitHeight * (d.children?.length ? 0.05 : baseHeight) * 130.0;
    var gx = ((d.x + d.dx / 2) * w) / 500 - 1;
    var gy = 1 - ((d.y + d.dy / 2) * h) / 500;
    var gz = d.depth * unitHeight + gd / 2;

    var shaderMaterial = new three.ShaderMaterial({
      fragmentShader: fragmentShader,
      vertexShader: vertexShader,
      uniforms: {
        color: { type: 'c', value: new three.Color(d.color) },
        glow: { type: 'f', value: 1.0 },
      }
    });

    var geometry = new three.BoxGeometry(gw, gh, gd);
    var cube = new three.Mesh(geometry, shaderMaterial);

    cube.position.x = gx;
    cube.position.y = gy;
    cube.position.z = gz;

    cube.userData.origPos = cube.position.clone();
    cube.userData.isHouse = true;

    cube.castShadow = true;
    cube.receiveShadow = true;

    cube.d = d;

    var objToAdd = rootHouse || scene;
    objToAdd.add(cube);

    if (is_building) {
      const totalMut = (d?.data?.mutations?.total_mutation || 0);
      const killed = (d?.data?.mutations?.killed || 0);
      const noCoverage = (d?.data?.mutations?.no_coverage || 0)
      const survivors = Math.max(0, totalMut - killed - noCoverage);
      if (totalMut > 0) {
        createMutantStacksOnRoofRingCubes(cube, gw, gh, gd, killed, survivors, noCoverage, d, {
          cubeW: normalized_block_size,
          cubeD: normalized_block_size,
          gapXY: normalized_block_size * 0.25,
          unitH: normalized_block_size,
          margin: -0.005
        },
          roofRingSides
        );
      }
      houseMeshes.push(cube);
    }

    if (!rootHouse) {
      rootHouse = cube;
      rootHouse.rotation.z = Math.PI / 4;
    }
  }

  function createMutantStacksOnRoofRingCubes(
    building, gw, gh, gd,
    killed, survivors, noCoverage,
    d,
    opts = {},
    sides = ['north', 'east', 'south', 'west']
  ) {
    const margin = opts.margin ?? 0.02;
    const cubeW = opts.cubeW ?? 0.06;     // width (X)
    const cubeD = opts.cubeD ?? 0.06;     // depth (Y)
    const gapXY = opts.gapXY ?? 0.012;
    const gapZ = opts.gapZ ?? 0.005;
    const unitH = opts.unitH ?? 0.03;
    const roofLift = 0.006;

    // spacing between cell centers
    const spacingX = cubeW + gapXY;
    const spacingY = cubeD + gapXY;

    // grid (in "cell space") that fits the roof after margins
    const cols = Math.max(0, Math.floor((gw - margin * 2) / spacingX));
    const rows = Math.max(0, Math.floor((gh - margin * 2) / spacingY));
    if (cols <= 0 || rows <= 0) return;

    // normalize requested sides (PRESERVE CALLER ORDER)
    const toCells = {
      north: () => {
        const out = [];
        for (let c = 0; c < cols; c++) out.push([0, c]);
        return out;
      },
      south: () => {
        const out = [];
        for (let c = 0; c < cols; c++) out.push([rows - 1, c]);
        return out;
      },
      west: () => {
        const out = [];
        for (let r = 1; r < Math.max(1, rows - 1); r++) out.push([r, 0]);
        return out;
      },
      east: () => {
        const out = [];
        for (let r = 1; r < Math.max(1, rows - 1); r++) out.push([r, cols - 1]);
        return out;
      }
    };

    const ring = [];
    const safeSides = (Array.isArray(sides) && sides.length) ? sides : ['north', 'east', 'south', 'west'];
    for (const s of safeSides) {
      const fn = toCells[String(s).toLowerCase()];
      if (fn) ring.push(...fn());
    }
    if (!ring.length) return;

    const cap = ring.length;

    // materials
    const whiteMat = new three.MeshPhongMaterial({ color: 0xffffff }); // NO_COVERAGE
    const redMat = new three.MeshPhongMaterial({ color: 0xcc2b2b }); // SURVIVED/RUN_ERROR
    const greyMat = new three.MeshPhongMaterial({ color: 0x888888 }); // KILLED/TIMED_OUT/MEMORY_ERROR

    const killedMutation = [];
    const survivedMutation = [];
    const noCoverageMutation = [];
    const mutationCases = d?.data?.mutations?.details?.details || [];
    for (const m of mutationCases) {
      switch (m.status) {
        case 'NO_COVERAGE': noCoverageMutation.push(m); break;
        case 'SURVIVED':
        case 'RUN_ERROR': survivedMutation.push(m); break;
        case 'KILLED':
        case 'TIMED_OUT':
        case 'MEMORY_ERROR': killedMutation.push(m); break;
        default: break;
      }
    }

    // helper to pop a metadata object for a kind
    function takeMutation(kind) {
      if (kind === 'KILLED') return killedMutation.shift() || null;
      if (kind === 'SURVIVED') return survivedMutation.shift() || null;
      if (kind === 'NO_COVERAGE') return noCoverageMutation.shift() || null;
      return null;
    }

    const parentD = building.d || null;

    // helpers: convert cell index to local roof coordinates (centered)
    const cellCenterX = c => -((cols - 1) * spacingX) / 2 + c * spacingX;
    const cellCenterY = r => -((rows - 1) * spacingY) / 2 + r * spacingY;

    // ---- GROUPED-BY-KIND, STILL FLOOR-FILLING (no gaps) ----
    const useSpheres = (opts?.shape === 'sphere');
    const blockZ = Math.max(0.01, unitH);
    const sphereRadius = Math.min(cubeW, cubeD) * 0.5;
    const verticalStep = useSpheres ? (sphereRadius * 2 + gapZ) : (blockZ + gapZ);
    const baseTop = gd / 2 + roofLift;

    let placed = 0;

    const placeKind = (kind, count, mat, popMeta) => {
      for (let i = 0; i < count; i++) {
        const cellIndex = placed % cap;
        const level = Math.floor(placed / cap);

        const [r, c] = ring[cellIndex];
        const x = cellCenterX(c);
        const y = cellCenterY(r);

        const geom = useSpheres
          ? new three.SphereGeometry(sphereRadius, 16, 12)
          : new three.BoxGeometry(cubeW, cubeD, blockZ);

        const mesh = new three.Mesh(geom, mat);

        const z = baseTop + verticalStep * level + (useSpheres ? 0 : blockZ / 2);
        mesh.position.set(x, y, z);

        // metadata
        const meta = popMeta?.() || null;
        mesh.userData.isMutantStack = true;
        mesh.userData.kind = meta?.status || kind;
        if (meta) {
          mesh.userData.description = meta.description;
          mesh.userData.methodName = meta.method_name;
          mesh.userData.methodLine = meta.line_number;
          mesh.userData.tests = meta.tests;
        }
        mesh.userData.parentPath = parentD?.path || parentD?.key || '';
        mesh.userData.parentTitle = parentD?.title || '';

        building.add(mesh);
        placed++;
      }
    };

    placeKind('NO_COVERAGE', noCoverage, whiteMat, () => noCoverageMutation.shift() || null);
    placeKind('SURVIVED', survivors, redMat, () => survivedMutation.shift() || null);
    placeKind('KILLED', killed, greyMat, () => killedMutation.shift() || null);
  }

  function setRoofRingSides(sides) {
    roofRingSides = (Array.isArray(sides) && sides.length)
      ? sides.map(s => s.toLowerCase())
      : ['north', 'east', 'south', 'west'];

    maximumHeight = 250;
    minimumHeight = 0.005;
    rootHouse = null;
    houseMeshes = [];

    clearScene();
    addLights();
    buildHouses();

    setCameraRotation(cameraAngle);
    setFloorVisible(floorEnable);
    render();
  }

  function render() {
    renderer.render(scene, camera);
  }

  function animate() {
    requestAnimationFrame(animate);
  }

  var selectedD;

  function onCanvasMouseMove(event) {
    event.preventDefault();

    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new three.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
      const rawHit = intersects[0].object;

      let hitMesh = null;
      if (rawHit.userData?.isMutantStack) {
        hitMesh = rawHit;
      } else if (rawHit.material?.uniforms?.glow !== undefined) {
        hitMesh = rawHit;
      } else if (rawHit.parent?.material?.uniforms?.glow !== undefined) {
        hitMesh = rawHit.parent;
      }

      if (hitMesh) {
        if (intersected && intersected !== hitMesh) {
          if (intersected.material?.uniforms?.glow) {
            intersected.material.uniforms.glow.value = 1.0;
            intersected.material.needsUpdate = true;
          } else if (intersected.userData?.isMutantStack) {
            intersected.scale.set(1, 1, 1);
          }
        }

        intersected = hitMesh;

        if (hitMesh.material?.uniforms?.glow) {
          intersected.material.uniforms.glow.value = 1.4;
          intersected.material.needsUpdate = true;
          selectedD = hitMesh.d;
        } else if (hitMesh.userData?.isMutantStack) {
          intersected.scale.set(1.15, 1.15, 1.15);
          selectedD = {
            isMutant: true,
            cubeId: hitMesh.userData.cubeId,
            methodName: hitMesh.userData.methodName,
            methodLine: hitMesh.userData.methodLine,
            description: hitMesh.userData.description,
            kind: hitMesh.userData.kind,
            parentPath: hitMesh.userData.parentPath,
            parentTitle: hitMesh.userData.parentTitle,
            tests: hitMesh.userData.tests
          };
        }

        // params.legend?.onMouseover(selectedD, event);
        render();
      }
    } else if (intersected) {
      if (intersected.material?.uniforms?.glow) {
        intersected.material.uniforms.glow.value = 1.0;
        intersected.material.needsUpdate = true;
      } else if (intersected.userData?.isMutantStack) {
        intersected.scale.set(1, 1, 1);
      }
      // params.legend?.onMouseout(selectedD, event);
      intersected = null;
      selectedD = undefined;
      render();
    }
  }

  function onCanvasMouseClick(e) {
    e.preventDefault();
    if (params.legend)
      params.legend.onClick(selectedD, e);
  }

  renderer.setSize(width, height);
  renderer.setClearColor(0x222222, 1);
  renderer.shadowMapEnabled = true;

  canvas.node().appendChild(renderer.domElement);

  var directionalLight = new three.DirectionalLight(0xFFFFFF, 1.0);
  directionalLight.position.set(-5, -10, 15);
  directionalLight.castShadow = true;
  directionalLight.shadowCameraNear = 0.01;
  directionalLight.shadowCameraFar = 20;
  directionalLight.shadowCameraRight = 1.5;
  directionalLight.shadowCameraLeft = -1.5;
  directionalLight.shadowCameraTop = 1.5;
  directionalLight.shadowCameraBottom = -1.5;
  directionalLight.shadowDarkness = 0.5;

  scene.add(directionalLight);

  // add subtle ambient lighting
  var ambientLight = new three.AmbientLight(0x313131);
  scene.add(ambientLight);

  renderer.domElement.addEventListener('mousemove', onCanvasMouseMove, false);
  renderer.domElement.addEventListener('click', onCanvasMouseClick, false);

  var canvasDiv = $('#code-city-canvas');
  canvasDiv.on('mouseleave', function () {
    if (params.legend && selectedD) {
      // params.legend.onMouseout(selectedD);
      selectedD = undefined;
    }
  });

  var findExtremes = function (d) {
    if (d.children)
      return;
    if (d.height > maximumHeight || maximumHeight === undefined)
      maximumHeight = d.height;
    if (d.height < minimumHeight || minimumHeight === undefined)
      minimumHeight = d.height;
  }

  function buildHouses() {
    data.forEach(findExtremes);
    data.forEach((d, idx) => {
      // (hotfix)
      if (idx === 0) {
        const deepCopy = JSON.parse(JSON.stringify(d));
        deepCopy.x = 0.5; deepCopy.y = 0.5;
        deepCopy.dx = 0.0000000001; deepCopy.dy = 0.0000000001;
        addHouse(deepCopy, normalized_block_size);
      }
      addHouse(d, normalized_block_size);
    });
    if (linearLayoutEnabled) applyLinearLayout();
  }
  buildHouses();

  render();
  animate();

  var distance = 500.0;
  var maxHeight = -20.0;
  var maxDistance = distance;
  var distanceAngle = 10.0;

  var flyBy = function () {
    var acceleration = Math.pow((maxDistance - distance) / maxDistance, 2.0);
    distance -= 0.01 + 32.0 * (1.0 - acceleration);
    var height = distance / maxDistance * maxHeight;
    distanceAngle = distance * 0.1;

    camera.position.set(-(distance + cameraDistance) * Math.cos(distanceAngle + cameraAngle), -(distance + cameraDistance) * Math.sin(distanceAngle + cameraAngle), height + cameraHeight);
    camera.up = new three.Vector3(0, 0, 1);
    camera.lookAt(new three.Vector3(0, 0, 0));

    render();
    if (distance > 0)
      setTimeout(flyBy, 10);
  };

  flyBy();

  var setCameraRotation = function (angle) {
    cameraAngle = angle;

    var dynamicCameraHeight = 2;

    camera.position.set(
      -cameraDistance * Math.cos(cameraAngle),
      -cameraDistance * Math.sin(cameraAngle),
      dynamicCameraHeight + Math.sin(cameraPitch) * cameraDistance
    );
    camera.up = new three.Vector3(0, 0, 1);
    camera.lookAt(new three.Vector3(0, 0, 0));
    render();
  };

  var getCameraRotation = function () {
    return cameraAngle;
  }

  var setCameraBirdEyeView = function () {
    setRoofRingSides(['north', 'east', 'south', 'west']);
    var angleRad = Math.PI / 4;

    camera.position.set(0, 0, 5);

    // camera.up = new three.Vector3(0, 1, 0);
    camera.up.set(Math.sin(angleRad), Math.cos(angleRad), 0);

    camera.lookAt(new three.Vector3(0, 0, 0));
    setFloorVisible(true);
    removeAllDirection2DLights();
    render();
  };

  var setCameraNormalView = function () {
    setRoofRingSides(['north', 'east', 'south', 'west']);
    setCameraRotation(cameraAngle);
    setFloorVisible(true);
    removeAllDirection2DLights();
  };

  var getCameraPitch = function () {
    return cameraPitch;
  };

  var setCameraPitch = function (pitch) {
    var maxPitch = Math.PI / 2 - 0.1;
    var minPitch = -Math.PI / 2 + 0.1;

    cameraPitch = Math.max(minPitch, Math.min(maxPitch, pitch));
    setCameraRotation(cameraAngle);
  };

  function resizeCanvas() {
    const container = document.getElementById('code-city-canvas');
    const size = container.clientWidth;
    camera.aspect = size / size;
    camera.updateProjectionMatrix();
    renderer.setSize(size, size);
    render();
  }

  function toggleSpheres(show) {
    scene.traverse(obj => {
      if (obj.userData?.isMutantFire) {
        obj.visible = show;
      }
    });
    render();
  }

  function toggleRedWindow(show) {
    scene.traverse(obj => {
      if (obj.userData?.isWindowMutantFire) {
        if (show) {
          const fire_percentage = obj.userData.firePercentage
          if (fire_percentage < 33) {
            obj.material.color.set(0xFFEC02)
          } else if (fire_percentage < 66) {
            obj.material.color.set(0xFF7102)
          } else {
            obj.material.color.set(0xF30101)
          }
          obj.transparent = false

        } else {
          obj.material.color.set(0xffffcc)
        }
      }
      else {
        // console.log("Not show")
      }
    });
    render();
  }

  function toggleMutants(show) {
    scene.traverse(obj => {
      // Roof cubes
      if (obj.userData?.isMutantStack) {
        obj.visible = show;
      }
      // Fire sprites
      if (obj.userData?.isMutantFire) {
        obj.visible = show;
      }
      // Windows tint
      if (obj.userData?.isWindowMutantFire) {
        if (show) {
          const p = obj.userData.firePercentage ?? 0;
          if (p < 33) obj.material.color.set(0xFFEC02);
          else if (p < 66) obj.material.color.set(0xFF7102);
          else obj.material.color.set(0xF30101);
          obj.transparent = false;
        } else {
          obj.material.color.set(0xffffcc);
          obj.transparent = true;
        }
      }
    });
    render();
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function addLights() {
    const directionalLight = new three.DirectionalLight(0xFFFFFF, 1.0);
    directionalLight.position.set(-5, -10, 15);
    directionalLight.castShadow = true;
    directionalLight.shadowCameraNear = 0.01;
    directionalLight.shadowCameraFar = 20;
    directionalLight.shadowCameraRight = 1.5;
    directionalLight.shadowCameraLeft = -1.5;
    directionalLight.shadowCameraTop = 1.5;
    directionalLight.shadowCameraBottom = -1.5;
    directionalLight.shadowDarkness = 0.5;
    scene.add(directionalLight);

    const ambientLight = new three.AmbientLight(0x313131);
    scene.add(ambientLight);
  }

  function clearScene() {
    // dispose geometries/materials
    scene.traverse(obj => {
      if (obj.isMesh) {
        obj.geometry?.dispose?.();
        // ShaderMaterial / MeshPhongMaterial etc.
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose?.());
          else obj.material.dispose?.();
        }
      }
    });
    // remove children
    while (scene.children.length) scene.remove(scene.children[0]);
    houseMeshes = [];
  }

  function setMargin(newMargin) {
    currentMargin = newMargin;

    const prePos = camera.position.clone();
    const preUp = camera.up.clone();
    const preFov = camera.fov;
    const preDir = new three.Vector3();
    camera.getWorldDirection(preDir);
    const preTarget = prePos.clone().add(preDir);

    if (isProgressiveLayout) {
      [data, normalized_block_size] = progressive.calculate_area(rawData, currentMargin);
    } else {
      normalized_block_size = 0.05;
      data = generateTreemap(d3, rawData, params);
    }

    maximumHeight = 250;
    minimumHeight = 0.005;
    rootHouse = null;
    houseMeshes = [];

    clearScene();
    addLights();
    buildHouses();

    camera.fov = preFov;
    camera.updateProjectionMatrix();
    camera.position.copy(prePos);
    camera.up.copy(preUp);
    camera.lookAt(preTarget);
    setFloorVisible(floorEnable);
    render();
  }

  function setRawData(newRawData) {
    rawData = newRawData;

    if (isProgressiveLayout) {
      [data, normalized_block_size] = progressive.calculate_area(rawData, currentMargin);
    } else {
      normalized_block_size = 0.05;
      data = generateTreemap(d3, rawData, params);
    }

    maximumHeight = 250;
    minimumHeight = 0.005;
    rootHouse = null;

    clearScene();
    addLights();
    buildHouses();

    setFloorVisible(floorEnable);
    render();
  }

  function applyLinearLayout() {
    if (!houseMeshes.length) return;

    // compute total width to center nicely
    const gap = 0.04; // space between buildings
    const widths = houseMeshes.map(m => m.geometry?.parameters?.width || 0.05);
    const totalWidth = widths.reduce((a, b) => a + b, 0) + gap * (houseMeshes.length - 1);

    let cursor = -totalWidth / 2;
    for (let i = 0; i < houseMeshes.length; i++) {
      const m = houseMeshes[i];
      const w = widths[i];

      // set X so each building sits next to the previous one
      m.position.x = cursor + w / 2;
      cursor += w + gap;

      // align along Y to form a "line"; keep Z (height) as-is
      m.position.y = 0;
    }
    render();
  }

  function revertLinearLayout() {
    // restore original positions
    scene.traverse(obj => {
      if (obj.userData?.isHouse && obj.userData?.origPos) {
        obj.position.copy(obj.userData.origPos);
      }
    });
    render();
  }

  function setLinearLayout(enable) {
    linearLayoutEnabled = !!enable;
    if (linearLayoutEnabled) applyLinearLayout();
    else revertLinearLayout();
  }

  const tmpBox = new three.Box3();
  function getRowSphere() {
    if (!houseMeshes || houseMeshes.length === 0) return null;

    const all = new three.Box3();
    let first = true;

    for (const m of houseMeshes) {
      tmpBox.setFromObject(m);
      if (first) { all.copy(tmpBox); first = false; }
      else { all.union(tmpBox); }
    }

    const s = new three.Sphere();
    all.getBoundingSphere(s);
    return s;
  }

  function getRowBounds() {
    if (!houseMeshes || !houseMeshes.length) return null;
    const box = new three.Box3();
    let first = true;
    for (const m of houseMeshes) {
      tmpBox.setFromObject(m);
      if (first) { box.copy(tmpBox); first = false; }
      else { box.union(tmpBox); }
    }
    return box;
  }

  function setCamera2DView(opts = {}) {
    setRoofRingSides(['south']);

    const {
      dir = new three.Vector3(-1, 1, 0),
      padding = 4,
      eyeZ = null,
    } = opts;

    const box = getRowBounds();
    const look = box ? box.getCenter(new three.Vector3()) : new three.Vector3(0, 0, 0);
    const size = box ? box.getSize(new three.Vector3()) : new three.Vector3(1, 1, 1);

    const halfHeight = Math.max(0.001, size.z / 2);
    const halfFovRad = three.MathUtils.degToRad(camera.fov / 2);
    const D = (halfHeight * padding) / Math.tan(halfFovRad);

    const viewDir = dir.clone().normalize();
    const pos = look.clone().addScaledVector(viewDir, D);
    pos.z = eyeZ ? eyeZ : look.z;

    camera.position.copy(pos);
    camera.up.set(0, 0, 1);
    camera.lookAt(look);

    twoDState = {
      look,
      D,
      viewDir,
      bounds: box ?? new three.Box3(
        new three.Vector3(-1, -1, -1),
        new three.Vector3(1, 1, 1)
      ),
    };

    setFloorVisible(false);
    removeAllDirection2DLights();
    addAllDirection2DLights();
    render();
  }

  function pan2D(delta) {
    if (!twoDState) return;
    const { look, bounds, viewDir } = twoDState;

    const lateral = new three.Vector3(-viewDir.y, viewDir.x, 0).normalize();

    const proposed = look.clone().addScaledVector(lateral, delta);

    const clampedX = three.MathUtils.clamp(proposed.x, bounds.min.x, bounds.max.x);
    const clampedY = three.MathUtils.clamp(proposed.y, bounds.min.y, bounds.max.y);

    const appliedDx = clampedX - look.x;
    const appliedDy = clampedY - look.y;

    look.x = clampedX;
    look.y = clampedY;
    camera.position.x += appliedDx;
    camera.position.y += appliedDy;

    camera.lookAt(look);
    render();
  }

  function startPan2D(direction = 1) {
    stopPan2D();
    const speed = 0.02;
    const step = () => {
      pan2D(direction * speed);
      panRAF = requestAnimationFrame(step);
    };
    panRAF = requestAnimationFrame(step);
  }

  function stopPan2D() {
    if (panRAF) {
      cancelAnimationFrame(panRAF);
      panRAF = null;
    }
  }

  function setFloorVisible(show) {
    const isLeaf = (k) => typeof k === 'string' && /\.\w+$/.test(k);

    scene.traverse(obj => {
      if (!obj.isMesh || !obj.userData?.isHouse || !obj.material) return;

      const key = obj.d?.key;
      const leaf = isLeaf(key);

      if (!leaf) {
        obj.material.colorWrite = show;
        obj.material.depthWrite = show;
        obj.material.needsUpdate = true;
      }
    });

    floorEnable = show;
    render();
  }

  function addAllDirection2DLights() {
    const hemi = new three.HemisphereLight(0xffffff, 0x444444, 0.6);
    hemi.position.set(0, 0, 10);
    hemi.userData.is2DLight = true;
    scene.add(hemi);

    const dirs = [
      new three.Vector3(8, 0, 6),
      new three.Vector3(-8, 0, 6),
      new three.Vector3(0, 8, 6),
      new three.Vector3(0, -8, 6),
    ];

    for (const p of dirs) {
      const dl = new three.DirectionalLight(0xffffff, 0.6);
      dl.position.copy(p);
      dl.target.position.set(0, 0, 0);
      dl.userData.is2DLight = true;
      dl.castShadow = false;
      scene.add(dl);
      scene.add(dl.target);
    }
  }

  function removeAllDirection2DLights() {
    const toRemove = [];
    scene.traverse(obj => {
      if ((obj.isLight || obj.isObject3D) && obj.userData?.is2DLight) {
        toRemove.push(obj);
      }
    });
    for (const obj of toRemove) {
      if (obj.target && obj.target.userData?.is2DLight) {
        scene.remove(obj.target);
      }
      scene.remove(obj);
    }
  }

  return {
    getCameraRotation: getCameraRotation,
    setCameraRotation: setCameraRotation,
    setCameraBirdEyeView: setCameraBirdEyeView,
    setCameraNormalView: setCameraNormalView,
    getCameraPitch: getCameraPitch,
    setCameraPitch: setCameraPitch,
    toggleSpheres: toggleSpheres,
    toggleRedWindow: toggleRedWindow,
    toggleMutants: toggleMutants,
    onZoomIn: onZoomIn,
    onZoomOut: onZoomOut,
    setMargin: setMargin,
    setRawData: setRawData,
    setCamera2DView,
    setLinearLayout,
    startPan2D,
    stopPan2D
  };
}

export {
  codeCity,
  generateTreemap
};