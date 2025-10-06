function convertToTree(data, params) {
    var min = {};
    var max = {};

    function recursivelyAddNode(node, keyComponents, key, data, depth = 0) {
        node.children = node.children || [];
        node.depth = depth;

        if (keyComponents.length && keyComponents[0]) {
            var keyComponent = keyComponents.shift();
            var child;

            for (var i = 0; i < node.children.length; i++) {
                if (node.children[i].name === keyComponent) {
                    child = node.children[i];
                    break;
                }
            }

            if (!child) {
                child = { name: keyComponent };
                node.children.push(child);
            }
            recursivelyAddNode(child, keyComponents, key, data, depth + 1);
        } else {
            node.key = key;
            node.data = data;

            if (params.mappers) {
                for (var mapper in params.mappers) {
                    node[mapper] = params.mappers[mapper](node);
                    if (min[mapper] === undefined || min[mapper] > node[mapper])
                        min[mapper] = node[mapper];
                    if (max[mapper] === undefined || max[mapper] < node[mapper])
                        max[mapper] = node[mapper];
                }
            }
        }
    }

    var tree = {};

    for (var key in data)
        recursivelyAddNode(tree, params.split(key), key, data[key], 0);

    tree.minima = min;
    tree.maxima = max;

    return tree;
}

function loadJson(d3, url) {
    var data = new Promise(function(resolve, reject) {
        d3.json(url, function(error, root) {
            if (error) {
                reject(new Error(error));
            }
            else {
                resolve(root.summary);
            }
        });
    });

    return data;
}

function colorize(d3, tree,key,colors,params){

    var params = params || {};

    var minValue = params.min || tree.minima[key],
        maxValue = params.max || tree.maxima[key]

    var colorScale = d3.scale.linear()
        .domain(d3.range(minValue,maxValue,(maxValue-minValue)/colors.length))
        .range(colors);

    var toHexByte = (v) => {
        const n = Math.max(0, Math.min(255, Math.round(v)));
        return n.toString(16).padStart(2, '0');
    }

    var applyColorScale = (node) => {
        if (node[key] == 0) {
            const r = 255;
            const g = 190;
            const b = 50;
            const hex = `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
            node.color = hex;
        } else {
            node.color = colorScale(Math.max(minValue,Math.min(node[key],maxValue)));
        }
        for(var i in node.children)
            applyColorScale(node.children[i]);
    };

    applyColorScale(tree);
    return tree;
}

export {
    convertToTree,
    loadJson,
    colorize,
}