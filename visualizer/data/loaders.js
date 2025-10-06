import { loadJson } from "./helpers";

const backendUrl = "http://localhost:8000"
const batchSize = 400

export function complexityExample(d3, example) {
    const data = loadJson(d3, '../data/complexity/' + example + '_complexity.json');
    return data;
}

export function fetchProjectList() {
    const url = `${backendUrl}/coverall/project/list`;
    return fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`Error fetching project list: ${res.statusText}`);
        return res.json();
      });
  }

  function chunkFiles(files, size) {
    const a = Array.from(files), out = [];
    for (let i = 0; i < a.length; i += size) out.push(a.slice(i, i + size));
    return out;
  }
  
  // POST one batch to your endpoint (finalize on last batch)
  async function uploadBatch(projectName, filesChunk, finalize, start) {
    const url = `${backendUrl}/coverall/project/${encodeURIComponent(projectName)}?finalize=${finalize}&start=${start}`;
    const form = new FormData();
    for (const f of filesChunk) {
        form.append("files", f, f.webkitRelativePath); // optional metadata
    }
    const res = await fetch(url, { method: "POST", body: form });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Batch upload failed: ${res.status} ${res.statusText} ${text}`);
    }
    return res.json();
  }


//   export function uploadProject(projectName, files) {
//     const url = `${backendUrl}/coverall/project/${projectName}`;
//     const formData = new FormData();
//     for (const f of files) {
//         formData.append("files", f, f.webkitRelativePath);
//     }
    
//     return fetch(url, {
//         method: "POST",
//         body: formData,
//     })
//         .then(res => {
//             if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
//             return res.json();
//         });
// }
  
  /**
   * Upload files to /coverall/project/{project_name} in batches.
   * The endpoint you provided will stage batches; on the last batch it will run coverage and clean up.
   *
   * @param {string} projectName
   * @param {FileList|File[]} files
   * @param {{ backendUrl: string, batchSize?: number, limit?: number, onProgress?: (info)=>void }} opts
   */
  export async function uploadProject(projectName, files) {  
    const list = Array.from(files);
    const toSend = typeof limit === "number" ? list.slice(0, 1000000) : list;
    const chunks = chunkFiles(toSend, batchSize);
  
    for (let i = 0; i < chunks.length; i++) {
      const isLast = i === chunks.length - 1;
      const isStart = i === 0
      await uploadBatch(projectName, chunks[i], isLast, isStart);
    }
  }

export function fetchProjectData(projectName) {
    const url = `${backendUrl}/coverall/project/${projectName}`;
    return fetch(url)
        .then(res => {
            if (!res.ok) throw new Error("Network response was not ok");
            return res.json();
        })
        .then(data => data.summary);
}