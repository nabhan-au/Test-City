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
        console.log(data)
        return data;
    } catch (error) {
        return null;
    }
}

var metric = 'lines';
var classes = 'classes';
var trace = 'traces'

var legendDiv = $('#code-city-legend')[0];

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
    return d.data[metric].total_line;
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
        const darkGray  =  100; // deep platforms   -> darker gray

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

    for (const [filePath, data] of Object.entries(d)) {
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
                    mutations: { coverage: 0, killed: 0, no_coverage: 0, total_mutation: 0 },
                    traces: { total_trace: 0, total_block: 0, average: 0 }
                };
            }
            const covered_line = data.line_coverage.total_executable_lines - data.line_coverage.total_missed_lines
            mergedData[currentPath].lines.covered_line += covered_line
            mergedData[currentPath].lines.total_line += data.line_coverage.total_executable_lines;
            mergedData[currentPath].lines.coverage = mergedData[currentPath].lines.total_line === 0 ? 0
                : (mergedData[currentPath].lines.covered_line / mergedData[currentPath].lines.total_line) * 100;

            mergedData[currentPath].mutations.killed += data.mutation.effective_killed;
            mergedData[currentPath].mutations.total_mutation += data.mutation.total_mutations;
            mergedData[currentPath].mutations.coverage = 
            mergedData[currentPath].mutations.total_mutation === 0 ? 0
                : (mergedData[currentPath].mutations.killed / mergedData[currentPath].mutations.total_mutation) * 100;
            mergedData[currentPath].mutations.no_coverage += data.mutation.no_coverage;
            

            mergedData[currentPath].traces.total_trace += data.total_tests;
            mergedData[currentPath].traces.total_block += data.total_blocks;
            mergedData[currentPath].traces.average = mergedData[currentPath].traces.total_block === 0 ? 0
                : mergedData[currentPath].traces.total_trace / mergedData[currentPath].traces.total_block;

            mergedData[currentPath].mutations.details = data.mutation
        }
    }

    var treeData = dataHelpers.convertToTree(mergedData, mapperParams);
    
    dataHelpers.colorize(d3, treeData, 'colorValue', nodeColorScale, { min: 20, max: 100 });

    applyLeafPaletteAndPlatformGray(treeData);

    // progressive.calculate_area(treeData)
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

    // project-description
    const descriptionEl = $('#project-description');

    // Compute basic summary
    const totalFiles = Object.keys(d).length;
    let totalLines = 0;
    let totalCoveredLines = 0;

    for (const [_, data] of Object.entries(d)) {
        const covered_line = data.line_coverage.total_executable_lines - data.line_coverage.total_missed_lines
        totalLines += data.line_coverage.total_executable_lines || 0;
        totalCoveredLines += covered_line || 0;
    }

    const coveragePercent = totalLines > 0 ? ((totalCoveredLines / totalLines) * 100).toFixed(2) : '0.00';

    let lastX = 0, lastY = 0;
    const chartEl = $('#code-city-chart')[0];

    chartEl.addEventListener('mousedown', function (e) {
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