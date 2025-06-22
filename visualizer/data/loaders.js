import { loadJson } from "./helpers";

const backendUrl = "http://localhost:8000"

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

export function uploadProject(projectName, files) {
    const url = `${backendUrl}/coverall/project/${projectName}`;
    const formData = new FormData();
    for (const f of files) {
        formData.append("files", f, f.webkitRelativePath);
    }
    return fetch(url, {
        method: "POST",
        body: formData,
    })
        .then(res => {
            if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
            return res.json();
        });
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