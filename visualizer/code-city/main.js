import * as codeCity from './code-city';
import * as progressive from './progressive-brick-layout.js'
import $ from 'jquery';
import { legend } from '../common/legend.js';
import * as dataLoaders from '../data/loaders.js';
import * as dataHelpers from '../data/helpers.js';

const d3 = window.d3;

var params = (new URL(document.location)).searchParams;
let globalMargin = 0.5;
let isDragging = false;
var codeCityChart;
var rawData;
// 'go-jsonnet'


async function fetchData() {
    try {
        var data = await dataLoaders.fetchProjectData(params.get('project'));
        return data;
    } catch (error) {
        return null;
    }
}

var metric = 'lines';
var classes = 'classes';
var trace = 'traces';
let heightMode = 'loc'; // 'loc' | 'trace'

var legendDiv = $('#code-city-legend')[0];
var heightMetricSelect = $('#height-metric');

const rotateZoomBtns = $('#rotate-left, #rotate-right, #rotate-up, #rotate-down, #zoom-in, #zoom-out');
var rotateLeftSpan = $('#rotate-left');
var rotateRightSpan = $('#rotate-right');
var rotateUpSpan = $('#rotate-up');
var rotateDownSpan = $('#rotate-down');
var zoomInSpan = $('#zoom-in')
var zoomOutSpan = $('#zoom-out')
var birdEyeToggle = $('#toggle-bird-eye');
var sphereToggle = $('#toggle-spheres');
var marginSlider = $('#margin-slider');
var marginValueDisplay = $('#margin-value');
var viewModeSelect = $('#view-mode');
const chartBox = $('#code-city-chart');

var nodeColorScale = [
    // '#ffffcc', // very low — pale yellow
    '#ffeda0',
    '#fed976',
    '#feb24c',
    '#fd8d3c',
    '#fc4e2a',
    '#e31a1c', // mid — warm balance
    '#bd0026',
    '#800026',
    '#6baed6',
    '#5392c0',
    // '#4292c6',
    // '#2171b5',
    // '#08519c',
    // '#08306b', // high — deep blue
]

let gridValue;

function legendTitle(d, e) {
    return d.path;
}

function legendContent(d, e) {
    const lines = d.data?.lines || { coverage: 0, covered_line: 0, total_line: 0 };
    const mutations = d.data?.mutations || { coverage: 0, killed: 0, total_mutation: 0 };
    const traces = d.data?.traces || { average: 0 };

    return `
      <div class="bg-white text-gray-800 p-4 rounded-lg shadow-md">
        <table class="w-full text-sm">
          <tbody>
            <tr class="bg-gray-50">
              <td class="py-1">Lines coverage (%)</td>
              <td class="py-1 text-right">${lines.coverage}</td>
            </tr>
            <tr>
              <td class="py-1">Lines covered</td>
              <td class="py-1 text-right">${lines.covered_line} / ${lines.total_line}</td>
            </tr>
            <tr class="bg-gray-50">
              <td class="py-1">Mutations coverage (%)</td>
              <td class="py-1 text-right">${mutations.coverage}</td>
            </tr>
            <tr>
              <td class="py-1">Mutations killed</td>
              <td class="py-1 text-right">${mutations.killed} / ${mutations.total_mutation}</td>
            </tr>
            <tr>
              <td class="py-1">Average trace</td>
              <td class="py-1 text-right">${traces.average}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
}

function nodeHeight(d) {
    if (heightMode === 'trace') {
        const v = d?.data?.traces?.average;
        return (typeof v === 'number' && isFinite(v)) ? v : 0;
    }
    // default: LOC total lines
    const tl = d?.data?.lines?.total_line;
    return (typeof tl === 'number' && isFinite(tl)) ? tl : 0;
}

function nodeColor(d) {
    var coverage = d?.data?.[metric]?.coverage;

    if (typeof coverage === 'undefined' || isNaN(coverage)) {
        coverage = 0;
    }

    return d.data[metric].coverage;
}

function nodeArea(d) {
    return d.data[metric].total_line;
}



var graphParams = {
    legend: legend(legendDiv, legendTitle, legendContent)
};

var mapperParams = {
    mappers: {
        height: nodeHeight,
        area: nodeArea,
        colorValue: nodeColor,
        title: function (d) { return d.key.split('/').slice(-1)[0]; },
        path: function (d) { return d.key || '(all files)'; }
    },
    split: function (key) {
        var components = key.split('/');
        if (components.length > 1) {
            components = components.filter(function (c) { return c !== ""; });
        }
        return components;
    }
};

function setGridValue(d) {
    let maxTrace = 0;
    for (const [key, value] of Object.entries(d)) {
        const [filePath, data] = Object.entries(value)[0];

        if (data[metric].total_line) {
            maxTrace = Math.max(data[metric].total_line, maxTrace);
        }
    }
    if (maxTrace > 1000000)
        gridValue = 10000;
    else if (maxTrace > 100000)
        gridValue = 1000;
    else if (maxTrace > 10000)
        gridValue = 100;
    else if (maxTrace > 1000)
        gridValue = 10;
    else if (maxTrace > 100)
        gridValue = 1;
    else
        gridValue = 0.1;
}

// Call fetchData asynchronously
fetchData().then(function (d) {
    if (d === null) {
        $('#project-description').text("Failed to load project data.");
        return;
    }

    setGridValue(d);
    var mergedData = {};
    window.__mergedDataForHeightSwitch = mergedData;

    for (const [key, value] of Object.entries(d)) {
        const [filePath, data] = Object.entries(value)[0];
        const filePaths = filePath.split('/');

        // root ""
        let currentPath = "";

        for (let i = 0; i < filePaths.length; i++) {
            if (i === 0 && filePaths[i] === "") {
                // root
                currentPath = "";
            } else {
                // build the path
                currentPath += "/" + filePaths[i];
            }

            // if not found, init
            if (!mergedData[currentPath]) {
                mergedData[currentPath] = {
                    lines: { coverage: 0, covered_line: 0, total_line: 0 },
                    mutations: { coverage: 0, killed: 0, total_mutation: 0 },
                    traces: { total_trace: 0, total_block: 0, average: 0 }
                };
            }

            mergedData[currentPath].lines.covered_line += data.lines.covered_line;
            mergedData[currentPath].lines.total_line += data.lines.total_line;
            mergedData[currentPath].lines.coverage = (mergedData[currentPath].lines.covered_line / mergedData[currentPath].lines.total_line) * 100;

            mergedData[currentPath].mutations.killed += data.mutations.killed;
            mergedData[currentPath].mutations.total_mutation += data.mutations.total_mutation;
            mergedData[currentPath].mutations.coverage = (mergedData[currentPath].mutations.killed / mergedData[currentPath].mutations.total_mutation) * 100;

            mergedData[currentPath].traces.total_trace += data.traces.total_trace;
            mergedData[currentPath].traces.total_block += data.traces.total_block;
            mergedData[currentPath].traces.average = mergedData[currentPath].traces.total_trace / mergedData[currentPath].traces.total_block;
        }
    }
    var treeData = dataHelpers.convertToTree(mergedData, mapperParams);
    dataHelpers.colorize(d3, treeData, 'colorValue', nodeColorScale, { min: 20, max: 100 });

    // compute maxDepth
    function computeMaxDepth(root) {
        let maxD = 0;
        (function walk(n) {
            if (!n) return;
            maxD = Math.max(maxD, n.depth || 0);
            if (n.children) n.children.forEach(walk);
        })(root);
        return Math.max(1, maxD); // avoid division by zero
    }

    // convert an integer 0..255 to two-digit hex
    function toHexByte(v) {
        const n = Math.max(0, Math.min(255, Math.round(v)));
        return n.toString(16).padStart(2, '0');
    }

    // linear interpolation
    function lerp(a, b, t) { return a + (b - a) * t; }

    // apply color override
    function applyLeafPaletteAndPlatformGray(root) {
        const maxDepth = computeMaxDepth(root);

        // gray range
        const lightGray = 200; // shallow platforms -> lighter gray
        const darkGray  =  100; // deep platforms   -> darker gray

        (function walk(n) {
            if (!n) return;

            const isLeaf = !n.children || n.children.length === 0;

            if (!isLeaf) {
            const t = (n.depth || 0) / maxDepth;
            const g = lerp(lightGray, darkGray, t);
            const hex = `#${toHexByte(g)}${toHexByte(g)}${toHexByte(g)}`;
            n.color = hex;
            } else {
            if (!n.color) {
                const cov = n.data?.[metric]?.coverage ?? 0;
                const idx = Math.round((Math.max(0, Math.min(100, cov)) / 100) * (nodeColorScale.length - 1));
                n.color = nodeColorScale[idx];
            }
            }

            if (n.children) n.children.forEach(walk);
        })(root);
    }

    applyLeafPaletteAndPlatformGray(treeData);

    // progressive.calculate_area(treeData)
    rawData = treeData;
    codeCityChart = codeCity.codeCity(d3, $('#code-city-chart')[0], treeData, graphParams, globalMargin);
    // try {
        
    // } catch (e) {
    //     if (e instanceof TypeError)
    //         $('#code-city-chart').html("\
    //             <div> \
    //             <img src=\"../assets/images/code_city_large.png\" width=\"100%\"> \
    //             <p style=\"background:rgba(255,0,0,0.7); top:300px; position:absolute; font-size:18px;\" class=\"alert alert-danger\"> \
    //                 It seems that your browser does not support (or has deactivated) WebGL, which is required for this graph. Please upgrade your browser or make sure that WebGL is activated. Below is a teaser of what the visualization of your project might look like. \
    //             </p> \
    //             </div> \
    //             ");
    // }

    // sphereToggle.prop('checked', true);
    // codeCityChart.toggleSpheres(true)
    // codeCityChart.toggleMutants(true);

    var isRotating = false;

    var startRotate = function (left) {
        if (isRotating)
            return;

        isRotating = true;

        var rotate = function () {
            if (!isRotating)
                return;

            codeCityChart.setCameraRotation(
                codeCityChart.getCameraRotation() + (left ? 0.01 : -0.01)
            );

            setTimeout(rotate, 10);
        };

        rotate();
    };

    var stopRotate = function () {
        isRotating = false;
    };

    var isRotatingPitch = false;

    var startRotatePitch = function (up) {
        if (isRotatingPitch)
            return;

        isRotatingPitch = true;

        var rotate = function () {
            if (!isRotatingPitch)
                return;

            const pitch = codeCityChart.getCameraPitch();
            codeCityChart.setCameraPitch(pitch + (up ? 0.01 : -0.01));

            setTimeout(rotate, 10);
        };

        rotate();
    };

    var stopRotatePitch = function () {
        isRotatingPitch = false;
    };

    function setRotateZoomEnabled(enabled) {
        rotateZoomBtns.prop('disabled', !enabled);
        rotateZoomBtns.toggleClass('opacity-50 cursor-not-allowed', !enabled);
    }
    setRotateZoomEnabled(true);

    const ensureNormalView = () => {
        if (viewModeSelect.val() !== 'normal') {
            viewModeSelect.val('normal').trigger('change');
        }
    };

    rotateLeftSpan.on('mousedown', function () {
        ensureNormalView();
        startRotate(false);
    });
    rotateLeftSpan.on('mouseup mouseleave', function () {
        stopRotate();
    });

    rotateRightSpan.on('mousedown', function () {
        ensureNormalView();
        startRotate(true);
    });
    rotateRightSpan.on('mouseup mouseleave', function () {
        stopRotate();
    });
    rotateUpSpan.on('mousedown', function () {
        ensureNormalView();
        startRotatePitch(true);
    });
    rotateUpSpan.on('mouseup mouseleave', function () {
        stopRotatePitch();
    });
    rotateDownSpan.on('mousedown', function () {
        ensureNormalView();
        startRotatePitch(false);
    });
    rotateDownSpan.on('mouseup mouseleave', function () {
        stopRotatePitch();
    });
    zoomInSpan.on('mousedown', function () {
        codeCityChart.onZoomIn()
    });
    zoomOutSpan.on('mousedown', function () {
        codeCityChart.onZoomOut()
    });
    birdEyeToggle.on('change', function () {
        if (birdEyeToggle.is(':checked')) {
            codeCityChart.setCameraBirdEyeView();
        } else {
            codeCityChart.setCameraNormalView();
        }
    });
    sphereToggle.on('change', function () {
        codeCityChart.toggleSpheres(sphereToggle.is(':checked'));
        codeCityChart.toggleRedWindow(sphereToggle.is(':checked'));
        codeCityChart.toggleMutants(sphereToggle.is(':checked'));
    });
    marginSlider.on('input', function () {
        globalMargin = parseFloat(this.value);
        marginValueDisplay.text(globalMargin.toFixed(3));
    });

    $('#apply-margin').on('click', function () {
        const val = parseFloat(marginSlider.val());
        globalMargin = val;

        if (codeCityChart && typeof codeCityChart.setMargin === 'function') {
            codeCityChart.setMargin(globalMargin);
        }

        const checked = sphereToggle.is(':checked');
        sphereToggle.prop('checked', checked).trigger('change');
        birdEyeToggle.prop('checked', false).trigger('change');
    });

    heightMetricSelect.on('change', function () {
        heightMode = this.value; // 'loc' or 'trace'

        const merged = window.__mergedDataForHeightSwitch;
        const newTree = dataHelpers.convertToTree(merged, mapperParams);

        dataHelpers.colorize(d3, newTree, 'colorValue', nodeColorScale, { min: 20, max: 100 });
        applyLeafPaletteAndPlatformGray(newTree);

        rawData = newTree;
        if (codeCityChart?.setRawData) {
            codeCityChart.setRawData(newTree);
        }
    });

    function isNormalView() {
        return viewModeSelect.length ? viewModeSelect.val() === 'normal' : true;
    }

    function setDragEnabled(enabled) {
        chartBox.toggleClass('cursor-grab', enabled);
        chartBox.toggleClass('cursor-not-allowed', !enabled);
    }
    setDragEnabled(true); 

    viewModeSelect.on('change', function () {
        const mode = this.value; // 'normal'|'bird'|'2d'
        setRotateZoomEnabled(mode === 'normal');
        setDragEnabled(mode === 'normal');

        if (mode === 'bird') {
            codeCityChart.setLinearLayout(false);
            codeCityChart.setCameraBirdEyeView();
        } else if (mode === '2d') {
            codeCityChart.setLinearLayout(true); 
            codeCityChart.setCamera2DView();     
        } else {
            codeCityChart.setLinearLayout(false);
            codeCityChart.setCameraNormalView();
        }
    });

    // project-description
    const descriptionEl = $('#project-description');

    // Compute basic summary
    const totalFiles = Object.keys(d).length;
    let totalLines = 0;
    let totalCoveredLines = 0;

    for (const [_, value] of Object.entries(d)) {
        const [__, data] = Object.entries(value)[0];
        totalLines += data.lines.total_line || 0;
        totalCoveredLines += data.lines.covered_line || 0;
    }

    const coveragePercent = totalLines > 0 ? ((totalCoveredLines / totalLines) * 100).toFixed(2) : '0.00';

    let lastX = 0, lastY = 0;
    const chartEl = $('#code-city-chart')[0];

    chartEl.addEventListener('mousedown', function (e) {
        if (!isNormalView()) return;     
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
    });

    window.addEventListener('mousemove', function (e) {
        if (!isDragging) return;

        // How much the mouse moved
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;

        // Sensitivity coefficients (adjust as needed)
        const rotateSpeed = 0.0018;
        const pitchSpeed = 0.0018;

        // Update camera
        codeCityChart.setCameraRotation(codeCityChart.getCameraRotation() + dx * rotateSpeed * -1);
        codeCityChart.setCameraPitch(codeCityChart.getCameraPitch() + dy * pitchSpeed);

        lastX = e.clientX;
        lastY = e.clientY;
    });

    window.addEventListener('mouseup', function (e) {
        isDragging = false;
    });

    descriptionEl.html(`
    <ul class="list-disc list-inside text-sm space-y-1">
        <li>Total Files: <strong>${totalFiles}</strong></li>
        <li>Total Lines: <strong>${totalLines}</strong></li>
        <li>Lines Covered: <strong>${totalCoveredLines}</strong></li>
        <li>Coverage: <strong>${coveragePercent}%</strong></li>
    </ul>
`);

});