const calculate_side_capacity = (size) => {
    let sc = 0
    let bc_max = 0
    while (bc_max < size) {
        sc+=1
        let next_lc = sc * 4
        let nol = sc * 2
        bc_max = next_lc * nol - 1
    }

    if (sc == 0) {
        return 1
    }
    return sc
}

const calculate_area = (tree, margin) => {
    tree.x = 0
    tree.y = 0
    calculate_area_recursive(tree, margin)
    calculate_area_offset(tree)
    const normalized_block_size = normalize_area_size(tree)
    return [treeToList(tree), normalized_block_size]
}

const treeToList = (root) => {
    const result = [];
  
    const traverse = (node, depth = 1) => {
        if (!node) return;

        node.depth = depth;  
        result.push(node);

        if (node.children && node.children.length > 0) {
            for (const child of node.children) {
            traverse(child, depth + 1);
            }
        }
    };
  
    traverse(root);
    return result;
  };

const normalize_area_size = (tree) => {
    let maxX = 0;
    let maxY = 0;
    let maxArea = 0
  
    const collectBounds = (node) => {
      if (!node) return;
  
      maxX = Math.max(maxX, node.x + node.dx);
      maxY = Math.max(maxY, node.y + node.dy);
      maxArea = Math.max(maxArea, node.area)
      node.value = node.area
  
      if (node.children) {
        for (const child of node.children) {
          collectBounds(child);
        }
      }
    };
    collectBounds(tree);
  
    const scale = 1 / Math.max(maxX, maxY);
    const areaScale = 1 / maxArea
    const normalizedBlockSize = 2*scale - (2*scale*0.1)
  
    const applyScale = (node) => {
      node.x *= scale;
      node.y *= scale;
      node.dx *= scale;
      node.dy *= scale;
      node.area = node.dx * node.dy
  
      if (node.children) {
        for (const child of node.children) {
          applyScale(child);
        }
      }
    };
    applyScale(tree);
  
    return normalizedBlockSize;
  };

const calculate_area_offset = (node) => {
    if (!node.children) return;
  
    for (let child of node.children) {
      child.x = node.x + child.x;
      child.y = node.y + child.y;
      calculate_area_offset(child);
    }
  };

const calculate_area_recursive = (current_node, margin = 0.5) => {
    if (!current_node.children || !current_node.children.length) {
        const sideCapacity = calculate_side_capacity(current_node.data.mutations.total_mutation)
        current_node.sideCapacity = sideCapacity
        current_node.dx = sideCapacity
        current_node.dy = sideCapacity
        return
    }

    for (let child of current_node.children) {
        calculate_area_recursive(child, margin)
    }

    current_node.children = calculate_layout(current_node, margin)
    const maxX = Math.max(...current_node.children.map(c => c.x + c.dx));
    const maxY = Math.max(...current_node.children.map(c => c.y + c.dy));
    current_node.dx = maxX + margin
    current_node.dy = maxY + margin
}

class Node {
    constructor(x, y, w, h) {
        this.x = x; this.y = y;
        this.w = w; this.h = h;
        this.used = false;   // occupied by a placed element
        this.right = null;   // split to the right
        this.down = null;    // split below
      }
}

const getAvailableNode = (root, w, h, out = []) => {
    if (!root) return out;
    if (root.used) {
        getAvailableNode(root.right, w, h, out);
        getAvailableNode(root.down, w, h, out)
    } else if (root.w >= w && root.h >= h) {
        out.push(root)
    }
    return out
}

const calculate_layout = (node, margin) => {
    let nodeChildren = node.children
    let covrec = new Node(0, 0, 0, 0)
    let result = []
    nodeChildren.sort((a, b) => (b.dx * b.dy) - (a.dx * a.dy))

    let is_all_compute = nodeChildren.every(c => c.dx > 0)
    if (!is_all_compute) {
        return
    }

    let root_size_x = 0
    let root_size_y = 0
    for (let child of nodeChildren) {
        root_size_x += child.dx + 2 * margin;
        root_size_y += child.dy + 2 * margin;
    }
    

    let startNode = new Node(0, 0, root_size_x, root_size_y)

    for (let child of nodeChildren) {
        const preservers = new Map()
        const expanders = new Map()
        let w = child.dx + 2 * margin;
        let h = child.dy + 2 * margin;
        let pnodes = getAvailableNode(startNode, w, h)

        for (let node of pnodes) {
            const preserves = (node.x + w <= covrec.w) && (node.y + h <= covrec.h)

            if (preserves) {
                const waste = area(node) - area({ w: w, h: h})
                preservers.set(node, waste)
            } else {
                const ratioScore = ratioIfPlaced(node, w, h, covrec)
                expanders.set(node, ratioScore)

            }
        }

        let targetNode = null
        if (preservers.size > 0) {
            targetNode = [...preservers.entries()].reduce(
                (best, cur) => (best[1] <= cur[1] ? best : cur)
              )[0];
        } else {
            targetNode = [...expanders.entries()].reduce(
                (best, cur) => (best[1] <= cur[1] ? best : cur)
              )[0];
        }

        let placed;
        const perfect = (targetNode.w === w && targetNode.h === h);
        if (perfect) {
            targetNode.used = true;
            placed = { x: targetNode.x, y: targetNode.y, w, h };
        } else {
            placed = splitToFit(targetNode, w, h);
        }

        child.x = placed.x + margin;
        child.y = placed.y + margin;
        child.dx = w - 2 * margin;;
        child.dy = h - 2 * margin;;
        result.push(child)

        covrec.w = Math.max(covrec.w, placed.x + placed.w);
        covrec.h = Math.max(covrec.h, placed.y + placed.h);
    }


    return result
}

const area = r => r.w * r.h;

function ratioIfPlaced(node, w, h, covrec) {
    const newW = Math.max(covrec.w, node.x + w);
    const newH = Math.max(covrec.h, node.y + h);
    const r = newW / newH;
    // closeness-to-1 score: smaller is better
    return Math.abs(1 - (r >= 1 ? r : 1 / r));
}

function splitToFit(node, w, h) {
    node.used = true;
  
    // Decide split orientation by which leftover is larger
    const dw = node.w - w;
    const dh = node.h - h;
  
    if (dw > dh) {
      // split vertically: left is the fit, right is leftover
      node.right = new Node(node.x + w, node.y, node.w - w, h);
      node.down  = new Node(node.x, node.y + h, node.w, node.h - h);
    } else {
      // split horizontally: top is the fit, bottom is leftover
      node.right = new Node(node.x + w, node.y, node.w - w, h);
      node.down  = new Node(node.x, node.y + h, node.w, node.h - h);
    }
    return new Node(node.x, node.y, w, h); // "virtual" placed rect
  }
  

export {
    calculate_side_capacity,
    calculate_area
}