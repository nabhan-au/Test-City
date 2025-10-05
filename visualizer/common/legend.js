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
  let pinned = false;

  function render(d) {
    legendDiv.innerHTML = d ? `
      <div class="space-y-2">
        <h3 class="text-sm font-semibold break-words">${legendTitle(d)}</h3>
        <div>${legendContent(d)}</div>
        <div class="pt-2 text-xs text-gray-400">${pinned ? 'Pinned (click to unpin)' : 'Tip: click to pin'}</div>
      </div>
    ` : `<p class="text-sm text-gray-300">Hover a building…</p>`;
  }

  render(null);

  return {
    onClick(d) {
    //   pinned = !pinned;
    //   render(pinned ? d : null);
    render(d);
    },
    // onMouseout() {
    //   if (!pinned) render(null);
    // },
    // onMouseover(d) {
    //   if (!pinned) render(d);
    // }
  };
}