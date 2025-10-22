import * as codeCity from './code-city';
import * as progressive from './progressive-brick-layout.js'
import $ from 'jquery';
import { legend } from '../common/legend.js';
import * as dataLoaders from '../data/loaders.js';
import * as dataHelpers from '../data/helpers.js';

const d3 = window.d3;

var params = (new URL(document.location)).searchParams;
let globalMargin = 0.2;
let isDragging = false;
var codeCityChart;
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

const rotateBtns = $('#rotate-left, #rotate-right, #rotate-up, #rotate-down');
const zoomBtns = $('#zoom-in, #zoom-out');
var rotateLeftSpan = $('#rotate-left');
var rotateRightSpan = $('#rotate-right');
var rotateUpSpan = $('#rotate-up');
var rotateDownSpan = $('#rotate-down');
var zoomInSpan = $('#zoom-in');
var zoomOutSpan = $('#zoom-out');
var panLeftBtn = $('#pan-left');
var panRightBtn = $('#pan-right');
var birdEyeToggle = $('#toggle-bird-eye');
var sphereToggle = $('#toggle-spheres');
var marginSlider = $('#margin-slider');
var marginValueDisplay = $('#margin-value');
var viewModeSelect = $('#view-mode');
const chartBox = $('#code-city-chart');

var nodeColorScale = [
    '#ffd700', // golden yellow
    '#ffdb33',
    '#ffdf66',
    '#ffe399',
    '#ffe6b3',
    '#ffeccc',
    '#b3e5ff',
    '#99dbff',
    '#80d1ff',
    '#66c7ff',
    '#4dbdff',
    '#3399ff',
    '#1a75ff'  // deeper sky blue
]

let gridValue;
let rawData

function legendTitle(d, e) {
    return d.path;
}

function legendContent(d, e) {
    const lines = d.data?.lines || { coverage: 0, covered_line: 0, total_line: 0 };
    const mutations = d.data?.mutations || { coverage: 0, killed: 0, total_mutation: 0 };
    const tests = d.data?.testCount || 0;
    const reportPath = d.data?.report_path || "";
    const reportUrl = reportPath
        ? `//${window.location.hostname}:9000/pit-reports/${reportPath}`
        : "#";

    return `
      <div class="bg-white text-gray-800 p-4 rounded-lg shadow-md">
        <table class="w-full text-sm">
          <tbody>
            <tr class="bg-gray-50">
              <td class="py-1">Lines coverage (%)</td>
              <td class="py-1 text-right">${lines.coverage.toFixed(2)}</td>
            </tr>
            <tr>
              <td class="py-1">Lines covered</td>
              <td class="py-1 text-right">${lines.covered_line} / ${lines.total_line}</td>
            </tr>
            <tr class="bg-gray-50">
              <td class="py-1">Mutations coverage (%)</td>
              <td class="py-1 text-right">${mutations.coverage.toFixed(2)}</td>
            </tr>
            <tr>
              <td class="py-1">Mutations killed</td>
              <td class="py-1 text-right">${mutations.killed} / ${mutations.total_mutation}</td>
            </tr>
            <tr>
              <td class="py-1">Total distinct tests</td>
              <td class="py-1 text-right">${tests}</td>
            </tr>
          </tbody>
        </table>
        ${reportPath
            ? `
          <div class="flex justify-left mt-5 items-center mt-3">
            <a href="${reportUrl}" target="_blank" rel="noopener noreferrer"
               class="inline-flex items-center bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-md hover:bg-blue-700 active:scale-[0.97] transition-all duration-150">
              Open Report
            </a>
          </div>
          `
            : ""
        }
      </div>
    `;
}

function nodeHeight(d) {
    if (heightMode === 'trace') {
        const v = d?.data?.traces?.average;
        return (typeof v === 'number' && isFinite(v) && v > 1) ? v : 1;
    } else if (heightMode === 'test-count') {
        const tc = d?.data?.testCount;
        const v = tc * window.__heightNorm.normValue
        return(typeof v === 'number' && isFinite(v) && v > 1) ? v : 1;
    }
    // default: LOC total lines
    const tl = d?.data?.lines?.total_line;
    return (typeof tl === 'number' && isFinite(tl) && tl > 1) ? tl : 1;
}


window.__heightNorm = window.__heightNorm || { normValue: 1, maxTestCounts: 1000 };

function computePercentile(arr, p) {
    if (!arr || arr.length === 0) return 1;
    const a = [...arr].sort((x, y) => x - y);
    const idx = Math.floor((p / 100) * (a.length - 1));
    return a[idx];
}

function computeNormalizeValue(merged) {
    const filtered = Object.fromEntries(
        Object.entries(merged).filter(([key, value]) => {
            return key.endsWith('.java');
        })
    );
    const vals = Object.values(filtered || {})
        .map(v => v?.testCount ?? 0)
        .filter(n => typeof n === 'number' && isFinite(n) && n >= 0);
    const maxTestCount = Math.max(...vals)
    return Math.min(1, window.__heightNorm.maxTestCounts/maxTestCount);
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
        path: function (d) {
            return d.key || '(all files)';
        }
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
    let maxValue = 0;
    for (const [key, module] of Object.entries(d)) {
        for (const [filePath, value] of Object.entries(module)) {
            const averageTrace = value["average_block_trace"]
            const loc = value["total_executable_lines"]
            maxValue = Math.max(averageTrace, loc, maxValue);
        }

    }
    if (maxValue > 1000000)
        gridValue = 10000;
    else if (maxValue > 100000)
        gridValue = 1000;
    else if (maxValue > 10000)
        gridValue = 100;
    else if (maxValue > 1000)
        gridValue = 10;
    else if (maxValue > 100)
        gridValue = 1;
    else
        gridValue = 0.1;
}

// Call fetchData asynchronously
fetchData().then(function (d) {
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
        const darkGray = 100; // deep platforms   -> darker gray

        (function walk(n) {
            if (!n) return;

            const isLeaf = !n.children || n.children.length === 0;

            if (!isLeaf) {
                const t = (n.depth || 0) / maxDepth;
                const g = lerp(lightGray, darkGray, t);
                const hex = `#${toHexByte(g)}${toHexByte(g)}${toHexByte(g)}`;
                n.color = hex;
            }

            if (n.children) n.children.forEach(walk);
        })(root);
    }

    function splitModules(modules, selection) {
        const selectedKeys = (!selection || selection.length === 0)
            ? Object.keys(modules)
            : selection;

        const result = {};
        for (const key of selectedKeys) {
            if (modules[key]) {
                for (const [className, value] of Object.entries(modules[key])) {
                    result[className] = value;
                }
            }
        }
        return result;
    }

    if (d === null) {
        $('#project-description').text("Failed to load project data.");
        return;
    }

    setGridValue(d);
    d = splitModules(d, [])
    var mergedData = {};
    window.__mergedDataForHeightSwitch = mergedData;

    for (const [filePath, data] of Object.entries(d)) {
        const normalizedPath = filePath.startsWith('/') ? filePath : '/' + filePath;
        const filePaths = normalizedPath.split('/');

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
                let reportPath = ""
                let details = []
                if (currentPath.endsWith(".java")) {
                    reportPath = data.report_path
                    details = data.mutation
                }

                mergedData[currentPath] = {
                    lines: { coverage: 0, covered_line: 0, total_line: 0 },
                    mutations: { coverage: 0, killed: 0, no_coverage: 0, total_mutation: 0, details: details },
                    traces: { total_trace: 0, total_block: 0, average: 0 },
                    tests: new Set(),
                    report_path: reportPath
                };

            }
            mergedData[currentPath].lines.covered_line += data.line_coverage.total_covered_lines
            mergedData[currentPath].lines.total_line += data.line_coverage.total_executable_lines;
            mergedData[currentPath].lines.coverage = mergedData[currentPath].lines.total_line === 0 ? 0
                : (mergedData[currentPath].lines.covered_line / mergedData[currentPath].lines.total_line) * 100;

            mergedData[currentPath].mutations.killed += data.mutation.effective_killed;
            mergedData[currentPath].mutations.total_mutation += data.mutation.total_mutations;
            mergedData[currentPath].mutations.coverage =
                mergedData[currentPath].mutations.total_mutation === 0 ? 0
                    : (mergedData[currentPath].mutations.killed / mergedData[currentPath].mutations.total_mutation) * 100;
            mergedData[currentPath].mutations.no_coverage += data.mutation.no_coverage;
            mergedData[currentPath].tests = new Set([...mergedData[currentPath].tests, ...data.tests])
            mergedData[currentPath].testCount = mergedData[currentPath].tests.size
        }
    }

    window.__heightNorm.normValue = computeNormalizeValue(mergedData);
    var treeData = dataHelpers.convertToTree(mergedData, mapperParams);

    dataHelpers.colorize(d3, treeData, 'colorValue', nodeColorScale, { min: 20, max: 100 });

    applyLeafPaletteAndPlatformGray(treeData);

    codeCityChart = codeCity.codeCity(d3, $('#code-city-chart')[0], treeData, graphParams, globalMargin);

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

    function setRotateEnabled(enabled) {
        rotateBtns.prop('disabled', !enabled);
        rotateBtns.toggleClass('opacity-50 cursor-not-allowed', !enabled);
    }
    setRotateEnabled(true);
    function setZoomEnabled(enabled) {
        zoomBtns.prop('disabled', !enabled);
        zoomBtns.toggleClass('opacity-50 cursor-not-allowed', !enabled);
    }
    setZoomEnabled(true);

    const ensureNormalView = () => {
        if (viewModeSelect.val() !== 'normal') {
            viewModeSelect.val('normal').trigger('change');
        }
    };

    rotateLeftSpan.on('mousedown', function () {
        if (birdEyeToggle.is(':checked')) {
            birdEyeToggle.prop('checked', false).trigger('change');
        }

        startRotate(false);
    });
    rotateLeftSpan.on('mouseup mouseleave', function () {
        stopRotate();
    });

    rotateRightSpan.on('mousedown', function () {
        if (birdEyeToggle.is(':checked')) {
            birdEyeToggle.prop('checked', false).trigger('change');
        }

        startRotate(true);
    });
    rotateRightSpan.on('mouseup mouseleave', function () {
        stopRotate();
    });
    rotateUpSpan.on('mousedown', function () {
        if (birdEyeToggle.is(':checked')) {
            birdEyeToggle.prop('checked', false).trigger('change');
        }
        startRotatePitch(true);
    });
    rotateUpSpan.on('mouseup mouseleave', function () {
        stopRotatePitch();
    });
    rotateDownSpan.on('mousedown', function () {
        if (birdEyeToggle.is(':checked')) {
            birdEyeToggle.prop('checked', false).trigger('change');
        }
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
        heightMode = this.value; // 'loc' or 'trace' or 'test-count'

        const merged = window.__mergedDataForHeightSwitch;

        if (heightMode === 'test-count') {
            window.__heightNorm.normValue = computeNormalizeValue(merged, 95);
        }

        const newTree = dataHelpers.convertToTree(merged, mapperParams);

        dataHelpers.colorize(d3, newTree, 'colorValue', nodeColorScale, { min: 20, max: 100 });
        applyLeafPaletteAndPlatformGray(newTree);

        rawData = newTree;
        if (codeCityChart?.setRawData) {
            codeCityChart.setRawData(newTree);
        }
    });

    function ensure2DView() {
        if (viewModeSelect.val() !== '2d') {
            viewModeSelect.val('2d').trigger('change');
        }
    }

    panLeftBtn.on('mousedown', function () {
        ensure2DView();
        codeCityChart.startPan2D(-1);
    });
    panLeftBtn.on('mouseup mouseleave', function () {
        codeCityChart.stopPan2D();
    });

    panRightBtn.on('mousedown', function () {
        ensure2DView();
        codeCityChart.startPan2D(1);
    });
    panRightBtn.on('mouseup mouseleave', function () {
        codeCityChart.stopPan2D();
    });


    function isNormalView() {
        return viewModeSelect.length ? viewModeSelect.val() === 'normal' : true;
    }

    function setDragEnabled(enabled) {
        chartBox.toggleClass('cursor-grab', enabled);
        chartBox.toggleClass('cursor-not-allowed', !enabled);
    }
    setDragEnabled(true);

    function setPanButtonsEnabled(enabled) {
        panLeftBtn.prop('disabled', !enabled).toggleClass('opacity-50 cursor-not-allowed', !enabled);
        panRightBtn.prop('disabled', !enabled).toggleClass('opacity-50 cursor-not-allowed', !enabled);
    }
    setPanButtonsEnabled(false);

    viewModeSelect.on('change', function () {
        const mode = this.value; // 'normal'|'bird'|'2d'
        setRotateEnabled(mode === 'normal');
        setDragEnabled(mode === 'normal');

        if (mode === 'bird') {
            setPanButtonsEnabled(false);
            setZoomEnabled(true);
            codeCityChart.setLinearLayout(false);
            codeCityChart.setCameraBirdEyeView();
        } else if (mode === '2d') {
            setPanButtonsEnabled(true);
            setZoomEnabled(false);
            codeCityChart.setLinearLayout(true);
            codeCityChart.setCamera2DView();
        } else {
            setPanButtonsEnabled(false);
            setZoomEnabled(true);
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

    for (const [key, data] of Object.entries(d)) {
        totalLines += data.line_coverage.total_executable_lines || 0;
        totalCoveredLines += data.line_coverage.total_covered_lines || 0;
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
        <li>Total Java Files: <strong>${totalFiles}</strong></li>
        <li>Total Executable Lines: <strong>${totalLines}</strong></li>
        <li>Lines Covered: <strong>${totalCoveredLines}</strong></li>
        <li>Coverage: <strong>${coveragePercent}%</strong></li>
    </ul>
`);

});