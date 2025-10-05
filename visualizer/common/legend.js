// export function legend(legendDiv,legendTitle,legendContent) {
//     return {
//         onClick : function(d,e){
//             //nothing...
//         }.bind(this),

//         onMouseout: function(d,e){
//             legendDiv.innerHTML = '';
//         }.bind(this),

//         onMouseover: function(d,e) {

//             var et = e.target;
//             if (d && e){

//                 var legendRect = legendDiv.getBoundingClientRect();
//                 var desiredLeft = e.clientX - legendRect.left;
//                 var desiredTop = e.clientY - legendRect.top;
//                 //additional offset in order to avoid hiding information behind the popup
//                 desiredTop -= 10;

//                 var style = {
//                     left:desiredLeft+"px",
//                     top:desiredTop+"px"
//                 };

//                 var info = legendContent(d,e);

//                 legendDiv.innerHTML = `
//                   <div style="pointer-events:none; position:absolute; max-width:none; width:auto; height:auto; white-space:normal; padding:10px;" class="popover top show">
//                     <div class="arrow"></div>
//                     <h3 class="popover-title" style="white-space:normal; margin-bottom:8px;">${legendTitle(d,e)}</h3>
//                     <div class="popover-content" style="width:auto; height:auto; white-space:normal;">
//                       ${info}
//                     </div>
//                   </div>
//                 `;

//                 var legend = legendDiv.children[0];

//                 for(var key in style)
//                     legendDiv.style[key] == style[key];

//                 legend.style.left = Math.ceil(desiredLeft-legend.clientWidth/2.0)+"px";
//                 legend.style.top = (desiredTop-legend.clientHeight)+"px";

//             }


//         }.bind(this)
//     };
// }

export function legend(legendDiv, legendTitle, legendContent) {

  const placeholder = () =>
    (legendDiv.innerHTML = `<p class="text-sm text-gray-300">Hover a building…</p>`);

  const fileHTML = (d) => `
    <div class="space-y-2">
      <h3 class="text-sm font-semibold break-words">${legendTitle(d)}</h3>
      <div>${legendContent(d)}</div>
    </div>
  `;

  const cubeHTML = (d) => `
    <div class="space-y-2">
      <div class="bg-white text-gray-800 p-4 rounded-lg shadow-md">
        <div class="text-sm space-y-1">
          ${d.parentTitle || d.parentPath ? `<div class="flex justify-between"><span>File</span><strong>${d.parentTitle || d.parentPath}:${d.methodLine}</strong></div>`: ``}
          <div class="flex justify-between"><span>Type</span><strong>${d.kind ?? '-'}</strong></div>
          ${d.description
            ? `
            <div class="mt-3">
                <span class="text-s text-gray-700">Description:</span>
                <div class="max-h-32 overflow-y-auto border border-gray-200 rounded-md mt-1 p-2 bg-gray-50 overflow-x-auto whitespace-nowrap">
                  ${d.description}
                </div>
              </div>
            `
            : ``}
          ${
          d.tests && d.tests.length
            ? `
              <div class="mt-3">
                <span class="text-s text-gray-700">Tests:</span>
                <div class="max-h-32 overflow-y-auto border border-gray-200 rounded-md mt-1 p-2 bg-gray-50">
                  <ul class="list-disc list-inside text-xs text-gray-700 space-y-0.5 overflow-x-auto whitespace-nowrap">
                    ${d.tests.map(t => `<li>${t["@name"]}</li>`).join("")}
                  </ul>
                </div>
              </div>
            `
            : ``
          }
          <div class="flex justify-left mt-5 items-center mt-3">
                <a href="" target="_blank" rel="noopener noreferrer"
                   class="inline-flex items-center bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-md hover:bg-blue-700 active:scale-[0.97] transition-all duration-150">
                  Open Report
                </a>
              </div>
        </div>
      </div>
    </div>
  `;

  const isCube = (d) => !!(d && typeof d === 'object' && 'isMutant' in d);

  const testRenderCube = (d) => {
    console.log(d)
    return cubeHTML
  }

  function render(d) {
    if (!d) return placeholder();
    legendDiv.innerHTML = isCube(d) ? cubeHTML(d) : fileHTML(d);
  }

  function renderCube(d) {
    legendDiv.innerHTML = cubeHTML(d);
  }

  placeholder();

  return {
    // onClick(d)    { pinned = !pinned; render(pinned ? d : null); },
    // onMouseover(d){ if (!pinned) render(d); },
    // onMouseout()  { if (!pinned) placeholder(); },
    onClick(d)    { render(d); },
    renderCube, 
  };
}