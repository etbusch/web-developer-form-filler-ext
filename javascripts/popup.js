var tab_url;

function refreshSetsList(url) {

    var table = $('#sets');
    
    browser.storage.sync.get().then(response => {
        // Clear inside the callback so overlapping refreshes don't duplicate rows
        table.find('tbody tr').remove();
        let filter = response.filter;
        delete response.filter;
        if (!table.hasClass('allsets')) {
            for (let i in response) {
                if (typeof(response[i]) !== 'object') {
                    delete response[i];
                    browser.storage.sync.remove(i);
                    continue;
                }
                if (!fits(url, response[i].url, filter)) {
                    delete response[i]; 
                }
            }
        }
        let sets = response;
        if (Object.keys(sets).length !== 0) {
            $('#sets').show();
            $('#nosets').hide();
            $('#clearall').removeClass('disabled');
        } else {
            $('#sets').hide();
            $('#nosets').show();
            //$('#nosets_url').text(url);
            $('#clearall').addClass('disabled');
            return;
        }
        
        renderSets(sets);
        
        if (table.hasClass('allsets')) {
            $('#clearall').addClass('disabled');
            renderAdditionalInfo(sets);
        } 
    }, error => console.log(`Error: ${error}`))
}

function renderSets(sets) {

    for (var i in sets) {
        var set = sets[i];
        // Set names, URLs and hotkeys can come from imported JSON, so they
        // are only ever inserted as text.
        var newRow = $('<tr></tr>').attr('data-key', i);
        newRow.append('<td class="restore"><i class="fas fa-arrow-up"></i> Restore</td>');
        newRow.append($('<td class="setName"></td>').text(set.name));

        var submitHtml = set.autoSubmit
            ? '<i class="fas fa-check"></i> <span>Yes</span>'
            : '<i class="fas fa-times"></i> <span>No</span>';

        newRow.append($('<td class="submit"></td>').toggleClass('active', !!set.autoSubmit).html(submitHtml));
        newRow.append('<td class="remove"><i class="fas fa-trash-alt"></i></td>');
        newRow.append('<td class="export"><i class="fas fa-share-alt"></i></td>');

        var hotkey = set.hotkey;
        newRow.append($('<td class="hotkey"></td>').text(hotkey ? hotkey : 'none'));

        $('#sets').append(newRow);
    }
}

function renderAdditionalInfo(sets) {

    var table = $('#sets');

    if (!table.find('th.url').length) {
        table.find('thead tr').append('<th class="url">URL</th>');
    }

    for (var i in sets) {
        var set = sets[i];
        var row = table.find('tr[data-key="' + i + '"]');
        var substrHref = set.url.length > 40 ? set.url.substring(0, 40) + '...' : set.url;
        var link = $('<a target="_blank"></a>').text(substrHref);
        if (/^(https?|file):/i.test(set.url)) {
            link.attr('href', set.url);
        }
        row.append($('<td class="url"></td>').append(link));
        row.find('td.restore').addClass('disabled').find('i').remove();
    }
}

// Updates one or more properties of a set in a single read/write, so that
// several changes to the same set can't clobber each other.
function saveValues(tr, values) {
    var key = tr.data('key').toString();
    return browser.storage.sync.get(key).then(response => {
        Object.assign(response[key], values);
        return browser.storage.sync.set(response);
    }).catch(error => console.log(`Error: ${error}`));
}

function saveValue(tr, property, value) {
    return saveValues(tr, { [property]: value });
}

function sendMessage(obj, callback) {

    chrome.tabs.query({ 'active': true, 'currentWindow': true }, function (tab) {
        chrome.tabs.sendMessage(tab[0].id, obj, callback);
    });
}

function setCurrentFilter() {

    var value;
    browser.storage.sync.get('filter').then(response => {
        value = response.filter
        if (!value) {
            browser.storage.sync.set({'filter': FILTER_BY_FULL});
            value = FILTER_BY_FULL;
        }
    
        var link = $('a.filter[id=' + value + ']');
        link.css('font-weight', 'bold');
    }, error => console.log(`Error: ${error}`))
}

function getRandomStorageId() {

    return Date.now();
}

chrome.tabs.query({ 'active': true, 'currentWindow': true }, function (tab) {
    tab_url = tab[0].url;
    refreshSetsList(tab_url);
});

$(document).ready(function () {
    setCurrentFilter();
    
	$('.donatelink').click(function () {
		$('#donate').toggle();
	});
	
    $("#check").click(function () {
        
    });
    
    $("#viewSets").click(function () {
        $('#sets').addClass('allsets');
        refreshSetsList();
    });

    $("#import").click(function () {
		var importBlock = $('#importBlock');

        if (importBlock.is(':visible')) {
            importBlock.hide();
            return;
        }

        importBlock.show();
		importBlock.find('#txtImportFormJson').focus();
    });
	
    $("#btnImportSave").click(function () {
		var json = $('#txtImportFormJson').val();

		try {
			var importedForm = JSON.parse(json);

			if (!importedForm.url || !importedForm.content || !importedForm.name) {
				throw new Error("Invalid JSON format");
			}
			
			if (importedForm.url === '*'){
				importedForm.name += '-global';
			}
			
			var key = getRandomStorageId();
            let bundle = {};
            bundle[key] = importedForm
            browser.storage.sync.set(bundle)
                .then(() => refreshSetsList(tab_url), err => alert('Could not save set: ' + err.message));
		}
		catch (err) {
			alert('Got an error: ' + err.message);
		}
		
		$('#importBlock').hide();
    });

    $("#clearall").click(function () {
        if ($(this).hasClass("disabled")) {
            return;
        }

        if (!confirm('Are you sure?')) {
            return;
        }

        browser.storage.sync.get().then(response => {
            let filter = response.filter;
            delete response.filter;
            for (let i in response) {
                if (!fits(tab_url, response[i].url, filter)) {
                    delete response[i]; 
                }
            }
            let sets = response;
            for (let i in sets) {
                browser.storage.sync.remove(i).then(() => refreshSetsList(tab_url));
            }

        }, error => console.log(`Error: ${error}`))        
    });

    $('#cleareverything').click(() => {
        if (confirm("Are you sure?!?")) {
            browser.storage.sync.clear().then(() => refreshSetsList(tab_url));
        }
    });

    $("#store").click(function () {
        sendMessage({ "action": 'store' }, function readResponse(obj) {
            var error = $('#error');
            if (!obj || chrome.runtime.lastError || obj.error) {

                if (chrome.runtime.lastError) {
                    error.html('<h6>Error :( Something wrong with current tab. Try to reload it.</h6>');
                } else if (!obj) {
                    error.html('<h6>Error :( Null response from content script</h6>');
                } else if (obj.error) {
                    error.empty().append($('<h6></h6>').text('Error :\'( ' + obj.message));
                }

                error.show();
                return;
            } else {
                error.hide();
            }

            var key = getRandomStorageId();

            var setSettings = {
				url: tab_url,
                autoSubmit: false,
                submitQuery: '',
                content: obj.content,
                name: key,
                hotkey: ''
            };

            let bundle = {};
            bundle[key] = setSettings;
            browser.storage.sync.set(bundle).then(() => refreshSetsList(tab_url), err => {
                error.empty().append($('<h6></h6>').text('Error :( Could not save set: ' + err.message));
                error.show();
            });
        });
    });

    var sets = $('#sets');

    sets.on("click", 'td', function (event) {
        $('div.block').hide();
    });

    sets.on("click", 'td.restore:not(.disabled)', function (event) {
        var key = $(this).parents('tr').data('key').toString();
        browser.storage.sync.get(key).then(setSettings => {
            sendMessage({ action: 'fill', setSettings: setSettings[key] }, function(response) {
                window.close();
            });
        }, error => console.log(`Error: ${error}`))

    });
    
    sets.on("click", 'td.submit', function (event) {
        var td = $(this);
        var tr = td.parents('tr');

        if (td.hasClass('active')) {
            saveValue(tr, 'autoSubmit', false).then(() => refreshSetsList(tab_url));
            return;
        }

        var key = tr.data('key').toString();

        browser.storage.sync.get(key).then(response => {
            var oldQuery = response[key]['submitQuery'];
            oldQuery = oldQuery ? oldQuery : 'input[type=submit]';
            var query = prompt('Enter jquery selector for submit button to auto click', oldQuery);
            if (query) {
                return saveValues(tr, { submitQuery: query, autoSubmit: true });
            }
        }, error => console.log(`Error: ${error}`))
        .then(() => refreshSetsList(tab_url));
    });

    sets.on("click", 'td.remove', function (event) {
        var tr = $(this).parents('tr');
        var key = tr.data('key').toString();
        browser.storage.sync.remove(key).then(() => refreshSetsList(tab_url));
    });

    sets.on("click", 'td.export', function (event) {
        var exportBlock = $('#exportBlock');

        if (exportBlock.is(':visible')) {
            exportBlock.hide();
            return;
        }

        var td = $(this);
        var tr = td.parents('tr');
        var key = tr.data('key').toString();
        var formJson = null;
        browser.storage.sync.get(key).then(response => {
            td.addClass('active');
            exportBlock.show();
            exportBlock.find('#txtFormJson').val(JSON.stringify(response[key])).focus().select();
        }, error => console.log(`Error: ${error}`))
    });
    
    sets.on("click", 'td.hotkey', function (event) {
        var hotkeyBlock = $('#hotkeyBlock');
        
        if (hotkeyBlock.is(':visible')) {
            hotkeyBlock.hide();
            return;
        }
        
        var td = $(this);
        var tr = td.parents('tr');
        var key = tr.data('key').toString();
        browser.storage.sync.get(key).then(response => {
            var value = response[key]['hotkey'];
            td.addClass('active');
            hotkeyBlock.show();
            hotkeyBlock.find('#txtHotkey').val(value).focus().select();
        }, error => console.log(`Error: ${error}`))

    });
    
    sets.on("click", 'td.setName', function (event) {
        var td = $(this);
        if (td.find('input').length) {
            return;
        }
        
        var tr = td.parents('tr');
        var input = $('<input type="text" class="span1 txtSetName" />');
        var key = tr.data('key').toString();
        browser.storage.sync.get(key).then(response => {
            input.val(response[key]['name']);
            td.empty().append(input).find('input').focus().select();
        }, error => console.log(`Error: ${error}`));
    });
    
    sets.on("keyup", 'input.txtSetName', function (e) {
        var textbox = $(this);
        var value = textbox.val();
        
        if (!value) {
            return;
        }

        var code = e.keyCode || e.which;
        var tr = textbox.parents('tr');
        
        if (code == 13) { //Enter keycode
            var td = textbox.parents('td');
            saveValue(tr, 'name', value);
            td.text(value);
        } else {
            saveValue(tr, 'name', value);
        }
    });
    
    $('#hotkeyBlock').on("keyup", '#txtHotkey', function (e) {
        var code = e.keyCode || e.which;
        if (code == 13) { //Enter keycode
            $('#btnHotkeySave').click();
        }
    });
    
    $('#btnHotkeySave').click(function() {
        $('#hotkeyBlock').hide();
        var tr = $('#sets td.hotkey.active').parents('tr');
        var hotkey = $('#hotkeyBlock #txtHotkey').val();
        saveValue(tr, 'hotkey', hotkey).then(() => {
            refreshSetsList(tab_url);
            sendMessage({ "action": 'rebind' }, function(response) { });
        });
    });
    
    $('#btnHotkeyCancel').click(function () {
        $('#hotkeyBlock').hide();
    });
        
    $('#btnExportClose').click(function () {
        $('#exportBlock').hide();
    });
    
    $('#btnImportClose').click(function () {
        $('#importBlock').hide();
    });
    
    $('a.filter').click(function () {
        var link = $(this);
        var value = link.attr('id');
        $('a.filter').not(link).css('font-weight', 'normal');
        browser.storage.sync.set({'filter': value});
        link.css('font-weight', 'bold');

        refreshSetsList(tab_url);
    });

    sets
      .on("mousedown", 'tbody td', function(event) {
        $(this).addClass('clicked');
    }).on("mouseup", 'tbody td', function(event) {
        $(this).removeClass('clicked');
    });

});