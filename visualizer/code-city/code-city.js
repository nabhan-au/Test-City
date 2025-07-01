import * as three from 'three';
import $ from 'jquery';

var houseMargin = 0.005; //min margin in percent
const textureLoader = new three.TextureLoader();
const fireTexture = textureLoader.load('fire-preview-2.png');

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

function codeCity(d3, element, rawData, params) {
  var canvas = d3.select(element);

  var data = generateTreemap(d3, rawData, params);

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
  var maximumHeight;
  var minimumHeight;

  function isFile(path) {
    return typeof path === "string" && /\.\w+$/.test(path) || false;
  }

  function addFireWithWindows(faces, totalFire, windowCounts, totalWindows, cube, gw, gh, gd) {
    let firesPerFace = {};
    let fractions = [];
    let assigned = 0;
    faces.forEach(face => {
      const exact = totalFire * windowCounts[face] / totalWindows;
      firesPerFace[face] = Math.floor(exact);
      assigned += firesPerFace[face];
      fractions.push({face, fraction: exact - firesPerFace[face]});
    });

    let remainder = totalFire - assigned;
    fractions.sort((a, b) => b.fraction - a.fraction); // descending by fraction
    for (let i = 0; i < remainder; i++) {
      firesPerFace[fractions[i].face]++;
    }
    faces.forEach(face => {
      createWindowsOnBuilding(cube, gw, gh, gd, face, firesPerFace[face]);
    });
  }

  function addHouse(d) {
    let is_building = isFile(d.key);
    let is_mutant = d.data?.mutations?.coverage > 0 && d.data?.mutations?.total_mutation > 0;
    let is_leaf_mutant = is_mutant && (d.children?.length ?? 0) < 1;

    var unitHeight = 5 / 1000;
    var w = 1000;
    var h = 1000;
    var gw = Math.max(0, (d.dx - 2 * houseMargin) * w) / 500;
    var gh = Math.max(0, (d.dy - 2 * houseMargin) * h) / 500;
    var baseHeight = Math.sqrt((d.height - minimumHeight) / (maximumHeight - minimumHeight));
    var gd = unitHeight * (d.children ? 0.05 : baseHeight) * 130.0;

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

    const faces = ['front', 'back', 'left', 'right']
      if (is_building) {
        if (!is_leaf_mutant) {
          faces.forEach(face => {
            createWindowsOnBuilding(cube, gw, gh, gd, face);
          });
        } else {
          const windows = calculateTotalWindows(gw, gh, gd, faces)
          const totalWindows = windows.totalWindows
          const windowCounts = windows.windowCounts
          const totalFire = d.data.mutations.total_mutation - d.data.mutations.killed

          if (totalWindows < 1) {
            return
          }
          // Make it available for user to choose if possible
          const fireExceedWindowLimit = totalFire - totalWindows
          const totalFireOnWindow = Math.min(totalFire, totalWindows)
          addFireWithWindows(faces, totalFireOnWindow, windowCounts, totalWindows, cube, gw, gh, gd);
          // if (fireExceedWindowLimit > 0) {
          //
          // }
        }
    }


    // if (is_leaf_mutant) {
      // const fireCount = Math.ceil(5 * Math.min(1, d.data.mutations.coverage)); // 0–5 fires
      // const textureLoader = new three.TextureLoader();
      // const fireTexture = textureLoader.load('fire.png');

      // const faces = ['front', 'back', 'left', 'right'];

      // for (let i = 0; i < fireCount; i++) {
      //   const face = faces[i % faces.length]; // distribute fires across sides

      //   const spriteMaterial = new three.SpriteMaterial({
      //     map: fireTexture,
      //     transparent: true,
      //     depthWrite: false,
      //   });

      //   const sprite = new three.Sprite(spriteMaterial);
      //   sprite.scale.set(0.1, 0.1, 1);

      //   const verticalOffset = (Math.random() - 0.5) * gd * 0.8;
      //   const horizontalOffset = (Math.random() - 0.5);

      //   let pos = new three.Vector3();

      //   switch (face) {
      //     case 'front':
      //       pos.set(horizontalOffset * gw * 0.8, gh / 2 + 0.011, verticalOffset);
      //       break;
      //     case 'back':
      //       pos.set(horizontalOffset * gw * 0.8, -gh / 2 - 0.011, verticalOffset);
      //       break;
      //     case 'left':
      //       pos.set(-gw / 2 - 0.011, verticalOffset, horizontalOffset * gd * 0.8);
      //       break;
      //     case 'right':
      //       pos.set(gw / 2 + 0.011, verticalOffset, horizontalOffset * gd * 0.8);
      //       break;
      //   }

      //   sprite.position.copy(pos);
      //   sprite.userData.isMutantFire = true;
      //   sprite.d = d;
      //   cube.add(sprite);
      // }
    // }

    if (!rootHouse) {
      rootHouse = cube;
      rootHouse.rotation.z = Math.PI / 4;
    }
  }

  function calculateTotalWindows(width, height, depth, faces) {
    const margin = 0.02; // spacing from edges
    const spacingX = 0.07;
    const spacingY = 0.07;
    let totalWindow = 0
    let windowCounts = {}

    for (const face of faces) {
      const availableWidth = face === 'front' || face === 'back' ? width : height;
      const availableHeight = depth;
      const maxCols = Math.floor((availableWidth - margin * 2) / spacingX);
      const maxRows = Math.floor((availableHeight - margin * 2) / spacingY);
      totalWindow += maxRows * maxCols
      windowCounts[face] = maxRows * maxCols
    }
    return {
      "totalWindows": totalWindow,
      "windowCounts": windowCounts,
    }
  }

  function createWindowsOnBuilding(building, width, height, depth, face = 'front', fire = 0) {
    const windowSize = 0.05;
    const margin = 0.02; // spacing from edges
    const spacingX = 0.07;
    const spacingY = 0.07;

    const windowColors = [0x222222, 0xffffcc, 0xfff2a0];

    // Compute how many columns and rows fit
    const availableWidth = face === 'front' || face === 'back' ? width : height;
    const availableHeight = depth;

    const maxCols = Math.floor((availableWidth - margin * 2) / spacingX);
    const maxRows = Math.floor((availableHeight - margin * 2) / spacingY);
    const totalWindows = maxCols * maxRows

    if (maxCols < 1 || maxRows < 1) return;

    let fireWindowIndices = [];
    if (fire > 0 && fire <= totalWindows) {
      // Create an array of all indices
      const allIndices = Array.from({ length: totalWindows }, (_, idx) => idx);
      // Shuffle array
      for (let i = allIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allIndices[i], allIndices[j]] = [allIndices[j], allIndices[i]];
      }
      // Pick the first 'fire' indices
      fireWindowIndices = allIndices.slice(0, fire);
    }

    let windowIdx = totalWindows - 1;
    for (let i = 0; i < maxRows; i++) {
      for (let j = 0; j < maxCols; j++) {
        const windowGeometry = new three.PlaneGeometry(windowSize, windowSize);
        const windowMaterial = new three.MeshBasicMaterial({
          color: windowColors[1],
          transparent: true,
          opacity: 0.6,
          depthWrite: false,
        });

        const windowMesh = new three.Mesh(windowGeometry, windowMaterial);

        const offsetX = -((maxCols - 1) * spacingX) / 2 + j * spacingX;
        const offsetY = -((maxRows - 1) * spacingY) / 2 + i * spacingY;

        let pos = new three.Vector3();
        let rot = new three.Euler();

        switch (face) {
          case 'front':
            pos.set(offsetX, height / 2 + 0.005, offsetY);
            rot.set(-Math.PI / 2, 0, 0);
            break;
          case 'back':
            pos.set(offsetX, -height / 2 - 0.005, offsetY);
            rot.set(Math.PI / 2, 0, Math.PI);
            break;
          case 'right':
            pos.set(-width / 2 - 0.005, offsetX, offsetY);
            rot.set(-Math.PI / 2, -Math.PI / 2, 0);
            break;
          case 'left':
            pos.set(width / 2 + 0.005, offsetX, offsetY);
            rot.set(-Math.PI / 2, Math.PI / 2, 0);
            break;
        }

        if (fireWindowIndices.includes(windowIdx)) {
          windowMesh.userData.firePercentage = fire/totalWindows * 100
          windowMesh.userData.isWindowMutantFire = true
        }

        windowMesh.position.copy(pos);
        windowMesh.rotation.copy(rot);
        building.add(windowMesh);

        if (fireWindowIndices.includes(windowIdx)) {
          const fireGeometry = new three.PlaneGeometry(windowSize * 0.9, windowSize * 1.3);
          const fireMaterial = new three.MeshBasicMaterial({
            map: fireTexture,
            transparent: true,
            depthWrite: true
          });

          const fireMesh = new three.Mesh(fireGeometry, fireMaterial);
          fireMesh.position.copy(pos);

          // Move fire above the window (adjust direction based on face)
          fireMesh.position.z += 0.005;

          switch (face) {
          case 'front':
            fireMesh.position.x -= 0.005;
            fireMesh.position.y += 0.005;
            break;
          case 'back':
            fireMesh.position.x += 0.005;
            fireMesh.position.y -= 0.005;
            break;
          case 'right':
            fireMesh.position.y -= 0.005;
            fireMesh.position.x -= 0.005;
            break;
          case 'left':
            fireMesh.position.y += 0.005;
            fireMesh.position.x += 0.005;
            break;
        }

          fireMesh.rotation.copy(rot);
          fireMesh.rotateZ(Math.PI);
          fireMesh.userData.isMutantFire = true;
          building.add(fireMesh);
        }
        windowIdx--
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
      if (rawHit.material.uniforms?.glow !== undefined) {
        hitMesh = rawHit;
      } else if (
        rawHit.parent?.material?.uniforms?.glow !== undefined
      ) {
        hitMesh = rawHit.parent;
      }

      if (hitMesh) {
        if (intersected && intersected !== hitMesh) {
          intersected.material.uniforms.glow.value = 1.0;
          intersected.material.needsUpdate = true;
        }

        intersected = hitMesh;
        intersected.material.uniforms.glow.value = 1.4;
        intersected.material.needsUpdate = true;

        selectedD = hitMesh.d;
        params.legend?.onMouseover(selectedD, event);
        render();
      }
    }
    else if (intersected) {
      intersected.material.uniforms.glow.value = 1.0;
      intersected.material.needsUpdate = true;
      params.legend?.onMouseout(selectedD, event);
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
      params.legend.onMouseout(selectedD);
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

  data.forEach(findExtremes);

  data.forEach(addHouse);

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

  // function toggleSpheres(show) {
  //   scene.traverse(obj => {
  //     if (obj.userData?.isMutantSphere) {
  //       obj.visible = show;
  //     }
  //   });
  //   render();
  // }

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

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  return {
    getCameraRotation: getCameraRotation,
    setCameraRotation: setCameraRotation,
    setCameraBirdEyeView: setCameraBirdEyeView,
    setCameraNormalView: setCameraNormalView,
    getCameraPitch: getCameraPitch,
    setCameraPitch: setCameraPitch,
    toggleSpheres: toggleSpheres,
    toggleRedWindow: toggleRedWindow,
  };
}

export {
  codeCity,
  generateTreemap
};