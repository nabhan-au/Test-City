define(["data/helpers"],function(dataHelpers){
    return {
        complexityExample : function(example){
            var data = dataHelpers.loadJson('../data/complexity/'+example+'_complexity.json');
            return data;
        },
    }
});
