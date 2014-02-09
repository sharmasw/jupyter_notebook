var xor = function (a, b) {return !a ^ !b;}; 
var isArray = function (a) {return toString.call(a) === "[object Array]" || toString.call(a) === "[object RuntimeArray]";};
var recursive_compare = function(a, b) {
    // Recursively compare two objects.
    var same = true;
    same = same && !xor(a instanceof Object, b instanceof Object);
    same = same && !xor(isArray(a), isArray(b));

    if (same) {
        if (a instanceof Object) {
            for (var key in a) {
                if (a.hasOwnProperty(key) && !recursive_compare(a[key], b[key])) {
                    same = false;
                    break;
                }
            }
            for (var key in b) {
                if (b.hasOwnProperty(key) && !recursive_compare(a[key], b[key])) {
                    same = false;
                    break;
                }
            }
        } else {
            return a === b;
        }    
    }
    
    return same;
}

// Test the widget framework.
casper.notebook_test(function () {
    var index;
    
    this.then(function () {
    
        // Check if the WidgetManager class is defined.
        this.test.assert(this.evaluate(function() {
            return IPython.WidgetManager !== undefined; 
        }), 'WidgetManager class is defined');
    });

    index = this.append_cell(
        'from IPython.html import widgets\n' + 
        'from IPython.display import display, clear_output\n' +
        'print("Success")');
    this.execute_cell_then(index);

    this.then(function () {
        // Check if the widget manager has been instantiated.
        this.test.assert(this.evaluate(function() {
            return IPython.notebook.kernel.widget_manager !== undefined; 
        }), 'Notebook widget manager instantiated');

        // Functions that can be used to test the packing and unpacking APIs
        var that = this;
        var test_pack = function (input) {
            var output = that.evaluate(function(input) {
                var model = new IPython.WidgetModel(IPython.notebook.kernel.widget_manager, undefined);
                var results = model._pack_models(input);
                delete model;
                return results;
            }, {input: input});
            that.test.assert(recursive_compare(input, output), 
                JSON.stringify(input) + ' passed through Model._pack_model unchanged');
        };
        var test_unpack = function (input) {
            var output = that.evaluate(function(input) {
                var model = new IPython.WidgetModel(IPython.notebook.kernel.widget_manager, undefined);
                var results = model._unpack_models(input);
                delete model;
                return results;
            }, {input: input});
            that.test.assert(recursive_compare(input, output), 
                JSON.stringify(input) + ' passed through Model._unpack_model unchanged');
        };
        var test_packing = function(input) {
            test_pack(input);
            test_unpack(input);
        };
        
        test_packing({0: 'hi', 1: 'bye'})
        test_packing(['hi', 'bye'])
        test_packing(['hi', 5])
        test_packing(['hi', '5'])
        test_packing([1.0, 0])
        test_packing([1.0, false])
        test_packing([1, false])
        test_packing([1, false, {a: 'hi'}])
        test_packing([1, false, ['hi']])
    });

    var textbox = {};
    throttle_index = this.append_cell(
        'import time\n' +
        'textbox = widgets.TextWidget()\n' +
        'display(textbox)\n' +
        'textbox.add_class("my-throttle-textbox")\n' +
        'def handle_change(name, old, new):\n' +
        '    print(len(new))\n' +
        '    time.sleep(0.5)\n' +
        'textbox.on_trait_change(handle_change, "value")\n' +
        'print(textbox.model_id)');
    this.execute_cell_then(throttle_index, function(index){
        textbox.model_id = this.get_output_cell(index).text.trim();

        this.test.assert(this.cell_element_exists(index, 
            '.widget-area .widget-subarea'),
            'Widget subarea exists.');

        this.test.assert(this.cell_element_exists(index, 
            '.my-throttle-textbox'), 'Textbox exists.');

        // Send 20 characters
        this.sendKeys('.my-throttle-textbox', '....................');
    });

    this.wait_for_widget(textbox);

    this.then(function () { 
        var outputs = this.evaluate(function(i) {
            return IPython.notebook.get_cell(i).output_area.outputs;
        }, {i : throttle_index});

        // Only 4 outputs should have printed, but because of timing, sometimes
        // 5 outputs will print.  All we need to do is verify num outputs <= 5
        // because that is much less than 20.
        this.test.assert(outputs.length <= 5, 'Messages throttled.');

        // We also need to verify that the last state sent was correct.
        var last_state = outputs[outputs.length-1].text;
        this.test.assertEquals(last_state, "20\n", "Last state sent when throttling.");
    });
});