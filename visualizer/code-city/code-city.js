import * as three from 'three';
import * as progressive from './progressive-brick-layout'
import $ from 'jquery';

var houseMargin = 0.001; //min margin in percent

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
  // TODO: remove with actual data
  let cubeIdSeq = 1;
  var canvas = d3.select(element);

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

  var renderer;
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
            gapXY: normalized_block_size*0.25,
            unitH: normalized_block_size,
            margin: -0.005
          });
        }
      // }
    }

    if (!rootHouse) {
      rootHouse = cube;
      rootHouse.rotation.z = Math.PI / 4;
    }
  }

  function createMutantStacksOnRoofRingCubes(building, gw, gh, gd, killed, survivors, noCoverage, d, opts = {}) {
    const margin = opts.margin ?? 0.02;
    const cubeW = opts.cubeW ?? 0.06;  // cube width (X direction)
    const cubeD = opts.cubeD ?? 0.06;  // cube depth (Y direction)
    const gapXY = opts.gapXY ?? 0.012;
    const gapZ = opts.gapZ ?? 0.005;
    const unitH = opts.unitH ?? 0.03;
    const roofLift = 0.006;

    const spacingX = cubeW + (opts.gapXY);
    const spacingY = cubeD + (opts.gapXY);
    const cols = Math.max(0, Math.floor((gw - margin * 2) / spacingX));
    const rows = Math.max(0, Math.floor((gh - margin * 2) / spacingY))

    if (cols <= 0 || rows <= 0) return;

    // perimeter cells only
    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const onRing = (r === 0 || r === rows - 1 || c === 0 || c === cols - 1);
        if (onRing) cells.push([r, c]);
      }
    }
    const capacity = cells.length;
    if (capacity === 0) return;

    // distribution across perimeter cells
    const distribute = (N) => {
      const arr = new Array(capacity).fill(0);
      for (let i = 0; i < Math.max(0, N); i++) arr[i % capacity] += 1;
      return arr;
    };

    const killedPerCell = distribute(killed);
    const survivorsPerCell = distribute(survivors);
    const noCoveragePerCell = distribute(noCoverage);

    // cube size with horizontal/vertical gaps
    const blockX = Math.max(0.01, spacingX - gapXY);
    const blockY = Math.max(0.01, spacingY - gapXY);
    const blockZ = Math.max(0.01, unitH);

    const whiteMat = new three.MeshPhongMaterial({ color: 0xffffff });
    const redMat = new three.MeshPhongMaterial({ color: 0xcc2b2b });
    const greyMat = new three.MeshPhongMaterial({ color: 0x888888  });
    const killedMutation = []
    const survivedMutation = []
    const noCoverageMutation = []
    
    const mutationCases = d.data.mutations.details.details
    for (let i = 0; i < mutationCases.length; i++) {
      const mutation = mutationCases[i]
      switch (mutation.status) {
        case "NO_COVERAGE":
          noCoverageMutation.push(mutation)
          break
        case "RUN_ERROR":
          survivedMutation.push(mutation)
        case "KILLED":
          killedMutation.push(mutation)
          break
        case "TIMED_OUT":
          killedMutation.push(mutation)
          break
        case "SURVIVED":
          survivedMutation.push(mutation)
          break
        default:
          console.log("Mutation not fall in any case", mutation)
      }
    }

    const parentD = building.d || null;
    for (let i = 0; i < capacity; i++) {
      const [r, c] = cells[i];
      const k = killedPerCell[i];
      const s = survivorsPerCell[i];
      const n = noCoveragePerCell[i]
      const total = k + s + n;
      if (!total) continue;

      const cellCenterX = -((cols - 1) * spacingX) / 2 + c * spacingX;
      const cellCenterY = -((rows - 1) * spacingY) / 2 + r * spacingY;

      for (let h = 0; h < total; h++) {
        let mat = null;
        let currentMutation = null

        if (h >= k && h < k + s) {
          // Case when mutation is survived
          mat = redMat
          currentMutation = survivedMutation.shift()
        } else if (h >= k + s) {
          // Case when mutation is no coverage
          mat = greyMat
          currentMutation = noCoverageMutation.shift()
        } else {
          // Case when mutation is killed
          mat = whiteMat;
          currentMutation = killedMutation.shift()
        }

        const geom = new three.BoxGeometry(cubeW, cubeD, blockZ);
        const mesh = new three.Mesh(geom, mat);

        const z = gd / 2 + roofLift + (blockZ + gapZ) * h + blockZ / 2;
        mesh.position.set(cellCenterX, cellCenterY, z);

        mesh.userData.isMutantStack = true;
        mesh.userData.kind = currentMutation.status;
        mesh.userData.parentPath = parentD?.path || parentD?.key || '';
        mesh.userData.parentTitle = parentD?.title || '';
        mesh.userData.description = currentMutation.description
        mesh.userData.methodName = currentMutation.method_name
        mesh.userData.methodLine = currentMutation.line_number
        mesh.userData.tests = currentMutation.tests

        building.add(mesh);
      }
    }
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
    var angleRad = Math.PI / 4;

    camera.position.set(0, 0, 5);

    // camera.up = new three.Vector3(0, 1, 0);
    camera.up.set(Math.sin(angleRad), Math.cos(angleRad), 0);

    camera.lookAt(new three.Vector3(0, 0, 0));
    render();
  };

  var setCameraNormalView = function () {
    setCameraRotation(cameraAngle);
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
  }

  function setMargin(newMargin) {
    currentMargin = newMargin;

    // recompute layout
    if (isProgressiveLayout) {
      [data, normalized_block_size] = progressive.calculate_area(rawData, currentMargin);
    } else {
      normalized_block_size = 0.05;
      data = generateTreemap(d3, rawData, params);
    }

    // reset per-build state
    maximumHeight = 250;
    minimumHeight = 0.005;
    rootHouse = null;

    clearScene();
    addLights();
    buildHouses();

    setCameraRotation(cameraAngle);
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

    setCameraRotation(cameraAngle);
    render();
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
    setRawData: setRawData
  };
}

export {
  codeCity,
  generateTreemap
};