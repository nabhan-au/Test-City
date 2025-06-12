import {loadJson} from "./helpers";

const backendUrl = "http://localhost:8000"

export function complexityExample (d3, example) {
    const data = loadJson(d3, '../data/complexity/' + example + '_complexity.json');
    return data;
}

export function fetchProjectData  (projectName) {
    const apiUrl = `${backendUrl}/coverall/project/${projectName}`;

    return fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            return data.summary;
        })
        .catch(error => {
            console.error('There was a problem with the fetch operation:', error);
            throw error;
        });
}
