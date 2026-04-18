/**
 * TemplateVault
 * Dockable ScriptUI panel for storing and loading .aep project templates.
 *
 * Install: copy to After Effects/Scripts/ScriptUI Panels/
 * Access:  AE → Window → TemplateVault
 *
 * Templates and destinations are saved in ~/Documents/TemplateVault/TemplateVault_data.json
 *
 * Load Copy: if a destination is selected, copies there immediately — no dialog.
 *            If no destination is selected, opens a folder picker and offers to save it.
 */

(function (thisObj) {

    // ── JSON utilities (ExtendScript has no native JSON) ──────────────────────

    function jsonStringify(obj) {
        if (obj === null) return 'null';
        if (typeof obj === 'boolean') return obj ? 'true' : 'false';
        if (typeof obj === 'number') return String(obj);
        if (typeof obj === 'string') {
            return '"' + obj
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"')
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r')
                .replace(/\t/g, '\\t') + '"';
        }
        if (obj instanceof Array) {
            var items = [];
            for (var i = 0; i < obj.length; i++) items.push(jsonStringify(obj[i]));
            return '[' + items.join(',') + ']';
        }
        if (typeof obj === 'object') {
            var pairs = [];
            for (var k in obj) {
                if (obj.hasOwnProperty(k)) {
                    pairs.push(jsonStringify(k) + ':' + jsonStringify(obj[k]));
                }
            }
            return '{' + pairs.join(',') + '}';
        }
        return 'null';
    }

    function jsonParse(str) {
        return eval('(' + str + ')'); // jshint ignore:line
    }

    // ── Data persistence ──────────────────────────────────────────────────────

    var dataDir  = new Folder(Folder.myDocuments.fsName + '/TemplateVault');
    if (!dataDir.exists) dataDir.create();
    var dataFile = new File(dataDir.fsName + '/TemplateVault_data.json');
    var templates    = []; // [{name, path}]
    var destinations = []; // [{name, path}]

    function loadData() {
        if (!dataFile.exists) return;
        dataFile.encoding = 'UTF-8';
        if (!dataFile.open('r')) return;
        var content = dataFile.read();
        dataFile.close();
        if (!content) return;
        try {
            var parsed = jsonParse(content);
            if (parsed && parsed.templates    instanceof Array) templates    = parsed.templates;
            if (parsed && parsed.destinations instanceof Array) destinations = parsed.destinations;
        } catch (e) {
            templates    = [];
            destinations = [];
        }
    }

    function saveData() {
        dataFile.encoding = 'UTF-8';
        if (!dataFile.open('w')) {
            alert('TemplateVault: could not write data file:\n' + dataFile.fsName);
            return;
        }
        dataFile.write(jsonStringify({ templates: templates, destinations: destinations }));
        dataFile.close();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function getTimestamp() {
        var d   = new Date();
        var pad = function (n) { return n < 10 ? '0' + n : String(n); };
        return (
            String(d.getFullYear()) +
            pad(d.getMonth() + 1) +
            pad(d.getDate()) + '_' +
            pad(d.getHours()) +
            pad(d.getMinutes()) +
            pad(d.getSeconds())
        );
    }

    function sanitizeFilename(name) {
        return name.replace(/[\/\\:*?"<>|]/g, '_');
    }

    // ── Build UI ──────────────────────────────────────────────────────────────

    var panel = (thisObj instanceof Panel)
        ? thisObj
        : new Window('palette', 'Template Vault', undefined, { resizeable: true });

    panel.orientation   = 'column';
    panel.alignChildren = ['fill', 'top'];
    panel.margins       = 10;
    panel.spacing       = 8;

    // — Templates section —
    var tplSection = panel.add('panel', undefined, 'Templates');
    tplSection.orientation   = 'column';
    tplSection.alignChildren = ['fill', 'top'];
    tplSection.alignment     = ['fill', 'fill'];
    tplSection.margins       = [10, 15, 10, 10];
    tplSection.spacing       = 6;

    var listbox = tplSection.add('listbox', undefined, [], { multiselect: false });
    listbox.preferredSize = [240, 130];
    listbox.alignment     = ['fill', 'fill'];

    var tplRow1 = tplSection.add('group');
    tplRow1.orientation   = 'row';
    tplRow1.alignChildren = ['fill', 'center'];
    tplRow1.alignment     = ['fill', 'bottom'];

    var btnLoad = tplRow1.add('button', undefined, 'Load Copy');
    btnLoad.helpTip = 'Copy template to selected destination and open it (or browse if none selected)';

    var tplRow2 = tplSection.add('group');
    tplRow2.orientation   = 'row';
    tplRow2.alignChildren = ['fill', 'center'];
    tplRow2.alignment     = ['fill', 'bottom'];

    var btnAdd        = tplRow2.add('button', undefined, 'Add');
    var btnAddOpen    = tplRow2.add('button', undefined, 'Add Open');
    var btnRemove     = tplRow2.add('button', undefined, 'Remove');

    btnAdd.helpTip     = 'Browse for an .aep file and add it as a template';
    btnAddOpen.helpTip = 'Add the currently open project as a template';
    btnRemove.helpTip  = 'Remove selected template from the vault (file is not deleted)';

    // — Destinations section —
    var destSection = panel.add('panel', undefined, 'Destinations');
    destSection.orientation   = 'column';
    destSection.alignChildren = ['fill', 'top'];
    destSection.alignment     = ['fill', 'fill'];
    destSection.margins       = [10, 15, 10, 10];
    destSection.spacing       = 6;

    var destListbox = destSection.add('listbox', undefined, [], { multiselect: false });
    destListbox.preferredSize = [240, 90];
    destListbox.alignment     = ['fill', 'fill'];

    var destBtns = destSection.add('group');
    destBtns.orientation   = 'row';
    destBtns.alignChildren = ['fill', 'center'];
    destBtns.alignment     = ['fill', 'bottom'];

    var btnAddDest      = destBtns.add('button', undefined, 'Add');
    var btnRemoveDest   = destBtns.add('button', undefined, 'Remove');
    var btnClearDest    = destBtns.add('button', undefined, 'Deselect');

    btnAddDest.helpTip    = 'Save a folder as a pinned destination';
    btnRemoveDest.helpTip = 'Remove selected destination (folder is not deleted)';
    btnClearDest.helpTip  = 'Clear destination selection — Load Copy will use the folder picker instead';

    // ── List refresh ──────────────────────────────────────────────────────────

    function refreshList() {
        var prevName = listbox.selection ? listbox.selection.text : null;
        listbox.removeAll();
        for (var i = 0; i < templates.length; i++) {
            listbox.add('item', templates[i].name);
        }
        if (prevName) {
            for (var j = 0; j < listbox.items.length; j++) {
                if (listbox.items[j].text === prevName) { listbox.selection = j; break; }
            }
        }
    }

    function refreshDestList() {
        var prevName = destListbox.selection ? destListbox.selection.text : null;
        destListbox.removeAll();
        for (var i = 0; i < destinations.length; i++) {
            destListbox.add('item', destinations[i].name);
        }
        if (prevName) {
            for (var j = 0; j < destListbox.items.length; j++) {
                if (destListbox.items[j].text === prevName) { destListbox.selection = j; break; }
            }
        }
    }

    // ── Handlers ──────────────────────────────────────────────────────────────

    btnAdd.onClick = function () {
        var f = File.openDialog('Select an After Effects template file');
        if (!f) return;
        if (!/\.aepx?$/i.test(f.name)) {
            alert('Please select an After Effects project file (.aep).');
            return;
        }
        var defaultName = f.name.replace(/\.aepx?$/i, '');
        var name = prompt('Template name:', defaultName, 'Add Template');
        if (!name || name === '') return;
        templates.push({ name: name, path: f.fsName });
        saveData();
        refreshList();
        listbox.selection = listbox.items.length - 1;
    };

    btnAddOpen.onClick = function () {
        if (!app.project) return;

        var defaultName = app.project.file
            ? app.project.file.name.replace(/\.aepx?$/i, '')
            : 'Untitled Template';
        var name = prompt('Template name:', defaultName, 'Add as Template');
        if (!name || name === '') return;

        var templateFile;

        if (app.project.file) {
            // Already saved — use the current file path directly
            templateFile = app.project.file;
        } else {
            // Unsaved — ask where to save it first
            var dest = File.saveDialog('Choose where to save this template');
            if (!dest) return;
            // Ensure .aep extension if the user didn't type one
            var destPath = dest.fsName;
            if (!/\.aepx?$/i.test(destPath)) destPath += '.aep';
            app.project.save(new File(destPath));
            if (!app.project.file) {
                alert('Failed to save the project. Template was not added.');
                return;
            }
            templateFile = app.project.file;
        }

        templates.push({ name: name, path: templateFile.fsName });
        saveData();
        refreshList();
        listbox.selection = listbox.items.length - 1;
    };

    btnLoad.onClick = function () {
        if (!listbox.selection) {
            alert('Select a template first.');
            return;
        }
        var idx = listbox.selection.index;
        var tpl = templates[idx];
        var src = new File(tpl.path);

        if (!src.exists) {
            alert('Template file not found:\n' + tpl.path + '\n\nYou may need to re-add it if it was moved.');
            return;
        }

        var destFolder;

        if (destListbox.selection) {
            // Use pinned destination — no dialog needed
            var destIdx = destListbox.selection.index;
            destFolder = new Folder(destinations[destIdx].path);
            if (!destFolder.exists) {
                alert('Destination folder not found:\n' + destinations[destIdx].path + '\n\nYou may need to re-add it.');
                return;
            }
        } else {
            // No destination selected — fall back to folder picker
            destFolder = Folder.selectDialog('Choose folder for the new project');
            if (!destFolder) return;
            // Offer to save it for next time
            if (confirm('Save "' + destFolder.name + '" as a destination?\n' + destFolder.fsName)) {
                var destName = prompt('Destination name:', destFolder.name, 'Save Destination');
                if (destName && destName !== '') {
                    destinations.push({ name: destName, path: destFolder.fsName });
                    saveData();
                    refreshDestList();
                    destListbox.selection = destListbox.items.length - 1;
                }
            }
        }

        var destPath = destFolder.fsName + '/' + sanitizeFilename(tpl.name) + '_' + getTimestamp() + '.aep';

        if (!src.copy(destPath)) {
            alert('Failed to copy the template file. Check that the destination folder is writable.');
            return;
        }

        app.open(new File(destPath));
    };

    btnRemove.onClick = function () {
        if (!listbox.selection) {
            alert('Select a template to remove.');
            return;
        }
        var idx = listbox.selection.index;
        if (!confirm('Remove "' + templates[idx].name + '" from the vault?\n\nThe original file will not be deleted.')) return;
        templates.splice(idx, 1);
        saveData();
        refreshList();
    };

    btnAddDest.onClick = function () {
        var f = Folder.selectDialog('Select a destination folder');
        if (!f) return;
        var name = prompt('Destination name:', f.name, 'Add Destination');
        if (!name || name === '') return;
        destinations.push({ name: name, path: f.fsName });
        saveData();
        refreshDestList();
        destListbox.selection = destListbox.items.length - 1;
    };

    btnClearDest.onClick = function () {
        destListbox.selection = null;
    };

    btnRemoveDest.onClick = function () {
        if (!destListbox.selection) {
            alert('Select a destination to remove.');
            return;
        }
        var idx = destListbox.selection.index;
        if (!confirm('Remove "' + destinations[idx].name + '" from destinations?\n\nThe folder itself will not be deleted.')) return;
        destinations.splice(idx, 1);
        saveData();
        refreshDestList();
    };

    // Double-click shortcut for Load Copy
    listbox.onDoubleClick = function () {
        btnLoad.onClick();
    };

    // ── Init ──────────────────────────────────────────────────────────────────

    loadData();
    refreshList();
    refreshDestList();

    panel.layout.layout(true);
    panel.layout.resize();
    panel.onResizing = panel.onResize = function () { panel.layout.resize(); };

    if (panel instanceof Window) {
        panel.center();
        panel.show();
    }

})(this);
