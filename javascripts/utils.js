var FILTER_BY_DOMAIN = 'domain';
var FILTER_BY_PATH = 'path';
var FILTER_BY_FULL = 'full';

function fits(current, storage, filter) {
    
    current = current.toLowerCase();
    storage = storage.toLowerCase();

    var url1 = parseUri(current);
    var url2 = parseUri(storage);
	
    if (storage === '*') {
        return true;
		
    } else if (filter === FILTER_BY_DOMAIN) {
        return url1.host === url2.host;

    } else if (filter === FILTER_BY_PATH) {
        return url1.path == url2.path;
        
    } else if (filter === FILTER_BY_FULL) {
        return current == storage;
        
    } else {
        console.error('WebFormFiller: filter value is wrong: ' + filter);
        return true;
    }
}
