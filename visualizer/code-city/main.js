import * as codeCity from './code-city';
import $ from 'jquery';
import { legend } from '../common/legend.js';
import * as dataLoaders from '../data/loaders.js';
import * as dataHelpers from '../data/helpers.js';

const d3 = window.d3;

var params = (new URL(document.location)).searchParams;
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

var legendDiv = $('#code-city-legend')[0];
var canvasDiv = $('#code-city-canvas')[0];

var rotateLeftSpan = $('#rotate-left');
var rotateRightSpan = $('#rotate-right');
var rotateUpSpan = $('#rotate-up');
var rotateDownSpan = $('#rotate-down');
var birdEyeToggle = $('#toggle-bird-eye');

var nodeColorScale = [
    // '#a50026',
    '#c31727',
    '#d73027',
    '#e56a35',
    '#f46d43',
    '#fab86d',
    '#fdae61',
    '#fee497',
    '#fee08b',
    '#ecf497',
    '#d9ef8b',
    '#bde487',
    '#a6d96a',
    '#86d168',
    '#66bd63',
    '#409f5a',
    '#1a9850',
    // '#0f7a42',
    // '#006837'
]

let gridValue;

function legendTitle(d, e) {
    return d.path;
}

function legendContent(d, e) {
    const lines = d.data?.lines || { coverage: 0, covered_line: 0, total_line: 0 };
    const mutations = d.data?.mutations || { coverage: 0, killed: 0, total_mutation: 0 };

    return `
        <div>
            <table class="table table-striped">
                <tbody>
                    <tr>
                        <td>Lines coverage (%)</td>
                        <td>${lines.coverage}</td>
                    </tr>
                    <tr>
                        <td>Lines covered</td>
                        <td>${lines.covered_line} / ${lines.total_line}</td>
                    </tr>
                    <tr>
                        <td>Mutations coverage (%)</td>
                        <td>${mutations.coverage}</td>
                    </tr>
                    <tr>
                        <td>Mutations killed</td>
                        <td>${mutations.killed} / ${mutations.total_mutation}</td>
                    </tr>
                </tbody>
            </table>
        </div>`;
}

function nodeHeight(d) {
    let trace_size = 0
    function snapToGrid(grid, value) {
        return grid * Math.ceil(value / grid);
    }
    if (d.children && d.children.length)
        return 0;
    if (d.data[metric].covered_line) {
        trace_size = d.data[metric].covered_line;
    }
    return snapToGrid(gridValue, trace_size);
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
        return;
    }

    setGridValue(d);
    var mergedData = {};

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
                    mutations: { coverage: 0, killed: 0, total_mutation: 0 }
                };
            }

            mergedData[currentPath].lines.covered_line += data.lines.covered_line;
            mergedData[currentPath].lines.total_line += data.lines.total_line;
            mergedData[currentPath].lines.coverage = (mergedData[currentPath].lines.covered_line / mergedData[currentPath].lines.total_line) * 100;

            mergedData[currentPath].mutations.killed += data.mutations.killed;
            mergedData[currentPath].mutations.total_mutation += data.mutations.total_mutation;
            mergedData[currentPath].mutations.coverage = (mergedData[currentPath].mutations.killed / mergedData[currentPath].mutations.total_mutation) * 100;
        }
    }
    var treeData = dataHelpers.convertToTree(mergedData, mapperParams);
    dataHelpers.colorize(d3, treeData, 'colorValue', nodeColorScale, { min: 20, max: 100 });

    var codeCityChart;
    try {
        codeCityChart = codeCity.codeCity(d3, $('#code-city-chart')[0], treeData, graphParams);
    } catch (e) {
        if (e instanceof TypeError)
            $('#code-city-chart').html("\
                <div> \
                <img src=\"../assets/images/code_city_large.png\" width=\"100%\"> \
                <p style=\"background:rgba(255,0,0,0.7); top:300px; position:absolute; font-size:18px;\" class=\"alert alert-danger\"> \
                    It seems that your browser does not support (or has deactivated) WebGL, which is required for this graph. Please upgrade your browser or make sure that WebGL is activated. Below is a teaser of what the visualization of your project might look like. \
                </p> \
                </div> \
                ");
    }

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
    birdEyeToggle.on('change', function () {
        if (birdEyeToggle.is(':checked')) {
            codeCityChart.setCameraBirdEyeView();
        } else {
            codeCityChart.setCameraNormalView();
        }
    });
});