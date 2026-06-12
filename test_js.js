const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const html = fs.readFileSync('frontend/index.html', 'utf8');
const script = fs.readFileSync('frontend/script.js', 'utf8');

const dom = new JSDOM(html, { runScripts: "outside-only" });
const window = dom.window;
const document = window.document;

// Mock localStorage
window.localStorage = {
    getItem: function(key) {
        if (key === 'username') return 'admin';
        return null;
    },
    setItem: function() {},
    removeItem: function() {}
};

// Expose variables to the script context
window.globalDepartments = [{ name: 'test', subdepartments: [{ id: 1, name: 'sub1' }] }];
window.globalItems = [{ id: 1, category: 'test', subcategory: '' }];

try {
    dom.window.eval(script);
    console.log("Script evaluated successfully");
    
    // Run the function
    const promise = dom.window.enterSubDeptView('test');
    if (promise && promise.catch) {
        promise.catch(e => console.error("Promise rejected:", e));
    }
    console.log("enterSubDeptView completed");
} catch (e) {
    console.error("Evaluation error:", e);
}
