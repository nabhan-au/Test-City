define(["data/helpers"], function (dataHelpers) {
    return {
        complexityExample: function (example) {
            var data = dataHelpers.loadJson('../data/complexity/' + example + '_complexity.json');
            return data;
        },
        fetchProjectData: function (projectName) {
            var apiUrl = `http://0.0.0.0:8000/coverall/project/${projectName}`;

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
    }
});
